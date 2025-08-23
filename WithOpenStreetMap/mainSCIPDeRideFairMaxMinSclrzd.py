import os
import time
import pandas as pd
import networkx as nx
from pyscipopt import Model, quicksum
import numpy as np

# NOTE:
# Variance minimization may not strongly affect results if:
# - The assignment is dominated by the efficiency objective (max riders), so fairness (variance) is only optimized after capacity is saturated.
# - The feasible region is constrained such that only a few assignments are possible, making variance minimization less impactful.
# - The max-min scalarization balances both objectives, but if the solution is already close to optimal for both, variance changes little.
# - If most drivers have similar loads due to constraints, variance is naturally low and minimizing it further has little effect.

# Step 1: Load data
def load_data(drivers_file, riders_file, graph_file):
    drivers_df = pd.read_csv(drivers_file)
    riders_df = pd.read_csv(riders_file)
    graph_df = pd.read_csv(graph_file)
    return drivers_df, riders_df, graph_df

# Step 2: Prepare drivers and riders data
def prepare_data(drivers_df, riders_df):
    drivers = []
    for _, row in drivers_df.iterrows():
        drivers.append({
            'id': row['id'],
            'source': row['source'],
            'destination': row['destination'],
            'seats': row['seats'],
            'threshold': row['threshold']
        })

    riders = [{'id': row['id'], 'source': row['source'], 'destination': row['destination']} for _, row in riders_df.iterrows()]
    return drivers, riders

# Step 3: Build graph from graph_df
def build_graph(graph_df):
    G = nx.DiGraph()
    for _, row in graph_df.iterrows():
        G.add_edge(row['source'], row['destination'], weight=row['weight'])
    return G

# Step 4: Estimate objective bounds for min-max scalarization
def estimate_objective_bounds(G, drivers, riders):
    """
    Estimate the minimum and maximum values for each objective to enable normalization
    """
    num_drivers = len(drivers)
    num_riders = len(riders)
    
    # Objective 1 bounds: Total riders accommodated
    f1_min = 0  # Minimum: no riders accommodated
    f1_max = min(num_riders, sum(driver['seats'] for driver in drivers))  # Maximum: all riders or total capacity
    
    # Objective 2 bounds: Variance in rider distribution
    # Minimum variance: perfectly equal distribution
    if num_drivers > 0:
        perfect_distribution = num_riders / num_drivers
        f2_min = 0  # Perfect distribution has zero variance
        
        # Maximum variance: all riders go to one driver
        worst_case_loads = [0] * (num_drivers - 1) + [num_riders]
        mean_load = num_riders / num_drivers
        f2_max = sum((load - mean_load) ** 2 for load in worst_case_loads) / num_drivers
    else:
        f2_min, f2_max = 0, 1
    
    return (f1_min, f1_max), (f2_min, f2_max)

