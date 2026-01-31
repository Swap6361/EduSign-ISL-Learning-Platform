"""
Real-time ISL Days prediction server with robust model loading.

Integrates the proven logic from recognition_static_days.py for web deployment.
"""

import eventlet
eventlet.monkey_patch()

from collections import deque, Counter
import json
import logging
import os
from typing import Dict, Optional

import numpy as np
from flask import Flask, jsonify, request
from flask_cors import CORS
from flask_socketio import SocketIO, emit

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "*"}})
socketio = SocketIO(app, cors_allowed_origins="*", async_mode="eventlet", logger=True, engineio_logger=True)


# ---------------------------------------------------------------------------
# Model + labels loading (robust version from working script)
# ---------------------------------------------------------------------------

def _norm(s):
	"""Normalize label to title case (Monday, Tuesday, etc.)"""
	if isinstance(s, (bytes, np.bytes_)):
		s = s.decode("utf-8", errors="ignore")
	return str(s).strip().title()


def _load_model(path: str):
	"""Load model robustly across TF/Keras versions and formats."""
	import tensorflow as tf
	
	try:
		# Keras-native formats (.keras, .h5)
		if path.endswith(('.keras', '.h5')):
			try:
				from keras import models as kmodels
				return kmodels.load_model(path), None
			except Exception:
				# Fallback to tf.keras for legacy h5
				return tf.keras.models.load_model(path), None

		# SavedModel directory -> use tf.saved_model.load
		if os.path.isdir(path):
			logger.info(f"Loading SavedModel via tf.saved_model.load: {path}")
			loaded = tf.saved_model.load(path)

			# Pick a signature (prefer 'serving_default')
			signatures = getattr(loaded, 'signatures', {})
			if not signatures:
				raise RuntimeError("SavedModel has no signatures")

			if 'serving_default' in signatures:
				infer = signatures['serving_default']
			else:
				# Take any available signature
				infer = next(iter(signatures.values()))

			return loaded, infer

		raise ValueError(f"Unsupported model path: {path}")
	except Exception as e:
		raise RuntimeError(f"Failed to load model from {path}: {e}")


def _forward(model, infer_fn, x: np.ndarray) -> np.ndarray:
	"""Forward pass for both Keras models and SavedModel signatures."""
	import tensorflow as tf
	
	# SavedModel path: use signature runner
	if infer_fn is not None:
		try:
			# Inspect structured input signature to get input keys
			_, input_dict = infer_fn.structured_input_signature
			feed = {}
			tensor = tf.convert_to_tensor(x, dtype=tf.float32)
			if len(input_dict) == 1:
				key = next(iter(input_dict.keys()))
				feed[key] = tensor
			else:
				# Try common names, fallback to first key
				key = 'inputs' if 'inputs' in input_dict else next(iter(input_dict.keys()))
				feed[key] = tensor

			outputs = infer_fn(**feed)

			# Normalize outputs to a single tensor
			if isinstance(outputs, dict):
				for k in ('outputs', 'probabilities', 'predictions', 'logits'):
					if k in outputs:
						outputs = outputs[k]
						break
				else:
					outputs = next(iter(outputs.values()))
			if hasattr(outputs, 'numpy'):
				outputs = outputs.numpy()
			if isinstance(outputs, (list, tuple)):
				outputs = outputs[0]
			return np.asarray(outputs, dtype=np.float32)
		except Exception as e:
			raise RuntimeError(f"SavedModel forward failed: {e}")

	# Keras model path: call with training=False
	out = model(x, training=False)
	if isinstance(out, dict):
		out = next(iter(out.values()))
	if hasattr(out, 'numpy'):
		out = out.numpy()
	if isinstance(out, (list, tuple)):
		out = out[0]
	return np.asarray(out, dtype=np.float32)


