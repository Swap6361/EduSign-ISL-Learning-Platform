import eventlet
eventlet.monkey_patch()

from flask import Flask, request, jsonify
from flask_cors import CORS
from flask_socketio import SocketIO, emit
import numpy as np
import json
import logging
import os
import gc

# Production mode flag - set to True to reduce logging overhead
PRODUCTION_MODE = False

logging.basicConfig(level=logging.WARNING if PRODUCTION_MODE else logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "*"}})
socketio = SocketIO(app, cors_allowed_origins="*", async_mode='eventlet', logger=not PRODUCTION_MODE, engineio_logger=not PRODUCTION_MODE)

# Prediction counter for garbage collection
prediction_count = 0

# Load colours model
MODEL_PATH = './model_colour/models/isl_words_best_12_words.h5'
LABELS_PATH = './model_colour/models/labels.json'

logger.info("Loading Colours model...")
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
    
    logger.info("✅ Colours model loaded successfully")
    logger.info(f"✅ Classes ({len(labels)}): {', '.join(labels)}")
    
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
        'model': 'colours',
        'classes': len(labels)
    })

@socketio.on('connect')
def handle_connect():
    logger.info(f"✅ Client connected: {request.sid}")
    emit('connection_response', {
        'status': 'connected',
        'message': 'Successfully connected to Colours prediction server'
    })

@socketio.on('disconnect')
def handle_disconnect():
    logger.info(f"❌ Client disconnected: {request.sid}")

@socketio.on('predict')
def handle_predict(data):
    """Socket.IO endpoint for colours predictions - handles motion sequences"""
    global prediction_count
    
    if not PRODUCTION_MODE:
        logger.info("=" * 60)
        logger.info("📥 PREDICT HANDLER CALLED")
        logger.info(f"📦 Data keys: {list(data.keys())}")
    
    try:
        # Check if sequence data is provided
        if 'sequence' in data:
            if not PRODUCTION_MODE:
                logger.info("✅ Sequence data found")
            
            # Motion-based prediction (sequence of 30 frames)
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
            if not PRODUCTION_MODE:
                logger.info(f"🔧 Adjusting sequence length from {sequence.shape[0]} to {SEQ_LEN}")
            
            if sequence.shape[0] < SEQ_LEN:
                # Replicate last frame
                pad_frames = SEQ_LEN - sequence.shape[0]
                padding = np.tile(sequence[-1:], (pad_frames, 1))
                sequence = np.vstack((sequence, padding))
            elif sequence.shape[0] > SEQ_LEN:
                # Trim from center
                start = max(0, (sequence.shape[0] - SEQ_LEN) // 2)
                sequence = sequence[start:start + SEQ_LEN]
            
            # Robust normalization (same as training) - optimized with in-place operations
            T, F = sequence.shape
            P = F // 3  # Number of landmarks
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
            
            # Reshape back
            sequence = pts.reshape((T, F))
            
            # Expand dims for batch
            sequence_batch = np.expand_dims(sequence, 0)
            
            # Predict
            prediction = model.predict(sequence_batch, verbose=0)
            
            class_idx = np.argmax(prediction[0])
            confidence = float(prediction[0][class_idx])
            predicted_colour = str(labels[class_idx])
            
            if not PRODUCTION_MODE:
                logger.info(f"🎯 Color Prediction: {predicted_colour} ({confidence:.2%})")
                logger.info(f"📊 All probabilities: {dict(zip(labels, [f'{p:.2%}' for p in prediction[0]]))}")
            
            # Emit prediction
            response = {
                'success': True,
                'color': predicted_colour,
                'label': predicted_colour,
                'confidence': confidence,
                'stable': confidence >= 0.60,  # 70% threshold for motion
                'all_predictions': {
                    str(labels[i]): float(prediction[0][i])
                    for i in range(len(labels))
                }
            }
            emit('prediction', response)
            
            # Memory management - garbage collect every 5 predictions
            prediction_count += 1
            if prediction_count % 5 == 0:
                gc.collect()
                if not PRODUCTION_MODE:
                    logger.info(f"🧹 Garbage collection performed (prediction #{prediction_count})")
            
        else:
            logger.error("❌ No 'sequence' key in data!")
            if not PRODUCTION_MODE:
                logger.info(f"Available keys: {list(data.keys())}")
            # Fallback: single-frame prediction (for backward compatibility)
            landmarks = np.array(data['landmarks']).reshape(1, -1)
            
            expected_size = model.input_shape[1]
            if landmarks.shape[1] != expected_size:
                error_msg = f"Feature size mismatch: got {landmarks.shape[1]}, expected {expected_size}"
                logger.error(f"❌ {error_msg}")
                emit('prediction', {'success': False, 'error': error_msg})
                return
            
            prediction = model.predict(landmarks, verbose=0)
            class_idx = np.argmax(prediction[0])
            confidence = float(prediction[0][class_idx])
            predicted_colour = str(labels[class_idx])
            
            logger.info(f"🎯 Colour Prediction: {predicted_colour} ({confidence:.2%})")
            
            emit('prediction', {
                'success': True,
                'label': predicted_colour,
                'color': predicted_colour,
                'confidence': confidence,
                'stable': confidence >= 0.70,
                'all_predictions': {
                    str(labels[i]): float(prediction[0][i])
                    for i in range(len(labels))
                }
            })
        
    except Exception as e:
        logger.error(f"❌ Prediction error: {str(e)}")
        logger.error(f"Error type: {type(e).__name__}")
        import traceback
        logger.error("Full traceback:")
        logger.error(traceback.format_exc())
        
        # Always send a response, even on error
        emit('prediction', {
            'success': False,
            'error': str(e),
            'color': 'Error',
            'label': 'Error',
            'confidence': 0.0,
            'stable': False
        })
    
    if not PRODUCTION_MODE:
        logger.info("=" * 60)

if __name__ == '__main__':
    logger.info("\n" + "="*60)
    logger.info("🎨 EduSign Colours Real-time Detection Server")
    logger.info("="*60)
    logger.info(f"📂 Model: {MODEL_PATH}")
    logger.info(f"📂 Labels: {LABELS_PATH}")
    logger.info(f"🔢 Feature size: {model.input_shape}")
    logger.info(f"🔤 Classes: {len(labels)}")
    logger.info("="*60)
    logger.info("\n🚀 Starting server on http://localhost:5006\n")
    
    socketio.run(app, host='0.0.0.0', port=5006, debug=False, use_reloader=False)
