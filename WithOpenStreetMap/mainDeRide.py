import csv
import networkx as nx
import numpy as np
import random
import os
import time

class GraphManager:
    def __init__(self, file_path):
        self.graph = nx.DiGraph()
        self.load_graph(file_path)

    def load_graph(self, file_path):
        edges = self.read_graph_from_csv(file_path)
        for edge in edges:
            self.graph.add_edge(edge[0], edge[1], weight=edge[2])

    @staticmethod
    def read_graph_from_csv(file_path):
        edges = []
        with open(file_path, 'r') as file:
            reader = csv.reader(file)
            next(reader)  # Skip the header row if it exists
            for row in reader:
                node1, node2, weight = int(row[0]), int(row[1]), int(float(row[2]))  # Convert weight to integer
                edges.append((node1, node2, weight))
        return edges


class Driver:
    def __init__(self, driver_id, source, destination, seats, threshold):
        self.id = driver_id
        self.source = source
        self.destination = destination
        self.seats = seats
        self.threshold = threshold


class Rider:
    def __init__(self, rider_id, source, destination):
        self.id = rider_id
        self.source = source
        self.destination = destination 


class EligibilityRiderMatrix:
    def __init__(self, graph_manager, output_file):
        self.graph_manager = graph_manager
        self.ER = None
        self.offers = None
        self.node_coordinates = self.get_node_coordinates()
        output_file.write("########## Eligibility Rider(ER) Matrix initialized. ###########\n")

    def get_node_coordinates(self):
        """Generate a dictionary mapping each node ID to its (x, y) coordinates."""
        node_coordinates = {}
        for node in self.graph_manager.graph.nodes:
            x = self.graph_manager.graph.nodes[node].get('x')
            y = self.graph_manager.graph.nodes[node].get('y')
            if x is not None and y is not None:
                node_coordinates[node] = (x, y)
        return node_coordinates
    
    def calculate(self, drivers, riders, output_file):
        DP_assigned = {driver.id: {'driver_path': [], 'nodes': {}} for driver in drivers}
        num_drivers = len(drivers)
        num_riders = len(riders)

        self.ER = np.zeros((num_drivers, num_riders), dtype=int)
        self.offers = np.zeros(num_riders, dtype=int)
        output_file.write(f"Initialized ER matrix of size {self.ER.shape} and ER :\n {self.ER}\n")
        output_file.write(f"Offer array: \n{self.offers}\n")

        for i, driver in enumerate(drivers):
            output_file.write(f"##### Driver {driver.id}: ##### \n")
            shortest_path, sp_length = self.shortest_path_distance(driver.source, driver.destination, output_file)
            t = driver.threshold
            radius = 200
            if t == 0:
            
                nodes_within_circle_of_shortest_path_nodes = self.find_nodes_within_threshold(shortest_path, radius)
                output_file.write(f"Shortest Path (SP) distance = {sp_length}\n")
                
                DP_assigned[driver.id]['driver_path'] = shortest_path
                DP_assigned[driver.id]['nodes'] = nodes_within_circle_of_shortest_path_nodes
                for j, rider in enumerate(riders):
                    output_file.write(f"####### Checking for rider {rider.id} is eligible for driver {driver.id}...... #######\n")
                    
                    if self.is_on_deviated_route(drivers[i].id, riders[j], DP_assigned, output_file):
                        self.ER[i][j] = 1
                        output_file.write(f"Rider {rider.id} is near the shortest path of driver {driver.id}\n")
                    else:
                        output_file.write(f"Rider {rider.id} is not near the shortest path of driver {driver.id}\n")
                
            else:
                MP = sp_length * (1 + (t / 100))
                output_file.write(f"Shortest Path (SP) distance = {sp_length}, Maximum Path (MP) distance= {MP}\n")

                for j, rider in enumerate(riders):
                    output_file.write(f"####### Checking for rider {rider.id} is eligible for driver {driver.id}...... #######\n")
                    DP = self.calculate_deviated_path(driver, rider, output_file)
                    output_file.write(f"Rider {rider.id}: Deviated Path (DP) length = {DP}, MP = {MP}\n")
                    if DP <= MP:
                        self.ER[i][j] = 1
                        output_file.write(f"Rider {rider.id} is eligible for Driver {driver.id}\n")
                    else:
                        output_file.write(f"Rider {rider.id} is not eligible for Driver {driver.id}\n")
            output_file.write(f"Eligibility matrix after checking the all riders for driver {driver.id}:\n {self.ER}\n")
        output_file.write(f"Eligibility matrix after calculation: \n{self.ER}\n")
        self.update_offers(output_file)

    def shortest_path_distance(self, source, target, output_file):
        try:
            path = nx.shortest_path(self.graph_manager.graph, source=source, target=target, weight='weight')
            path_length = nx.shortest_path_length(self.graph_manager.graph, source=source, target=target, weight='weight')
            output_file.write(f"Shortest path from Source {source} to Destination {target}: {path}, Shortest Length: {path_length}\n")
            return path, path_length
        except nx.NetworkXNoPath:
            output_file.write(f"No path found from {source} to {target}.\n")
            return None, float('inf')

    def calculate_deviated_path(self, driver, rider, output_file):
        DP1, dp1_length = self.shortest_path_distance(driver.source, rider.source, output_file)
        DP2, dp2_length = self.shortest_path_distance(rider.source, rider.destination, output_file)
        DP3, dp3_length = self.shortest_path_distance(rider.destination, driver.destination, output_file)

        DP = (dp1_length if dp1_length != float('inf') else float('inf')) + \
             (dp2_length if dp2_length != float('inf') else float('inf')) + \
             (dp3_length if dp3_length != float('inf') else float('inf'))
        output_file.write(f"Deviated path for driver {driver.id} and rider {rider.id}: SP1={dp1_length}, sP2={dp2_length}, sP3={dp3_length}, Total DP(SP1+SP2+SP3)={DP}\n")
        return DP

    def update_offers(self, output_file):
        self.offers = np.sum(self.ER, axis=0)
        output_file.write(f"Updated offers: {self.offers}\n")

    def assign_riders_to_drivers(self, drivers, riders, output_file):
        DP_assigned = {driver.id: {'driver_path': [], 'riders': [], 'nodes': {}} for driver in drivers}
        output_file.write(f"###################################################################\n")
        output_file.write(f"Initial DP_assigned: {DP_assigned}\n")

        while np.sum(self.offers) > 0:
            output_file.write(f"###################################################################\n")
            non_zero_offers = self.offers[self.offers > 0]
            output_file.write(f"Non-zero offers: {non_zero_offers}\n")
            if non_zero_offers.size == 0:
                break

            Min_offer = np.min(non_zero_offers)
            Min_offer_set = np.where(self.offers == Min_offer)[0]
            output_file.write(f"Set of riders with minimum offer {Min_offer}: {Min_offer_set+1}\n")

            r_selected = Min_offer_set[0] if len(Min_offer_set) == 1 else random.choice(Min_offer_set)
            output_file.write(f"Selected rider r{r_selected+1} with minimum offer: {Min_offer}\n")
            
            eligible_drivers = np.where(self.ER[:, r_selected] == 1)[0]
            output_file.write(f"Eligible drivers for rider r{r_selected+1}: {eligible_drivers+1}\n")

            # Use eligible_drivers to get the driver index
            d_assigned = self.select_driver(eligible_drivers, drivers, output_file)
            output_file.write(f"Assigned driver d{d_assigned+1} to rider r{r_selected+1}\n")

            driver = drivers[d_assigned]  # Assign the driver using the index
            rider = riders[r_selected]
            
            if driver.seats == 0:
                output_file.write(f"Driver {driver.id} has no available seats. Skipping...\n")
                self.ER[d_assigned][r_selected] = 0
                self.update_offers(output_file)
                continue

            if not DP_assigned[driver.id]['driver_path']:
                
                radius = 200
                
                path, path_nodes = None, None
                
                if driver.threshold == 0:
                    path, _ = self.shortest_path_distance(driver.source, driver.destination, output_file)
                else:
                    path = self.calculate_deviated_path_for_assignment(driver, rider, output_file)
                
                path_nodes = self.find_nodes_within_threshold(path, radius)
                DP_assigned[driver.id]['driver_path'] = path
                DP_assigned[driver.id]['nodes'] = path_nodes
                
                if driver.threshold != 0 and radius != 0:
                    for j, rider in enumerate(riders):
                        if self.is_on_deviated_route(drivers[d_assigned].id, riders[j], DP_assigned, output_file):
                            self.ER[d_assigned][j] = 1
                
                output_file.write(f"Assigned deviated path for driver {driver.id}: {path}\n")
            DP_assigned[driver.id]['riders'].append({
                'rider_id': rider.id,
                'source': rider.source,
                'destination': rider.destination
            })
            output_file.write(f"Updated DP_assigned for driver {driver.id}: {DP_assigned[driver.id]}\n")

            self.update_eligibility(d_assigned, r_selected, drivers, riders, DP_assigned, output_file)

        output_file.write(f"Final DP_assigned: {DP_assigned}\n")
        return DP_assigned


    def select_driver(self, eligible_drivers, drivers, output_file):
        if len(eligible_drivers) == 1:
            output_file.write(f"Only one eligible driver: d{eligible_drivers[0]+1}\n")
            return eligible_drivers[0]
        else:
            max_seats = -1
            drivers_with_max_seats = []
            for driver_idx in eligible_drivers:
                if drivers[driver_idx].seats > max_seats:
                    max_seats = drivers[driver_idx].seats
                    drivers_with_max_seats = [driver_idx]
                elif drivers[driver_idx].seats == max_seats:
                    drivers_with_max_seats.append(driver_idx)
            selected_driver = random.choice(drivers_with_max_seats)
            output_file.write(f"Selected driver d{selected_driver+1} from drivers with max seats: {drivers_with_max_seats}\n")
            return selected_driver

    def calculate_deviated_path_for_assignment(self, driver, rider, output_file):
        path_to_rider_source, _ = self.shortest_path_distance(driver.source, rider.source, output_file)
        rider_path, _ = self.shortest_path_distance(rider.source, rider.destination, output_file)
        path_from_rider_destination, _ = self.shortest_path_distance(rider.destination, driver.destination, output_file)
        full_path = path_to_rider_source + rider_path[1:] + path_from_rider_destination[1:]
        output_file.write(f"Calculated deviated path for driver {driver.id} and rider {rider.id}: {full_path}\n")
        return full_path
    
    # Function to find nodes within threshold distance from a list of nodes in driver path
    def find_nodes_within_threshold(self, driver_path, threshold_distance):
        nodes_within_threshold = {}

        for node in driver_path:
            # Use Dijkstra's algorithm to find nodes within the threshold distance
            lengths = nx.single_source_dijkstra_path_length(self.graph_manager.graph, node, cutoff=threshold_distance)

            # Add nodes to the result dictionary without redundant checks
            for target_node, _ in lengths.items():
                # If target_node is not already present, or you want to handle multiple sources, adjust here
                if target_node not in nodes_within_threshold:
                    nodes_within_threshold[target_node] = node
                else:
                    l1 = lengths[target_node]
                    l2 = nx.shortest_path_length(self.graph_manager.graph, source=nodes_within_threshold[target_node], target=target_node, weight='weight')
                    if l1 < l2:
                        nodes_within_threshold[target_node] = node

        return nodes_within_threshold

    def update_eligibility(self, d_assigned, r_selected, drivers, riders, DP_assigned, output_file):
        output_file.write(f"Updating eligibility for driver d{d_assigned+1} and rider r{r_selected+1}\n")
        for rj in range(len(riders)):
            if self.ER[d_assigned][rj] == 1:
                if not self.is_on_deviated_route(drivers[d_assigned].id, riders[rj], DP_assigned, output_file):
                    self.ER[d_assigned][rj] = 0

        for d in range(len(drivers)):
            self.ER[d][r_selected] = 0
            
        output_file.write(f"Updated eligibility matrix(ER) for driver d{d_assigned+1}: \n{self.ER}\n")
        
        drivers[d_assigned].seats -= 1
        output_file.write(f"Updated seats for driver d{d_assigned+1}: {drivers[d_assigned].seats}\n")
        if drivers[d_assigned].seats == 0:
            self.ER[d_assigned] = np.zeros(len(riders))

        self.update_offers(output_file)

    def is_on_deviated_route(self, driver_id, rider, DP_assigned, output_file):
        driver_path = DP_assigned[driver_id]['driver_path']
        # driver_path = [9443684664, 9443679347, 3437318417, 2614492895, 2614495600, 2614495597, 5413697903, 2614495595, 2613601278, 11330569673, 1471100885, 2613601368]
        nodes_of_driver_path = DP_assigned[driver_id]['nodes']
        # nodes_of_driver_path = {9443684664: 9443684664, 9443679347: 9443679347, 9443684661: 9443684664, 9443684660: 9443684664, 9443684650: 9443679347, 9443679342: 9443679347, 9443684653: 9443684664}
        
        # Check if rider's source and destination nodes exist in the driver's path (nodes)
        if rider.source not in nodes_of_driver_path or rider.destination not in nodes_of_driver_path:
            output_file.write(f"Rider {rider.id} is NOT on the deviated route of driver {driver_id}\n")
            return False
        
        try:
            source_index = driver_path.index(nodes_of_driver_path[rider.source])
            destination_index = driver_path.index(nodes_of_driver_path[rider.destination])
        except ValueError:
            output_file.write(f"Rider {rider.id} is NOT on the deviated route of driver {driver_id} (source or destination not found in path)\n")
            return False
        
        # Check if rider's source and destination nodes are directly on the driver's path
        if source_index < destination_index:
            output_file.write(f"Rider {rider.id} is directly on the path of driver {driver_id}\n")
            return True
        
        output_file.write(f"Rider {rider.id} is NOT on the deviated route of driver {driver_id}\n")
        return False


