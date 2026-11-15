"""The reference tables are complete and unambiguous."""

from __future__ import annotations

import re

from pipeline import reference

ALL_COUNTRIES = reference.SELECTED_COUNTRIES + reference.RESERVE_COUNTRIES


def test_selected_countries_match_the_project_scope() -> None:
    assert [country.iso3 for country in reference.SELECTED_COUNTRIES] == [
        "BLR",
        "RUS",
        "ARM",
        "AZE",
        "KAZ",
        "UZB",
        "KGZ",
    ]
    assert [country.iso3 for country in reference.RESERVE_COUNTRIES] == ["TJK", "TKM"]


def test_codes_are_well_formed_and_unique() -> None:
    iso3 = [country.iso3 for country in ALL_COUNTRIES]
    iso2 = [state.iso2 for state in reference.SCHENGEN_STATES]
    numeric = [item.iso_n3 for item in ALL_COUNTRIES + reference.SCHENGEN_STATES]
    assert len(set(iso3)) == len(iso3)
    assert len(set(iso2)) == len(iso2)
    assert len(set(numeric)) == len(numeric)
    assert all(re.fullmatch(r"[A-Z]{3}", code) for code in iso3)
    assert all(re.fullmatch(r"[A-Z]{2}", code) for code in iso2)
    assert all(re.fullmatch(r"\d{3}", code) for code in numeric)


def test_every_entry_has_both_display_names() -> None:
    for item in ALL_COUNTRIES + reference.SCHENGEN_STATES + reference.CONSULATE_CITIES:
        assert item.name_en.strip()
        assert re.search(r"[А-Яа-яЁё]", item.name_ru), item


def test_source_names_are_unambiguous() -> None:
    country_names = [name for country in ALL_COUNTRIES for name in country.source_names]
    state_names = [name for state in reference.SCHENGEN_STATES for name in state.source_names]
    city_names = [
        (city.country_iso3, name)
        for city in reference.CONSULATE_CITIES
        for name in city.source_names
    ]
    assert len(set(country_names)) == len(country_names)
    assert len(set(state_names)) == len(state_names)
    assert len(set(city_names)) == len(city_names)
    assert all(name == name.upper().strip() for name in country_names)


def test_each_listed_spelling_is_caught_by_a_stem_of_its_own_country_only() -> None:
    for country in ALL_COUNTRIES:
        for name in country.source_names:
            assert any(stem in name for stem in country.stems)
            for other in ALL_COUNTRIES:
                if other is not country:
                    assert not any(stem in name for stem in other.stems)


def test_cities_belong_to_known_countries_and_have_unique_ids() -> None:
    known = {country.iso3 for country in ALL_COUNTRIES}
    ids = [city.city_id for city in reference.CONSULATE_CITIES]
    assert len(set(ids)) == len(ids)
    assert all(city.country_iso3 in known for city in reference.CONSULATE_CITIES)
    assert all(re.fullmatch(r"[a-z]+(-[a-z]+)*", city_id) for city_id in ids)
