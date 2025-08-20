import numpy as np
import matplotlib.pyplot as plt
import os

# Raw dataset
data = {
    "DeRide": {
        "Variance": 4.33,
        "Total_Riders_Accommodated": 335,
        "Standard_Deviation": 2.08,
        "Utilization_Rate_Percent": 67.0,
        "Drivers_with_Zero_Load": 22,
        "Gini_Coefficient": 0.319
    },
    "DeRideFair": {
        "Variance": 3.21,
        "Total_Riders_Accommodated": 254,
        "Standard_Deviation": 1.87,
        "Utilization_Rate_Percent": 50.8,
        "Drivers_with_Zero_Load": 23,
        "Gini_Coefficient": 0.448
    },
    "SCIP": {
        "Variance": 4.73,
        "Total_Riders_Accommodated": 345,
        "Standard_Deviation": 2.17,
        "Utilization_Rate_Percent": 69.0,
        "Drivers_with_Zero_Load": 26,
        "Gini_Coefficient": 0.307
    }
}

# Min/Max ranges for normalization
ranges = {
    "Variance": (0, 6.25),
    "Total_Riders_Accommodated": (0, 500),
    "Standard_Deviation": (0, 2.5),
    "Utilization_Rate_Percent": (0, 100),
    "Drivers_with_Zero_Load": (0, 100),
    "Gini_Coefficient": (0, 1)
}

# Friendly labels
labels_map = {
    "Variance": "Ride Variance (lower better)",
    "Total_Riders_Accommodated": "Riders Accommodated",
    "Standard_Deviation": "Std. Deviation (lower better)",
    "Utilization_Rate_Percent": "Utilization (%)",
    "Drivers_with_Zero_Load": "Drivers w/ Zero Load",
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
fig, ax = plt.subplots(figsize=(8,8), subplot_kw=dict(polar=True))

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