# Step 5: Define optimization model with max-min scalarization
def define_model_maxmin_scalarization(G, drivers, riders, f1_bounds, f2_bounds):
    """
    Convert multi-objective problem to single objective using max-min scalarization
    
    Formulation:
    max_{x,t} t
    subject to:
    U1 == (f1 - f1_min)/(f1_max - f1_min)
    U2 == 1 - (f2 - f2_min)/(f2_max - f2_min)
    t <= U1
    t <= U2
    """
    num_drivers = len(drivers)
    num_riders = len(riders)
    model = Model("rideshare_maxmin")

    f1_min, f1_max = f1_bounds
    f2_min, f2_max = f2_bounds

    # Define decision variables x_ij
    I = {}
    for i in range(num_drivers):
        for j in range(num_riders):
            I[i, j] = model.addVar(vtype="B", name=f"x_{i}_{j}")

    # Additional variables for objective calculations
    # Load for each driver (number of riders assigned)
    load = {}
    for i in range(num_drivers):
        load[i] = model.addVar(vtype="I", name=f"load_{i}", lb=0, ub=num_riders)
    
    # Variables for variance calculation (Objective 2)
    avg_riders = model.addVar(vtype="C", name="avg_riders", lb=0)
    deviation = {}
    deviation_sq = {}
    for i in range(num_drivers):
        deviation[i] = model.addVar(vtype="C", name=f"deviation_{i}", lb=-num_riders, ub=num_riders)
        deviation_sq[i] = model.addVar(vtype="C", name=f"deviation_sq_{i}", lb=0)

    # Max-min scalarization variable
    t = model.addVar(vtype="C", name="t", lb=0, ub=1)

    # Explicit utility variables (fix): make U1 and U2 actual variables and constrain them
    U1 = model.addVar(vtype="C", name="U1", lb=0, ub=1)
    U2 = model.addVar(vtype="C", name="U2", lb=0, ub=1)

    # Define load constraints
    for i in range(num_drivers):
        model.addCons(
            load[i] == quicksum(I[i, j] for j in range(num_riders)),
            f"load_definition_{i}"
        )

    # Define the average constraint for variance calculation
    if num_drivers > 0:
        model.addCons(
            avg_riders == quicksum(I[i, j] for i in range(num_drivers) for j in range(num_riders)) / num_drivers,
            "average_riders"
        )
    else:
        model.addCons(avg_riders == 0, "average_riders_zero_drivers")

    # Define deviation constraints for variance calculation
    for i in range(num_drivers):
        model.addCons(
            deviation[i] == load[i] - avg_riders,
            f"deviation_driver_{i}"
        )
        # Quadratic equality (SCIP can handle quadratic constraints if available):
        model.addCons(deviation_sq[i] == deviation[i] * deviation[i], f"deviation_sq_def_{i}")

    # Define the two objectives (as expressions)
    f1 = quicksum(I[i, j] for i in range(num_drivers) for j in range(num_riders))
    f2 = quicksum(deviation_sq[i] for i in range(num_drivers)) / num_drivers if num_drivers > 0 else 0

    # Now define U1 and U2 via explicit constraints (this is the important fix)
    # U1 == normalized f1
    if f1_max > f1_min:
        model.addCons(U1 == (f1 - f1_min) / (f1_max - f1_min), "U1_definition")
    else:
        model.addCons(U1 == 1, "U1_definition_degenerate")

    # U2 == normalized (1 - scaled variance)
    if f2_max > f2_min:
        model.addCons(U2 == 1 - (f2 - f2_min) / (f2_max - f2_min), "U2_definition")
    else:
        model.addCons(U2 == 1, "U2_definition_degenerate")

    # Max-min constraints: t <= U1, t <= U2
    model.addCons(t <= U1, "maxmin_constraint_U1")
    model.addCons(t <= U2, "maxmin_constraint_U2")
    
    # Objective: maximize t (which represents the minimum of the normalized utilities)
    model.setObjective(t, "maximize")

    # Constraint for each driver to ensure the deviated path length does not exceed the maximum allowed distance
    for i, driver in enumerate(drivers):
        # protect against cases where driver source/destination not connected
        if not (nx.has_path(G, driver['source'], driver['destination'])):
            # If the driver itself has no path, then they cannot serve any rider — we could either skip or set max_distance to inf
            continue
        max_distance = nx.shortest_path_length(G, source=driver['source'], target=driver['destination'], weight='weight') * (1 + driver['threshold'] / 100.0)
        for j, rider in enumerate(riders):
            if nx.has_path(G, driver['source'], rider['source']) and nx.has_path(G, rider['source'], rider['destination']) and nx.has_path(G, rider['destination'], driver['destination']):
                deviated_path_length = (nx.shortest_path_length(G, source=driver['source'], target=rider['source'], weight='weight') +
                                        nx.shortest_path_length(G, source=rider['source'], target=rider['destination'], weight='weight') +
                                        nx.shortest_path_length(G, source=rider['destination'], target=driver['destination'], weight='weight'))
                model.addCons(I[i, j] * deviated_path_length <= max_distance, f"deviated_path_driver_{i}_rider_{j}")

    # Unique Assignment Constraint for each rider
    for j in range(num_riders):
        model.addCons(
            quicksum(I[i, j] for i in range(num_drivers)) <= 1, f"unique_assignment_rider_{j}"
        )

    # Car Capacity Constraint for each driver
    for i, driver in enumerate(drivers):
        model.addCons(
            quicksum(I[i, j] for j in range(num_riders)) <= driver['seats'], f"car_capacity_driver_{i}"
        )

    # Return U1 and U2 (variables) instead of expression objects
    return model, I, deviation_sq, load, f1, f2, t, U1, U2

