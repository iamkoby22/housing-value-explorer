"""Deterministically export the compact State-PUMA lookup used at inference."""

from __future__ import annotations

import hashlib
import json
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
STATE_FIPS = ("06", "12", "36", "47", "48")
OUTPUT = ROOT / "model_artifacts" / "puma-local-drivers.json"


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def build_payload() -> dict[str, Any]:
    data: dict[str, list[dict[str, Any]]] = {}
    sources = []
    for state_fips in STATE_FIPS:
        path = ROOT / "public" / "data" / f"puma-shap-{state_fips}.json"
        source = json.loads(path.read_text(encoding="utf-8"))
        sources.append({"path": path.relative_to(ROOT).as_posix(), "sha256": sha256(path)})
        for row in source["data"]:
            data[row["state_puma_id"]] = row["top_non_geographic_features"]

    return {
        "metadata": {
            "generated_by": "scripts/export_inference_runtime.py",
            "scientific_role": "Lossless runtime projection of existing State-PUMA SHAP summaries",
            "sources": sources,
            "records": len(data),
        },
        "data": dict(sorted(data.items())),
    }


def main() -> None:
    payload = build_payload()
    with OUTPUT.open("w", encoding="utf-8", newline="\n") as output:
        output.write(json.dumps(payload, ensure_ascii=False, separators=(",", ":")) + "\n")
    print(f"Wrote {OUTPUT} ({OUTPUT.stat().st_size:,} bytes).")


if __name__ == "__main__":
    main()
