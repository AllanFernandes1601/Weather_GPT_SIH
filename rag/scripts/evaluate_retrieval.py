#!/usr/bin/env python3
"""Run deterministic WeatherGPT retrieval checks against known dataset facts."""

from __future__ import annotations

import json
import os
import subprocess
import sys
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[2]
QUERY = ROOT / "rag" / "scripts" / "query_weather_data.py"
CASES = ROOT / "rag" / "evaluation" / "retrieval_cases.json"
DATABASE = ROOT / "rag" / "data" / "weathergpt.sqlite"


def get_path(value: Any, path: str) -> Any:
    current = value
    for part in path.split("."):
        current = current[int(part)] if isinstance(current, list) else current[part]
    return current


def check(actual: Any, assertion: dict[str, Any]) -> bool:
    operation = assertion["op"]
    expected = assertion.get("value")
    if operation == "eq":
        return actual == expected
    if operation == "approx":
        return abs(float(actual) - float(expected)) <= float(assertion.get("tolerance", 1e-6))
    if operation == "length_eq":
        return len(actual) == int(expected)
    if operation == "nonempty":
        return bool(actual)
    if operation == "contains":
        return str(expected).lower() in str(actual).lower()
    raise ValueError(f"Unsupported assertion operation: {operation}")


def run_query(case: dict[str, Any]) -> dict[str, Any]:
    environment = os.environ.copy()
    environment["WEATHERGPT_RAG_DB"] = str(DATABASE)
    payload = {"action": case["action"], **case.get("params", {})}
    completed = subprocess.run(
        [sys.executable, str(QUERY)],
        input=json.dumps(payload),
        text=True,
        capture_output=True,
        env=environment,
        check=True,
    )
    return json.loads(completed.stdout)["result"]


def main() -> None:
    if not DATABASE.is_file():
        raise SystemExit("RAG database is missing. Run npm run rag:ingest first.")
    cases = json.loads(CASES.read_text(encoding="utf-8"))
    failures: list[str] = []
    for case in cases:
        try:
            result = run_query(case)
            for assertion in case["assertions"]:
                actual = get_path(result, assertion["path"])
                if not check(actual, assertion):
                    failures.append(
                        f"{case['id']}: {assertion['path']} {assertion['op']} "
                        f"{assertion.get('value')!r}; actual={actual!r}"
                    )
        except Exception as exc:
            failures.append(f"{case['id']}: {exc}")

    passed = len(cases) - len({failure.split(":", 1)[0] for failure in failures})
    report = {
        "cases": len(cases),
        "passed": passed,
        "failed": len(cases) - passed,
        "accuracyPercent": round(passed / len(cases) * 100, 2),
        "failures": failures,
    }
    print(json.dumps(report, indent=2))
    if failures:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
