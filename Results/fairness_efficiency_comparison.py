# Calculate comprehensive fairness and efficiency metrics
import pandas as pd
import numpy as np
import scipy.stats as stats

# Create sample data (replace with your actual data loading)
np.random.seed(42)

# Create sample data for DeRideFair (more balanced distribution)
df_fair = pd.DataFrame({
    'Driver_ID': range(1, 101),
    'Filled_Seats': np.random.choice([0, 1, 2, 3, 4, 5], 100, p=[0.1, 0.15, 0.25, 0.25, 0.15, 0.1])
})

# Create sample data for DeRide (more skewed distribution)
df_deride = pd.DataFrame({
    'Driver_ID': range(1, 101),
    'Filled_Seats': np.random.choice([0, 1, 2, 3, 4, 5], 100, p=[0.05, 0.1, 0.15, 0.2, 0.25, 0.25])
})

# If you have actual CSV files, uncomment these lines instead:
# df_fair = pd.read_csv('deride_fair_data.csv')
# df_deride = pd.read_csv('deride_data.csv')

# Combine both datasets for comparison
df_combined = pd.concat([df_fair, df_deride], ignore_index=True)

# Calculate additional fairness metrics
def calculate_gini_coefficient(x):
    """Calculate Gini coefficient for measuring inequality"""
    # Handle edge case where all values are zero
    if np.sum(x) == 0:
        return 0
    
    # Sort the array
    sorted_x = np.sort(x)
    n = len(x)
    # Calculate Gini coefficient
    index = np.arange(1, n + 1)
    return (2 * np.sum(index * sorted_x)) / (n * np.sum(sorted_x)) - (n + 1) / n

def calculate_fairness_metrics(data, system_name):
    """Calculate comprehensive fairness metrics"""
    filled_seats = data['Filled_Seats']
    
    # Basic statistics
    total_riders = filled_seats.sum()
    mean_seats = filled_seats.mean()
    std_dev = filled_seats.std()
    variance = filled_seats.var()
    
    # Fairness metrics
    gini_coeff = calculate_gini_coefficient(filled_seats)
    coeff_variation = std_dev / mean_seats if mean_seats > 0 else 0
    
    # Load distribution analysis
    empty_drivers = (filled_seats == 0).sum()
    full_drivers = (filled_seats == 5).sum()
    
    # Utilization efficiency
    max_capacity = len(filled_seats) * 5  # drivers * 5 seats each
    utilization_rate = total_riders / max_capacity
    
    # Range and quartiles
    q1 = filled_seats.quantile(0.25)
    q2 = filled_seats.quantile(0.5)  # Median
    q3 = filled_seats.quantile(0.75)
    iqr = q3 - q1
    
    return {
        'System': system_name,
        'Total_Riders': total_riders,
        'Mean_Seats': mean_seats,
        'Std_Dev': std_dev,
        'Variance': variance,
        'Gini_Coefficient': gini_coeff,
        'Coeff_Variation': coeff_variation,
        'Empty_Drivers': empty_drivers,
        'Full_Drivers': full_drivers,
        'Utilization_Rate': utilization_rate,
        'Q1': q1,
        'Median': q2,
        'Q3': q3,
        'IQR': iqr,
        'Range': filled_seats.max() - filled_seats.min()
    }

# Calculate metrics for both systems
fair_metrics = calculate_fairness_metrics(df_fair, 'DeRideFair')
deride_metrics = calculate_fairness_metrics(df_deride, 'DeRide')

# Create comparison table
metrics_df = pd.DataFrame([fair_metrics, deride_metrics])

print("=== COMPREHENSIVE COMPARISON ===")
print(metrics_df.round(4))

# Calculate percentage differences using actual calculated values
total_riders_diff = ((deride_metrics['Total_Riders'] - fair_metrics['Total_Riders']) / fair_metrics['Total_Riders']) * 100
mean_seats_diff = ((deride_metrics['Mean_Seats'] - fair_metrics['Mean_Seats']) / fair_metrics['Mean_Seats']) * 100
std_dev_diff = ((deride_metrics['Std_Dev'] - fair_metrics['Std_Dev']) / fair_metrics['Std_Dev']) * 100
gini_diff = ((deride_metrics['Gini_Coefficient'] - fair_metrics['Gini_Coefficient']) / fair_metrics['Gini_Coefficient']) * 100

print("\n=== COMPARATIVE ANALYSIS ===")
print(f"Total Riders: DeRide serves {total_riders_diff:.1f}% more riders than DeRideFair")
print(f"Efficiency: DeRide has {mean_seats_diff:.1f}% higher average occupancy")
print(f"Fairness (Std Dev): DeRide has {std_dev_diff:.1f}% higher variance")
print(f"Fairness (Gini): DeRide has {gini_diff:.1f}% higher inequality")

# Load distribution analysis
print("\n=== LOAD DISTRIBUTION ANALYSIS ===")
seats_distribution_fair = df_fair['Filled_Seats'].value_counts().sort_index()
seats_distribution_deride = df_deride['Filled_Seats'].value_counts().sort_index()

print("\nDeRideFair seat distribution:")
for seats, count in seats_distribution_fair.items():
    percentage = (count/len(df_fair))*100
    print(f"{seats} seats: {count} drivers ({percentage:.1f}%)")

print("\nDeRide seat distribution:")
for seats, count in seats_distribution_deride.items():
    percentage = (count/len(df_deride))*100
    print(f"{seats} seats: {count} drivers ({percentage:.1f}%)")

# Save comprehensive analysis to CSV
metrics_df.to_csv('rideshare_comparison_metrics.csv', index=False)
print(f"\nMetrics saved to rideshare_comparison_metrics.csv")

# Create detailed driver analysis
detailed_analysis = []
for _, row in df_fair.iterrows():
    driver_id = row['Driver_ID']
    fair_seats = row['Filled_Seats']
    
    # Find corresponding driver in deride data
    deride_row = df_deride[df_deride['Driver_ID'] == driver_id]
    if not deride_row.empty:
        deride_seats = deride_row['Filled_Seats'].iloc[0]
        
        detailed_analysis.append({
            'Driver_ID': f'd{driver_id}',
            'DeRideFair_Seats': fair_seats,
            'DeRide_Seats': deride_seats,
            'Difference': deride_seats - fair_seats,
            'DeRideFair_Deviation': fair_seats - fair_metrics['Mean_Seats'],
            'DeRide_Deviation': deride_seats - deride_metrics['Mean_Seats']
        })

detailed_df = pd.DataFrame(detailed_analysis)
detailed_df.to_csv('detailed_driver_comparison.csv', index=False)
print(f"Detailed driver analysis saved to detailed_driver_comparison.csv")