import pandas as pd
import time # Για να μετράμε τον χρόνο εκπαίδευσης
from pathlib import Path
from sklearn.model_selection import train_test_split
from xgboost import XGBRegressor 
from sklearn.preprocessing import StandardScaler
from sklearn.pipeline import make_pipeline
from sklearn.metrics import mean_absolute_error, mean_absolute_percentage_error 
import joblib
import mlflow
import mlflow.sklearn

def train_and_compare_models():
    repo_root = Path(__file__).resolve().parents[2]
    mlflow.set_tracking_uri(f"file:{repo_root / 'mlruns'}")
    df = pd.read_csv("data\\training_data.csv")
    
    X = df.drop(columns=['True_Distance_y'])
    y = df['True_Distance_y']
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)
    
    mlflow.set_experiment("Dijkstra_XGBoost_Predictions") 
    
    models_to_test = {
        "XGBoost_Fast": XGBRegressor(n_estimators=100, max_depth=3, learning_rate=0.1, random_state=42),
        "XGBoost_Medium": XGBRegressor(n_estimators=200, max_depth=4, learning_rate=0.05, random_state=42),
        "XGBoost_Deep": XGBRegressor(n_estimators=300, max_depth=5, learning_rate=0.05, random_state=42)
    }

    print(f"Starting MLflow experiment. Testing {len(models_to_test)} different models...")

    for model_name, model_instance in models_to_test.items():
        with mlflow.start_run(run_name=model_name):
            print(f"--- Training {model_name} ---")
            
            mlflow.log_param("algorithm", model_name.split("_")[0])
            mlflow.log_param("dataset_size", len(df))

            if "XGBoost" in model_name:
                mlflow.log_param("n_estimators", model_instance.n_estimators)
                mlflow.log_param("max_depth", model_instance.max_depth)

            model_pipeline = make_pipeline(
                StandardScaler(),
                model_instance
            )
            
            start_time = time.time()
            model_pipeline.fit(X_train, y_train)
            training_time = time.time() - start_time
            # ---------------------------------
            
            predictions = model_pipeline.predict(X_test)
            mae = mean_absolute_error(y_test, predictions)
            mape = mean_absolute_percentage_error(y_test, predictions) 
            
            print(f"Time: {training_time:.2f}s | MAE: {mae:.2f} | MAPE: {mape * 100:.2f}%") 
            
            mlflow.log_metric("MAE", mae)
            mlflow.log_metric("MAPE", mape)
            mlflow.log_metric("training_time_seconds", training_time) 
            
            mlflow.sklearn.log_model(model_pipeline, "model")
            
            local_filename = f'models/dijkstra_{model_name.lower()}.joblib'
            joblib.dump(model_pipeline, local_filename)

    print("Finished")

if __name__ == "__main__":
    train_and_compare_models()