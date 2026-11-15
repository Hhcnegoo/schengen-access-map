"""Reference tables: countries of consulate location, Schengen States, cities.

These tables hold identifiers and display names only. They contain no
statistics. Every source spelling that the pipeline accepts is listed here, so
an unexpected spelling in a new yearly file stops the build instead of being
dropped silently.
"""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class Country:
    """A country where consulates are located."""

    iso3: str
    iso_n3: str  # ISO 3166-1 numeric, used as feature id by world-atlas
    name_en: str
    name_ru: str
    source_names: tuple[str, ...]  # exact spellings (upper case) in the source
    stems: tuple[str, ...]  # fragments used to detect unlisted spellings


@dataclass(frozen=True)
class SchengenState:
    """A State whose consulates report in the main sheet."""

    iso2: str
    iso_n3: str
    name_en: str
    name_ru: str
    source_names: tuple[str, ...]


@dataclass(frozen=True)
class ConsulateCity:
    """A city where at least one consulate is located."""

    city_id: str
    country_iso3: str
    name_en: str
    name_ru: str
    source_names: tuple[str, ...]  # upper case; several when spellings changed


#: Countries in scope. Selection criterion: nationals required a Schengen visa
#: during the whole 2019-2025 period (Regulation (EU) 2018/1806, Annex I).
SELECTED_COUNTRIES: tuple[Country, ...] = (
    Country("BLR", "112", "Belarus", "Беларусь", ("BELARUS",), ("BELARUS", "BELORUS", "BYELORUS")),
    Country("RUS", "643", "Russia", "Россия", ("RUSSIAN FEDERATION",), ("RUSSIA",)),
    Country("ARM", "051", "Armenia", "Армения", ("ARMENIA",), ("ARMENIA",)),
    Country("AZE", "031", "Azerbaijan", "Азербайджан", ("AZERBAIJAN",), ("AZERBAI",)),
    Country("KAZ", "398", "Kazakhstan", "Казахстан", ("KAZAKHSTAN",), ("KAZAKH", "KAZAKS")),
    Country("UZB", "860", "Uzbekistan", "Узбекистан", ("UZBEKISTAN",), ("UZBEK",)),
    Country("KGZ", "417", "Kyrgyzstan", "Кыргызстан", ("KYRGYZSTAN",), ("KYRGYZ", "KIRGHIZ", "KIRGIZ")),
)

#: Countries that meet the same criterion and can replace a selected country.
#: They are not processed unless moved into ``SELECTED_COUNTRIES``.
RESERVE_COUNTRIES: tuple[Country, ...] = (
    Country("TJK", "762", "Tajikistan", "Таджикистан", ("TAJIKISTAN",), ("TAJIK", "TADJIK")),
    Country("TKM", "795", "Turkmenistan", "Туркменистан", ("TURKMENISTAN",), ("TURKMEN",)),
)

SCHENGEN_STATES: tuple[SchengenState, ...] = (
    SchengenState("AT", "040", "Austria", "Австрия", ("Austria",)),
    SchengenState("BE", "056", "Belgium", "Бельгия", ("Belgium",)),
    SchengenState("BG", "100", "Bulgaria", "Болгария", ("Bulgaria",)),
    SchengenState("HR", "191", "Croatia", "Хорватия", ("Croatia",)),
    SchengenState("CZ", "203", "Czechia", "Чехия", ("Czech Republic",)),
    SchengenState("DK", "208", "Denmark", "Дания", ("Denmark",)),
    SchengenState("EE", "233", "Estonia", "Эстония", ("Estonia",)),
    SchengenState("FI", "246", "Finland", "Финляндия", ("Finland",)),
    SchengenState("FR", "250", "France", "Франция", ("France",)),
    SchengenState("DE", "276", "Germany", "Германия", ("Germany",)),
    SchengenState("GR", "300", "Greece", "Греция", ("Greece",)),
    SchengenState("HU", "348", "Hungary", "Венгрия", ("Hungary",)),
    SchengenState("IS", "352", "Iceland", "Исландия", ("Iceland",)),
    SchengenState("IT", "380", "Italy", "Италия", ("Italy",)),
    SchengenState("LV", "428", "Latvia", "Латвия", ("Latvia",)),
    SchengenState("LT", "440", "Lithuania", "Литва", ("Lithuania",)),
    SchengenState("LU", "442", "Luxembourg", "Люксембург", ("Luxembourg",)),
    SchengenState("MT", "470", "Malta", "Мальта", ("Malta",)),
    SchengenState("NL", "528", "Netherlands", "Нидерланды", ("Netherlands",)),
    SchengenState("NO", "578", "Norway", "Норвегия", ("Norway",)),
    SchengenState("PL", "616", "Poland", "Польша", ("Poland",)),
    SchengenState("PT", "620", "Portugal", "Португалия", ("Portugal",)),
    SchengenState("RO", "642", "Romania", "Румыния", ("Romania",)),
    SchengenState("SK", "703", "Slovakia", "Словакия", ("Slovakia",)),
    SchengenState("SI", "705", "Slovenia", "Словения", ("Slovenia",)),
    SchengenState("ES", "724", "Spain", "Испания", ("Spain",)),
    SchengenState("SE", "752", "Sweden", "Швеция", ("Sweden",)),
    SchengenState("CH", "756", "Switzerland", "Швейцария", ("Switzerland",)),
)

