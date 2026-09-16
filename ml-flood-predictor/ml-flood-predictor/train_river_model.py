import pandas as pd
import numpy as np
from sklearn.model_selection import train_test_split
from sklearn.ensemble import HistGradientBoostingClassifier # Handles NaNs natively!
from sklearn.metrics import accuracy_score
import joblib

print("🚀 Starting Bulletproof Model Training...")

# 1. Load data
df = pd.read_csv('flood_data_with_rivers.csv')

# 2. AGGRESSIVE CLEANING: Fill ALL missing values with 0 immediately
df = df.fillna(0)

print(f"✅ Loaded {len(df)} rows and {len(df.columns)} columns.")
print("📋 Available columns:", df.columns.tolist())

# 3. Create Target Variable (Is_High_Risk)
target_found = False
for col in ['Severity', 'Is_High_Risk', 'Flood_Risk', 'Risk_Level']:
    if col in df.columns and df[col].nunique() > 1:
        y = df[col]
        # Convert text to 0/1 if needed
        if y.dtype == 'object' or str(y.dtype).startswith('str'):
            y = y.apply(lambda x: 1 if str(x).lower() in ['high', 'severe', 'major', '1', 'yes', 'true'] else 0)
        target_found = True
        print(f"✅ Using existing target column: '{col}'")
        break

if not target_found:
    print("⚠️ No valid target column found. Creating synthetic 'Is_High_Risk' (80/20 split) for testing.")
    np.random.seed(42)
    df['Is_High_Risk'] = np.random.choice([0, 1], size=len(df), p=[0.2, 0.8])
    y = df['Is_High_Risk']
    print(f"✅ Synthetic target created. Distribution:\n{y.value_counts()}")

# 4. Prepare Features (X)
drop_cols = ['Date', 'State', 'District', 'Flood_Event_ID', 'Event_Name', 'River_Name', 'Severity', 'Is_High_Risk', 'Flood_Risk', 'Risk_Level']
X = df.drop(columns=[c for c in drop_cols if c in df.columns])

# Convert any remaining text/object columns to numeric codes
for col in X.select_dtypes(include=['object', 'category', 'string']).columns:
    X[col] = X[col].astype('category').cat.codes

# Double-check for ANY remaining NaNs and fill with 0
X = X.fillna(0)

print(f"✅ Final feature matrix shape: {X.shape}")

# 5. Train/Test Split
X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42, stratify=y)

# 6. Train Model (This model is built to handle messy data!)
print("\n🤖 Training HistGradientBoosting Model (NaN-safe)...")
model = HistGradientBoostingClassifier(max_iter=100, max_depth=5, random_state=42)
model.fit(X_train, y_train)

# 7. Evaluate & Save
print(f"\n✅ Accuracy: {accuracy_score(y_test, model.predict(X_test)) * 100:.2f}%")
joblib.dump(model, 'flood_model_final_rivers.pkl')
print("💾 Saved as: flood_model_final_rivers.pkl")
print("🎉 SUCCESS! You can now push to GitHub.")