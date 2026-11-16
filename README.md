# Schengen Access Map

Reproducible data pipeline and bilingual (EN/RU) interactive site about
uniform (Schengen) visas handled by consulates located in Armenia,
Azerbaijan, Belarus, Kazakhstan, Kyrgyzstan, Russia and Uzbekistan, 2019-2025.

Source: European Commission, Directorate-General for Migration and Home
Affairs, ["Short-stay visas issued by Schengen countries"](https://home-affairs.ec.europa.eu/policies/schengen/visa-policy/short-stay-visas-issued-schengen-countries_en),
yearly "Visa statistics for consulates" workbooks.

## Layout

| Path | Content |
| --- | --- |
| `data/sources.json` | URL and SHA-256 checksum of each source workbook |
| `data/raw/` | the seven source workbooks, as downloaded |
| `data/processed/` | pipeline output (CSV, JSON) with a data dictionary |
| `pipeline/` | Python package: download, extract, transform, validate, export |
| `tests/` | pytest suite for the pipeline and the processed data |
| `site/` | Vite + React + TypeScript site |
| `.github/workflows/ci.yml` | tests and deployment to GitHub Pages |

## Pipeline

Requires Python 3.11 or later.

```sh
python -m venv .venv && . .venv/bin/activate
pip install -r requirements.txt
python -m pipeline verify     # raw files match the checksums in the manifest
python -m pipeline build      # rebuild data/processed from data/raw
python -m pytest
python -m pipeline download   # re-fetch the workbooks; fails if a file changed
```

`build` is deterministic: a test rebuilds the tables and compares them with
the committed files byte for byte. If the Commission replaces a workbook,
`download` stops; review the new file, then run
`python -m pipeline download --accept-changes` and rebuild.

## Site

Requires Node.js 22.12 or later (developed with Node.js 26).

```sh
cd site
npm ci
npm run dev        # local server
npm test           # Vitest
npm run build      # type-check and build into site/dist
```

Every figure on the site is read from `data/processed/site_data.json`. The
site makes no request to another origin: the fonts (Manrope and JetBrains
Mono, SIL Open Font License) and the `world-atlas` TopoJSON are bundled.

The map is a globe (orthographic projection, `d3-geo`). Resting the pointer
on a coloured country, or moving keyboard focus to it, turns and zooms the
globe to that country; a click or tap shows its figures. The globe can be
dragged, glides when released, and returns to the whole-Earth view when the
pointer leaves. The play button steps through the years. Light and dark
themes follow the operating system, and motion is switched off when the
system asks for reduced motion.

### Deployment

The workflow deploys `site/dist` to GitHub Pages on every push to `main`.
In the repository settings choose Pages > Build and deployment > Source:
"GitHub Actions". The Vite `base` is `/<repository name>/`; set the
repository variable `BASE_PATH` (for example `/`) for a user site or a custom
domain.

## Method

- Only the sheet "Data for consulates" is used. It lists the States fully
  applying the Schengen acquis in the reporting year: 25 States in the
  2019-2022 files, Croatia from the 2023 file, Bulgaria and Romania from the
  2024 file (their figures there cover the period after 31 March 2024,
  according to that file).
- National short-stay visas of Bulgaria, Croatia, Cyprus and Romania are
  published on a separate sheet and are excluded. Cyprus is not part of the
  Schengen area and is excluded for every year. Ireland is not in the source.
- Figures refer to the location of the consulate, not to the nationality of
  applicants.
- Countries in scope: nationals required a visa for the whole 2019-2025
  period (Regulation (EU) 2018/1806, Annex I). Tajikistan and Turkmenistan
  are listed as reserves in `pipeline/reference.py` and are not processed.
- Counts are copied or summed from the source. Share of MEVs = MEVs issued /
  uniform visas issued. Not issued rate = uniform visas not issued /
  (uniform visas issued + LTVs issued + uniform visas not issued). This is
  the formula of the 2020-2025 files and is applied to every year; the 2019
  file divides by applications, and its printed value is kept in
  `country_year.csv` as `not_issued_rate_source`.
- An empty source cell stays empty (`null`), is never replaced by zero, and
  is shown as "no data" / "нет данных".
- Checks: the data rows are reconciled with the "Total worldwide" row and
  with the sheet "Totals - third country" of each file. One inconsistency
  inside the 2024 file (LTVs in the "Total worldwide" row) is pinned in
  `pipeline/config.py` and recorded in `validation_report.json`.
- City names follow the source; "NUR-SULTAN"/"ASTANA" and
  "NOVOROSSIISK"/"NOVOROSSIYSK" are shown under one name each.
- Map boundaries come from Natural Earth via `world-atlas` and are used
  unchanged, for orientation only. They do not express a position on the
  status of any territory.

See `data/processed/README.md` for the column definitions.
