"""Selecting, aggregating and deriving ratios without inventing values."""

from __future__ import annotations

import pandas as pd
import pytest

from pipeline import reference
from pipeline.extract import SourceFormatError, extract_year
from pipeline.transform import (
    add_ratios,
    aggregate,
    attach_cities,
    attach_states,
    build_tables,
    safe_ratio,
    select_countries,
)

BLR_RUS = tuple(c for c in reference.SELECTED_COUNTRIES if c.iso3 in {"BLR", "RUS"})


def counts(**columns: list[object]) -> pd.DataFrame:
    return pd.DataFrame({name: pd.array(values, dtype="Int64") for name, values in columns.items()})


def test_safe_ratio_is_missing_without_a_positive_denominator() -> None:
    result = safe_ratio(
        pd.Series(pd.array([1, 1, 0, None, 3], dtype="Int64")),
        pd.Series(pd.array([4, 0, 0, 5, None], dtype="Int64")),
    )
    assert result[0] == 0.25
    assert result[1:].isna().all()


def test_ratios_follow_the_documented_formulas() -> None:
    frame = add_ratios(
        counts(
            uniform_applied=[100],
            uniform_issued=[80],
            mev_issued=[40],
            ltv_issued=[5],
            uniform_not_issued=[15],
        )
    )
    assert frame.loc[0, "mev_share"] == 40 / 80
    assert frame.loc[0, "not_issued_rate"] == 15 / (80 + 5 + 15)


def test_empty_ltv_cell_counts_as_no_ltvs_in_the_rate() -> None:
    frame = add_ratios(
        counts(
            uniform_applied=[100],
            uniform_issued=[80],
            mev_issued=[40],
            ltv_issued=[None],
            uniform_not_issued=[20],
        )
    )
    assert frame.loc[0, "not_issued_rate"] == 20 / 100


def test_empty_issued_or_not_issued_cell_leaves_the_ratio_missing() -> None:
    frame = add_ratios(
        counts(
            uniform_applied=[100, 100, 100],
            uniform_issued=[80, None, 80],
            mev_issued=[40, 40, None],
            ltv_issued=[0, 0, 0],
            uniform_not_issued=[None, 20, 20],
        )
    )
    assert pd.isna(frame.loc[0, "not_issued_rate"])
    assert pd.isna(frame.loc[1, "not_issued_rate"])
    assert pd.isna(frame.loc[1, "mev_share"])
    assert pd.isna(frame.loc[2, "mev_share"])
    assert frame.loc[2, "not_issued_rate"] == 0.2


def test_zero_not_issued_gives_a_zero_rate_not_a_missing_one() -> None:
    frame = add_ratios(
        counts(
            uniform_applied=[10],
            uniform_issued=[10],
            mev_issued=[0],
            ltv_issued=[0],
            uniform_not_issued=[0],
        )
    )
    assert frame.loc[0, "not_issued_rate"] == 0.0
    assert frame.loc[0, "mev_share"] == 0.0


def selected_rows(make_workbook, entries) -> pd.DataFrame:
    rows = attach_states(extract_year(make_workbook(entries), 2021).rows)
    return attach_cities(select_countries(rows, BLR_RUS))


def test_aggregate_sums_reported_values_and_counts_blanks(make_workbook) -> None:
    entries = [
        ("Austria", "BELARUS", "MINSK", 100, 80, 40, 5, 10),
        ("Germany", "BELARUS", "MINSK", 200, 150, 90, None, 30),
        ("Germany", "BELARUS", "BREST", 0, 0, 0, None, 0),
        ("Germany", "RUSSIAN FEDERATION", "MOSCOW", 1000, 900, 450, None, None),
    ]
    by_country = aggregate(selected_rows(make_workbook, entries), ["year", "country_iso3"])
    blr = by_country.set_index("country_iso3").loc["BLR"]
    assert blr["consulate_entries"] == 3
    assert blr["consulates_with_applications"] == 2
    assert blr["states_listed"] == 2
    assert blr["states_with_applications"] == 2
    assert blr["uniform_applied"] == 300
    assert blr["ltv_issued"] == 5  # the two empty cells add nothing
    assert blr["blank_ltv_issued"] == 2
    assert blr["blank_uniform_applied"] == 0
    assert blr["not_issued_rate"] == 40 / (230 + 5 + 40)


