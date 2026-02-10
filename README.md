
#  EduSign - Indian Sign Language Learning Platform

An intelligent, gamified platform for learning Indian Sign Language (ISL) with real-time gesture recognition powered by MediaPipe and CNN.

![ISL Alphabets](./alphabets-of-Indian-Sign-Language.png)



##  Features

- **Real-time Hand Recognition** using MediaPipe & TensorFlow
- **Multiple Learning Stages**:
  - 🔤 Alphabets (A-Z)
  - 🔢 Numbers
  - 🔤 A-Z words
  - 🎨 Colors
  - 📅 Days of the Week
  - 💬 General Words
  - 📝 Sentences
- **Progress Tracking** with badges and achievements
- **WebSocket Support** for low-latency predictions
- **Gamified Learning** - beautiful and kid-friendly UI
- **Firebase Integration** for user authentication and progress storage

---

##  Prerequisites

- **Python** 3.8+
- **Node.js** 16+
- **Webcam** access
- **Firebase** account (for authentication)



## 🛠️ Installation

### Backend Setup

```bash
cd backend
python -m venv venv

# Windows
venv\Scripts\activate

# Linux/Mac
source venv/bin/activate

pip install -r requirements.txt
```

### Frontend Setup

```bash
cd frontend
npm install
```



##  Configuration

### 1. Firebase Setup

Create a Firebase project and add your credentials:

**Backend:** Create `backend/serviceAccountKey.json` with your Firebase Admin SDK credentials

**Frontend:** Create `frontend/.env` with:
```
VITE_FIREBASE_API_KEY=your_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_auth_domain
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_storage_bucket
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id
```

> **Note:** Use `.env.example` as a template for your `.env` file.



## Running the Application

### Start Backend

You need to run the appropriate recognition server based on the lesson:

```bash
cd backend

# For Alphabet Recognition (A-Z)
python recognize_a_z_words.py

# For Number Recognition
python recognize_numbers.py

# For Color Recognition
python recognize_colours.py

# For Days of the Week
python recognize_days.py

# For General Words (Stage 1)
python recognize_gen_1.py

# For General Words (Stage 2)
python recognize_gen_2.py

# For Sentence Recognition
python recognize_sentences.py

# Or run the main app (handles routing)
python app.py
```

Backend runs on `http://localhost:5000`

### Start Frontend

```bash
cd frontend
npm run dev
```

Frontend runs on `http://localhost:5173`



##  Project Structure

```
EduSign/
├── backend/
│   ├── app.py                      # Main Flask server
│   ├── auth_middleware.py          # Authentication middleware
│   ├── firebase_admin_config.py    # Firebase admin setup
│   ├── realtime_wrapper.py         # Model wrapper for predictions
│   ├── recognize_a_z_words.py      # Alphabet recognition server
│   ├── recognize_numbers.py        # Number recognition server
│   ├── recognize_colours.py        # Color recognition server
│   ├── recognize_days.py           # Days recognition server
│   ├── recognize_gen_1.py          # General words (stage 1) server
│   ├── recognize_gen_2.py          # General words (stage 2) server
│   ├── recognize_general_words.py  # General words recognition
│   ├── recognize_sentences.py      # Sentence recognition server
│   ├── userProgressSchema.py       # User progress schema
│   ├── requirements.txt            # Python dependencies
│   ├── simple_server.py            # Simple test server
│   └── models_*/                   # Model directories (see below)
│
├── frontend/
│   ├── src/
│   │   ├── components/             # React components
│   │   ├── pages/                  # Page components
│   │   ├── services/               # API and Firebase services
│   │   └── App.jsx                 # Main app component
│   ├── public/                     # Static assets
│   ├── package.json                # Node dependencies
│   └── vite.config.js              # Vite configuration
│
├── docs/
│   ├── EduSign-Final Report.pdf    # Complete project documentation
│   ├── architecture.jpeg           # System architecture diagram
│   └── flowchart.jpeg              # Application flowchart
│
└── README.md                       # This file
```



##  Models & Large Files

> [!IMPORTANT]
> Due to GitHub's 100 MB file size limit, the following files are **not included** in this repository:

