import argparse
import csv
import random
from pathlib import Path
import sys
from types import SimpleNamespace
import warnings
import time

import numpy as np
import mlflow

# Add backend to path for imports
BACKEND_DIR = Path(__file__).resolve().parents[1] / "backend"
sys.path.append(str(BACKEND_DIR))

from dijkstra import run_classic_dijkstra  
from dijkstra_prediction import run_prediction_dijkstra
from dijkstra_prediction_windowed import run_prediction_dijkstra_windowed


def generate_erdos_renyi_graph(n, c, f):
    p = c / n
    q = f / n

    nodes = [{"id": str(i)} for i in range(n)]
    start_node = str(random.randint(0, n - 1))

    target_nodes = [str(i) for i in range(n) if random.random() < q and str(i) != start_node]
    if not target_nodes:
        fallback = start_node
        while fallback == start_node:
            fallback = str(random.randint(0, n - 1))
        target_nodes.append(fallback)

    edges = []
    edge_id_counter = 0
    for i in range(n):
        out_degree = np.random.binomial(n - 1, p)
        if out_degree <= 0:
            continue
        possible_targets = [x for x in range(n) if x != i]
        targets = random.sample(possible_targets, out_degree)
        for t in targets:
            weight = random.uniform(0.0, 1.0)
            edges.append({
                "id": f"e{edge_id_counter}",
                "source": str(i),
                "target": str(t),
                "weight": weight,
            })
            edge_id_counter += 1

    return {
        "startNode": start_node,
        "targetNodes": target_nodes,
        "nodes": nodes,
        "edges": edges,
    }


def run_benchmark(
    num_graphs,
    n,
    c,
    f,
    i0,
    alpha,
    beta,
    csv_path,
    model_specs,
    include_windowed=False,
    progress_every=100,
):
    results = []

    run_windowed = None
    if include_windowed:

        run_windowed = run_prediction_dijkstra_windowed

    for idx in range(num_graphs):
        payload = generate_erdos_renyi_graph(n, c, f)
        edge_objs = [SimpleNamespace(**edge) for edge in payload["edges"]]

        classic_start = time.perf_counter()
        classic = run_classic_dijkstra(
            payload["nodes"],
            edge_objs,
            payload["startNode"],
            payload["targetNodes"],
            collect_stats=True,
        )
        classic_elapsed = time.perf_counter() - classic_start
        pred_stats_by_model = {}
        for tag, model_filename in model_specs:
            pred_start = time.perf_counter()
            pred = run_prediction_dijkstra(
                payload["nodes"],
                edge_objs,
                payload["startNode"],
                payload["targetNodes"],
                i0=i0,
                alpha=alpha,
                beta=beta,
                collect_stats=True,
                model_filename=model_filename,
            )
            pred_elapsed = time.perf_counter() - pred_start
            _, _, _, _, _, pred_stats = pred
            pred_stats_by_model[tag] = (pred_stats, pred_elapsed)

        windowed = None
        windowed_elapsed = None
        if include_windowed:
            windowed_start = time.perf_counter()
            windowed = run_windowed(
                payload["nodes"],
                edge_objs,
                payload["startNode"],
                payload["targetNodes"],
                i0=i0,
                alpha=alpha,
                beta=beta,
                collect_stats=True,
            )
            windowed_elapsed = time.perf_counter() - windowed_start

        _, _, _, _, _, classic_stats = classic
        if include_windowed:
            _, _, _, _, _, windowed_stats = windowed

        classic_ops = classic_stats["pq_pushes"] + classic_stats["pq_pops"]
        skipped_ops = None

        row = {
            "classic_pq_pushes": classic_stats["pq_pushes"],
            "classic_pq_pops": classic_stats["pq_pops"],
            "classic_pq_skips": classic_stats["pq_skips"],
            "classic_ops": classic_ops,
            "classic_time_s": classic_elapsed,
        }

        for tag, payload_stats in pred_stats_by_model.items():
            stats, pred_elapsed = payload_stats
            pred_ops = stats["pq_pushes"] + stats["pq_pops"]
            skipped_ops = classic_ops - pred_ops
            row.update({
                f"{tag}_pq_pushes": stats["pq_pushes"],
                f"{tag}_pq_pops": stats["pq_pops"],
                f"{tag}_pq_skips": stats["pq_skips"],
                f"{tag}_r_inserts": stats["r_inserts"],
                f"{tag}_r_rescues": stats["r_rescues"],
                f"{tag}_ops": pred_ops,
                f"{tag}_skipped_ops": skipped_ops,
                f"{tag}_time_s": pred_elapsed,
            })

        if include_windowed:
            windowed_ops = windowed_stats["pq_pushes"] + windowed_stats["pq_pops"]
            windowed_skipped = classic_ops - windowed_ops
            row.update({
                "windowed_pq_pushes": windowed_stats["pq_pushes"],
                "windowed_pq_pops": windowed_stats["pq_pops"],
                "windowed_pq_skips": windowed_stats["pq_skips"],
                "windowed_r_inserts": windowed_stats["r_inserts"],
                "windowed_r_rescues": windowed_stats["r_rescues"],
                "windowed_ops": windowed_ops,
                "windowed_skipped_ops": windowed_skipped,
                "windowed_time_s": windowed_elapsed,
            })

        results.append(row)

        if progress_every > 0:
            current = idx + 1
            if current % progress_every == 0 or current == num_graphs:
                print(f"Processed {current}/{num_graphs} graphs")

    with open(csv_path, mode="w", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=results[0].keys())
        writer.writeheader()
        writer.writerows(results)

    return results


