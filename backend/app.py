# backend/app.py — Flask Server & REST API Endpoints for ROBO PET

import os
import sys
import logging
from pathlib import Path
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS

# Add root directory to python path if running standalone
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from backend.config import Config
from backend.gemini_service import gemini_service
from backend.robot_controller import robot_controller
from backend.timer_manager import timer_manager

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger("RoboPet.App")

def create_app() -> Flask:
    app = Flask(__name__, static_folder=None)
    CORS(app, resources={r"/*": {"origins": Config.CORS_ORIGINS}})

    # ==============================================================
    # FRONTEND STATIC ASSETS SERVING
    # ==============================================================
    if Config.SERVE_FRONTEND and os.path.exists(Config.FRONTEND_FOLDER):
        @app.route("/", methods=["GET"])
        def serve_index():
            return send_from_directory(Config.FRONTEND_FOLDER, "index.html")

        @app.route("/<path:path>", methods=["GET"])
        def serve_static(path):
            file_path = os.path.join(Config.FRONTEND_FOLDER, path)
            if os.path.exists(file_path):
                return send_from_directory(Config.FRONTEND_FOLDER, path)
            # Fallback to index.html for SPA client-side routing
            return send_from_directory(Config.FRONTEND_FOLDER, "index.html")

    # ==============================================================
    # CORE API ROUTES
    # ==============================================================

    @app.route("/health", methods=["GET"])
    def health_check():
        return jsonify({
            "status": "healthy",
            "service": "ROBO PET Backend",
            "version": "1.0.0",
            "esp32_connected": robot_controller.serial_mgr.is_connected,
            "gemini_active": gemini_service.client is not None
        }), 200

    @app.route("/talk", methods=["POST"])
    def handle_talk():
        """
        POST /talk
        Expects: { "message": "user input text" }
        Returns: { "response": str, "emotion": str, "action": str|null, "metadata": dict }
        """
        data = request.get_json(silent=True) or {}
        user_message = data.get("message", "").strip()

        if not user_message:
            return jsonify({
                "response": "I didn't hear anything! Speak into the mic or type a message.",
                "emotion": "confused",
                "action": "look_left",
                "metadata": {}
            }), 200

        try:
            # 1. Generate structured response with Gemini AI (or intelligent companion fallback)
            ai_result = gemini_service.generate_chat_response(user_message)

            # 2. Forward validated physical actions/emotions to the robot hardware controller
            final_result = robot_controller.execute_ai_intent(ai_result)

            return jsonify({
                "response": final_result.get("response", "Beep boop!"),
                "emotion": final_result.get("emotion", "neutral"),
                "action": final_result.get("action"),
                "metadata": final_result.get("metadata", {})
            }), 200

        except Exception as err:
            logger.error(f"Error handling /talk: {err}", exc_info=True)
            return jsonify({
                "response": "My circuits encountered an internal glitch! Let's try again in a moment.",
                "emotion": "sad",
                "action": "nod",
                "metadata": {"error": str(err)}
            }), 500

    @app.route("/status", methods=["GET"])
    def handle_status():
        """
        GET /status
        Returns: { "status": "online"|"offline", "esp32_connected": bool, "sensors": {...}, "battery": int, "timer": {...} }
        """
        try:
            status_data = robot_controller.get_full_status()
            return jsonify(status_data), 200
        except Exception as err:
            logger.error(f"Error retrieving status: {err}")
            return jsonify({
                "status": "offline",
                "esp32_connected": False,
                "error": str(err)
            }), 500

    @app.route("/command", methods=["POST"])
    def handle_command():
        """
        POST /command
        Expects: { "command": str, "category": str (optional) }
        Returns: { "success": bool, "message": str, "emotion": str, "action": str|null }
        """
        data = request.get_json(silent=True) or {}
        command_name = data.get("command", "")
        category = data.get("category", "")

        if not command_name:
            return jsonify({
                "success": False,
                "message": "Missing 'command' field in request body.",
                "emotion": "neutral",
                "action": None
            }), 400

        try:
            result = robot_controller.execute_command(command_name, category)
            status_code = 200 if result.get("success") else 400
            return jsonify(result), status_code
        except Exception as err:
            logger.error(f"Error executing command: {err}")
            return jsonify({
                "success": False,
                "message": f"Error executing command: {err}",
                "emotion": "neutral",
                "action": None
            }), 500

    @app.route("/timer", methods=["POST"])
    def handle_timer():
        """
        POST /timer
        Expects: { "action": "set"|"cancel"|"status", "duration": int, "label": str }
        Returns: { "success": bool, "message": str, "timer": dict }
        """
        data = request.get_json(silent=True) or {}
        action = data.get("action", "status").lower().strip()
        duration = int(data.get("duration", 0))
        label = data.get("label", "Timer")

        try:
            if action == "set":
                res = timer_manager.set_timer(duration, label)
            elif action == "cancel":
                res = timer_manager.cancel_timer()
            else:
                res = {"success": True, "timer": timer_manager.get_status()}

            return jsonify(res), 200
        except Exception as err:
            logger.error(f"Error handling /timer: {err}")
            return jsonify({
                "success": False,
                "message": str(err),
                "timer": timer_manager.get_status()
            }), 500

    # ==============================================================
    # ERROR HANDLERS
    # ==============================================================

    @app.errorhandler(404)
    def not_found_handler(e):
        return jsonify({"error": "Endpoint not found", "status": 404}), 404

    @app.errorhandler(500)
    def internal_error_handler(e):
        return jsonify({"error": "Internal server error", "status": 500}), 500

    return app

app = create_app()

if __name__ == "__main__":
    import socket
    lan_ip = "127.0.0.1"
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        lan_ip = s.getsockname()[0]
        s.close()
    except Exception:
        pass

    print("==================================================")
    print("🤖 ROBO PET Backend Server Running!")
    print(f"💻 Laptop (Local): http://localhost:{Config.PORT}")
    print(f"📱 Mobile (Phone):  http://{lan_ip}:{Config.PORT}")
    print("==================================================")
    logger.info(f"Starting ROBO PET Backend on http://{Config.HOST}:{Config.PORT}")
    app.run(host=Config.HOST, port=Config.PORT, debug=Config.DEBUG)
