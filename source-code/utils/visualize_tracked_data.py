import matplotlib.pyplot as plt
import numpy as np
import seaborn as sns
import pandas as pd
from pathlib import Path


def _plot_comparison(
    labels,
    values,
    classic_value,
    title,
    ylabel,
    output_path,
    value_format="{value:.1f}",
    show_classic=True,
):
    x = np.arange(len(labels))
    width = 0.6

    fig, ax = plt.subplots(figsize=(10, 6))
    ax.grid(axis="y", alpha=0.3)
    ax.set_axisbelow(True)

    bars = ax.bar(
        x,
        values,
        width,
        color=sns.color_palette("Set2")[0],
        edgecolor='none',
        label='Mean',
    )

    if show_classic and classic_value is not None:
        ax.axhline(
            y=classic_value,
            color=sns.color_palette("Set2")[2],
            linestyle='--',
            linewidth=2,
            label='Classic Dijkstra',
        )

    ax.set_ylabel(ylabel)
    ax.set_title(title)
    ax.set_xticks(x)
    ax.set_xticklabels(labels)
    if show_classic:
        ax.legend(loc='upper right', frameon=True)
    baseline = classic_value if classic_value is not None else 0
    ax.set_ylim(0, max(values + [baseline]) * 1.15)

    for bar, value in zip(bars, values):
        ax.annotate(
            value_format.format(value=value),
            xy=(bar.get_x() + bar.get_width() / 2, value),
            xytext=(0, 6),
            textcoords="offset points",
            ha='center',
            va='bottom',
            fontsize=10,
            weight='bold',
        )

    plt.tight_layout()
    fig.savefig(output_path, dpi=300)
    plt.close(fig)


def _plot_ops_line(
    steps,
    classic_ops,
    mlp_ops,
    title,
    ylabel,
    output_path,
    cumulative=False,
):
    fig, ax = plt.subplots(figsize=(10, 6))
    ax.grid(axis="y", alpha=0.3)
    ax.set_axisbelow(True)

    if cumulative:
        classic_series = np.cumsum(classic_ops)
        mlp_series = np.cumsum(mlp_ops)
    else:
        classic_series = classic_ops
        mlp_series = mlp_ops

    ax.plot(steps, classic_series, label="Classic Dijkstra", linewidth=1.5)
    ax.plot(steps, mlp_series, label="MLP 16x16", linewidth=1.5)

    ax.set_xlabel("Graph Index")
    ax.set_ylabel(ylabel)
    ax.set_title(title)
    ax.legend(loc="upper right", frameon=True)

    plt.tight_layout()
    fig.savefig(output_path, dpi=300)
    plt.close(fig)


