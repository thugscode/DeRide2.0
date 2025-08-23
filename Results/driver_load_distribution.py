import plotly.graph_objects as go
import plotly.express as px
import pandas as pd
import os

# Get the directory where this script is located
script_dir = os.path.dirname(os.path.abspath(__file__))

# Define the data
data = [
    {"Algorithm": "DeRide", "0_riders": 22, "1_rider": 4, "2_riders": 6, "3_riders": 8, "4_riders": 5, "5_riders": 55},
    {"Algorithm": "DeRideFair", "0_riders": 23, "1_rider": 12, "2_riders": 12, "3_riders": 17, "4_riders": 13, "5_riders": 23},
    {"Algorithm": "SCIPDeRide", "0_riders": 26, "1_rider": 1, "2_riders": 2, "3_riders": 7, "4_riders": 1, "5_riders": 63},
    {"Algorithm": "SCIPDeRideFairMMScalar", "0_riders": 26, "1_rider": 1, "2_riders": 2, "3_riders": 7, "4_riders": 1, "5_riders": 63},
    {"Algorithm": "SCIPDeRideFairMM2Phase", "0_riders": 28, "1_rider": 1, "2_riders": 2, "3_riders": 2, "4_riders": 1, "5_riders": 66},
    {"Algorithm": "SCIPDeRideFairMMLexico", "0_riders": 22, "1_rider": 4, "2_riders": 8, "3_riders": 2, "4_riders": 1, "5_riders": 63}
]

df = pd.DataFrame(data)

# Define colors for each load level
colors = ['#1FB8CD', '#DB4545', '#2E8B57', '#5D878F', '#D2BA4C', '#B4413C']
load_levels = ['0_riders', '1_rider', '2_riders', '3_riders', '4_riders', '5_riders']
load_labels = ['0 riders', '1 rider', '2 riders', '3 riders', '4 riders', '5 riders']

# Calculate totals for percentage calculations
df['total'] = df[load_levels].sum(axis=1)

# Create the figure
fig = go.Figure()

# Add traces for each load level
for i, (level, label) in enumerate(zip(load_levels, load_labels)):
    # Calculate percentages
    percentages = (df[level] / df['total'] * 100).round(1)
    
    # Create text labels with percentages
    text_labels = []
    for j, (val, pct) in enumerate(zip(df[level], percentages)):
        if val > 0 and pct >= 5:
            text_labels.append(f'<b>{pct}%</b>')
        else:
            text_labels.append('')
    
    fig.add_trace(go.Bar(
        name=f"<b>{label}</b>",  # Make legend label bold
        x=df['Algorithm'],
        y=df[level],
        marker_color=colors[i],
        text=text_labels,
        textposition='inside',
        textfont=dict(size=11, family='Arial', color='black', weight='bold'),  # Use weight for bold
        cliponaxis=False
    ))

# Update layout
fig.update_layout(
    title='Driver Load Distr by Algorithm',
    xaxis_title='Algorithm',
    yaxis_title='Num of Drivers',
    barmode='stack',
    showlegend=True,
    legend=dict(font=dict(size=12, family='Arial', color='black', weight='bold'))  # Use weight for bold
)

# Save the chart in the same directory as the script
output_path = os.path.join(script_dir, 'driver_load_distribution.png')
fig.write_image(output_path)
print(f"Chart saved to: {output_path}")