import pandas as pd
import numpy as np

print("="*70)
print(" INTEGRATING J&K RIVER DISCHARGE & FLOOD DATA")
print("="*70)

# 1. Load Main Flood Inventory
print("\n📂 Step 1: Loading Flood Inventory...")
flood_df = pd.read_csv('India_Flood_Inventory_v3.csv', on_bad_lines='skip')
flood_df['Start Date'] = pd.to_datetime(flood_df['Start Date'], errors='coerce')
flood_df = flood_df.dropna(subset=['Start Date', 'Districts', 'State'])
flood_df['State'] = flood_df['State'].astype(str).str.strip().str.upper()
flood_df['Districts'] = flood_df['Districts'].astype(str).str.strip().str.title()
print(f"✅ Loaded {len(flood_df)} flood events")

# 2. Load J&K River Discharge Data (It has no headers, so we use positional columns)
print("\n🌊 Step 2: Loading J&K River Discharge Data...")
try:
    # The file has no headers. Based on the data format:
    # Col 4: State, Col 6: District, Col 17: DateTime, Col 18: Discharge
    river_df = pd.read_csv('river_discharge_tele_hr_cwc_jk_1970_2025.csv', header=None, on_bad_lines='skip')
    
    # Extract the columns we need
    river_df['State'] = river_df.iloc[:, 4].astype(str).str.strip().str.upper()
    river_df['District'] = river_df.iloc[:, 6].astype(str).str.strip().str.title()
    river_df['DateTime'] = pd.to_datetime(river_df.iloc[:, 17], errors='coerce')
    river_df['Discharge'] = pd.to_numeric(river_df.iloc[:, 18], errors='coerce')
    
    # Drop rows where discharge is missing or negative (sensor errors)
    river_df = river_df.dropna(subset=['Discharge'])
    river_df = river_df[river_df['Discharge'] >= 0]
    
    # Aggregate by District to get average and max discharge
    river_stats = river_df.groupby(['State', 'District']).agg(
        Avg_Discharge=('Discharge', 'mean'),
        Max_Discharge=('Discharge', 'max')
    ).reset_index()
    
    print(f"✅ Processed river data for {len(river_stats)} districts in J&K")
except Exception as e:
    print(f"⚠️ Error loading river data: {e}")
    river_stats = pd.DataFrame()

# 3. Merge River Data with Flood Inventory
print("\n🔗 Step 3: Merging Data...")
if not river_stats.empty:
    flood_df = flood_df.merge(
        river_stats,
        left_on=['State', 'Districts'],
        right_on=['State', 'District'],
        how='left'
    )
    print("✅ Merged J&K River Discharge data")
    
    # Fill missing discharge values for non-J&K districts with 0
    flood_df['Avg_Discharge'] = flood_df['Avg_Discharge'].fillna(0)
    flood_df['Max_Discharge'] = flood_df['Max_Discharge'].fillna(0)
else:
    flood_df['Avg_Discharge'] = 0
    flood_df['Max_Discharge'] = 0

# 4. Save the Final Integrated Dataset
output_file = 'final_integrated_data.csv'
flood_df.to_csv(output_file, index=False)
print(f"\n💾 Saved integrated dataset to: {output_file}")
print(f"✅ Total rows: {len(flood_df)}")
print(f"✅ Total columns: {len(flood_df.columns)}")

print("\n" + "="*70)
print(" INTEGRATION COMPLETE!")
print("="*70)