def _infer_feature_size(model, infer_fn) -> int:
	"""Infer input feature size from model by probing."""
	# If using tf.saved_model signature, try reading its input spec
	if infer_fn is not None:
		try:
			_, input_dict = infer_fn.structured_input_signature
			spec = next(iter(input_dict.values()))
			# Expect shape [None, feature_size]
			if getattr(spec, "shape", None) is not None and len(spec.shape) == 2 and spec.shape[1] is not None:
				return int(spec.shape[1])
		except Exception:
			pass

	# Probe common sizes (126 for two hands, 63 for single hand)
	for size in (126, 63):
		try:
			dummy = np.zeros((1, size), dtype=np.float32)
			out = _forward(model, infer_fn, dummy)
			if isinstance(out, np.ndarray) and out.ndim == 2 and out.shape[0] == 1:
				return size
		except Exception:
			continue

	# Keras model input_shape fallback
	try:
		shape = getattr(model, 'input_shape', None)
		if shape and isinstance(shape, (list, tuple)) and len(shape) >= 2 and shape[1] is not None:
			return int(shape[1])
	except Exception:
		pass

	logger.warning("⚠ Could not infer feature size reliably. Defaulting to 126.")
	return 126


def load_model_and_labels():
	"""Load model and labels with robust error handling."""
	model_path: Optional[str] = None
	model_dir = os.path.join(os.path.dirname(__file__), "models_days")

	# Search for any .keras file in models_days directory
	if os.path.isdir(model_dir):
		for fname in os.listdir(model_dir):
			if fname.startswith("isl_days") and fname.endswith(".keras"):
				model_path = os.path.join(model_dir, fname)
				break

	# Fallback to specific paths if directory search fails
	if not model_path:
		fallbacks = [
			os.path.join(model_dir, "isl_days_final_Friday_Monday_Saturday_Sunday_Thursday_Tuesday_Wednesday.keras"),
			os.path.join(model_dir, "isl_days_best_Friday_Monday_Saturday_Sunday_Thursday_Tuesday_Wednesday.h5"),
			os.path.join(model_dir, "isl_days_model.h5"),
			os.path.join(model_dir, "isl_days_model"),  # SavedModel directory
		]
		for p in fallbacks:
			if os.path.exists(p):
				model_path = p
				break

	if not model_path:
		raise FileNotFoundError(
			"Days model not found in ./models_days\n"
			"Expected files like isl_days*.keras or isl_days*.h5"
		)

	logger.info(f"Loading days model: {model_path}")
	model, infer_fn = _load_model(model_path)

	# Load label encoder
	label_path = None
	for candidate in [
		os.path.join(model_dir, "days_label_encoder.npy"),
		os.path.join(model_dir, "days_labels.npy"),
		os.path.join(model_dir, "days_labels.json"),
	]:
		if os.path.exists(candidate):
			label_path = candidate
			break

	if not label_path:
		raise FileNotFoundError(
			"Label encoder not found in ./models_days\n"
			"Expected days_label_encoder.npy or days_labels.npy"
		)

	if label_path.endswith(".npy"):
		labels = np.load(label_path, allow_pickle=True)
	else:
		with open(label_path, "r", encoding="utf-8") as f:
			labels = json.load(f)

	# Normalize labels to title case
	labels = np.array([_norm(x) for x in labels])
	
	# Infer feature size
	feature_size = _infer_feature_size(model, infer_fn)
	
	logger.info(f"✅ Model loaded successfully")
	logger.info(f"✅ Feature size: {feature_size} ({'two hands' if feature_size == 126 else 'single hand'})")
	logger.info(f"✅ Days recognized ({len(labels)}): {', '.join(sorted(labels))}")
	
	return model, infer_fn, labels, feature_size


model, infer_fn, label_encoder_classes, FEATURE_SIZE = load_model_and_labels()


# ---------------------------------------------------------------------------
# Prediction helpers with smoothing (EXACT logic from working desktop version)
# ---------------------------------------------------------------------------

CONFIDENCE_THRESHOLD = 0.60
SMOOTH_WINDOW = 3
MIN_CONSISTENT_PREDICTIONS = 2  # Reduced from 5 to 2 for faster predictions
STABILITY_THRESHOLD = 0.05
COOLDOWN_FRAMES = 3  # Reduced from 10 to 3 for faster predictions

# Per-client state for smoothing and stability
client_state: Dict[str, Dict] = {}


def predict_vector(vec: np.ndarray):
	"""Run prediction on feature vector."""
	preds = _forward(model, infer_fn, vec)
	idx = int(np.argmax(preds[0]))
	confidence = float(preds[0][idx])
	predicted_day = _norm(label_encoder_classes[idx])
	return predicted_day, confidence, preds[0]


