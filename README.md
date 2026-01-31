# EduSign+ - ISL Learning Platform

An intelligent, gamified platform for learning Indian Sign Language (ISL) with real-time gesture recognition.

## 🚀 Features

- **Real-time Hand Recognition** using MediaPipe & CNN
- **Beginner Stage**: Learn A-Z alphabets
- **Progress Tracking** with badges and achievements
- **WebSocket Support** for low-latency predictions
- **Lingvano-inspired UI** - beautiful and kid-friendly

## 📋 Prerequisites

- Python 3.8+
- Node.js 16+
- Webcam access
- Trained ISL model (`edusign_cnn_model.h5`)

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

## 🎯 Running the Application

### Start Backend

```bash
cd backend
python app.py
```

Backend runs on `http://localhost:5000`

### Start Frontend

```bash
cd frontend
npm run dev
```

Frontend runs on `http://localhost:3000`

## 📂 Project Structure

```
edusign-plus/
├── backend/
│   ├── app.py                 # Flask server with WebSocket
│   ├── realtime_wrapper.py    # Model wrapper
│   ├── requirements.txt
│   └── models/
│       ├── edusign_cnn_model.h5
│       └# EduSign+ - ISL Learning Platform

An intelligent, gamified platform for learning Indian Sign Language (ISL) with real-time gesture recognition.

## 🚀 Features

- **Real-time Hand Recognition** using MediaPipe & CNN
- **Beginner Stage**: Learn A-Z alphabets
- **Progress Tracking** with badges and achievements
- **WebSocket Support** for low-latency predictions
- **Lingvano-inspired UI** - beautiful and kid-friendly

## 📋 Prerequisites

- Python 3.8+
- Node.js 16+
- Webcam access
- Trained ISL model (`edusign_cnn_model.h5`)

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

## 🎯 Running the Application

### Start Backend

```bash
cd backend
python app.py
```

Backend runs on `http://localhost:5000`

### Start Frontend

```bash
cd frontend
npm run dev
```

Frontend runs on `http://localhost:3000`

## 📂 Project Structure

```
edusign-plus/
├── backend/
│   ├── app.py                 # Flask server with WebSocket
│   ├── realtime_wrapper.py    # Model wrapper
│   ├── requirements.txt
│   └── models/
│       ├── edusign_cnn_model.h5
│       └