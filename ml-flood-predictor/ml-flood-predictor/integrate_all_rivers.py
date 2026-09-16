import pandas as pd
import numpy as np
import glob
import os

print("="*70)
print(" INTEGRATING ALL RIVER DISCHARGE DATASETS")
print("="*70)

# Load main flood inventory
print("\n📂 Loading Flood Inventory...")
flood_df = pd.read_csv('India_Flood_Inventory_v3.csv', on_bad_lines='skip')
flood_df['Start Date'] = pd.to_datetime(flood_df['Start Date'], errors='coerce')
flood_df = flood_df.dropna(subset=['Start Date', 'Districts', 'State'])
flood_df['State'] = flood_df['State'].str.strip().str.upper()
flood_df['Districts'] = flood_df['Districts'].str.strip().str.title()
print(f"✓ Loaded {len(flood_df)} flood events")

# Find all river discharge files
print("\n🌊 Finding River Discharge Files...")
river_files = glob.glob('river_discharge_manual_daily_cwc_*.csv')
print(f"✓ Found {len(river_files)} river files")

# Dictionary to store all river data
all_river_data = []

# Process each river file
for file_path in river_files:
    try:
        filename = os.path.basename(file_path)
        print(f"\n Processing {filename}...")
        
        # Read the CSV
        df = pd.read_csv(file_path, on_bad_lines='skip')
        
        # Clean column names
        df.columns = df.columns.str.strip()
        
        # Identify key columns (adjust based on actual structure)
        # Usually: State, District, Station, Date, Discharge
        if 'State' in df.columns:
            df['State'] = df['State'].astype(str).str.strip().str.upper()
        else:
            # Extract state from filename (e.g., 'ka' from river_discharge...ka...)
            state_code = filename.split('_cwc_')[1].split('_')[0].upper()
            state_map = {
                'KA': 'KARNATAKA', 'KL': 'KERALA', 'MH': 'MAHARASHTRA',
                'TN': 'TAMIL NADU', 'TS': 'TELANGANA', 'AP': 'ANDHRA PRADESH',
                'GJ': 'GUJARAT', 'RJ': 'RAJASTHAN', 'UP': 'UTTAR PRADESH',
                'MP': 'MADHYA PRADESH', 'HR': 'HARYANA', 'PB': 'PUNJAB',
                'JH': 'JHARKHAND', 'OD': 'ODISHA', 'WB': 'WEST BENGAL',
                'ML': 'MEGHALAYA', 'GA': 'GOA', 'JK': 'JAMMU & KASHMIR'
            }
            df['State'] = state_map.get(state_code, state_code)
        
        # Find discharge column (last column or contains 'Discharge')
        discharge_col = None
        for col in df.columns:
            if 'discharge' in col.lower() or 'flow' in col.lower():
                discharge_col = col
                break
        
        if discharge_col is None:
            discharge_col = df.columns[-1]
        
        # Convert discharge to numeric
        df['Discharge'] = pd.to_numeric(df[discharge_col], errors='coerce').fillna(0)
        
        # Find district/station column
        location_col = None
        for col in ['District', 'Station', 'Location', 'Place']:
            if col in df.columns:
                location_col = col
                break
        
        if location_col:
            df['District'] = df[location_col].astype(str).str.strip().str.title()
        else:
            df['District'] = 'Unknown'
        
        # Aggregate by State and District
        river_stats = df.groupby(['State', 'District']).agg(
            Avg_Discharge=('Discharge', 'mean'),
            Max_Discharge=('Discharge', 'max'),
            Min_Discharge=('Discharge', 'min'),
            Std_Discharge=('Discharge', 'std'),
            Total_Readings=('Discharge', 'count')
        ).reset_index()
        
        river_stats['Std_Discharge'] = river_stats['Std_Discharge'].fillna(0)
        
        print(f"  ✓ Processed {len(river_stats)} districts")
        all_river_data.append(river_stats)
        
    except Exception as e:
        print(f"  ⚠️ Error: {e}")

# Combine all river data
print("\n Combining All River Data...")
if all_river_data:
    combined_river = pd.concat(all_river_data, ignore_index=True)
    print(f"✓ Combined {len(combined_river)} district records")
    
    # Save combined data
    combined_river.to_csv('combined_river_discharge.csv', index=False)
    print("✓ Saved: combined_river_discharge.csv")
else:
    print("️ No river data loaded")
    combined_river = pd.DataFrame()

# Merge with flood inventory
print("\n Merging River Data with Flood Inventory...")
if not combined_river.empty:
    flood_df = flood_df.merge(
        combined_river,
        left_on=['State', 'Districts'],
        right_on=['State', 'District'],
        how='left'
    )
    
    # Fill missing values
    river_cols = ['Avg_Discharge', 'Max_Discharge', 'Min_Discharge', 'Std_Discharge']
    for col in river_cols:
        if col in flood_df.columns:
            median_val = flood_df[col].median()
            flood_df[col] = flood_df[col].fillna(median_val if median_val > 0 else 0)
    
    print("✅ Merged river discharge data")
else:
    # Add empty columns
    for col in ['Avg_Discharge', 'Max_Discharge', 'Min_Discharge', 'Std_Discharge']:
        flood_df[col] = 0

# Save integrated dataset
output_file = 'flood_data_with_rivers.csv'
flood_df.to_csv(output_file, index=False)
print(f"\n Saved: {output_file}")
print(f"✅ Total rows: {len(flood_df)}")
print(f"✅ Total columns: {len(flood_df.columns)}")

print("\n" + "="*70)
print(" RIVER INTEGRATION COMPLETE!")
print("="*70)