def check_stability(landmarks: np.ndarray, frame_buffer: deque) -> bool:
	"""Check if hand is stable (not moving too much) - EXACT logic from desktop version."""
	if len(frame_buffer) < frame_buffer.maxlen:
		frame_buffer.append(landmarks)
		return False

	frames = np.array(frame_buffer)
	variance = np.var(frames, axis=0).mean()
	frame_buffer.append(landmarks)
	return variance < STABILITY_THRESHOLD


def get_smooth_prediction(prediction_history: deque, current_pred: str, current_conf: float):
	"""Get smoothed prediction with voting - EXACT logic from desktop version."""
	if current_conf > CONFIDENCE_THRESHOLD:
		prediction_history.append(current_pred)

	if len(prediction_history) < MIN_CONSISTENT_PREDICTIONS:
		return None, 0.0

	counter = Counter(prediction_history)
	most_common = counter.most_common(1)[0]
	prediction = most_common[0]
	count = most_common[1]

	if count < MIN_CONSISTENT_PREDICTIONS:
		return None, 0.0

	confidence = count / len(prediction_history)
	return prediction, confidence


# ---------------------------------------------------------------------------
# REST endpoints
# ---------------------------------------------------------------------------

@app.route("/health", methods=["GET"])
def health():
	return jsonify({
		"status": "healthy",
		"model": "days",
		"classes": len(label_encoder_classes),
		"feature_size": FEATURE_SIZE,
	})


@app.route("/predict", methods=["POST"])
def predict_rest():
	try:
		data = request.get_json(force=True)
		landmarks = np.array(data.get("landmarks", []), dtype=np.float32).reshape(1, -1)
		if landmarks.shape[1] != FEATURE_SIZE:
			return jsonify({"success": False, "error": f"Expected {FEATURE_SIZE} features"}), 400

		predicted_day, confidence, preds = predict_vector(landmarks)

		return jsonify({
			"success": True,
			"day": predicted_day,
			"label": predicted_day,
			"confidence": confidence,
			"all_predictions": {
				_norm(label_encoder_classes[i]): float(preds[i])
				for i in range(len(label_encoder_classes))
			}
		})
	except Exception as e:
		logger.error(f"❌ REST prediction error: {e}")
		return jsonify({"success": False, "error": str(e)}), 500


# ---------------------------------------------------------------------------
# Socket.IO events
# ---------------------------------------------------------------------------

@socketio.on("connect")
def handle_connect():
	logger.info(f"✅ Client connected: {request.sid}")
	client_state[request.sid] = {
		"buffer": deque(maxlen=SMOOTH_WINDOW),
		"stableCount": 0,
		"prediction_history": deque(maxlen=10),
		"frame_buffer": deque(maxlen=5),
		"prediction_cooldown": 0,
		"last_target": ""
	}
	emit("connection_response", {"status": "connected"})


@socketio.on("disconnect")
def handle_disconnect():
	logger.info(f"❌ Client disconnected: {request.sid}")
	client_state.pop(request.sid, None)