class RideShareSystem:
    def __init__(self, graph_file, driver_file, rider_file, output_file):
        self.graph_manager = GraphManager(graph_file)
        self.drivers = self.load_drivers(driver_file, output_file)
        self.riders = self.load_riders(rider_file, output_file)
        self.eligibility_matrix = EligibilityRiderMatrix(self.graph_manager, output_file)
        self.total_initial_seats = sum(driver.seats for driver in self.drivers)

    @staticmethod
    def load_drivers(file_path, output_file):
        drivers = []
        with open(file_path, 'r') as file:
            reader = csv.DictReader(file)
            for row in reader:
                driver = Driver(
                    driver_id=row['id'],
                    source=int(row['source']),
                    destination=int(row['destination']),
                    seats=int(row['seats']),
                    threshold=int(row['threshold'])
                )
                drivers.append(driver)
        output_file.write(f"##########  Program Start  ###########\n")
        output_file.write(f"Loaded drivers info:\n {[driver.__dict__ for driver in drivers]}\n")
        return drivers

    @staticmethod
    def load_riders(file_path, output_file):
        riders = []
        with open(file_path, 'r') as file:
            reader = csv.DictReader(file)
            for row in reader:
                rider = Rider(
                    rider_id=row['id'],
                    source=int(row['source']),
                    destination=int(row['destination'])
                )
                riders.append(rider)
        output_file.write(f"Loaded riders info:\n {[rider.__dict__ for rider in riders]}\n")
        return riders

    def run(self, output_file):
        self.eligibility_matrix.calculate(self.drivers, self.riders, output_file)
        DPassigned = self.eligibility_matrix.assign_riders_to_drivers(self.drivers, self.riders, output_file)
        self.output_results(DPassigned, output_file)

    # Function to output results
    def output_results(self, DPassigned, output_file):
        total_remaining_seats = sum(driver.seats for driver in self.drivers)
        total_riders = len(self.riders)
        output_file.write(f"Total remaining seats: {total_remaining_seats}, Total riders: {total_riders}\n")
        
        output_file.write("===== Input Data =====\n")
        output_file.write("\nDrivers Information:\n")
        for driver in self.drivers:
            output_file.write(f"Driver ID: {driver.id}, Source: {driver.source}, "
                            f"Destination: {driver.destination}, Seats: {driver.seats}, "
                            f"Threshold: {driver.threshold}\n")

        output_file.write("\nRiders Information:\n")
        for rider in self.riders:
            output_file.write(f"Rider ID: {rider.id}, Source: {rider.source}, "
                            f"Destination: {rider.destination}\n")

        output_file.write("\n===== Assigned Riders, Paths, and Remaining Seats for Each Driver =====\n")
        for driver_id, assignment in DPassigned.items():
            output_file.write(f"Driver {driver_id}:\n")
            output_file.write(f"  Driver Path: {assignment['driver_path']}\n")
            for rider in assignment['riders']:
                output_file.write(f"    Rider ID: {rider['rider_id']}, "
                            f"Source: {DPassigned[driver_id]['nodes'].get(rider['source'], 'Source Not Found')}, "
                            f"Destination: {DPassigned[driver_id]['nodes'].get(rider['destination'], 'Destination Not Found')}\n")

        output_file.write(f"\nTotal Current Seats Available: {total_remaining_seats}/{self.total_initial_seats}, Total Number of Accommodated Riders: {self.total_initial_seats - total_remaining_seats} out of {total_riders}\n")

        # Calculate average filled seats and deviation analysis
        total_filled_seats = self.total_initial_seats - total_remaining_seats
        total_drivers = len(self.drivers)
        average_filled_seats = total_filled_seats / total_drivers if total_drivers > 0 else 0
        
        output_file.write(f"\n===== Load Distribution Analysis =====\n")
        output_file.write(f"Average Filled Seats per Driver: {average_filled_seats:.2f} seats/driver\n")
        output_file.write(f"Total Load Distribution: {total_filled_seats} riders assigned across {total_drivers} drivers\n")
        
        # Calculate filled seats for each driver and deviation from average
        driver_filled_seats = []
        deviations = []
        output_file.write(f"\nDriver Load Details:\n")
        
        for driver in self.drivers:
            # Calculate original seats for this driver
            original_seats = driver.seats + len(DPassigned[driver.id]['riders'])
            filled_seats = len(DPassigned[driver.id]['riders'])
            deviation = filled_seats - average_filled_seats
            
            driver_filled_seats.append(filled_seats)
            deviations.append(deviation)
            
            output_file.write(f"Driver {driver.id}: {filled_seats}/{original_seats} seats filled, "
                            f"deviation from average: {deviation:+.2f}\n")
        
        # Calculate standard deviation
        variance = sum(d*d for d in deviations) / total_drivers if total_drivers > 0 else 0
        std_deviation = variance ** 0.5
        
        output_file.write(f"\nLoad Distribution Statistics:\n")
        output_file.write(f"Standard Deviation of Filled Seats: {std_deviation:.2f}\n")
        output_file.write(f"Range of Filled Seats: {min(driver_filled_seats)} to {max(driver_filled_seats)} seats\n")
        output_file.write(f"Load Balance Quality: {'Excellent' if std_deviation < 1.0 else 'Good' if std_deviation < 2.0 else 'Fair'}\n")

        print("Results have been written to Output.txt.")


if __name__ == "__main__":
    
    # Start the timer
    start_time = time.time()

    # Get the directory of the current script
    script_dir = os.path.dirname(os.path.abspath(__file__))
    input_dir = os.path.join(script_dir, 'Input')

    # Set paths for input files
    driver_file = os.path.join(input_dir, 'drivers.csv')
    rider_file = os.path.join(input_dir, 'riders.csv')
    
    map_dir = os.path.join(script_dir, 'map')
    graph_file = os.path.join(map_dir, 'graph.csv')
    
    # Get the directory of the current script
    script_dir = os.path.dirname(os.path.abspath(__file__))
    output_dir = os.path.join(script_dir, 'OutputDeRide')
    
    os.makedirs(output_dir, exist_ok=True)  # Create the output directory if it doesn't exist

    with open(os.path.join(output_dir, 'Output.txt'), 'w') as output_file:
    
        ride_share_system = RideShareSystem(graph_file, driver_file, rider_file, output_file)
        ride_share_system.run(output_file)
        
    # End the timer
    end_time = time.time()
    
    # Calculate and print execution time
    execution_time = end_time - start_time
    print(f"Execution Time: {execution_time:.3f} seconds")
