import os
class Config:
    DEBUG = os.environ.get("FLASK_DEBUG", "1") == "1"
    SECRET_KEY = os.environ.get("SECRET_KEY", "foodflow-demo-local")
    CORS_ORIGINS = os.environ.get("CORS_ORIGINS", "*")
    ASSIGNMENT_WEIGHT_DISTANCE = 0.6
    ASSIGNMENT_WEIGHT_ACTIVE_ORDERS = 0.3
    ASSIGNMENT_WEIGHT_WORKLOAD = 0.1
    BATCH_MAX_DISTANCE_KM = 2.0
    WASTE_ALERT_MULTIPLIER = 1.5
    AVG_DELIVERY_SPEED_KMPH = 25.0
