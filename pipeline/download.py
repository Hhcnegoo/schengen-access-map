"""Fetch the yearly workbooks listed in ``data/sources.json`` and pin them.

Each file is identified by its SHA-256 checksum. A download whose checksum
differs from the manifest is rejected unless the change is accepted
explicitly, so processed data always traces back to known inputs.
"""

from __future__ import annotations

import hashlib
import json
import ssl
import time
import urllib.error
import urllib.request
from datetime import date
from pathlib import Path
from typing import Any

import certifi

from . import config

USER_AGENT = "schengen-access-map-pipeline/1.0"
TIMEOUT_SECONDS = 120
#: The server answers bursts of requests with HTTP 429, so downloads are
#: spaced out and retried with a growing delay.
PAUSE_BETWEEN_FILES_SECONDS = 2.0
MAX_ATTEMPTS = 4
RETRY_STATUS_CODES = frozenset({429, 500, 502, 503, 504})


class SourceChangedError(RuntimeError):
    """A raw file does not match the checksum recorded in the manifest."""


def load_sources(path: Path = config.SOURCES_FILE) -> dict[str, Any]:
    """Read the source manifest."""
    return json.loads(path.read_text(encoding="utf-8"))


def sha256_of(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def verify_raw_files(
    sources: dict[str, Any], raw_dir: Path = config.RAW_DIR
) -> dict[int, Path]:
    """Return year -> raw file path after checking every checksum."""
    paths: dict[int, Path] = {}
    for entry in sources["files"]:
        path = raw_dir / entry["local_filename"]
        if not path.exists():
            raise FileNotFoundError(
                f"{path} is missing; run `python -m pipeline download` to fetch it"
            )
        digest = sha256_of(path.read_bytes())
        if digest != entry["sha256"]:
            raise SourceChangedError(
                f"{path.name}: sha256 {digest} does not match the manifest ({entry['sha256']})"
            )
        paths[int(entry["year"])] = path
    return paths


def fetch(url: str) -> bytes:
    """Download ``url`` and return the response body, retrying on overload."""
    request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    # certifi supplies the CA bundle: some Python builds ship without one.
    context = ssl.create_default_context(cafile=certifi.where())
    for attempt in range(1, MAX_ATTEMPTS + 1):
        try:
            with urllib.request.urlopen(
                request, timeout=TIMEOUT_SECONDS, context=context
            ) as response:
                return response.read()
        except urllib.error.HTTPError as error:
            if error.code not in RETRY_STATUS_CODES or attempt == MAX_ATTEMPTS:
                raise
            retry_after = error.headers.get("Retry-After", "")
            delay = float(retry_after) if retry_after.isdigit() else 5.0 * 2 ** (attempt - 1)
            time.sleep(delay)
    raise AssertionError("unreachable")


def download_all(
    *,
    accept_changes: bool = False,
    sources_path: Path = config.SOURCES_FILE,
    raw_dir: Path = config.RAW_DIR,
) -> list[str]:
    """Download every file in the manifest; return one status line per file."""
    sources = load_sources(sources_path)
    raw_dir.mkdir(parents=True, exist_ok=True)
    messages: list[str] = []
    manifest_changed = False
    for position, entry in enumerate(sources["files"]):
        if position:
            time.sleep(PAUSE_BETWEEN_FILES_SECONDS)
        path = raw_dir / entry["local_filename"]
        data = fetch(entry["url"])
        digest = sha256_of(data)
        if digest == entry["sha256"]:
            path.write_bytes(data)
            messages.append(f"{entry['year']}: ok ({len(data)} bytes)")
            continue
        if not accept_changes:
            raise SourceChangedError(
                f"{entry['year']}: the published file changed since {entry['retrieved']} "
                f"(sha256 {digest}, manifest {entry['sha256']}). Review the new file, then "
                "re-run with --accept-changes to update the manifest."
            )
        path.write_bytes(data)
        entry.update(sha256=digest, bytes=len(data), retrieved=date.today().isoformat())
        manifest_changed = True
        messages.append(f"{entry['year']}: updated ({len(data)} bytes, sha256 {digest})")
    if manifest_changed:
        sources_path.write_text(
            json.dumps(sources, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
        )
    return messages
