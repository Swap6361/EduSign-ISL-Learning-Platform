"""
recognize_sentences.py - WebSocket server for ISL Sentence Recognition
Port: 5010
Model: models_sentence/isl_sentences_best.h5
"""

import eventlet
eventlet.monkey_patch()

from flask import Flask, request
from flask_socketio import SocketIO, emit
from flask_cors import CORS
import numpy as np
import tensorflow as tf
import json
import gc
import logging
from pathlib import Path

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# ===========================
# CONFIG
# ===========================
PORT = 5010
MODEL_PATH = "models_sentence/isl_sentences_best.h5"
LABEL_PATH = "models_sentence/labels_sentences.json"
SEQ_LEN = 60

# Landmark counts
FACE_LM = 468
POSE_LM = 33
HAND_LM = 21
FEATURE_LEN = (FACE_LM + POSE_LM + HAND_LM * 2) * 3

# ===========================
# FLASK & SOCKETIO SETUP
# ===========================
app = Flask(__name__)
app.config['SECRET_KEY'] = 'sentence_recognition'
CORS(app)
socketio = SocketIO(
    app,
    cors_allowed_origins="*",
    async_mode='eventlet',
    ping_timeout=60,
    ping_interval=25,
    logger=True,
    engineio_logger=True,
    max_http_buffer_size=10000000  # 10MB
)

# ===========================
# LOAD MODEL & LABELS
# ===========================
try:
    model = tf.keras.models.load_model(MODEL_PATH, compile=False)
    model.compile(optimizer='adam', loss='sparse_categorical_crossentropy')
    logger.info(f"✓ Model loaded: {MODEL_PATH}")
    
    # JIT compilation warm-up
    dummy = np.zeros((1, SEQ_LEN, FEATURE_LEN), dtype=np.float32)
    _ = model.predict(dummy, verbose=0)
    logger.info("✓ Model warmed up")
except Exception as e:
    logger.error(f"✗ Error loading model: {e}")
    model = None

try:
    with open(LABEL_PATH, "r") as f:
        labels = np.array(json.load(f))
    logger.info(f"✓ Labels loaded: {labels}")
except Exception as e:
    logger.error(f"✗ Error loading labels: {e}")
    labels = []

prediction_count = 0

# ===========================
# NORMALIZATION
# ===========================
def robust_normalize(seq):
    """Normalize sequence with robust statistics"""
    seq = np.asarray(seq, np.float32)
    
    if seq.size == 0:
        return seq
    
    T, F = seq.shape
    if T == 0:
        return seq
    
    # Reshape to (T, num_points, 3)
    P = F // 3
    pts = seq.reshape((T, P, 3))
    
    # Center around temporal mean
    center = np.nanmean(pts, axis=(0, 1))
    center = np.nan_to_num(center, 0)
    pts -= center
    
    # Normalize by standard deviation
    std = np.nanstd(pts)
    std = max(std, 1e-6)
    pts /= std
    
    # Clip outliers
    pts = np.clip(pts, -5, 5)
    
    return pts.reshape((T, F))


def pad_or_trim(seq, length=SEQ_LEN):
    """Pad or trim sequence to target length"""
    seq = np.asarray(seq, np.float32)
    t, f = seq.shape
    
    if t == length:
        return seq
    
    if t < length:
        pad = np.tile(seq[-1:], (length - t, 1))
        return np.vstack((seq, pad))
    
    # Trim from center
    start = max(0, (t - length) // 2)
    return seq[start:start + length]


# ===========================
# WEBSOCKET HANDLERS
# ===========================
@socketio.on('connect')
def handle_connect():
    logger.info(f"✅ [SENTENCES] Client connected: {request.sid}")
    emit('connection_response', {'status': 'connected', 'port': PORT})


@socketio.on('disconnect')
def handle_disconnect():
    logger.info(f"❌ [SENTENCES] Client disconnected: {request.sid}")


@socketio.on('predict')
def handle_prediction(data):
    """Handle incoming sequence prediction request"""
    global prediction_count
    
    try:
        if model is None:
            emit('prediction', {
                'success': False,
                'error': 'Model not loaded'
            })
            return
        
        # Extract sequence from data
        sequence = data.get('sequence', [])
        
        if len(sequence) == 0:
            emit('prediction', {
                'success': False,
                'error': 'Empty sequence'
            })
            return
        
        # Convert to numpy array
        seq = np.array(sequence, dtype=np.float32)
        
        # Ensure correct shape
        if len(seq.shape) == 1:
            seq = seq.reshape(1, -1)
        
        # Pad/trim to SEQ_LEN
        seq = pad_or_trim(seq, SEQ_LEN)
        
        # Normalize
        seq = robust_normalize(seq)
        
        # Predict
        probs = model.predict(np.expand_dims(seq, 0), verbose=0)[0]
        idx = int(np.argmax(probs))
        confidence = float(probs[idx])
        sentence = str(labels[idx])
        
        # Determine stability based on confidence
        stable = confidence >= 0.30
        
        prediction_count += 1
        
        # Garbage collection every 5 predictions
        if prediction_count % 5 == 0:
            gc.collect()
        
        logger.info(f"📊 Predicted: {sentence} (conf: {confidence:.2f})")
        
        emit('prediction', {
            'success': True,
            'sentence': sentence,
            'label': sentence,
            'confidence': confidence,
            'stable': stable,
            'all_predictions': {
                str(labels[i]): float(probs[i])
                for i in range(len(labels))
            }
        })
        
    except Exception as e:
        logger.error(f"❌ Prediction error: {e}")
        emit('prediction', {
            'success': False,
            'error': str(e)
        })


# ===========================
# MAIN
# ===========================
if __name__ == '__main__':
    logger.info(f"\n{'='*60}")
    logger.info(f"🚀 [SENTENCES] Starting server on port {PORT}")
    logger.info(f"   Model: {MODEL_PATH}")
    logger.info(f"   Labels: {len(labels)} sentences")
    logger.info(f"   Sequence Length: {SEQ_LEN} frames")
    logger.info(f"{'='*60}\n")
    
    try:
        socketio.run(
            app,
            host='0.0.0.0',
            port=PORT,
            debug=False,
            use_reloader=False
        )
    except KeyboardInterrupt:
        logger.info("\n✓ Server stopped by user")
    except Exception as e:
        logger.error(f"\n✗ Server error: {e}")
