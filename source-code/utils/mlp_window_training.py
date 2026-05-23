import argparse
import json
import pandas as pd
from pathlib import Path
from sklearn.model_selection import train_test_split
from sklearn.neural_network import MLPRegressor
from sklearn.preprocessing import StandardScaler
from sklearn.pipeline import make_pipeline
from sklearn.metrics import mean_absolute_error, mean_absolute_percentage_error
import joblib
import mlflow
import mlflow.sklearn


def build_window_dataset(df, window_size):
    feature_cols = [c for c in df.columns if c.startswith("d_") or c.startswith("B_")]
    feature_cols_sorted = sorted(feature_cols, key=lambda x: (int(x.split("_")[1]), 0 if x.startswith("d_") else 1))

    i0 = len(feature_cols_sorted) // 2
    X = []
    y = []

    for _, row in df.iterrows():
        # Build sequence of (d_i, B_i)
        pairs = []
        for i in range(1, i0 + 1):
            d_val = row[f"d_{i}"]
            b_val = row[f"B_{i}"]
            pairs.append((d_val, b_val))

        for t in range(window_size, i0 + 1):
            window = pairs[t - window_size:t]
            flat = [val for pair in window for val in pair]
            X.append(flat)
            y.append(row["True_Distance_y"])

    return pd.DataFrame(X), pd.Series(y)


def train_window_mlp(window_size, hidden_size, max_iter):
    repo_root = Path(__file__).resolve().parents[2]
    mlflow.set_tracking_uri(f"file:{repo_root / 'mlruns'}")
    mlflow.set_experiment("Dijkstra_MLP_Rolling_Window")

    df = pd.read_csv("data\\training_data.csv")
    X, y = build_window_dataset(df, window_size)

    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

    hidden_layers = (hidden_size, hidden_size)
    run_name = f"MLP_Window_{window_size}_{hidden_size}x{hidden_size}"

    with mlflow.start_run(run_name=run_name):
        mlflow.log_param("window_size", window_size)
        mlflow.log_param("hidden_layers", str(hidden_layers))
        mlflow.log_param("max_iter", max_iter)
        mlflow.log_param("dataset_size", len(df))
        mlflow.log_param("window_samples", len(X))

        model_pipeline = make_pipeline(
            StandardScaler(),
            MLPRegressor(hidden_layer_sizes=hidden_layers, max_iter=max_iter, random_state=42)
        )
        model_pipeline.fit(X_train, y_train)

        predictions = model_pipeline.predict(X_test)
        mae = mean_absolute_error(y_test, predictions)
        mape = mean_absolute_percentage_error(y_test, predictions)
        residuals = y_test - predictions
        residual_q = float(pd.Series(residuals).quantile(0.9))

        mlflow.log_metric("MAE", mae)
        mlflow.log_metric("MAPE", mape)

        print(f"Window Size: {window_size} | Hidden Layers: {hidden_layers} | MAE: {mae:.2f} | MAPE: {mape * 100:.2f}%")

        mlflow.sklearn.log_model(model_pipeline, "mlp_window_model")

        local_filename = f"models/dijkstra_mlp_window_{window_size}_{hidden_size}x{hidden_size}.joblib"
        joblib.dump(model_pipeline, local_filename)

        meta_filename = local_filename.replace(".joblib", ".meta.json")
        with open(meta_filename, "w", encoding="utf-8") as handle:
            json.dump({
                "window_size": window_size,
                "hidden_layers": list(hidden_layers),
                "target": "remaining_distance"
            }, handle)

    print(f"Finished. Saved {local_filename}")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--window-sizes", type=int, nargs="+", default=[3, 5, 10])
    parser.add_argument("--max-iter", type=int, default=1000)
    parser.add_argument("--quantile", type=float, default=0.9)  # This line remains for compatibility
    args = parser.parse_args()

    layer_sizes_to_test = [8, 16, 32, 64, 128]
    total_runs = len(args.window_sizes) * len(layer_sizes_to_test)
    print(
        f"Starting rolling-window MLP training. Testing {total_runs} runs "
        f"({len(args.window_sizes)} window sizes x {len(layer_sizes_to_test)} architectures)..."
    )

    for window_size in args.window_sizes:
        for size in layer_sizes_to_test:
            train_window_mlp(window_size, size, args.max_iter)


if __name__ == "__main__":
    main()
