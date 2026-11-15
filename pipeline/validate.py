"""Reconcile extracted and derived figures with the totals printed in the source.

Every check compares pipeline output with a figure the Commission published
in the same workbook. A failing check stops the build.
"""

from __future__ import annotations

from typing import Any, Sequence

import pandas as pd

from . import config, reference
from .extract import ExtractedYear
from .transform import attach_states, safe_ratio


class ValidationError(RuntimeError):
    """At least one reconciliation check failed."""


def _check(name: str, year: int, status: str, detail: str) -> dict[str, Any]:
    return {"check": name, "year": year, "status": status, "detail": detail}


def _column_sums(rows: pd.DataFrame) -> dict[str, int]:
    return {column: int(rows[column].sum()) for column in config.COUNT_COLUMNS}


def check_worldwide_total(item: ExtractedYear) -> list[dict[str, Any]]:
    """Sum of the data rows equals the main sheet's "Total worldwide" row."""
    results = []
    sums = _column_sums(item.rows)
    for column in config.COUNT_COLUMNS:
        printed = item.worldwide_total[column]
        name = f"worldwide_total.{column}"
        if printed == sums[column]:
            results.append(_check(name, item.year, "pass", f"{sums[column]}"))
            continue
        known = config.KNOWN_TOTAL_ROW_DISCREPANCIES.get((item.year, column))
        if known == {"total_row": printed, "sum_of_rows": sums[column]}:
            results.append(
                _check(
                    name,
                    item.year,
                    "known_discrepancy",
                    f"'Total worldwide' row prints {printed}; data rows sum to {sums[column]}",
                )
            )
        else:
            results.append(
                _check(
                    name,
                    item.year,
                    "fail",
                    f"'Total worldwide' row prints {printed}; data rows sum to {sums[column]}",
                )
            )
    return results


def check_third_country_totals(item: ExtractedYear) -> list[dict[str, Any]]:
    """Per-country sums of the data rows equal the "Totals - third country" sheet."""
    columns = list(config.COUNT_COLUMNS)
    ours = item.rows.groupby("country")[columns].sum().astype("int64")
    printed = item.third_country_totals.set_index("country")[columns].fillna(0).astype("int64")
    results = []
    if set(ours.index) != set(printed.index):
        only_rows = sorted(set(ours.index) - set(printed.index))
        only_totals = sorted(set(printed.index) - set(ours.index))
        results.append(
            _check(
                "third_country_totals.countries",
                item.year,
                "fail",
                f"only in data rows: {only_rows}; only in totals sheet: {only_totals}",
            )
        )
        return results
    differing = ours.ne(printed.loc[ours.index]).any(axis=1)
    if differing.any():
        results.append(
            _check(
                "third_country_totals.counts",
                item.year,
                "fail",
                f"sums differ for {sorted(differing[differing].index)}",
            )
        )
    else:
        results.append(
            _check(
                "third_country_totals.counts",
                item.year,
                "pass",
                f"{len(ours)} countries reconcile on {len(columns)} columns",
            )
        )
    sums = _column_sums(item.rows)
    grand = {column: item.grand_total[column] for column in columns}
    results.append(
        _check(
            "third_country_totals.grand_total",
            item.year,
            "pass" if grand == sums else "fail",
            f"grand total {grand}; data rows sum to {sums}",
        )
    )
    return results


def check_unique_entries(item: ExtractedYear) -> list[dict[str, Any]]:
    """Each (State, country, consulate) combination appears once."""
    key = ["schengen_state", "country", "consulate"]
    duplicated = item.rows[item.rows.duplicated(key, keep=False)]
    return [
        _check(
            "unique_entries",
            item.year,
            "pass" if duplicated.empty else "fail",
            f"{len(item.rows)} data rows"
            if duplicated.empty
            else f"duplicated entries: {duplicated[key].drop_duplicates().to_dict('records')}",
        )
    ]


def _spreadsheet_counts(rows: pd.DataFrame) -> pd.DataFrame:
    """Count columns with empty cells as zero, as spreadsheet formulas see them."""
    return rows[list(config.COUNT_COLUMNS)].fillna(0)


def _matches(candidate: pd.Series, printed: pd.Series) -> pd.Series:
    """Per printed ratio: does the candidate formula reproduce it?"""
    close = (candidate - printed).abs() <= config.RATIO_TOLERANCE
    return close[printed.notna()].fillna(False).astype(bool)


def source_rate_denominator(rows: pd.DataFrame) -> str | None:
    """Identify how the file computes "Not issued rate for uniform visas".

    Returns ``"decisions"`` when every printed rate equals not issued /
    (issued + LTVs + not issued), ``"applications"`` when every printed rate
    equals not issued / applied for, and ``None`` when neither holds.
    """
    printed = rows["not_issued_rate_source"]
    if not printed.notna().any():
        return None
    counts = _spreadsheet_counts(rows)
    not_issued = counts["uniform_not_issued"]
    candidates = {
        "decisions": safe_ratio(
            not_issued, counts["uniform_issued"] + counts["ltv_issued"] + not_issued
        ),
        "applications": safe_ratio(not_issued, counts["uniform_applied"]),
    }
    for label, candidate in candidates.items():
        if _matches(candidate, printed).all():
            return label
    return None


