#!/usr/bin/env python3

from __future__ import annotations

import json
import os
import subprocess
import sys
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
QUERY = ROOT / "rag" / "scripts" / "query_weather_data.py"
DATABASE = ROOT / "rag" / "data" / "weathergpt.sqlite"


def query(action: str, **params):
    environment = os.environ.copy()
    environment["WEATHERGPT_RAG_DB"] = str(DATABASE)
    result = subprocess.run(
        [sys.executable, str(QUERY)],
        input=json.dumps({"action": action, **params}),
        text=True,
        capture_output=True,
        env=environment,
        check=True,
    )
    return json.loads(result.stdout)["result"]


@unittest.skipUnless(DATABASE.is_file(), "Run rag/scripts/ingest_cleaned_data.py first")
class RetrievalTests(unittest.TestCase):
    def test_exact_historical_weather(self):
        result = query("historical_weather", location="Delhi", date="2000-01-01")
        self.assertEqual(len(result["longTerm"]), 1)
        self.assertEqual(result["longTerm"][0]["date"], "2000-01-01")

    def test_climate_baseline(self):
        result = query("climate_baseline", location="Delhi", month=1)
        self.assertTrue(result["available"])
        self.assertGreater(result["observationCount"], 700)
        self.assertEqual(result["baselinePeriod"], "2000-2024")

    def test_cyclone_filter(self):
        result = query("cyclone_history", year=2019, basin="BOB", limit=500)
        self.assertTrue(result["records"])
        self.assertTrue(all(row["source_year"] == 2019 and row["basin"] == "BOB" for row in result["records"]))

    def test_flood_filter(self):
        result = query("flood_history", state="Assam", year=2020, limit=500)
        self.assertTrue(result["events"])
        self.assertTrue(all("assam" in row["state"].lower() for row in result["events"]))

    def test_ambiguous_district_is_not_silently_joined(self):
        result = query("district_flood_metrics", district="Aurangabad")
        self.assertTrue(result["ambiguous"])
        self.assertIsNotNone(result["warning"])

    def test_heatwave_national_total(self):
        result = query("heatwave_history", region="All Total", year=2024)
        self.assertEqual(len(result["records"]), 1)
        self.assertEqual(result["records"][0]["heatwave_days"], 554)


if __name__ == "__main__":
    unittest.main()
