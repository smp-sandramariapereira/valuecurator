"""ValueCurator Research Lab: reproducible, research-only relevance classification.

Python standard library only for local JSONL runs. Hugging Face 'datasets' is an
optional import used exclusively for pinned dataset ingestion. No trading code.
"""
from __future__ import annotations

import argparse
from collections import Counter, defaultdict
import hashlib
import json
import math
from pathlib import Path
import re
from typing import Any

TOKENS = re.compile(r"[a-z0-9]+")
LABELS = (0, 1)
SCHEMA_VERSION = "research-relevance-v1"


def canonical(value: Any) -> bytes:
    return json.dumps(value, sort_keys=True, ensure_ascii=False, separators=(",", ":")).encode("utf-8")


def digest(value: Any) -> str:
    return hashlib.sha256(canonical(value)).hexdigest()


def normalize(rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Fail closed on unlabeled/malformed records; deduplicate normalized text.

    Conflicting labels for identical text are rejected, not silently resolved.
    """
    unique: dict[str, dict[str, Any]] = {}
    for item in rows:
        if not isinstance(item, dict):
            raise ValueError("Each dataset record must be an object")
        content = item.get("description")
        label = item.get("label")
        if not isinstance(content, str) or not content.strip():
            raise ValueError("Missing description")
        if type(label) is not int or label not in LABELS:
            raise ValueError("Expected binary integer relevance label 0/1")
        content = " ".join(content.split())
        key = content.casefold()
        timestamp = item.get("published_at")
        if timestamp is not None:
            if not isinstance(timestamp, str) or not re.fullmatch(r"\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?Z", timestamp):
                raise ValueError("published_at must be an ISO-8601 UTC timestamp")
        previous = unique.get(key)
        if previous is not None:
            if previous["label"] != label:
                raise ValueError("Conflicting labels for duplicate description")
            continue
        unique[key] = {"description": content, "label": label, "published_at": timestamp}
    return [unique[key] for key in sorted(unique)]


def split_rows(rows: list[dict[str, Any]], train_ratio: float = 0.75) -> tuple[list[dict[str, Any]], list[dict[str, Any]], str]:
    if not 0 < train_ratio < 1:
        raise ValueError("train_ratio must be between 0 and 1")
    if len(rows) < 4:
        raise ValueError("At least four distinct rows are required")
    timestamps = [x["published_at"] for x in rows]
    if all(timestamps):
        ordered = sorted(rows, key=lambda x: (x["published_at"], x["description"]))
        cut = max(1, min(len(ordered) - 1, int(len(ordered) * train_ratio)))
        train, test = ordered[:cut], ordered[cut:]
        method = "chronological"
    elif not any(timestamps):
        # Deterministically stratify by label to avoid one-class evaluation.
        # This is NOT valid for causal market prediction.
        train, test = [], []
        for label in LABELS:
            group = sorted((x for x in rows if x["label"] == label),
                           key=lambda x: hashlib.sha256(x["description"].casefold().encode()).hexdigest())
            if len(group) < 2:
                raise ValueError("At least two unique records per class required for stratification")
            cut = max(1, min(len(group) - 1, int(len(group) * train_ratio)))
            train.extend(group[:cut])
            test.extend(group[cut:])
        method = "stratified-deterministic-hash-noncausal"
    else:
        raise ValueError("Mixed timestamp availability: refuse ambiguous temporal split")
    return train, test, method


def tokens(text: str) -> list[str]:
    return TOKENS.findall(text.lower())


def train_nb(rows: list[dict[str, Any]]) -> dict[str, Any]:
    counts: dict[int, Counter[str]] = {0: Counter(), 1: Counter()}
    class_count = Counter()
    for record in rows:
        label = record["label"]
        class_count[label] += 1
        counts[label].update(tokens(record["description"]))
    if not all(class_count[label] > 0 for label in LABELS):
        raise ValueError("Training split must contain both relevance classes")
    return {"count": class_count, "tokens": counts, "vocab": set(counts[0]) | set(counts[1])}


def predict(model: dict[str, Any], text: str) -> tuple[int, float]:
    vocab_size = max(1, len(model["vocab"]))
    total = sum(model["count"].values())
    scores: dict[int, float] = {}
    for label in LABELS:
        denominator = sum(model["tokens"][label].values()) + vocab_size
        score = math.log((model["count"][label] + 1) / (total + 2))
        for word in tokens(text):
            if word in model["vocab"]:
                score += math.log((model["tokens"][label][word] + 1) / denominator)
        scores[label] = score
    predicted = max(LABELS, key=lambda label: (scores[label], -label))
    upper = max(scores.values())
    scale = sum(math.exp(score - upper) for score in scores.values())
    confidence = math.exp(scores[predicted] - upper) / scale
    return predicted, round(confidence, 6)


def metrics(y_true: list[int], y_pred: list[int]) -> dict[str, Any]:
    result = {}
    for label in LABELS:
        tp = sum(a == label and b == label for a, b in zip(y_true, y_pred))
        fp = sum(a != label and b == label for a, b in zip(y_true, y_pred))
        fn = sum(a == label and b != label for a, b in zip(y_true, y_pred))
        precision = tp / (tp + fp) if tp + fp else 0.0
        recall = tp / (tp + fn) if tp + fn else 0.0
        f1 = 2 * precision * recall / (precision + recall) if precision + recall else 0.0
        result[str(label)] = {"precision": round(precision, 6), "recall": round(recall, 6), "f1": round(f1, 6), "support": sum(v == label for v in y_true)}
    return {"accuracy": round(sum(a == b for a, b in zip(y_true, y_pred)) / len(y_true), 6),
            "macro_f1": round(sum(result[str(label)]["f1"] for label in LABELS) / len(LABELS), 6),
            "by_class": result}


def catalog_tickers(path: Path) -> dict[str, str]:
    data = json.loads(path.read_text(encoding="utf-8"))
    if data.get("schemaVersion") != 1 or not isinstance(data.get("assets"), list):
        raise ValueError("Invalid asset registry schema")
    result: dict[str, str] = {}
    for entry in data["assets"]:
        ticker, asset_id = entry["ticker"], entry["assetId"]
        if not isinstance(ticker, str) or not re.fullmatch(r"[A-Z0-9.]{2,20}", ticker):
            raise ValueError("Invalid catalog ticker")
        if ticker in result or not isinstance(asset_id, str):
            raise ValueError("Duplicate or invalid catalog identity")
        result[ticker] = asset_id
    return result


def mentioned(text: str, ticker_map: dict[str, str]) -> list[str]:
    # Conservative mapping: only explicit uppercase ticker/cashtag references.
    # Company-name entity linking is deliberately deferred to a reviewed module.
    return [asset_id for ticker, asset_id in sorted(ticker_map.items()) if re.search(
        r"(?<![A-Za-z0-9])\$?" + re.escape(ticker) + r"(?![A-Za-z0-9])", text
    )]


def run(rows: list[dict[str, Any]], dataset_id: str, revision: str, catalog_path: Path) -> dict[str, Any]:
    if not dataset_id.strip() or not revision.strip() or revision.lower() in {"main", "latest", "master"}:
        raise ValueError("Pin a concrete immutable dataset revision or local snapshot SHA")
    if not re.fullmatch(r"[A-Za-z0-9._/:-]{4,200}", revision):
        raise ValueError("Invalid revision")
    clean = normalize(rows)
    train, test, method = split_rows(clean)
    model = train_nb(train)
    ticker_map = catalog_tickers(catalog_path)
    predictions = [predict(model, rec["description"]) for rec in test]
    scores = metrics([rec["label"] for rec in test], [p[0] for p in predictions])
    majority = max(LABELS, key=lambda label: (model["count"][label], -label))
    baseline = metrics([rec["label"] for rec in test], [majority] * len(test))
    asset_counts: dict[str, dict[str, int]] = defaultdict(lambda: {"mentions": 0, "predicted_relevant": 0})
    for rec, (label, _) in zip(test, predictions):
        for asset_id in mentioned(rec["description"], ticker_map):
            asset_counts[asset_id]["mentions"] += 1
            asset_counts[asset_id]["predicted_relevant"] += int(label == 1)
    parameters = {
        "class_counts": {str(k): model["count"][k] for k in LABELS},
        "tokens": {str(k): sorted(model["tokens"][k].items()) for k in LABELS}
    }
    return {
        "schema_version": SCHEMA_VERSION, "mode": "RESEARCH_ONLY",
        "dataset": {"id": dataset_id, "revision": revision, "snapshot_sha256": digest(clean),
                    "rows_after_dedup": len(clean)},
        "experiment": {"split": method, "train_count": len(train), "test_count": len(test),
                       "model": "multinomial_naive_bayes_laplace_1",
                       "model_sha256": digest(parameters), "evaluation": scores, "majority_baseline": baseline},
        "per_asset": [{"asset_id": key, **asset_counts[key], "proposed_action": "NONE",
                       "authorized": False} for key in sorted(asset_counts)],
        "execution": {"allowed": False, "reason": "Research evidence is not a trading approval or settlement quote"}
    }


def load_rows(args: argparse.Namespace) -> list[dict[str, Any]]:
    if args.input:
        return [json.loads(line) for line in Path(args.input).read_text(encoding="utf-8").splitlines() if line.strip()]
    if not args.hf_id or not args.hf_revision:
        raise ValueError("Hugging Face ingestion requires both dataset ID and pinned revision")
    try:
        from datasets import load_dataset
    except ImportError as exc:
        raise RuntimeError("Install 'datasets' to use Hugging Face; offline JSONL requires no dependency") from exc
    dataset = load_dataset(args.hf_id, split=args.hf_split, revision=args.hf_revision, trust_remote_code=False)
    return [{"description": x["description"], "label": x["label"],
             "published_at": x.get("published_at")} for x in dataset]


def main() -> None:
    parser = argparse.ArgumentParser(description="Versioned financial news relevance research (no trades)")
    source = parser.add_mutually_exclusive_group(required=True)
    source.add_argument("--input", help="Local JSONL with description, label and optional published_at")
    source.add_argument("--hf-id", help="Hugging Face dataset ID, e.g. XA7/News-dataset-for-Stock-Market-news-classification")
    parser.add_argument("--hf-revision", help="Immutable Hugging Face revision (commit SHA)")
    parser.add_argument("--hf-split", default="train")
    parser.add_argument("--dataset-id", help="Local dataset identity; required for --input")
    parser.add_argument("--revision", help="Local snapshot SHA/version; required for --input")
    parser.add_argument("--catalog", default=str(Path(__file__).resolve().parents[1] / "web/data/asset-catalog.json"))
    parser.add_argument("--output", required=True, help="Research-only JSON report")
    args = parser.parse_args()
    rows = load_rows(args)
    dataset_id = args.dataset_id if args.input else args.hf_id
    revision = args.revision if args.input else args.hf_revision
    if not dataset_id or not revision:
        parser.error("--input requires --dataset-id and --revision")
    report = run(rows, dataset_id, revision, Path(args.catalog))
    output = Path(args.output)
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_bytes(canonical(report) + b"\n")
    print(f"RESEARCH_ONLY rows={report['dataset']['rows_after_dedup']} macro_f1={report['experiment']['evaluation']['macro_f1']}")
    print(f"Report: {output}")


if __name__ == "__main__":
    main()
