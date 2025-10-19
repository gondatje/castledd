# DailyDetails Builder

**Goal:** Given a pristine `MASTER Daily Details.xlsx` (template) and an Arrivals Detailed report PDF (any date), produce a finished `Daily Details — YYYY-MM-DD.xlsx` that matches your 10/19 example’s structure/format exactly. Fields missing from the AD remain blank.

## Quick start

```bash
python -m venv .venv && source .venv/bin/activate  # Windows: .venv\\Scripts\\activate
pip install -r requirements.txt
python src/dd_build.py \
  --master ./data/MASTER Daily Details.xlsx \
  --ad ./data/AD_2025-10-19.pdf \
  --out ./out/Daily Details — 2025-10-19.xlsx
```

## Files you provide (drop in `data/`)
- `MASTER Daily Details.xlsx` (the exact master template to clone)
- `AD_YYYY-MM-DD.pdf` (Arrivals Detailed report for any date)
- (optional) `gold/Daily Details — 2025-10-19.xlsx` to act as a regression “gold” for tests

## What’s filled
- Guest names, arrival/departure, nights, room type/number (if present)
- Harvest dinner date/time(s)
- Allergies/dietary, special occasion, transportation notes (black car/helicopter)
- Activities/Spa bookings summarized per day (e.g., “Watsu 60”, “Via Ferrata”)
- Any field not present in AD is left blank

## Robustness to layout changes
- Label‑anchored regex patterns + synonyms (see `config/field_map.yaml`)
- Hybrid extraction: layout‑aware text via pdfplumber; table parse when available; OCR fallback
- Normalizers ensure clean dates/times/titles

## Auditability
- `logs/run_*.jsonl` includes every extraction: field, value, confidence, source snippet

## Hand‑off checklist for Codex
1. Implement missing regex patterns/synonyms in `config/field_map.yaml` from the 10/19 example.
2. Complete `writer.py` column bindings to your MASTER headers (use safe header lookup, not fixed cells).
3. Flesh out `extractors/activities.py` and `extractors/harvest.py` with your canonical title rules.
4. Wire `tests/test_regression.py` to compare output vs. your 10/19 gold file (values only).
5. Add more field validators under `validators.py` as needed.