def plot_benchmark_results(csv_path, output_dir):
    sns.set_theme(style="whitegrid", context="talk")

    df = pd.read_csv(csv_path)
    output_dir = Path(output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    classic_ops_mean = float(df["classic_ops"].mean())
    classic_skipped_mean = float(df["classic_pq_skips"].mean())
    classic_time_ms = float(df["classic_time_s"].mean()) * 1000

    mlp_sizes = ["8x8", "16x16", "32x32", "64x64", "128x128"]
    mlp_ops_mean = [float(df[f"mlp_{size}_ops"].mean()) for size in mlp_sizes]
    mlp_skipped_mean = [float(df[f"mlp_{size}_skipped_ops"].mean()) for size in mlp_sizes]
    mlp_time_ms = [float(df[f"mlp_{size}_time_s"].mean()) * 1000 for size in mlp_sizes]
    mlp_r_inserts_mean = [float(df[f"mlp_{size}_r_inserts"].mean()) for size in mlp_sizes]
    mlp_r_rescues_mean = [float(df[f"mlp_{size}_r_rescues"].mean()) for size in mlp_sizes]

    _plot_comparison(
        mlp_sizes,
        mlp_ops_mean,
        classic_ops_mean,
        "Dijkstra-Prediction (MLP) vs Classic Dijkstra Operations",
        "Average Priority Queue Operations",
        output_dir / "mlp_ops_comparison.png",
    )

    mlp16_ops_mean = float(df["mlp_16x16_ops"].mean())
    mlp16_time_ms = float(df["mlp_16x16_time_s"].mean()) * 1000
    classic_vs_mlp_labels = ["Classic", "MLP 16x16"]

    _plot_comparison(
        classic_vs_mlp_labels,
        [classic_ops_mean, mlp16_ops_mean],
        None,
        "Classic vs MLP 16x16 Operations",
        "Average Priority Queue Operations",
        output_dir / "classic_vs_mlp16_ops.png",
        show_classic=False,
    )

    _plot_comparison(
        classic_vs_mlp_labels,
        [classic_time_ms, mlp16_time_ms],
        None,
        "Classic vs MLP 16x16 Runtime",
        "Average Runtime (ms)",
        output_dir / "classic_vs_mlp16_time.png",
        value_format="{value:.2f}",
        show_classic=False,
    )

    _plot_comparison(
        mlp_sizes,
        mlp_skipped_mean,
        classic_skipped_mean,
        "Dijkstra-Prediction (MLP) vs Classic Dijkstra Skipped Ops",
        "Average Skipped Queue Operations",
        output_dir / "mlp_skipped_ops_comparison.png",
    )

    _plot_comparison(
        mlp_sizes,
        mlp_time_ms,
        classic_time_ms,
        "Dijkstra-Prediction (MLP) vs Classic Dijkstra Runtime",
        "Average Runtime (ms)",
        output_dir / "mlp_time_comparison.png",
        value_format="{value:.2f}",
    )

    _plot_comparison(
        mlp_sizes,
        mlp_r_inserts_mean,
        0.0,
        "Dijkstra-Prediction (MLP) Reserve Inserts",
        "Average Reserve Inserts",
        output_dir / "mlp_r_inserts_comparison.png",
        show_classic=False,
    )

    _plot_comparison(
        mlp_sizes,
        mlp_r_rescues_mean,
        0.0,
        "Dijkstra-Prediction (MLP) Reserve Rescues",
        "Average Reserve Rescues",
        output_dir / "mlp_r_rescues_comparison.png",
        show_classic=False,
    )

    xgb_variants = ["fast", "medium", "deep"]
    xgb_labels = [f"XGB {variant}" for variant in xgb_variants]
    xgb_ops_mean = [float(df[f"xgb_{variant}_ops"].mean()) for variant in xgb_variants]
    xgb_skipped_mean = [float(df[f"xgb_{variant}_skipped_ops"].mean()) for variant in xgb_variants]
    xgb_time_ms = [float(df[f"xgb_{variant}_time_s"].mean()) * 1000 for variant in xgb_variants]
    xgb_r_inserts_mean = [float(df[f"xgb_{variant}_r_inserts"].mean()) for variant in xgb_variants]
    xgb_r_rescues_mean = [float(df[f"xgb_{variant}_r_rescues"].mean()) for variant in xgb_variants]

    _plot_comparison(
        xgb_labels,
        xgb_ops_mean,
        classic_ops_mean,
        "Dijkstra-Prediction (XGBoost) vs Classic Dijkstra Operations",
        "Average Priority Queue Operations",
        output_dir / "xgb_ops_comparison.png",
    )

    _plot_comparison(
        xgb_labels,
        xgb_skipped_mean,
        classic_skipped_mean,
        "Dijkstra-Prediction (XGBoost) vs Classic Dijkstra Skipped Ops",
        "Average Skipped Queue Operations",
        output_dir / "xgb_skipped_ops_comparison.png",
    )

    _plot_comparison(
        xgb_labels,
        xgb_time_ms,
        classic_time_ms,
        "Dijkstra-Prediction (XGBoost) vs Classic Dijkstra Runtime",
        "Average Runtime (ms)",
        output_dir / "xgb_time_comparison.png",
        value_format="{value:.2f}",
    )

    _plot_comparison(
        xgb_labels,
        xgb_r_inserts_mean,
        0.0,
        "Dijkstra-Prediction (XGBoost) Reserve Inserts",
        "Average Reserve Inserts",
        output_dir / "xgb_r_inserts_comparison.png",
        show_classic=False,
    )

    _plot_comparison(
        xgb_labels,
        xgb_r_rescues_mean,
        0.0,
        "Dijkstra-Prediction (XGBoost) Reserve Rescues",
        "Average Reserve Rescues",
        output_dir / "xgb_r_rescues_comparison.png",
        show_classic=False,
    )

    steps = np.arange(1, len(df) + 1)
    _plot_ops_line(
        steps,
        df["classic_ops"].to_numpy(),
        df["mlp_16x16_ops"].to_numpy(),
        "Classic vs MLP 16x16 Cumulative PQ Ops",
        "Cumulative Priority Queue Operations",
        output_dir / "classic_vs_mlp16_ops_cum_line.png",
        cumulative=True,
    )


if __name__ == "__main__":
    repo_root = Path(__file__).resolve().parents[2]
    csv_path = repo_root / "data" / "csv" / "pq_ops_benchmark.csv"
    output_dir = repo_root / "data" / "plots"
    plot_benchmark_results(csv_path, output_dir)