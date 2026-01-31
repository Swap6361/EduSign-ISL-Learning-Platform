import eventlet
eventlet.monkey_patch()

from flask import Flask, request, jsonify
from flask_cors import CORS
from flask_socketio import SocketIO, emit
import numpy as np
import json
import logging
import os
from collections import deque, Counter

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "*"}})
socketio = SocketIO(app, cors_allowed_origins="*", async_mode='eventlet', logger=True, engineio_logger=True)

# Configuration
MODEL_PATH = './model_number/static_numbers_model.keras'
LABELS_PATH = './model_number/numbers_labels.json'
STATS_PATH = './model_number/numbers_feature_stats.npz'
CONFIDENCE_THRESHOLD = 0.6
SMOOTH_WINDOW = 5

logger.info("Loading Numbers model...")
model = None
labels = None
expected_feature_size = None
mean = None
std = None

try:
    import tensorflow as tf
    from tensorflow import keras
    
    # Load model
    try:
        model = keras.models.load_model(MODEL_PATH, compile=False)
        logger.info("✅ Model loaded with compile=False")
    except Exception as e1:
        logger.warning(f"⚠️ First load attempt failed: {e1}")
        try:
            model = keras.models.load_model(MODEL_PATH, compile=False, safe_mode=False)
            logger.info("✅ Model loaded with safe_mode=False")
        except Exception as e2:
            logger.error(f"❌ Alternative loading failed: {e2}")
            raise e2
    
    # Recompile
    model.compile(
        optimizer='adam',
        loss='sparse_categorical_crossentropy',
        metrics=['accuracy']
    )
    
    # Get expected feature size
    expected_feature_size = int(model.input_shape[1])
    logger.info(f"✅ Model expects {expected_feature_size} features")
    
    # Load labels
    try:
        with open(LABELS_PATH, 'r') as f:
            labels = json.load(f)
    except:
        labels = np.load('./model_number/numbers_labels.npy', allow_pickle=True)
    
    labels = [str(label) for label in labels]
    
    # Load normalization stats
    try:
        if os.path.exists(STATS_PATH):
            stats = np.load(STATS_PATH)
            mean = stats["mean"]
            std = stats["std"]
            logger.info("✅ Normalization stats loaded (mean/std)")
        else:
            logger.warning("⚠️ Stats file not found, using raw features")
            mean = None
            std = None
    except Exception as e:
        logger.warning(f"⚠️ Could not load stats: {e}, using raw features")
        mean = None
        std = None
    
    logger.info("✅ Numbers model loaded successfully")
    logger.info(f"✅ Classes ({len(labels)}): {', '.join(labels)}")
    logger.info(f"✅ Feature size: {expected_feature_size}")
    
except Exception as e:
    logger.error(f"❌ Model loading failed: {e}")
    import traceback
    logger.error(traceback.format_exc())
    raise

def extract_single_hand(features, target_size):
    """Extract single hand features if model expects 63 (one hand)"""
    feats = np.array(features, dtype=np.float32)
    
    if len(feats) == target_size:
        return feats
    
    if len(feats) == 126 and target_size == 63:
        # Split into left (0-62) and right (63-125)
        left = feats[:63]
        right = feats[63:126]
        left_nz = np.count_nonzero(left)
        right_nz = np.count_nonzero(right)
        # Choose the hand with more non-zero values
        return right if right_nz >= left_nz else left
    
    raise ValueError(f"Expected {target_size} features, got {len(feats)}")

def normalize_features(features, mean, std):
    """Normalize features using mean and std"""
    if mean is not None and std is not None:
        return (features - mean) / np.maximum(std, 1e-8)
    return features

@app.route('/health', methods=['GET'])
def health():
    return jsonify({
        'status': 'healthy' if model is not None else 'unhealthy',
        'model': 'numbers',
        'classes': len(labels) if labels else 0,
        'feature_size': expected_feature_size,
        'model_loaded': model is not None,
        'confidence_threshold': CONFIDENCE_THRESHOLD
    })

