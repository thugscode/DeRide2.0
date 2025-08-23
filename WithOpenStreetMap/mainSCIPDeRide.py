import os
import time
import pandas as pd
import networkx as nx
from pyscipopt import Model, quicksum

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

# Step 4: Define optimization model
def define_model(G, drivers, riders):
    num_drivers = len(drivers)
    num_riders = len(riders)
    model = Model("rideshare_optimization")

    # Define decision variables
    I = {}
    for i in range(num_drivers):
        for j in range(num_riders):
            I[i, j] = model.addVar(vtype="B", name=f"I_{i}_{j}")  # Binary variable

    # Objective - Maximize the number of riders assigned to drivers
    model.setObjective(
        quicksum(I[i, j] for i in range(num_drivers) for j in range(num_riders)), "maximize"
    )

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

    return model, I

# Step 5: Solve model and display results
def solve_model(model, I, drivers, riders, output_file_path):
    model.optimize()
    with open(output_file_path, "a") as f:  # append mode to preserve previous logs
        if model.getStatus() == "optimal":
            f.write(f"Objective value (max riders accommodated): {model.getObjVal()}\n")
            accommodated_riders = 0
            driver_loads = [0 for _ in range(len(drivers))]
            for i in range(len(drivers)):
                for j in range(len(riders)):
                    if model.getVal(I[i, j]) > 0.5:
                        f.write(f"Rider {riders[j]['id']} assigned to Driver {drivers[i]['id']}\n")
                        accommodated_riders += 1
                        driver_loads[i] += 1
            f.write(f"Number of accommodated riders: {accommodated_riders}\n")

            # --- Fairness Metrics ---
            if driver_loads:
                mean_load = sum(driver_loads) / len(driver_loads)
                actual_variance = sum((load - mean_load) ** 2 for load in driver_loads) / len(driver_loads)
                actual_stddev = actual_variance ** 0.5  # Standard deviation
                min_load_actual = min(driver_loads)
                max_load_actual = max(driver_loads)
                load_spread = max_load_actual - min_load_actual
                fairness_ratio = min_load_actual / max_load_actual if max_load_actual > 0 else 1

                fairness_metrics = "\n--- Fairness Metrics ---\n"
                fairness_metrics += f"Actual calculated standard deviation: {actual_stddev:.6f}\n"
                fairness_metrics += f"Load spread (max - min): {load_spread}\n"
                fairness_metrics += f"Fairness ratio (min/max): {fairness_ratio:.3f}\n"
                f.write(fairness_metrics)
                print(fairness_metrics, end='')

                interpretation = "\n--- Interpretation ---\n"
                if accommodated_riders > 0.7 * len(riders):
                    interpretation += "Excellent balance between efficiency and fairness\n"
                elif accommodated_riders > 0.5 * len(riders):
                    interpretation += "Good balance between efficiency and fairness\n"
                elif accommodated_riders > 0.3 * len(riders):
                    interpretation += "Moderate balance, some trade-offs evident\n"
                else:
                    interpretation += "Significant trade-offs, difficult to optimize both objectives\n"
                f.write(interpretation)
                print(interpretation, end='')

            # --- Stats Summary ---
            stats = "\n" + "="*80 + "\n"
            stats += "\n=== ANALYSIS SUMMARY ===\n"
            stats += f"Method: Single Objective (Max Riders)\n"
            stats += f"Drivers: {len(drivers)}\n"
            stats += f"Riders: {len(riders)}\n"
            stats += f"Assignments made: {accommodated_riders}\n"
            stats += f"Variance: {actual_variance:.6f}\n"
            stats += f"Standard deviation: {actual_stddev:.6f}\n"
            stats += f"Load spread (max - min): {load_spread}\n"
            stats += f"Fairness ratio (min/max): {fairness_ratio:.3f}\n"
            f.write(stats)
            print(stats, end='')

            # Print rider assignments
            rider_assignments = []
            for j in range(len(riders)):
                assigned_driver = None
                for i in range(len(drivers)):
                    if model.getVal(I[i, j]) > 0.5:
                        assigned_driver = drivers[i]['id']
                        break
                rider_assignments.append((riders[j]['id'], assigned_driver))
            print("\nRider assignments:")
            for rider_id, driver_id in rider_assignments:
                print(f"  Rider {rider_id} assigned to Driver {driver_id if driver_id is not None else 'None'}")

            # Print driver filled seats
            print("\nDriver filled seats:")
            for i, driver in enumerate(drivers):
                print(f"  Driver {driver['id']} filled seats: {driver_loads[i]}")

        else:
            f.write("No feasible solution found.\n")
            print("No feasible solution found.\n", end='')

# Run the main function if the script is executed directly
if __name__ == "__main__":
    # Start the timer
    start_time = time.time()
    
    # Create OutputSCIP directory if it doesn't exist
    script_dir = os.path.dirname(os.path.abspath(__file__))
    output_dir = os.path.join(script_dir, 'OutputSCIPDeRide')
    os.makedirs(output_dir, exist_ok=True)
    
    # Create output file
    output_file_path = os.path.join(output_dir, 'Output.txt')
    
    with open(output_file_path, 'w') as output_file:
        title = "🚗 RIDESHARE OPTIMIZATION RESULTS 🚗\n"
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
        
        # Define the optimization model
        step_text = "\n🛠️  Defining optimization model...\n"
        output_file.write(step_text)
        print(step_text, end='')
        model, I = define_model(G, drivers, riders)
        
        # Solve the model and save results
        solving_text = "\n🚦 Solving model and saving results...\n"
        output_file.write(solving_text)
        print(solving_text, end='')
        solve_model(model, I, drivers, riders, output_file_path)
        
        # End the timer and print execution time
        end_time = time.time()
        timing_text = f"\n⏱️  Total execution time: {end_time - start_time:.4f} seconds\n"
        completion_text = "\n✅ Optimization Complete!\n"
        
        final_text = timing_text + completion_text
        output_file.write(final_text)
        print(final_text, end='')
    
    print(f"\n📁 Output saved to: {output_file_path}")
