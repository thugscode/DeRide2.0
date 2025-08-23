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
        """Algorithm 1: Eligibility Matrix Calculation"""
        output_file.write("########## Algorithm 1: Eligibility Matrix Calculation ###########\n")
        
        num_drivers = len(drivers)
        num_riders = len(riders)

        # Step 1: Initialize eligibility matrix ER of size |D| × |R| with all entries set to 0
        self.ER = np.zeros((num_drivers, num_riders), dtype=int)
        self.offers = np.zeros(num_riders, dtype=int)
        output_file.write(f"Step 1: Initialized ER matrix of size {self.ER.shape} with all entries set to 0\n")
        output_file.write(f"ER Matrix:\n {self.ER}\n")
        output_file.write(f"Offer array: \n{self.offers}\n")

        # Step 2 & 3: For each driver, compute SP and MP, then check eligibility for each rider
        for i, driver in enumerate(drivers):
            output_file.write(f"##### Processing Driver {driver.id} (d{i+1}): ##### \n")
            
            # Step 2a: Compute shortest path distance SP_i from source to destination
            shortest_path, sp_length = self.shortest_path_distance(driver.source, driver.destination, output_file)
            output_file.write(f"Step 2a: Computed SP_{i+1} = {sp_length}\n")
            
            # Step 2b: Compute maximum permissible path distance MP_i = SP_i + (t_i/100 × SP_i)
            t_i = driver.threshold
            MP_i = sp_length + (t_i / 100) * sp_length
            output_file.write(f"Step 2b: Computed MP_{i+1} = {sp_length} + ({t_i}/100 × {sp_length}) = {MP_i}\n")

            # Step 3: For each rider, compute deviated path and check eligibility
            for j, rider in enumerate(riders):
                output_file.write(f"Step 3: Checking rider {rider.id} (r{j+1}) eligibility for driver {driver.id}\n")
                
                # Step 3a: Compute deviated path distance DP = spd(d_i.s, r_j.s) + spd(r_j.s, r_j.f) + spd(r_j.f, d_i.f)
                DP = self.calculate_deviated_path(driver, rider, output_file)
                output_file.write(f"Computed DP for d{i+1} and r{j+1}: {DP}\n")
                
                # Step 3b: If DP ≤ MP_i, then set ER[i][j] = 1
                if DP <= MP_i:
                    self.ER[i][j] = 1
                    output_file.write(f"DP ({DP}) ≤ MP_{i+1} ({MP_i}): Setting ER[{i+1}][{j+1}] = 1\n")
                    output_file.write(f"Rider {rider.id} is eligible for Driver {driver.id}\n")
                else:
                    output_file.write(f"DP ({DP}) > MP_{i+1} ({MP_i}): ER[{i+1}][{j+1}] remains 0\n")
                    output_file.write(f"Rider {rider.id} is not eligible for Driver {driver.id}\n")
            
            output_file.write(f"Eligibility matrix after processing driver {driver.id}:\n {self.ER}\n")
        
        output_file.write(f"Final eligibility matrix after processing all drivers:\n{self.ER}\n")
        
        # Step 4: Compute the Offer array
        output_file.write("Step 4: Computing Offer array\n")
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
        """Step 4: Compute the Offer array - sum column j in ER matrix for each rider"""
        self.offers = np.sum(self.ER, axis=0)
        output_file.write(f"Offer array updated: Offer[r_j] = sum_d ER[d][r_j] for all j\n")
        output_file.write(f"Updated offers: {self.offers}\n")

    def assign_riders_to_drivers(self, drivers, riders, output_file):
        """Algorithm 2: Maximize the Number of Assigned Riders While Minimizing Driver Load"""
        output_file.write("########## Algorithm 2: Maximize Assigned Riders While Minimizing Driver Load ###########\n")
        
        DP_assigned = {driver.id: {'driver_path': [], 'riders': [], 'nodes': {}} for driver in drivers}
        output_file.write(f"Initial DP_assigned: {DP_assigned}\n")

        # Step 1: While sum of Offer array > 0, repeat
        step_counter = 1
        while np.sum(self.offers) > 0:
            output_file.write(f"###################################################################\n")
            output_file.write(f"Algorithm 2 - Iteration {step_counter}\n")
            output_file.write(f"Step 1: sum(Offer) = {np.sum(self.offers)} > 0, continuing...\n")
            
            non_zero_offers = self.offers[self.offers > 0]
            output_file.write(f"Non-zero offers: {non_zero_offers}\n")
            if non_zero_offers.size == 0:
                break

            # Step 2: Identify riders with fewest number of eligible drivers
            min_offer = np.min(non_zero_offers)
            min_offer_set = np.where(self.offers == min_offer)[0]
            output_file.write(f"Step 2: min_offer = {min_offer}\n")
            output_file.write(f"min_offer_set = {min_offer_set+1} (riders with minimum offers)\n")

            # Step 3: Select a rider
            if len(min_offer_set) == 1:
                r_selected = min_offer_set[0]
                output_file.write(f"Step 3: Only one rider in min_offer_set, selected r{r_selected+1}\n")
            else:
                r_selected = random.choice(min_offer_set)
                output_file.write(f"Step 3: Randomly selected rider r{r_selected+1} from min_offer_set\n")
            
            # Step 4: Select the driver for r_selected
            eligible_drivers = np.where(self.ER[:, r_selected] == 1)[0]
            output_file.write(f"Step 4: eligible_drivers for rider r{r_selected+1}: {eligible_drivers+1}\n")
            
            if len(eligible_drivers) == 0:
                output_file.write(f"No eligible drivers for rider r{r_selected+1}. Setting ER[*][{r_selected+1}] = 0\n")
                self.ER[:, r_selected] = 0
                self.offers[r_selected] = 0
                step_counter += 1
                continue

            # Step 4a-c: Driver selection with load balancing and route constraints
            d_assigned = self.select_driver_algorithm2(eligible_drivers, drivers, riders[r_selected], DP_assigned, output_file)
            
            # Check if no feasible driver was found
            if d_assigned == -1:
                output_file.write(f"Step 4: No feasible driver found for rider r{r_selected+1}\n")
                output_file.write(f"Setting ER[*][{r_selected+1}] = 0 and Offer[{r_selected+1}] = 0\n")
                self.ER[:, r_selected] = 0
                self.offers[r_selected] = 0
                step_counter += 1
                continue

            output_file.write(f"Step 4: Assigned driver d{d_assigned+1} to rider r{r_selected+1}\n")

            driver = drivers[d_assigned]
            rider = riders[r_selected]
            
            # Check if driver has available seats
            if driver.seats == 0:
                output_file.write(f"Driver {driver.id} has no available seats. Setting ER[{d_assigned+1}][{r_selected+1}] = 0\n")
                self.ER[d_assigned][r_selected] = 0
                self.update_offers(output_file)
                step_counter += 1
                continue

            # Step 5: Assign r_selected to d_assigned
            output_file.write(f"Step 5: Assigning r{r_selected+1} to d{d_assigned+1}\n")
            
            # Initialize driver path if not already set
            if not DP_assigned[driver.id]['driver_path']:
                if driver.threshold == 0:
                    path, _ = self.shortest_path_distance(driver.source, driver.destination, output_file)
                else:
                    path = self.calculate_deviated_path_for_assignment(driver, rider, output_file)
                
                DP_assigned[driver.id]['driver_path'] = path
                output_file.write(f"Initialized driver path for d{d_assigned+1}: {path}\n")
            
            # Append r_selected to DP_d_assigned
            DP_assigned[driver.id]['riders'].append({
                'rider_id': rider.id,
                'source': rider.source,
                'destination': rider.destination
            })
            output_file.write(f"Appended r{r_selected+1} to DP_d{d_assigned+1}\n")
            
            # Decrease Seats[d_assigned] by 1
            drivers[d_assigned].seats -= 1
            output_file.write(f"Decreased seats for d{d_assigned+1}: now {drivers[d_assigned].seats} seats\n")
            
            # Set ER[*][r_selected] = 0
            self.ER[:, r_selected] = 0
            output_file.write(f"Set ER[*][{r_selected+1}] = 0\n")

            # Step 6: If Seats[d_assigned] = 0, set ER[d_assigned][*] = 0
            if drivers[d_assigned].seats == 0:
                self.ER[d_assigned] = np.zeros(len(riders))
                output_file.write(f"Step 6: Driver d{d_assigned+1} has 0 seats. Set ER[{d_assigned+1}][*] = 0\n")

            # Step 7: Update the Offer array
            output_file.write(f"Step 7: Updating Offer array\n")
            self.update_offers(output_file)
            
            step_counter += 1

        output_file.write(f"Algorithm 2 completed. Final DP_assigned: {DP_assigned}\n")
        return DP_assigned


    def select_driver_algorithm2(self, eligible_drivers, drivers, rider, DP_assigned, output_file):
        """Algorithm 2, Step 4: Select driver with load balancing and route constraints"""
        output_file.write(f"Step 4a: eligible_drivers = {eligible_drivers+1}\n")
        
        if len(eligible_drivers) == 1:
            # Only one eligible driver, check route constraint
            d = eligible_drivers[0]
            driver = drivers[d]
            
            # Calculate MP_d (maximum permissible path distance for driver d)
            _, sp_length = self.shortest_path_distance(driver.source, driver.destination, output_file)
            MP_d = sp_length + (driver.threshold / 100) * sp_length
            
            # Simulate adding r_selected to driver's current route
            updated_route_length = self.calculate_updated_route_length(driver, rider, DP_assigned, output_file)
            output_file.write(f"Single driver d{d+1}: route_length={updated_route_length}, MP_d={MP_d}\n")
            
            if updated_route_length <= MP_d:
                output_file.write(f"Route constraint satisfied for single driver d{d+1}\n")
                return d
            else:
                output_file.write(f"Route constraint NOT satisfied for single driver d{d+1}\n")
                return -1  # No feasible driver found
        
        # Step 4b: Group eligible_drivers by their current load in ascending order
        driver_loads = {}
        for driver_idx in eligible_drivers:
            driver_id = drivers[driver_idx].id
            current_load = len(DP_assigned[driver_id]['riders'])
            driver_loads[driver_idx] = current_load
            output_file.write(f"Driver d{driver_idx+1} has current load: {current_load}\n")
        
        load_groups = {}
        for driver_idx, load in driver_loads.items():
            if load not in load_groups:
                load_groups[load] = []
            load_groups[load].append(driver_idx)
        
        sorted_loads = sorted(load_groups.keys())
        output_file.write(f"Step 4b: Load groups: {load_groups}, sorted loads: {sorted_loads}\n")
        
        # Step 4c: For each load group (starting from smallest load)
        for load in sorted_loads:
            L_g = load_groups[load].copy()  # Make a copy to avoid modifying original
            output_file.write(f"Step 4c: Processing load group {load} with drivers: {[d+1 for d in L_g]}\n")
            
            # Step 4c.i: While L_g is not empty
            while L_g:
                # Select driver from group
                if len(L_g) > 1:
                    d = random.choice(L_g)
                    output_file.write(f"Step 4c.i: Randomly selected driver d{d+1} from group: {[dr+1 for dr in L_g]}\n")
                else:
                    d = L_g[0]
                    output_file.write(f"Step 4c.i: Selected only driver d{d+1} from group\n")
                
                # Simulate adding r_selected to driver's current route
                driver = drivers[d]
                
                # Calculate MP_d (maximum permissible path distance for driver d)
                _, sp_length = self.shortest_path_distance(driver.source, driver.destination, output_file)
                MP_d = sp_length + (driver.threshold / 100) * sp_length
                
                # Use networkx to compute the updated route length
                updated_route_length = self.calculate_updated_route_length(driver, rider, DP_assigned, output_file)
                output_file.write(f"Driver d{d+1}: route_length={updated_route_length}, MP_d={MP_d}\n")
                
                # Check route constraint
                if updated_route_length <= MP_d:
                    output_file.write(f"Step 4c.i: Route constraint satisfied for driver d{d+1}. Assigning.\n")
                    return d  # d_assigned = d and break out of all loops
                else:
                    output_file.write(f"Step 4c.i: Route constraint NOT satisfied for driver d{d+1}. Removing from group.\n")
                    L_g.remove(d)  # Remove d from L_g and continue while-loop
        
        # If no feasible driver is found
        output_file.write("Step 4: No feasible driver found after checking all load groups\n")
        return -1
    
    def calculate_updated_route_length(self, driver, new_rider, DP_assigned, output_file):
        """Calculate the total route length if the new rider is added to the driver's route."""
        driver_id = driver.id
        current_riders = DP_assigned[driver_id]['riders']
        
        # If no current riders, calculate the deviated path with just the new rider
        if not current_riders:
            if driver.threshold == 0:
                # For threshold 0, use shortest path
                _, route_length = self.shortest_path_distance(driver.source, driver.destination, output_file)
            else:
                # Calculate deviated path with new rider
                route_length = self.calculate_deviated_path(driver, new_rider, output_file)
            output_file.write(f"Driver d{driver.id} has no current riders. Route length with new rider: {route_length}\n")
            return route_length
        
        # If there are current riders, we need to find the optimal insertion point
        # For simplicity, we'll calculate the route that visits all pickup/dropoff points
        all_riders = current_riders + [{
            'rider_id': new_rider.id,
            'source': new_rider.source,
            'destination': new_rider.destination
        }]
        
        # Create a simple route: driver_source -> all rider sources -> all rider destinations -> driver_destination
        # This is a simplified approach; a more sophisticated algorithm would optimize the order
        waypoints = [driver.source]
        
        # Add all rider sources
        for rider_info in all_riders:
            waypoints.append(rider_info['source'])
        
        # Add all rider destinations
        for rider_info in all_riders:
            waypoints.append(rider_info['destination'])
        
        # Add driver destination
        waypoints.append(driver.destination)
        
        # Calculate total route length
        total_length = 0
        for i in range(len(waypoints) - 1):
            try:
                segment_length = nx.shortest_path_length(
                    self.graph_manager.graph, 
                    source=waypoints[i], 
                    target=waypoints[i+1], 
                    weight='weight'
                )
                total_length += segment_length
            except nx.NetworkXNoPath:
                output_file.write(f"No path found between {waypoints[i]} and {waypoints[i+1]}\n")
                return float('inf')
        
        output_file.write(f"Driver d{driver.id} total route length with all riders: {total_length}\n")
        return total_length

    def calculate_deviated_path_for_assignment(self, driver, rider, output_file):
        path_to_rider_source, _ = self.shortest_path_distance(driver.source, rider.source, output_file)
        rider_path, _ = self.shortest_path_distance(rider.source, rider.destination, output_file)
        path_from_rider_destination, _ = self.shortest_path_distance(rider.destination, driver.destination, output_file)
        full_path = path_to_rider_source + rider_path[1:] + path_from_rider_destination[1:]
        output_file.write(f"Calculated deviated path for driver {driver.id} and rider {rider.id}: {full_path}\n")
        return full_path
    
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
                                  f"Source: {rider['source']}, "
                                  f"Destination: {rider['destination']}\n")

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
        output_file.write(f"Variance of Filled Seats: {variance:.4f}\n")
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
    output_dir = os.path.join(script_dir, 'OutputDeRideFair')
    
    os.makedirs(output_dir, exist_ok=True)  # Create the output directory if it doesn't exist

    with open(os.path.join(output_dir, 'Output.txt'), 'w') as output_file:
    
        ride_share_system = RideShareSystem(graph_file, driver_file, rider_file, output_file)
        ride_share_system.run(output_file)
        
    # End the timer
    end_time = time.time()
    
    # Calculate and print execution time
    execution_time = end_time - start_time
    print(f"Execution Time: {execution_time:.3f} seconds")
