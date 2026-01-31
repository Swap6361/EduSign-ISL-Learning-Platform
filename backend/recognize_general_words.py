import eventlet
eventlet.monkey_patch()

from flask import Flask, request, jsonify
from flask_cors import CORS
from flask_socketio import SocketIO, emit
import numpy as np
import json
import logging
import os

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "*"}})
socketio = SocketIO(app, cors_allowed_origins="*", async_mode='eventlet', logger=True, engineio_logger=True)

# Load general words models (motion + static)
MOTION_MODEL_PATH = './models_words/isl_words_best_24_words.h5'
MOTION_LABELS_PATH = './models_words/labels.json'
STATIC_MODEL_PATH = '../../../model_words2/models/static_words_best_16_words.h5'
STATIC_LABELS_PATH = '../../../model_words2/models/static_words_labels.json'

logger.info("Loading General Words models...")
try:
    import tensorflow as tf
    from tensorflow import keras
    
    # Load motion model (24 words)
    motion_model = keras.models.load_model(MOTION_MODEL_PATH, compile=False)
    motion_model.compile(
        optimizer='adam',
        loss='sparse_categorical_crossentropy',
        metrics=['accuracy']
    )
    
    with open(MOTION_LABELS_PATH, 'r') as f:
        motion_labels = json.load(f)
    
    logger.info(f"✅ Motion model loaded: {len(motion_labels)} words")
    
    # Load static model (16 words)
    static_model = keras.models.load_model(STATIC_MODEL_PATH, compile=False)
    static_model.compile(
        optimizer='adam',
        loss='sparse_categorical_crossentropy',
        metrics=['accuracy']
    )
    
    with open(STATIC_LABELS_PATH, 'r') as f:
        static_labels = json.load(f)
    
    logger.info(f"✅ Static model loaded: {len(static_labels)} words")
    logger.info(f"✅ Total words: {len(motion_labels) + len(static_labels)}")
    
except Exception as e:
    logger.error(f"❌ Model loading failed: {e}")
    raise

@app.route('/health', methods=['GET'])
def health():
    return jsonify({
        'status': 'healthy',
        'model': 'general_words',
        'motion_words': len(motion_labels),
        'static_words': len(static_labels),
        'total': len(motion_labels) + len(static_labels)
    })

@socketio.on('connect')
def handle_connect():
    logger.info(f"✅ Client connected: {request.sid}")
    emit('connection_response', {
        'status': 'connected',
        'message': 'Successfully connected to General Words prediction server'
    })

@socketio.on('disconnect')
def handle_disconnect():
    logger.info(f"❌ Client disconnected: {request.sid}")

