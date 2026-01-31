from flask import Flask, request, jsonify
from flask_cors import CORS
import numpy as np
from tensorflow import keras
import logging
from firebase_admin_config import initialize_firebase

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "*"}})

# Load model
logger.info("Loading ISL model...")
model = keras.models.load_model('./models/static_isl_model.keras')
label_encoder_classes = np.load('./models/static_label_encoder.npy', allow_pickle=True)
logger.info(f"✅ Model loaded: {len(label_encoder_classes)} classes")

# Initialize Firebase
initialize_firebase()
logger.info("✅ Firebase initialized")

@app.route('/predict', methods=['POST'])
def predict():
    try:
        data = request.get_json()
        landmarks = np.array(data['landmarks']).reshape(1, -1)
        
        # Predict
        prediction = model.predict(landmarks, verbose=0)
        class_idx = np.argmax(prediction[0])
        confidence = float(prediction[0][class_idx])
        predicted_letter = str(label_encoder_classes[class_idx])
        
        logger.info(f"🎯 Prediction: {predicted_letter} ({confidence:.2%})")
        
        return jsonify({
            'letter': predicted_letter,
            'confidence': confidence
        })
    except Exception as e:
        logger.error(f"❌ Prediction error: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/health', methods=['GET'])
def health():
    return jsonify({'status': 'healthy', 'model': 'loaded'})

if __name__ == '__main__':
    logger.info("🚀 Starting simple server on http://localhost:5001")
    app.run(host='0.0.0.0', port=5001, debug=False)