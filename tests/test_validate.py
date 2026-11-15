"""Reconciliation checks pass on consistent workbooks and fail on anything else."""

from __future__ import annotations

import pandas as pd
import pytest

from pipeline import config, reference
from pipeline.extract import extract_year
from pipeline.transform import build_tables
from pipeline.validate import (
    ValidationError,
    check_unique_entries,
    source_rate_denominator,
    validate,
)

BLR_RUS = tuple(c for c in reference.SELECTED_COUNTRIES if c.iso3 in {"BLR", "RUS"})


def run(path, year: int = 2021):
    extracted = [extract_year(path, year)]
    return validate(extracted, build_tables(extracted, BLR_RUS), BLR_RUS)


def test_consistent_workbook_passes(make_workbook) -> None:
    report = run(make_workbook())
    assert report["exceptions"] == []
    assert set(report["summary"]) == {"pass"}
    assert report["years"][0]["reporting_states"] == ["AT", "DE", "FR"]
    assert report["years"][0]["source_not_issued_rate_denominator"] == "decisions"


def test_total_row_that_differs_from_the_data_rows_fails(make_workbook) -> None:
    with pytest.raises(ValidationError, match="worldwide_total.uniform_applied"):
        run(make_workbook(worldwide_override={8: 1801}))


def test_country_total_that_differs_from_the_data_rows_fails(make_workbook) -> None:
    with pytest.raises(ValidationError, match="third_country_totals.counts"):
        run(make_workbook(totals_override={"BELARUS": {2: 301}}))


def test_country_missing_from_the_totals_sheet_fails(make_workbook) -> None:
    with pytest.raises(ValidationError, match="third_country_totals.countries"):
        run(make_workbook(totals_override={"ALGERIA": {1: "ALGERIE"}}))


def test_duplicated_entry_fails(make_workbook) -> None:
    entries = [
        ("Austria", "BELARUS", "MINSK", 100, 80, 40, 5, 10),
        ("Austria", "BELARUS", "MINSK", 50, 40, 20, 0, 5),
        ("Germany", "RUSSIAN FEDERATION", "MOSCOW", 1000, 900, 450, 10, 60),
    ]
    extracted = extract_year(make_workbook(entries), 2021)
    assert check_unique_entries(extracted)[0]["status"] == "fail"


def test_known_discrepancy_needs_the_exact_pinned_figures(make_workbook, monkeypatch) -> None:
    path = make_workbook(worldwide_override={12: 7})  # LTV total row prints 7, rows sum to 15
    with pytest.raises(ValidationError, match="worldwide_total.ltv_issued"):
        run(path)
    monkeypatch.setitem(
        config.KNOWN_TOTAL_ROW_DISCREPANCIES,
        (2021, "ltv_issued"),
        {"total_row": 7, "sum_of_rows": 15},
    )
    report = run(path)
    assert [item["status"] for item in report["exceptions"]] == ["known_discrepancy"]
    monkeypatch.setitem(
        config.KNOWN_TOTAL_ROW_DISCREPANCIES,
        (2021, "ltv_issued"),
        {"total_row": 8, "sum_of_rows": 15},
    )
    with pytest.raises(ValidationError):
        run(path)


def test_rate_over_applications_is_recognised_and_reported(make_workbook) -> None:
    report = run(make_workbook(denominator="applications"))
    assert report["years"][0]["source_not_issued_rate_denominator"] == "applications"
    statuses = {item["check"]: item["status"] for item in report["exceptions"]}
    assert statuses == {
        "country_ratio.not_issued_rate.BLR": "definition_differs",
        "country_ratio.not_issued_rate.RUS": "definition_differs",
    }


def test_unrecognised_rate_formula_fails(make_workbook) -> None:
    rows = extract_year(make_workbook(), 2021).rows
    rows["not_issued_rate_source"] = rows["not_issued_rate_source"] + 0.01
    assert source_rate_denominator(rows) is None


def test_formula_detection_reads_empty_cells_as_zero(make_workbook) -> None:
    # The source prints ratios on rows with empty cells; the formulas must
    # still be recognised.
    entries = [
        ("Austria", "BELARUS", "MINSK", 100, 80, 40, None, 10),
        ("Germany", "RUSSIAN FEDERATION", "MOSCOW", 1000, 900, None, 10, 60),
        ("France", "RUSSIAN FEDERATION", "MOSCOW", 500, 400, 100, 5, None),
    ]
    report = run(make_workbook(entries))
    assert report["years"][0]["source_not_issued_rate_denominator"] == "decisions"
    assert report["exceptions"] == []


def test_ratio_stays_missing_when_every_underlying_cell_is_empty(make_workbook) -> None:
    entries = [
        ("Austria", "BELARUS", "MINSK", 100, 80, 40, 5, 10),
        ("Germany", "RUSSIAN FEDERATION", "MOSCOW", 1000, 900, None, 10, 60),
    ]
    extracted = [extract_year(make_workbook(entries), 2021)]
    tables = build_tables(extracted, BLR_RUS)
    report = validate(extracted, tables, BLR_RUS)
    rus = tables["country_year"].set_index("country_iso3").loc["RUS"]
    assert rus["mev_share"] is pd.NA
    assert [(item["check"], item["status"]) for item in report["exceptions"]] == [
        ("country_ratio.mev_share.RUS", "blank_in_source")
    ]