def test_aggregate_of_empty_cells_only_is_missing_not_zero(make_workbook) -> None:
    entries = [
        ("Austria", "BELARUS", "MINSK", 100, 80, 40, 5, 10),
        ("Germany", "RUSSIAN FEDERATION", "MOSCOW", 1000, 900, 450, None, None),
    ]
    by_country = aggregate(selected_rows(make_workbook, entries), ["year", "country_iso3"])
    rus = by_country.set_index("country_iso3").loc["RUS"]
    assert pd.isna(rus["ltv_issued"])
    assert pd.isna(rus["uniform_not_issued"])
    assert pd.isna(rus["not_issued_rate"])
    assert rus["mev_share"] == 0.5
    assert rus["blank_uniform_not_issued"] == 1


def test_state_level_aggregate_has_no_state_counts(make_workbook) -> None:
    entries = [
        ("Austria", "BELARUS", "MINSK", 100, 80, 40, 5, 10),
        ("Germany", "RUSSIAN FEDERATION", "MOSCOW", 1000, 900, 450, 10, 60),
    ]
    table = aggregate(
        selected_rows(make_workbook, entries), ["year", "country_iso3", "schengen_state_iso2"]
    )
    assert "states_listed" not in table.columns
    assert table["consulate_entries"].tolist() == [1, 1]


def test_unknown_state_name_stops_the_build(make_workbook) -> None:
    rows = extract_year(
        make_workbook([("Ruritania", "BELARUS", "MINSK", 1, 1, 0, 0, 0)]), 2021
    ).rows
    with pytest.raises(SourceFormatError, match="Ruritania"):
        attach_states(rows)


def test_unlisted_spelling_of_a_selected_country_stops_the_build(make_workbook) -> None:
    entries = [
        ("Austria", "BELARUS", "MINSK", 100, 80, 40, 5, 10),
        ("Germany", "RUSSIA", "MOSCOW", 1000, 900, 450, 10, 60),
    ]
    rows = attach_states(extract_year(make_workbook(entries), 2021).rows)
    with pytest.raises(SourceFormatError, match="resembles Russia"):
        select_countries(rows, BLR_RUS)


def test_selected_country_without_rows_stops_the_build(make_workbook) -> None:
    rows = attach_states(
        extract_year(make_workbook([("Austria", "BELARUS", "MINSK", 1, 1, 0, 0, 0)]), 2021).rows
    )
    with pytest.raises(SourceFormatError, match="no consulate rows for \\['RUS'\\]"):
        select_countries(rows, BLR_RUS)


def test_unknown_city_stops_the_build(make_workbook) -> None:
    entries = [
        ("Austria", "BELARUS", "GOMEL", 100, 80, 40, 5, 10),
        ("Germany", "RUSSIAN FEDERATION", "MOSCOW", 1000, 900, 450, 10, 60),
    ]
    rows = attach_states(extract_year(make_workbook(entries), 2021).rows)
    with pytest.raises(SourceFormatError, match="GOMEL"):
        attach_cities(select_countries(rows, BLR_RUS))


def test_two_spellings_of_one_city_share_an_id(make_workbook) -> None:
    entries = [
        ("Austria", "BELARUS", "MINSK", 100, 80, 40, 5, 10),
        ("Germany", "RUSSIAN FEDERATION", "NOVOROSSIISK", 10, 9, 4, 0, 1),
        ("Greece", "RUSSIAN FEDERATION", "NOVOROSSIYSK", 20, 18, 8, 0, 2),
    ]
    selected = selected_rows(make_workbook, entries)
    assert selected.loc[selected["country_iso3"] == "RUS", "consulate_id"].tolist() == [
        "novorossiysk",
        "novorossiysk",
    ]


def test_same_state_listing_both_spellings_stops_the_build(make_workbook) -> None:
    entries = [
        ("Austria", "BELARUS", "MINSK", 100, 80, 40, 5, 10),
        ("Germany", "RUSSIAN FEDERATION", "NOVOROSSIISK", 10, 9, 4, 0, 1),
        ("Germany", "RUSSIAN FEDERATION", "NOVOROSSIYSK", 20, 18, 8, 0, 2),
    ]
    with pytest.raises(SourceFormatError, match="same consulate entry"):
        selected_rows(make_workbook, entries)


def test_build_tables_keeps_only_selected_countries(make_workbook) -> None:
    tables = build_tables([extract_year(make_workbook(), 2021)], BLR_RUS)
    assert set(tables["consulate_year"]["country_iso3"]) == {"BLR", "RUS"}
    assert tables["total_year"].loc[0, "uniform_applied"] == 1300
    reporting = tables["reporting_states"].set_index("schengen_state_iso2")
    assert reporting.loc["FR", "consulate_entries_worldwide"] == 1
    assert reporting.loc["FR", "consulate_entries_selected_countries"] == 0
    country_year = tables["country_year"].set_index("country_iso3")
    assert country_year.loc["BLR", "not_issued_rate_source"] == pytest.approx(40 / 275)