def summarize(results, key):
    values = [r[key] for r in results]
    return {
        "mean": float(np.mean(values)),
        "median": float(np.median(values)),
        "min": float(np.min(values)),
        "max": float(np.max(values)),
    }


def main():
    warnings.filterwarnings(
        "ignore",
        message="X does not have valid feature names, but StandardScaler was fitted with feature names",
        category=UserWarning,
    )
    warnings.filterwarnings(
        "ignore",
        message="The filesystem tracking backend*",
        category=FutureWarning,
    )

    parser = argparse.ArgumentParser()
    parser.add_argument("--num-graphs", type=int, default=10000)
    parser.add_argument("--n", type=int, default=1000)
    parser.add_argument("--c", type=float, default=8)
    parser.add_argument("--f", type=float, default=20)
    parser.add_argument("--i0", type=int, default=10)
    parser.add_argument("--alpha", type=float, default=1.1)
    parser.add_argument("--beta", type=float, default=1.2)
    parser.add_argument(
        "--models",
        type=str,
        default="16x16,8x8,32x32,64x64,128x128",
        help="Comma-separated list of MLP sizes (e.g. 16x16,8x8)",
    )
    parser.add_argument(
        "--xgboost",
        type=str,
        default="fast,medium,deep",
        help="Comma-separated list of XGBoost variants (fast,medium,deep)",
    )
    parser.add_argument("--csv", type=str, default="pq_ops_benchmark.csv")
    parser.add_argument(
        "--progress-every",
        type=int,
        default=100,
        help="Print progress every N graphs (0 to disable)",
    )
    parser.add_argument(
        "--windowed",
        action="store_true",
        help="Include the rolling-window model in the benchmark",
    )
    args = parser.parse_args()
    model_sizes = [part.strip() for part in args.models.split(",") if part.strip()]
    xgboost_variants = [part.strip() for part in args.xgboost.split(",") if part.strip()]
    model_specs = []
    for size in model_sizes:
        model_specs.append((f"mlp_{size}", f"dijkstra_mlp_{size}.joblib"))
    for variant in xgboost_variants:
        model_specs.append((f"xgb_{variant}", f"dijkstra_xgboost_{variant}.joblib"))

    repo_root = Path(__file__).resolve().parents[2]
    mlflow.set_tracking_uri(f"file:{repo_root / 'mlruns'}")
    mlflow.set_experiment("Dijkstra_PQ_Ops")

    csv_path = repo_root / args.csv
    print(f"Starting pq_ops_benchmark for {args.num_graphs} graphs...")
    results = run_benchmark(
        args.num_graphs,
        args.n,
        args.c,
        args.f,
        args.i0,
        args.alpha,
        args.beta,
        csv_path,
        model_specs,
        include_windowed=args.windowed,
        progress_every=args.progress_every,
    )

    with mlflow.start_run(run_name="pq_ops_benchmark"):
        mlflow.log_param("num_graphs", args.num_graphs)
        mlflow.log_param("n", args.n)
        mlflow.log_param("c", args.c)
        mlflow.log_param("f", args.f)
        mlflow.log_param("i0", args.i0)
        mlflow.log_param("alpha", args.alpha)
        mlflow.log_param("beta", args.beta)
        mlflow.log_param("windowed", args.windowed)
        mlflow.log_param("mlp_models", ",".join(model_sizes))
        mlflow.log_param("xgboost_models", ",".join(xgboost_variants))

        metric_keys = ["classic_ops", "classic_time_s"]
        for tag, _ in model_specs:
            metric_keys.extend([
                f"{tag}_ops",
                f"{tag}_skipped_ops",
                f"{tag}_r_inserts",
                f"{tag}_r_rescues",
                f"{tag}_time_s",
            ])
        if args.windowed:
            metric_keys.extend([
                "windowed_ops",
                "windowed_skipped_ops",
                "windowed_r_inserts",
                "windowed_r_rescues",
                "windowed_time_s",
            ])

        for metric_key in metric_keys:
            stats = summarize(results, metric_key)
            mlflow.log_metric(f"{metric_key}_mean", stats["mean"])
            mlflow.log_metric(f"{metric_key}_median", stats["median"])
            mlflow.log_metric(f"{metric_key}_min", stats["min"])
            mlflow.log_metric(f"{metric_key}_max", stats["max"])

        # Cumulative time series (line chart) using index as the step
        classic_total = 0
        model_totals = {tag: 0 for tag, _ in model_specs}
        model_skipped_totals = {tag: 0 for tag, _ in model_specs}
        windowed_total = 0
        windowed_skipped_total = 0
        for idx, row in enumerate(results):
            classic_total += row["classic_ops"]
            mlflow.log_metric("classic_ops_cum", classic_total, step=idx)
            for tag, _ in model_specs:
                model_totals[tag] += row[f"{tag}_ops"]
                model_skipped_totals[tag] += row[f"{tag}_skipped_ops"]
                mlflow.log_metric(f"{tag}_ops_cum", model_totals[tag], step=idx)
                mlflow.log_metric(f"{tag}_skipped_ops_cum", model_skipped_totals[tag], step=idx)
            if args.windowed:
                windowed_total += row["windowed_ops"]
                windowed_skipped_total += row["windowed_skipped_ops"]
                mlflow.log_metric("windowed_ops_cum", windowed_total, step=idx)
                mlflow.log_metric("windowed_skipped_ops_cum", windowed_skipped_total, step=idx)

        mlflow.log_artifact(str(csv_path))

    print(f"Saved CSV to {csv_path}")


if __name__ == "__main__":
    main()
