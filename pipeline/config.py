"""Paths, scope and source-layout constants shared by the pipeline."""

from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = ROOT / "data"
RAW_DIR = DATA_DIR / "raw"
PROCESSED_DIR = DATA_DIR / "processed"
SOURCES_FILE = DATA_DIR / "sources.json"

#: Reporting years covered by the project.
YEARS: tuple[int, ...] = tuple(range(2019, 2026))

#: Sheet holding one row per consulate of the States fully applying the
#: Schengen acquis. National short-stay visas of Member States not (yet) fully
#: applying the acquis are published on a separate sheet and are out of scope.
MAIN_SHEET = "Data for consulates"

#: Sheet with the Commission's own totals per country of consulate location.
#: Matched on its normalised title because the raw title carries stray spaces.
THIRD_COUNTRY_TOTALS_SHEET = "totals - third country"

#: Count columns taken from the source, in canonical order.
COUNT_COLUMNS: tuple[str, ...] = (
    "uniform_applied",
    "uniform_issued",
    "mev_issued",
    "ltv_issued",
    "uniform_not_issued",
)

#: Normalised source header -> canonical column, for the main sheet.
#: Headers are normalised by collapsing whitespace and lower-casing, which
#: absorbs the spacing differences between yearly files.
MAIN_SHEET_HEADERS: dict[str, str] = {
    "schengen state": "schengen_state",
    "country where consulate is located": "country",
    "consulate": "consulate",
    "uniform visas applied for": "uniform_applied",
    "total uniform visas issued (including mev)": "uniform_issued",
    "multiple entry uniform visas (mevs) issued": "mev_issued",
    "share of mevs on total number of uniform visas issued": "mev_share_source",
    "total ltvs issued": "ltv_issued",
    "uniform visas not issued": "uniform_not_issued",
    "not issued rate for uniform visas": "not_issued_rate_source",
}

#: Normalised source header -> canonical column, for the totals sheet.
THIRD_COUNTRY_TOTALS_HEADERS: dict[str, str] = {
    "country where consulate is located": "country",
    "country where the consulate is located": "country",
    "uniform visas applied for": "uniform_applied",
    "total uniform visas issued (including mev)": "uniform_issued",
    "multiple entry uniform visas (mevs) issued": "mev_issued",
    "total ltvs issued": "ltv_issued",
    "uniform visas not issued": "uniform_not_issued",
    "not issued rate for uniform visas": "not_issued_rate_source",
    "share of mevs": "mev_share_source",
}

#: Labels (normalised prefix) of the summary rows below the data rows of the
#: main sheet. The label sits in the "Consulate" column.
SUMMARY_ROW_PREFIXES: dict[str, str] = {
    "selection sub total": "selection_subtotal",
    "total worldwide": "worldwide_total",
    "share of subtotal": "subtotal_share",
}

#: Places where a source workbook disagrees with itself. Each entry pins the
#: exact figures so that validation still fails if the source changes.
#: Key: (year, column). ``total_row`` is the value printed in the main sheet's
#: "Total worldwide" row, ``sum_of_rows`` the sum of the data rows above it.
KNOWN_TOTAL_ROW_DISCREPANCIES: dict[tuple[int, str], dict[str, int]] = {
    # The 2024 "Total worldwide" row understates LTVs issued. The sum of the
    # data rows equals the grand total of the "Totals - third country" sheet.
    (2024, "ltv_issued"): {"total_row": 41_617, "sum_of_rows": 65_312},
}

#: Absolute tolerance when comparing recomputed ratios with source ratios.
RATIO_TOLERANCE = 1e-9
