from datetime import datetime, timezone

from flask import Blueprint, jsonify, request

from mockdb import get_db

delivery_bp = Blueprint("delivery", __name__)


@delivery_bp.route("/api/delivery/available", methods=["GET"])
def available_deliveries():
    """Orders that are READY_FOR_PICKUP and not yet assigned."""
    db = get_db()
    docs = db.collection("orders").where("status", "==", "READY_FOR_PICKUP").stream()
    orders = []
    for d in docs:
        item = d.to_dict()
        if item.get("deliveryPartnerId"):
            continue
        item["id"] = d.id
        orders.append(item)
    return jsonify({"orders": orders})


@delivery_bp.route("/api/delivery/<partner_id>/active", methods=["GET"])
def active_deliveries(partner_id):
    db = get_db()
    docs = (
        db.collection("orders")
        .where("deliveryPartnerId", "==", partner_id)
        .where("status", "in", ["PICKED_UP", "OUT_FOR_DELIVERY"])
        .stream()
    )
    orders = []
    for d in docs:
        item = d.to_dict()
        item["id"] = d.id
        orders.append(item)
    return jsonify({"orders": orders})


@delivery_bp.route("/api/delivery/<partner_id>/history", methods=["GET"])
def delivery_history(partner_id):
    db = get_db()
    docs = (
        db.collection("orders")
        .where("deliveryPartnerId", "==", partner_id)
        .where("status", "==", "DELIVERED")
        .stream()
    )
    orders = []
    for d in docs:
        item = d.to_dict()
        item["id"] = d.id
        orders.append(item)
    orders.sort(key=lambda o: o.get("createdAt", ""), reverse=True)
    return jsonify({"orders": orders})


@delivery_bp.route("/api/delivery/<partner_id>/status", methods=["PATCH"])
def update_partner_status(partner_id):
    """Toggle online/offline."""
    db = get_db()
    payload = request.get_json(force=True) or {}
    status = payload.get("status")
    if status not in ("online", "offline"):
        return jsonify({"error": "status must be 'online' or 'offline'"}), 400
    db.collection("deliveryPartners").document(partner_id).update({"status": status})
    return jsonify({"id": partner_id, "status": status})


@delivery_bp.route("/api/delivery/<partner_id>/location", methods=["PATCH"])
def update_partner_location(partner_id):
    """For the prototype, location is simulated/manually set rather than real GPS."""
    db = get_db()
    payload = request.get_json(force=True) or {}
    lat, lng = payload.get("lat"), payload.get("lng")
    if lat is None or lng is None:
        return jsonify({"error": "lat and lng are required"}), 400
    db.collection("deliveryPartners").document(partner_id).update({"lat": lat, "lng": lng})
    return jsonify({"id": partner_id, "lat": lat, "lng": lng})


@delivery_bp.route("/api/delivery/<partner_id>/summary", methods=["GET"])
def partner_summary(partner_id):
    db = get_db()
    doc = db.collection("deliveryPartners").document(partner_id).get()
    if not doc.exists:
        return jsonify({"error": "Partner not found"}), 404
    partner = doc.to_dict()
    partner["id"] = doc.id

    today = datetime.now(timezone.utc).date().isoformat()
    delivered_docs = (
        db.collection("orders")
        .where("deliveryPartnerId", "==", partner_id)
        .where("status", "==", "DELIVERED")
        .stream()
    )
    today_count = 0
    today_earnings = 0
    for d in delivered_docs:
        order = d.to_dict()
        if order.get("createdAt", "").startswith(today):
            today_count += 1
            today_earnings += round(order.get("total", 0) * 0.12)  # simple flat commission

    partner["todayDeliveries"] = today_count
    partner["todayEarnings"] = today_earnings
    return jsonify(partner)
