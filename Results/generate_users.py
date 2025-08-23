import csv
import random

input_csv = "Bengaluru_Locations.csv"
output_csv = "Users/user_data10.csv"

with open(input_csv, newline='') as f:
    reader = csv.DictReader(f)
    locations = [(float(row["Latitude"]), float(row["Longitude"])) for row in reader]

num_drivers = 100
num_riders = num_drivers * 5

user_rows = []
# Generate drivers
for i in range(1, num_drivers + 1):
    role = "driver"
    seats = random.randint(3, 5)
    src = random.choice(locations)
    dst = random.choice(locations)
    while dst == src:
        dst = random.choice(locations)
    threshold = random.randint(10, 50)
    user_rows.append([
        f"usr{i}", role, seats,
        round(src[0], 7), round(src[1], 7),
        round(dst[0], 7), round(dst[1], 7),
        threshold
    ])

# Generate riders
for i in range(num_drivers + 1, num_drivers + num_riders + 1):
    role = "rider"
    seats = 0
    src = random.choice(locations)
    dst = random.choice(locations)
    while dst == src:
        dst = random.choice(locations)
    threshold = 0
    user_rows.append([
        f"usr{i}", role, seats,
        round(src[0], 7), round(src[1], 7),
        round(dst[0], 7), round(dst[1], 7),
        threshold
    ])

with open(output_csv, "w", newline='') as f:
    writer = csv.writer(f)
    writer.writerow(["ID", "Role", "Seats", "Source_Lat", "Source_Lng", "Destination_Lat", "Destination_Lng", "Threshold"])
    writer.writerows(user_rows)
