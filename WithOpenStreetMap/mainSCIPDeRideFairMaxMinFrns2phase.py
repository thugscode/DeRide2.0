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

def define_model_maxmin_fairness(G, drivers, riders):
    """
    Classical max-min fairness:
      Phase 1 objective: maximize z  subject to z <= load_i for all drivers
      Phase 2 objective: maximize total riders subject to z >= z_opt (tie-breaker)
    Returns a SCIP model prepared for phase 1.
    """
    num_drivers = len(drivers)
    num_riders = len(riders)
    model = Model("rideshare_maxmin_fairness")

    # Binary assignment variables x[i,j]
    x = {}
    for i in range(num_drivers):
        for j in range(num_riders):
            x[i, j] = model.addVar(vtype="B", name=f"x_{i}_{j}")

    # Loads
    load = {}
    for i in range(num_drivers):
        load[i] = model.addVar(vtype="I", name=f"load_{i}", lb=0, ub=num_riders)

    # Minimum load variable (z)
    z = model.addVar(vtype="I", name="min_load", lb=0, ub=num_riders)

    # Load definitions
    for i in range(num_drivers):
        model.addCons(load[i] == quicksum(x[i, j] for j in range(num_riders)), f"load_def_{i}")

    # z <= load[i] for all drivers (so z is the minimum)
    for i in range(num_drivers):
        model.addCons(z <= load[i], f"min_load_bound_{i}")

    # Each rider at most once
    for j in range(num_riders):
        model.addCons(quicksum(x[i, j] for i in range(num_drivers)) <= 1, f"unique_assign_{j}")

    # Capacity constraints
    for i, driver in enumerate(drivers):
        model.addCons(quicksum(x[i, j] for j in range(num_riders)) <= driver['seats'], f"capacity_{i}")

    # Feasibility constraints: deviated path length <= allowed max_distance
    for i, driver in enumerate(drivers):
        # skip driver if driver route not connected in graph
        if not (nx.has_path(G, driver['source'], driver['destination'])):
            # This driver cannot serve anyone; leave constraints as they are (loads will be zero)
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
                # If deviated path is longer than max_distance, prevent assignment by setting x[i,j] == 0
                if deviated_path_length > max_distance + 1e-9:
                    # Force x[i,j] == 0
                    model.addCons(x[i, j] == 0, f"feas_zero_driver_{i}_rider_{j}")
                else:
                    # Otherwise no extra constraint required (assignment allowed)
                    pass
            else:
                # Missing path(s): forbid assignment
                model.addCons(x[i, j] == 0, f"feas_no_path_driver_{i}_rider_{j}")

    # Phase 1 objective: maximize z
    model.setObjective(z, "maximize")

    return model, x, load, z

