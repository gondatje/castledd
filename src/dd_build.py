
import json
import pathlib
import click
from src.extract_pdf import extract_from_pdf
from src.normalize import Normalizer
from src.writer import MasterWriter
from src.validators import validate_record

@click.command()
@click.option("--master", type=click.Path(exists=True, dir_okay=False), required=True)
@click.option("--ad", type=click.Path(exists=True, dir_okay=False), required=True)
@click.option("--out", type=click.Path(dir_okay=False), required=True)
@click.option("--logdir", type=click.Path(file_okay=False), default="./logs")
@click.option("--config", type=click.Path(exists=True, dir_okay=False), default="./config/field_map.yaml")
def main(master, ad, out, logdir, config):
    logdir = pathlib.Path(logdir)
    logdir.mkdir(parents=True, exist_ok=True)

    # 1) Extract raw fields
    records, runlog = extract_from_pdf(ad, config)

    # 2) Normalize + validate
    norm = Normalizer()
    normalized = [norm.normalize_record(r) for r in records]
    validated = [validate_record(r) for r in normalized]

    # 3) Write to cloned MASTER
    writer = MasterWriter(master_path=master)
    writer.write_records(validated, out_path=out)

    # 4) Persist run log
    (logdir / f"run_{pathlib.Path(out).stem}.jsonl").write_text("\n".join(json.dumps(item) for item in runlog), encoding="utf-8")

if __name__ == "__main__":
    main()
