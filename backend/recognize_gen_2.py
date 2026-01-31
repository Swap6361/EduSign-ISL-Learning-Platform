# import eventlet
# eventlet.monkey_patch()

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
socketio = SocketIO(app, cors_allowed_origins="*", async_mode='threading', logger=True, engineio_logger=True)

# Load static words model (16 words)
MODEL_PATH = '../../../model_words2/models/static_words_best_16_words.h5'
LABELS_PATH = '../../../model_words2/models/static_words_labels.json'

logger.info("Loading Static Words model...")
try:
    import tensorflow as tf
    from tensorflow import keras
    
    # Configure TensorFlow for memory growth (essential for running multiple models)
    gpus = tf.config.experimental.list_physical_devices('GPU')
    if gpus:
        try:
            for gpu in gpus:
                tf.config.experimental.set_memory_growth(gpu, True)
            logger.info(f"✅ Enabled GPU memory growth for {len(gpus)} GPUs")
        except RuntimeError as e:
            logger.error(f"❌ GPU memory growth setting failed: {e}")
    
    # Robust model loading
    def load_model_robust(path):
        """Load model robustly across TF/Keras versions."""
        try:
            if path.endswith(('.keras', '.h5')):
                try:
                    return keras.models.load_model(path, compile=False)
                except Exception:
                    return tf.keras.models.load_model(path, compile=False)
            elif os.path.isdir(path):
                logger.info(f"Loading SavedModel via tf.saved_model.load: {path}")
                loaded = tf.saved_model.load(path)
                signatures = getattr(loaded, 'signatures', {})
                if not signatures:
                    raise RuntimeError("SavedModel has no signatures")
                return loaded, signatures.get('serving_default', next(iter(signatures.values())))
            raise ValueError(f"Unsupported model path: {path}")
        except Exception as e:
            raise RuntimeError(f"Failed to load model from {path}: {e}")
    
    model_result = load_model_robust(MODEL_PATH)
    if isinstance(model_result, tuple):
        model, infer_signature = model_result
        use_signature = True
    else:
        model = model_result
        use_signature = False
        model.compile(
            optimizer='adam',
            loss='sparse_categorical_crossentropy',
            metrics=['accuracy']
        )
    
    with open(LABELS_PATH, 'r') as f:
        labels = json.load(f)
    
    # Infer feature size
    def infer_feature_size(model_obj):
        """Infer input feature size from model."""
        if use_signature:
            try:
                _, input_dict = infer_signature.structured_input_signature
                spec = next(iter(input_dict.values()))
                if hasattr(spec, 'shape') and len(spec.shape) == 2 and spec.shape[1] is not None:
                    return int(spec.shape[1])
            except Exception:
                pass
        
        # Try probing
        for size in (126, 63):
            try:
                dummy = np.zeros((1, size), dtype=np.float32)
                if use_signature:
                    _, input_dict = infer_signature.structured_input_signature
                    key = next(iter(input_dict.keys()))
                    infer_signature(**{key: tf.convert_to_tensor(dummy)})
                else:
                    model_obj.predict(dummy, verbose=0)
                return size
            except Exception:
                continue
        
        # Fallback from model.input_shape
        try:
            shape = getattr(model_obj, 'input_shape', None)
            if shape and len(shape) >= 2 and shape[1] is not None:
                return int(shape[1])
        except Exception:
            pass
        
        logger.warning("Could not infer feature size, defaulting to 126")
        return 126
    
    feature_size = infer_feature_size(model)
    two_hands = (feature_size == 126)
    
    logger.info(f"✅ Static model loaded: {len(labels)} words")
    logger.info(f"✅ Feature size: {feature_size} ({'two hands' if two_hands else 'single hand'})")
    logger.info(f"✅ Words: {', '.join(labels)}")
    
except Exception as e:
    logger.error(f"❌ Model loading failed: {e}")
    raise

# Client state management (per session)
client_states = {}

def get_client_state(sid):
    """Get or create client state."""
    if sid not in client_states:
        client_states[sid] = {
            'prediction_history': deque(maxlen=5),
            'frame_buffer': deque(maxlen=5),
            'current_prediction': None,
            'current_confidence': 0.0,
            'prediction_cooldown': 0,
            'cooldown_frames': 8,
            'confidence_threshold': 0.70,
            'min_consistent_predictions': 5,
            'stability_threshold': 0.05
        }
    return client_states[sid]

