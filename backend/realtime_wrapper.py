import eventlet
eventlet.monkey_patch()

from flask import Flask, request, jsonify
from flask_cors import CORS
from flask_socketio import SocketIO, emit
import numpy as np
import logging
from firebase_admin_config import initialize_firebase
from collections import deque

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "*"}})
socketio = SocketIO(app, cors_allowed_origins="*", async_mode='eventlet', logger=True, engineio_logger=True)

# Load model with legacy format support
logger.info("Loading ISL model...")
try:
    import tensorflow as tf
    from tensorflow import keras
    
    # Try loading with compile=False to avoid optimizer issues
    model = keras.models.load_model('./models/static_isl_model.keras', compile=False)
    
    # Recompile manually
    model.compile(
        optimizer='adam',
        loss='sparse_categorical_crossentropy',
        metrics=['accuracy']
    )
    
    logger.info("✅ Model loaded successfully")
except Exception as e:
    logger.error(f"❌ Model loading failed: {e}")
    logger.info("Trying alternative loading method...")
    
    # Alternative: Load weights only
    try:
        from tensorflow.keras.models import model_from_json
        
        # Try loading with safe_mode
        model = keras.models.load_model(
            './models/static_isl_model.keras', 
            compile=False,
            safe_mode=False
        )
        model.compile(
            optimizer='adam',
            loss='sparse_categorical_crossentropy',
            metrics=['accuracy']
        )
        logger.info("✅ Model loaded with safe_mode=False")
    except Exception as e2:
        logger.error(f"❌ Alternative loading also failed: {e2}")
        raise

label_encoder_classes = np.load('./models/static_label_encoder.npy', allow_pickle=True)
logger.info(f"✅ Feature size: {model.input_shape[1]}")
logger.info(f"✅ Classes ({len(label_encoder_classes)}): {', '.join(map(str, label_encoder_classes))}")

# Normalize class names up-front
def _norm(s):
    if isinstance(s, (bytes, np.bytes_)):
        s = s.decode('utf-8', errors='ignore')
    return str(s).strip().upper()

label_encoder_classes = np.array([_norm(c) for c in label_encoder_classes])

CONFIDENCE_THRESHOLD = 0.7
SMOOTH_WINDOW = 3
client_state = {}  # { sid: { 'buffer': deque, 'stableCount': int } }

@app.route('/health', methods=['GET'])
def health():
    return jsonify({
        'status': 'healthy',
        'model': 'loaded',
        'classes': len(label_encoder_classes)
    })

@app.route('/predict', methods=['POST'])
def predict_rest():
    """REST API endpoint for predictions"""
    try:
        data = request.get_json()
        landmarks = np.array(data['landmarks']).reshape(1, -1)
        
        # Predict
        prediction = model.predict(landmarks, verbose=0)
        class_idx = np.argmax(prediction[0])
        confidence = float(prediction[0][class_idx])
        predicted_letter = str(label_encoder_classes[class_idx])
        
        logger.info(f"🎯 REST Prediction: {predicted_letter} ({confidence:.2%})")
        
        return jsonify({
            'letter': predicted_letter,
            'confidence': confidence,
            'success': True
        })
    except Exception as e:
        logger.error(f"❌ REST Prediction error: {str(e)}")
        return jsonify({'error': str(e), 'success': False}), 500

@socketio.on('connect')
def handle_connect():
    logger.info(f"✅ Client connected: {request.sid}")
    client_state[request.sid] = {'buffer': deque(maxlen=SMOOTH_WINDOW), 'stableCount': 0}
    emit('connection_response', {
        'status': 'connected',
        'message': 'Successfully connected to ISL prediction server'
    })

@socketio.on('disconnect')
def handle_disconnect():
    logger.info(f"❌ Client disconnected: {request.sid}")
    client_state.pop(request.sid, None)

@socketio.on('predict')
def handle_predict(data):
    try:
        landmarks = np.array(data.get('landmarks', []), dtype=np.float32).reshape(1, -1)
        expected_size = model.input_shape[1]
        if landmarks.shape[1] != expected_size or np.count_nonzero(landmarks) == 0:
            emit('prediction', {'success': False, 'error': f'Invalid landmarks: Expected {expected_size}, got {landmarks.shape[1]}'}); return

        preds = model.predict(landmarks, verbose=0)
        idx = int(np.argmax(preds[0]))
        confidence = float(preds[0][idx])
        predicted_letter = _norm(label_encoder_classes[idx])

        # Stability
        state = client_state.setdefault(request.sid, {'buffer': deque(maxlen=SMOOTH_WINDOW), 'stableCount': 0})
        stable = confidence >= CONFIDENCE_THRESHOLD

        # Normalize target from frontend
        target_letter = _norm(data.get('target', '')) if data.get('target') is not None else ''
        matches_target = (target_letter == '' or predicted_letter == target_letter)

        if stable:
            state['buffer'].append(predicted_letter)
            state['stableCount'] = min(state['stableCount'] + 1, SMOOTH_WINDOW)
        else:
            if state['stableCount'] > 0:
                state['stableCount'] -= 1

        # Confirm rules:
        # - If frontend provides target: confirm when stable AND matches target
        # - Else: confirm when stable
        confirmed = stable and (target_letter == '' or matches_target)

        # Get top 5 predictions for debugging
        top5_indices = np.argsort(preds[0])[-5:][::-1]
        top5_predictions = [(label_encoder_classes[i], float(preds[0][i])) for i in top5_indices]
        
        logger.info(f"🎯 {predicted_letter} ({confidence:.2%}) target={target_letter or '-'} "
                    f"stable={stable} stableCount={state['stableCount']}/{SMOOTH_WINDOW} confirmed={confirmed}")
        logger.info(f"   📊 Top 5: {', '.join([f'{letter}({prob:.1%})' for letter, prob in top5_predictions])}")
        logger.info(f"   🖐️ Landmarks non-zero: {np.count_nonzero(landmarks)}/{landmarks.size} ({np.count_nonzero(landmarks)/landmarks.size:.1%})")

        emit('prediction', {
            'success': True,
            'label': predicted_letter,        # compatibility
            'letter': predicted_letter,       # UI compares this to target
            'confidence': confidence,
            'stable': stable,
            'confirmed': confirmed,           # frontend: celebrate + advance on true
            'stableCount': state['stableCount'],
            'all_predictions': {
                _norm(label_encoder_classes[i]): float(preds[0][i])
                for i in range(len(label_encoder_classes))
            }
        })
    except Exception as e:
        logger.error(f"❌ Socket Prediction error: {e}")
        emit('prediction', {'success': False, 'error': str(e)})

if __name__ == '__main__':
    logger.info("\n" + "="*60)
    logger.info("🎓 EduSign ISL Real-time Detection Server")
    logger.info("="*60)
    logger.info(f"📂 Model: ./models/static_isl_model.keras")
    logger.info(f"📂 Encoder: ./models/static_label_encoder.npy")
    logger.info(f"🔢 Feature size: {model.input_shape[1]}")
    logger.info(f"🔤 Classes: {len(label_encoder_classes)}")
    logger.info("="*60)
    logger.info("\n🚀 Starting server on http://localhost:5001\n")
    
    socketio.run(app, host='0.0.0.0', port=5001, debug=False, use_reloader=False)