
from dataclasses import dataclass
from typing import List, Dict, Any
from pathlib import Path

import pdfplumber
import regex as re
import yaml

@dataclass
class FieldHit:
    field: str
    value: str
    confidence: float
    snippet: str

# Very simple label-anchored pull. Codex should expand with table + OCR passes.
def extract_from_pdf(pdf_path: str, config_path: str):
    cfg = yaml.safe_load(Path(config_path).read_text(encoding="utf-8"))
    compiled = {k: [re.compile(pat, re.I) for pat in v.get("labels", [])] for k, v in cfg["fields"].items()}
    runlog = []

    blocks = []
    with pdfplumber.open(pdf_path) as pdf:
        for page in pdf.pages:
            text = page.extract_text(x_tolerance=2, y_tolerance=2) or ""
            blocks.append(text)

    full = "\n".join(blocks)

    record: Dict[str, Any] = {}
    for field, patterns in compiled.items():
        # Heuristic: label followed by colon or newline, then capture up to line end
        val = None
        best_snippet = ""
        for pat in patterns:
            for m in re.finditer(rf"({pat.pattern}).{0,40}?[:\-]?\s*(.+)$", full, re.I | re.M):
                candidate = m.group(2).strip()
                if candidate:
                    val = candidate
                    best_snippet = m.group(0)[:200]
                    break
            if val:
                break
        if val:
            record[field] = val
            runlog.append({"field": field, "value": val, "confidence": 0.7, "snippet": best_snippet})

    # TODO: split into multiple guest records if AD contains many – Codex to implement.
    return [record], runlog