def normalize_landmarks(landmarks_array):
    """Normalize landmarks relative to hand bounding box (per hand)."""
    if len(landmarks_array) == 0:
        return landmarks_array
    
    # Reshape to (21, 3) per hand
    hands_count = len(landmarks_array) // 63
    normalized = []
    
    for hand_idx in range(hands_count):
        start_idx = hand_idx * 63
        hand_data = landmarks_array[start_idx:start_idx + 63].reshape(21, 3)
        
        x_coords = hand_data[:, 0]
        y_coords = hand_data[:, 1]
        
        if len(x_coords) > 0 and len(y_coords) > 0:
            min_x, min_y = np.min(x_coords), np.min(y_coords)
            hand_data[:, 0] -= min_x
            hand_data[:, 1] -= min_y
        
        normalized.append(hand_data.flatten())
    
    return np.concatenate(normalized).astype(np.float32)

def check_hand_stability(state, current_landmarks):
    """Check if hand is stable (not moving too much)."""
    if len(state['frame_buffer']) < state['frame_buffer'].maxlen:
        state['frame_buffer'].append(current_landmarks)
        return False
    
    frames = np.array(state['frame_buffer'])
    variance = np.var(frames, axis=0).mean()
    state['frame_buffer'].append(current_landmarks)
    return variance < state['stability_threshold']

def get_smooth_prediction(state, current_pred, current_conf):
    """Get smoothed prediction with voting."""
    if current_conf > state['confidence_threshold']:
        state['prediction_history'].append(current_pred)
    
    if len(state['prediction_history']) < state['min_consistent_predictions']:
        return None, 0.0
    
    counter = Counter(state['prediction_history'])
    most_common = counter.most_common(1)[0]
    prediction = most_common[0]
    count = most_common[1]
    
    if count < state['min_consistent_predictions']:
        return None, 0.0
    
    confidence = count / len(state['prediction_history'])
    return prediction, confidence

def forward_predict(landmarks_input):
    """Forward pass for both Keras models and SavedModel signatures."""
    if use_signature:
        try:
            _, input_dict = infer_signature.structured_input_signature
            key = next(iter(input_dict.keys()))
            outputs = infer_signature(**{key: tf.convert_to_tensor(landmarks_input, dtype=tf.float32)})
            
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
    else:
        out = model.predict(landmarks_input, verbose=0)
        if isinstance(out, dict):
            out = next(iter(out.values()))
        if hasattr(out, 'numpy'):
            out = out.numpy()
        if isinstance(out, (list, tuple)):
            out = out[0]
        return np.asarray(out, dtype=np.float32)

@app.route('/health', methods=['GET'])
def health():
    return jsonify({
        'status': 'healthy',
        'model': 'general_words_stage2_static',
        'words': len(labels),
        'feature_size': feature_size,
        'two_hands': two_hands
    })

@socketio.on('connect')
def handle_connect():
    logger.info(f"✅ Client connected: {request.sid}")
    get_client_state(request.sid)  # Initialize state
    emit('connection_response', {
        'status': 'connected',
        'message': 'Successfully connected to General Words Stage 2 (Static) server',
        'feature_size': feature_size,
        'two_hands': two_hands
    })

@socketio.on('disconnect')
def handle_disconnect():
    logger.info(f"❌ Client disconnected: {request.sid}")
    # Cleanup client state
    if request.sid in client_states:
        del client_states[request.sid]

