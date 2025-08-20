import os
import time
import pandas as pd
import networkx as nx
from pyscipopt import Model, quicksum
import numpy as np

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

# Step 5: Define optimization model with exact min-max scalarization
def define_model_minmax_scalarization(G, drivers, riders, f1_bounds, f2_bounds):
    """
    Convert multi-objective problem to single objective using exact min-max scalarization
    
    Formulation:
    min_x max{f1_norm(x), f2_norm(x)}
    where:
    f1_norm(x) = 1 - (f1(x) - f1_min)/(f1_max - f1_min)  [since we want to maximize f1]
    f2_norm(x) = (f2(x) - f2_min)/(f2_max - f2_min)      [since we want to minimize f2]
    
    This is equivalent to: min_x z
    subject to: z >= f1_norm(x), z >= f2_norm(x)
    """
    num_drivers = len(drivers)
    num_riders = len(riders)
    model = Model("rideshare_exact_minmax")

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

    # Min-max scalarization variable
    z = model.addVar(vtype="C", name="z", lb=0, ub=1)

    # Define load constraints
    for i in range(num_drivers):
        model.addCons(
            load[i] == quicksum(I[i, j] for j in range(num_riders)),
            f"load_definition_{i}"
        )

    # Define the average constraint for variance calculation
    model.addCons(
        avg_riders == quicksum(I[i, j] for i in range(num_drivers) for j in range(num_riders)) / num_drivers,
        "average_riders"
    )

    # Define deviation constraints for variance calculation
    for i in range(num_drivers):
        model.addCons(
            deviation[i] == load[i] - avg_riders,
            f"deviation_driver_{i}"
        )
        # Quadratic constraint for squared deviation
        model.addCons(
            deviation_sq[i] >= deviation[i] * deviation[i],
            f"deviation_squared_{i}"
        )

    # Define the two objectives
    # Objective 1: f1(x) = Total riders accommodated
    f1 = quicksum(I[i, j] for i in range(num_drivers) for j in range(num_riders))
    
    # Objective 2: f2(x) = Variance in rider distribution
    f2 = quicksum(deviation_sq[i] for i in range(num_drivers)) / num_drivers

    # Normalized objectives as per the mathematical specification
    # f1_norm(x) = 1 - (f1(x) - f1_min)/(f1_max - f1_min)  [we want to minimize this, so larger f1 gives smaller f1_norm]
    # f2_norm(x) = (f2(x) - f2_min)/(f2_max - f2_min)      [we want to minimize this directly]
    
    if f1_max > f1_min:
        f1_normalized = 1 - (f1 - f1_min) / (f1_max - f1_min)
    else:
        f1_normalized = 0  # If bounds are equal, set to 0 (best case)
    
    if f2_max > f2_min:
        f2_normalized = (f2 - f2_min) / (f2_max - f2_min)
    else:
        f2_normalized = 0  # If bounds are equal, set to 0 (best case)

    # Min-max constraints: z >= max{f1_norm, f2_norm}
    model.addCons(z >= f1_normalized, "minmax_constraint_f1")
    model.addCons(z >= f2_normalized, "minmax_constraint_f2")
    
    # Objective: minimize z (which represents the maximum of the normalized objectives)
    model.setObjective(z, "minimize")

    # Constraint for each driver to ensure the deviated path length does not exceed the maximum allowed distance
    for i, driver in enumerate(drivers):
        max_distance = nx.shortest_path_length(G, source=driver['source'], target=driver['destination'], weight='weight') * (1 + driver['threshold'] / 100)
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

    return model, I, deviation_sq, load, f1, f2, z, f1_normalized, f2_normalized

