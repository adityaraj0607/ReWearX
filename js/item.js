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
      this.currentUser = user;
      if (user) {
        this.updateUserDisplay();
        this.loadUserData();
      } else {
        this.hideExchangeOptions();
      }
    });
  }

  setupEventListeners() {
    document.getElementById('profileDropdown')?.addEventListener('click', () => {
      document.getElementById('dropdownMenu')?.classList.toggle('hidden');
    });

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

    document.getElementById('redeemBtn')?.addEventListener('click', () => this.showRedeemModal());
    document.getElementById('swapBtn')?.addEventListener('click', () => this.showSwapModal());

    document.getElementById('closeSwapModal')?.addEventListener('click', () => this.hideSwapModal());
    document.getElementById('cancelSwap')?.addEventListener('click', () => this.hideSwapModal());
    document.getElementById('submitSwap')?.addEventListener('click', () => this.submitSwapProposal());

    document.getElementById('cancelRedeem')?.addEventListener('click', () => this.hideRedeemModal());
    document.getElementById('confirmRedeem')?.addEventListener('click', () => this.confirmRedemption());

    document.getElementById('contactOwnerBtn')?.addEventListener('click', () => this.contactOwner?.());

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

  loadItemFromURL() {
    const itemId = new URLSearchParams(window.location.search).get('id');
    if (!itemId) {
      return this.showError();
    }
    this.loadItem(itemId);
  }

  async loadItem(itemId) {
    try {
      document.getElementById('loadingState')?.classList.remove('hidden');
      const item = await getItemById(itemId);
      if (!item) {
        return this.showError();
      }
      this.currentItem = item;
      incrementItemViews(itemId).catch(console.error);
      this.renderItem();
      this.loadSimilarItems();
      document.getElementById('loadingState')?.classList.add('hidden');
      document.getElementById('itemContent')?.classList.remove('hidden');
    } catch (error) {
      console.error('Error loading item:', error);
      this.showError();
    }
  }

  showError() {
    document.getElementById('loadingState')?.classList.add('hidden');
    document.getElementById('errorState')?.classList.remove('hidden');
  }

  updateUserDisplay() {
    const name = this.currentUser?.displayName || this.currentUser?.email?.split('@')[0] || 'User';
    const avatar = this.currentUser?.photoURL;
    document.getElementById('userName').textContent = name;
    document.getElementById('userAvatar').innerHTML = avatar
      ? `<img src="${avatar}" class="w-8 h-8 rounded-full" />`
      : `<div class="w-8 h-8 bg-emerald-100 rounded-full flex items-center justify-center">
           <span class="text-emerald-600 font-medium text-sm">${name.charAt(0).toUpperCase()}</span>
         </div>`;
  }

  async loadUserData() {
    try {
      this.userStats = await getUserStats(this.currentUser.uid);
      this.userItems = await getUserItems(this.currentUser.uid, { status: 'available' });
      this.updateExchangeOptions();
    } catch (e) {
      console.error('Error loading user data:', e);
    }
  }

  // ... (rest of methods are unchanged — they're already well structured)
}

const itemDetail = new ItemDetail();
window.itemDetail = itemDetail;
export default itemDetail;
