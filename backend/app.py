import os
import numpy as np
import tensorflow as tf
from flask import Flask, request, jsonify
from flask_cors import CORS
from flask_socketio import SocketIO, emit
import eventlet

# Patch for eventlet
eventlet.monkey_patch()

app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "*"}})
socketio = SocketIO(app, cors_allowed_origins="*", async_mode='eventlet', logger=True, engineio_logger=True)

# Paths
MODEL_PATH = './models/static_isl_model'
ENCODER_PATH = './models/static_label_encoder.npy'

print("Loading ISL model...")
model = None
label_encoder = None
feature_size = None

try:
    if not os.path.exists(MODEL_PATH):
        raise FileNotFoundError(f"Model not found at {MODEL_PATH}")
    if not os.path.exists(ENCODER_PATH):
        raise FileNotFoundError(f"Label encoder not found at {ENCODER_PATH}")

    model = tf.keras.models.load_model(MODEL_PATH)
    label_encoder = np.load(ENCODER_PATH, allow_pickle=True)
    print("✓ Model loaded successfully")
    print(f"✓ Classes ({len(label_encoder)}): {', '.join(sorted(label_encoder))}")
    try:
        print("Model input shape:", model.input_shape)
        # Expect (None, 63) or (None, 126)
        feature_size = int(model.input_shape[1])
        print("Feature size:", feature_size)
    except Exception:
        print("Model input shape: unknown")
except Exception as e:
    print(f"❌ Error loading model: {e}")

def predict_from_landmarks(landmarks_array):
    """
    landmarks_array: 63 (one hand) or 126 (two hands) floats
    """
    try:
        if model is None:
            return {'success': False, 'error': 'Model not loaded', 'label': None, 'confidence': 0.0}

        # Validate input size vs model feature_size
        arr = np.array(landmarks_array, dtype=np.float32)
        if feature_size and arr.size != feature_size:
            return {'success': False, 'error': f'Input size {arr.size} != model feature size {feature_size}', 'label': None, 'confidence': 0.0}

        # Reshape and predict
        x = np.expand_dims(arr, axis=0)
        pred = model.predict(x, verbose=0)
        idx = int(np.argmax(pred))
        lbl = str(label_encoder[idx]).upper()
        conf = float(np.max(pred))
        print(f"Prediction: {lbl} ({conf:.2%})")

        return {'success': True, 'label': lbl, 'confidence': conf}
    except Exception as e:
        print(f"Prediction error: {e}")
        return {'success': False, 'error': str(e), 'label': None, 'confidence': 0.0}

@app.route('/health', methods=['GET'])
def health():
    return jsonify({
        'status': 'healthy',
        'model_loaded': model is not None,
        'feature_size': feature_size,
        'classes': sorted([str(c).upper() for c in label_encoder]) if label_encoder is not None else []
    })

@app.route('/predict', methods=['POST'])
def predict():
    try:
        data = request.get_json(force=True)
        if 'landmarks' not in data:
            return jsonify({'success': False, 'error': 'No landmarks provided'}), 400
        landmarks = data['landmarks']
        print(f"REST received landmarks len={len(landmarks)}")
        result = predict_from_landmarks(landmarks)
        return jsonify(result)
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@socketio.on('connect')
def on_connect():
    print('✓ Client connected')
    emit('connected', {'message': 'Connected to ISL server'})

@socketio.on('disconnect')
def on_disconnect():
    print('✗ Client disconnected')

@socketio.on('predict_landmarks')
def on_predict_landmarks(data):
    try:
        landmarks = data.get('landmarks', [])
        print(f"WS received landmarks len={len(landmarks)}")
        result = predict_from_landmarks(landmarks)
        emit('prediction_result', result)
    except Exception as e:
        print(f"WS error: {e}")
        emit('prediction_error', {'error': str(e)})

if __name__ == '__main__':
    print("\n" + "="*60)
    print("EduSign+ Backend Server")
    print("="*60)
    print(f"Model path: {MODEL_PATH}")
    print(f"Encoder path: {ENCODER_PATH}")
    print(f"Model loaded: {model is not None}")
    print(f"Classes: {len(label_encoder) if label_encoder is not None else 0}")
    print("="*60 + "\n")
    print("🚀 Starting server on http://localhost:5001\n")
    socketio.run(app, host='0.0.0.0', port=5001, debug=True)