def solve_two_phase_maxmin(model, x, load, z, drivers, riders, output_file):
    # --- Phase 1: maximize z (max-min fairness) ---
    model.optimize()
    status = model.getStatus()
    if status != "optimal":
        output_file.write("Phase 1: No optimal solution found (status: {}).\n".format(status))
        print("Phase 1: No optimal solution found (status: {}).".format(status))
        return None

    z_opt = int(round(model.getObjVal()))
    output_file.write(f"Phase 1 (max-min) optimal min_load z*: {z_opt}\n")
    print(f"Phase 1 (max-min) optimal min_load z*: {z_opt}")

    # Record phase-1 loads
    phase1_loads = [int(round(model.getVal(load[i]))) for i in range(len(drivers))]
    output_file.write("Phase 1 load per driver: " + ", ".join(f"{drivers[i]['id']}:{phase1_loads[i]}" for i in range(len(drivers))) + "\n")

    # --- Phase 2: Tie-breaker maximize total riders subject to z >= z_opt ---
    # Reset model to allow new constraints/objective
    model.freeTransform()  # <-- Add this line
    # Add constraint enforcing z >= z_opt (so we keep same fairness level)
    model.addCons(z >= z_opt, "fix_min_load_to_opt")

    # Now set new objective to maximize total assigned riders
    num_drivers = len(drivers)
    num_riders = len(riders)
    total_riders_expr = quicksum(x[i, j] for i in range(num_drivers) for j in range(num_riders))
    model.setObjective(total_riders_expr, "maximize")

    # Re-optimize
    model.optimize()
    status2 = model.getStatus()
    if status2 != "optimal":
        output_file.write("Phase 2: No optimal solution found (status: {}).\n".format(status2))
        print("Phase 2: No optimal solution found (status: {}).".format(status2))
        # Still try to report phase1 result as fallback
    else:
        output_file.write("Phase 2 (efficiency under fairness) optimal.\n")
        print("Phase 2 (efficiency under fairness) optimal.")

    # Collect final results
    final_z = int(round(model.getVal(z)))
    final_total_riders = int(round(model.getObjVal()))
    final_loads = [int(round(model.getVal(load[i]))) for i in range(len(drivers))]

    output_file.write(f"\n=== FINAL RESULTS ===\n")
    output_file.write(f"Min driver load (z): {final_z}\n")
    output_file.write(f"Total riders assigned: {final_total_riders}\n")

    print("\n=== FINAL RESULTS ===")
    print(f"Min driver load (z): {final_z}")
    print(f"Total riders assigned: {final_total_riders}")

    # Assignments detail
    output_file.write("\nAssignments:\n")
    assigned_count = 0
    for j, rider in enumerate(riders):
        assigned_driver = None
        for i in range(len(drivers)):
            if model.getVal(x[i, j]) > 0.5:
                assigned_driver = drivers[i]['id']
                assigned_count += 1
                break
        output_file.write(f" Rider {rider['id']} -> Driver {assigned_driver if assigned_driver is not None else 'None'}\n")
        
    output_file.write("\nDriver loads:\n")
    print("\nDriver loads:")
    for i, driver in enumerate(drivers):
        output_file.write(f" Driver {driver['id']}: {final_loads[i]} riders\n")


    # Some fairness/efficiency metrics
    if final_loads:
        mean_load = sum(final_loads) / len(final_loads)
        var = sum((l - mean_load) ** 2 for l in final_loads) / len(final_loads)
        std = var ** 0.5
        output_file.write(f"\nMean load: {mean_load:.3f}\nVariance: {var:.6f}\nStd dev: {std:.6f}\n")

    return {
        'min_load': final_z,
        'total_riders': final_total_riders,
        'loads': final_loads
    }

if __name__ == "__main__":
    start_time = time.time()

    script_dir = os.path.dirname(os.path.abspath(__file__))
    input_dir = os.path.join(script_dir, 'Input')
    map_dir = os.path.join(script_dir, 'map')
    output_dir = os.path.join(script_dir, 'OutputSCIPDeRideFairMaxMin2phase')
    os.makedirs(output_dir, exist_ok=True)
    output_file_path = os.path.join(output_dir, 'Output.txt')

    drivers_file = os.path.join(input_dir, 'drivers.csv')
    riders_file = os.path.join(input_dir, 'riders.csv')
    graph_file = os.path.join(map_dir, 'graph.csv')

    with open(output_file_path, 'w') as output_file:
        header = "=== MAX–MIN FAIRNESS (CLASSICAL) FOR RIDESHARE ===\n"
        output_file.write(header)
        print(header)

        # Load and prepare
        drivers_df, riders_df, graph_df = load_data(drivers_file, riders_file, graph_file)
        drivers, riders = prepare_data(drivers_df, riders_df)
        G = build_graph(graph_df)

        info = f"Drivers: {len(drivers)}, Riders: {len(riders)}, Graph nodes: {G.number_of_nodes()}, edges: {G.number_of_edges()}\n"
        output_file.write(info)
        print(info)

        # Build model
        model, x, load, z = define_model_maxmin_fairness(G, drivers, riders)

        # Solve two-phase (max-min then maximize riders)
        result = solve_two_phase_maxmin(model, x, load, z, drivers, riders, output_file)

        # Place this after your solve_two_phase_maxmin call in main, or use these values from your result dict

        drivers_count = len(drivers)
        riders_count = len(riders)
        assignments_made = result['total_riders']
        loads = result['loads']
        variance = np.var(loads)
        std_dev = np.std(loads)
        load_spread = max(loads) - min(loads) if loads else 0
        fairness_ratio = min(loads) / max(loads) if max(loads) > 0 else 0

        print("=== ANALYSIS SUMMARY ===")
        print("Method: Classical Max-Min Fairness (Two-Phase)")
        print(f"Drivers: {drivers_count}")
        print(f"Riders: {riders_count}")
        print(f"Assignments made: {assignments_made}")
        print(f"Variance: {variance:.6f}")
        print(f"Standard deviation: {std_dev:.6f}")
        print(f"Load spread (max - min): {load_spread}")
        print(f"Fairness ratio (min/max): {fairness_ratio:.3f}")

        # Also write to output.txt
        output_file.write("\n=== ANALYSIS SUMMARY ===\n")
        output_file.write("Method: Classical Max-Min Fairness (Two-Phase)\n")
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
