import pandas as pd
import numpy as np
from sklearn.model_selection import train_test_split
from sklearn.ensemble import RandomForestClassifier
from sklearn.preprocessing import LabelEncoder
from sklearn.metrics import classification_report
import joblib
import warnings
warnings.filterwarnings('ignore')

print("🚀 Starting Flood Model Training...")

# 1. Load Data (Looking one folder up for the CSV)
try:
    df = pd.read_csv('India_Flood_Inventory_v3.csv', on_bad_lines='skip')
except FileNotFoundError:
    print("❌ CSV not found! Make sure 'India_Flood_Inventory_v3.csv' is in the folder above this one.")
    exit()

print(f"✅ Loaded {len(df)} records.")

# 2. Clean & Parse Dates
df['Start Date'] = pd.to_datetime(df['Start Date'], errors='coerce')
df = df.dropna(subset=['Start Date', 'Districts', 'State'])

df['State'] = df['State'].astype(str).str.strip()
df['Districts'] = df['Districts'].astype(str).str.strip()

# 3. Feature Engineering
df['Month'] = df['Start Date'].dt.month
df['Season'] = df['Month'].apply(lambda x: 'Monsoon' if 6 <= x <= 9 else ('Pre-Monsoon' if 3 <= x <= 5 else 'Winter'))

# Calculate Historical District Risk
district_risk = df.groupby(['State', 'Districts']).size().reset_index(name='Historical_Flood_Frequency')
df = df.merge(district_risk, on=['State', 'Districts'], how='left')

# 4. Define Target Variable (High Risk / Flash Flood)
df['Is_High_Risk'] = 0
df.loc[df['Main Cause'].str.contains('Flash|Cloudburst|Landslide', na=False, case=False), 'Is_High_Risk'] = 1
df.loc[(df['Duration(Days)'] <= 2) & (df['Main Cause'].str.contains('Heavy', na=False)), 'Is_High_Risk'] = 1

# 5. Encode Categorical Data
le_state = LabelEncoder()
le_district = LabelEncoder()
le_season = LabelEncoder()

df['State_Enc'] = le_state.fit_transform(df['State'])
df['District_Enc'] = le_district.fit_transform(df['Districts'])
df['Season_Enc'] = le_season.fit_transform(df['Season'])

# 6. Train/Test Split
features = ['State_Enc', 'District_Enc', 'Month', 'Season_Enc', 'Historical_Flood_Frequency']
X = df[features].fillna(0)
y = df['Is_High_Risk']

X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

# 7. Train Model
print("🤖 Training Random Forest...")
model = RandomForestClassifier(n_estimators=100, max_depth=10, random_state=42, class_weight='balanced')
model.fit(X_train, y_train)

# 8. Evaluate
y_pred = model.predict(X_test)
print("\n📊 Model Performance:")
print(classification_report(y_test, y_pred, target_names=['Normal Risk', 'High Flash Flood Risk']))

# 9. Save Artifacts
joblib.dump(model, 'flood_risk_model.pkl')
joblib.dump({
    'state': le_state, 
    'district': le_district, 
    'season': le_season,
    'features': features
}, 'encoders.pkl')

print("✅ Model and Encoders saved successfully! Ready for deployment.")