"""
INNOVATION #3 - Food Waste Alert

This is a simple rule-based system, NOT machine learning. It compares
current inventory against a predicted demand figure (average of the
last N days of usage for that item, supplied by the caller / stored in
mock data) and flags items that are significantly over-stocked.

    if inventory > predictedDemand * WASTE_ALERT_MULTIPLIER:
        flag as potential excess
"""

from config import Config


def classify_stock(current_qty, predicted_demand):
    if predicted_demand <= 0:
        return "Healthy" if current_qty <= 5 else "Potential Excess"

    ratio = current_qty / predicted_demand
    if current_qty <= predicted_demand * 0.25:
        return "Critical"
    if current_qty <= predicted_demand * 0.6:
        return "Low Stock"
    if ratio > Config.WASTE_ALERT_MULTIPLIER:
        return "Potential Excess"
    return "Healthy"


def check_waste_alerts(inventory_items):
    """
    inventory_items: list of {id, name, quantity, unit, predictedDemand}
    Returns a list of alert dicts for items classified as Potential Excess.
    """
    alerts = []
    for item in inventory_items:
        qty = item.get("quantity", 0)
        predicted = item.get("predictedDemand", 0)
        status = classify_stock(qty, predicted)
        if status == "Potential Excess":
            alerts.append(
                {
                    "itemId": item.get("id"),
                    "itemName": item.get("name"),
                    "currentStock": qty,
                    "unit": item.get("unit", ""),
                    "expectedDemand": predicted,
                    "suggestion": f"Create a discounted {item.get('name', 'item').lower()} combo to move excess stock.",
                }
            )
    return alerts


def classify_all(inventory_items):
    """Returns each item annotated with its stock status, for dashboard display."""
    return [
        {**item, "stockStatus": classify_stock(item.get("quantity", 0), item.get("predictedDemand", 0))}
        for item in inventory_items
    ]
