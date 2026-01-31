import eventlet
eventlet.monkey_patch()

from flask import Flask, request, jsonify
from flask_cors import CORS
from flask_socketio import SocketIO, emit
import numpy as np
import json
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "*"}})
socketio = SocketIO(app, cors_allowed_origins="*", async_mode='eventlet', logger=True, engineio_logger=True)

# Load A-Z words model (26 words)
MODEL_PATH = './models_a-z/isl_words_best_26_words.h5'
LABELS_PATH = './models_a-z/labels.json'

logger.info("Loading A-Z Words model...")
try:
    import tensorflow as tf
    from tensorflow import keras
    
    model = keras.models.load_model(MODEL_PATH, compile=False)
    model.compile(
        optimizer='adam',
        loss='sparse_categorical_crossentropy',
        metrics=['accuracy']
    )
    
    with open(LABELS_PATH, 'r') as f:
        labels = json.load(f)
    
    logger.info(f"✅ A-Z Words model loaded: {len(labels)} words")
    
except Exception as e:
    logger.error(f"❌ Model loading failed: {e}")
    # Don't raise, just log, so server stays alive for debugging
    model = None
    labels = []

@app.route('/health', methods=['GET'])
def health():
    return jsonify({
        'status': 'healthy',
        'model': 'a_z_words',
        'words': len(labels)
    })

@socketio.on('connect')
def handle_connect():
    logger.info(f"✅ Client connected: {request.sid}")
    emit('connection_response', {
        'status': 'connected',
        'message': 'Successfully connected to A-Z Words server'
    })

@socketio.on('disconnect')
def handle_disconnect():
    logger.info(f"❌ Client disconnected: {request.sid}")

@socketio.on('predict')
def handle_predict(data):
    """Socket.IO endpoint for A-Z words predictions - handles 30-frame sequences"""
    logger.info("=" * 60)
    logger.info("📥 PREDICT HANDLER CALLED (A-Z WORDS)")
    # logger.info(f"📦 Data keys: {list(data.keys())}")
    
    try:
        if model is None:
             emit('prediction', {'success': False, 'error': 'Model not loaded'})
             return

        if 'sequence' not in data:
            logger.error("❌ No 'sequence' key in data!")
            emit('prediction', {'success': False, 'error': 'No sequence data provided'})
            return
        
        sequence = np.array(data['sequence'], dtype=np.float32)
        target = data.get('target', '')
        
        # logger.info(f"📥 Received sequence: shape={sequence.shape}, target={target}")
        
        # Validate sequence shape
        if sequence.ndim != 2:
            error_msg = f"Invalid sequence shape: {sequence.shape}, expected 2D array"
            logger.error(f"❌ {error_msg}")
            emit('prediction', {'success': False, 'error': error_msg})
            return
        
        SEQ_LEN = 30
        
        # Pad or trim to target length
        if sequence.shape[0] < SEQ_LEN:
            pad_frames = SEQ_LEN - sequence.shape[0]
            padding = np.tile(sequence[-1:], (pad_frames, 1))
            sequence = np.vstack((sequence, padding))
        elif sequence.shape[0] > SEQ_LEN:
            start = max(0, (sequence.shape[0] - SEQ_LEN) // 2)
            sequence = sequence[start:start + SEQ_LEN]
        
        # Robust normalization
        T, F = sequence.shape
        P = F // 3
        pts = sequence.reshape((T, P, 3))
        
        center = np.nanmean(pts, axis=(0, 1))
        center = np.nan_to_num(center, 0)
        pts -= center
        
        std = np.nanstd(pts)
        std = max(std, 1e-6)
        pts /= std
        
        pts = np.clip(pts, -5, 5)
        sequence = pts.reshape((T, F))
        
        # Predict
        sequence_batch = np.expand_dims(sequence, 0)
        
        # logger.info("🤖 Running A-Z words model prediction...")
        pred = model.predict(sequence_batch, verbose=0)
        idx = np.argmax(pred[0])
        confidence = float(pred[0][idx])
        predicted_word = str(labels[idx])
        
        logger.info(f"🎯 Prediction: {predicted_word} ({confidence:.2%})")
        
        # Emit prediction
        response = {
            'success': True,
            'word': predicted_word,
            'label': predicted_word,
            'confidence': confidence,
            'stable': confidence >= 0.60,
            'model_used': 'a-z-words'
        }
        # logger.info(f"📤 Emitting response: {response}")
        emit('prediction', response)
        # logger.info("✅ Response emitted successfully")
        
        # Clear memory after prediction
        import gc
        gc.collect()
        
    except Exception as e:
        logger.error(f"❌ Prediction error: {str(e)}")
        import traceback
        logger.error("Full traceback:")
        logger.error(traceback.format_exc())
        emit('prediction', {
            'success': False,
            'error': str(e)
        })
    
    # logger.info("=" * 60)

if __name__ == '__main__':
    logger.info("\n" + "="*60)
    logger.info("💬 EduSign A-Z Words Recognition Server")
    logger.info("="*60)
    logger.info(f"📂 Model: {MODEL_PATH}")
    logger.info(f"🔢 Words: {len(labels)}")
    if labels:
        logger.info(f"📝 Words: {', '.join(labels[:5])}... (showing first 5)")
    logger.info("="*60)
    logger.info("\n🚀 Starting server on http://localhost:5009\n")
    
    socketio.run(app, host='0.0.0.0', port=5009, debug=False, use_reloader=False)
