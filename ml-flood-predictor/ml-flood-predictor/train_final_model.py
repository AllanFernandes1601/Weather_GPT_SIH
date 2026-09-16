import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.ensemble import GradientBoostingClassifier
from sklearn.preprocessing import LabelEncoder
from sklearn.metrics import accuracy_score, classification_report
import joblib

print("="*70)
print(" TRAINING FINAL ML MODEL")
print("="*70)

# Load the integrated data
df = pd.read_csv('final_integrated_data.csv')
print(f"\n📂 Loaded {len(df)} records with {len(df.columns)} features")

# Clean and encode (Safety check)
df['State'] = df['State'].astype(str).str.strip().str.upper()
df['Districts'] = df['Districts'].astype(str).str.strip().str.title()

le_state = LabelEncoder()
le_district = LabelEncoder()
df['State_Enc'] = le_state.fit_transform(df['State'])
df['District_Enc'] = le_district.fit_transform(df['Districts'])

# --- FIX: Create the missing 'Is_High_Risk' column ---
print("⚙️ Creating Target Variable (Is_High_Risk)...")
df['Duration'] = pd.to_numeric(df['Duration(Days)'], errors='coerce').fillna(1)
df['Fatalities'] = pd.to_numeric(df['Human fatality'], errors='coerce').fillna(0)

# High Risk = Short duration (flash flood) OR people got hurt
df['Is_High_Risk'] = 0
df.loc[(df['Duration'] <= 3) | (df['Fatalities'] > 0), 'Is_High_Risk'] = 1
print(f"✅ High Risk events identified: {df['Is_High_Risk'].sum()}")
# ----------------------------------------------------
# Select the best features for the AI
features = [
    'State_Enc', 'District_Enc', 'Month', 'Duration(Days)',
    'Avg_Daily_Rain', 'Max_Daily_Rain', 'Avg_Anomaly',
    'State_Avg_Rain', 'State_Avg_Anomaly'
]

# Only use features that actually exist in the file
features = [f for f in features if f in df.columns]
print(f"\n📊 Using {len(features)} features for AI training")

X = df[features].fillna(0)
y = df['Is_High_Risk']

# Split and Train
X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

print("\n🤖 Training Gradient Boosting Model...")
model = GradientBoostingClassifier(n_estimators=100, max_depth=5, learning_rate=0.1, random_state=42)
model.fit(X_train, y_train)

# Evaluate
y_pred = model.predict(X_test)
accuracy = accuracy_score(y_test, y_pred)

print("\n" + "="*70)
print(" FINAL MODEL PERFORMANCE")
print("="*70)
print(f"✅ Overall Accuracy: {accuracy * 100:.2f}%")
print("\n" + classification_report(y_test, y_pred, target_names=['Low Risk', 'High Risk']))

# Save
joblib.dump(model, 'flood_model_final.pkl')
joblib.dump({
    'state': le_state,
    'district': le_district,
    'features': features
}, 'encoders_final.pkl')

print("\n✅ FINAL MODEL SAVED SUCCESSFULLY!")
print("="*70)