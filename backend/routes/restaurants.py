from flask import Blueprint, jsonify, request

from mockdb import get_db

restaurants_bp = Blueprint("restaurants", __name__)


@restaurants_bp.route("/api/restaurants", methods=["GET"])
def list_restaurants():
    db = get_db()
    docs = db.collection("restaurants").stream()
    restaurants = []
    for d in docs:
        data = d.to_dict()
        data["id"] = d.id
        restaurants.append(data)
    return jsonify({"restaurants": restaurants})


@restaurants_bp.route("/api/restaurants/<restaurant_id>", methods=["GET"])
def get_restaurant(restaurant_id):
    db = get_db()
    doc = db.collection("restaurants").document(restaurant_id).get()
    if not doc.exists:
        return jsonify({"error": "Restaurant not found"}), 404

    data = doc.to_dict()
    data["id"] = doc.id

    menu_docs = db.collection("menuItems").where("restaurantId", "==", restaurant_id).stream()
    menu = []
    for m in menu_docs:
        item = m.to_dict()
        item["id"] = m.id
        menu.append(item)
    data["menu"] = menu

    return jsonify(data)


@restaurants_bp.route("/api/restaurants/<restaurant_id>/menu", methods=["POST"])
def add_menu_item(restaurant_id):
    db = get_db()
    payload = request.get_json(force=True) or {}
    payload["restaurantId"] = restaurant_id
    payload.setdefault("available", True)
    ref = db.collection("menuItems").document()
    ref.set(payload)
    return jsonify({"id": ref.id, **payload}), 201


@restaurants_bp.route("/api/menu/<item_id>", methods=["PATCH"])
def update_menu_item(item_id):
    db = get_db()
    payload = request.get_json(force=True) or {}
    db.collection("menuItems").document(item_id).update(payload)
    return jsonify({"id": item_id, "updated": payload})


@restaurants_bp.route("/api/menu/<item_id>", methods=["DELETE"])
def delete_menu_item(item_id):
    db = get_db()
    db.collection("menuItems").document(item_id).delete()
    return jsonify({"id": item_id, "deleted": True})


@restaurants_bp.route("/api/restaurants/<restaurant_id>/inventory", methods=["GET"])
def get_inventory(restaurant_id):
    from services.waste_prediction import classify_all

    db = get_db()
    docs = db.collection("inventory").where("restaurantId", "==", restaurant_id).stream()
    items = []
    for d in docs:
        item = d.to_dict()
        item["id"] = d.id
        items.append(item)
    return jsonify({"inventory": classify_all(items)})


@restaurants_bp.route("/api/inventory/<item_id>", methods=["PATCH"])
def update_inventory_item(item_id):
    db = get_db()
    payload = request.get_json(force=True) or {}
    db.collection("inventory").document(item_id).update(payload)
    return jsonify({"id": item_id, "updated": payload})


@restaurants_bp.route("/api/restaurants/<restaurant_id>/waste-alerts", methods=["GET"])
def waste_alerts(restaurant_id):
    from services.waste_prediction import check_waste_alerts

    db = get_db()
    docs = db.collection("inventory").where("restaurantId", "==", restaurant_id).stream()
    items = []
    for d in docs:
        item = d.to_dict()
        item["id"] = d.id
        items.append(item)
    return jsonify({"alerts": check_waste_alerts(items)})
