#!/usr/bin/env python3
import os
import time
import pandas as pd
import networkx as nx
from pyscipopt import Model, quicksum
import numpy as np

def load_data(drivers_file, riders_file, graph_file):
    drivers_df = pd.read_csv(drivers_file)
    riders_df = pd.read_csv(riders_file)
    graph_df = pd.read_csv(graph_file)
    return drivers_df, riders_df, graph_df

def prepare_data(drivers_df, riders_df):
    drivers = []
    for _, row in drivers_df.iterrows():
        drivers.append({
            'id': row['id'],
            'source': row['source'],
            'destination': row['destination'],
            'seats': int(row['seats']),
            'threshold': float(row.get('threshold', 0.0))
        })
    riders = [{'id': row['id'], 'source': row['source'], 'destination': row['destination']} for _, row in riders_df.iterrows()]
    return drivers, riders

def build_graph(graph_df):
    G = nx.DiGraph()
    for _, row in graph_df.iterrows():
        # expects columns: source, destination, weight
        G.add_edge(row['source'], row['destination'], weight=float(row['weight']))
    return G

def define_model_with_ys(G, drivers, riders, R_upperbound=None):
    """
    Build model with:
      - binary assignment vars x[i,j]
      - integer load vars load[i]
      - binary y[i,t] for t=1..R (y[i,t] == 1 <=> load[i] >= t)
    Returns model, x, load, y, and values for num_drivers and num_riders.
    """
    num_drivers = len(drivers)
    num_riders = len(riders)
    model = Model("rideshare_lexicographic_maxmin")
    # Optional: quiet output
    # model.hideOutput()

    # Binary assignment variables x[i,j]
    x = {}
    for i in range(num_drivers):
        for j in range(num_riders):
            x[i, j] = model.addVar(vtype="B", name=f"x_{i}_{j}")

    # Loads (integer)
    load = {}
    for i in range(num_drivers):
        load[i] = model.addVar(vtype="I", name=f"load_{i}", lb=0, ub=num_riders)

    # Load definitions
    for i in range(num_drivers):
        model.addCons(load[i] == quicksum(x[i, j] for j in range(num_riders)), f"load_def_{i}")

    # Each rider at most once
    for j in range(num_riders):
        model.addCons(quicksum(x[i, j] for i in range(num_drivers)) <= 1, f"unique_assign_{j}")

    # Capacity constraints
    for i, driver in enumerate(drivers):
        model.addCons(quicksum(x[i, j] for j in range(num_riders)) <= driver['seats'], f"capacity_{i}")

    # Feasibility constraints: driver->rider->driver path lengths within threshold
    for i, driver in enumerate(drivers):
        # If no path on base route, this driver can't serve anyone (loads remain 0)
        if not (nx.has_path(G, driver['source'], driver['destination'])):
            continue
        try:
            base_route_len = nx.shortest_path_length(G, source=driver['source'], target=driver['destination'], weight='weight')
        except nx.NetworkXNoPath:
            continue

        max_distance = base_route_len * (1.0 + driver['threshold'] / 100.0)

        for j, rider in enumerate(riders):
            # require that the three subpaths exist
            if (nx.has_path(G, driver['source'], rider['source'])
                and nx.has_path(G, rider['source'], rider['destination'])
                and nx.has_path(G, rider['destination'], driver['destination'])):
                deviated_path_length = (
                    nx.shortest_path_length(G, source=driver['source'], target=rider['source'], weight='weight')
                    + nx.shortest_path_length(G, source=rider['source'], target=rider['destination'], weight='weight')
                    + nx.shortest_path_length(G, source=rider['destination'], target=driver['destination'], weight='weight')
                )
                # use a relative tolerance to avoid floating point artifacts
                tol = 1e-6 * max(1.0, max_distance)
                if deviated_path_length - max_distance > tol:
                    # forbid assignment if the detour exceeds allowed max
                    model.addCons(x[i, j] == 0, f"feas_zero_driver_{i}_rider_{j}")
            else:
                # missing path(s): forbid assignment
                model.addCons(x[i, j] == 0, f"feas_no_path_driver_{i}_rider_{j}")

    # Determine R (max threshold for y). If provided, use it, else compute from data:
    if R_upperbound is None:
        max_seats = max((d['seats'] for d in drivers), default=0)
        R = min(num_riders, max_seats)
    else:
        R = min(num_riders, R_upperbound)

    # Create y[i,t] variables and link to load using a tight formulation:
    y = {}
    M = num_riders  # safe big-M: no driver load can exceed num_riders
    for i in range(num_drivers):
        for t in range(1, R + 1):
            y[i, t] = model.addVar(vtype="B", name=f"y_{i}_{t}")
            # Enforce: y[i,t] == 1 <=> load[i] >= t
            # Correct linearization (both directions):
            #   load[i] >= t * y[i,t]
            #   load[i] <= (t-1) + M * y[i,t]
            model.addCons(load[i] >= t * y[i, t], f"link_low_{i}_{t}")
            model.addCons(load[i] <= (t - 1) + M * y[i, t], f"link_high_{i}_{t}")

    return model, x, load, y, num_drivers, num_riders, R