# Step 6: Solve model and display results with max-min scalarization
def solve_model_maxmin(model, I, deviation_sq, load, f1, f2, t, U1, U2, drivers, riders, f1_bounds, f2_bounds, output_file):
    model.optimize()
    if model.getStatus() == "optimal":
        output_file.write("=== MAX-MIN SCALARIZATION RESULTS ===\n")
        output_file.write(f"Max-Min Objective Value (t): {model.getObjVal():.6f}\n")
        output_file.write("This represents: max_x min{u1(x), u2(x)}\n")
        
        print("=== MAX-MIN SCALARIZATION RESULTS ===")
        print(f"Max-Min Objective Value (t): {model.getObjVal():.6f}")
        print("This represents: max_x min{u1(x), u2(x)}")
        
        # Calculate raw objective values
        # getVal accepts linear/quadratic expressions as well, but now we also have U1/U2 as actual variables to query
        total_riders = model.getVal(f1)
        variance = model.getVal(f2)
        t_value = model.getVal(t)
        u1_value = model.getVal(U1)
        u2_value = model.getVal(U2)
        
        # Calculate normalized utility values manually for verification
        f1_min, f1_max = f1_bounds
        f2_min, f2_max = f2_bounds
        
        if f1_max > f1_min:
            u1_manual = (total_riders - f1_min) / (f1_max - f1_min)
        else:
            u1_manual = 1
            
        if f2_max > f2_min:
            u2_manual = 1 - (variance - f2_min) / (f2_max - f2_min)
        else:
            u2_manual = 1
        
        raw_objectives = f"\n--- Raw Objective Values ---\n"
        raw_objectives += f"f1(x) - Total riders accommodated: {total_riders}\n"
        raw_objectives += f"f2(x) - Variance in rider distribution: {variance:.6f}\n"
        
        norm_utilities = f"\n--- Normalized Utility Values ---\n"
        norm_utilities += f"u1(x) = (f1-f1_min)/(f1_max-f1_min): {u1_value:.6f}\n"
        norm_utilities += f"u2(x) = 1 - (f2-f2_min)/(f2_max-f2_min): {u2_value:.6f}\n"
        norm_utilities += f"t = min{{u1, u2}}: {t_value:.6f}\n"
        
        verification = f"\n--- Manual Verification ---\n"
        verification += f"u1 (manual): {u1_manual:.6f}\n"
        verification += f"u2 (manual): {u2_manual:.6f}\n"
        verification += f"min{{u1, u2}} (manual): {min(u1_manual, u2_manual):.6f}\n"
        
        bounds_info = f"\n--- Objective Bounds Used ---\n"
        bounds_info += f"f1 bounds: [{f1_min}, {f1_max}]\n"
        bounds_info += f"f2 bounds: [{f2_min:.6f}, {f2_max:.6f}]\n"
        
        # Write to file and print to console
        for content in [raw_objectives, norm_utilities, verification, bounds_info]:
            output_file.write(content)
            print(content, end='')
        
        # Show rider distribution per driver
        driver_loads = {}
        assignment_details = f"\n--- Assignment Details ---\n"
        assignment_count = 0
        for i in range(len(drivers)):
            driver_loads[i] = 0
            for j in range(len(riders)):
                if model.getVal(I[i, j]) > 0.5:
                    assignment_line = f"Rider {riders[j]['id']} assigned to Driver {drivers[i]['id']}\n"
                    assignment_details += assignment_line
                    driver_loads[i] += 1
                    assignment_count += 1
        
        assignment_summary = f"\nTotal assignments made: {assignment_count}\n"
        assignment_details += assignment_summary
        
        output_file.write(assignment_details)
        print(assignment_details, end='')
        
        load_distribution = f"\n--- Driver Load Distribution ---\n"
        loads_list = []
        for i, load_count in driver_loads.items():
            load_line = f"Driver {drivers[i]['id']}: {load_count} riders\n"
            load_distribution += load_line
            loads_list.append(load_count)

        output_file.write(load_distribution)
        print(load_distribution, end='')
        
        # Calculate additional fairness metrics
        if loads_list:
            mean_load = sum(loads_list) / len(loads_list)
            actual_variance = sum((load - mean_load) ** 2 for load in loads_list) / len(loads_list)
            actual_stddev = actual_variance ** 0.5  # Standard deviation
            min_load_actual = min(loads_list)
            max_load_actual = max(loads_list)
            load_spread = max_load_actual - min_load_actual
            fairness_ratio = min_load_actual / max_load_actual if max_load_actual > 0 else 1

            fairness_metrics = f"\n--- Fairness Metrics ---\n"
            fairness_metrics += f"Actual calculated standard deviation: {actual_stddev:.6f}\n"
            fairness_metrics += f"Load spread (max - min): {load_spread}\n"
            fairness_metrics += f"Fairness ratio (min/max): {fairness_ratio:.3f}\n"

            # Interpretation
            interpretation = f"\n--- Interpretation ---\n"
            if t_value > 0.7:
                interpretation += "Excellent balance between efficiency and fairness\n"
            elif t_value > 0.5:
                interpretation += "Good balance between efficiency and fairness\n"
            elif t_value > 0.3:
                interpretation += "Moderate balance, some trade-offs evident\n"
            else:
                interpretation += "Significant trade-offs, difficult to optimize both objectives\n"

            for content in [fairness_metrics, interpretation]:
                output_file.write(content)
                print(content, end='')
        
        # Print rider assignments
        print("\nRider assignments:")
        output_file.write("\nRider assignments:\n")
        for j in range(len(riders)):
            assigned_driver = None
            for i in range(len(drivers)):
                if model.getVal(I[i, j]) > 0.5:
                    assigned_driver = drivers[i]['id']
                    break
            print(f"  Rider {riders[j]['id']} assigned to Driver {assigned_driver if assigned_driver is not None else 'None'}")
            output_file.write(f"  Rider {riders[j]['id']} assigned to Driver {assigned_driver if assigned_driver is not None else 'None'}\n")

        # Print driver filled seats
        print("\nDriver filled seats:")
        output_file.write("\nDriver filled seats:\n")
        for i, driver in enumerate(drivers):
            print(f"  Driver {driver['id']} filled seats: {driver_loads[i]}")
            output_file.write(f"  Driver {driver['id']} filled seats: {driver_loads[i]}\n")
        
        return total_riders, variance, t_value
            
    else:
        error_msg = "No feasible solution found.\n"
        output_file.write(error_msg)
        print(error_msg, end='')
        return None, None, None

