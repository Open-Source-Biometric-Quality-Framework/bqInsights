#!/usr/bin/env python3
import argparse
import sys
import numpy as np
import pandas as pd
from sklearn.preprocessing import StandardScaler
from sklearn.decomposition import PCA
from sklearn.cluster import DBSCAN
from sklearn.cluster import MiniBatchKMeans
import umap
import hdbscan


def log(msg: str) -> None:
    print(f"[py-umap] {msg}", flush=True)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="UMAP + clustering CSV pipeline")
    parser.add_argument("--input", required=True, help="Input CSV path")
    parser.add_argument("--output", required=True, help="Output CSV path")
    parser.add_argument("--cluster-algo", choices=["dbscan", "hdbscan"], default="dbscan")
    parser.add_argument("--umap-n-neighbors", type=int, default=15)
    parser.add_argument("--umap-min-dist", type=float, default=0.3)
    parser.add_argument("--dbscan-eps", type=float, default=0.6)
    parser.add_argument("--dbscan-min-samples", type=int, default=10)
    parser.add_argument("--max-dbscan-points", type=int, default=120000)
    parser.add_argument("--kmeans-clusters", type=int, default=0)
    parser.add_argument("--hdbscan-min-cluster-size", type=int, default=20)
    parser.add_argument("--hdbscan-min-samples", type=int, default=20)
    parser.add_argument("--pca-components", type=int, default=0)
    parser.add_argument("--numeric-columns", default="", help="Comma-separated numeric column names")
    return parser.parse_args()


def choose_numeric_columns(df: pd.DataFrame, arg: str) -> list[str]:
    if arg.strip():
        requested = [c.strip() for c in arg.split(",") if c.strip()]
        available = [c for c in requested if c in df.columns]
        if not available:
            raise ValueError("No requested numeric columns found in CSV")
        return available
    return df.select_dtypes(include=["number"]).columns.tolist()


def main() -> int:
    args = parse_args()
    log(f"Loading CSV: {args.input}")
    df = pd.read_csv(args.input)
    if df.empty:
        raise ValueError("Input CSV has no rows")

    numeric_cols = choose_numeric_columns(df, args.numeric_columns)
    if not numeric_cols:
        raise ValueError("No numeric columns available for embedding")

    log(f"Using {len(numeric_cols)} numeric columns")
    df[numeric_cols] = df[numeric_cols].fillna(0)
    X = df[numeric_cols].replace([np.inf, -np.inf], np.nan)
    medians = X.median(numeric_only=True)
    X = X.fillna(medians).fillna(0.0).to_numpy(dtype=np.float32)

    log("Scaling features")
    X_scaled = StandardScaler().fit_transform(X).astype(np.float32, copy=False)

    row_count = X_scaled.shape[0]
    dim_count = X_scaled.shape[1]
    pca_components = int(args.pca_components)
    if pca_components <= 0 and row_count >= 50000 and dim_count > 12:
        pca_components = min(12, dim_count)

    if pca_components > 0 and pca_components < dim_count:
        log(f"Running PCA pre-reduction to {pca_components} components")
        X_scaled = PCA(
            n_components=pca_components,
            svd_solver="randomized",
            random_state=42,
        ).fit_transform(X_scaled).astype(np.float32, copy=False)

    n_neighbors = int(args.umap_n_neighbors)
    if n_neighbors <= 0:
        n_neighbors = 15
    log(
        f"Running UMAP (n_neighbors={n_neighbors}, min_dist={args.umap_min_dist}, low_memory=True)"
    )
    reducer = umap.UMAP(
        n_components=2,
        n_neighbors=max(2, n_neighbors),
        min_dist=max(0.0, args.umap_min_dist),
        metric="euclidean",
        low_memory=True,
        random_state=42,
    )
    embedding = reducer.fit_transform(X_scaled).astype(np.float32, copy=False)

    if args.cluster_algo == "hdbscan":
        log(
            "Running HDBSCAN "
            f"(min_cluster_size={args.hdbscan_min_cluster_size}, "
            f"min_samples={args.hdbscan_min_samples})"
        )
        cluster_labels = hdbscan.HDBSCAN(
            min_cluster_size=max(2, args.hdbscan_min_cluster_size),
            min_samples=max(1, args.hdbscan_min_samples),
            cluster_selection_method="leaf",
            metric="euclidean",
        ).fit_predict(embedding)
    else:
        max_dbscan_points = max(1, int(args.max_dbscan_points))
        if embedding.shape[0] > max_dbscan_points:
            n_samples = int(embedding.shape[0])
            k = int(args.kmeans_clusters)
            if k <= 1:
                # Conservative automatic cluster count for very large datasets.
                k = max(8, min(256, int(np.sqrt(n_samples / 2.0))))
            log(
                f"Dataset too large for DBSCAN ({n_samples} > {max_dbscan_points}); "
                f"using MiniBatchKMeans fallback (k={k})"
            )
            cluster_labels = MiniBatchKMeans(
                n_clusters=k,
                random_state=42,
                batch_size=8192,
                n_init="auto",
            ).fit_predict(embedding)
        else:
            log(
                f"Running DBSCAN (eps={args.dbscan_eps}, min_samples={args.dbscan_min_samples})"
            )
            cluster_labels = DBSCAN(
                eps=max(1e-6, args.dbscan_eps),
                min_samples=max(1, args.dbscan_min_samples),
                metric="euclidean",
            ).fit_predict(embedding)

    out_df = df.copy()
    out_df["umap_x"] = embedding[:, 0]
    out_df["umap_y"] = embedding[:, 1]
    out_df["cluster"] = cluster_labels

    cluster_count = len(set([int(c) for c in cluster_labels if int(c) >= 0]))
    noise_count = int(np.sum(cluster_labels < 0))
    log(f"Clusters: {cluster_count}, noise points: {noise_count}")

    log(f"Writing output CSV: {args.output}")
    out_df.to_csv(args.output, index=False)
    log("Pipeline complete")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as exc:
        print(f"[py-umap][error] {exc}", file=sys.stderr, flush=True)
        raise
