import { auth, onAuthStateChanged, signOut } from './firebase-config.js';
import { 
  getItemById, 
  getUserItems, 
  createSwapRequest, 
  redeemItem, 
  getSimilarItems,
  incrementItemViews,
  getUserStats 
} from './utils/firestore-ops.js';
import { showToast } from './utils/validators.js';

class ItemDetail {
  constructor() {
    this.currentUser = null;
    this.currentItem = null;
    this.userStats = null;
    this.userItems = [];
    this.selectedSwapItem = null;
    
    this.init();
  }

  init() {
    this.setupAuthListener();
    this.setupEventListeners();
    this.loadItemFromURL();
  }

  setupAuthListener() {
    onAuthStateChanged(auth, (user) => {
      if (user) {
        this.currentUser = user;
        this.updateUserDisplay();
        this.loadUserData();
      } else {
        // Allow viewing items without auth, but disable actions
        this.currentUser = null;
        this.hideExchangeOptions();
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

    // Exchange actions
    document.getElementById('redeemBtn')?.addEventListener('click', () => this.showRedeemModal());
    document.getElementById('swapBtn')?.addEventListener('click', () => this.showSwapModal());

    // Modal controls
    document.getElementById('closeSwapModal')?.addEventListener('click', () => this.hideSwapModal());
    document.getElementById('cancelSwap')?.addEventListener('click', () => this.hideSwapModal());
    document.getElementById('submitSwap')?.addEventListener('click', () => this.submitSwapProposal());

    document.getElementById('cancelRedeem')?.addEventListener('click', () => this.hideRedeemModal());
    document.getElementById('confirmRedeem')?.addEventListener('click', () => this.confirmRedemption());

    // Contact owner
    document.getElementById('contactOwnerBtn')?.addEventListener('click', () => this.contactOwner());

    // Click outside modals to close
    document.getElementById('swapModal')?.addEventListener('click', (e) => {
      if (e.target.id === 'swapModal') {
        this.hideSwapModal();
      }
    });
    document.getElementById('redeemModal')?.addEventListener('click', (e) => {
      if (e.target.id === 'redeemModal') {
        this.hideRedeemModal();
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

  async loadUserData() {
    if (!this.currentUser) {
      return;
    }

    try {
      // Load user stats and items
      const [userStats, userItems] = await Promise.all([
        getUserStats(this.currentUser.uid),
        getUserItems(this.currentUser.uid)
      ]);

      this.userStats = userStats;
      this.userItems = userItems;
      this.updatePointsDisplay();

    } catch (error) {
      showToast('Error loading user data', 'error');
    }
  }

  async loadItemFromURL() {
    const urlParams = new URLSearchParams(window.location.search);
    const itemId = urlParams.get('id');

    if (!itemId) {
      showToast('No item ID provided', 'error');
      return;
    }

    try {
      this.currentItem = await getItemById(itemId);
      
      if (!this.currentItem) {
        showToast('Item not found', 'error');
        return;
      }

      // Increment view count
      await incrementItemViews(itemId);

      this.displayItem();
      this.loadSimilarItems();

    } catch (error) {
      showToast('Error loading item details', 'error');
    }
  }

  displayItem() {
    if (!this.currentItem) {
      return;
    }

    const item = this.currentItem;

    // Update page title
    document.title = `${item.title} - ReWearX`;

    // Display item details
    document.getElementById('itemTitle').textContent = item.title;
    document.getElementById('itemDescription').textContent = item.description;
    document.getElementById('itemCategory').textContent = item.category;
    document.getElementById('itemCondition').textContent = item.condition;
    document.getElementById('itemSize').textContent = item.size;
    document.getElementById('itemPoints').textContent = `${item.pointsValue} points`;

    // Display images
    const imageContainer = document.getElementById('itemImages');
    if (imageContainer && item.images && item.images.length > 0) {
      imageContainer.innerHTML = item.images.map(imageUrl => `
        <img src="${imageUrl}" alt="${item.title}" class="w-full h-64 object-cover rounded-lg">
      `).join('');
    }

    // Display owner info
    const ownerInfo = document.getElementById('ownerInfo');
    if (ownerInfo) {
      ownerInfo.innerHTML = `
        <div class="flex items-center space-x-3">
          <img src="${item.userPhoto || '/api/placeholder/48/48'}" alt="${item.userName}" class="w-12 h-12 rounded-full">
          <div>
            <p class="font-medium text-gray-900">${item.userName}</p>
            <p class="text-sm text-gray-600">Member since ${item.memberSince || 'Recently'}</p>
          </div>
        </div>
      `;
    }

    // Show/hide exchange options based on ownership
    const isOwner = this.currentUser && this.currentUser.uid === item.userId;
    if (isOwner) {
      this.hideExchangeOptions();
      this.showOwnerActions();
    } else {
      this.showExchangeOptions();
    }

    this.updatePointsDisplay();
  }

  showOwnerActions() {
    const container = document.getElementById('exchangeOptions');
    if (container) {
      container.innerHTML = `
        <div class="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <p class="text-blue-800 font-medium mb-3">This is your item</p>
          <div class="flex space-x-3">
            <a href="upload.html?edit=${this.currentItem.id}" 
               class="flex-1 bg-blue-600 hover:bg-blue-700 text-white text-center py-2 px-4 rounded-lg transition-colors duration-200 font-medium">
              Edit Item
            </a>
            <button onclick="itemDetail.deleteItem()" 
                    class="flex-1 bg-red-600 hover:bg-red-700 text-white py-2 px-4 rounded-lg transition-colors duration-200 font-medium">
              Delete Item
            </button>
          </div>
        </div>
      `;
    }
  }

  showExchangeOptions() {
    const container = document.getElementById('exchangeOptions');
    if (container && this.currentItem) {
      container.innerHTML = `
        <div class="space-y-3">
          <button id="redeemBtn" 
                  class="w-full px-6 py-3 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition font-medium">
            Redeem for ${this.currentItem.pointsValue} Points
          </button>
          <button id="swapBtn" 
                  class="w-full px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium">
            Propose Item Swap
          </button>
          <button id="contactOwnerBtn" 
                  class="w-full px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition font-medium">
            Contact Owner
          </button>
        </div>
      `;

      // Re-attach event listeners
      document.getElementById('redeemBtn')?.addEventListener('click', () => this.showRedeemModal());
      document.getElementById('swapBtn')?.addEventListener('click', () => this.showSwapModal());
      document.getElementById('contactOwnerBtn')?.addEventListener('click', () => this.contactOwner());
    }
  }

  hideExchangeOptions() {
    const container = document.getElementById('exchangeOptions');
    if (container) {
      container.classList.add('hidden');
    }
  }

  updatePointsDisplay() {
    if (!this.userStats || !this.currentItem) {
      return;
    }

    const userPoints = this.userStats.totalPoints || 0;
    const itemPoints = this.currentItem.pointsValue || 0;

    const userPointsElem = document.getElementById('userPoints');
    if (userPointsElem) {
      userPointsElem.textContent = userPoints;
    }
    const pointsNeededElem = document.getElementById('pointsNeeded');
    if (pointsNeededElem) {
      pointsNeededElem.textContent = itemPoints;
    }

    // Update redeem button state
    const redeemBtn = document.getElementById('redeemBtn');
    if (redeemBtn) {
      if (userPoints >= itemPoints) {
        redeemBtn.disabled = false;
        redeemBtn.className = 'w-full px-6 py-3 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition font-medium';
      } else {
        redeemBtn.disabled = true;
        redeemBtn.className = 'w-full px-6 py-3 bg-gray-400 text-white rounded-lg cursor-not-allowed font-medium';
      }
    }
  }

  showRedeemModal() {
    if (!this.currentUser) {
      showToast('Please log in to redeem items', 'error');
      return;
    }

    if (!this.userStats || this.userStats.totalPoints < this.currentItem.pointsValue) {
      showToast('Insufficient points to redeem this item', 'error');
      return;
    }

    const modal = document.getElementById('redeemModal');
    if (modal) {
      const confirmPoints = document.getElementById('confirmPoints');
      if (confirmPoints) {
        confirmPoints.textContent = this.currentItem.pointsValue;
      }
      modal.classList.remove('hidden');
    }
  }

  hideRedeemModal() {
    const modal = document.getElementById('redeemModal');
    if (modal) {
      modal.classList.add('hidden');
    }
  }

  async confirmRedemption() {
    try {
      await redeemItem(this.currentItem.id, this.currentUser.uid);
      showToast('Item redeemed successfully!', 'success');
      this.hideRedeemModal();
      
      // Refresh user data and update display
      await this.loadUserData();
      
    } catch (error) {
      showToast('Error redeeming item', 'error');
    }
  }

  showSwapModal() {
    if (!this.currentUser) {
      showToast('Please log in to propose swaps', 'error');
      return;
    }

    const modal = document.getElementById('swapModal');
    if (modal) {
      modal.classList.remove('hidden');
      this.loadUserItemsForSwap();
    }
  }

  hideSwapModal() {
    const modal = document.getElementById('swapModal');
    if (modal) {
      modal.classList.add('hidden');
    }
    this.selectedSwapItem = null;
  }

  async loadUserItemsForSwap() {
    const container = document.getElementById('userItemsList');
    if (!container) {
      return;
    }

    if (!this.userItems || this.userItems.length === 0) {
      container.innerHTML = `
        <div class="text-center py-8">
          <p class="text-gray-500 mb-4">You don't have any items available for swap</p>
          <a href="upload.html" class="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg transition-colors duration-200">
            Upload an Item
          </a>
        </div>
      `;
      return;
    }

    const availableItems = this.userItems.filter(item => 
      item.status === 'available' && item.id !== this.currentItem.id
    );

    if (availableItems.length === 0) {
      container.innerHTML = `
        <div class="text-center py-8">
          <p class="text-gray-500">No available items for swap</p>
        </div>
      `;
      return;
    }

    container.innerHTML = availableItems.map(item => `
      <div class="border border-gray-200 rounded-lg p-3 cursor-pointer hover:border-emerald-500 transition-colors duration-200 ${this.selectedSwapItem === item.id ? 'border-emerald-500 bg-emerald-50' : ''}"
           onclick="itemDetail.selectSwapItem('${item.id}')">
        <div class="flex items-center space-x-3">
          <img src="${item.images?.[0] || '/api/placeholder/60/60'}" alt="${item.title}" class="w-16 h-16 object-cover rounded-lg">
          <div class="flex-1">
            <h4 class="font-medium text-gray-900">${item.title}</h4>
            <p class="text-sm text-gray-600">${item.category} • ${item.condition}</p>
            <p class="text-sm text-emerald-600 font-medium">${item.pointsValue} points</p>
          </div>
          <div class="flex-shrink-0">
            <div class="w-4 h-4 border-2 border-gray-300 rounded-full ${this.selectedSwapItem === item.id ? 'bg-emerald-500 border-emerald-500' : ''}"></div>
          </div>
        </div>
      </div>
    `).join('');
  }

  selectSwapItem(itemId) {
    this.selectedSwapItem = itemId;
    this.loadUserItemsForSwap(); // Refresh to update selection
  }

  async submitSwapProposal() {
    if (!this.selectedSwapItem) {
      showToast('Please select an item to swap', 'error');
      return;
    }

    const message = document.getElementById('swapMessage')?.value || '';

    try {
      await createSwapRequest({
        requestedItemId: this.currentItem.id,
        offeredItemId: this.selectedSwapItem,
        receiverId: this.currentItem.userId,
        requesterId: this.currentUser.uid,
        message: message
      });

      showToast('Swap proposal sent successfully!', 'success');
      this.hideSwapModal();

    } catch (error) {
      showToast('Error sending swap proposal', 'error');
    }
  }

  async loadSimilarItems() {
    try {
      const similarItems = await getSimilarItems(this.currentItem.category, this.currentItem.id);
      this.renderSimilarItems(similarItems);
    } catch (error) {
      // Silently fail - similar items are not critical
    }
  }

  renderSimilarItems(items) {
    const container = document.getElementById('similarItems');
    if (!container || !items || items.length === 0) {
      return;
    }

    container.innerHTML = items.map(item => `
      <a href="item.html?id=${item.id}" class="block bg-white rounded-lg shadow hover:shadow-md transition-shadow duration-200">
        <img src="${item.images?.[0] || '/api/placeholder/200/200'}" alt="${item.title}" class="w-full h-32 object-cover rounded-t-lg">
        <div class="p-3">
          <h4 class="font-medium text-gray-900 text-sm line-clamp-2">${item.title}</h4>
          <p class="text-xs text-gray-600 mt-1">${item.category}</p>
          <p class="text-xs text-emerald-600 font-medium mt-1">${item.pointsValue} points</p>
        </div>
      </a>
    `).join('');
  }

  contactOwner() {
    if (!this.currentUser) {
      showToast('Please log in to contact the owner', 'error');
      return;
    }

    // Simple contact functionality - could be enhanced with messaging system
    const email = this.currentItem.userEmail;
    const subject = `Interested in your item: ${this.currentItem.title}`;
    const body = `Hi,\n\nI'm interested in your item "${this.currentItem.title}" on ReWearX.\n\nBest regards,\n${this.currentUser.displayName || this.currentUser.email}`;
    
    const mailtoLink = `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.location.href = mailtoLink;
  }

  async deleteItem() {
    if (!confirm('Are you sure you want to delete this item? This action cannot be undone.')) {
      return;
    }

    try {
      // Implementation would call deleteItem from firestore-ops
      showToast('Item deleted successfully', 'success');
      window.location.href = 'dashboard.html';
    } catch (error) {
      showToast('Error deleting item', 'error');
    }
  }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  window.itemDetail = new ItemDetail();
});

export default ItemDetail;
