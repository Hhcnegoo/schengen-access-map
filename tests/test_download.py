"""Raw files are pinned by checksum; a changed file is never accepted silently."""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from pipeline import config, download


@pytest.fixture
def manifest(tmp_path: Path) -> Path:
    path = tmp_path / "sources.json"
    path.write_text(
        json.dumps(
            {
                "publisher": "test",
                "source_page": "https://example.invalid/page",
                "files": [
                    {
                        "year": 2021,
                        "url": "https://example.invalid/2021.xlsx",
                        "source_filename": "2021.xlsx",
                        "local_filename": "consulates_2021.xlsx",
                        "sha256": download.sha256_of(b"published bytes"),
                        "bytes": 15,
                        "retrieved": "2026-01-01",
                    }
                ],
            }
        ),
        encoding="utf-8",
    )
    return path


def test_matching_download_is_stored(manifest: Path, tmp_path: Path, monkeypatch) -> None:
    monkeypatch.setattr(download, "fetch", lambda url: b"published bytes")
    raw_dir = tmp_path / "raw"
    messages = download.download_all(sources_path=manifest, raw_dir=raw_dir)
    assert messages == ["2021: ok (15 bytes)"]
    paths = download.verify_raw_files(download.load_sources(manifest), raw_dir)
    assert paths[2021].read_bytes() == b"published bytes"


def test_changed_file_is_rejected_and_not_stored(manifest: Path, tmp_path: Path, monkeypatch) -> None:
    monkeypatch.setattr(download, "fetch", lambda url: b"revised bytes")
    raw_dir = tmp_path / "raw"
    before = manifest.read_text(encoding="utf-8")
    with pytest.raises(download.SourceChangedError, match="--accept-changes"):
        download.download_all(sources_path=manifest, raw_dir=raw_dir)
    assert not (raw_dir / "consulates_2021.xlsx").exists()
    assert manifest.read_text(encoding="utf-8") == before


def test_accepting_a_change_updates_the_manifest(manifest: Path, tmp_path: Path, monkeypatch) -> None:
    monkeypatch.setattr(download, "fetch", lambda url: b"revised bytes")
    raw_dir = tmp_path / "raw"
    download.download_all(accept_changes=True, sources_path=manifest, raw_dir=raw_dir)
    entry = download.load_sources(manifest)["files"][0]
    assert entry["sha256"] == download.sha256_of(b"revised bytes")
    assert entry["bytes"] == 13
    assert entry["retrieved"] != "2026-01-01"
    download.verify_raw_files(download.load_sources(manifest), raw_dir)


def test_verification_detects_a_modified_or_missing_raw_file(manifest: Path, tmp_path: Path) -> None:
    raw_dir = tmp_path / "raw"
    raw_dir.mkdir()
    sources = download.load_sources(manifest)
    with pytest.raises(FileNotFoundError):
        download.verify_raw_files(sources, raw_dir)
    (raw_dir / "consulates_2021.xlsx").write_bytes(b"something else")
    with pytest.raises(download.SourceChangedError):
        download.verify_raw_files(sources, raw_dir)


def test_manifest_lists_one_file_per_project_year() -> None:
    sources = download.load_sources()
    assert [entry["year"] for entry in sources["files"]] == list(config.YEARS)
    assert all(entry["url"].startswith("https://home-affairs.ec.europa.eu/") for entry in sources["files"])
    assert len({entry["sha256"] for entry in sources["files"]}) == len(config.YEARS)
