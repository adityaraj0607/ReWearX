// Simple admin functionality placeholder
import { auth, onAuthStateChanged, signOut } from './firebase-config.js';
import { showToast } from './utils/validators.js';

class AdminDashboard {
  constructor() {
    this.currentUser = null;
    this.isAdmin = false;
    
    this.init();
  }

  init() {
    this.setupAuthListener();
  }

  setupAuthListener() {
    onAuthStateChanged(auth, (user) => {
      if (user) {
        this.currentUser = user;
        this.updateUserDisplay();
        this.checkAdminAccess();
      } else {
        window.location.href = 'login.html';
      }
    });
  }

  updateUserDisplay() {
    if (!this.currentUser) {
      return;
    }

    const userName = this.currentUser.displayName || this.currentUser.email?.split('@')[0] || 'User';
    const userNameElem = document.getElementById('userName');
    if (userNameElem) {
      userNameElem.textContent = userName;
    }
  }

  checkAdminAccess() {
    // Simple admin check - in a real app, this would check Firestore permissions
    const adminEmails = ['admin@rewearx.com', 'support@rewearx.com'];
    this.isAdmin = adminEmails.includes(this.currentUser.email);
    
    if (!this.isAdmin) {
      this.showAccessDenied();
    } else {
      this.showAdminPanel();
    }
  }

  showAccessDenied() {
    const content = document.getElementById('adminContent');
    if (content) {
      content.innerHTML = `
        <div class="text-center py-12">
          <div class="text-6xl mb-4">🚫</div>
          <h2 class="text-2xl font-bold text-gray-900 mb-2">Access Denied</h2>
          <p class="text-gray-600 mb-6">You don't have permission to access the admin panel.</p>
          <a href="index.html" class="bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded-lg transition-colors duration-200">
            Go to Home
          </a>
        </div>
      `;
    }
  }

  showAdminPanel() {
    const content = document.getElementById('adminContent');
    if (content) {
      content.innerHTML = `
        <div class="text-center py-12">
          <div class="text-6xl mb-4">👑</div>
          <h2 class="text-2xl font-bold text-gray-900 mb-2">Admin Panel</h2>
          <p class="text-gray-600 mb-6">Admin functionality is under development.</p>
          <div class="space-y-4">
            <div class="bg-white p-6 rounded-lg shadow">
              <h3 class="font-semibold mb-2">Quick Stats</h3>
              <p class="text-gray-600">Total Users: Loading...</p>
              <p class="text-gray-600">Total Items: Loading...</p>
              <p class="text-gray-600">Pending Reviews: Loading...</p>
            </div>
          </div>
        </div>
      `;
    }
    
    showToast('Welcome to the admin panel!', 'success');
  }
}

// Initialize admin dashboard when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  window.adminDashboard = new AdminDashboard();
});

export default AdminDashboard;
