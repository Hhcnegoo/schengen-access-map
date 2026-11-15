"""Read one yearly workbook into tidy tables without altering any value.

Empty cells stay missing. Nothing is filled, rounded or estimated here.
"""

from __future__ import annotations

import re
import warnings
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Iterable

import pandas as pd
from openpyxl import load_workbook

from . import config


class SourceFormatError(ValueError):
    """A workbook does not have the layout the pipeline was written for."""


@dataclass(frozen=True)
class ExtractedYear:
    """Everything the pipeline reads from one yearly workbook."""

    year: int
    #: One row per consulate (all countries, all reporting States).
    rows: pd.DataFrame
    #: Count columns of the "Total worldwide" row of the main sheet.
    worldwide_total: dict[str, int | None]
    #: The Commission's totals per country of consulate location.
    third_country_totals: pd.DataFrame
    #: Count columns of the "Grand Total" row of the totals sheet.
    grand_total: dict[str, int | None]


def normalise_label(value: Any) -> str:
    """Collapse whitespace and lower-case a header, sheet title or row label."""
    if value is None:
        return ""
    return re.sub(r"\s+", " ", str(value)).strip().lower()


def clean_text(value: Any) -> str | None:
    """Return a cell's text with surrounding and repeated whitespace removed."""
    if value is None:
        return None
    text = re.sub(r"\s+", " ", str(value)).strip()
    return text or None


def parse_count(value: Any, *, where: str) -> int | None:
    """Convert a cell holding a count to ``int``; an empty cell stays ``None``.

    Anything that is not a non-negative whole number raises, so a malformed
    cell can never turn into a figure.
    """
    if value is None:
        return None
    if isinstance(value, bool):
        raise SourceFormatError(f"{where}: boolean {value!r} in a count column")
    if isinstance(value, int):
        number = value
    elif isinstance(value, float):
        if not value.is_integer():
            raise SourceFormatError(f"{where}: non-integer count {value!r}")
        number = int(value)
    elif isinstance(value, str):
        if value.strip() == "":
            return None
        raise SourceFormatError(f"{where}: text {value!r} in a count column")
    else:
        raise SourceFormatError(f"{where}: unsupported cell value {value!r}")
    if number < 0:
        raise SourceFormatError(f"{where}: negative count {number!r}")
    return number


def parse_ratio(value: Any, *, where: str) -> float | None:
    """Convert a cell holding a source ratio to ``float``.

    Empty cells and spreadsheet error values (for example ``#REF!``) are
    missing. Source ratios are only used to check the pipeline's own formulas.
    """
    if value is None:
        return None
    if isinstance(value, bool):
        raise SourceFormatError(f"{where}: boolean {value!r} in a ratio column")
    if isinstance(value, (int, float)):
        return float(value)
    if isinstance(value, str):
        text = value.strip()
        if text == "" or text.startswith("#"):
            return None
        raise SourceFormatError(f"{where}: text {value!r} in a ratio column")
    raise SourceFormatError(f"{where}: unsupported cell value {value!r}")


def _map_headers(
    header_row: Iterable[Any], aliases: dict[str, str], *, where: str
) -> dict[str, int]:
    """Return canonical column -> position for the headers found in a row."""
    positions: dict[str, int] = {}
    for index, cell in enumerate(header_row):
        canonical = aliases.get(normalise_label(cell))
        if canonical is None:
            continue
        if canonical in positions:
            raise SourceFormatError(f"{where}: column {canonical!r} appears twice")
        positions[canonical] = index
    missing = sorted(set(aliases.values()) - set(positions))
    if missing:
        found = [normalise_label(cell) for cell in header_row if cell is not None]
        raise SourceFormatError(f"{where}: missing columns {missing}; headers found: {found}")
    return positions


def _cell(row: tuple[Any, ...], index: int) -> Any:
    return row[index] if index < len(row) else None


