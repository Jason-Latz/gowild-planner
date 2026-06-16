from http.server import BaseHTTPRequestHandler
import json
from pathlib import Path
import sys
from urllib.parse import parse_qs, urlparse

ROOT = Path(__file__).resolve().parents[2]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from fli_bridge import is_request_authorized, search_payload


def get_single_param(query: dict[str, list[str]], key: str) -> str:
    value = query.get(key, [""])[0].strip()
    return value


def is_authorized(request: BaseHTTPRequestHandler) -> bool:
    return is_request_authorized(
        request.headers.get("authorization", ""),
        request.headers.get("x-fli-secret", ""),
    )


class handler(BaseHTTPRequestHandler):
    def _write_json(self, status: int, payload: object) -> None:
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.end_headers()
        self.wfile.write(json.dumps(payload).encode("utf-8"))

    def do_GET(self) -> None:
        try:
            if not is_authorized(self):
                self._write_json(401, {"error": "Unauthorized"})
                return

            parsed = urlparse(self.path)
            query = parse_qs(parsed.query)

            origin = get_single_param(query, "origin")
            destination = get_single_param(query, "destination")
            departure_date = get_single_param(query, "departureDate")
            carrier = get_single_param(query, "carrier") or "F9"

            if not origin or not destination or not departure_date:
                self._write_json(
                    400,
                    {"error": "Missing required query params: origin, destination, departureDate"},
                )
                return

            status, payload = search_payload(
                origin_code=origin,
                destination_code=destination,
                departure_date=departure_date,
                carrier_code=carrier,
            )
            self._write_json(status, payload)
        except Exception:
            # Never let an unexpected error crash the function with no response.
            self._write_json(500, {"error": "flight service unavailable"})
