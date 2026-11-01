import importlib.util
import json
from pathlib import Path
import sys
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("research_pipeline", ROOT / "pipeline.py")
pipeline = importlib.util.module_from_spec(spec)
sys.modules[spec.name] = pipeline
spec.loader.exec_module(pipeline)

CATALOG = ROOT.parent / "web" / "data" / "asset-catalog.json"


def dataset():
    return [
        {"description": "AAPL quarterly earnings market equity revenue", "label": 1},
        {"description": "NVDA chipmaker stock shares results", "label": 1},
        {"description": "TSLA shares analyst exchange traded stock", "label": 1},
        {"description": "MSFT financial results corporate earnings", "label": 1},
        {"description": "AAPL equity market guidance outlook", "label": 1},
        {"description": "NVDA share price stock exchange", "label": 1},
        {"description": "TSLA stock trading volumes", "label": 1},
        {"description": "MSFT company quarterly shareholder report", "label": 1},
        {"description": "Garden recipes and family dinner", "label": 0},
        {"description": "The football team scored a goal", "label": 0},
        {"description": "Travel guide for mountain landscapes", "label": 0},
        {"description": "A concert review and musical instruments", "label": 0},
        {"description": "Dogs and cats in the public park", "label": 0},
        {"description": "A new restaurant opened downtown", "label": 0},
        {"description": "Weekend weather and outdoor activities", "label": 0},
        {"description": "Painting techniques for new artists", "label": 0},
    ]


class ResearchLabTests(unittest.TestCase):
    def test_reproducibility_independent_of_row_order(self):
        rows = dataset()
        a = pipeline.run(rows, "fixture/news", "fixture-sha256-001", CATALOG)
        b = pipeline.run(list(reversed(rows)), "fixture/news", "fixture-sha256-001", CATALOG)
        self.assertEqual(a, b)
        self.assertEqual(a["mode"], "RESEARCH_ONLY")
        self.assertFalse(a["execution"]["allowed"])
        self.assertTrue(all(x["proposed_action"] == "NONE" for x in a["per_asset"]))

    def test_conflicting_duplicate_labels_fail_closed(self):
        with self.assertRaisesRegex(ValueError, "Conflicting labels"):
            pipeline.normalize([{"description":"same news", "label":0}, {"description":" SAME  NEWS ", "label":1}])

    def test_timestamp_split_and_mixed_rejection(self):
        rows = [{**row, "published_at": f"2025-01-{i+1:02d}T10:00:00Z"} for i,row in enumerate(dataset())]
        a,b,method = pipeline.split_rows(pipeline.normalize(rows))
        self.assertEqual(method, "chronological")
        self.assertLess(a[-1]["published_at"], b[0]["published_at"])
        rows[0].pop("published_at")
        with self.assertRaisesRegex(ValueError, "Mixed timestamp"):
            pipeline.split_rows(pipeline.normalize(rows))

    def test_labels_not_sentiment_and_no_execution(self):
        report = pipeline.run(dataset(), "fixture/news", "pinned-v1", CATALOG)
        self.assertIn("macro_f1", report["experiment"]["evaluation"])
        self.assertEqual(report["experiment"]["model"], "multinomial_naive_bayes_laplace_1")
        self.assertNotIn("BUY", json.dumps(report))
        self.assertNotIn("SELL", json.dumps(report))

    def test_invalid_revision_or_labels(self):
        with self.assertRaisesRegex(ValueError, "Pin a concrete"):
            pipeline.run(dataset(), "fixture/news", "latest", CATALOG)
        with self.assertRaises(ValueError):
            pipeline.normalize([{"description":"AAPL results","label":True}])

    def test_asset_mapping_conservative(self):
        tickers = pipeline.catalog_tickers(CATALOG)
        self.assertIn("equity:US:AAPL", pipeline.mentioned("AAPL stock is mentioned", tickers))
        self.assertEqual(pipeline.mentioned("apple pies are delicious", tickers), [])
        self.assertEqual(pipeline.mentioned("AAPLx token", tickers), [])

    def test_local_jsonl_input(self):
        with tempfile.TemporaryDirectory() as temp:
            path = Path(temp) / "news.jsonl"
            path.write_text("\n".join(json.dumps(row) for row in dataset()), encoding="utf-8")
            args = type("Args", (), {"input": str(path), "hf_id": None, "hf_revision": None})()
            self.assertEqual(len(pipeline.load_rows(args)), 16)


if __name__ == "__main__":
    unittest.main()
