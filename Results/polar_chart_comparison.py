import numpy as np
import matplotlib.pyplot as plt
import os

# Raw dataset (updated, removed Standard_Deviation and Drivers_with_Zero_Load)
data = {
    "DeRide": {
        "Variance": 4.5291,
        "Total_Riders_Accommodated": 297,
        "Utilization_Rate_Percent": 67.0,
        "Gini_Coefficient": 0.319
    },
    "DeRideFair": {
        "Variance": 3.7131,
        "Total_Riders_Accommodated": 263,
        "Utilization_Rate_Percent": 52.6,
        "Gini_Coefficient": 0.448
    },
    "SCIPDeRide": {
        "Variance": 5.0275,
        "Total_Riders_Accommodated": 345,
        "Utilization_Rate_Percent": 69.0,
        "Gini_Coefficient": 0.307
    },
    # "SCIPDeRideFairMM2Phase": {
    #     "Variance": 5.0275,
    #     "Total_Riders_Accommodated": 345,
    #     "Utilization_Rate_Percent": 69.0,
    #     "Gini_Coefficient": 0.307
    # },
    "SCIPDeRideFairMMLexico": {
        "Variance": 4.5475,
        "Total_Riders_Accommodated": 345,
        "Utilization_Rate_Percent": 69.0,
        "Gini_Coefficient": 0.307
    },
    # "SCIPDeRideFairMMScalar": {
    #     "Variance": 4.7275,
    #     "Total_Riders_Accommodated": 345,
    #     "Utilization_Rate_Percent": 69.0,
    #     "Gini_Coefficient": 0.307
    # }
}

# Min/Max ranges for normalization (removed Standard_Deviation and Drivers_with_Zero_Load)
ranges = {
    "Variance": (0, 6.0),
    "Total_Riders_Accommodated": (0, 500),
    "Utilization_Rate_Percent": (0, 100),
    "Gini_Coefficient": (0, 1)
}

# Friendly labels (removed Standard_Deviation and Drivers_with_Zero_Load)
labels_map = {
    "Variance": "Load Variance (lower better)",
    "Total_Riders_Accommodated": "Riders Served",
    "Utilization_Rate_Percent": "Seat Utilization (%)",
    "Gini_Coefficient": "Gini Fairness"
}

# Normalize (no reversal)
normalized_data = {}
for algo, metrics in data.items():
    normalized_data[algo] = []
    for metric, value in metrics.items():
        min_val, max_val = ranges[metric]
        norm_val = (value - min_val) / (max_val - min_val)
        normalized_data[algo].append(norm_val)

# Radar chart setup
categories = [labels_map[m] for m in data["DeRide"].keys()]
N = len(categories)
angles = np.linspace(0, 2*np.pi, N, endpoint=False).tolist()
angles += angles[:1]  # close loop

# Plot
fig, ax = plt.subplots(figsize=(10,10), subplot_kw=dict(polar=True))

ax.set_theta_offset(np.pi / 2)
ax.set_theta_direction(-1)
ax.set_thetagrids(np.degrees(angles[:-1]), categories)

for algo, values in normalized_data.items():
    vals = values + values[:1]  # close polygon
    ax.plot(angles, vals, linewidth=2, label=algo)
    ax.fill(angles, vals, alpha=0.15)

ax.legend(loc="upper right", bbox_to_anchor=(1.3, 1.1))
plt.tight_layout()

# Save in the same directory as the script
script_dir = os.path.dirname(os.path.abspath(__file__))
output_path = os.path.join(script_dir, "polar_chart_comparison.png")
fig.savefig(output_path)
