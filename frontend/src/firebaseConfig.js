import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getAnalytics, isSupported } from 'firebase/analytics';

const firebaseConfig = {
  apiKey: "AIzaSyAlHkHGENU2AceXOjmnC31vyXP1TURgv4Y",
  authDomain: "edusignplus.firebaseapp.com",
  projectId: "edusignplus",
  storageBucket: "edusignplus.firebasestorage.app",
  messagingSenderId: "672741967138",
  appId: "1:672741967138:web:19f47f0d5635e054b2517b",
  measurementId: "G-C9QS5WC5B4"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

// Initialize Analytics (only in supported browsers)
isSupported().then((supported) => {
  if (supported) {
    getAnalytics(app);
  }
});

export default app;