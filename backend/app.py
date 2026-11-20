import os

from flask import Flask, jsonify, send_from_directory
from flask_cors import CORS

from config import Config
from routes.admin import admin_bp
from routes.analytics import analytics_bp
from routes.delivery import delivery_bp
from routes.orders import orders_bp
from routes.restaurants import restaurants_bp


def create_app():
    project_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    frontend_dir = os.path.join(project_dir, "frontend")
    app = Flask(__name__, static_folder=frontend_dir, static_url_path="")
    app.config.from_object(Config)
    CORS(app, origins=Config.CORS_ORIGINS)

    app.register_blueprint(restaurants_bp)
    app.register_blueprint(orders_bp)
    app.register_blueprint(delivery_bp)
    app.register_blueprint(admin_bp)
    app.register_blueprint(analytics_bp)

    @app.route("/")
    @app.route("/index.html")
    def landing():
        return send_from_directory(frontend_dir, "index.html")

    for page in ("customer.html", "restaurant.html", "delivery.html", "admin.html"):
        app.add_url_rule("/" + page, endpoint="page_" + page.replace(".", "_"),
                         view_func=lambda page=page: send_from_directory(frontend_dir, page))

    @app.route("/api/health", methods=["GET"])
    def health():
        return jsonify({"status": "ok", "service": "FoodFlow API"})

    @app.errorhandler(404)
    def not_found(e):
        return jsonify({"error": "Not found"}), 404

    @app.errorhandler(500)
    def server_error(e):
        return jsonify({"error": "Internal server error"}), 500

    return app


app = create_app()

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=Config.DEBUG)
