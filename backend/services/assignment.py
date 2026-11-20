"""
INNOVATION #1 - Smart Delivery Assignment

This is a deliberately simple, explainable heuristic - not a real-world
routing/optimization engine. For a viva: we score every available,
online delivery partner and recommend the lowest score.

    score = (distance_km * W_DISTANCE)
          + (active_orders * W_ACTIVE_ORDERS)
          + (workload_today * W_WORKLOAD)

Lower score = better candidate (closer, less busy).
"""

from math import asin, cos, radians, sin, sqrt

from config import Config


def haversine_km(lat1, lon1, lat2, lon2):
    """Great-circle distance between two lat/lon points, in kilometers."""
    lat1, lon1, lat2, lon2 = map(radians, [lat1, lon1, lat2, lon2])
    dlat = lat2 - lat1
    dlon = lon2 - lon1
    a = sin(dlat / 2) ** 2 + cos(lat1) * cos(lat2) * sin(dlon / 2) ** 2
    return 2 * 6371 * asin(sqrt(a))


def score_partner(partner, restaurant_lat, restaurant_lng):
    distance = haversine_km(
        partner.get("lat", 0), partner.get("lng", 0), restaurant_lat, restaurant_lng
    )
    active_orders = partner.get("activeOrders", 0)
    workload_today = partner.get("deliveriesToday", 0)

    score = (
        distance * Config.ASSIGNMENT_WEIGHT_DISTANCE
        + active_orders * Config.ASSIGNMENT_WEIGHT_ACTIVE_ORDERS
        + workload_today * Config.ASSIGNMENT_WEIGHT_WORKLOAD
    )

    # Rough arrival estimate for display purposes only.
    eta_minutes = round((distance / Config.AVG_DELIVERY_SPEED_KMPH) * 60) + 2

    return {
        "partnerId": partner.get("id"),
        "name": partner.get("name"),
        "distanceKm": round(distance, 2),
        "activeOrders": active_orders,
        "deliveriesToday": workload_today,
        "estimatedArrivalMin": max(eta_minutes, 3),
        "score": round(score, 3),
    }


def recommend_delivery_partner(partners, restaurant_lat, restaurant_lng):
    """
    partners: list of delivery-partner dicts that are online and available
    (already filtered by the caller). Returns a sorted list, best first.
    """
    scored = [
        score_partner(p, restaurant_lat, restaurant_lng)
        for p in partners
        if p.get("status") == "online"
    ]
    scored.sort(key=lambda s: s["score"])
    return scored
