"""
INNOVATION #4 - Dynamic ETA

ETA = restaurant prep time remaining + delivery-partner arrival time
      + delivery travel estimate (restaurant -> customer)

Recalculated whenever restaurant status changes, a partner is assigned,
or the order is picked up, so the customer always sees a fresh estimate.
"""

from config import Config
from services.assignment import haversine_km

# Simple, explainable defaults for a mini-project (minutes).
DEFAULT_PREP_TIME_MIN = 15
STAGE_PREP_REMAINING = {
    "PLACED": DEFAULT_PREP_TIME_MIN,
    "CONFIRMED": DEFAULT_PREP_TIME_MIN,
    "PREPARING": 8,
    "READY_FOR_PICKUP": 0,
    "PICKED_UP": 0,
    "OUT_FOR_DELIVERY": 0,
    "DELIVERED": 0,
}


def calculate_eta(order, restaurant=None, partner=None):
    """
    order: order dict (status, restaurantId, customerLocation)
    restaurant: restaurant dict (lat, lng, avgPrepTimeMin) - optional
    partner: assigned delivery partner dict (lat, lng) - optional

    Returns {etaMinLow, etaMinHigh, breakdown}
    """
    status = order.get("status", "PLACED")
    prep_remaining = STAGE_PREP_REMAINING.get(status, DEFAULT_PREP_TIME_MIN)
    if restaurant and restaurant.get("avgPrepTimeMin") and status in ("PLACED", "CONFIRMED"):
        prep_remaining = restaurant["avgPrepTimeMin"]

    partner_arrival_min = 0
    travel_min = 8  # sane fallback if we don't have coordinates yet

    restaurant_loc = (restaurant or {}).get("lat"), (restaurant or {}).get("lng")
    customer_loc = order.get("customerLocation") or {}

    if partner and None not in restaurant_loc:
        dist_to_restaurant = haversine_km(
            partner.get("lat", 0), partner.get("lng", 0), restaurant_loc[0], restaurant_loc[1]
        )
        partner_arrival_min = round((dist_to_restaurant / Config.AVG_DELIVERY_SPEED_KMPH) * 60)

    if None not in restaurant_loc and customer_loc:
        dist_to_customer = haversine_km(
            restaurant_loc[0], restaurant_loc[1], customer_loc.get("lat", 0), customer_loc.get("lng", 0)
        )
        travel_min = round((dist_to_customer / Config.AVG_DELIVERY_SPEED_KMPH) * 60)

    total_min = prep_remaining + partner_arrival_min + travel_min
    low = max(total_min - 5, 5)
    high = total_min + 5

    return {
        "etaMinLow": low,
        "etaMinHigh": high,
        "breakdown": {
            "prepRemainingMin": prep_remaining,
            "partnerArrivalMin": partner_arrival_min,
            "travelMin": travel_min,
        },
    }
