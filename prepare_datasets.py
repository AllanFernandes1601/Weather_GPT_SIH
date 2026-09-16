import pandas as pd
import numpy as np
import warnings
import os
warnings.filterwarnings('ignore')

print("="*70)
print(" BULLETPROOF FLOOD DATA PREPARATION")
print("="*70)

# Helper function to safely load CSVs
def safe_load_csv(filename, names=None):
    if not os.path.exists(filename):
        print(f"  ⚠️ {filename} not found. Using empty fallback.")
        return pd.DataFrame(columns=names if names else ['District', 'State'])
    try:
        df = pd.read_csv(filename, header=None if names else 'infer', names=names)
        if df.empty:
            print(f"  ⚠️ {filename} is empty. Using empty fallback.")
            return pd.DataFrame(columns=names if names else ['District', 'State'])
        return df
    except Exception as e:
        print(f"  ⚠️ Error loading {filename}: {e}. Using empty fallback.")
        return pd.DataFrame(columns=names if names else ['District', 'State'])

# ========== LOAD DATASETS ==========
print("\n📂 Step 1: Loading Datasets...")

# 1. Main Inventory (This one MUST exist)
print("  • Loading India_Flood_Inventory_v3.csv...")
inventory = pd.read_csv('India_Flood_Inventory_v3.csv', on_bad_lines='skip')
print(f"    ✓ Loaded {len(inventory)} flood events")

# 2. Secondary Datasets (Safe load)
print("  • Loading secondary datasets...")
dfsi = safe_load_csv('DFSI.csv', names=['District', 'State', 'DFSI_Score'])
impact = safe_load_csv('District_FloodImpact.csv', names=['Dist_Name', 'Human_fatality', 'Human_injured', 'Population', 'Mean_Flood_Duration'])
area = safe_load_csv('District_FloodedArea.csv', names=['District', 'Flooded_Total', 'Flooded_Agri', 'Flooded_Pop'])

# ========== DATA CLEANING ==========
print("\n🧹 Step 2: Cleaning Data...")

# Clean Inventory
inventory['Start Date'] = pd.to_datetime(inventory['Start Date'], errors='coerce')
inventory = inventory.dropna(subset=['Start Date', 'Districts', 'State'])
inventory['State'] = inventory['State'].astype(str).str.strip().str.upper()
inventory['Districts'] = inventory['Districts'].astype(str).str.strip().str.title()
inventory['Year'] = inventory['Start Date'].dt.year
inventory['Month'] = inventory['Start Date'].dt.month

# Calculate historical flood frequency per district
print("  • Calculating historical flood frequency...")
district_freq = inventory.groupby(['State', 'Districts']).size().reset_index(name='Historical_Flood_Frequency')

# ========== MERGE DATASETS ==========
print("\n🔗 Step 3: Merging Datasets...")

# Start with the frequency data
merged = district_freq.copy()

# Merge DFSI if it has data
if not dfsi.empty:
    dfsi['State'] = dfsi['State'].astype(str).str.strip().str.upper()
    dfsi['District'] = dfsi['District'].astype(str).str.strip().str.title()
    merged = merged.merge(dfsi, left_on=['State', 'Districts'], right_on=['State', 'District'], how='left')
    merged['DFSI_Score'] = merged['DFSI_Score'].fillna(merged['DFSI_Score'].median() if not merged['DFSI_Score'].isna().all() else 10.0)
else:
    merged['DFSI_Score'] = 10.0 # Default fallback score

# Merge Impact if it has data
if not impact.empty:
    impact['Dist_Name'] = impact['Dist_Name'].astype(str).str.strip().str.title()
    merged = merged.merge(impact[['Dist_Name', 'Human_fatality']], left_on='Districts', right_on='Dist_Name', how='left')
    merged['Human_fatality'] = merged['Human_fatality'].fillna(0)
else:
    merged['Human_fatality'] = 0

# Merge Area if it has data
if not area.empty:
    area['District'] = area['District'].astype(str).str.strip().str.title()
    merged = merged.merge(area[['District', 'Flooded_Total']], left_on='Districts', right_on='District', how='left')
    merged['Flooded_Total'] = merged['Flooded_Total'].fillna(0)
else:
    merged['Flooded_Total'] = 0

# ========== CREATE TRAINING FEATURES ==========
print("\n⚙️ Step 4: Creating Training Features...")

# Define target: High Risk if DFSI > 15 OR Historical Frequency > 5
merged['Is_High_Risk'] = 0
merged.loc[(merged['DFSI_Score'] > 15) | (merged['Historical_Flood_Frequency'] > 5), 'Is_High_Risk'] = 1

# ========== SAVE CLEAN DATASETS ==========
print("\n💾 Step 5: Saving Clean Datasets...")

# Save master training dataset
merged.to_csv('clean_master_dataset.csv', index=False)
print(f"  ✓ Saved: clean_master_dataset.csv ({len(merged)} districts)")

# Save summary statistics
summary = merged.groupby(['State', 'Districts']).agg({
    'Historical_Flood_Frequency': 'mean',
    'DFSI_Score': 'mean',
    'Human_fatality': 'sum',
    'Flooded_Total': 'mean',
    'Is_High_Risk': 'max'
}).reset_index()
summary.to_csv('district_summary.csv', index=False)
print(f"  ✓ Saved: district_summary.csv")

# ========== PRINT STATISTICS ==========
print("\n" + "="*70)
print("📊 DATA PREPARATION SUMMARY")
print("="*70)
print(f"\nTotal Districts Processed: {len(merged)}")
print(f"High Risk Districts: {merged['Is_High_Risk'].sum()} ({merged['Is_High_Risk'].mean()*100:.1f}%)")

print("\n✅ DATA PREPARATION COMPLETE!")
print("="*70)