def solve_lexicographic(model, x, load, y, drivers, riders, R, output_file, maximize_total_after=True):
    """
    Iterative lexicographic max-min:
      For t=1..R maximize S_t = sum_i y[i,t], fix S_t to opt, repeat.
    Optionally maximize total assigned riders as final tie-breaker.
    Returns dict with loads, total_riders, min_load, S_vals.
    """

    num_drivers = len(drivers)
    num_riders = len(riders)
    S_vals = {}

    # Iteratively optimize for each threshold t (1..R)
    for t in range(1, R + 1):
        St_expr = quicksum(y[i, t] for i in range(num_drivers))
        model.freeTransform()  # <-- Add this before setting objective or adding constraints
        model.setObjective(St_expr, "maximize")

        model.optimize()
        status = model.getStatus()
        if status != "optimal":
            output_file.write(f"Lexicographic phase t={t}: No optimal solution found (status: {status}). Stopping further lexicographic steps.\n")
            print(f"Lexicographic phase t={t}: No optimal solution found (status: {status}). Stopping further lexicographic steps.")
            break

        S_t_opt = int(round(model.getObjVal()))
        S_vals[t] = S_t_opt
        output_file.write(f"Phase t={t}: max number of drivers with load >= {t} is {S_t_opt}\n")
        print(f"Phase t={t}: max number of drivers with load >= {t} is {S_t_opt}")

        model.freeTransform()  # <-- Add this before adding the constraint below
        model.addCons(quicksum(y[i, t] for i in range(num_drivers)) == S_t_opt, f"fix_St_{t}")

        # NOTE: no short-circuit here — continue lexicographic refinement up to R
        # (If you want the old short-circuit, add it back intentionally.)

    # Optional final efficiency tie-breaker: maximize total riders while keeping lexicographic constraints fixed
    if maximize_total_after:
        total_riders_expr = quicksum(x[i, j] for i in range(num_drivers) for j in range(num_riders))
        model.freeTransform()
        model.setObjective(total_riders_expr, "maximize")
        model.optimize()
        status2 = model.getStatus()
        if status2 != "optimal":
            output_file.write(f"Final tie-breaker (maximize total riders): No optimal solution (status: {status2}).\n")
            print(f"Final tie-breaker (maximize total riders): No optimal solution (status: {status2}).")
        else:
            output_file.write("Final tie-breaker optimal.\n")
            print("Final tie-breaker optimal.")

    # Collect final solution values
    # After optimization, check status before extracting solution
    if model.getStatus() in ["optimal", "feasible"]:
        final_loads = [int(round(model.getVal(load[i]))) for i in range(num_drivers)]
        final_total_riders = int(round(sum(model.getVal(x[i, j]) for i in range(num_drivers) for j in range(num_riders))))
        final_min_load = min(final_loads) if final_loads else 0

        # Write per-driver loads to output file
        for i, driver in enumerate(drivers):
            output_file.write(f"Driver {driver['id']}: {final_loads[i]} riders\n")
    else:
        final_loads = []
        final_total_riders = 0
        final_min_load = 0
        output_file.write("No optimal solution found (status: infeasible).\n")

    output_file.write("\n=== LEXICOGRAPHIC FINAL RESULTS ===\n")
    output_file.write(f"Min driver load: {final_min_load}\n")
    output_file.write(f"Total riders assigned: {final_total_riders}\n")

    return {
        'loads': final_loads,
        'total_riders': final_total_riders,
        'min_load': final_min_load,
        'S_vals': S_vals
    }

