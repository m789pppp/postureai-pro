"""
websocket_server.py — PostureAI
Real-time posture scoring via WebSocket (Flask-SocketIO)
Replaces the polling pattern (analyze every 3s) with push-based updates.
Add SOCKETIO_ENABLED=true to env to activate.
"""
import os, base64, json, time, logging
from datetime import datetime

log = logging.getLogger("postureai.ws")

def init_socketio(app):
    """Initialize Socket.IO server. Call from backend.py if SOCKETIO_ENABLED=true."""
    try:
        from flask_socketio import SocketIO, emit, disconnect, join_room
        import firebase_admin.auth as _fb_auth

        socketio = SocketIO(
            app,
            cors_allowed_origins=os.getenv("CORS_ORIGINS","*").split(","),
            async_mode="gevent",       # or "threading" for Railway free tier
            logger=False,
            engineio_logger=False,
            ping_timeout=20,
            ping_interval=10,
        )

        @socketio.on("connect")
        def on_connect(auth):
            """Verify Firebase token on WebSocket connect."""
            token = (auth or {}).get("token","")
            if not token:
                log.warning("WS connect rejected: no token")
                disconnect()
                return False
            try:
                decoded = _fb_auth.verify_id_token(token, check_revoked=True)
                from flask import request as _req
                _req.environ["uid"]  = decoded["uid"]
                _req.environ["plan"] = decoded.get("plan","starter")
                join_room(decoded["uid"])   # private room per user
                emit("connected", {"uid": decoded["uid"], "ts": int(time.time())})
                log.info(f"WS connected: {decoded['uid']}")
            except Exception as e:
                log.warning(f"WS auth failed: {e}")
                disconnect()
                return False

        @socketio.on("disconnect")
        def on_disconnect():
            uid = getattr(getattr(__import__("flask"),"request",None),"environ",{}).get("uid","?")
            log.info(f"WS disconnected: {uid}")

        @socketio.on("frame")
        def on_frame(data):
            """
            Receive a frame from the client, analyze it, push score back.
            Payload: { frame: base64, mode: str, session_id: str }
            """
            from flask import request as _req
            uid  = _req.environ.get("uid","")
            plan = _req.environ.get("plan","starter")
            if not uid:
                emit("error", {"msg": "not authenticated"})
                return

            b64  = data.get("frame","")
            mode = data.get("mode","laptop")
            sid  = data.get("session_id","default")

            if not b64:
                emit("error", {"msg": "no frame"})
                return

            try:
                import cv2, numpy as np
                from backend import (analyze_front, analyze_side, enhance_low_light,
                                     push_score, get_smoothed_score)
                if "," in b64: b64 = b64.split(",",1)[1]
                img = cv2.imdecode(np.frombuffer(base64.b64decode(b64),np.uint8), cv2.IMREAD_COLOR)
                if img is None:
                    emit("error", {"msg": "invalid frame"})
                    return
                if mode in ("laptop","phone"):
                    img = cv2.flip(img,1)

                img_analyzed, brightness, enhanced = enhance_low_light(img)
                result = analyze_side(img_analyzed, plan) if mode=="side" else analyze_front(img_analyzed, mode, plan)
                result["brightness"] = round(brightness,1)
                result["low_light_enhanced"] = enhanced

                if result.get("detected") and result.get("score"):
                    push_score(uid, result["score"])
                    smoothed = get_smoothed_score(uid)
                    if smoothed:
                        result["overall"] = int(smoothed)

                # Push result only to this user's room
                emit("score", result, room=uid)

            except Exception as e:
                log.error(f"WS frame error: {e}")
                emit("error", {"msg": "analysis failed"})

        @socketio.on("end_session")
        def on_end_session(data):
            """Client signals end of session — save to Firestore."""
            from flask import request as _req
            uid = _req.environ.get("uid","")
            if uid:
                emit("session_saved", {"ok": True, "ts": int(time.time())}, room=uid)

        return socketio

    except ImportError as e:
        log.warning(f"flask-socketio not installed — WebSocket disabled: {e}")
        return None
