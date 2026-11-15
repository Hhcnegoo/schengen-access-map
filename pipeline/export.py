"""Write the processed tables as CSV plus one JSON bundle for the site.

Output is deterministic: no timestamps, fixed ordering, ``\\n`` line endings.
Missing values are empty in CSV and ``null`` in JSON, never ``0``.
"""

from __future__ import annotations

import json
import math
import numbers
from pathlib import Path
from typing import Any, Sequence

import pandas as pd

from . import config, reference

#: Tables bundled into ``site_data.json`` under the same names as the CSVs.
SITE_TABLES: tuple[str, ...] = (
    "total_year",
    "country_year",
    "state_year",
    "country_state_year",
    "consulate_year",
)


def to_plain(value: Any) -> Any:
    """Convert a pandas/numpy scalar to a JSON-ready Python value."""
    if value is None or value is pd.NA:
        return None
    if isinstance(value, bool):
        return value
    if isinstance(value, numbers.Integral):
        return int(value)
    if isinstance(value, numbers.Real):
        number = float(value)
        return None if math.isnan(number) else number
    return value


def to_records(table: pd.DataFrame) -> list[dict[str, Any]]:
    """Return the table as a list of dicts with ``None`` for missing values."""
    columns = list(table.columns)
    return [
        {column: to_plain(value) for column, value in zip(columns, row)}
        for row in table.itertuples(index=False, name=None)
    ]


def dumps_one_record_per_line(payload: dict[str, Any]) -> str:
    """Serialise ``payload`` with one record per line to keep diffs readable."""

    def compact(value: Any) -> str:
        return json.dumps(value, ensure_ascii=False, allow_nan=False, separators=(", ", ": "))

    parts = []
    for key, value in payload.items():
        if isinstance(value, list) and value and all(isinstance(item, dict) for item in value):
            body = ",\n".join(f"    {compact(item)}" for item in value)
            parts.append(f"  {json.dumps(key)}: [\n{body}\n  ]")
        else:
            parts.append(f"  {json.dumps(key)}: {compact(value)}")
    return "{\n" + ",\n".join(parts) + "\n}\n"


def site_payload(
    tables: dict[str, pd.DataFrame],
    sources: dict[str, Any],
    report: dict[str, Any],
    countries: Sequence[reference.Country],
) -> dict[str, Any]:
    """Assemble everything the site reads: reference lists plus data tables."""
    reporting = tables["reporting_states"]
    years_by_state = reporting.groupby("schengen_state_iso2")["year"].apply(
        lambda years: [int(year) for year in sorted(years)]
    )
    selected_cities = {
        (row.country_iso3, row.consulate_id)
        for row in tables["consulate_year"].itertuples(index=False)
    }
    source_names_seen = (
        tables["consulate_year"].groupby("consulate_id")["consulate_source_name"].unique()
    )

    payload: dict[str, Any] = {
        "meta": {
            "years": [int(year) for year in sorted(tables["total_year"]["year"])],
            "source_page": sources["source_page"],
            "publisher": sources["publisher"],
            "source_files": [
                {key: entry[key] for key in ("year", "url", "sha256", "retrieved")}
                for entry in sources["files"]
            ],
            "source_not_issued_rate_denominator": {
                str(item["year"]): item["source_not_issued_rate_denominator"]
                for item in report["years"]
            },
        },
        "countries": [
            {
                "iso3": country.iso3,
                "iso_n3": country.iso_n3,
                "name_en": country.name_en,
                "name_ru": country.name_ru,
            }
            for country in countries
        ],
        "states": [
            {
                "iso2": state.iso2,
                "iso_n3": state.iso_n3,
                "name_en": state.name_en,
                "name_ru": state.name_ru,
                "years": years_by_state[state.iso2],
            }
            for state in reference.SCHENGEN_STATES
            if state.iso2 in years_by_state.index
        ],
        "consulates": [
            {
                "consulate_id": city.city_id,
                "country_iso3": city.country_iso3,
                "name_en": city.name_en,
                "name_ru": city.name_ru,
                "source_names": sorted(source_names_seen[city.city_id]),
            }
            for city in reference.CONSULATE_CITIES
            if (city.country_iso3, city.city_id) in selected_cities
        ],
    }
    for name in SITE_TABLES:
        payload[name] = to_records(tables[name])
    return payload


def write_outputs(
    tables: dict[str, pd.DataFrame],
    sources: dict[str, Any],
    report: dict[str, Any],
    countries: Sequence[reference.Country] = reference.SELECTED_COUNTRIES,
    out_dir: Path = config.PROCESSED_DIR,
) -> list[Path]:
    """Write CSV tables, the site bundle and the validation report."""
    out_dir.mkdir(parents=True, exist_ok=True)
    written: list[Path] = []
    for name, table in tables.items():
        path = out_dir / f"{name}.csv"
        table.to_csv(path, index=False, lineterminator="\n", encoding="utf-8")
        written.append(path)

    site_path = out_dir / "site_data.json"
    site_path.write_text(
        dumps_one_record_per_line(site_payload(tables, sources, report, countries)),
        encoding="utf-8",
    )
    written.append(site_path)

    report_path = out_dir / "validation_report.json"
    report_path.write_text(dumps_one_record_per_line(report), encoding="utf-8")
    written.append(report_path)
    return written

