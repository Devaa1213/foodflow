from flask import Blueprint, jsonify

from mockdb import get_db

admin_bp = Blueprint("admin", __name__)


def _collection_count(db, name):
    return sum(1 for _ in db.collection(name).stream())


@admin_bp.route("/api/admin/statistics", methods=["GET"])
def statistics():
    db = get_db()

    orders = [o.to_dict() for o in db.collection("orders").stream()]
    total_revenue = sum(o.get("total", 0) for o in orders if o.get("status") == "DELIVERED")
    completed = sum(1 for o in orders if o.get("status") == "DELIVERED")
    active_deliveries = sum(1 for o in orders if o.get("status") in ("PICKED_UP", "OUT_FOR_DELIVERY"))

    stats = {
        "totalUsers": _collection_count(db, "users"),
        "totalRestaurants": _collection_count(db, "restaurants"),
        "totalOrders": len(orders),
        "activeDeliveries": active_deliveries,
        "revenue": total_revenue,
        "completedOrders": completed,
    }
    return jsonify(stats)


@admin_bp.route("/api/admin/users", methods=["GET"])
def list_users():
    db = get_db()
    users = []
    for d in db.collection("users").stream():
        item = d.to_dict()
        item["id"] = d.id
        item.pop("password", None)
        users.append(item)
    return jsonify({"users": users})


@admin_bp.route("/api/admin/restaurants", methods=["GET"])
def list_restaurants_admin():
    db = get_db()
    restaurants = []
    for d in db.collection("restaurants").stream():
        item = d.to_dict()
        item["id"] = d.id
        restaurants.append(item)
    return jsonify({"restaurants": restaurants})


@admin_bp.route("/api/admin/delivery-partners", methods=["GET"])
def list_partners_admin():
    db = get_db()
    partners = []
    for d in db.collection("deliveryPartners").stream():
        item = d.to_dict()
        item["id"] = d.id
        partners.append(item)
    return jsonify({"partners": partners})


@admin_bp.route("/api/admin/orders", methods=["GET"])
def list_orders_admin():
    db = get_db()
    orders = []
    for d in db.collection("orders").stream():
        item = d.to_dict()
        item["id"] = d.id
        orders.append(item)
    orders.sort(key=lambda o: o.get("createdAt", ""), reverse=True)
    return jsonify({"orders": orders})
