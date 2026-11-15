"""Select the countries in scope, attach identifiers, aggregate, derive ratios.

Sums add up the values reported in the source. An empty source cell adds
nothing to a sum, and a sum over empty cells only is itself missing. The two
ratios are recomputed from the sums with the formulas given in
``add_ratios``; no other figure is derived.
"""

from __future__ import annotations

from typing import Sequence

import pandas as pd

from . import config, reference
from .extract import ExtractedYear, SourceFormatError

RATIO_COLUMNS: tuple[str, ...] = ("mev_share", "not_issued_rate")
BLANK_COLUMNS: tuple[str, ...] = tuple(f"blank_{column}" for column in config.COUNT_COLUMNS)


def safe_ratio(numerator: pd.Series, denominator: pd.Series) -> pd.Series:
    """Divide two series; missing unless both exist and the denominator is > 0."""
    top = numerator.astype("Float64")
    bottom = denominator.astype("Float64")
    valid = (top.notna() & bottom.notna() & (bottom > 0)).fillna(False).astype(bool)
    result = pd.Series(pd.NA, index=numerator.index, dtype="Float64")
    result[valid] = top[valid] / bottom[valid]
    return result


def add_ratios(frame: pd.DataFrame) -> pd.DataFrame:
    """Add the share of MEVs and the not issued rate for uniform visas.

    * ``mev_share`` = MEVs issued / uniform visas issued.
    * ``not_issued_rate`` = uniform visas not issued /
      (uniform visas issued + LTVs issued + uniform visas not issued).

    These are the formulas behind the ratio columns of the 2020-2025 source
    files. An empty LTV cell counts as no LTVs in the denominator, as it does
    in the source; an empty "issued" or "not issued" cell leaves the rate
    missing.
    """
    frame = frame.copy()
    frame["mev_share"] = safe_ratio(frame["mev_issued"], frame["uniform_issued"])
    decisions = (
        frame["uniform_issued"] + frame["ltv_issued"].fillna(0) + frame["uniform_not_issued"]
    )
    frame["not_issued_rate"] = safe_ratio(frame["uniform_not_issued"], decisions)
    return frame


def attach_states(rows: pd.DataFrame) -> pd.DataFrame:
    """Add ``schengen_state_iso2``; an unlisted State name stops the build."""
    by_name = reference.state_by_source_name()
    unknown = sorted(set(rows["schengen_state"]) - set(by_name))
    if unknown:
        raise SourceFormatError(f"Schengen State names missing from the reference: {unknown}")
    rows = rows.copy()
    rows["schengen_state_iso2"] = rows["schengen_state"].map(
        {name: state.iso2 for name, state in by_name.items()}
    )
    return rows


def select_countries(
    rows: pd.DataFrame, countries: Sequence[reference.Country]
) -> pd.DataFrame:
    """Keep the rows of consulates located in ``countries``.

    A country name that resembles a selected country without being one of its
    listed spellings stops the build, so a renamed country cannot drop out
    unnoticed.
    """
    by_name = {name: country for country in countries for name in country.source_names}
    for name in sorted(set(rows["country"]) - set(by_name)):
        for country in countries:
            if any(stem in name for stem in country.stems):
                raise SourceFormatError(
                    f"country name {name!r} resembles {country.name_en} "
                    "but is not a listed source spelling"
                )
    selected = rows[rows["country"].isin(set(by_name))].copy()
    selected["country_iso3"] = selected["country"].map(
        {name: country.iso3 for name, country in by_name.items()}
    )
    for year, in_year in selected.groupby("year"):
        absent = sorted({c.iso3 for c in countries} - set(in_year["country_iso3"]))
        if absent:
            raise SourceFormatError(f"{year}: no consulate rows for {absent}")
    return selected


def attach_cities(selected: pd.DataFrame) -> pd.DataFrame:
    """Add ``consulate_id``, merging the listed spellings of one city."""
    by_name = reference.city_by_source_name()
    keys = list(zip(selected["country_iso3"], selected["consulate"]))
    unknown = sorted(set(keys) - set(by_name))
    if unknown:
        raise SourceFormatError(f"consulate cities missing from the reference: {unknown}")
    selected = selected.copy()
    selected["consulate_id"] = [by_name[key].city_id for key in keys]
    entry_key = ["year", "country_iso3", "schengen_state_iso2", "consulate_id"]
    duplicated = selected[selected.duplicated(entry_key, keep=False)]
    if not duplicated.empty:
        raise SourceFormatError(
            "two source rows map to the same consulate entry: "
            f"{duplicated[entry_key + ['consulate']].to_dict('records')}"
        )
    return selected