@socketio.on('predict')
def handle_predict(data):
    """Socket.IO endpoint for general words predictions - handles motion sequences"""
    logger.info("=" * 60)
    logger.info("📥 PREDICT HANDLER CALLED")
    logger.info(f"📦 Data keys: {list(data.keys())}")
    
    try:
        # Check if sequence data is provided
        if 'sequence' in data:
            logger.info("✅ Sequence data found")
            # Motion-based prediction (sequence of 30 frames)
            sequence = np.array(data['sequence'], dtype=np.float32)
            target = data.get('target', '')
            
            logger.info(f"📥 Received sequence: shape={sequence.shape}, target={target}")
            
            # Validate sequence shape
            if sequence.ndim != 2:
                error_msg = f"Invalid sequence shape: {sequence.shape}, expected 2D array"
                logger.error(f"❌ {error_msg}")
                emit('prediction', {'success': False, 'error': error_msg})
                return
            
            SEQ_LEN = 30
            
            # Pad or trim to target length
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
            
            logger.info(f"✅ Sequence adjusted: shape={sequence.shape}")
            
            # Robust normalization (same as training)
            logger.info("🔧 Starting normalization...")
            T, F = sequence.shape
            P = F // 3  # Number of landmarks
            pts = sequence.reshape((T, P, 3))
            
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
            
            # Reshape back
            sequence = pts.reshape((T, F))
            
            logger.info(f"✅ Normalized sequence: shape={sequence.shape}")
            
            # Expand dims for batch
            sequence_batch = np.expand_dims(sequence, 0)            
            logger.info(f"🔧 Batch shape: {sequence_batch.shape}")
            
            # Get target word to determine which model to use
            target_word = target.strip()
            
            # Motion words (first 24) - match labels.json exactly (capitalized)
            motion_words_list = [
                'Afternoon', 'Born', 'Brush', 'Bye', 'Come', 'Cry', 'Go', 'Happy',
                'Hearing', 'Hello', 'Man', 'Morning', 'Name', 'Nice', 'Night', 'Please',
                'Sad', 'Separate', 'Sorry', 'Thankyou', 'Week', 'Welcome', 'Woman', 'Yes'
            ]
            
            # Static words (last 16) - match static_words_labels.json exactly (lowercase)
            static_words_list = [
                'bad', 'drink', 'food', 'good', 'home', 'i,me', 'like', 'love',
                'my', 'namaste', 'sleep', 'teacher', 'today', 'water', 'you', 'your'
            ]
            
            # Also need to handle capitalized versions from frontend
            static_words_capitalized = [w.capitalize() for w in static_words_list]
            static_words_capitalized[5] = 'I,me'  # Special case
            static_words_capitalized[9] = 'Namaste'
            
            # Determine which model to use based on target word
            use_motion = target_word in motion_words_list
            use_static = target_word in static_words_capitalized or target_word.lower() in static_words_list
            
            predicted_word = ""
            confidence = 0.0
            model_used = "unknown"
            
            if use_motion:
                # USE MOTION MODEL ONLY
                logger.info("🤖 Using MOTION model for word: " + target_word)
                motion_pred = motion_model.predict(sequence_batch, verbose=0)
                motion_idx = np.argmax(motion_pred[0])
                confidence = float(motion_pred[0][motion_idx])
                predicted_word = str(motion_labels[motion_idx])
                model_used = "motion"
                logger.info(f"  Motion: {predicted_word} ({confidence:.2%})")
                
            elif use_static:
                # USE STATIC MODEL ONLY
                logger.info("🤖 Using STATIC model for word: " + target_word)
                # Extract static features from last frame (126 features = 2 hands)
                last_frame = sequence[-1]
                # Static model expects 126 features (hand landmarks only)
                # Holistic = face(1404) + pose(99) + hands(126)
                # hands start at index 1503
                if len(last_frame) >= 1629:
                    static_features = last_frame[1503:1629]  # Last 126 features
                    static_batch = np.expand_dims(static_features, 0)
                    
                    static_pred = static_model.predict(static_batch, verbose=0)
                    static_idx = np.argmax(static_pred[0])
                    confidence = float(static_pred[0][static_idx])
                    predicted_word = str(static_labels[static_idx])
                    model_used = "static"
                    logger.info(f"  Static: {predicted_word} ({confidence:.2%})")
                else:
                    logger.error("❌ Insufficient features for static prediction")
                    predicted_word = "Unknown"
                    confidence = 0.0
                    
            else:
                # Unknown word - try both models
                logger.info("⚠️ Unknown target word, trying both models...")
                motion_pred = motion_model.predict(sequence_batch, verbose=0)
                motion_idx = np.argmax(motion_pred[0])
                motion_conf = float(motion_pred[0][motion_idx])
                motion_word = str(motion_labels[motion_idx])
                
                # TRY STATIC MODEL (using last frame only)
                static_conf = 0.0
                static_word = ""
                last_frame = sequence[-1]
                if len(last_frame) >= 1629:
                    static_features = last_frame[1503:1629]
                    static_batch = np.expand_dims(static_features, 0)
                    static_pred = static_model.predict(static_batch, verbose=0)
                    static_idx = np.argmax(static_pred[0])
                    static_conf = float(static_pred[0][static_idx])
                    static_word = str(static_labels[static_idx])
                
                logger.info(f"  Motion: {motion_word} ({motion_conf:.2%})")
                logger.info(f"  Static: {static_word} ({static_conf:.2%})")

                # Choose best prediction
                if motion_conf >= static_conf:
                    predicted_word = motion_word
                    confidence = motion_conf
                    model_used = "motion"
                else:
                    predicted_word = static_word
                    confidence = static_conf
                    model_used = "static"
            
            logger.info(f"🎯 Final Prediction: {predicted_word} ({confidence:.2%}) [model: {model_used}]")
            
            # Emit prediction
            response = {
                'success': True,
                'word': predicted_word,
                'label': predicted_word,
                'confidence': confidence,
                'stable': confidence >= 0.70,  # 70% threshold
                'model_used': model_used
            }
            logger.info(f"📤 Emitting response: {response}")
            emit('prediction', response)
            logger.info("✅ Response emitted successfully")
            
        else:
            logger.error("❌ No 'sequence' key in data!")
            logger.info(f"Available keys: {list(data.keys())}")
            emit('prediction', {'success': False, 'error': 'No sequence data provided'})
        
    except Exception as e:
        logger.error(f"❌ Prediction error: {str(e)}")
        logger.error(f"Error type: {type(e).__name__}")
        import traceback
        logger.error("Full traceback:")
        logger.error(traceback.format_exc())
        emit('prediction', {
            'success': False,
            'error': str(e)
        })
    
    logger.info("=" * 60)

if __name__ == '__main__':
    logger.info("\n" + "="*60)
    logger.info("💬 EduSign General Words Real-time Detection Server")
    logger.info("="*60)
    logger.info(f"📂 Motion Model: {MOTION_MODEL_PATH}")
    logger.info(f"📂 Static Model: {STATIC_MODEL_PATH}")
    logger.info(f"🔢 Motion words: {len(motion_labels)}")
    logger.info(f"🔢 Static words: {len(static_labels)}")
    logger.info(f"🔢 Total words: {len(motion_labels) + len(static_labels)}")
    logger.info("="*60)
    logger.info("\n🚀 Starting server on http://localhost:5007\n")
    
    socketio.run(app, host='0.0.0.0', port=5007, debug=False, use_reloader=False)
