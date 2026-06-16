from http.server import BaseHTTPRequestHandler
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from fli_bridge import health_payload, is_request_authorized


class handler(BaseHTTPRequestHandler):
    def _write_json(self, status: int, payload: object) -> None:
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.end_headers()
        self.wfile.write(json.dumps(payload).encode("utf-8"))

    def do_GET(self) -> None:
        try:
            if not is_request_authorized(
                self.headers.get("authorization", ""),
                self.headers.get("x-fli-secret", ""),
            ):
                self._write_json(401, {"ok": False, "error": "Unauthorized"})
                return

            payload = health_payload()
            self._write_json(200 if payload.get("ok") else 500, payload)
        except Exception:
            self._write_json(500, {"ok": False, "error": "flight service unavailable"})