### Excluded Files:
- **Trained ML Models** (`.h5`, `.keras` files) - ~200-300 MB total
- **TensorFlow SavedModel files** (`variables/`, `saved_model.pb`)
- **Large datasets** (`.npy`, `.csv` files)
- **Firebase credentials** (`serviceAccountKey.json`, `.env` files - for security)
- **node_modules/** (can be regenerated with `npm install`)

###  How to Obtain Missing Files:

1. **Trained Models:** 
   - Required models:
     - `models_a-z/isl_words_best_26_words.h5` 
     - `models_days/isl_days_best_*.h5` 
     - `model_colour/models/isl_words_best_12_words.h5` 
     - `model_words/model_words1/isl_words_best_24_words.h5` 
     - `model_words/model_words2/models/static_words_best_16_words.h5` 
     - `models_sentence/isl_sentences_best.h5` 
     - `models_sentence/isl_sentences_final/` (TensorFlow SavedModel folder)
     - `models_words/isl_words_best_24_words.h5` 
   
2. **Installation:** After downloading models from backend, docs, frontend (Repository):
   - Extract/place model files in their respective `backend/models_*/` directories
   - Ensure file paths match the structure shown in Google Drive README

3. **Firebase Credentials:** 
   - Create your own Firebase project (free tier available)
   - Download `serviceAccountKey.json` from Firebase Console
   - Follow setup instructions in [Configuration](#️-configuration) section

> [!NOTE]
> **For Examiners/Evaluators:** The absence of model files does not affect code evaluation. All source code, architecture, and documentation are included. Models can be shared separately if needed for testing.



## Testing the Application

1. **Download and place trained models** from backend, docs and frontend (Repo)
2. **Set up Firebase credentials** (`.env` for frontend, `serviceAccountKey.json` for backend)
3. **Install dependencies:**
   ```bash
   # Backend
   cd backend && pip install -r requirements.txt
   
   # Frontend
   cd frontend && npm install
   ```
4. **Start backend server** (choose appropriate recognition server)
5. **Start frontend server**
6. **Create a Firebase account** and login
7. **Grant webcam permission** when prompted
8. **Navigate to a lesson** (e.g., Alphabets)
9. **Make ISL signs** in front of your webcam
10. **Watch real-time predictions** and progress tracking



##  Academic Context

This project was developed as part of **MCA Final Year Project** at **[Chanakya University]**.

### Key Highlights:
- ✅ Real-time gesture recognition with **85%+ accuracy**
- ✅ Comprehensive documentation in `docs/`
- ✅ Production-ready architecture
- ✅ Scalable Firebase backend
- ✅ Responsive, accessible UI
- ✅ Self-collected dataset with 15+ volunteers

### Project Repository:
- **GitHub:** [https://github.com/ReaganMurgesh/EduSign-ISL-Learning-Platform](https://github.com/ReaganMurgesh/EduSign-ISL-Learning-Platform)
-  **GitHub:** [https://github.com/Swap6361/EduSign-ISL-Learning-Platform](https://github.com/Swap6361/EduSign-ISL-Learning-Platform)


##  Technologies Used

### Frontend:
- React 18 + Vite
- MediaPipe Hands (Browser)
- WebSocket Client
- Firebase Authentication
- CSS3 with Glassmorphism effects

### Backend:
- Flask 2.3 + Flask-CORS + Flask-SocketIO
- TensorFlow 2.12 / Keras
- MediaPipe 0.10
- WebSocket Server
- Firebase Admin SDK
- NumPy, OpenCV

### Machine Learning:
- DNN (Dense Neural Network) for static gestures
- LSTM (Long Short-Term Memory) for dynamic sequences
- MediaPipe Hand Landmark Detection (21 points × 3 coordinates)



##  License

This project is for academic purposes. Feel free to use for learning and reference.



##  Contributors

- **Reagan Murgesh** - Developer & Researcher
- **Swapna K** - Model Training & Evaluation & Researcher
- **[Guide Name]** - Mr. Ashith Sagar Naidu



##  Contact

For queries regarding **models, datasets, or demo**:
- 📧 Email: (reaganmurgesh@gmail.com)
- 📧 Email: (swapnak9900@gmail.com) 
- 🔗 GitHub: [@ReaganMurgesh](https://github.com/ReaganMurgesh)
- 🔗 GitHub: [@Swapna](https://github.com/Swap6361)
- 🔗 Repository: [EduSign-ISL-Learning-Platform](https://github.com/ReaganMurgesh/EduSign-ISL-Learning-Platform)
- 🔗 Repository: [EduSign-ISL-Learning-Platform](https://github.com/Swap6361/EduSign-ISL-Learning-Platform)


##  Acknowledgments

- Indian Sign Language Research and Training Centre (ISLRTC)
- MediaPipe Team by Google
- Firebase Team
- TensorFlow Team
- All volunteers who contributed to dataset collection



##  Important Notes for Setup

1. **DO NOT** commit `.env` files or Firebase credentials (`serviceAccountKey.json`)
2. **DO** download trained models from Google Drive before running
3. **Webcam is mandatory** - app won't work without it
4. **Chrome/Edge recommended** for best MediaPipe performance
5. **Each lesson requires its specific recognition server** to be running



##  Troubleshooting

### "Module not found" errors
→ Run `pip install -r requirements.txt` in backend folder

### "Model file not found"
→ Download models from Google Drive and place in correct directories

### "Firebase auth failed"
→ Check `.env` file has correct Firebase credentials

### Webcam not detected
→ Grant camera permissions in browser settings

### Low prediction accuracy
→ Ensure good lighting and plain background



** If this project helps you, please star the repository!**



##  Project Statistics

- **Lines of Code:** ~10,000+
- **Models Trained:** 7 different gesture recognition models
- **Dataset Size:** 15,000+ images, 5,000+ sequences
- **Gestures Supported:** 100+ ISL signs
- **Development Time:** 4 months
- **Team Size:** 1 developer + project guide



**Made with ❤️ for accessible ISL education**
