from dataclasses import dataclass
from typing import List, Dict, Any, Tuple
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

ARRIVAL_PATTERN = re.compile(r"(arrival(?: date)?|check[ \-–]?in)", re.I)
DEPARTURE_PATTERN = re.compile(r"(departure(?: date)?|check[ \-–]?out)", re.I)
LABEL_VALUE_SEPARATOR = r"[\s.\-–:]{0,20}"


def normalize_text(s: str) -> str:
    if not s:
        return ""
    normalized = s.replace("\r\n", "\n").replace("\r", "\n")
    lines = []
    for line in normalized.split("\n"):
        collapsed = re.sub(r"[\t\u00a0]+", " ", line)
        collapsed = re.sub(r"\s+$", "", collapsed)
        lines.append(collapsed)
    return "\n".join(lines)


def split_into_blocks(full_text: str) -> List[str]:
    if not full_text:
        return []
    raw_blocks = re.split(r"\n{2,}", full_text)
    blocks: List[str] = []
    for block in raw_blocks:
        trimmed = block.strip()
        if trimmed and len(trimmed) >= 40:
            blocks.append(trimmed)
    return blocks


def is_reservation_block(block: str) -> bool:
    if not block:
        return False
    return bool(ARRIVAL_PATTERN.search(block)) and bool(DEPARTURE_PATTERN.search(block))


def _clean_value(value: str) -> str:
    cleaned = value.strip()
    cleaned = cleaned.rstrip(".,;")
    return cleaned.strip()


def _next_line_capture(lines: List[str], pat: re.Pattern) -> Tuple[str, str]:
    for idx, line in enumerate(lines):
        if pat.search(line):
            if idx + 1 < len(lines):
                candidate = _clean_value(lines[idx + 1])
                if candidate:
                    snippet = f"{line.strip()}\n{lines[idx + 1].strip()}"
                    return candidate, snippet
    return "", ""


def extract_fields_from_block(
    block: str, compiled_patterns: Dict[str, List[re.Pattern]]
) -> Tuple[Dict[str, Any], List[Dict[str, Any]]]:
    record: Dict[str, Any] = {}
    hits: List[Dict[str, Any]] = []
    lines = block.splitlines()

    for field, patterns in compiled_patterns.items():
        value = None
        snippet = ""
        for pat in patterns:
            label_value_regex = re.compile(
                rf"({pat.pattern}){LABEL_VALUE_SEPARATOR}(.+)$", re.I | re.M
            )
            match = label_value_regex.search(block)
            if match:
                candidate = _clean_value(match.group(2))
                if candidate:
                    value = candidate
                    snippet = match.group(0).strip()
                    break

            candidate, candidate_snippet = _next_line_capture(lines, pat)
            if candidate:
                value = candidate
                snippet = candidate_snippet
                break

        if value:
            record[field] = value
            hits.append(
                {
                    "field": field,
                    "value": value,
                    "confidence": 0.7,
                    "snippet": snippet[:200],
                }
            )

    return record, hits


# Very simple label-anchored pull. Codex should expand with table + OCR passes.
def extract_from_pdf(pdf_path: str, config_path: str):
    cfg = yaml.safe_load(Path(config_path).read_text(encoding="utf-8"))
    compiled = {
        k: [re.compile(pat, re.I) for pat in v.get("labels", [])]
        for k, v in cfg["fields"].items()
    }
    runlog: List[Dict[str, Any]] = []

    pages_text: List[str] = []
    with pdfplumber.open(pdf_path) as pdf:
        for page in pdf.pages:
            text = page.extract_text(x_tolerance=2, y_tolerance=2) or ""
            pages_text.append(text)

    full_text = normalize_text("\n".join(pages_text))
    coarse_blocks = split_into_blocks(full_text)
    reservation_blocks = [block for block in coarse_blocks if is_reservation_block(block)]

    if not reservation_blocks:
        return [{}], []

    records: List[Dict[str, Any]] = []
    for idx, block in enumerate(reservation_blocks):
        record, hits = extract_fields_from_block(block, compiled)
        for hit in hits:
            hit["block_index"] = idx
            runlog.append(hit)
        records.append(record)

    return records, runlog