# Step 6: Solve model and display results with exact min-max scalarization
def solve_model_minmax(model, I, deviation_sq, load, f1, f2, z, f1_norm, f2_norm, drivers, riders, f1_bounds, f2_bounds, output_file):
    model.optimize()
    if model.getStatus() == "optimal":
        output_file.write("=== EXACT MIN-MAX SCALARIZATION RESULTS ===\n")
        output_file.write(f"Min-Max Objective Value (z): {model.getObjVal():.6f}\n")
        output_file.write("This represents: min_x max{f1_norm(x), f2_norm(x)}\n")
        
        print("=== EXACT MIN-MAX SCALARIZATION RESULTS ===")
        print(f"Min-Max Objective Value (z): {model.getObjVal():.6f}")
        print("This represents: min_x max{f1_norm(x), f2_norm(x)}")
        
        # Calculate raw objective values
        total_riders = model.getVal(f1)
        variance = model.getVal(f2)
        z_value = model.getVal(z)
        f1_norm_value = model.getVal(f1_norm)
        f2_norm_value = model.getVal(f2_norm)
        
        # Calculate normalized objective values manually for verification
        f1_min, f1_max = f1_bounds
        f2_min, f2_max = f2_bounds
        
        if f1_max > f1_min:
            f1_normalized_manual = 1 - (total_riders - f1_min) / (f1_max - f1_min)
        else:
            f1_normalized_manual = 0
            
        if f2_max > f2_min:
            f2_normalized_manual = (variance - f2_min) / (f2_max - f2_min)
        else:
            f2_normalized_manual = 0
        
        raw_objectives = f"\n--- Raw Objective Values ---\n"
        raw_objectives += f"f1(x) - Total riders accommodated: {total_riders}\n"
        raw_objectives += f"f2(x) - Variance in rider distribution: {variance:.6f}\n"
        
        norm_objectives = f"\n--- Normalized Objective Values ---\n"
        norm_objectives += f"f1_norm(x) = 1 - (f1-f1_min)/(f1_max-f1_min): {f1_norm_value:.6f}\n"
        norm_objectives += f"f2_norm(x) = (f2-f2_min)/(f2_max-f2_min): {f2_norm_value:.6f}\n"
        norm_objectives += f"z = max{{f1_norm, f2_norm}}: {z_value:.6f}\n"
        
        verification = f"\n--- Manual Verification ---\n"
        verification += f"f1_norm (manual): {f1_normalized_manual:.6f}\n"
        verification += f"f2_norm (manual): {f2_normalized_manual:.6f}\n"
        verification += f"max{{f1_norm, f2_norm}} (manual): {max(f1_normalized_manual, f2_normalized_manual):.6f}\n"
        
        bounds_info = f"\n--- Objective Bounds Used ---\n"
        bounds_info += f"f1 bounds: [{f1_min}, {f1_max}]\n"
        bounds_info += f"f2 bounds: [{f2_min:.6f}, {f2_max:.6f}]\n"
        
        # Write to file and print to console
        for content in [raw_objectives, norm_objectives, verification, bounds_info]:
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
            min_load_actual = min(loads_list)
            max_load_actual = max(loads_list)
            load_spread = max_load_actual - min_load_actual
            fairness_ratio = min_load_actual / max_load_actual if max_load_actual > 0 else 1
            
            fairness_metrics = f"\n--- Fairness Metrics ---\n"
            fairness_metrics += f"Actual calculated variance: {actual_variance:.6f}\n"
            fairness_metrics += f"Load spread (max - min): {load_spread}\n"
            fairness_metrics += f"Fairness ratio (min/max): {fairness_ratio:.3f}\n"
            
            # Interpretation
            interpretation = f"\n--- Interpretation ---\n"
            if z_value < 0.3:
                interpretation += "Excellent balance between efficiency and fairness\n"
            elif z_value < 0.5:
                interpretation += "Good balance between efficiency and fairness\n"
            elif z_value < 0.7:
                interpretation += "Moderate balance, some trade-offs evident\n"
            else:
                interpretation += "Significant trade-offs, difficult to optimize both objectives\n"
            
            for content in [fairness_metrics, interpretation]:
                output_file.write(content)
                print(content, end='')
        
        return total_riders, variance, z_value
            
    else:
        error_msg = "No feasible solution found.\n"
        output_file.write(error_msg)
        print(error_msg, end='')
        return None, None, None

# Step 7: Run exact min-max scalarization (single run since it's parameter-free)
def run_exact_minmax_analysis(G, drivers, riders, f1_bounds, f2_bounds, output_file):
    """
    Run exact min-max scalarization analysis
    This formulation doesn't require parameter tuning as it finds the balanced solution automatically
    """
    header = "=== EXACT MIN-MAX SCALARIZATION ANALYSIS ===\n\n"
    formulation = "Formulation: min_x max{f1_norm(x), f2_norm(x)}\n"
    explanation = "where:\n"
    explanation += "  f1_norm(x) = 1 - (f1(x) - f1_min)/(f1_max - f1_min)\n"
    explanation += "  f2_norm(x) = (f2(x) - f2_min)/(f2_max - f2_min)\n"
    description = "\nThis finds the solution that minimizes the worst-case normalized objective.\n\n"
    
    intro_text = header + formulation + explanation + description
    output_file.write(intro_text)
    print(intro_text, end='')
    
    model, I, deviation_sq, load, f1, f2, z, f1_norm, f2_norm = define_model_minmax_scalarization(
        G, drivers, riders, f1_bounds, f2_bounds
    )
    
    riders_count, variance, z_value = solve_model_minmax(
        model, I, deviation_sq, load, f1, f2, z, f1_norm, f2_norm,
        drivers, riders, f1_bounds, f2_bounds, output_file
    )
    
    if riders_count is not None:
        result = {
            'riders': riders_count,
            'variance': variance,
            'z_value': z_value,
            'method': 'Exact Min-Max Scalarization'
        }
        
        summary = "\n" + "="*80 + "\n"
        summary += "\n=== ANALYSIS SUMMARY ===\n"
        summary += f"Method: {result['method']}\n"
        summary += f"Riders accommodated: {result['riders']}\n"
        summary += f"Variance: {result['variance']:.6f}\n"
        summary += f"Min-max objective value: {result['z_value']:.6f}\n"
        
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
    output_dir = os.path.join(script_dir, 'OutputSCIP')
    os.makedirs(output_dir, exist_ok=True)
    
    # Create output file
    output_file_path = os.path.join(output_dir, 'Output.txt')
    
    with open(output_file_path, 'w') as output_file:
        title = "🚗 MIN-MAX SCALARIZATION FOR RIDESHARE OPTIMIZATION 🚗\n"
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
        
        # Run exact min-max scalarization analysis
        result = run_exact_minmax_analysis(G, drivers, riders, f1_bounds, f2_bounds, output_file)
        
        # End the timer and print execution time
        end_time = time.time()
        timing_text = f"\n⏱️  Total execution time: {end_time - start_time:.4f} seconds\n"
        completion_text = "\n✅ Min-Max Scalarization Analysis Complete!\n"
        
        final_text = timing_text + completion_text
        output_file.write(final_text)
        print(final_text, end='')
    
    print(f"\n📁 Output saved to: {output_file_path}")
