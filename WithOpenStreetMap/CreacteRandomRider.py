import csv
import random

graph_file = "map/graph.csv"
riders_file = "Input/riders.csv"

# Read graph edges
edges = []
with open(graph_file, "r") as f:
    reader = csv.DictReader(f)
    for row in reader:
        edges.append((row["source"], row["destination"]))

# Generate 500 riders
riders = []
for i in range(1, 501):
    source, destination = random.choice(edges)
    riders.append([f"r{i}", source, destination])

# Write to riders.csv
with open(riders_file, "w", newline="") as f:
    writer = csv.writer(f)
    writer.writerow(["id", "source", "destination"])
    writer.writerows(riders)
    

print("✅ riders.csv generated successfully!")