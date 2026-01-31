import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Health check
export const checkHealth = async () => {
  try {
    const response = await api.get('/health');
    return response.data;
  } catch (error) {
    console.error('Health check failed:', error);
    throw error;
  }
};

// Get model info
export const getModelInfo = async () => {
  try {
    const response = await api.get('/model-info');
    return response.data;
  } catch (error) {
    console.error('Failed to get model info:', error);
    throw error;
  }
};

// Predict from frame (REST)
export const predictFrame = async (imageData) => {
  try {
    const response = await api.post('/predict', { image: imageData });
    return response.data;
  } catch (error) {
    console.error('Prediction failed:', error);
    return {
      success: false,
      label: null,
      confidence: 0,
      error: error.message
    };
  }
};

// Predict from landmarks
export const predictLandmarks = async (landmarks) => {
  try {
    const response = await api.post('/predict', { landmarks });
    return response.data;
  } catch (error) {
    console.error('Landmark prediction failed:', error);
    return {
      success: false,
      label: null,
      confidence: 0,
      error: error.message
    };
  }
};

export default api;