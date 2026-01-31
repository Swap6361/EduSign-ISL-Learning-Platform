# import eventlet
# eventlet.monkey_patch()

from flask import Flask, request, jsonify
from flask_cors import CORS
from flask_socketio import SocketIO, emit
import numpy as np
import json
import logging
import gc

# Production mode flag - set to True to reduce logging overhead
PRODUCTION_MODE = False

logging.basicConfig(level=logging.WARNING if PRODUCTION_MODE else logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "*"}})
socketio = SocketIO(app, cors_allowed_origins="*", async_mode='threading', logger=not PRODUCTION_MODE, engineio_logger=not PRODUCTION_MODE)

# Prediction counter for garbage collection
prediction_count = 0

# Load motion words model (24 words)
MODEL_PATH = './models_words/isl_words_best_24_words.h5'
LABELS_PATH = './models_words/labels.json'

logger.info("Loading Motion Words model...")
try:
    import tensorflow as tf
    from tensorflow import keras
    
    # Configure TensorFlow for optimal performance
    gpus = tf.config.experimental.list_physical_devices('GPU')
    if gpus:
        try:
            for gpu in gpus:
                tf.config.experimental.set_memory_growth(gpu, True)
            logger.info(f"✅ Enabled GPU memory growth for {len(gpus)} GPUs")
        except RuntimeError as e:
            logger.error(f"❌ GPU memory growth setting failed: {e}")

    tf.config.optimizer.set_jit(True)  # Enable XLA JIT compilation
    
    model = keras.models.load_model(MODEL_PATH, compile=False)
    model.compile(
        optimizer='adam',
        loss='sparse_categorical_crossentropy',
        metrics=['accuracy'],
        jit_compile=True  # Enable JIT compilation for this model
    )
    
    with open(LABELS_PATH, 'r') as f:
        labels = json.load(f)
    
    logger.info(f"✅ Motion model loaded: {len(labels)} words")
    
    # Pre-warm model with dummy prediction for faster first inference
    logger.info("🔥 Pre-warming model...")
    dummy_input = np.zeros((1, 30, 1629), dtype=np.float32)
    _ = model.predict(dummy_input, verbose=0)
    logger.info("✅ Model pre-warmed and ready")
    
except Exception as e:
    logger.error(f"❌ Model loading failed: {e}")
    raise

@app.route('/health', methods=['GET'])
def health():
    return jsonify({
        'status': 'healthy',
        'model': 'general_words_stage1_motion',
        'words': len(labels)
    })

@socketio.on('connect')
def handle_connect():
    logger.info(f"✅ Client connected: {request.sid}")
    emit('connection_response', {
        'status': 'connected',
        'message': 'Successfully connected to General Words Stage 1 (Motion) server'
    })

@socketio.on('disconnect')
def handle_disconnect():
    logger.info(f"❌ Client disconnected: {request.sid}")

@socketio.on('predict')
def handle_predict(data):
    """Socket.IO endpoint for motion words predictions - handles 30-frame sequences"""
    global prediction_count
    
    if not PRODUCTION_MODE:
        logger.info("=" * 60)
        logger.info("📥 PREDICT HANDLER CALLED")
    
    try:
        if 'sequence' not in data:
            emit('prediction', {
                'success': False,
                'error': 'No sequence data provided',
                'word': 'Error',
                'label': 'Error',
                'confidence': 0.0,
                'stable': False
            })
            return
        
        sequence = np.array(data['sequence'], dtype=np.float32)
        target = data.get('target', '')
        
        if not PRODUCTION_MODE:
            logger.info(f"📥 Received sequence: shape={sequence.shape}, target={target}")
        
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
        
        # Robust normalization (optimized with in-place operations)
        T, F = sequence.shape
        P = F // 3
        pts = sequence.reshape((T, P, 3))
        
        # Center around temporal mean (in-place)
        center = np.nanmean(pts, axis=(0, 1))
        center = np.nan_to_num(center, 0)
        pts -= center
        
        # Normalize by standard deviation (in-place)
        std = np.nanstd(pts)
        std = max(std, 1e-6)
        pts /= std
        
        # Clip outliers (in-place)
        np.clip(pts, -5, 5, out=pts)
        sequence = pts.reshape((T, F))
        
        # Predict
        sequence_batch = np.expand_dims(sequence, 0)
        pred = model.predict(sequence_batch, verbose=0)
        idx = np.argmax(pred[0])
        confidence = float(pred[0][idx])
        predicted_word = str(labels[idx])
        
        if not PRODUCTION_MODE:
            logger.info(f"🎯 Word Prediction: {predicted_word} ({confidence:.2%})")
        
        # Emit prediction
        response = {
            'success': True,
            'word': predicted_word,
            'label': predicted_word,
            'confidence': confidence,
            'stable': confidence >= 0.70,
            'model_used': 'motion'
        }
        emit('prediction', response)
        
        # Memory management - garbage collect every 5 predictions
        prediction_count += 1
        if prediction_count % 5 == 0:
            gc.collect()
            if not PRODUCTION_MODE:
                logger.info(f"🧹 Garbage collection performed (prediction #{prediction_count})")
        
    except Exception as e:
        logger.error(f"❌ Prediction error: {str(e)}")
        import traceback
        logger.error(traceback.format_exc())
        
        # Always send a response, even on error
        emit('prediction', {
            'success': False,
            'error': str(e),
            'word': 'Error',
            'label': 'Error',
            'confidence': 0.0,
            'stable': False
        })
    
    if not PRODUCTION_MODE:
        logger.info("=" * 60)

if __name__ == '__main__':
    logger.info("\n" + "="*60)
    logger.info("💬 EduSign General Words Stage 1 (Motion) Server")
    logger.info("="*60)
    logger.info(f"📂 Model: {MODEL_PATH}")
    logger.info(f"🔢 Words: {len(labels)}")
    logger.info(f"📝 Labels: {', '.join(labels[:5])}... (showing first 5)")
    logger.info("="*60)
    logger.info("\n🚀 Starting server on http://localhost:5007\n")
    
    socketio.run(app, host='0.0.0.0', port=5007, debug=False, use_reloader=False)
