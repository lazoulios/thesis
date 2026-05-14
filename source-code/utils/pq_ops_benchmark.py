import argparse
import csv
import random
from pathlib import Path
import sys
from types import SimpleNamespace

import numpy as np
import mlflow

# Add backend to path for imports
BACKEND_DIR = Path(__file__).resolve().parents[1] / "backend"
sys.path.append(str(BACKEND_DIR))

from dijkstra import run_classic_dijkstra  
from dijkstra_prediction import run_prediction_dijkstra  


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


def run_benchmark(num_graphs, n, c, f, i0, alpha, beta, csv_path):
    results = []

    for _ in range(num_graphs):
        payload = generate_erdos_renyi_graph(n, c, f)
        edge_objs = [SimpleNamespace(**edge) for edge in payload["edges"]]

        classic = run_classic_dijkstra(
            payload["nodes"],
            edge_objs,
            payload["startNode"],
            payload["targetNodes"],
            collect_stats=True,
        )
        pred = run_prediction_dijkstra(
            payload["nodes"],
            edge_objs,
            payload["startNode"],
            payload["targetNodes"],
            i0=i0,
            alpha=alpha,
            beta=beta,
            collect_stats=True,
        )

        _, _, _, _, _, classic_stats = classic
        _, _, _, _, _, pred_stats = pred

        classic_ops = classic_stats["pq_pushes"] + classic_stats["pq_pops"]
        pred_ops = pred_stats["pq_pushes"] + pred_stats["pq_pops"]
        skipped_ops = classic_ops - pred_ops

        results.append({
            "classic_pq_pushes": classic_stats["pq_pushes"],
            "classic_pq_pops": classic_stats["pq_pops"],
            "classic_pq_skips": classic_stats["pq_skips"],
            "pred_pq_pushes": pred_stats["pq_pushes"],
            "pred_pq_pops": pred_stats["pq_pops"],
            "pred_pq_skips": pred_stats["pq_skips"],
            "pred_r_inserts": pred_stats["r_inserts"],
            "pred_r_rescues": pred_stats["r_rescues"],
            "classic_ops": classic_ops,
            "pred_ops": pred_ops,
            "skipped_ops": skipped_ops,
        })

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
    parser = argparse.ArgumentParser()
    parser.add_argument("--num-graphs", type=int, default=100)
    parser.add_argument("--n", type=int, default=200)
    parser.add_argument("--c", type=float, default=8)
    parser.add_argument("--f", type=float, default=20)
    parser.add_argument("--i0", type=int, default=10)
    parser.add_argument("--alpha", type=float, default=1.1)
    parser.add_argument("--beta", type=float, default=1.2)
    parser.add_argument("--csv", type=str, default="pq_ops_benchmark.csv")
    args = parser.parse_args()

    repo_root = Path(__file__).resolve().parents[2]
    mlflow.set_tracking_uri(f"file:{repo_root / 'mlruns'}")
    mlflow.set_experiment("Dijkstra_PQ_Ops")

    csv_path = repo_root / args.csv
    results = run_benchmark(args.num_graphs, args.n, args.c, args.f, args.i0, args.alpha, args.beta, csv_path)

    with mlflow.start_run(run_name="pq_ops_benchmark"):
        mlflow.log_param("num_graphs", args.num_graphs)
        mlflow.log_param("n", args.n)
        mlflow.log_param("c", args.c)
        mlflow.log_param("f", args.f)
        mlflow.log_param("i0", args.i0)
        mlflow.log_param("alpha", args.alpha)
        mlflow.log_param("beta", args.beta)

        for metric_key in [
            "classic_ops",
            "pred_ops",
            "skipped_ops",
            "pred_r_inserts",
            "pred_r_rescues",
        ]:
            stats = summarize(results, metric_key)
            mlflow.log_metric(f"{metric_key}_mean", stats["mean"])
            mlflow.log_metric(f"{metric_key}_median", stats["median"])
            mlflow.log_metric(f"{metric_key}_min", stats["min"])
            mlflow.log_metric(f"{metric_key}_max", stats["max"])

        # Cumulative time series (line chart) using index as the step
        classic_total = 0
        pred_total = 0
        skipped_total = 0
        for idx, row in enumerate(results):
            classic_total += row["classic_ops"]
            pred_total += row["pred_ops"]
            skipped_total += row["skipped_ops"]
            mlflow.log_metric("classic_ops_cum", classic_total, step=idx)
            mlflow.log_metric("pred_ops_cum", pred_total, step=idx)
            mlflow.log_metric("skipped_ops_cum", skipped_total, step=idx)

        mlflow.log_artifact(str(csv_path))

    print(f"Saved CSV to {csv_path}")


if __name__ == "__main__":
    main()
