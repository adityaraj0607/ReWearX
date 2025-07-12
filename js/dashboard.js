import { auth, onAuthStateChanged, signOut } from './firebase-config.js';
import { 
  getSwapRequests, 
  updateSwapRequest, 
  getLeaderboard,
  getUserStats,
  realTimeListener 
} from './utils/firestore-ops.js';
import { showToast, formatDate } from './utils/validators.js';
import { getCachedData, setCachedData } from './utils/cache.js';

class Dashboard {
  constructor() {
    this.currentUser = null;
    this.userStats = null;
    this.userItems = [];
    this.swapRequests = [];
    this.leaderboard = [];
    this.currentFilter = 'all';
    
    this.init();
  }

  init() {
    this.setupAuthListener();
    this.setupEventListeners();
    this.loadInitialData();
  }

  setupAuthListener() {
    onAuthStateChanged(auth, (user) => {
      if (user) {
        this.currentUser = user;
        this.updateUserDisplay();
        this.loadUserData();
      } else {
        window.location.href = 'login.html';
      }
    });
  }

  setupEventListeners() {
    // Profile dropdown
    document.getElementById('profileDropdown')?.addEventListener('click', () => {
      const dropdown = document.getElementById('dropdownMenu');
      dropdown.classList.toggle('hidden');
    });

    // Logout
    document.getElementById('logoutBtn')?.addEventListener('click', async (e) => {
      e.preventDefault();
      try {
        await signOut(auth);
        showToast('Logged out successfully', 'success');
        window.location.href = 'index.html';
      } catch (error) {
        showToast('Error logging out: ' + error.message, 'error');
      }
    });

    // Filter buttons
    document.getElementById('filterAll')?.addEventListener('click', () => this.setFilter('all'));
    document.getElementById('filterAvailable')?.addEventListener('click', () => this.setFilter('available'));
    document.getElementById('filterExchanged')?.addEventListener('click', () => this.setFilter('exchanged'));

    // Modal close
    document.getElementById('closeModal')?.addEventListener('click', () => {
      document.getElementById('swapRequestModal').classList.add('hidden');
    });

    // Click outside modal to close
    document.getElementById('swapRequestModal')?.addEventListener('click', (e) => {
      if (e.target.id === 'swapRequestModal') {
        document.getElementById('swapRequestModal').classList.add('hidden');
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
    const welcomeUserNameElem = document.getElementById('welcomeUserName');
    if (welcomeUserNameElem) {
      welcomeUserNameElem.textContent = userName;
    }

    // Update avatar
    const avatar = document.getElementById('userAvatar');
    if (avatar) {
      if (this.currentUser.photoURL) {
        avatar.innerHTML = `<img src="${this.currentUser.photoURL}" alt="Profile" class="w-8 h-8 rounded-full">`;
      } else {
        avatar.innerHTML = `<div class="w-8 h-8 bg-emerald-100 rounded-full flex items-center justify-center">
          <span class="text-emerald-600 font-medium text-sm">${userName.charAt(0).toUpperCase()}</span>
        </div>`;
      }
    }
  }

  async loadInitialData() {
    // Try to load cached data first
    const cachedStats = getCachedData('userStats');
    if (cachedStats) {
      this.updateStatsDisplay(cachedStats);
    }

    const cachedItems = getCachedData('userItems');
    if (cachedItems) {
      this.userItems = cachedItems;
      this.renderItems();
    }
  }

  async loadUserData() {
    if (!this.currentUser) {
      return;
    }

    try {
      // Load user stats
      const stats = await getUserStats(this.currentUser.uid);
      this.userStats = stats;
      this.updateStatsDisplay(stats);
      setCachedData('userStats', stats);

      // Load user items with real-time updates
      this.setupRealTimeListeners();

      // Load swap requests
      await this.loadSwapRequests();

      // Load leaderboard
      await this.loadLeaderboard();

    } catch (error) {
      showToast('Error loading dashboard data. Please try again.', 'error');
    }
  }

  setupRealTimeListeners() {
    // Real-time items listener
    const itemsUnsubscribe = realTimeListener(
      'items',
      { field: 'uploadedBy', operator: '==', value: this.currentUser.uid },
      (items) => {
        this.userItems = items;
        this.renderItems();
        setCachedData('userItems', items);
      },
      () => {
        showToast('Error loading items', 'error');
      }
    );

    // Real-time swap requests listener
    const requestsUnsubscribe = realTimeListener(
      'swapRequests',
      { field: 'receiverId', operator: '==', value: this.currentUser.uid },
      (requests) => {
        this.swapRequests = requests.filter(req => req.status === 'pending');
        this.renderSwapRequests();
      },
      () => {
        showToast('Error loading swap requests', 'error');
      }
    );

    // Store unsubscribe functions for cleanup
    window.addEventListener('beforeunload', () => {
      itemsUnsubscribe();
      requestsUnsubscribe();
    });
  }

  renderItems() {
    const container = document.getElementById('itemsContainer');
    const loading = document.getElementById('itemsLoading');
    const noItemsMsg = document.getElementById('noItemsMessage');
    
    if (loading) {
      loading.classList.add('hidden');
    }
    
    if (!this.userItems || this.userItems.length === 0) {
      if (container) {
        container.innerHTML = '';
      }
      if (noItemsMsg) {
        noItemsMsg.classList.remove('hidden');
      }
      return;
    }
    
    if (noItemsMsg) {
      noItemsMsg.classList.add('hidden');
    }
    
    // Filter items
    let filteredItems = this.userItems;
    if (this.currentFilter === 'available') {
      filteredItems = this.userItems.filter(item => item.status === 'available');
    } else if (this.currentFilter === 'exchanged') {
      filteredItems = this.userItems.filter(item => item.status === 'exchanged' || item.status === 'redeemed');
    }
    
    if (container) {
      container.innerHTML = filteredItems.map(item => this.createItemCard(item)).join('');
    }
  }

  updateStatsDisplay(stats) {
    if (!stats) {
      return;
    }

    const elements = {
      totalItems: document.getElementById('totalItems'),
      totalPoints: document.getElementById('totalPoints'),
      successfulSwaps: document.getElementById('successfulSwaps'),
      memberSince: document.getElementById('memberSince')
    };

    if (elements.totalItems) {
      elements.totalItems.textContent = stats.totalItems || 0;
    }
    if (elements.totalPoints) {
      elements.totalPoints.textContent = stats.totalPoints || 0;
    }
    if (elements.successfulSwaps) {
      elements.successfulSwaps.textContent = stats.successfulSwaps || 0;
    }
    if (elements.memberSince) {
      elements.memberSince.textContent = stats.memberSince ? formatDate(stats.memberSince) : 'Recently';
    }
  }

  setFilter(filter) {
    this.currentFilter = filter;
    
    // Update button styles
    document.querySelectorAll('[id^="filter"]').forEach(btn => {
      btn.className = 'px-3 py-1 text-sm text-gray-600 hover:bg-gray-100 rounded-full';
    });

    const activeBtn = document.getElementById(`filter${filter.charAt(0).toUpperCase() + filter.slice(1)}`);
    if (activeBtn) {
      activeBtn.className = 'px-3 py-1 text-sm bg-emerald-100 text-emerald-700 rounded-full';
    }

    this.renderItems();
  }

  async loadSwapRequests() {
    try {
      this.swapRequests = await getSwapRequests(this.currentUser.uid);
      this.renderSwapRequests();
    } catch (error) {
      throw error;
    }
  }

  renderSwapRequests() {
    const container = document.getElementById('swapRequestsContainer');
    const loading = document.getElementById('loadingRequests');
    const noRequestsMsg = document.getElementById('noRequestsMessage');
    
    if (loading) {
      loading.classList.add('hidden');
    }
    
    if (!this.swapRequests || this.swapRequests.length === 0) {
      if (container) {
        container.innerHTML = '';
      }
      if (noRequestsMsg) {
        noRequestsMsg.classList.remove('hidden');
      }
      return;
    }
    
    if (noRequestsMsg) {
      noRequestsMsg.classList.add('hidden');
    }
    
    if (container) {
      container.innerHTML = this.swapRequests.map(request => this.createSwapRequestCard(request)).join('');
      
      // Add event listeners to accept/reject buttons
      this.swapRequests.forEach(request => {
        const acceptBtn = document.getElementById(`accept-${request.id}`);
        const rejectBtn = document.getElementById(`reject-${request.id}`);
        
        if (acceptBtn) {
          acceptBtn.addEventListener('click', () => this.handleSwapResponse(request.id, 'accepted'));
        }
        
        if (rejectBtn) {
          rejectBtn.addEventListener('click', () => this.handleSwapResponse(request.id, 'rejected'));
        }
      });
    }
  }

  createSwapRequestCard(request) {
    return `
      <div class="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition">
        <div class="flex items-center mb-2">
          <div class="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center mr-3">
            <i data-feather="refresh-cw" class="w-5 h-5 text-blue-600"></i>
          </div>
          <div>
            <h4 class="font-medium text-gray-900">Swap Request</h4>
            <p class="text-sm text-gray-500">${formatDate(request.createdAt)}</p>
          </div>
        </div>
        <p class="text-sm text-gray-700 mb-3">${request.message || 'I would like to swap with you.'}</p>
        <div class="flex space-x-2">
          <button id="accept-${request.id}" class="px-3 py-1 text-sm bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition">
            Accept
          </button>
          <button id="reject-${request.id}" class="px-3 py-1 text-sm bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition">
            Decline
          </button>
          <button data-id="${request.id}" class="view-request-btn px-3 py-1 text-sm bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition ml-auto">
            View
          </button>
        </div>
      </div>
    `;
  }

  renderLeaderboard() {
    const container = document.getElementById('leaderboardContainer');
    const loading = document.getElementById('loadingLeaderboard');
    
    if (loading) {
      loading.classList.add('hidden');
    }
    
    if (!this.leaderboard || this.leaderboard.length === 0) {
      if (container) {
        container.innerHTML = `
          <div class="text-center py-4">
            <i data-feather="award" class="w-8 h-8 text-gray-400 mx-auto mb-2"></i>
            <p class="text-sm text-gray-500">No leaderboard data available</p>
          </div>
        `;
      }
      return;
    }
    
    if (container) {
      container.innerHTML = this.leaderboard.map((user, index) => this.createLeaderboardItem(user, index)).join('');
      feather.replace();
    }
  }

  createLeaderboardItem(user, index) {
    let badge = '';
    if (index === 0) {
      badge = '<div class="w-6 h-6 bg-yellow-100 rounded-full flex items-center justify-center"><i data-feather="award" class="w-4 h-4 text-yellow-600"></i></div>';
    } else if (index === 1) {
      badge = '<div class="w-6 h-6 bg-gray-200 rounded-full flex items-center justify-center"><i data-feather="award" class="w-4 h-4 text-gray-600"></i></div>';
    } else if (index === 2) {
      badge = '<div class="w-6 h-6 bg-orange-100 rounded-full flex items-center justify-center"><i data-feather="award" class="w-4 h-4 text-orange-600"></i></div>';
    }
    
    return `
      <div class="flex items-center justify-between">
        <div class="flex items-center">
          ${badge || `<div class="w-6 h-6 flex items-center justify-center text-sm font-medium text-gray-600">${index + 1}</div>`}
          <img src="${user.photoURL || 'https://ui-avatars.com/api/?name=' + encodeURIComponent(user.displayName || 'User')}" 
               alt="${user.displayName || 'User'}" 
               class="w-8 h-8 rounded-full mx-3">
          <span class="text-sm font-medium truncate" style="max-width: 120px;">${user.displayName || 'User'}</span>
        </div>
        <span class="text-sm font-bold text-emerald-600">${user.points || 0} pts</span>
      </div>
    `;
  }

  async handleSwapResponse(requestId, status) {
    try {
      await updateSwapRequest(requestId, status);
      
      // Update local state
      this.swapRequests = this.swapRequests.filter(req => req.id !== requestId);
      this.renderSwapRequests();
      
      // Show success message
      showToast(`Swap request ${status}`, 'success');
    } catch (error) {
      showToast('Error updating swap request', 'error');
    }
  }

  createItemCard(item) {
    const statusClass = {
      'available': 'bg-emerald-100 text-emerald-600',
      'pending': 'bg-yellow-100 text-yellow-600',
      'exchanged': 'bg-blue-100 text-blue-600',
      'redeemed': 'bg-purple-100 text-purple-600'
    };
    
    const statusText = {
      'available': 'Available',
      'pending': 'Pending Swap',
      'exchanged': 'Exchanged',
      'redeemed': 'Redeemed'
    };
    
    return `
      <div class="border border-gray-200 rounded-lg overflow-hidden group hover:shadow-md transition">
        <div class="h-40 overflow-hidden relative">
          <img src="${item.imageUrl || 'https://via.placeholder.com/300x300?text=No+Image'}" 
               alt="${item.title || 'Item'}" 
               class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300">
          <span class="absolute top-2 right-2 px-2 py-1 text-xs rounded-full ${statusClass[item.status] || 'bg-gray-100 text-gray-600'}">
            ${statusText[item.status] || 'Processing'}
          </span>
        </div>
        <div class="p-4">
          <h3 class="font-medium text-gray-900 mb-1 truncate">${item.title || 'Untitled Item'}</h3>
          <p class="text-sm text-gray-600 mb-2">${item.category ? item.category.charAt(0).toUpperCase() + item.category.slice(1) : ''} · ${item.size ? item.size.toUpperCase() : 'Size N/A'}</p>
          <div class="flex items-center justify-between">
            <span class="text-emerald-600 font-bold">${item.pointsValue || 0} points</span>
            <span class="text-xs text-gray-500">${formatDate(item.createdAt)}</span>
          </div>
        </div>
      </div>
    `;
  }
}

// Initialize dashboard when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  window.dashboard = new Dashboard();
});

export default Dashboard;