#: Cities are listed for selected and reserve countries. Two source spellings
#: are merged where the files use different names for the same city.
CONSULATE_CITIES: tuple[ConsulateCity, ...] = (
    ConsulateCity("brest", "BLR", "Brest", "Брест", ("BREST",)),
    ConsulateCity("grodno", "BLR", "Grodno", "Гродно", ("GRODNO",)),
    ConsulateCity("minsk", "BLR", "Minsk", "Минск", ("MINSK",)),
    ConsulateCity("vitsyebsk", "BLR", "Vitsyebsk", "Витебск", ("VITSYEBSK",)),
    ConsulateCity("irkutsk", "RUS", "Irkutsk", "Иркутск", ("IRKUTSK",)),
    ConsulateCity("kaliningrad", "RUS", "Kaliningrad", "Калининград", ("KALININGRAD",)),
    ConsulateCity("kazan", "RUS", "Kazan", "Казань", ("KAZAN",)),
    ConsulateCity("moscow", "RUS", "Moscow", "Москва", ("MOSCOW",)),
    ConsulateCity("murmansk", "RUS", "Murmansk", "Мурманск", ("MURMANSK",)),
    ConsulateCity(
        "novorossiysk", "RUS", "Novorossiysk", "Новороссийск", ("NOVOROSSIYSK", "NOVOROSSIISK")
    ),
    ConsulateCity("novosibirsk", "RUS", "Novosibirsk", "Новосибирск", ("NOVOSIBIRSK",)),
    ConsulateCity("petrozavodsk", "RUS", "Petrozavodsk", "Петрозаводск", ("PETROZAVODSK",)),
    ConsulateCity("pskov", "RUS", "Pskov", "Псков", ("PSKOV",)),
    ConsulateCity("sovetsk", "RUS", "Sovetsk", "Советск", ("SOVETSK",)),
    ConsulateCity(
        "st-petersburg", "RUS", "St. Petersburg", "Санкт-Петербург", ("ST. PETERSBURG",)
    ),
    ConsulateCity("yekaterinburg", "RUS", "Yekaterinburg", "Екатеринбург", ("YEKATERINBURG",)),
    ConsulateCity("yerevan", "ARM", "Yerevan", "Ереван", ("YEREVAN",)),
    ConsulateCity("baku", "AZE", "Baku", "Баку", ("BAKU",)),
    ConsulateCity("almaty", "KAZ", "Almaty", "Алматы", ("ALMATY",)),
    ConsulateCity("astana", "KAZ", "Astana", "Астана", ("ASTANA", "NUR-SULTAN")),
    ConsulateCity("tashkent", "UZB", "Tashkent", "Ташкент", ("TASHKENT",)),
    ConsulateCity("bishkek", "KGZ", "Bishkek", "Бишкек", ("BISHKEK",)),
    ConsulateCity("dushanbe", "TJK", "Dushanbe", "Душанбе", ("DUSHANBE",)),
    ConsulateCity("ashgabat", "TKM", "Ashgabat", "Ашхабад", ("ASHGABAT",)),
)


def state_by_source_name() -> dict[str, SchengenState]:
    """Map each accepted source spelling to its Schengen State."""
    return {name: state for state in SCHENGEN_STATES for name in state.source_names}


def city_by_source_name() -> dict[tuple[str, str], ConsulateCity]:
    """Map ``(country_iso3, source spelling)`` to its city."""
    return {
        (city.country_iso3, name): city for city in CONSULATE_CITIES for name in city.source_names
    }
