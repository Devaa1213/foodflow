from datetime import datetime, timezone

from flask import Blueprint, jsonify, request

from mockdb import get_db
from services.assignment import recommend_delivery_partner
from services.batching import find_batch_opportunities
from services.eta import calculate_eta

orders_bp = Blueprint("orders", __name__)

VALID_STATUSES = [
    "PLACED",
    "CONFIRMED",
    "PREPARING",
    "READY_FOR_PICKUP",
    "PICKED_UP",
    "OUT_FOR_DELIVERY",
    "DELIVERED",
    "REJECTED",
]


@orders_bp.route("/api/orders", methods=["POST"])
def create_order():
    db = get_db()
    payload = request.get_json(force=True) or {}

    items = payload.get("items", [])
    subtotal = sum(i.get("price", 0) * i.get("quantity", 1) for i in items)
    delivery_fee = payload.get("deliveryFee", 40 if subtotal > 0 else 0)
    discount = payload.get("discount", 0)
    total = max(subtotal + delivery_fee - discount, 0)

    order = {
        "customerId": payload.get("customerId"),
        "customerName": payload.get("customerName", ""),
        "restaurantId": payload.get("restaurantId"),
        "restaurantName": payload.get("restaurantName", ""),
        "items": items,
        "subtotal": subtotal,
        "deliveryFee": delivery_fee,
        "discount": discount,
        "total": total,
        "status": "PLACED",
        "deliveryPartnerId": None,
        "customerLocation": payload.get("customerLocation"),
        "createdAt": datetime.now(timezone.utc).isoformat(),
        "statusHistory": [{"status": "PLACED", "at": datetime.now(timezone.utc).isoformat()}],
    }

    ref = db.collection("orders").document()
    ref.set(order)
    order["id"] = ref.id
    return jsonify(order), 201


@orders_bp.route("/api/orders/<order_id>", methods=["GET"])
def get_order(order_id):
    db = get_db()
    doc = db.collection("orders").document(order_id).get()
    if not doc.exists:
        return jsonify({"error": "Order not found"}), 404
    data = doc.to_dict()
    data["id"] = doc.id

    restaurant = None
    if data.get("restaurantId"):
        r_doc = db.collection("restaurants").document(data["restaurantId"]).get()
        if r_doc.exists:
            restaurant = r_doc.to_dict()

    partner = None
    if data.get("deliveryPartnerId"):
        p_doc = db.collection("deliveryPartners").document(data["deliveryPartnerId"]).get()
        if p_doc.exists:
            partner = p_doc.to_dict()

    data["eta"] = calculate_eta(data, restaurant, partner)
    return jsonify(data)


@orders_bp.route("/api/orders", methods=["GET"])
def list_orders():
    db = get_db()
    query = db.collection("orders")
    restaurant_id = request.args.get("restaurantId")
    customer_id = request.args.get("customerId")
    partner_id = request.args.get("deliveryPartnerId")
    status = request.args.get("status")

    if restaurant_id:
        query = query.where("restaurantId", "==", restaurant_id)
    if customer_id:
        query = query.where("customerId", "==", customer_id)
    if partner_id:
        query = query.where("deliveryPartnerId", "==", partner_id)
    if status:
        query = query.where("status", "==", status)

    orders = []
    for d in query.stream():
        item = d.to_dict()
        item["id"] = d.id
        orders.append(item)

    orders.sort(key=lambda o: o.get("createdAt", ""), reverse=True)
    return jsonify({"orders": orders})


@orders_bp.route("/api/orders/<order_id>/status", methods=["PATCH"])
def update_status(order_id):
    db = get_db()
    payload = request.get_json(force=True) or {}
    new_status = payload.get("status")
    if new_status not in VALID_STATUSES:
        return jsonify({"error": "Invalid status", "validStatuses": VALID_STATUSES}), 400

    ref = db.collection("orders").document(order_id)
    doc = ref.get()
    if not doc.exists:
        return jsonify({"error": "Order not found"}), 404

    history = doc.to_dict().get("statusHistory", [])
    history.append({"status": new_status, "at": datetime.now(timezone.utc).isoformat()})
    ref.update({"status": new_status, "statusHistory": history})

    return jsonify({"id": order_id, "status": new_status})


@orders_bp.route("/api/orders/<order_id>/assign/candidates", methods=["GET"])
def assignment_candidates(order_id):
    db = get_db()
    order_doc = db.collection("orders").document(order_id).get()
    if not order_doc.exists:
        return jsonify({"error": "Order not found"}), 404
    order = order_doc.to_dict()

    restaurant_doc = db.collection("restaurants").document(order["restaurantId"]).get()
    restaurant = restaurant_doc.to_dict() if restaurant_doc.exists else {}

    partners = [p.to_dict() | {"id": p.id} for p in db.collection("deliveryPartners").stream()]
    candidates = recommend_delivery_partner(
        partners, restaurant.get("lat", 0), restaurant.get("lng", 0)
    )
    return jsonify({"candidates": candidates})


@orders_bp.route("/api/orders/<order_id>/assign", methods=["POST"])
def assign_partner(order_id):
    db = get_db()
    payload = request.get_json(force=True) or {}
    partner_id = payload.get("partnerId")
    if not partner_id:
        return jsonify({"error": "partnerId is required"}), 400

    ref = db.collection("orders").document(order_id)
    ref.update({"deliveryPartnerId": partner_id})
    db.collection("deliveryPartners").document(partner_id).update(
        {"activeOrders": _increment(db, "deliveryPartners", partner_id, "activeOrders")}
    )
    return jsonify({"id": order_id, "deliveryPartnerId": partner_id})


def _increment(db, collection, doc_id, field):
    current = db.collection(collection).document(doc_id).get().to_dict().get(field, 0)
    return current + 1


@orders_bp.route("/api/restaurants/<restaurant_id>/batches", methods=["GET"])
def batch_opportunities(restaurant_id):
    db = get_db()
    docs = db.collection("orders").where("restaurantId", "==", restaurant_id).stream()
    orders = []
    for d in docs:
        item = d.to_dict()
        item["id"] = d.id
        orders.append(item)
    return jsonify({"opportunities": find_batch_opportunities(orders)})


@orders_bp.route("/api/orders/batch", methods=["POST"])
def create_batch():
    db = get_db()
    payload = request.get_json(force=True) or {}
    order_ids = payload.get("orderIds", [])
    if len(order_ids) < 2:
        return jsonify({"error": "A batch needs at least 2 orders"}), 400

    batch_ref = db.collection("batches").document()
    batch_ref.set(
        {
            "orderIds": order_ids,
            "createdAt": datetime.now(timezone.utc).isoformat(),
        }
    )
    for oid in order_ids:
        db.collection("orders").document(oid).update({"batchId": batch_ref.id})

    return jsonify({"id": batch_ref.id, "orderIds": order_ids}), 201
