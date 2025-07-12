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
import { showToast, formatDate } from './utils/validators.js';
import { getCachedData, setCachedData } from './utils/cache.js';

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
            if (e.target.id === 'swapModal') this.hideSwapModal();
        });
        document.getElementById('redeemModal')?.addEventListener('click', (e) => {
            if (e.target.id === 'redeemModal') this.hideRedeemModal();
        });
    }

    updateUserDisplay() {
        if (!this.currentUser) return;

        const userName = this.currentUser.displayName || this.currentUser.email?.split('@')[0] || 'User';
        document.getElementById('userName').textContent = userName;

        // Update avatar
        const avatar = document.getElementById('userAvatar');
        if (this.currentUser.photoURL) {
            avatar.innerHTML = `<img src="${this.currentUser.photoURL}" alt="Profile" class="w-8 h-8 rounded-full">`;
        } else {
            avatar.innerHTML = `<div class="w-8 h-8 bg-emerald-100 rounded-full flex items-center justify-center">
                <span class="text-emerald-600 font-medium text-sm">${userName.charAt(0).toUpperCase()}</span>
            </div>`;
        }
    }

    async loadUserData() {
        if (!this.currentUser) return;

        try {
            const stats = await getUserStats(this.currentUser.uid);
            this.userStats = stats;
            this.updatePointsDisplay();

            const items = await getUserItems(this.currentUser.uid, { status: 'available' });
            this.userItems = items;
        } catch (error) {
            console.error('Error loading user data:', error);
        }
    }

    loadItemFromURL() {
        const urlParams = new URLSearchParams(window.location.search);
        const itemId = urlParams.get('id');
        
        if (!itemId) {
            this.showError();
            return;
        }

        this.loadItem(itemId);
    }

    async loadItem(itemId) {
        try {
            document.getElementById('loadingState').classList.remove('hidden');
            
            const item = await getItemById(itemId);
            
            if (!item) {
                this.showError();
                return;
            }

            this.currentItem = item;
            
            // Increment view count (fire and forget)
            incrementItemViews(itemId).catch(console.error);
            
            this.renderItem();
            this.loadSimilarItems();
            
            document.getElementById('loadingState').classList.add('hidden');
            document.getElementById('itemContent').classList.remove('hidden');
            
        } catch (error) {
            console.error('Error loading item:', error);
            this.showError();
        }
    }

    renderItem() {
        if (!this.currentItem) return;

        const item = this.currentItem;

        // Update page title and breadcrumb
        document.title = `${item.title} - ReWearX`;
        document.getElementById('breadcrumbTitle').textContent = item.title;

        // Basic info
        document.getElementById('itemTitle').textContent = item.title;
        document.getElementById('itemDescription').textContent = item.description;
        document.getElementById('itemCategory').textContent = item.category;
        document.getElementById('itemSize').textContent = `Size: ${item.size}`;
        document.getElementById('itemCondition').textContent = `Condition: ${item.condition}`;
        document.getElementById('itemPoints').textContent = `${item.pointsValue || 0} points`;
        document.getElementById('itemBrand').textContent = item.brand || 'N/A';
        document.getElementById('itemColor').textContent = item.color || 'N/A';

        // Status
        const statusElement = document.getElementById('itemStatus');
        const statusClass = item.status === 'available' ? 'bg-green-100 text-green-800' :
                           item.status === 'exchanged' ? 'bg-blue-100 text-blue-800' :
                           'bg-gray-100 text-gray-800';
        statusElement.className = `inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${statusClass}`;
        statusElement.textContent = item.status.charAt(0).toUpperCase() + item.status.slice(1);

        // Images
        this.renderImages(item.images || []);

        // Owner info
        document.getElementById('ownerName').textContent = item.ownerName || 'Anonymous';
        document.getElementById('ownerAvatar').src = item.ownerAvatar || '/api/placeholder/48/48';
        document.getElementById('ownerItems').textContent = `${item.ownerItemCount || 0} items shared`;

        // Tags
        if (item.tags && item.tags.length > 0) {
            document.getElementById('tagsContainer').classList.remove('hidden');
            document.getElementById('tagsList').innerHTML = item.tags.map(tag => 
                `<span class="inline-flex items-center px-3 py-1 rounded-full text-sm bg-gray-100 text-gray-700">${tag}</span>`
            ).join('');
        }

        // Exchange options
        this.updateExchangeOptions();
    }

    renderImages(images) {
        const mainImage = document.getElementById('mainImage');
        const thumbnailContainer = document.getElementById('thumbnailContainer');

        if (images.length === 0) {
            mainImage.src = '/api/placeholder/400/400';
            mainImage.alt = 'No image available';
            thumbnailContainer.innerHTML = '';
            return;
        }

        // Set main image
        mainImage.src = images[0];
        mainImage.alt = this.currentItem.title;

        // Create thumbnails
        if (images.length > 1) {
            thumbnailContainer.innerHTML = images.map((image, index) => `
                <button onclick="itemDetail.setMainImage('${image}')" 
                        class="aspect-square bg-white rounded-lg overflow-hidden border border-gray-200 hover:border-emerald-300 transition">
                    <img src="${image}" alt="Image ${index + 1}" class="w-full h-full object-cover">
                </button>
            `).join('');
        } else {
            thumbnailContainer.innerHTML = '';
        }
    }

    setMainImage(imageSrc) {
        document.getElementById('mainImage').src = imageSrc;
    }

    updateExchangeOptions() {
        if (!this.currentUser || !this.currentItem) {
            this.hideExchangeOptions();
            return;
        }

        // Don't show options for own items
        if (this.currentItem.uploadedBy === this.currentUser.uid) {
            this.hideExchangeOptions();
            return;
        }

        // Don't show options for unavailable items
        if (this.currentItem.status !== 'available') {
            this.hideExchangeOptions();
            return;
        }

        document.getElementById('exchangeOptions').classList.remove('hidden');
        this.updatePointsDisplay();
    }

    hideExchangeOptions() {
        document.getElementById('exchangeOptions')?.classList.add('hidden');
    }

    updatePointsDisplay() {
        if (!this.userStats || !this.currentItem) return;

        const userPoints = this.userStats.totalPoints || 0;
        const itemPoints = this.currentItem.pointsValue || 0;

        document.getElementById('userPoints').textContent = userPoints;
        document.getElementById('pointsNeeded').textContent = itemPoints;

        const redeemBtn = document.getElementById('redeemBtn');
        if (userPoints >= itemPoints) {
            redeemBtn.disabled = false;
            redeemBtn.className = 'px-6 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition font-medium';
        } else {
            redeemBtn.disabled = true;
            redeemBtn.className = 'px-6 py-2 bg-gray-400 text-white rounded-lg cursor-not-allowed font-medium';
        }
    }

    showRedeemModal() {
        if (!this.currentUser) {
            showToast('Please log in to redeem items', 'error');
            return;
        }

        if (!this.currentItem || this.currentItem.status !== 'available') {
            showToast('This item is no longer available', 'error');
            return;
        }

        const userPoints = this.userStats?.totalPoints || 0;
        const itemPoints = this.currentItem.pointsValue || 0;

        if (userPoints < itemPoints) {
            showToast('You don\'t have enough points', 'error');
            return;
        }

        document.getElementById('confirmPoints').textContent = `${itemPoints}`;
        document.getElementById('redeemModal').classList.remove('hidden');
    }

    hideRedeemModal() {
        document.getElementById('redeemModal').classList.add('hidden');
    }

    async confirmRedemption() {
        try {
            await redeemItem(this.currentItem.id, this.currentUser.uid);
            showToast('Item redeemed successfully!', 'success');
            
            // Refresh the page to show updated status
            window.location.reload();
        } catch (error) {
            console.error('Error redeeming item:', error);
            showToast('Error redeeming item: ' + error.message, 'error');
        }
        
        this.hideRedeemModal();
    }

    showSwapModal() {
        if (!this.currentUser) {
            showToast('Please log in to propose swaps', 'error');
            return;
        }

        if (!this.currentItem || this.currentItem.status !== 'available') {
            showToast('This item is no longer available', 'error');
            return;
        }

        if (this.userItems.length === 0) {
            showToast('You need to upload items before proposing swaps', 'error');
            return;
        }

        this.renderUserItemsForSwap();
        document.getElementById('swapModal').classList.remove('hidden');
    }

    hideSwapModal() {
        document.getElementById('swapModal').classList.add('hidden');
        this.selectedSwapItem = null;
        document.getElementById('swapMessage').value = '';
    }

    renderUserItemsForSwap() {
        const container = document.getElementById('userItemsForSwap');
        
        if (this.userItems.length === 0) {
            container.innerHTML = '<p class="text-gray-500 text-center py-4">No available items to swap</p>';
            return;
        }

        container.innerHTML = this.userItems.map(item => `
            <div class="flex items-center space-x-3 p-3 border border-gray-200 rounded-lg cursor-pointer hover:border-emerald-300 transition"
                 onclick="itemDetail.selectSwapItem('${item.id}')">
                <input type="radio" name="swapItem" value="${item.id}" class="text-emerald-600">
                <img src="${item.images?.[0] || '/api/placeholder/64/64'}" 
                     alt="${item.title}" 
                     class="w-12 h-12 object-cover rounded-lg">
                <div class="flex-1">
                    <h4 class="font-medium text-gray-900">${item.title}</h4>
                    <p class="text-sm text-gray-600">${item.category} • ${item.pointsValue || 0} points</p>
                </div>
            </div>
        `).join('');
    }

    selectSwapItem(itemId) {
        this.selectedSwapItem = itemId;
        
        // Update radio button
        const radio = document.querySelector(`input[value="${itemId}"]`);
        if (radio) radio.checked = true;

        // Update visual selection
        document.querySelectorAll('#userItemsForSwap > div').forEach(div => {
            div.classList.remove('border-emerald-500', 'bg-emerald-50');
            div.classList.add('border-gray-200');
        });

        const selectedDiv = document.querySelector(`input[value="${itemId}"]`)?.closest('div');
        if (selectedDiv) {
            selectedDiv.classList.remove('border-gray-200');
            selectedDiv.classList.add('border-emerald-500', 'bg-emerald-50');
        }
    }

    async submitSwapProposal() {
        if (!this.selectedSwapItem) {
            showToast('Please select an item to offer', 'error');
            return;
        }

        const message = document.getElementById('swapMessage').value.trim();
        const offeredItem = this.userItems.find(item => item.id === this.selectedSwapItem);

        try {
            await createSwapRequest({
                requesterId: this.currentUser.uid,
                requesterName: this.currentUser.displayName || this.currentUser.email?.split('@')[0] || 'User',
                requesterEmail: this.currentUser.email,
                requesterAvatar: this.currentUser.photoURL,
                receiverId: this.currentItem.uploadedBy,
                receiverName: this.currentItem.ownerName,
                requestedItemId: this.currentItem.id,
                requestedItemTitle: this.currentItem.title,
                requestedItemImage: this.currentItem.images?.[0],
                requestedItemCategory: this.currentItem.category,
                offeredItemId: this.selectedSwapItem,
                offeredItemTitle: offeredItem.title,
                offeredItemImage: offeredItem.images?.[0],
                offeredItemCategory: offeredItem.category,
                message: message,
                status: 'pending'
            });

            showToast('Swap proposal sent successfully!', 'success');
            this.hideSwapModal();
        } catch (error) {
            console.error('Error creating swap request:', error);
            showToast('Error sending swap proposal: ' + error.message, 'error');
        }
    }

    async loadSimilarItems() {
        try {
            const similar = await getSimilarItems(this.currentItem.category, this.currentItem.id, 4);
            this.renderSimilarItems(similar);
        } catch (error) {
            console.error('Error loading similar items:', error);
            document.getElementById('similarItemsContainer').innerHTML = 
                '<p class="col-span-full text-center text-gray-500">Unable to load similar items</p>';
        }
    }

    renderSimilarItems(items) {
        const container = document.getElementById('similarItemsContainer');
        
        if (items.length === 0) {
            container.innerHTML = '<p class="col-span-full text-center text-gray-500">No similar items found</p>';
            return;
        }

        container.innerHTML = items.map(item => `
            <div class="bg-white rounded-xl shadow-sm overflow-hidden border border-emerald-100 hover:shadow-md transition">
                <div class="aspect-square bg-gray-100">
                    <img src="${item.images?.[0] || '/api/placeholder/300/300'}" 
                         alt="${item.title}" 
                         class="w-full h-full object-cover">
                </div>
                <div class="p-4">
                    <h3 class="font-medium text-gray-900 mb-1">${item.title}</h3>
                    <p class="text-sm text-gray-600 mb-2">${item.category} • Size ${item.size}</p>
                    <div class="flex items-center justify-between">
                        <span class="text-emerald-600 font-medium">${item.pointsValue || 0} points</span>
                        <a href="item.html?id=${item.id}" 
                           class="px-3 py-1 text-sm bg-emerald-600 text-white rounded hover:bg-emerald-700 transition">
                            View
                        </a>
                    </div>
                </div>
            </div>
        `).join('');
    }

    contactOwner() {
        if (!this.currentUser) {
            showToast('Please log in to contact the owner', 'error');
            return;
        }

        // This could open a chat interface or redirect to a messaging system
        showToast('Messaging feature coming soon!', 'info');
    }

    showError() {
        document.getElementById('loadingState').classList.add('hidden');
        document.getElementById('errorState').classList.remove('hidden');
    }
}

// Initialize item detail page
const itemDetail = new ItemDetail();

// Make itemDetail available globally for onclick handlers
window.itemDetail = itemDetail;

export default itemDetail;
