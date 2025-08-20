import pandas as pd
import numpy as np
import matplotlib.pyplot as plt

# First, let's parse and analyze the DeRideFair data
deride_fair_data = []
for i in range(1, 101):
    # Extract data from the user provided text
    # For DeRideFair system
    pass

# I'll create the data based on what was provided in the query
# DeRideFair data
deride_fair_drivers = []
deride_fair_seats = []

# From the query, extracting DeRideFair driver data
driver_data_fair = [
    (1, 0), (2, 1), (3, 5), (4, 0), (5, 5), (6, 2), (7, 2), (8, 5), (9, 5), (10, 5),
    (11, 0), (12, 1), (13, 0), (14, 4), (15, 3), (16, 4), (17, 5), (18, 4), (19, 1), (20, 5),
    (21, 1), (22, 4), (23, 1), (24, 0), (25, 4), (26, 0), (27, 2), (28, 5), (29, 5), (30, 2),
    (31, 0), (32, 4), (33, 3), (34, 5), (35, 3), (36, 0), (37, 3), (38, 4), (39, 3), (40, 1),
    (41, 1), (42, 5), (43, 5), (44, 0), (45, 5), (46, 5), (47, 0), (48, 4), (49, 2), (50, 0),
    (51, 1), (52, 5), (53, 0), (54, 0), (55, 5), (56, 5), (57, 3), (58, 3), (59, 3), (60, 5),
    (61, 4), (62, 0), (63, 2), (64, 0), (65, 2), (66, 2), (67, 0), (68, 1), (69, 0), (70, 2),
    (71, 0), (72, 3), (73, 1), (74, 3), (75, 5), (76, 2), (77, 4), (78, 5), (79, 0), (80, 3),
    (81, 0), (82, 5), (83, 0), (84, 2), (85, 3), (86, 5), (87, 3), (88, 4), (89, 5), (90, 2),
    (91, 4), (92, 1), (93, 2), (94, 0), (95, 4), (96, 5), (97, 1), (98, 3), (99, 0), (100, 3)
]

# DeRide data
driver_data_deride = [
    (1, 0), (2, 2), (3, 5), (4, 0), (5, 5), (6, 2), (7, 2), (8, 5), (9, 5), (10, 5),
    (11, 0), (12, 1), (13, 0), (14, 3), (15, 5), (16, 5), (17, 5), (18, 3), (19, 1), (20, 5),
    (21, 2), (22, 5), (23, 3), (24, 0), (25, 4), (26, 0), (27, 5), (28, 5), (29, 5), (30, 1),
    (31, 0), (32, 4), (33, 1), (34, 3), (35, 2), (36, 0), (37, 5), (38, 5), (39, 3), (40, 5),
    (41, 0), (42, 5), (43, 5), (44, 0), (45, 5), (46, 5), (47, 0), (48, 5), (49, 2), (50, 0),
    (51, 5), (52, 3), (53, 0), (54, 1), (55, 4), (56, 5), (57, 1), (58, 4), (59, 5), (60, 5),
    (61, 3), (62, 0), (63, 3), (64, 0), (65, 5), (66, 5), (67, 0), (68, 5), (69, 0), (70, 5),
    (71, 0), (72, 2), (73, 4), (74, 5), (75, 4), (76, 3), (77, 3), (78, 5), (79, 0), (80, 5),
    (81, 0), (82, 5), (83, 0), (84, 5), (85, 5), (86, 5), (87, 5), (88, 5), (89, 1), (90, 1),
    (91, 5), (92, 1), (93, 5), (94, 1), (95, 5), (96, 5), (97, 5), (98, 5), (99, 0), (100, 5)
]

# Create DataFrames
df_fair = pd.DataFrame(driver_data_fair, columns=['Driver_ID', 'Filled_Seats'])
df_deride = pd.DataFrame(driver_data_deride, columns=['Driver_ID', 'Filled_Seats'])

# Add system identifier
df_fair['System'] = 'DeRideFair'
df_deride['System'] = 'DeRide'

# Calculate basic statistics
print("=== DERIDE FAIR ANALYSIS ===")
print(f"Total Accommodated Riders: {df_fair['Filled_Seats'].sum()}")
print(f"Average Filled Seats per Driver: {df_fair['Filled_Seats'].mean():.2f}")
print(f"Standard Deviation: {df_fair['Filled_Seats'].std():.2f}")
print(f"Range: {df_fair['Filled_Seats'].min()} to {df_fair['Filled_Seats'].max()}")

print("\n=== DERIDE ANALYSIS ===")
print(f"Total Accommodated Riders: {df_deride['Filled_Seats'].sum()}")
print(f"Average Filled Seats per Driver: {df_deride['Filled_Seats'].mean():.2f}")
print(f"Standard Deviation: {df_deride['Filled_Seats'].std():.2f}")
print(f"Range: {df_deride['Filled_Seats'].min()} to {df_deride['Filled_Seats'].max()}")

# Verify the data matches the provided statistics
print("\n=== VERIFICATION ===")
print("DeRideFair - Expected vs Calculated:")
print(f"Total riders: 255 vs {df_fair['Filled_Seats'].sum()}")
print(f"Average: 2.55 vs {df_fair['Filled_Seats'].mean():.2f}")
print(f"Std Dev: 1.89 vs {df_fair['Filled_Seats'].std():.2f}")

print("\nDeRide - Expected vs Calculated:")
print(f"Total riders: 303 vs {df_deride['Filled_Seats'].sum()}")
print(f"Average: 3.03 vs {df_deride['Filled_Seats'].mean():.2f}")
print(f"Std Dev: 2.08 vs {df_deride['Filled_Seats'].std():.2f}")