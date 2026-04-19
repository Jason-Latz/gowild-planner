from __future__ import annotations

from typing import Any


def health_payload() -> dict[str, Any]:
    try:
        import fli  # noqa: F401
    except Exception as exc:
        return {"ok": False, "error": str(exc)}

    return {"ok": True}


def search_payload(
    *, origin_code: str, destination_code: str, departure_date: str, carrier_code: str = "F9"
) -> tuple[int, list[dict[str, Any]] | dict[str, str]]:
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
        return (500, {"error": f"fli import failed: {exc}"})

    try:
        origin = getattr(Airport, origin_code.upper())
        destination = getattr(Airport, destination_code.upper())
        airline = getattr(Airline, carrier_code.upper())
    except AttributeError as exc:
        return (400, {"error": f"unsupported airport or carrier: {exc}"})

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

    try:
        results = SearchFlights().search(filters) or []
    except Exception as exc:
        return (502, {"error": str(exc)})

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
                "carrier": carrier_code.upper(),
                "flightNo": str(leg.flight_number).strip(),
                "origin": origin_code.upper(),
                "destination": destination_code.upper(),
                "depTs": leg.departure_datetime.isoformat(),
                "arrTs": leg.arrival_datetime.isoformat(),
                "durationMinutes": int(leg.duration),
            }
        )

    return (200, direct_legs)
