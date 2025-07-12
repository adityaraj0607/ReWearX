import { auth, onAuthStateChanged, signOut } from './firebase-config.js';
import { 
    getPendingItems, 
    getReportedItems, 
    getAllUsers, 
    approveItem, 
    rejectItem, 
    getAdminStats,
    getCategoryStats,
    searchUsers,
    updateUserStatus,
    realTimeListener 
} from './utils/firestore-ops.js';
import { showToast, formatDate } from './utils/validators.js';

class AdminDashboard {
    constructor() {
        this.currentUser = null;
        this.isAdmin = false;
        this.currentTab = 'pending';
        this.pendingItems = [];
        this.reportedItems = [];
        this.users = [];
        this.adminStats = {};
        
        this.init();
    }

    init() {
        this.setupAuthListener();
        this.setupEventListeners();
    }

    setupAuthListener() {
        onAuthStateChanged(auth, async (user) => {
            if (user) {
                this.currentUser = user;
                this.updateUserDisplay();
                await this.checkAdminAccess();
                
                if (this.isAdmin) {
                    this.loadAdminData();
                } else {
                    this.showAccessDenied();
                }
            } else {
                window.location.href = 'login.html';
            }
        });
    }

    async checkAdminAccess() {
        try {
            // Check if user has admin role
            // For demo purposes, check if email contains 'admin' or is in a predefined list
            const adminEmails = ['admin@rewearx.com', 'moderator@rewearx.com'];
            const userEmail = this.currentUser.email?.toLowerCase();
            
            this.isAdmin = adminEmails.includes(userEmail) || 
                          userEmail?.includes('admin') || 
                          userEmail?.includes('moderator');

            // In a real app, you would check this against a user role in the database
            console.log('Admin access:', this.isAdmin);
        } catch (error) {
            console.error('Error checking admin access:', error);
            this.isAdmin = false;
        }
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

        // Tab navigation
        document.getElementById('tabPending')?.addEventListener('click', () => this.switchTab('pending'));
        document.getElementById('tabReported')?.addEventListener('click', () => this.switchTab('reported'));
        document.getElementById('tabUsers')?.addEventListener('click', () => this.switchTab('users'));
        document.getElementById('tabAnalytics')?.addEventListener('click', () => this.switchTab('analytics'));

        // Bulk actions
        document.getElementById('approveAllBtn')?.addEventListener('click', () => this.approveAllPending());
        document.getElementById('refreshPendingBtn')?.addEventListener('click', () => this.loadPendingItems());

        // User search
        document.getElementById('searchUsersBtn')?.addEventListener('click', () => this.searchUsers());
        document.getElementById('userSearchInput')?.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.searchUsers();
        });

        // Modal controls
        document.getElementById('closeItemModal')?.addEventListener('click', () => this.hideItemModal());
        document.getElementById('itemModal')?.addEventListener('click', (e) => {
            if (e.target.id === 'itemModal') this.hideItemModal();
        });
    }

    updateUserDisplay() {
        if (!this.currentUser) return;

        const userName = this.currentUser.displayName || this.currentUser.email?.split('@')[0] || 'Admin';
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

    showAccessDenied() {
        document.getElementById('accessDenied').classList.remove('hidden');
        document.getElementById('adminContent').classList.add('hidden');
    }

    async loadAdminData() {
        document.getElementById('accessDenied').classList.add('hidden');
        document.getElementById('adminContent').classList.remove('hidden');

        try {
            // Load admin stats
            await this.loadAdminStats();
            
            // Load initial tab data
            await this.loadPendingItems();
            
            // Setup real-time listeners
            this.setupRealTimeListeners();
            
        } catch (error) {
            console.error('Error loading admin data:', error);
            showToast('Error loading admin data', 'error');
        }
    }

    setupRealTimeListeners() {
        // Real-time pending items listener
        const pendingUnsubscribe = realTimeListener(
            'items',
            { field: 'status', operator: '==', value: 'pending' },
            (items) => {
                this.pendingItems = items;
                if (this.currentTab === 'pending') {
                    this.renderPendingItems();
                }
                this.updateStatsDisplay();
            },
            (error) => console.error('Error in pending items listener:', error)
        );

        // Store unsubscribe functions for cleanup
        window.addEventListener('beforeunload', () => {
            pendingUnsubscribe();
        });
    }

    async loadAdminStats() {
        try {
            this.adminStats = await getAdminStats();
            this.updateStatsDisplay();
        } catch (error) {
            console.error('Error loading admin stats:', error);
        }
    }

    updateStatsDisplay() {
        document.getElementById('pendingItemsCount').textContent = this.adminStats.pendingItems || 0;
        document.getElementById('reportedItemsCount').textContent = this.adminStats.reportedItems || 0;
        document.getElementById('totalUsersCount').textContent = this.adminStats.totalUsers || 0;
        document.getElementById('totalItemsCount').textContent = this.adminStats.totalItems || 0;
    }

    switchTab(tabName) {
        this.currentTab = tabName;

        // Update tab buttons
        document.querySelectorAll('[id^="tab"]').forEach(btn => {
            btn.className = 'border-b-2 border-transparent py-2 px-1 text-sm font-medium text-gray-500 hover:text-gray-700 hover:border-gray-300';
        });
        document.getElementById(`tab${tabName.charAt(0).toUpperCase() + tabName.slice(1)}`).className = 
            'border-b-2 border-emerald-500 py-2 px-1 text-sm font-medium text-emerald-600';

        // Show/hide tab content
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.add('hidden');
        });
        document.getElementById(`${tabName}Tab`).classList.remove('hidden');

        // Load tab data
        switch (tabName) {
            case 'pending':
                this.loadPendingItems();
                break;
            case 'reported':
                this.loadReportedItems();
                break;
            case 'users':
                this.loadUsers();
                break;
            case 'analytics':
                this.loadAnalytics();
                break;
        }
    }

    async loadPendingItems() {
        try {
            this.pendingItems = await getPendingItems();
            this.renderPendingItems();
        } catch (error) {
            console.error('Error loading pending items:', error);
            showToast('Error loading pending items', 'error');
        }
    }

    renderPendingItems() {
        const container = document.getElementById('pendingItemsContainer');
        
        if (this.pendingItems.length === 0) {
            container.innerHTML = `
                <div class="text-center py-8">
                    <i data-feather="check-circle" class="w-12 h-12 text-green-500 mx-auto mb-4"></i>
                    <p class="text-gray-500">No items pending approval</p>
                </div>
            `;
            feather.replace();
            return;
        }

        container.innerHTML = this.pendingItems.map(item => this.createPendingItemCard(item)).join('');
        feather.replace();
    }

    createPendingItemCard(item) {
        return `
            <div class="border border-gray-200 rounded-lg p-4 mb-4">
                <div class="flex items-start space-x-4">
                    <img src="${item.images?.[0] || '/api/placeholder/80/80'}" 
                         alt="${item.title}" 
                         class="w-20 h-20 object-cover rounded-lg cursor-pointer"
                         onclick="adminDashboard.viewItemDetails('${item.id}')">
                    <div class="flex-1">
                        <div class="flex items-start justify-between">
                            <div>
                                <h3 class="font-medium text-gray-900">${item.title}</h3>
                                <p class="text-sm text-gray-600">${item.category} • Size ${item.size} • ${item.condition}</p>
                                <p class="text-sm text-gray-500 mt-1">Uploaded by ${item.ownerName}</p>
                                <p class="text-xs text-gray-400">${formatDate(item.createdAt)}</p>
                            </div>
                            <div class="flex space-x-2">
                                <button onclick="adminDashboard.approveItem('${item.id}')" 
                                        class="px-3 py-1 bg-green-600 text-white rounded text-sm hover:bg-green-700 transition">
                                    <i data-feather="check" class="w-4 h-4"></i>
                                </button>
                                <button onclick="adminDashboard.rejectItem('${item.id}')" 
                                        class="px-3 py-1 bg-red-600 text-white rounded text-sm hover:bg-red-700 transition">
                                    <i data-feather="x" class="w-4 h-4"></i>
                                </button>
                                <button onclick="adminDashboard.viewItemDetails('${item.id}')" 
                                        class="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 transition">
                                    <i data-feather="eye" class="w-4 h-4"></i>
                                </button>
                            </div>
                        </div>
                        <p class="text-sm text-gray-700 mt-2">${item.description}</p>
                        ${item.tags ? `
                            <div class="flex flex-wrap gap-1 mt-2">
                                ${item.tags.map(tag => `<span class="inline-flex items-center px-2 py-1 rounded-full text-xs bg-gray-100 text-gray-700">${tag}</span>`).join('')}
                            </div>
                        ` : ''}
                    </div>
                </div>
            </div>
        `;
    }

    async approveItem(itemId) {
        try {
            await approveItem(itemId);
            showToast('Item approved successfully', 'success');
            await this.loadPendingItems();
            await this.loadAdminStats();
        } catch (error) {
            console.error('Error approving item:', error);
            showToast('Error approving item: ' + error.message, 'error');
        }
    }

    async rejectItem(itemId) {
        try {
            const reason = prompt('Rejection reason (optional):');
            await rejectItem(itemId, reason);
            showToast('Item rejected', 'success');
            await this.loadPendingItems();
            await this.loadAdminStats();
        } catch (error) {
            console.error('Error rejecting item:', error);
            showToast('Error rejecting item: ' + error.message, 'error');
        }
    }

    async approveAllPending() {
        if (!confirm(`Are you sure you want to approve all ${this.pendingItems.length} pending items?`)) {
            return;
        }

        try {
            const promises = this.pendingItems.map(item => approveItem(item.id));
            await Promise.all(promises);
            showToast(`${this.pendingItems.length} items approved successfully`, 'success');
            await this.loadPendingItems();
            await this.loadAdminStats();
        } catch (error) {
            console.error('Error approving all items:', error);
            showToast('Error approving items: ' + error.message, 'error');
        }
    }

    async loadReportedItems() {
        try {
            this.reportedItems = await getReportedItems();
            this.renderReportedItems();
        } catch (error) {
            console.error('Error loading reported items:', error);
            showToast('Error loading reported items', 'error');
        }
    }

    renderReportedItems() {
        const container = document.getElementById('reportedItemsContainer');
        
        if (this.reportedItems.length === 0) {
            container.innerHTML = `
                <div class="text-center py-8">
                    <i data-feather="shield-check" class="w-12 h-12 text-green-500 mx-auto mb-4"></i>
                    <p class="text-gray-500">No reported items</p>
                </div>
            `;
            feather.replace();
            return;
        }

        container.innerHTML = this.reportedItems.map(item => this.createReportedItemCard(item)).join('');
        feather.replace();
    }

    createReportedItemCard(item) {
        return `
            <div class="border border-red-200 rounded-lg p-4 mb-4 bg-red-50">
                <div class="flex items-start space-x-4">
                    <img src="${item.images?.[0] || '/api/placeholder/80/80'}" 
                         alt="${item.title}" 
                         class="w-20 h-20 object-cover rounded-lg">
                    <div class="flex-1">
                        <div class="flex items-start justify-between">
                            <div>
                                <h3 class="font-medium text-gray-900">${item.title}</h3>
                                <p class="text-sm text-gray-600">${item.category} • Reported ${item.reportCount || 1} time(s)</p>
                                <p class="text-sm text-red-600 font-medium">Reason: ${item.reportReason || 'Inappropriate content'}</p>
                                <p class="text-xs text-gray-400">${formatDate(item.reportedAt)}</p>
                            </div>
                            <div class="flex space-x-2">
                                <button onclick="adminDashboard.resolveReport('${item.id}', 'approve')" 
                                        class="px-3 py-1 bg-green-600 text-white rounded text-sm hover:bg-green-700 transition">
                                    Keep
                                </button>
                                <button onclick="adminDashboard.resolveReport('${item.id}', 'remove')" 
                                        class="px-3 py-1 bg-red-600 text-white rounded text-sm hover:bg-red-700 transition">
                                    Remove
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    async resolveReport(itemId, action) {
        try {
            if (action === 'remove') {
                await rejectItem(itemId, 'Removed due to reports');
                showToast('Item removed successfully', 'success');
            } else {
                await approveItem(itemId);
                showToast('Report resolved - item kept', 'success');
            }
            await this.loadReportedItems();
            await this.loadAdminStats();
        } catch (error) {
            console.error('Error resolving report:', error);
            showToast('Error resolving report: ' + error.message, 'error');
        }
    }

    async loadUsers() {
        try {
            this.users = await getAllUsers(50); // Limit to 50 users for performance
            this.renderUsers();
        } catch (error) {
            console.error('Error loading users:', error);
            showToast('Error loading users', 'error');
        }
    }

    renderUsers() {
        const container = document.getElementById('usersContainer');
        
        if (this.users.length === 0) {
            container.innerHTML = '<p class="text-center text-gray-500 py-8">No users found</p>';
            return;
        }

        container.innerHTML = `
            <div class="overflow-x-auto">
                <table class="min-w-full divide-y divide-gray-200">
                    <thead class="bg-gray-50">
                        <tr>
                            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">User</th>
                            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Items</th>
                            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Points</th>
                            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Joined</th>
                            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                        </tr>
                    </thead>
                    <tbody class="bg-white divide-y divide-gray-200">
                        ${this.users.map(user => this.createUserRow(user)).join('')}
                    </tbody>
                </table>
            </div>
        `;
    }

    createUserRow(user) {
        const statusClass = user.status === 'active' ? 'bg-green-100 text-green-800' :
                           user.status === 'suspended' ? 'bg-red-100 text-red-800' :
                           'bg-gray-100 text-gray-800';

        return `
            <tr>
                <td class="px-6 py-4 whitespace-nowrap">
                    <div class="flex items-center">
                        <img src="${user.avatar || '/api/placeholder/40/40'}" 
                             alt="${user.name}" 
                             class="w-10 h-10 rounded-full">
                        <div class="ml-4">
                            <div class="text-sm font-medium text-gray-900">${user.name}</div>
                            <div class="text-sm text-gray-500">${user.email}</div>
                        </div>
                    </div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">${user.itemsShared || 0}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">${user.totalPoints || 0}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${formatDate(user.createdAt)}</td>
                <td class="px-6 py-4 whitespace-nowrap">
                    <span class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${statusClass}">
                        ${user.status || 'active'}
                    </span>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <div class="flex space-x-2">
                        ${user.status !== 'suspended' ? `
                            <button onclick="adminDashboard.suspendUser('${user.id}')" 
                                    class="text-red-600 hover:text-red-900">Suspend</button>
                        ` : `
                            <button onclick="adminDashboard.reactivateUser('${user.id}')" 
                                    class="text-green-600 hover:text-green-900">Reactivate</button>
                        `}
                    </div>
                </td>
            </tr>
        `;
    }

    async searchUsers() {
        const query = document.getElementById('userSearchInput').value.trim();
        if (!query) {
            await this.loadUsers();
            return;
        }

        try {
            this.users = await searchUsers(query);
            this.renderUsers();
        } catch (error) {
            console.error('Error searching users:', error);
            showToast('Error searching users', 'error');
        }
    }

    async suspendUser(userId) {
        if (!confirm('Are you sure you want to suspend this user?')) return;

        try {
            await updateUserStatus(userId, 'suspended');
            showToast('User suspended successfully', 'success');
            await this.loadUsers();
        } catch (error) {
            console.error('Error suspending user:', error);
            showToast('Error suspending user: ' + error.message, 'error');
        }
    }

    async reactivateUser(userId) {
        try {
            await updateUserStatus(userId, 'active');
            showToast('User reactivated successfully', 'success');
            await this.loadUsers();
        } catch (error) {
            console.error('Error reactivating user:', error);
            showToast('Error reactivating user: ' + error.message, 'error');
        }
    }

    async loadAnalytics() {
        try {
            // Load weekly stats
            const weeklyStats = await getAdminStats('weekly');
            document.getElementById('itemsThisWeek').textContent = weeklyStats.itemsThisWeek || 0;
            document.getElementById('usersThisWeek').textContent = weeklyStats.usersThisWeek || 0;
            document.getElementById('exchangesThisWeek').textContent = weeklyStats.exchangesThisWeek || 0;

            // Load category breakdown
            const categoryStats = await getCategoryStats();
            this.renderCategoryBreakdown(categoryStats);
        } catch (error) {
            console.error('Error loading analytics:', error);
            showToast('Error loading analytics', 'error');
        }
    }

    renderCategoryBreakdown(stats) {
        const container = document.getElementById('categoryBreakdown');
        
        if (!stats || stats.length === 0) {
            container.innerHTML = '<p class="text-gray-500">No data available</p>';
            return;
        }

        const total = stats.reduce((sum, cat) => sum + cat.count, 0);

        container.innerHTML = stats.map(category => {
            const percentage = total > 0 ? (category.count / total * 100).toFixed(1) : 0;
            return `
                <div class="flex items-center justify-between">
                    <span class="text-gray-600">${category.name}</span>
                    <div class="flex items-center space-x-2">
                        <div class="w-20 bg-gray-200 rounded-full h-2">
                            <div class="bg-emerald-600 h-2 rounded-full" style="width: ${percentage}%"></div>
                        </div>
                        <span class="text-sm font-medium text-gray-900">${category.count}</span>
                    </div>
                </div>
            `;
        }).join('');
    }

    viewItemDetails(itemId) {
        const item = this.pendingItems.find(i => i.id === itemId) || 
                     this.reportedItems.find(i => i.id === itemId);
        
        if (!item) return;

        const modal = document.getElementById('itemModal');
        const content = document.getElementById('modalItemContent');
        
        content.innerHTML = `
            <div class="space-y-6">
                <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <img src="${item.images?.[0] || '/api/placeholder/300/300'}" 
                             alt="${item.title}" 
                             class="w-full aspect-square object-cover rounded-lg">
                    </div>
                    <div class="space-y-4">
                        <div>
                            <h3 class="text-xl font-semibold text-gray-900">${item.title}</h3>
                            <p class="text-gray-600">${item.category} • Size ${item.size}</p>
                        </div>
                        <div class="grid grid-cols-2 gap-4 text-sm">
                            <div>
                                <span class="font-medium">Condition:</span>
                                <span class="ml-2">${item.condition}</span>
                            </div>
                            <div>
                                <span class="font-medium">Points:</span>
                                <span class="ml-2">${item.pointsValue || 0}</span>
                            </div>
                            <div>
                                <span class="font-medium">Brand:</span>
                                <span class="ml-2">${item.brand || 'N/A'}</span>
                            </div>
                            <div>
                                <span class="font-medium">Color:</span>
                                <span class="ml-2">${item.color || 'N/A'}</span>
                            </div>
                        </div>
                        <div>
                            <h4 class="font-medium mb-2">Description</h4>
                            <p class="text-gray-700">${item.description}</p>
                        </div>
                        ${item.tags ? `
                            <div>
                                <h4 class="font-medium mb-2">Tags</h4>
                                <div class="flex flex-wrap gap-1">
                                    ${item.tags.map(tag => `<span class="inline-flex items-center px-2 py-1 rounded-full text-xs bg-gray-100 text-gray-700">${tag}</span>`).join('')}
                                </div>
                            </div>
                        ` : ''}
                    </div>
                </div>
                <div class="flex space-x-4 pt-4 border-t">
                    <button onclick="adminDashboard.approveItem('${item.id}'); adminDashboard.hideItemModal();" 
                            class="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition">
                        Approve
                    </button>
                    <button onclick="adminDashboard.rejectItem('${item.id}'); adminDashboard.hideItemModal();" 
                            class="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition">
                        Reject
                    </button>
                </div>
            </div>
        `;
        
        modal.classList.remove('hidden');
    }

    hideItemModal() {
        document.getElementById('itemModal').classList.add('hidden');
    }
}

// Initialize admin dashboard
const adminDashboard = new AdminDashboard();

// Make adminDashboard available globally for onclick handlers
window.adminDashboard = adminDashboard;

export default adminDashboard;
