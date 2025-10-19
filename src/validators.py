
from datetime import datetime

def validate_record(rec: dict) -> dict:
    # Add simple sanity checks; do not mutate if unsure
    a, d = rec.get("arrival_date"), rec.get("departure_date")
    try:
        if a and d:
            ad = datetime.strptime(a, "%m/%d/%Y")
            dd = datetime.strptime(d, "%m/%d/%Y")
            if dd < ad:
                rec["departure_date"] = ""  # drop if inverted
    except Exception:
        pass
    return rec
