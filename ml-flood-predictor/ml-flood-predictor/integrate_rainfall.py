import pandas as pd
import numpy as np

print("="*70)
print(" INTEGRATING IMD RAINFALL DATA")
print("="*70)

# 1. Load Flood Inventory
print("\n📂 Loading Flood Inventory...")
flood_df = pd.read_csv('India_Flood_Inventory_v3.csv', on_bad_lines='skip')
flood_df['Start Date'] = pd.to_datetime(flood_df['Start Date'], errors='coerce')
flood_df = flood_df.dropna(subset=['Start Date', 'Districts', 'State'])
flood_df['State'] = flood_df['State'].str.strip().str.upper()
flood_df['Districts'] = flood_df['Districts'].str.strip().str.title()
print(f"✅ Loaded {len(flood_df)} flood events")

# 2. Load District Rainfall (Handling messy IMD formatting)
print("\n🌧️ Loading District Rainfall...")
try:
    # IMD files often have messy headers, so we read carefully
    dist_rain = pd.read_csv('rainfall_districtwise_daily_imd.csv', on_bad_lines='skip')
    
    # Find the correct columns dynamically
    cols = dist_rain.columns.tolist()
    # Based on the data, the columns are usually State, District, Date, Daily Actual, Daily Normal
    # Let's rename them to be safe
    if len(cols) >= 5:
        dist_rain = dist_rain.rename(columns={
            cols[0]: 'State', cols[1]: 'District', cols[2]: 'Date', 
            cols[3]: 'Daily_Actual', cols[4]: 'Daily_Normal'
        })
        
        # Clean data
        dist_rain['State'] = dist_rain['State'].astype(str).str.strip().str.upper()
        dist_rain['District'] = dist_rain['District'].astype(str).str.strip().str.title()
        dist_rain['Daily_Actual'] = pd.to_numeric(dist_rain['Daily_Actual'], errors='coerce').fillna(0)
        dist_rain['Daily_Normal'] = pd.to_numeric(dist_rain['Daily_Normal'], errors='coerce').fillna(1)
        
        # Calculate Anomaly (Actual / Normal)
        dist_rain['Rain_Anomaly'] = dist_rain['Daily_Actual'] / dist_rain['Daily_Normal']
        
        # Aggregate by District (Average anomaly and max rain)
        dist_stats = dist_rain.groupby(['State', 'District']).agg(
            Avg_Daily_Rain=('Daily_Actual', 'mean'),
            Max_Daily_Rain=('Daily_Actual', 'max'),
            Avg_Anomaly=('Rain_Anomaly', 'mean')
        ).reset_index()
        
        print(f"✅ Processed rainfall for {len(dist_stats)} districts")
    else:
        dist_stats = pd.DataFrame()
        print("⚠️ District rainfall columns not recognized")
except Exception as e:
    print(f"⚠️ Error loading district rainfall: {e}")
    dist_stats = pd.DataFrame()

# 3. Load State Rainfall
print("\n️ Loading State Rainfall...")
try:
    state_rain = pd.read_csv('rainfall_statewise_daily_imd.csv', on_bad_lines='skip')
    cols = state_rain.columns.tolist()
    if len(cols) >= 4:
        state_rain = state_rain.rename(columns={
            cols[0]: 'State', cols[1]: 'Date', 
            cols[2]: 'Daily_Actual', cols[3]: 'Daily_Normal'
        })
        state_rain['State'] = state_rain['State'].astype(str).str.strip().str.upper()
        state_rain['Daily_Actual'] = pd.to_numeric(state_rain['Daily_Actual'], errors='coerce').fillna(0)
        state_rain['Daily_Normal'] = pd.to_numeric(state_rain['Daily_Normal'], errors='coerce').fillna(1)
        state_rain['State_Anomaly'] = state_rain['Daily_Actual'] / state_rain['Daily_Normal']
        
        state_stats = state_rain.groupby('State').agg(
            State_Avg_Rain=('Daily_Actual', 'mean'),
            State_Avg_Anomaly=('State_Anomaly', 'mean')
        ).reset_index()
        print(f"✅ Processed rainfall for {len(state_stats)} states")
    else:
        state_stats = pd.DataFrame()
except Exception as e:
    print(f"⚠️ Error loading state rainfall: {e}")
    state_stats = pd.DataFrame()

# 4. Merge Rainfall Data with Flood Data
print("\n🔗 Merging Data...")
if not dist_stats.empty:
    flood_df = flood_df.merge(dist_stats, left_on=['State', 'Districts'], right_on=['State', 'District'], how='left')
    print("✅ Merged District Rainfall")

if not state_stats.empty:
    flood_df = flood_df.merge(state_stats, on='State', how='left')
    print("✅ Merged State Rainfall")

# Fill missing values with safe averages
for col in ['Avg_Daily_Rain', 'Max_Daily_Rain', 'Avg_Anomaly', 'State_Avg_Rain', 'State_Avg_Anomaly']:
    if col in flood_df.columns:
        flood_df[col] = flood_df[col].fillna(flood_df[col].median() if flood_df[col].median() > 0 else 10.0)

# 5. Save the Integrated Dataset
output_file = 'flood_data_with_rainfall.csv'
flood_df.to_csv(output_file, index=False)
print(f"\n✅ Saved integrated dataset to: {output_file}")
print(f"✅ Total rows: {len(flood_df)}")
print("="*70)