def read_main_sheet(
    rows: list[tuple[Any, ...]], year: int
) -> tuple[pd.DataFrame, dict[str, dict[str, int | None]]]:
    """Split the main sheet into consulate rows and labelled summary rows."""
    where = f"{year} '{config.MAIN_SHEET}'"
    if not rows:
        raise SourceFormatError(f"{where}: sheet is empty")
    positions = _map_headers(rows[0], config.MAIN_SHEET_HEADERS, where=where)
    used = sorted(positions.values())

    records: list[dict[str, Any]] = []
    summaries: dict[str, dict[str, int | None]] = {}
    for offset, row in enumerate(rows[1:], start=2):  # spreadsheet row numbers
        here = f"{where} row {offset}"
        state = clean_text(_cell(row, positions["schengen_state"]))
        country = clean_text(_cell(row, positions["country"]))
        consulate = clean_text(_cell(row, positions["consulate"]))

        if state is None and country is None:
            if all(_cell(row, index) is None for index in used):
                continue  # spacer row
            label = normalise_label(consulate)
            kind = next(
                (
                    name
                    for prefix, name in config.SUMMARY_ROW_PREFIXES.items()
                    if label.startswith(prefix)
                ),
                None,
            )
            if kind is None:
                raise SourceFormatError(f"{here}: row is neither data, summary nor empty")
            if kind in summaries:
                raise SourceFormatError(f"{here}: summary row {kind!r} appears twice")
            if kind != "subtotal_share":  # that row holds shares, not counts
                summaries[kind] = {
                    column: parse_count(_cell(row, positions[column]), where=f"{here} {column}")
                    for column in config.COUNT_COLUMNS
                }
            continue

        if state is None or country is None or consulate is None:
            raise SourceFormatError(f"{here}: data row without State, country or consulate")

        record: dict[str, Any] = {
            "year": year,
            "source_row": offset,
            "schengen_state": state,
            "country": country.upper(),
            "consulate": consulate.upper(),
        }
        for column in config.COUNT_COLUMNS:
            record[column] = parse_count(_cell(row, positions[column]), where=f"{here} {column}")
        for column in ("mev_share_source", "not_issued_rate_source"):
            record[column] = parse_ratio(_cell(row, positions[column]), where=f"{here} {column}")
        records.append(record)

    if not records:
        raise SourceFormatError(f"{where}: no data rows found")
    if "worldwide_total" not in summaries:
        raise SourceFormatError(f"{where}: 'Total worldwide' row not found")
    return _typed_frame(records, with_row_keys=True), summaries


def read_third_country_totals(
    rows: list[tuple[Any, ...]], year: int
) -> tuple[pd.DataFrame, dict[str, int | None]]:
    """Read the Commission's per-country totals and their grand total."""
    where = f"{year} totals by third country"
    header_index = next(
        (index for index, row in enumerate(rows) if row and normalise_label(row[0]) == "no."),
        None,
    )
    if header_index is None:
        raise SourceFormatError(f"{where}: header row starting with 'No.' not found")
    positions = _map_headers(
        rows[header_index], config.THIRD_COUNTRY_TOTALS_HEADERS, where=where
    )

    records: list[dict[str, Any]] = []
    grand_total: dict[str, int | None] | None = None
    for offset, row in enumerate(rows[header_index + 1 :], start=header_index + 2):
        here = f"{where} row {offset}"
        country = clean_text(_cell(row, positions["country"]))
        if country is None:
            continue
        counts = {
            column: parse_count(_cell(row, positions[column]), where=f"{here} {column}")
            for column in config.COUNT_COLUMNS
        }
        if normalise_label(country) == "grand total":
            grand_total = counts
            break
        records.append(
            {
                "year": year,
                "country": country.upper(),
                **counts,
                "mev_share_source": parse_ratio(
                    _cell(row, positions["mev_share_source"]), where=f"{here} mev share"
                ),
                "not_issued_rate_source": parse_ratio(
                    _cell(row, positions["not_issued_rate_source"]), where=f"{here} rate"
                ),
            }
        )
    if grand_total is None:
        raise SourceFormatError(f"{where}: 'Grand Total' row not found")
    if not records:
        raise SourceFormatError(f"{where}: no country rows found")
    return _typed_frame(records, with_row_keys=False), grand_total


def _typed_frame(records: list[dict[str, Any]], *, with_row_keys: bool) -> pd.DataFrame:
    """Build a frame with nullable dtypes so that missing stays missing."""
    frame = pd.DataFrame.from_records(records)
    frame["year"] = frame["year"].astype("int64")
    if with_row_keys:
        frame["source_row"] = frame["source_row"].astype("int64")
    for column in config.COUNT_COLUMNS:
        frame[column] = frame[column].astype("Int64")
    for column in ("mev_share_source", "not_issued_rate_source"):
        frame[column] = frame[column].astype("Float64")
    return frame


def extract_year(path: Path, year: int) -> ExtractedYear:
    """Read the main sheet and the totals sheet of one yearly workbook."""
    with warnings.catch_warnings():
        # openpyxl warns about print headers/footers it cannot parse; they are
        # irrelevant to cell values.
        warnings.simplefilter("ignore", category=UserWarning)
        workbook = load_workbook(path, read_only=True, data_only=True)
        try:
            if config.MAIN_SHEET not in workbook.sheetnames:
                raise SourceFormatError(
                    f"{year}: sheet {config.MAIN_SHEET!r} not found in {workbook.sheetnames}"
                )
            totals_titles = [
                title
                for title in workbook.sheetnames
                if normalise_label(title) == config.THIRD_COUNTRY_TOTALS_SHEET
            ]
            if len(totals_titles) != 1:
                raise SourceFormatError(
                    f"{year}: expected one totals-by-third-country sheet, found {totals_titles}"
                )
            main_rows = list(workbook[config.MAIN_SHEET].iter_rows(values_only=True))
            totals_rows = list(workbook[totals_titles[0]].iter_rows(values_only=True))
        finally:
            workbook.close()

    rows, summaries = read_main_sheet(main_rows, year)
    third_country_totals, grand_total = read_third_country_totals(totals_rows, year)
    return ExtractedYear(
        year=year,
        rows=rows,
        worldwide_total=summaries["worldwide_total"],
        third_country_totals=third_country_totals,
        grand_total=grand_total,
    )