def check_ratio_formulas(item: ExtractedYear) -> tuple[list[dict[str, Any]], str | None]:
    """Identify the formulas behind the ratio columns of the source rows."""
    results = []
    denominator = source_rate_denominator(item.rows)
    results.append(
        _check(
            "source_formula.not_issued_rate",
            item.year,
            "pass" if denominator else "fail",
            f"source rows compute the rate over {denominator}"
            if denominator
            else "printed rates match neither known formula",
        )
    )
    counts = _spreadsheet_counts(item.rows)
    matches = _matches(
        safe_ratio(counts["mev_issued"], counts["uniform_issued"]),
        item.rows["mev_share_source"],
    )
    results.append(
        _check(
            "source_formula.mev_share",
            item.year,
            "pass" if matches.all() else "fail",
            f"{int(matches.sum())} of {len(matches)} printed shares equal MEVs issued / "
            "uniform visas issued",
        )
    )
    return results, denominator


def check_country_ratios(
    item: ExtractedYear,
    country_year: pd.DataFrame,
    countries: Sequence[reference.Country],
    denominator: str | None,
) -> list[dict[str, Any]]:
    """Derived country ratios equal the ratios printed in the totals sheet."""
    results = []
    printed = item.third_country_totals.set_index("country")
    ours = country_year[country_year["year"] == item.year].set_index("country_iso3")
    for country in countries:
        source_name = next(name for name in country.source_names if name in printed.index)
        row = printed.loc[source_name]
        mine = ours.loc[country.iso3]
        for column, source_column, numerator in (
            ("mev_share", "mev_share_source", "mev_issued"),
            ("not_issued_rate", "not_issued_rate_source", "uniform_not_issued"),
        ):
            name = f"country_ratio.{column}.{country.iso3}"
            theirs = row[source_column]
            value = mine[column]
            if pd.isna(theirs) and pd.isna(value):
                results.append(_check(name, item.year, "pass", "missing in both"))
            elif pd.isna(value) and pd.isna(mine[numerator]) and float(theirs) == 0.0:
                results.append(
                    _check(
                        name,
                        item.year,
                        "blank_in_source",
                        "source prints 0 although every underlying cell is empty; "
                        "the derived ratio stays missing",
                    )
                )
            elif pd.isna(theirs) or pd.isna(value):
                results.append(
                    _check(name, item.year, "fail", f"derived {value}; source prints {theirs}")
                )
            elif abs(float(value) - float(theirs)) <= config.RATIO_TOLERANCE:
                results.append(_check(name, item.year, "pass", f"{float(value)!r}"))
            elif (
                column == "not_issued_rate"
                and denominator == "applications"
                and abs(mine["uniform_not_issued"] / mine["uniform_applied"] - float(theirs))
                <= config.RATIO_TOLERANCE
            ):
                results.append(
                    _check(
                        name,
                        item.year,
                        "definition_differs",
                        f"derived over decisions {float(value)!r}; "
                        f"source prints {float(theirs)!r} over applications",
                    )
                )
            else:
                results.append(
                    _check(name, item.year, "fail", f"derived {value}; source prints {theirs}")
                )
    return results


def validate(
    extracted: Sequence[ExtractedYear],
    tables: dict[str, pd.DataFrame],
    countries: Sequence[reference.Country] = reference.SELECTED_COUNTRIES,
) -> dict[str, Any]:
    """Run every check and return the report; raise if any check fails."""
    checks: list[dict[str, Any]] = []
    years: list[dict[str, Any]] = []
    for item in extracted:
        checks += check_worldwide_total(item)
        checks += check_third_country_totals(item)
        checks += check_unique_entries(item)
        formula_checks, denominator = check_ratio_formulas(item)
        checks += formula_checks
        checks += check_country_ratios(item, tables["country_year"], countries, denominator)
        years.append(
            {
                "year": item.year,
                "data_rows": int(len(item.rows)),
                "countries_of_consulate_location": int(item.rows["country"].nunique()),
                "reporting_states": sorted(attach_states(item.rows)["schengen_state_iso2"].unique()),
                "source_not_issued_rate_denominator": denominator,
            }
        )

    summary: dict[str, int] = {}
    for check in checks:
        summary[check["status"]] = summary.get(check["status"], 0) + 1
    report = {
        "summary": dict(sorted(summary.items())),
        "years": years,
        "exceptions": [check for check in checks if check["status"] != "pass"],
    }
    failed = [check for check in checks if check["status"] == "fail"]
    if failed:
        lines = "\n".join(
            f"  {check['year']} {check['check']}: {check['detail']}" for check in failed
        )
        raise ValidationError(f"{len(failed)} validation check(s) failed:\n{lines}")
    return report
