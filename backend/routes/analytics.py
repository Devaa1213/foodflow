from collections import Counter, defaultdict
from datetime import datetime, timezone

from flask import Blueprint, jsonify

from mockdb import get_db

analytics_bp = Blueprint("analytics", __name__)


@analytics_bp.route("/api/restaurant/<restaurant_id>/analytics", methods=["GET"])
def restaurant_analytics(restaurant_id):
    db = get_db()
    orders = [
        o.to_dict()
        for o in db.collection("orders").where("restaurantId", "==", restaurant_id).stream()
    ]

    today = datetime.now(timezone.utc).date().isoformat()
    today_orders = [o for o in orders if o.get("createdAt", "").startswith(today)]
    today_revenue = sum(o.get("total", 0) for o in today_orders if o.get("status") == "DELIVERED")
    pending = sum(1 for o in orders if o.get("status") in ("PLACED", "CONFIRMED", "PREPARING"))
    active_deliveries = sum(
        1 for o in orders if o.get("status") in ("PICKED_UP", "OUT_FOR_DELIVERY")
    )

    food_counter = Counter()
    for o in orders:
        for item in o.get("items", []):
            food_counter[item.get("name", "Unknown")] += item.get("quantity", 1)

    return jsonify(
        {
            "todaysOrders": len(today_orders),
            "todaysRevenue": today_revenue,
            "pendingOrders": pending,
            "activeDeliveries": active_deliveries,
            "popularFoods": [{"name": n, "count": c} for n, c in food_counter.most_common(5)],
        }
    )


@analytics_bp.route("/api/admin/analytics", methods=["GET"])
def admin_analytics():
    db = get_db()
    orders = [o.to_dict() for o in db.collection("orders").stream()]

    today = datetime.now(timezone.utc).date().isoformat()
    orders_today = sum(1 for o in orders if o.get("createdAt", "").startswith(today))

    revenue = sum(o.get("total", 0) for o in orders if o.get("status") == "DELIVERED")
    delivered = sum(1 for o in orders if o.get("status") == "DELIVERED")
    total = len(orders)
    completion_rate = round((delivered / total) * 100, 1) if total else 0

    restaurant_counter = Counter()
    food_counter = Counter()
    for o in orders:
        if o.get("restaurantName"):
            restaurant_counter[o["restaurantName"]] += 1
        for item in o.get("items", []):
            food_counter[item.get("name", "Unknown")] += item.get("quantity", 1)

    return jsonify(
        {
            "ordersToday": orders_today,
            "ordersThisWeek": total,  # simplified for the prototype
            "revenue": revenue,
            "deliveryCompletionRate": completion_rate,
            "popularFoods": [{"name": n, "count": c} for n, c in food_counter.most_common(5)],
            "topRestaurants": [{"name": n, "orders": c} for n, c in restaurant_counter.most_common(5)],
        }
    )
