"""The committed processed data: reproducible, consistent and tied to the source.

These tests read the real workbooks under ``data/raw``.
"""

from __future__ import annotations

import json
from pathlib import Path

import pandas as pd
import pytest

from pipeline import config, reference
from pipeline.__main__ import build
from pipeline.export import SITE_TABLES, to_records

PROCESSED = config.PROCESSED_DIR
COUNTS = list(config.COUNT_COLUMNS)

# Figures typed from the "Totals - third country" sheet of the source files:
# (year, country) -> (applied for, issued, MEVs issued, LTVs issued, not issued)
PUBLISHED_TOTALS = {
    (2019, "BLR"): (645_722, 643_474, 550_656, 195, 1_766),
    (2019, "RUS"): (4_133_100, 4_054_685, 3_350_160, 1_013, 61_863),
    (2020, "KGZ"): (3_629, 2_922, 726, 0, 707),
    (2021, "ARM"): (12_445, 11_066, 5_973, 6, 1_290),
    (2022, "AZE"): (52_570, 47_563, 21_198, 26, 4_233),
    (2023, "KAZ"): (159_072, 143_970, 57_355, 159, 14_285),
    (2024, "UZB"): (58_691, 48_137, 15_400, 3_467, 9_250),
    (2025, "RUS"): (679_425, 618_806, 175_862, 11_799, 42_953),
    (2025, "BLR"): (157_028, 152_571, 129_672, 221, 3_652),
}


def read(name: str) -> pd.DataFrame:
    return pd.read_csv(PROCESSED / f"{name}.csv")


@pytest.fixture(scope="module")
def rebuilt(tmp_path_factory: pytest.TempPathFactory) -> Path:
    out_dir = tmp_path_factory.mktemp("processed")
    build(out_dir=out_dir)
    return out_dir


def test_pipeline_reproduces_the_committed_files_byte_for_byte(rebuilt: Path) -> None:
    produced = sorted(path.name for path in rebuilt.iterdir())
    committed = sorted(
        path.name for path in PROCESSED.iterdir() if path.suffix in {".csv", ".json"}
    )
    assert produced == committed
    for name in produced:
        assert (rebuilt / name).read_bytes() == (PROCESSED / name).read_bytes(), name


@pytest.mark.parametrize(("key", "expected"), sorted(PUBLISHED_TOTALS.items()))
def test_country_totals_equal_the_published_totals(
    key: tuple[int, str], expected: tuple[int, ...]
) -> None:
    year, iso3 = key
    table = read("country_year").set_index(["year", "country_iso3"])
    assert tuple(int(value) for value in table.loc[(year, iso3), COUNTS]) == expected


def test_every_year_and_selected_country_is_present() -> None:
    table = read("country_year")
    expected = {
        (year, country.iso3) for year in config.YEARS for country in reference.SELECTED_COUNTRIES
    }
    assert set(zip(table["year"], table["country_iso3"])) == expected
    assert len(table) == len(expected)


@pytest.mark.parametrize(
    ("fine", "coarse", "keys"),
    [
        ("consulate_year", "country_state_year", ["year", "country_iso3", "schengen_state_iso2"]),
        ("country_state_year", "country_year", ["year", "country_iso3"]),
        ("country_state_year", "state_year", ["year", "schengen_state_iso2"]),
        ("country_year", "total_year", ["year"]),
    ],
)
def test_tables_add_up_across_levels(fine: str, coarse: str, keys: list[str]) -> None:
    summed = read(fine).groupby(keys)[COUNTS].sum(min_count=1)
    expected = read(coarse).set_index(keys)[COUNTS]
    pd.testing.assert_frame_equal(summed, expected, check_dtype=False)