def aggregate(selected: pd.DataFrame, keys: list[str]) -> pd.DataFrame:
    """Sum the count columns over ``keys`` and recompute the ratios."""
    grouped = selected.groupby(keys, sort=True)
    result = grouped[list(config.COUNT_COLUMNS)].sum(min_count=1).astype("Int64")
    result.insert(0, "consulate_entries", grouped.size().astype("int64"))

    with_applications = selected[(selected["uniform_applied"] > 0).fillna(False).astype(bool)]
    with_grouped = with_applications.groupby(keys, sort=True)
    result.insert(
        1,
        "consulates_with_applications",
        with_grouped.size().reindex(result.index, fill_value=0).astype("int64"),
    )
    if "schengen_state_iso2" not in keys:
        result.insert(2, "states_listed", grouped["schengen_state_iso2"].nunique().astype("int64"))
        result.insert(
            3,
            "states_with_applications",
            with_grouped["schengen_state_iso2"]
            .nunique()
            .reindex(result.index, fill_value=0)
            .astype("int64"),
        )
    for column in config.COUNT_COLUMNS:
        result[f"blank_{column}"] = (
            selected[column].isna().groupby([selected[key] for key in keys]).sum().astype("int64")
        )
    result = add_ratios(result.reset_index())
    leading = [column for column in result.columns if column not in BLANK_COLUMNS]
    return result[leading + list(BLANK_COLUMNS)]


def reporting_states(all_rows: pd.DataFrame, selected: pd.DataFrame) -> pd.DataFrame:
    """List the States present in the main sheet of each yearly file."""
    worldwide = all_rows.groupby(["year", "schengen_state_iso2"], sort=True).size()
    in_scope = selected.groupby(["year", "schengen_state_iso2"], sort=True).size()
    result = worldwide.rename("consulate_entries_worldwide").to_frame()
    result["consulate_entries_selected_countries"] = in_scope.reindex(
        result.index, fill_value=0
    )
    return result.astype("int64").reset_index()


def build_tables(
    extracted: Sequence[ExtractedYear],
    countries: Sequence[reference.Country] = reference.SELECTED_COUNTRIES,
) -> dict[str, pd.DataFrame]:
    """Build every processed table from the extracted yearly workbooks."""
    all_rows = attach_states(pd.concat([item.rows for item in extracted], ignore_index=True))
    selected = attach_cities(select_countries(all_rows, countries))

    consulate_year = add_ratios(selected).rename(
        columns={"consulate": "consulate_source_name"}
    )[
        [
            "year",
            "country_iso3",
            "schengen_state_iso2",
            "consulate_id",
            "consulate_source_name",
            "source_row",
            *config.COUNT_COLUMNS,
            *RATIO_COLUMNS,
        ]
    ].sort_values(["year", "country_iso3", "schengen_state_iso2", "consulate_id"])

    country_year = aggregate(selected, ["year", "country_iso3"])
    published = pd.concat([item.third_country_totals for item in extracted], ignore_index=True)
    by_name = {name: country.iso3 for country in countries for name in country.source_names}
    published = published[published["country"].isin(set(by_name))].assign(
        country_iso3=lambda frame: frame["country"].map(by_name)
    )
    country_year = country_year.merge(
        published[["year", "country_iso3", "not_issued_rate_source"]],
        on=["year", "country_iso3"],
        how="left",
        validate="one_to_one",
    )

    tables = {
        "consulate_year": consulate_year,
        "country_state_year": aggregate(selected, ["year", "country_iso3", "schengen_state_iso2"]),
        "country_year": country_year,
        "state_year": aggregate(selected, ["year", "schengen_state_iso2"]),
        "total_year": aggregate(selected, ["year"]),
        "reporting_states": reporting_states(all_rows, selected),
    }
    return {name: table.reset_index(drop=True) for name, table in tables.items()}
