from __future__ import annotations

import hmac
import os
import re
import sys
from datetime import datetime
from typing import Any

_AIRPORT_RE = re.compile(r"^[A-Za-z]{3}$")
_CARRIER_RE = re.compile(r"^[A-Za-z0-9]{2,3}$")
_DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")


def _log(message: str) -> None:
    """Log detail server-side instead of leaking it in the HTTP response body."""
    print(message, file=sys.stderr)


def is_request_authorized(auth_header: str, secret_header: str) -> bool:
    """Authorize an fli HTTP request.

    Fail-closed on any deployed (Vercel) runtime: if FLI_HTTP_SECRET is unset
    there, reject rather than serving the open Google-Flights proxy to anyone.
    Locally (no VERCEL marker) an empty secret allows requests for convenience.
    """
    expected = os.environ.get("FLI_HTTP_SECRET", "").strip()
    if not expected:
        return not os.environ.get("VERCEL")

    provided = ""
    if auth_header.startswith("Bearer "):
        provided = auth_header[len("Bearer ") :]

    if provided and hmac.compare_digest(provided, expected):
        return True
    if secret_header and hmac.compare_digest(secret_header, expected):
        return True
    return False


def _valid_date(value: str) -> bool:
    if not _DATE_RE.match(value):
        return False
    try:
        datetime.strptime(value, "%Y-%m-%d")
    except ValueError:
        return False
    return True


def health_payload() -> dict[str, Any]:
    try:
        import fli  # noqa: F401
    except Exception as exc:
        _log(f"fli import failed: {exc}")
        return {"ok": False, "error": "flight service unavailable"}

    return {"ok": True}


def search_payload(
    *, origin_code: str, destination_code: str, departure_date: str, carrier_code: str = "F9"
) -> tuple[int, list[dict[str, Any]] | dict[str, str]]:
    origin_code = (origin_code or "").upper()
    destination_code = (destination_code or "").upper()
    carrier_code = (carrier_code or "F9").upper()

    # Validate cheap inputs before importing/calling fli so malformed requests
    # cannot crash the function or drive upstream traffic. Airport codes are
    # 3 letters; airline IATA codes are 2-3 alphanumerics (e.g. "F9").
    if (
        not _AIRPORT_RE.match(origin_code)
        or not _AIRPORT_RE.match(destination_code)
        or not _CARRIER_RE.match(carrier_code)
    ):
        return (400, {"error": "unsupported airport or carrier"})

    if not _valid_date(departure_date):
        return (400, {"error": "invalid departureDate; expected YYYY-MM-DD"})

    try:
        from fli.models import (
            Airline,
            Airport,
            FlightSearchFilters,
            FlightSegment,
            MaxStops,
            PassengerInfo,
            SeatType,
            SortBy,
        )
        from fli.search import SearchFlights
    except Exception as exc:
        _log(f"fli import failed: {exc}")
        return (500, {"error": "flight service unavailable"})

    # Explicit membership lookup (not getattr) so a crafted code can only ever
    # resolve to a real enum member or a controlled 400 — never a class internal.
    if origin_code not in Airport.__members__ or destination_code not in Airport.__members__:
        return (400, {"error": "unsupported airport"})
    if carrier_code not in Airline.__members__:
        return (400, {"error": "unsupported carrier"})

    try:
        origin = Airport[origin_code]
        destination = Airport[destination_code]
        airline = Airline[carrier_code]
        filters = FlightSearchFilters(
            passenger_info=PassengerInfo(adults=1),
            flight_segments=[
                FlightSegment(
                    departure_airport=[[origin, 0]],
                    arrival_airport=[[destination, 0]],
                    travel_date=departure_date,
                )
            ],
            seat_type=SeatType.ECONOMY,
            stops=MaxStops.NON_STOP,
            sort_by=SortBy.DEPARTURE_TIME,
            airlines=[airline],
        )
    except Exception as exc:
        _log(f"fli filter construction failed: {exc}")
        return (400, {"error": "unsupported airport or carrier"})

    try:
        results = SearchFlights().search(filters) or []
    except Exception as exc:
        _log(f"fli search failed: {exc}")
        return (502, {"error": "upstream search failed"})

    direct_legs: list[dict[str, Any]] = []

    for result in results:
        if getattr(result, "stops", None) != 0:
            continue

        legs = getattr(result, "legs", []) or []
        if len(legs) != 1:
            continue

        leg = legs[0]
        direct_legs.append(
            {
                "carrier": carrier_code,
                "flightNo": str(leg.flight_number).strip(),
                "origin": origin_code,
                "destination": destination_code,
                "depTs": leg.departure_datetime.isoformat(),
                "arrTs": leg.arrival_datetime.isoformat(),
                "durationMinutes": int(leg.duration),
            }
        )

    return (200, direct_legs)