@socketio.on('predict')
def handle_predict(data):
    """Socket.IO endpoint for static words predictions - handles hand landmarks (single frame)"""
    try:
        state = get_client_state(request.sid)
        
        # Static recognition uses landmarks directly (not sequences)
        if 'landmarks' not in data:
            emit('prediction', {'success': False, 'error': 'No landmarks data provided'})
            return
        
        landmarks = np.array(data['landmarks'], dtype=np.float32)
        target = data.get('target', '')
        
        # Validate landmarks shape (should match expected feature size)
        if landmarks.shape[0] != feature_size:
            error_msg = f"Invalid landmarks shape: {landmarks.shape}, expected ({feature_size},)"
            emit('prediction', {'success': False, 'error': error_msg})
            return
        
        # Normalize landmarks
        landmarks_normalized = normalize_landmarks(landmarks)
        
        # Check non-zero ratio
        non_zero_ratio = np.count_nonzero(landmarks_normalized) / len(landmarks_normalized)
        
        if non_zero_ratio < 0.3:
            emit('prediction', {
                'success': True,
                'word': None,
                'confidence': 0.0,
                'stable': False,
                'message': 'Insufficient hand data'
            })
            return
        
        # Check hand stability
        is_stable = check_hand_stability(state, landmarks_normalized)
        
        # Handle cooldown
        if state['prediction_cooldown'] > 0:
            state['prediction_cooldown'] -= 1
            
            # Return current prediction during cooldown
            if state['current_prediction']:
                emit('prediction', {
                    'success': True,
                    'word': state['current_prediction'],
                    'label': state['current_prediction'],
                    'confidence': state['current_confidence'],
                    'stable': is_stable,
                    'cooldown': True,
                    'model_used': 'static'
                })
            return
        
        # Only predict when stable
        if not is_stable:
            emit('prediction', {
                'success': True,
                'word': None,
                'confidence': 0.0,
                'stable': False,
                'message': 'Keep hand steady'
            })
            return
        
        # Predict
        landmarks_batch = np.expand_dims(landmarks_normalized, 0)
        pred = forward_predict(landmarks_batch)
        idx = int(np.argmax(pred[0]))
        confidence = float(pred[0][idx])
        predicted_word = str(labels[idx])
        
        # Smooth prediction with voting
        smooth_pred, smooth_conf = get_smooth_prediction(state, predicted_word, confidence)
        
        if smooth_pred and smooth_conf > 0.5:
            # Update state with new prediction
            if smooth_pred != state['current_prediction'] or smooth_conf > state['current_confidence']:
                state['current_prediction'] = smooth_pred
                state['current_confidence'] = smooth_conf
                state['prediction_cooldown'] = state['cooldown_frames']
            
            # Emit prediction
            response = {
                'success': True,
                'word': smooth_pred,
                'label': smooth_pred,
                'confidence': smooth_conf,
                'raw_confidence': confidence,
                'stable': True,
                'model_used': 'static'
            }
            emit('prediction', response)
        else:
            emit('prediction', {
                'success': True,
                'word': None,
                'confidence': confidence,
                'raw_word': predicted_word,
                'stable': True,
                'building_consensus': True,
                'message': 'Building consensus...'
            })
        
    except Exception as e:
        logger.error(f"❌ Prediction error: {str(e)}")
        import traceback
        logger.error("Full traceback:")
        logger.error(traceback.format_exc())
        emit('prediction', {
            'success': False,
            'error': str(e)
        })

@socketio.on('reset')
def handle_reset(data=None):
    """Reset prediction history for current client."""
    try:
        state = get_client_state(request.sid)
        state['prediction_history'].clear()
        state['frame_buffer'].clear()
        state['current_prediction'] = None
        state['current_confidence'] = 0.0
        state['prediction_cooldown'] = 0
        
        logger.info(f"✅ State reset for client: {request.sid}")
        emit('reset_response', {'success': True, 'message': 'Prediction history reset'})
        
    except Exception as e:
        logger.error(f"❌ Reset error: {str(e)}")
        emit('reset_response', {'success': False, 'error': str(e)})

if __name__ == '__main__':
    logger.info("\n" + "="*60)
    logger.info("💬 EduSign General Words Stage 2 (Static) Server")
    logger.info("="*60)
    logger.info(f"📂 Model: {MODEL_PATH}")
    logger.info(f"🔢 Words: {len(labels)}")
    logger.info(f"📝 Labels: {', '.join(labels[:5])}... (showing first 5)")
    logger.info("="*60)
    logger.info("\n🚀 Starting server on http://localhost:5008\n")
    
    socketio.run(app, host='0.0.0.0', port=5008, debug=False, use_reloader=False)
