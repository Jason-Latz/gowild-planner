"""Offline guard tests for the Python fli bridge.

Run with: python3 -m unittest discover -s tests
These cases never import the `fli` package (validation/auth short-circuit
before it), so they pass without the flights dependency installed.
"""

import os
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from fli_bridge import is_request_authorized, search_payload


class AuthTests(unittest.TestCase):
    def setUp(self) -> None:
        self._saved = {k: os.environ.get(k) for k in ("FLI_HTTP_SECRET", "VERCEL")}

    def tearDown(self) -> None:
        for key, value in self._saved.items():
            if value is None:
                os.environ.pop(key, None)
            else:
                os.environ[key] = value

    def test_open_locally_when_no_secret(self) -> None:
        os.environ.pop("FLI_HTTP_SECRET", None)
        os.environ.pop("VERCEL", None)
        self.assertTrue(is_request_authorized("", ""))

    def test_fail_closed_on_vercel_without_secret(self) -> None:
        os.environ.pop("FLI_HTTP_SECRET", None)
        os.environ["VERCEL"] = "1"
        self.assertFalse(is_request_authorized("", ""))

    def test_accepts_correct_bearer(self) -> None:
        os.environ["FLI_HTTP_SECRET"] = "topsecret"
        os.environ.pop("VERCEL", None)
        self.assertTrue(is_request_authorized("Bearer topsecret", ""))

    def test_accepts_correct_secret_header(self) -> None:
        os.environ["FLI_HTTP_SECRET"] = "topsecret"
        self.assertTrue(is_request_authorized("", "topsecret"))

    def test_rejects_wrong_secret(self) -> None:
        os.environ["FLI_HTTP_SECRET"] = "topsecret"
        os.environ["VERCEL"] = "1"
        self.assertFalse(is_request_authorized("Bearer nope", "nope"))


class ValidationTests(unittest.TestCase):
    def test_rejects_malformed_date(self) -> None:
        status, payload = search_payload(
            origin_code="LAX", destination_code="JFK", departure_date="not-a-date"
        )
        self.assertEqual(status, 400)
        self.assertIn("departureDate", payload["error"])

    def test_rejects_overflow_date(self) -> None:
        status, _ = search_payload(
            origin_code="LAX", destination_code="JFK", departure_date="2026-02-30"
        )
        self.assertEqual(status, 400)

    def test_rejects_bad_airport_code_without_reflection(self) -> None:
        status, payload = search_payload(
            origin_code="../etc", destination_code="JFK", departure_date="2026-04-16"
        )
        self.assertEqual(status, 400)
        # Must not reflect internal enum/attribute detail back to the caller.
        self.assertNotIn("Airport", payload["error"])
        self.assertNotIn("attribute", payload["error"])


if __name__ == "__main__":
    unittest.main()
