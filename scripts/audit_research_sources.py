"""Read-only audit helper for the authoritative research notebook and workbook."""

from __future__ import annotations

import argparse
import json
from pathlib import Path

import pandas as pd


SEARCH_TERMS = (
    "selected model",
    "final model",
    "method 2b",
    "temporal evaluation",
    "2024 temporal",
    "cv uncertainty",
    "feature dictionary",
    "global importance",
    "reduced xgboost",
    "research question",
)


def output_text(cell: dict) -> str:
    chunks: list[str] = []
    for output in cell.get("outputs", []):
        if "text" in output:
            value = output["text"]
            chunks.append("".join(value) if isinstance(value, list) else str(value))
        data = output.get("data", {})
        for mime in ("text/plain", "text/markdown"):
            if mime in data:
                value = data[mime]
                chunks.append("".join(value) if isinstance(value, list) else str(value))
    return "\n".join(chunks)


def audit_notebook(path: Path) -> None:
    notebook = json.loads(path.read_text(encoding="utf-8"))
    print(f"NOTEBOOK {path.name} cells={len(notebook['cells'])}")
    for index, cell in enumerate(notebook["cells"]):
        source = "".join(cell.get("source", []))
        if cell.get("cell_type") == "markdown":
            for line in source.splitlines():
                if line.startswith("#"):
                    print(f"HEADING cell={index}: {line[:240]}")
        combined = f"{source}\n{output_text(cell)}"
        if any(term in combined.lower() for term in SEARCH_TERMS):
            compact = "\n".join(line.rstrip() for line in combined.splitlines())
            print(f"\nMATCH cell={index}\n{compact[:2400]}\n")


def audit_workbook(path: Path) -> None:
    workbook = pd.ExcelFile(path)
    print(f"WORKBOOK {path.name} sheets={workbook.sheet_names}")
    for sheet_name in workbook.sheet_names:
        table = pd.read_excel(path, sheet_name=sheet_name, header=4)
        table = table.dropna(how="all")
        print(
            f"SHEET {sheet_name}: rows={len(table)} columns={len(table.columns)} "
            f"fields={list(table.columns)}"
        )


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--notebook", type=Path, required=True)
    parser.add_argument("--workbook", type=Path, required=True)
    args = parser.parse_args()
    audit_notebook(args.notebook)
    audit_workbook(args.workbook)


if __name__ == "__main__":
    main()
