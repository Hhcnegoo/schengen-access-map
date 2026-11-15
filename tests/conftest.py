"""Shared fixtures: synthetic workbooks laid out like the source files."""

from __future__ import annotations

from pathlib import Path
from typing import Any, Callable, Sequence

import pytest
from openpyxl import Workbook

# Header row of the main sheet, spaced exactly as in the 2019-2023 files.
MAIN_HEADER: tuple[str, ...] = (
    "Schengen State",
    "Country where consulate is located",
    "Consulate",
    "Airport transit visas (ATVs) applied for ",
    " ATVs issued (including multiple)",
    "Multiple ATVs issued",
    "ATVs not issued ",
    "Not issued rate for ATVs",
    "Uniform visas applied for",
    "Total  uniform visas issued (including MEV) \n",
    "Multiple entry uniform visas (MEVs) issued",
    "Share of MEVs on total number of uniform visas issued",
    "Total LTVs issued",
    "Uniform visas not issued",
    "Not issued rate for uniform visas",
    "Total ATVs and uniform visas applied for",
    "Total ATVs and uniform visas issued  (including multiple ATVs, MEVs and LTVs) ",
    "Total ATVs and uniform visas not issued",
    "Not issued rate for ATVs and uniform visas ",
)

TOTALS_HEADER: tuple[str, ...] = (
    "No.",
    "Country where consulate is located",
    "Uniform visas applied for ",
    "Total  uniform visas issued (including MEV) ",
    "Multiple entry uniform visas (MEVs) issued ",
    "Total LTVs issued   ",
    "Uniform visas not issued ",
    "Not issued rate for uniform visas",
    "Share of MEVs",
)

#: (State, country, consulate, applied, issued, MEVs, LTVs, not issued)
Entry = tuple[str, str, str, Any, Any, Any, Any, Any]

DEFAULT_ENTRIES: tuple[Entry, ...] = (
    ("Austria", "BELARUS", "MINSK", 100, 80, 40, 5, 10),
    ("Germany", "BELARUS", "MINSK", 200, 150, 90, None, 30),
    ("Germany", "RUSSIAN FEDERATION", "MOSCOW", 1000, 900, 450, 10, 60),
    ("France", "ALGERIA", "ALGIERS", 500, 300, 60, 0, 190),
)


def _number(value: Any) -> int:
    return value if isinstance(value, int) else 0


def _ratio(top: int, bottom: int) -> float | None:
    return top / bottom if bottom else None


def _rate(entry_counts: Sequence[Any], denominator: str) -> float | None:
    applied, issued, _mev, ltv, not_issued = (_number(value) for value in entry_counts)
    if denominator == "applications":
        return _ratio(not_issued, applied)
    return _ratio(not_issued, issued + ltv + not_issued)


def main_row(entry: Entry, denominator: str = "decisions") -> list[Any]:
    """Lay out one data row of the main sheet the way the source does."""
    state, country, consulate, applied, issued, mev, ltv, not_issued = entry
    counts = (applied, issued, mev, ltv, not_issued)
    return [
        state,
        country,
        consulate,
        None,
        None,
        None,
        None,
        None,
        applied,
        issued,
        mev,
        _ratio(_number(mev), _number(issued)),
        ltv,
        not_issued,
        _rate(counts, denominator),
        applied,
        issued,
        not_issued,
        None,
    ]


def _sum(entries: Sequence[Entry], position: int) -> int:
    return sum(_number(entry[position]) for entry in entries)


def summary_row(label: str, entries: Sequence[Entry], denominator: str) -> list[Any]:
    """Lay out a totals row; the label sits in the "Consulate" column."""
    totals = tuple(_sum(entries, position) for position in range(3, 8))
    row = main_row(("", "", label, *totals), denominator)
    row[0] = row[1] = None
    return row


@pytest.fixture
def make_workbook(tmp_path: Path) -> Callable[..., Path]:
    """Return a factory writing a workbook shaped like a yearly source file."""

    def factory(
        entries: Sequence[Entry] = DEFAULT_ENTRIES,
        *,
        year: int = 2021,
        denominator: str = "decisions",
        header: Sequence[Any] = MAIN_HEADER,
        extra_rows: Sequence[Sequence[Any]] = (),
        worldwide_override: dict[int, Any] | None = None,
        totals_override: dict[str, dict[int, Any]] | None = None,
        totals_sheet_title: str = "Totals - third country ",
    ) -> Path:
        workbook = Workbook()
        workbook.active.title = "Description"

        main = workbook.create_sheet("Data for consulates")
        main.append(list(header))
        for entry in entries:
            main.append(main_row(entry, denominator))
        for _ in range(3):
            main.append([None] * len(header))
        main.append(summary_row(f"Selection Sub total in {year}", entries, denominator))
        worldwide = summary_row(f"Total worldwide {year}", entries, denominator)
        for position, value in (worldwide_override or {}).items():
            worldwide[position] = value
        main.append(worldwide)
        share = [None, None, "Share of subtotal on worldwide total"] + [1] * (len(header) - 3)
        main.append(share)
        for row in extra_rows:
            main.append(list(row))

        totals = workbook.create_sheet(totals_sheet_title)
        totals.append([None, None, "Data"])
        totals.append(list(TOTALS_HEADER))
        countries = sorted({entry[1] for entry in entries})
        for number, country in enumerate(countries, start=1):
            subset = [entry for entry in entries if entry[1] == country]
            counts = [_sum(subset, position) for position in range(3, 8)]
            row = [
                number,
                country,
                *counts,
                _rate(counts, denominator),
                _ratio(counts[2], counts[1]),
            ]
            for position, value in (totals_override or {}).get(country, {}).items():
                row[position] = value
            totals.append(row)
        grand = [_sum(entries, position) for position in range(3, 8)]
        totals.append(
            [None, "Grand Total", *grand, _rate(grand, denominator), _ratio(grand[2], grand[1])]
        )

        path = tmp_path / f"consulates_{year}.xlsx"
        workbook.save(path)
        return path

    return factory