if __name__ == "__main__":
    start_time = time.time()

    script_dir = os.path.dirname(os.path.abspath(__file__))
    input_dir = os.path.join(script_dir, 'Input')
    map_dir = os.path.join(script_dir, 'map')
    output_dir = os.path.join(script_dir, 'OutputSCIPDeRideFairMaxMinLexico')
    os.makedirs(output_dir, exist_ok=True)
    output_file_path = os.path.join(output_dir, 'Output.txt')

    drivers_file = os.path.join(input_dir, 'drivers.csv')
    riders_file = os.path.join(input_dir, 'riders.csv')
    graph_file = os.path.join(map_dir, 'graph.csv')

    with open(output_file_path, 'w') as output_file:
        header = "=== LEXICOGRAPHIC MAX–MIN FAIRNESS FOR RIDESHARE ===\n"
        output_file.write(header)
        print(header)

        # Load and prepare
        drivers_df, riders_df, graph_df = load_data(drivers_file, riders_file, graph_file)
        drivers, riders = prepare_data(drivers_df, riders_df)
        G = build_graph(graph_df)

        info = f"Drivers: {len(drivers)}, Riders: {len(riders)}, Graph nodes: {G.number_of_nodes()}, edges: {G.number_of_edges()}\n"
        output_file.write(info)
        print(info)

        # Choose R upperbound to reduce y-size
        max_seats = max((d['seats'] for d in drivers), default=0)
        R_upperbound = min(len(riders), max_seats)
        output_file.write(f"Using R_upperbound = {R_upperbound} (min(num_riders, max_seats)).\n")
        print(f"Using R_upperbound = {R_upperbound} (min(num_riders, max_seats)).")

        # Build model with y variables for lexicographic optimization
        model, x, load, y, num_drivers, num_riders, R = define_model_with_ys(G, drivers, riders, R_upperbound=R_upperbound)

        # Solve lexicographic max-min and then tie-break with efficiency
        result = solve_lexicographic(model, x, load, y, drivers, riders, R, output_file, maximize_total_after=True)

        # Analysis & summary
        drivers_count = len(drivers)
        riders_count = len(riders)
        assignments_made = result['total_riders']
        loads = result['loads']
        variance = np.var(loads) if loads else 0.0
        std_dev = np.std(loads) if loads else 0.0
        load_spread = max(loads) - min(loads) if loads else 0
        fairness_ratio = (min(loads) / max(loads)) if loads and max(loads) > 0 else 0.0

        print("\n=== ANALYSIS SUMMARY ===")
        print("Method: Lexicographic Max-Min Fairness")
        print(f"Drivers: {drivers_count}")
        print(f"Riders: {riders_count}")
        print(f"Assignments made: {assignments_made}")
        print(f"Variance: {variance:.6f}")
        print(f"Standard deviation: {std_dev:.6f}")
        print(f"Load spread (max - min): {load_spread}")
        print(f"Fairness ratio (min/max): {fairness_ratio:.3f}")

        # Also write to output.txt
        output_file.write("\n=== ANALYSIS SUMMARY ===\n")
        output_file.write("Method: Lexicographic Max-Min Fairness\n")
        output_file.write(f"Drivers: {drivers_count}\n")
        output_file.write(f"Riders: {riders_count}\n")
        output_file.write(f"Assignments made: {assignments_made}\n")
        output_file.write(f"Variance: {variance:.6f}\n")
        output_file.write(f"Standard deviation: {std_dev:.6f}\n")
        output_file.write(f"Load spread (max - min): {load_spread}\n")
        output_file.write(f"Fairness ratio (min/max): {fairness_ratio:.3f}\n")

        end_time = time.time()
        output_file.write(f"\nTotal execution time: {end_time - start_time:.4f} sec\n")
        print(f"\nTotal execution time: {end_time - start_time:.4f} sec\n")

    print(f"Output written to: {output_file_path}")
