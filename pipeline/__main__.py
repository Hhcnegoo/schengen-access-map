"""Command line entry point: ``python -m pipeline <command>``."""

from __future__ import annotations

import argparse
from pathlib import Path
from typing import Sequence

from . import config
from .download import download_all, load_sources, verify_raw_files
from .export import write_outputs
from .extract import extract_year
from .transform import build_tables
from .validate import validate


def build(out_dir: Path = config.PROCESSED_DIR, raw_dir: Path = config.RAW_DIR) -> list[Path]:
    """Run extract -> transform -> validate -> export on the pinned raw files."""
    sources = load_sources()
    paths = verify_raw_files(sources, raw_dir)
    missing = sorted(set(config.YEARS) - set(paths))
    if missing:
        raise FileNotFoundError(f"no source file listed for {missing}")
    extracted = [extract_year(paths[year], year) for year in config.YEARS]
    tables = build_tables(extracted)
    report = validate(extracted, tables)
    return write_outputs(tables, sources, report, out_dir=out_dir)


def main(argv: Sequence[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="python -m pipeline", description=__doc__)
    commands = parser.add_subparsers(dest="command", required=True)

    download = commands.add_parser("download", help="fetch the source workbooks")
    download.add_argument(
        "--accept-changes",
        action="store_true",
        help="update the manifest when a published file has changed",
    )
    commands.add_parser("verify", help="check raw files against the manifest checksums")
    commands.add_parser("build", help="rebuild data/processed from the raw files")

    args = parser.parse_args(argv)
    if args.command == "download":
        for line in download_all(accept_changes=args.accept_changes):
            print(line)
    elif args.command == "verify":
        paths = verify_raw_files(load_sources())
        print(f"{len(paths)} raw files match the manifest")
    elif args.command == "build":
        for path in build():
            print(path.relative_to(config.ROOT))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
