from http.server import BaseHTTPRequestHandler
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from fli_bridge import health_payload


class handler(BaseHTTPRequestHandler):
    def do_GET(self) -> None:
        payload = health_payload()
        status = 200 if payload.get("ok") else 500

        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.end_headers()
        self.wfile.write(json.dumps(payload).encode("utf-8"))
