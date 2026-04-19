from http.server import BaseHTTPRequestHandler
import json
import os
from pathlib import Path
import sys
from urllib.parse import parse_qs, urlparse

ROOT = Path(__file__).resolve().parents[2]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from fli_bridge import search_payload


def get_single_param(query: dict[str, list[str]], key: str) -> str:
    value = query.get(key, [""])[0].strip()
    return value


def is_authorized(request: BaseHTTPRequestHandler) -> bool:
    expected_secret = os.environ.get("FLI_HTTP_SECRET", "").strip()
    if not expected_secret:
      return True

    auth_header = request.headers.get("authorization", "")
    secret_header = request.headers.get("x-fli-secret", "")
    return auth_header == f"Bearer {expected_secret}" or secret_header == expected_secret


class handler(BaseHTTPRequestHandler):
    def do_GET(self) -> None:
        if not is_authorized(self):
            self.send_response(401)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps({"error": "Unauthorized"}).encode("utf-8"))
            return

        parsed = urlparse(self.path)
        query = parse_qs(parsed.query)

        origin = get_single_param(query, "origin")
        destination = get_single_param(query, "destination")
        departure_date = get_single_param(query, "departureDate")
        carrier = get_single_param(query, "carrier") or "F9"

        if not origin or not destination or not departure_date:
            self.send_response(400)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(
                json.dumps(
                    {
                        "error": "Missing required query params: origin, destination, departureDate",
                    }
                ).encode("utf-8")
            )
            return

        status, payload = search_payload(
            origin_code=origin,
            destination_code=destination,
            departure_date=departure_date,
            carrier_code=carrier,
        )

        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.end_headers()
        self.wfile.write(json.dumps(payload).encode("utf-8"))
