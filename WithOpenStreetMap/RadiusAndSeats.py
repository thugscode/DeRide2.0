import numpy as np
import seaborn as sns
import matplotlib.pyplot as plt

# Data
data = {
    (0, 0): 0.0,
    (100, 0): 0.0,
    (500, 0): 0.0,
    (5000, 0): 0.0,
    (0,2):18.8,
    (100,2): 21.8,
    (500,2):35.6,
    (5000,2): 38.4,
    (0, 5): 42,
    (100, 5): 48,
    (500, 5): 86.9,
    (5000, 5): 96.62,
    (0, 10): 44.4,
    (100, 10): 50.7,
    (500, 10): 93.4,
    (5000, 10): 97.6,
    (0, 20): 47.6,
    (100, 20): 53.8,
    (500, 20): 96.2,
    (5000, 20): 98.8,
    (0, 50): 51,
    (100, 50): 58.9,
    (500, 50): 98.88,
    (5000, 50): 100
}

# Convert data to a matrix
radius_values = sorted(set(k[0] for k in data.keys()))
seats_values = sorted(set(k[1] for k in data.keys()))
heatmap_data = np.zeros((len(seats_values), len(radius_values)))

for (radius, seats), value in data.items():
    i = seats_values.index(seats)
    j = radius_values.index(radius)
    heatmap_data[i, j] = value

# Plot heatmap
plt.figure(figsize=(10, 8))
sns.heatmap(heatmap_data, xticklabels=radius_values, yticklabels=seats_values, annot=True, fmt='.2f', cmap="Greens", linewidths=1, linecolor='black', annot_kws={"size": 16})
plt.gca().invert_yaxis()  # Invert the y-axis
plt.xlabel('Radius', fontsize=16)
plt.ylabel('Seats', fontsize=16)
plt.xticks(fontsize=16)
plt.yticks(fontsize=16)
plt.tight_layout()
plt.show()