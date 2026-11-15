"""Reading a workbook: values are kept as they are, anything odd stops the read."""

from __future__ import annotations

import pandas as pd
import pytest

from pipeline.extract import (
    SourceFormatError,
    clean_text,
    extract_year,
    normalise_label,
    parse_count,
    parse_ratio,
)
from tests.conftest import DEFAULT_ENTRIES, MAIN_HEADER, main_row


def test_normalise_label_collapses_whitespace_and_case() -> None:
    assert normalise_label("Total  uniform visas issued (including MEV) \n") == (
        "total uniform visas issued (including mev)"
    )
    assert normalise_label(None) == ""


def test_clean_text_strips_and_keeps_empty_as_missing() -> None:
    assert clean_text("SAO TOME ") == "SAO TOME"
    assert clean_text("   ") is None
    assert clean_text(None) is None


@pytest.mark.parametrize(("cell", "expected"), [(None, None), (0, 0), (49, 49), (49.0, 49), ("", None), ("  ", None)])
def test_parse_count_accepts_whole_numbers_and_empty_cells(cell: object, expected: object) -> None:
    assert parse_count(cell, where="test") == expected


@pytest.mark.parametrize("cell", [49.5, -1, "49", "n/a", "#REF!", True, float("nan")])
def test_parse_count_rejects_anything_else(cell: object) -> None:
    with pytest.raises(SourceFormatError):
        parse_count(cell, where="test")


def test_parse_ratio_treats_error_values_as_missing() -> None:
    assert parse_ratio(None, where="test") is None
    assert parse_ratio("#REF!", where="test") is None
    assert parse_ratio(1, where="test") == 1.0
    assert parse_ratio(0.25, where="test") == 0.25
    with pytest.raises(SourceFormatError):
        parse_ratio("high", where="test")


def test_extract_reads_data_rows_only(make_workbook) -> None:
    extracted = extract_year(make_workbook(), 2021)
    rows = extracted.rows
    assert len(rows) == len(DEFAULT_ENTRIES)
    assert list(rows["source_row"]) == [2, 3, 4, 5]
    assert rows["uniform_applied"].tolist() == [100, 200, 1000, 500]
    assert set(rows["country"]) == {"BELARUS", "RUSSIAN FEDERATION", "ALGERIA"}


def test_empty_cell_stays_missing_and_zero_stays_zero(make_workbook) -> None:
    rows = extract_year(make_workbook(), 2021).rows
    ltv = rows.set_index(["schengen_state", "country"])["ltv_issued"]
    assert pd.isna(ltv[("Germany", "BELARUS")])
    assert ltv[("France", "ALGERIA")] == 0
    assert str(rows["ltv_issued"].dtype) == "Int64"


def test_totals_rows_are_read_separately(make_workbook) -> None:
    extracted = extract_year(make_workbook(), 2021)
    assert extracted.worldwide_total == {
        "uniform_applied": 1800,
        "uniform_issued": 1430,
        "mev_issued": 640,
        "ltv_issued": 15,
        "uniform_not_issued": 290,
    }
    assert extracted.grand_total == extracted.worldwide_total
    totals = extracted.third_country_totals.set_index("country")
    assert totals.loc["BELARUS", "uniform_applied"] == 300
    assert "GRAND TOTAL" not in totals.index


def test_header_spacing_variants_are_accepted(make_workbook) -> None:
    header = list(MAIN_HEADER)
    header[9] = "Total uniform visas issued (including MEV) \n"  # 2024-2025 spelling
    header.append(None)  # trailing unnamed column, as in some files
    extracted = extract_year(make_workbook(header=header), 2021)
    assert extracted.rows["uniform_issued"].tolist() == [80, 150, 900, 300]


def test_totals_sheet_title_without_trailing_space(make_workbook) -> None:
    extracted = extract_year(make_workbook(totals_sheet_title="Totals - third country"), 2021)
    assert len(extracted.third_country_totals) == 3


def test_missing_column_stops_the_read(make_workbook) -> None:
    header = list(MAIN_HEADER)
    header[13] = "Uniform visas refused"
    with pytest.raises(SourceFormatError, match="missing columns"):
        extract_year(make_workbook(header=header), 2021)


def test_text_in_a_count_column_stops_the_read(make_workbook) -> None:
    entries = list(DEFAULT_ENTRIES)
    entries[0] = ("Austria", "BELARUS", "MINSK", "about 100", 80, 40, 5, 10)
    with pytest.raises(SourceFormatError, match="text 'about 100'"):
        extract_year(make_workbook(entries), 2021)


def test_error_value_in_an_unused_column_is_ignored(make_workbook) -> None:
    row = main_row(("Spain", "ALGERIA", "ORAN", 10, 8, 1, 0, 2))
    row[7] = "#REF!"  # "Not issued rate for ATVs", not read by the pipeline
    # Appended after the summary rows; still a data row.
    extracted = extract_year(make_workbook(extra_rows=[row]), 2021)
    assert len(extracted.rows) == len(DEFAULT_ENTRIES) + 1


def test_spacer_row_with_stray_value_in_unused_column_is_ignored(make_workbook) -> None:
    header = list(MAIN_HEADER) + [None]
    spacer = [None] * len(MAIN_HEADER) + [0]
    extracted = extract_year(make_workbook(header=header, extra_rows=[spacer]), 2021)
    assert len(extracted.rows) == len(DEFAULT_ENTRIES)


def test_unlabelled_row_with_numbers_stops_the_read(make_workbook) -> None:
    stray = [None] * len(MAIN_HEADER)
    stray[8] = 12
    with pytest.raises(SourceFormatError, match="neither data, summary nor empty"):
        extract_year(make_workbook(extra_rows=[stray]), 2021)


def test_data_row_without_consulate_stops_the_read(make_workbook) -> None:
    row = main_row(("Spain", "ALGERIA", "ORAN", 10, 8, 1, 0, 2))
    row[2] = None
    with pytest.raises(SourceFormatError, match="without State, country or consulate"):
        extract_year(make_workbook(extra_rows=[row]), 2021)


def test_consulate_names_are_trimmed(make_workbook) -> None:
    entries = list(DEFAULT_ENTRIES)
    entries[3] = ("France", "ALGERIA", "ALGIERS ", 500, 300, 60, 0, 190)
    rows = extract_year(make_workbook(entries), 2021).rows
    assert "ALGIERS" in set(rows["consulate"])