# Step 7: Run exact max-min scalarization (single run since it's parameter-free)
def run_exact_maxmin_analysis(G, drivers, riders, f1_bounds, f2_bounds, output_file):
    """
    Run exact max-min scalarization analysis
    This formulation doesn't require parameter tuning as it finds the balanced solution automatically
    """
    header = "=== EXACT MAX-MIN SCALARIZATION ANALYSIS ===\n\n"
    formulation = "Formulation: max_x min{u1(x), u2(x)}\n"
    explanation = "where:\n"
    explanation += "  u1(x) = (f1(x) - f1_min)/(f1_max - f1_min)\n"
    explanation += "  u2(x) = 1 - (f2(x) - f2_min)/(f2_max - f2_min)\n"
    description = "\nThis finds the solution that maximizes the worst-case normalized utility.\n\n"
    
    intro_text = header + formulation + explanation + description
    output_file.write(intro_text)
    print(intro_text, end='')
    
    model, I, deviation_sq, load, f1, f2, t, U1, U2 = define_model_maxmin_scalarization(
        G, drivers, riders, f1_bounds, f2_bounds
    )
    
    riders_count, variance, t_value = solve_model_maxmin(
        model, I, deviation_sq, load, f1, f2, t, U1, U2,
        drivers, riders, f1_bounds, f2_bounds, output_file
    )
    
    if riders_count is not None:
        result = {
            'riders': riders_count,
            'variance': variance,
            't_value': t_value,
            'method': 'Exact Max-Min Scalarization'
        }
        
        summary = "\n" + "="*80 + "\n"
        summary += "\n=== ANALYSIS SUMMARY ===\n"
        summary += f"Method: {result['method']}\n"
        summary += f"Riders accommodated: {result['riders']}\n"
        summary += f"Standard deviation: {result['variance'] ** 0.5:.6f}\n"
        summary += f"Variance: {result['variance']:.6f}\n"
        summary += f"Max-min objective value: {result['t_value']:.6f}\n"
        
        # Efficiency vs bounds
        f1_min, f1_max = f1_bounds
        f2_min, f2_max = f2_bounds
        efficiency_pct = (result['riders'] / f1_max * 100) if f1_max > 0 else 0
        fairness_pct = (1 - (result['variance'] - f2_min)/(f2_max - f2_min)) * 100 if f2_max > f2_min else 100
        
        performance = f"\nPerformance relative to bounds:\n"
        performance += f"  Efficiency: {efficiency_pct:.1f}% of maximum possible\n"
        performance += f"  Fairness: {fairness_pct:.1f}% of best possible fairness\n"
        
        final_summary = summary + performance
        output_file.write(final_summary)
        print(final_summary, end='')
        
        return result
    
    return None

