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
      showToast('Error loading dashboard data', 'error');
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

  createItemCard(item) {
    let statusColor = 'bg-gray-100 text-gray-800';
    if (item.status === 'available') {
      statusColor = 'bg-green-100 text-green-800';
    } else if (item.status === 'exchanged') {
      statusColor = 'bg-blue-100 text-blue-800';
    } else if (item.status === 'redeemed') {
      statusColor = 'bg-purple-100 text-purple-800';
    }

    return `
      <div class="flex items-center space-x-4 p-4 border border-gray-200 rounded-lg hover:shadow-md transition">
        <img src="${item.images?.[0] || '/api/placeholder/80/80'}" 
             alt="${item.title}" 
             class="w-16 h-16 object-cover rounded-lg">
        <div class="flex-1">
          <h3 class="font-medium text-gray-900">${item.title}</h3>
          <p class="text-sm text-gray-600">${item.category} • Size ${item.size}</p>
          <div class="flex items-center space-x-2 mt-1">
            <span class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${statusColor}">
              ${item.status.charAt(0).toUpperCase() + item.status.slice(1)}
            </span>
            <span class="text-xs text-gray-500">${formatDate(item.createdAt)}</span>
          </div>
        </div>
        <div class="text-right">
          <p class="text-sm font-medium text-emerald-600">${item.pointsValue || 0} points</p>
          <p class="text-xs text-gray-500">${item.views || 0} views</p>
        </div>
        <div class="flex flex-col space-y-1">
          <a href="item.html?id=${item.id}" 
             class="inline-flex items-center px-3 py-1 text-xs bg-emerald-600 text-white rounded hover:bg-emerald-700 transition">
            View
          </a>
          ${item.status === 'available' ? `
            <button onclick="dashboard.editItem('${item.id}')" 
                    class="inline-flex items-center px-3 py-1 text-xs bg-gray-600 text-white rounded hover:bg-gray-700 transition">
              Edit
            </button>
          ` : ''}
        </div>
      </div>
    `;
  }

  async loadSwapRequests() {
    try {
      const requests = await getSwapRequests(this.currentUser.uid);
      this.swapRequests = requests.filter(req => req.status === 'pending');
      this.renderSwapRequests();
    } catch (error) {
      showToast('Error loading swap requests', 'error');
    }
  }

  renderSwapRequests() {
    const container = document.getElementById('swapRequestsContainer');
    const loading = document.getElementById('swapRequestsLoading');
    const noRequestsMsg = document.getElementById('noRequestsMessage');

    if (loading) {
      loading.classList.add('hidden');
    }

    if (this.swapRequests.length === 0) {
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
      container.innerHTML = this.swapRequests.map(request => this.createRequestCard(request)).join('');
    }
  }

  createRequestCard(request) {
    return `
      <div class="p-4 border border-gray-200 rounded-lg">
        <div class="flex items-center space-x-3 mb-3">
          <img src="${request.requesterAvatar || '/api/placeholder/32/32'}" 
               alt="${request.requesterName}" 
               class="w-8 h-8 rounded-full">
          <div>
            <p class="font-medium text-gray-900">${request.requesterName}</p>
            <p class="text-xs text-gray-500">${formatDate(request.createdAt)}</p>
          </div>
        </div>
        <p class="text-sm text-gray-600 mb-3">Wants to swap for: <strong>${request.itemTitle}</strong></p>
        ${request.message ? `<p class="text-xs text-gray-500 mb-3">"${request.message}"</p>` : ''}
        <div class="flex space-x-2">
          <button onclick="dashboard.handleSwapRequest('${request.id}', 'accept')" 
                  class="flex-1 px-3 py-1 text-xs bg-emerald-600 text-white rounded hover:bg-emerald-700 transition">
            Accept
          </button>
          <button onclick="dashboard.handleSwapRequest('${request.id}', 'decline')" 
                  class="flex-1 px-3 py-1 text-xs bg-gray-600 text-white rounded hover:bg-gray-700 transition">
            Decline
          </button>
          <button onclick="dashboard.viewSwapDetails('${request.id}')" 
                  class="px-3 py-1 text-xs border border-gray-300 text-gray-700 rounded hover:bg-gray-50 transition">
            Details
          </button>
        </div>
      </div>
    `;
  }

  async handleSwapRequest(requestId, action) {
    try {
      await updateSwapRequest(requestId, { 
        status: action === 'accept' ? 'accepted' : 'declined',
        respondedAt: new Date()
      });
      
      showToast(`Request ${action}ed successfully`, 'success');
      await this.loadSwapRequests();
    } catch (error) {
      showToast('Error processing request', 'error');
    }
  }

  viewSwapDetails(requestId) {
    const request = this.swapRequests.find(r => r.id === requestId);
    if (!request) {
      return;
    }

    const modal = document.getElementById('swapRequestModal');
    const content = document.getElementById('modalContent');
    
    content.innerHTML = `
      <div class="space-y-4">
        <div class="flex items-center space-x-3">
          <img src="${request.requesterAvatar || '/api/placeholder/48/48'}" 
               alt="${request.requesterName}" 
               class="w-12 h-12 rounded-full">
          <div>
            <h4 class="font-medium">${request.requesterName}</h4>
            <p class="text-sm text-gray-600">${request.requesterEmail}</p>
          </div>
        </div>
        
        <div>
          <h5 class="font-medium mb-2">Wants to exchange:</h5>
          <div class="flex space-x-3">
            <img src="${request.offeredItemImage || '/api/placeholder/64/64'}" 
                 alt="${request.offeredItemTitle}" 
                 class="w-16 h-16 object-cover rounded">
            <div>
              <p class="font-medium">${request.offeredItemTitle}</p>
              <p class="text-sm text-gray-600">${request.offeredItemCategory}</p>
            </div>
          </div>
        </div>
        
        <div>
          <h5 class="font-medium mb-2">For your item:</h5>
          <div class="flex space-x-3">
            <img src="${request.requestedItemImage || '/api/placeholder/64/64'}" 
                 alt="${request.itemTitle}" 
                 class="w-16 h-16 object-cover rounded">
            <div>
              <p class="font-medium">${request.itemTitle}</p>
              <p class="text-sm text-gray-600">${request.requestedItemCategory}</p>
            </div>
          </div>
        </div>
        
        ${request.message ? `
          <div>
            <h5 class="font-medium mb-2">Message:</h5>
            <p class="text-sm text-gray-600 p-3 bg-gray-50 rounded">${request.message}</p>
          </div>
        ` : ''}
        
        <div class="flex space-x-3 pt-4">
          <button onclick="dashboard.handleSwapRequest('${request.id}', 'accept')" 
                  class="flex-1 px-4 py-2 bg-emerald-600 text-white rounded hover:bg-emerald-700 transition">
            Accept Swap
          </button>
          <button onclick="dashboard.handleSwapRequest('${request.id}', 'decline')" 
                  class="flex-1 px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 transition">
            Decline
          </button>
        </div>
      </div>
    `;
    
    modal.classList.remove('hidden');
  }

  async loadLeaderboard() {
    try {
      const leaderboardData = await getLeaderboard();
      this.leaderboard = leaderboardData;
      this.renderLeaderboard();
    } catch (error) {
      showToast('Error loading leaderboard', 'error');
    }
  }

  renderLeaderboard() {
    const container = document.getElementById('leaderboardContainer');
    const loading = document.getElementById('leaderboardLoading');
    
    if (loading) {
      loading.classList.add('hidden');
    }
    
    if (this.leaderboard.length === 0) {
      if (container) {
        container.innerHTML = '<p class="text-sm text-gray-500 text-center py-4">No data available</p>';
      }
      return;
    }
    
    if (container) {
      container.innerHTML = this.leaderboard.map((user, index) => {
        const isCurrentUser = this.currentUser && user.id === this.currentUser.uid;
        const rankIcon = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : '';
        
        return `
          <div class="flex items-center space-x-3 ${isCurrentUser ? 'bg-emerald-50 p-2 rounded' : ''}">
            <span class="text-sm font-medium w-6">${rankIcon || (index + 1)}</span>
            <img src="${user.avatar || '/api/placeholder/32/32'}" 
                 alt="${user.name}" 
                 class="w-8 h-8 rounded-full">
            <div class="flex-1">
              <p class="text-sm font-medium ${isCurrentUser ? 'text-emerald-700' : 'text-gray-900'}">
                ${user.name} ${isCurrentUser ? '(You)' : ''}
              </p>
              <p class="text-xs text-gray-500">${user.totalPoints} points</p>
            </div>
          </div>
        `;
      }).join('');
    }
  }

  editItem(itemId) {
    // Redirect to upload page with edit mode
    window.location.href = `upload.html?edit=${itemId}`;
  }
}

// Initialize dashboard when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  window.dashboard = new Dashboard();
});

export default Dashboard;