@app.route('/predict', methods=['POST'])
def predict_rest():
    """REST API endpoint for number predictions"""
    try:
        if model is None or labels is None:
            return jsonify({'error': 'Model not loaded', 'success': False}), 500
        
        data = request.get_json()
        landmarks_array = data.get('landmarks', [])
        
        if not landmarks_array:
            return jsonify({'error': 'No landmarks provided', 'success': False}), 400
        
        # Extract single hand if needed
        landmarks = extract_single_hand(landmarks_array, expected_feature_size)
        
        # Check if features are valid (not all zeros)
        if np.count_nonzero(landmarks) == 0:
            return jsonify({'error': 'All landmarks are zero', 'success': False}), 400
        
        # Normalize features
        landmarks = normalize_features(landmarks, mean, std)
        landmarks = landmarks.reshape(1, -1)
        
        # Predict
        prediction = model.predict(landmarks, verbose=0)
        class_idx = int(np.argmax(prediction[0]))
        confidence = float(prediction[0][class_idx])
        predicted_number = str(labels[class_idx])
        
        # Only return prediction if confidence exceeds threshold
        if confidence < CONFIDENCE_THRESHOLD:
            logger.info(f"⚠️ Low confidence: {predicted_number} ({confidence:.2%}) < {CONFIDENCE_THRESHOLD}")
            return jsonify({
                'number': None,
                'confidence': confidence,
                'success': False,
                'error': f'Confidence {confidence:.2%} below threshold {CONFIDENCE_THRESHOLD}'
            })
        
        logger.info(f"🎯 REST Number Prediction: {predicted_number} ({confidence:.2%})")
        
        return jsonify({
            'number': predicted_number,
            'label': predicted_number,
            'confidence': confidence,
            'success': True
        })
    except Exception as e:
        logger.error(f"❌ REST Prediction error: {str(e)}")
        return jsonify({'error': str(e), 'success': False}), 500

@socketio.on('connect')
def handle_connect():
    logger.info(f"✅ Client connected: {request.sid}")
    emit('connection_response', {
        'status': 'connected',
        'message': 'Successfully connected to Numbers prediction server'
    })

@socketio.on('disconnect')
def handle_disconnect():
    logger.info(f"❌ Client disconnected: {request.sid}")

@socketio.on('predict')
def handle_predict(data):
    """Socket.IO endpoint for number predictions with smoothing"""
    try:
        if model is None or labels is None:
            emit('prediction', {'success': False, 'error': 'Model not loaded'})
            return
        
        feats = data.get('landmarks', [])
        if not feats:
            emit('prediction', {'success': False, 'error': 'No landmarks provided'})
            return

        # Extract single hand if needed
        landmarks = extract_single_hand(feats, expected_feature_size)
        
        # Log feature statistics
        nonzero_count = np.count_nonzero(landmarks)
        logger.info(f"📊 Features: {len(landmarks)} total, {nonzero_count} non-zero, min={np.min(landmarks):.3f}, max={np.max(landmarks):.3f}, mean={np.mean(landmarks):.3f}")
        
        if nonzero_count == 0:
            emit('prediction', {'success': False, 'error': 'All landmarks are zero'})
            return

        # Normalize features
        landmarks = normalize_features(landmarks, mean, std)
        
        # Make prediction
        preds = model.predict(landmarks.reshape(1, -1), verbose=0)
        idx = int(np.argmax(preds[0]))
        conf = float(preds[0][idx])
        
        # Debug: Log top 3 predictions
        top_indices = np.argsort(preds[0])[-3:][::-1]
        top_preds = [(labels[i], float(preds[0][i])) for i in top_indices]
        logger.info(f"🎯 Top 3: {top_preds}")
        logger.info(f"🎯 Final Prediction: {labels[idx]} ({conf:.2%})")
        
        # Only emit if confidence exceeds threshold
        if conf >= CONFIDENCE_THRESHOLD:
            emit('prediction', {
                'success': True,
                'label': str(labels[idx]),
                'confidence': conf,
                'stable': True,
                'all_predictions': {str(labels[i]): float(preds[0][i]) for i in range(len(labels))}
            })
        else:
            logger.info(f"⚠️ Low confidence: {labels[idx]} ({conf:.2%}) < {CONFIDENCE_THRESHOLD}")
            emit('prediction', {
                'success': False,
                'error': f'Confidence below threshold',
                'label': str(labels[idx]),
                'confidence': conf,
                'stable': False,
                'all_predictions': {str(labels[i]): float(preds[0][i]) for i in range(len(labels))}
            })
            
    except Exception as e:
        logger.error(f"❌ Prediction error: {e}")
        import traceback
        logger.error(traceback.format_exc())
        emit('prediction', {'success': False, 'error': str(e)})

if __name__ == '__main__':
    if model is None or labels is None:
        logger.error("❌ Cannot start server: Model or labels not loaded")
        exit(1)
    
    logger.info("\n" + "="*60)
    logger.info("🔢 EduSign Numbers Real-time Detection Server")
    logger.info("="*60)
    logger.info(f"📂 Model: {MODEL_PATH}")
    logger.info(f"📂 Labels: {LABELS_PATH}")
    logger.info(f"🔢 Feature size: {expected_feature_size}")
    logger.info(f"🔤 Classes ({len(labels)}): {', '.join(labels)}")
    logger.info(f"📊 Confidence threshold: {CONFIDENCE_THRESHOLD}")
    logger.info("="*60)
    logger.info("\n🚀 Starting server on http://localhost:5002\n")
    
    socketio.run(app, host='0.0.0.0', port=5002, debug=False, use_reloader=False)

