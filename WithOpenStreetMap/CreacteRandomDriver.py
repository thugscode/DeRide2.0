import csv
import random

# Input and output file paths
graph_file = "map/graph.csv"
drivers_file = "Input/drivers.csv"

# Read graph edges
edges = []
with open(graph_file, "r") as f:
    reader = csv.DictReader(f)
    for row in reader:
        edges.append((row["source"], row["destination"]))

# Sample 100 edges (with replacement if fewer than 100 edges in graph.csv)
drivers = []
for i in range(1, 101):
    source, destination = random.choice(edges)
    seats = random.randint(1, 5)
    threshold = random.randint(10, 50)
    drivers.append([f"d{i}", source, destination, seats, threshold])

# Write to drivers.csv
with open(drivers_file, "w", newline="") as f:
    writer = csv.writer(f)
    writer.writerow(["id", "source", "destination", "seats", "threshold"])
    writer.writerows(drivers)

print("✅ drivers.csv generated successfully!")