@socketio.on("predict")
def handle_predict(data):
	"""Handle prediction request - EXACT logic from desktop version."""
	try:
		landmarks = np.array(data.get("landmarks", []), dtype=np.float32)
		target = data.get("target", "")
		if target:
			target = _norm(target)

		# Validate landmarks (frontend sends 126 features already normalized)
		if landmarks.size == 0 or np.count_nonzero(landmarks) == 0:
			emit("prediction", {"success": False, "error": "No landmarks provided"})
			return

		# Reshape to (1, FEATURE_SIZE)
		landmarks_flat = landmarks.flatten()
		
		# Handle feature size mismatch (pad or truncate if needed)
		if landmarks_flat.size < FEATURE_SIZE:
			padded = np.zeros(FEATURE_SIZE, dtype=np.float32)
			padded[:landmarks_flat.size] = landmarks_flat
			landmarks_flat = padded
		elif landmarks_flat.size > FEATURE_SIZE:
			landmarks_flat = landmarks_flat[:FEATURE_SIZE]
		
		# Check if sufficient non-zero features (same as desktop version: 30%)
		non_zero_ratio = np.count_nonzero(landmarks_flat) / len(landmarks_flat)
		
		if non_zero_ratio < 0.3:
			emit("prediction", {"success": False, "error": "Insufficient landmark data"})
			return

		# Initialize state for this client if needed
		state = client_state.setdefault(request.sid, {
			"buffer": deque(maxlen=SMOOTH_WINDOW),
			"stableCount": 0,
			"prediction_history": deque(maxlen=10),
			"frame_buffer": deque(maxlen=5),
			"prediction_cooldown": 0,
			"last_target": ""
		})

		# Clear prediction history when target changes (moving to next day)
		if target and target != state.get("last_target"):
			logger.info(f"🔄 Target changed from {state.get('last_target')} to {target}, clearing prediction history")
			state["prediction_history"].clear()
			state["buffer"].clear()
			state["stableCount"] = 0
			state["prediction_cooldown"] = 0
			state["last_target"] = target

		# Check cooldown (same as desktop version)
		if state["prediction_cooldown"] > 0:
			state["prediction_cooldown"] -= 1
			emit("prediction", {"success": False, "error": "Cooldown active"})
			return

		# Check hand stability (EXACT desktop logic)
		is_stable = check_stability(landmarks_flat, state["frame_buffer"])

		# Only predict when stable (EXACT desktop logic)
		if not is_stable:
			emit("prediction", {"success": False, "error": "Hand not stable"})
			return

		# Run prediction
		landmarks_input = landmarks_flat.reshape(1, -1).astype(np.float32)
		predicted_day, raw_confidence, preds = predict_vector(landmarks_input)

		logger.info(f"📊 Raw prediction: {predicted_day} ({raw_confidence:.2%})")

		# Apply smoothing with voting (EXACT desktop logic)
		smooth_pred, smooth_conf = get_smooth_prediction(
			state["prediction_history"], 
			predicted_day, 
			raw_confidence
		)

		# If we have a smoothed prediction, use it; otherwise use raw
		if smooth_pred and smooth_conf > 0.5:
			final_day = smooth_pred
			final_confidence = smooth_conf
			
			# Update state (EXACT desktop logic)
			if final_day != state.get("current_prediction") or smooth_conf > state.get("current_confidence", 0):
				state["current_prediction"] = final_day
				state["current_confidence"] = final_confidence
				state["prediction_cooldown"] = COOLDOWN_FRAMES
				
				logger.info(f"✅ DETECTED: {final_day} (confidence: {final_confidence:.0%})")
		else:
			# Not enough consistent predictions yet
			emit("prediction", {"success": False, "error": "Building prediction history"})
			return

		# Update stability count
		if final_confidence >= CONFIDENCE_THRESHOLD and is_stable:
			state["buffer"].append(final_day)
			state["stableCount"] = min(state["stableCount"] + 1, SMOOTH_WINDOW)
		else:
			state["stableCount"] = max(state["stableCount"] - 1, 0)

		# Check if stable enough (require at least 2/3 stability)
		stable = state["stableCount"] >= 2
		confirmed = stable and (not target or final_day == target)

		logger.info(
			f"🎯 {final_day} (raw:{raw_confidence:.2%} smooth:{final_confidence:.2%}) "
			f"stable:{is_stable} stableCount:{state['stableCount']}/{SMOOTH_WINDOW} "
			f"target:{target or '-'} confirmed:{confirmed}"
		)

		emit("prediction", {
			"success": True,
			"label": final_day,
			"day": final_day,
			"confidence": final_confidence,
			"stable": stable,
			"confirmed": confirmed,
			"stableCount": state["stableCount"],
			"all_predictions": {
				_norm(label_encoder_classes[i]): float(preds[i])
				for i in range(len(label_encoder_classes))
			}
		})
	except Exception as e:
		logger.error(f"❌ Socket prediction error: {e}", exc_info=True)
		emit("prediction", {"success": False, "error": str(e)})


if __name__ == "__main__":
	logger.info("\n" + "=" * 60)
	logger.info("🎓 ISL Days Real-time Detection Server")
	logger.info("=" * 60)
	logger.info(f"📂 Model: {model}")
	logger.info(f"🔢 Feature size: {FEATURE_SIZE}")
	logger.info(f"🔤 Classes: {', '.join(map(str, label_encoder_classes))}")
	logger.info("=" * 60)
	logger.info("\n🚀 Starting server on http://localhost:5005\n")

	socketio.run(app, host="0.0.0.0", port=5005, debug=False, use_reloader=False)