# Run the main function if the script is executed directly
if __name__ == "__main__":
    # Start the timer
    start_time = time.time()
    
    # Create OutputSCIP directory if it doesn't exist
    script_dir = os.path.dirname(os.path.abspath(__file__))
    output_dir = os.path.join(script_dir, 'OutputSCIPDeRideFairMaxMinSclrzd')
    os.makedirs(output_dir, exist_ok=True)
    
    # Create output file
    output_file_path = os.path.join(output_dir, 'Output.txt')
    
    with open(output_file_path, 'w') as output_file:
        title = "🚗 MAX-MIN SCALARIZATION FOR RIDESHARE OPTIMIZATION 🚗\n"
        separator = "=" * 60 + "\n"
        header_text = title + separator
        
        output_file.write(header_text)
        print(header_text, end='')
        
        # Get input directories
        input_dir = os.path.join(script_dir, 'Input')

        # Set paths for input files
        drivers_file = os.path.join(input_dir, 'drivers.csv')
        riders_file = os.path.join(input_dir, 'riders.csv')
        
        map_dir = os.path.join(script_dir, 'map')
        graph_file = os.path.join(map_dir, 'graph.csv')
        
        # Load data
        loading_text = "📊 Loading data...\n"
        output_file.write(loading_text)
        print(loading_text, end='')
        
        drivers_df, riders_df, graph_df = load_data(drivers_file, riders_file, graph_file)
        
        # Prepare drivers and riders data
        drivers, riders = prepare_data(drivers_df, riders_df)
        data_info = f"   Drivers: {len(drivers)}, Riders: {len(riders)}\n"
        
        # Build the graph
        G = build_graph(graph_df)
        graph_info = f"   Graph nodes: {G.number_of_nodes()}, edges: {G.number_of_edges()}\n"
        
        info_text = data_info + graph_info
        output_file.write(info_text)
        print(info_text, end='')
        
        # Estimate objective bounds
        bounds_text = "\n🎯 Estimating objective bounds for normalization...\n"
        output_file.write(bounds_text)
        print(bounds_text, end='')
        
        f1_bounds, f2_bounds = estimate_objective_bounds(G, drivers, riders)
        bounds_info = f"   f1 (riders) bounds: {f1_bounds}\n"
        bounds_info += f"   f2 (variance) bounds: {f2_bounds}\n"
        
        output_file.write(bounds_info)
        print(bounds_info, end='')
        
        # Run exact max-min scalarization analysis
        result = run_exact_maxmin_analysis(G, drivers, riders, f1_bounds, f2_bounds, output_file)
        
        # End the timer and print execution time
        end_time = time.time()
        timing_text = f"\n⏱️  Total execution time: {end_time - start_time:.4f} seconds\n"
        completion_text = "\n✅ Max-Min Scalarization Analysis Complete!\n"
        
        final_text = timing_text + completion_text
        output_file.write(final_text)
        print(final_text, end='')
    
    print(f"\n📁 Output saved to: {output_file_path}")
