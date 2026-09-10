import pandas as pd
import pickle
from sklearn.ensemble import RandomForestRegressor
import os

def train():
    current_dir = os.path.dirname(os.path.abspath(__file__))
    csv_path = os.path.join(current_dir, 'canteen_orders.csv')
    model_path = os.path.join(current_dir, 'eta_model.pkl')

    if not os.path.exists(csv_path):
        print(f"Error: Dataset not found at {csv_path}")
        return

    print("Loading dataset...")
    df = pd.read_csv(csv_path)

    # Features and Target
    features = ['total_items', 'total_quantity', 'queue_length', 'hour', 'day_of_week', 'is_peak_hour']
    target = 'actual_prep_time'

    X = df[features]
    y = df[target]

    print("Training RandomForestRegressor...")
    model = RandomForestRegressor(n_estimators=100, random_state=42)
    model.fit(X, y)

    print(f"Saving model to {model_path}...")
    with open(model_path, 'wb') as f:
        pickle.dump(model, f)
        
    print("Training complete!")

if __name__ == '__main__':
    train()
