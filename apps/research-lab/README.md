# ValueCurator Research Lab — Stage 2

Research-only baseline for financial **news relevance** classification. The XA7 labels must not be reinterpreted as positive/neutral/negative sentiment or future returns. A separate licensed sentiment dataset and explicit label semantics will be needed for sentiment studies.

## Reproducible experiment

Python 3.10+ and standard library are sufficient for local JSONL. Dataset records must include:
- \`description\`: nonempty text.
- \`label\`: binary integer 0 or 1, **relevance classification only**.
- \`published_at\` (optional): ISO-8601 UTC timestamp for every row if using temporal split.

Run offline tests (requires the sibling \`apps/web/data/asset-catalog.json\` file):

\`\`\`bash
python -m unittest discover -s apps/research-lab/tests -v
\`\`\`

Run a local JSONL experiment (do not commit downloaded personal data or vendor datasets):

\`\`\`bash
python apps/research-lab/pipeline.py \
  --input /path/to/rights-cleared-news.jsonl \
  --dataset-id local/financial-news \
  --revision pinned-snapshot-sha \
  --output /tmp/valuecurator-research-report.json
\`\`\`

Hugging Face is optional, and **must** use a pinned commit SHA/revision:

\`\`\`bash
python -m pip install datasets
python apps/research-lab/pipeline.py \
  --hf-id XA7/News-dataset-for-Stock-Market-news-classification \
  --hf-revision <exact-dataset-commit-sha> \
  --hf-split train \
  --output /tmp/valuecurator-xa7-evaluation.json
\`\`\`

Verify dataset license, feature definitions, rater agreement, label meanings, revision, coverage and permission before use. The provided Hugging Face example is a configuration, **not** a claim that downloading or training was performed. Never commit proprietary/raw data or access tokens.

## Methodology and limitations

1. Normalize text and strictly validate binary labels; remove exact duplicates and reject contradictory labels.
2. Split chronologically only if timestamps are present for every record. Without timestamps, deterministic hash split is used **solely** to benchmark classification, **not** price prediction.
3. Train a transparent multinomial Naive Bayes relevance classifier; compare to a majority-class baseline.
4. Report accuracy, macro-F1, per-class precision/recall/F1, number of records and SHA-256 hashes of the normalized snapshot/model parameters.
5. Attribute news to catalog assets only when a ticker/cashtag appears explicitly. Ambiguous company-name entity linking is deliberately not inferred.
6. Export per-asset **research counts**, not BUY/SELL/HOLD orders. All results are marked \`RESEARCH_ONLY\`, \`authorized: false\`, and \`execution.allowed: false\`.

This baseline does not calibrate probabilities, guarantee class labels match the publisher's meanings, supply market pricing, validate sentiment, backtest financial performance or transact on-chain.

## Next integration gate

The future ProofGate adapter must parse a versioned research envelope, separately verify dataset provenance and historical timestamps, perform risk/asset authorization, and generate a new signed proposal. It must **never** treat the Research Lab output as a valid transaction authorization.