def test_ratios_can_be_recomputed_from_the_counts() -> None:
    for name in ("consulate_year", "country_state_year", "country_year", "state_year", "total_year"):
        table = read(name)
        share = table["mev_issued"] / table["uniform_issued"]
        decisions = (
            table["uniform_issued"] + table["ltv_issued"].fillna(0) + table["uniform_not_issued"]
        )
        rate = table["uniform_not_issued"] / decisions
        for column, recomputed in (("mev_share", share), ("not_issued_rate", rate)):
            present = table[column].notna()
            assert (table.loc[present, column] - recomputed[present]).abs().max() < 1e-12, name
            assert table.loc[present, column].between(0, 1).all(), name
            # A ratio is missing exactly when it cannot be computed.
            computable = recomputed.notna() & ~recomputed.isin([float("inf")])
            assert (present == computable).all(), (name, column)


def test_empty_source_cells_stay_empty() -> None:
    table = read("consulate_year").set_index(
        ["year", "country_iso3", "schengen_state_iso2", "consulate_id"]
    )
    # Czechia, Yerevan, 2019: the LTV cell is empty in the source (row 147).
    row = table.loc[(2019, "ARM", "CZ", "yerevan")]
    assert row["source_row"] == 147
    assert pd.isna(row["ltv_issued"])
    assert row["uniform_applied"] == 3074
    # Switzerland, Tashkent, 2024: the source reports zeros, which stay zeros.
    row = table.loc[(2024, "UZB", "CH", "tashkent")]
    assert row["uniform_applied"] == 0
    assert pd.isna(row["mev_share"])
    assert pd.isna(row["not_issued_rate"])


def test_blank_counters_match_the_empty_cells() -> None:
    consulates = read("consulate_year")
    country_year = read("country_year").set_index(["year", "country_iso3"])
    for column in COUNTS:
        blanks = consulates[column].isna().groupby(
            [consulates["year"], consulates["country_iso3"]]
        ).sum()
        assert (country_year[f"blank_{column}"] == blanks).all(), column


def test_reporting_states_follow_the_source_files() -> None:
    table = read("reporting_states")
    first_year = table.groupby("schengen_state_iso2")["year"].min()
    last_year = table.groupby("schengen_state_iso2")["year"].max()
    assert first_year["HR"] == 2023
    assert first_year["BG"] == 2024
    assert first_year["RO"] == 2024
    assert (first_year.drop(["HR", "BG", "RO"]) == 2019).all()
    assert (last_year == 2025).all()
    assert table.groupby("year").size().to_dict() == {
        2019: 25, 2020: 25, 2021: 25, 2022: 25, 2023: 26, 2024: 28, 2025: 28,
    }
    assert "CY" not in set(table["schengen_state_iso2"])


def test_source_rate_definition_by_year() -> None:
    report = json.loads((PROCESSED / "validation_report.json").read_text(encoding="utf-8"))
    assert {item["year"]: item["source_not_issued_rate_denominator"] for item in report["years"]} == {
        2019: "applications",
        2020: "decisions",
        2021: "decisions",
        2022: "decisions",
        2023: "decisions",
        2024: "decisions",
        2025: "decisions",
    }
    assert "fail" not in report["summary"]
    country_year = read("country_year")
    later = country_year[country_year["year"] >= 2020]
    assert (later["not_issued_rate"] - later["not_issued_rate_source"]).abs().max() < 1e-12


def test_site_bundle_holds_the_same_records_as_the_csv_tables() -> None:
    bundle = json.loads((PROCESSED / "site_data.json").read_text(encoding="utf-8"))
    for name in SITE_TABLES:
        table = read(name).astype(object)
        table = table.where(table.notna(), None)
        assert bundle[name] == json.loads(json.dumps(to_records(table))), name
    assert bundle["meta"]["years"] == list(config.YEARS)
    assert [c["iso3"] for c in bundle["countries"]] == [
        c.iso3 for c in reference.SELECTED_COUNTRIES
    ]
    used_cities = {row["consulate_id"] for row in bundle["consulate_year"]}
    assert {c["consulate_id"] for c in bundle["consulates"]} == used_cities
    used_states = {row["schengen_state_iso2"] for row in bundle["country_state_year"]}
    assert used_states <= {s["iso2"] for s in bundle["states"]}
