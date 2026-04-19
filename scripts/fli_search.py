#!/usr/bin/env python3

import argparse
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from fli_bridge import health_payload, search_payload


def healthcheck() -> int:
    payload = health_payload()
    print(json.dumps(payload))
    return 0 if payload.get("ok") else 1


def search_route(origin_code: str, destination_code: str, departure_date: str, carrier_code: str) -> int:
    status, payload = search_payload(
        origin_code=origin_code,
        destination_code=destination_code,
        departure_date=departure_date,
        carrier_code=carrier_code,
    )
    print(json.dumps(payload))
    return 0 if status == 200 else 1


def main() -> int:
    parser = argparse.ArgumentParser(description="Minimal fli bridge for GoWild Explorer")
    subparsers = parser.add_subparsers(dest="command", required=True)

    subparsers.add_parser("health", help="Check whether the flights package is installed")

    search_parser = subparsers.add_parser("search", help="Run a one-way Frontier non-stop query")
    search_parser.add_argument("--origin", required=True)
    search_parser.add_argument("--destination", required=True)
    search_parser.add_argument("--departure-date", required=True)
    search_parser.add_argument("--carrier", default="F9")

    args = parser.parse_args()

    if args.command == "health":
        return healthcheck()

    if args.command == "search":
        return search_route(args.origin, args.destination, args.departure_date, args.carrier)

    print(json.dumps({"error": f"unsupported command: {args.command}"}))
    return 64


if __name__ == "__main__":
    sys.exit(main())
