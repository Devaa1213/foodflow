"""
INNOVATION #2 - Smart Order Batching

Two orders are considered batch-compatible when:
  - they are from the same restaurant
  - the two customers' drop-off points are within BATCH_MAX_DISTANCE_KM
  - both orders are still in an early-enough status to combine
    (PLACED, CONFIRMED, or PREPARING)

No external maps API is used - straight-line (haversine) distance is a
good enough approximation for a prototype.
"""

from itertools import combinations

from config import Config
from services.assignment import haversine_km

BATCHABLE_STATUSES = {"PLACED", "CONFIRMED", "PREPARING"}


def find_batch_opportunities(orders):
    """
    orders: list of order dicts, each with restaurantId, status, id,
    and a customerLocation {lat, lng}.
    Returns a list of {orderA, orderB, distanceKm, distanceSavedKm, extraDelayMin}
    """
    opportunities = []
    candidates = [o for o in orders if o.get("status") in BATCHABLE_STATUSES]

    for a, b in combinations(candidates, 2):
        if a.get("restaurantId") != b.get("restaurantId"):
            continue
        loc_a = a.get("customerLocation") or {}
        loc_b = b.get("customerLocation") or {}
        if not loc_a or not loc_b:
            continue

        distance = haversine_km(
            loc_a.get("lat", 0), loc_a.get("lng", 0), loc_b.get("lat", 0), loc_b.get("lng", 0)
        )
        if distance > Config.BATCH_MAX_DISTANCE_KM:
            continue

        # Two separate trips would roughly cost 2x the direct distance
        # out-and-back; a batched trip covers both drop-offs on one loop.
        distance_saved = round(distance * 0.9, 2)
        extra_delay_min = max(2, round(distance * 4))

        opportunities.append(
            {
                "orderIdA": a.get("id"),
                "orderIdB": b.get("id"),
                "restaurantId": a.get("restaurantId"),
                "distanceApartKm": round(distance, 2),
                "distanceSavedKm": distance_saved,
                "extraDelayMin": extra_delay_min,
            }
        )

    return opportunities
