import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.ensemble import GradientBoostingClassifier
from sklearn.preprocessing import LabelEncoder
from sklearn.metrics import accuracy_score, classification_report
import joblib
import warnings
warnings.filterwarnings('ignore')

print("="*70)
print(" TRAINING MODEL WITH RAINFALL DATA")
print("="*70)

# 1. Load the integrated dataset
print("\n📂 Loading flood_data_with_rainfall.csv...")
df = pd.read_csv('flood_data_with_rainfall.csv')
print(f"✅ Loaded {len(df)} records")

# 2. Clean and Encode
df['State'] = df['State'].astype(str).str.strip().str.upper()
df['Districts'] = df['Districts'].astype(str).str.strip().str.title()

le_state = LabelEncoder()
le_district = LabelEncoder()

df['State_Enc'] = le_state.fit_transform(df['State'])
df['District_Enc'] = le_district.fit_transform(df['Districts'])

# 3. Define Target
df['Duration'] = pd.to_numeric(df['Duration(Days)'], errors='coerce').fillna(1)
df['Fatalities'] = pd.to_numeric(df['Human fatality'], errors='coerce').fillna(0)

df['Is_High_Risk'] = 0
df.loc[(df['Duration'] <= 3) | (df['Fatalities'] > 0), 'Is_High_Risk'] = 1

# 4. Select Features
features = [
    'State_Enc', 'District_Enc', 'Month', 'Duration',
    'Avg_Daily_Rain', 'Max_Daily_Rain', 'Avg_Anomaly',
    'State_Avg_Rain', 'State_Avg_Anomaly'
]
features = [f for f in features if f in df.columns]
print(f"\n📊 Using {len(features)} features: {features}")

X = df[features].fillna(0)
y = df['Is_High_Risk']

# 5. Train
X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

print("\n🤖 Training Gradient Boosting Classifier...")
model = GradientBoostingClassifier(n_estimators=100, max_depth=5, learning_rate=0.1, random_state=42)
model.fit(X_train, y_train)

# 6. Evaluate
y_pred = model.predict(X_test)
accuracy = accuracy_score(y_test, y_pred)

print("\n" + "="*70)
print(" MODEL PERFORMANCE")
print("="*70)
print(f"✅ Overall Accuracy: {accuracy * 100:.2f}%")
print("\n" + classification_report(y_test, y_pred, target_names=['Low Risk', 'High Risk']))

# 7. Save
joblib.dump(model, 'flood_model_rainfall.pkl')
joblib.dump({
    'state': le_state,
    'district': le_district,
    'features': features
}, 'encoders_rainfall.pkl')

print("\n✅ Model saved as: flood_model_rainfall.pkl")
print("="*70)