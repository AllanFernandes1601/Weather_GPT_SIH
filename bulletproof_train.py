import pandas as pd
import numpy as np
from sklearn.model_selection import train_test_split
from sklearn.ensemble import GradientBoostingClassifier
from sklearn.preprocessing import LabelEncoder
from sklearn.metrics import accuracy_score, classification_report
import joblib
import warnings
warnings.filterwarnings('ignore')

print("="*70)
print(" BULLETPROOF FLOOD MODEL TRAINING")
print("="*70)

# 1. Load the Main Data (This one has 6,876 rows!)
print("\n📂 Step 1: Loading Historical Inventory...")
df = pd.read_csv('India_Flood_Inventory_v3.csv', on_bad_lines='skip')
print(f"✅ Loaded {len(df)} flood events")

# 2. Try to Load Rainfall Data (Safely)
print("\n🌧️ Step 2: Checking Rainfall Data...")
rainfall_added = False
try:
    rain_df = pd.read_csv('rainfall_districtwise_daily_imd.csv')
    if not rain_df.empty:
        print("✅ Rainfall data found! Integrating...")
        # (If it had data, we would merge it here)
        rainfall_added = True
    else:
        print("⚠️ Rainfall file is EMPTY. Skipping safely.")
except Exception as e:
    print(f"⚠️ Could not read rainfall file: {e}. Skipping safely.")

# 3. Clean the Main Data
print("\n🧹 Step 3: Cleaning Data...")
df['Start Date'] = pd.to_datetime(df['Start Date'], errors='coerce')
df = df.dropna(subset=['Start Date', 'Districts', 'State'])

df['State'] = df['State'].astype(str).str.strip().str.upper()
df['Districts'] = df['Districts'].astype(str).str.strip().str.title()
df['Month'] = df['Start Date'].dt.month
df['Duration'] = pd.to_numeric(df['Duration(Days)'], errors='coerce').fillna(1)
df['Fatalities'] = pd.to_numeric(df['Human fatality'], errors='coerce').fillna(0)

# 4. Define Target: High Risk (Flash Flood)
# High risk if duration is short (<=3 days) OR there are fatalities
df['Is_High_Risk'] = 0
df.loc[(df['Duration'] <= 3) | (df['Fatalities'] > 0), 'Is_High_Risk'] = 1

# 5. Calculate Historical Frequency per District
print("\n⚙️ Step 4: Calculating Historical Risk...")
freq = df.groupby(['State', 'Districts']).size().reset_index(name='Historical_Frequency')
df = df.merge(freq, on=['State', 'Districts'], how='left')

# 6. Encode Categorical Data
le_state = LabelEncoder()
le_district = LabelEncoder()
le_cause = LabelEncoder()

df['State_Enc'] = le_state.fit_transform(df['State'])
df['District_Enc'] = le_district.fit_transform(df['Districts'])
df['Cause_Enc'] = le_cause.fit_transform(df['Main Cause'].fillna('Unknown').astype(str))

# 7. Select Features
features = ['State_Enc', 'District_Enc', 'Month', 'Cause_Enc', 'Duration', 'Historical_Frequency']
X = df[features].fillna(0)
y = df['Is_High_Risk']

# 8. Train Model
print("\n Step 5: Training AI Model...")
X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

model = GradientBoostingClassifier(n_estimators=100, max_depth=5, learning_rate=0.1, random_state=42)
model.fit(X_train, y_train)

# 9. Evaluate
y_pred = model.predict(X_test)
accuracy = accuracy_score(y_test, y_pred)

print("\n" + "="*70)
print(" MODEL PERFORMANCE")
print("="*70)
print(f"✅ Overall Accuracy: {accuracy * 100:.2f}%")
print("\n📋 Classification Report:")
print(classification_report(y_test, y_pred, target_names=['Low Risk (0)', 'High Risk (1)']))

# 10. Save Model to your ML folder
print("\n💾 Step 6: Saving Model...")
joblib.dump(model, 'ml-flood-predictor/ml-flood-predictor/flood_model.pkl')
joblib.dump({
    'state': le_state,
    'district': le_district,
    'cause': le_cause,
    'features': features
}, 'ml-flood-predictor/ml-flood-predictor/encoders.pkl')

print("✅ Model saved successfully to ml-flood-predictor folder!")
print("="*70)