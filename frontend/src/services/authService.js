import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updateProfile,
} from 'firebase/auth';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { auth, db } from '../firebaseConfig';

class AuthService {
  constructor() {
    this.currentUser = null;
  }

  // Sign up new user
  async signUp(email, password, displayName) {
    try {
      // Create user in Firebase Auth
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      // Update display name
      if (displayName) {
        await updateProfile(user, { displayName });
      }

      // Create user profile in Firestore
      await setDoc(doc(db, 'users', user.uid), {
        uid: user.uid,
        email: user.email,
        displayName: displayName || email.split('@')[0],
        level: 'Beginner',
        completedLetters: [],
        badges: ['🎉 Welcome Badge'],
        streak: 0,
        totalLessons: 0,
        createdAt: new Date().toISOString(),
        lastActive: new Date().toISOString()
      });

      console.log('✅ User signed up successfully:', user.uid);
      return { success: true, user: userCredential.user };
    } catch (error) {
      console.error('❌ Signup error:', error);
      return { success: false, error: this.getErrorMessage(error.code) };
    }
  }

  // Login user
  async login(email, password) {
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      console.log('✅ User logged in:', userCredential.user.uid);
      return { success: true, user: userCredential.user };
    } catch (error) {
      console.error('❌ Login error:', error);
      return { success: false, error: this.getErrorMessage(error.code) };
    }
  }

  // Logout
  async logout() {
    try {
      await signOut(auth);
      console.log('✅ User logged out');
      return { success: true };
    } catch (error) {
      console.error('❌ Logout error:', error);
      return { success: false, error: error.message };
    }
  }

  // Get current user token
  async getToken() {
    if (auth.currentUser) {
      return await auth.currentUser.getIdToken();
    }
    return null;
  }

  // Get current user
  getCurrentUser() {
    return auth.currentUser;
  }

  // Listen to auth state changes
  onAuthStateChange(callback) {
    return onAuthStateChanged(auth, callback);
  }

  // Get user profile from Firestore
  async getUserProfile(uid) {
    try {
      const docRef = doc(db, 'users', uid);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        return docSnap.data();
      }
      return null;
    } catch (error) {
      console.error('❌ Error getting profile:', error);
      return null;
    }
  }

  // User-friendly error messages
  getErrorMessage(errorCode) {
    const errorMessages = {
      'auth/email-already-in-use': 'This email is already registered! Try logging in instead 😊',
      'auth/invalid-email': 'Hmm, that email doesnt look right. Check for typos!',
      'auth/weak-password': 'Password should be at least 6 characters long 🔐',
      'auth/user-not-found': 'No account found with this email. Want to sign up?',
      'auth/wrong-password': 'Oops! Wrong password. Try again! 🤔',
      'auth/too-many-requests': 'Too many tries! Take a break and try again later ⏰',
      'auth/network-request-failed': 'Network error! Check your internet connection 📡',
      'auth/invalid-credential': 'Incorrect email or password. Please try again! 🔐',
    };
    return errorMessages[errorCode] || 'Something went wrong. Please try again!';
  }
}

export default new AuthService();