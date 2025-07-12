// Authentication Management
import { auth, db } from './firebase-config.js';
import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged,
  updateProfile,
  GoogleAuthProvider,
  signInWithPopup
} from 'firebase/auth';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { showToast, showSpinner, hideSpinner } from './utils/validators.js';

class AuthManager {
  constructor() {
    this.currentUser = null;
    this.authStateChangedCallbacks = [];
    this.init();
  }

  init() {
    // Listen for auth state changes
    onAuthStateChanged(auth, (user) => {
      this.currentUser = user;
      this.authStateChangedCallbacks.forEach(callback => callback(user));
      this.updateUIForAuthState(user);
    });
  }

  // Register callback for auth state changes
  onAuthStateChanged(callback) {
    this.authStateChangedCallbacks.push(callback);
  }

  // Sign up with email and password
  async signUp(email, password, displayName) {
    try {
      showSpinner();
      
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      // Update profile with display name
      await updateProfile(user, { displayName });

      // Create user document in Firestore
      await this.createUserDocument(user, { displayName });

      showToast('Account created successfully!', 'success');
      return user;
    } catch (error) {
      console.error('Sign up error:', error);
      showToast(this.getErrorMessage(error.code), 'error');
      throw error;
    } finally {
      hideSpinner();
    }
  }

  // Sign in with email and password
  async signIn(email, password) {
    try {
      showSpinner();
      
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      showToast(`Welcome back, ${user.displayName || 'User'}!`, 'success');
      return user;
    } catch (error) {
      console.error('Sign in error:', error);
      showToast(this.getErrorMessage(error.code), 'error');
      throw error;
    } finally {
      hideSpinner();
    }
  }

  // Sign in with Google
  async signInWithGoogle() {
    try {
      showSpinner();
      
      const provider = new GoogleAuthProvider();
      const userCredential = await signInWithPopup(auth, provider);
      const user = userCredential.user;

      // Create or update user document
      await this.createUserDocument(user);

      showToast(`Welcome, ${user.displayName}!`, 'success');
      return user;
    } catch (error) {
      console.error('Google sign in error:', error);
      showToast(this.getErrorMessage(error.code), 'error');
      throw error;
    } finally {
      hideSpinner();
    }
  }

  // Sign out
  async logout() {
    try {
      await signOut(auth);
      showToast('Signed out successfully', 'success');
      window.location.href = 'index.html';
    } catch (error) {
      console.error('Sign out error:', error);
      showToast('Error signing out', 'error');
    }
  }

  // Create user document in Firestore
  async createUserDocument(user, additionalData = {}) {
    const userRef = doc(db, 'users', user.uid);
    const userDoc = await getDoc(userRef);

    if (!userDoc.exists()) {
      const userData = {
        uid: user.uid,
        email: user.email,
        displayName: user.displayName || additionalData.displayName || 'Anonymous',
        avatarURL: user.photoURL || '',
        points: 100, // Starting points
        role: 'user',
        createdAt: new Date(),
        lastActive: new Date(),
        ...additionalData
      };

      await setDoc(userRef, userData);
    } else {
      // Update last active
      await setDoc(userRef, { lastActive: new Date() }, { merge: true });
    }
  }

  // Update UI based on auth state
  updateUIForAuthState(user) {
    const authButtons = document.querySelectorAll('.auth-button');
    const userButtons = document.querySelectorAll('.user-button');
    const protectedElements = document.querySelectorAll('.protected');

    if (user) {
      // User is signed in
      authButtons.forEach(btn => btn.style.display = 'none');
      userButtons.forEach(btn => btn.style.display = 'block');
      protectedElements.forEach(el => el.style.display = 'block');

      // Update user info displays
      const userNameElements = document.querySelectorAll('.user-name');
      const userAvatarElements = document.querySelectorAll('.user-avatar');

      userNameElements.forEach(el => {
        el.textContent = user.displayName || 'User';
      });

      userAvatarElements.forEach(el => {
        if (user.photoURL) {
          el.src = user.photoURL;
        } else {
          el.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(user.displayName || 'User')}&background=22c55e&color=fff`;
        }
      });
    } else {
      // User is signed out
      authButtons.forEach(btn => btn.style.display = 'block');
      userButtons.forEach(btn => btn.style.display = 'none');
      protectedElements.forEach(el => el.style.display = 'none');
    }
  }

  // Get user-friendly error messages
  getErrorMessage(errorCode) {
    const errorMessages = {
      'auth/user-not-found': 'No account found with this email address.',
      'auth/wrong-password': 'Incorrect password. Please try again.',
      'auth/email-already-in-use': 'An account already exists with this email address.',
      'auth/weak-password': 'Password should be at least 6 characters long.',
      'auth/invalid-email': 'Please enter a valid email address.',
      'auth/user-disabled': 'This account has been disabled.',
      'auth/too-many-requests': 'Too many failed attempts. Please try again later.',
      'auth/network-request-failed': 'Network error. Please check your connection.',
      'auth/popup-closed-by-user': 'Sign-in was cancelled.',
      'auth/cancelled-popup-request': 'Sign-in was cancelled.'
    };

    return errorMessages[errorCode] || 'An error occurred. Please try again.';
  }

  // Check if user is authenticated
  isAuthenticated() {
    return !!this.currentUser;
  }

  // Get current user
  getCurrentUser() {
    return this.currentUser;
  }

  // Require authentication for page access
  requireAuth() {
    if (!this.isAuthenticated()) {
      showToast('Please sign in to access this page', 'warning');
      window.location.href = 'login.html';
      return false;
    }
    return true;
  }
}

// Create global auth manager instance
const authManager = new AuthManager();

// Export for use in other modules
export default authManager;

// Global functions for HTML onclick handlers
window.authManager = authManager;
window.signOut = () => authManager.logout();
