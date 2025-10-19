
from dateutil import parser as dateparse
import regex as re

class Normalizer:
    def date_mdy(self, s):
        try:
            return dateparse.parse(s, fuzzy=True).strftime("%m/%d/%Y")
        except Exception:
            return ""

    def time_12h(self, s):
        # Accept 24h or 12h, return 12h like "7:00 PM"
        try:
            dt = dateparse.parse(s, fuzzy=True)
            return dt.strftime("%-I:%M %p")
        except Exception:
            return ""

    def time_12h_range(self, s):
        # Normalize ranges like "7pm – 9pm" or "19:00-21:00"
        parts = re.split(r"\s*[–-]\s*", s)
        if len(parts) == 2:
            return f"{self.time_12h(parts[0])} – {self.time_12h(parts[1])}"
        return self.time_12h(s)

    def person_list(self, s):
        # Split on commas/ampersands and normalize casing
        names = re.split(r"\s*(?:,|&|and)\s*", s)
        return ", ".join(self.person(n) for n in names if n.strip())

    def person(self, n):
        n = re.sub(r"\s+", " ", n.strip())
        return n.title()

    def room_type(self, s):
        return s.strip()

    def int_cast(self, s):
        m = re.search(r"\d+", s)
        return int(m.group(0)) if m else ""

    def sentence(self, s):
        return s.strip()

    def activities_block(self, s):
        # Placeholder; Codex to implement structured parsing into canonical titles
        return s.strip()

    def normalize_record(self, rec):
        out = {}
        for k, v in rec.items():
            func = getattr(self, k, None) or getattr(self, cfg_name(k), None) or getattr(self, "sentence")
            out[k] = func(v) if callable(func) else v
        return out


def cfg_name(k):
    # map to normalizer names declared in field_map.yaml if needed
    return k
