import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.neural_network import MLPRegressor
from sklearn.preprocessing import StandardScaler
from sklearn.pipeline import make_pipeline
from sklearn.metrics import mean_absolute_error, mean_absolute_percentage_error 
import joblib
import mlflow
import mlflow.sklearn

def train_and_track_model():
    df = pd.read_csv("data\\training_data.csv")
    
    X = df.drop(columns=['True_Distance_y'])
    y = df['True_Distance_y']
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)
    
    mlflow.set_experiment("Dijkstra_MLP_Predictions")
    
    layer_sizes_to_test = [8, 16, 32, 64, 128]
    max_iter = 1000

    print(f"Starting MLflow experiment. Testing {len(layer_sizes_to_test)} different architectures...")

    for size in layer_sizes_to_test:
        hidden_layers = (size, size)
        
        run_name = f"MLP_{size}x{size}_nodes"
        
        with mlflow.start_run(run_name=run_name):
            print(f"--- Training model with {hidden_layers} ---")
            
            mlflow.log_param("hidden_layers", str(hidden_layers))
            mlflow.log_param("max_iter", max_iter)
            mlflow.log_param("dataset_size", len(df))

            model_pipeline = make_pipeline(
                StandardScaler(),
                MLPRegressor(hidden_layer_sizes=hidden_layers, max_iter=max_iter, random_state=42)
            )
            model_pipeline.fit(X_train, y_train)
            
            predictions = model_pipeline.predict(X_test)
            mae = mean_absolute_error(y_test, predictions)
            mape = mean_absolute_percentage_error(y_test, predictions) 
            
            print(f"MAE: {mae:.2f} | MAPE: {mape * 100:.2f}%") 
            
            # Log metrics
            mlflow.log_metric("MAE", mae)
            mlflow.log_metric("MAPE", mape)
            
            mlflow.sklearn.log_model(model_pipeline, "mlp_model")
            
            local_filename = f'dijkstra_mlp_{size}x{size}.joblib'
            joblib.dump(model_pipeline, local_filename)

    print("Finished")

if __name__ == "__main__":
    train_and_track_model()