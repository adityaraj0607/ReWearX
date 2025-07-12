// Browse Items with Search, Filter, and Pagination
import { ItemOperations } from './utils/firestore-ops.js';
import { itemsCache } from './utils/cache.js';
import { showToast, debounce, setupLazyLoading, formatDate } from './utils/validators.js';
import authManager from './auth.js';

class ItemBrowser {
  constructor() {
    this.currentPage = 1;
    this.itemsPerPage = 12;
    this.totalItems = 0;
    this.currentFilters = {};
    this.currentSearch = '';
    this.lastDocument = null;
    this.hasMoreItems = true;
    this.isLoading = false;
    this.allItems = [];
    this.filteredItems = [];
    
    this.init();
  }

  init() {
    this.setupSearchAndFilters();
    this.loadInitialItems();
    this.setupEventListeners();
    this.parseURLParams();
  }

  parseURLParams() {
    const urlParams = new URLSearchParams(window.location.search);
    
    // Set category from URL
    const category = urlParams.get('category');
    if (category) {
      const categorySelect = document.getElementById('category-filter');
      if (categorySelect) {
        categorySelect.value = category;
        this.currentFilters.category = category;
      }
    }

    // Set search from URL
    const search = urlParams.get('search');
    if (search) {
      const searchInput = document.getElementById('search-input');
      if (searchInput) {
        searchInput.value = search;
        this.currentSearch = search;
      }
    }

    // Apply filters
    this.applyFilters();
  }

  setupSearchAndFilters() {
    // Search input with debounce
    const searchInput = document.getElementById('search-input');
    if (searchInput) {
      const debouncedSearch = debounce((query) => {
        this.currentSearch = query;
        this.resetPagination();
        this.searchAndFilter();
      }, 300);

      searchInput.addEventListener('input', (e) => {
        debouncedSearch(e.target.value.trim());
      });
    }

    // Filter controls
    const filterElements = [
      'category-filter',
      'type-filter', 
      'size-filter',
      'condition-filter',
      'sort-filter'
    ];

    filterElements.forEach(id => {
      const element = document.getElementById(id);
      if (element) {
        element.addEventListener('change', () => {
          this.updateFilters();
          this.resetPagination();
          this.searchAndFilter();
        });
      }
    });

    // Clear filters button
    const clearFiltersBtn = document.getElementById('clear-filters');
    if (clearFiltersBtn) {
      clearFiltersBtn.addEventListener('click', () => {
        this.clearFilters();
      });
    }

    // Price range slider (if implemented)
    const priceRange = document.getElementById('price-range');
    if (priceRange) {
      priceRange.addEventListener('input', debounce(() => {
        this.updateFilters();
        this.searchAndFilter();
      }, 500));
    }
  }

  setupEventListeners() {
    // Pagination buttons
    document.addEventListener('click', (e) => {
      if (e.target.matches('.pagination-btn[data-page]')) {
        const page = parseInt(e.target.dataset.page);
        this.goToPage(page);
      }
    });

    // View toggle (grid/list)
    const viewToggle = document.querySelectorAll('.view-toggle');
    viewToggle.forEach(btn => {
      btn.addEventListener('click', () => {
        const view = btn.dataset.view;
        this.changeView(view);
        
        // Update active state
        viewToggle.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
      });
    });

    // Sort by popularity, date, price
    const sortButtons = document.querySelectorAll('.sort-btn');
    sortButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        const sortBy = btn.dataset.sort;
        this.setSortOrder(sortBy);
        
        // Update active state
        sortButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
      });
    });
  }

  updateFilters() {
    this.currentFilters = {
      category: this.getSelectValue('category-filter'),
      type: this.getSelectValue('type-filter'),
      size: this.getSelectValue('size-filter'),
      condition: this.getSelectValue('condition-filter'),
      sort: this.getSelectValue('sort-filter')
    };

    // Remove empty filters
    Object.keys(this.currentFilters).forEach(key => {
      if (!this.currentFilters[key]) {
        delete this.currentFilters[key];
      }
    });

    this.updateURL();
  }

  getSelectValue(id) {
    const element = document.getElementById(id);
    return element ? element.value : '';
  }

  updateURL() {
    const params = new URLSearchParams();
    
    if (this.currentSearch) {
      params.set('search', this.currentSearch);
    }
    
    Object.entries(this.currentFilters).forEach(([key, value]) => {
      if (value && key !== 'sort') {
        params.set(key, value);
      }
    });

    if (this.currentPage > 1) {
      params.set('page', this.currentPage);
    }

    const newURL = `${window.location.pathname}${params.toString() ? '?' + params.toString() : ''}`;
    window.history.replaceState({}, '', newURL);
  }

  clearFilters() {
    // Reset all filter controls
    document.getElementById('search-input').value = '';
    document.getElementById('category-filter').value = '';
    document.getElementById('type-filter').value = '';
    document.getElementById('size-filter').value = '';
    document.getElementById('condition-filter').value = '';
    document.getElementById('sort-filter').value = 'newest';

    this.currentSearch = '';
    this.currentFilters = {};
    this.resetPagination();
    this.updateURL();
    this.searchAndFilter();
  }

  async loadInitialItems() {
    this.showLoading();
    
    try {
      // Try to get from cache first
      const cacheKey = this.generateCacheKey();
      let cachedData = itemsCache.getItems(this.currentFilters, this.currentPage);
      
      if (cachedData) {
        this.displayItems(cachedData.items);
        this.totalItems = cachedData.total;
        this.updatePaginationControls();
      } else {
        // Fetch from Firestore
        await this.fetchItems();
      }
    } catch (error) {
      console.error('Error loading items:', error);
      showToast('Failed to load items. Please try again.', 'error');
    } finally {
      this.hideLoading();
    }
  }

  async fetchItems() {
    const filters = this.buildFirestoreFilters();
    const sortField = this.getSortField();
    const sortDirection = this.getSortDirection();

    try {
      const result = await ItemOperations.getPaginated(
        'items',
        this.itemsPerPage,
        this.lastDocument,
        filters,
        sortField,
        sortDirection
      );

      this.allItems = result.docs;
      this.lastDocument = result.lastDoc;
      this.hasMoreItems = result.hasMore;

      // Cache the results
      const cacheData = {
        items: this.allItems,
        total: this.allItems.length,
        hasMore: this.hasMoreItems
      };
      
      itemsCache.setItems(this.currentFilters, cacheData, this.currentPage);

      this.displayItems(this.allItems);
      this.updatePaginationControls();

    } catch (error) {
      console.error('Error fetching items:', error);
      throw error;
    }
  }

  buildFirestoreFilters() {
    const filters = [
      { field: 'status', operator: '==', value: 'available' }
    ];

    // Add category filter
    if (this.currentFilters.category) {
      filters.push({
        field: 'category',
        operator: '==',
        value: this.currentFilters.category
      });
    }

    // Add type filter
    if (this.currentFilters.type) {
      filters.push({
        field: 'type',
        operator: '==',
        value: this.currentFilters.type
      });
    }

    // Add size filter
    if (this.currentFilters.size) {
      filters.push({
        field: 'size',
        operator: '==',
        value: this.currentFilters.size
      });
    }

    // Add condition filter
    if (this.currentFilters.condition) {
      filters.push({
        field: 'condition',
        operator: '==',
        value: this.currentFilters.condition
      });
    }

    return filters;
  }

  getSortField() {
    const sortMap = {
      'newest': 'createdAt',
      'oldest': 'createdAt',
      'price-low': 'pointsValue',
      'price-high': 'pointsValue',
      'popular': 'views' // If you track views
    };

    return sortMap[this.currentFilters.sort] || 'createdAt';
  }

  getSortDirection() {
    const directionMap = {
      'newest': 'desc',
      'oldest': 'asc',
      'price-low': 'asc',
      'price-high': 'desc',
      'popular': 'desc'
    };

    return directionMap[this.currentFilters.sort] || 'desc';
  }

  async searchAndFilter() {
    this.showLoading();

    try {
      if (this.currentSearch) {
        // Perform search
        const searchResults = await ItemOperations.searchItems(
          this.currentSearch,
          this.buildFirestoreFilters(),
          this.itemsPerPage * 5 // Get more items for client-side pagination
        );
        
        this.allItems = searchResults;
      } else {
        // Regular filter
        await this.fetchItems();
        return; // fetchItems handles display
      }

      // Apply client-side filtering and sorting
      this.filteredItems = this.clientSideFilter(this.allItems);
      this.totalItems = this.filteredItems.length;
      
      // Get items for current page
      const startIndex = (this.currentPage - 1) * this.itemsPerPage;
      const endIndex = startIndex + this.itemsPerPage;
      const pageItems = this.filteredItems.slice(startIndex, endIndex);

      this.displayItems(pageItems);
      this.updatePaginationControls();

    } catch (error) {
      console.error('Error in search and filter:', error);
      showToast('Failed to search items. Please try again.', 'error');
    } finally {
      this.hideLoading();
    }
  }

  clientSideFilter(items) {
    let filtered = [...items];

    // Apply search filter
    if (this.currentSearch) {
      const searchLower = this.currentSearch.toLowerCase();
      filtered = filtered.filter(item => 
        item.title.toLowerCase().includes(searchLower) ||
        item.description.toLowerCase().includes(searchLower) ||
        (item.tags && item.tags.some(tag => tag.toLowerCase().includes(searchLower)))
      );
    }

    // Apply sorting
    const sortField = this.getSortField();
    const sortDirection = this.getSortDirection();

    filtered.sort((a, b) => {
      let aValue = a[sortField];
      let bValue = b[sortField];

      // Handle dates
      if (sortField === 'createdAt') {
        aValue = aValue?.toDate?.() || new Date(aValue);
        bValue = bValue?.toDate?.() || new Date(bValue);
      }

      if (sortDirection === 'asc') {
        return aValue > bValue ? 1 : -1;
      } else {
        return aValue < bValue ? 1 : -1;
      }
    });

    return filtered;
  }

  displayItems(items) {
    const container = document.getElementById('items-container');
    if (!container) return;

    if (items.length === 0) {
      container.innerHTML = this.getNoItemsHTML();
      return;
    }

    container.innerHTML = items.map(item => this.createItemCard(item)).join('');
    
    // Setup lazy loading for images
    setupLazyLoading();
    
    // Update results count
    this.updateResultsCount();
  }

  createItemCard(item) {
    const mainImage = item.images && item.images.length > 0 ? item.images[0] : '/placeholder-image.jpg';
    const currentUser = authManager.getCurrentUser();
    const isOwnItem = currentUser && item.ownerId === currentUser.uid;

    return `
      <div class="card hover-lift group" data-item-id="${item.id}">
        <div class="relative overflow-hidden">
          <img 
            src="${mainImage}" 
            alt="${item.title}"
            class="w-full h-48 object-cover group-hover:scale-105 transition-transform duration-300"
            loading="lazy"
          >
          
          <!-- Condition Badge -->
          <div class="absolute top-2 left-2">
            <span class="badge badge-${item.condition}">
              ${item.condition.charAt(0).toUpperCase() + item.condition.slice(1)}
            </span>
          </div>
          
          <!-- Points Value -->
          <div class="absolute top-2 right-2 bg-eco-green-500 text-white px-2 py-1 rounded-full text-sm font-medium">
            ${item.pointsValue} pts
          </div>
          
          <!-- Quick Actions -->
          <div class="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center space-x-2">
            <button 
              onclick="viewItem('${item.id}')"
              class="bg-white text-gray-800 px-4 py-2 rounded-lg font-medium hover:bg-gray-100 transition-colors"
            >
              View Details
            </button>
            ${!isOwnItem ? `
              <button 
                onclick="quickSwap('${item.id}')"
                class="bg-eco-green-500 text-white px-4 py-2 rounded-lg font-medium hover:bg-eco-green-600 transition-colors"
              >
                Quick Swap
              </button>
            ` : ''}
          </div>
        </div>
        
        <div class="p-4">
          <h3 class="font-semibold text-lg mb-2 line-clamp-2">${item.title}</h3>
          <p class="text-gray-600 text-sm mb-3 line-clamp-2">${item.description}</p>
          
          <div class="flex items-center justify-between mb-3">
            <span class="text-sm text-gray-500">Size: ${item.size.toUpperCase()}</span>
            <span class="text-sm text-gray-500">${formatDate(item.createdAt)}</span>
          </div>
          
          <!-- Tags -->
          ${item.tags && item.tags.length > 0 ? `
            <div class="flex flex-wrap gap-1 mb-3">
              ${item.tags.slice(0, 3).map(tag => `
                <span class="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-full">
                  ${tag}
                </span>
              `).join('')}
              ${item.tags.length > 3 ? `
                <span class="text-xs text-gray-500">+${item.tags.length - 3} more</span>
              ` : ''}
            </div>
          ` : ''}
          
          <!-- Exchange Options -->
          <div class="flex items-center space-x-4 text-sm">
            ${item.allowSwap ? '<span class="text-eco-green-600"><i class="fas fa-exchange-alt mr-1"></i>Swap</span>' : ''}
            ${item.allowRedeem ? '<span class="text-earth-brown-600"><i class="fas fa-coins mr-1"></i>Redeem</span>' : ''}
          </div>
        </div>
      </div>
    `;
  }

  getNoItemsHTML() {
    return `
      <div class="col-span-full text-center py-16">
        <div class="text-6xl mb-4 opacity-50">🔍</div>
        <h3 class="text-xl font-semibold text-gray-800 mb-2">No items found</h3>
        <p class="text-gray-600 mb-6">Try adjusting your search or filters to find more items.</p>
        <button 
          onclick="itemBrowser.clearFilters()"
          class="btn-primary"
        >
          Clear Filters
        </button>
      </div>
    `;
  }

  updateResultsCount() {
    const countElement = document.getElementById('results-count');
    if (countElement) {
      const startIndex = (this.currentPage - 1) * this.itemsPerPage + 1;
      const endIndex = Math.min(this.currentPage * this.itemsPerPage, this.totalItems);
      
      countElement.textContent = this.totalItems > 0 
        ? `Showing ${startIndex}-${endIndex} of ${this.totalItems} items`
        : 'No items found';
    }
  }

  updatePaginationControls() {
    const pagination = document.getElementById('pagination');
    if (!pagination) return;

    const totalPages = Math.ceil(this.totalItems / this.itemsPerPage);
    
    if (totalPages <= 1) {
      pagination.innerHTML = '';
      return;
    }

    let paginationHTML = '';

    // Previous button
    paginationHTML += `
      <button 
        class="pagination-btn ${this.currentPage === 1 ? 'opacity-50 cursor-not-allowed' : ''}" 
        data-page="${this.currentPage - 1}"
        ${this.currentPage === 1 ? 'disabled' : ''}
      >
        <i class="fas fa-chevron-left"></i>
      </button>
    `;

    // Page numbers
    const startPage = Math.max(1, this.currentPage - 2);
    const endPage = Math.min(totalPages, this.currentPage + 2);

    if (startPage > 1) {
      paginationHTML += `<button class="pagination-btn" data-page="1">1</button>`;
      if (startPage > 2) {
        paginationHTML += `<span class="px-2 text-gray-500">...</span>`;
      }
    }

    for (let i = startPage; i <= endPage; i++) {
      paginationHTML += `
        <button 
          class="pagination-btn ${i === this.currentPage ? 'active' : ''}" 
          data-page="${i}"
        >
          ${i}
        </button>
      `;
    }

    if (endPage < totalPages) {
      if (endPage < totalPages - 1) {
        paginationHTML += `<span class="px-2 text-gray-500">...</span>`;
      }
      paginationHTML += `<button class="pagination-btn" data-page="${totalPages}">${totalPages}</button>`;
    }

    // Next button
    paginationHTML += `
      <button 
        class="pagination-btn ${this.currentPage === totalPages ? 'opacity-50 cursor-not-allowed' : ''}" 
        data-page="${this.currentPage + 1}"
        ${this.currentPage === totalPages ? 'disabled' : ''}
      >
        <i class="fas fa-chevron-right"></i>
      </button>
    `;

    pagination.innerHTML = paginationHTML;
  }

  goToPage(page) {
    if (page < 1 || page === this.currentPage || this.isLoading) return;
    
    const totalPages = Math.ceil(this.totalItems / this.itemsPerPage);
    if (page > totalPages) return;

    this.currentPage = page;
    this.updateURL();

    if (this.currentSearch || Object.keys(this.currentFilters).length > 0) {
      // Use filtered items for pagination
      const startIndex = (this.currentPage - 1) * this.itemsPerPage;
      const endIndex = startIndex + this.itemsPerPage;
      const pageItems = this.filteredItems.slice(startIndex, endIndex);
      
      this.displayItems(pageItems);
      this.updatePaginationControls();
    } else {
      // Fetch new page from server
      this.lastDocument = null; // Reset for new page
      this.fetchItems();
    }

    // Scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  resetPagination() {
    this.currentPage = 1;
    this.lastDocument = null;
    this.hasMoreItems = true;
  }

  changeView(view) {
    const container = document.getElementById('items-container');
    if (!container) return;

    if (view === 'list') {
      container.className = 'space-y-4';
      // Update item cards for list view
      // This would require different HTML structure
    } else {
      container.className = 'item-grid';
    }
  }

  setSortOrder(sortBy) {
    this.currentFilters.sort = sortBy;
    this.resetPagination();
    this.searchAndFilter();
  }

  showLoading() {
    this.isLoading = true;
    const container = document.getElementById('items-container');
    if (container) {
      container.innerHTML = this.getLoadingHTML();
    }
  }

  hideLoading() {
    this.isLoading = false;
  }

  getLoadingHTML() {
    return `
      <div class="col-span-full text-center py-16">
        <div class="spinner mx-auto mb-4"></div>
        <p class="text-gray-600">Loading items...</p>
      </div>
    `;
  }

  generateCacheKey() {
    return `${JSON.stringify(this.currentFilters)}_${this.currentSearch}_page_${this.currentPage}`;
  }
}

// Global functions for HTML onclick handlers
window.viewItem = function(itemId) {
  window.location.href = `item.html?id=${itemId}`;
};

window.quickSwap = function(itemId) {
  // Quick swap functionality - could open a modal
  window.location.href = `item.html?id=${itemId}&action=swap`;
};

// Initialize browser when DOM is loaded
let itemBrowser;
document.addEventListener('DOMContentLoaded', () => {
  itemBrowser = new ItemBrowser();
});

// Make it globally accessible
window.itemBrowser = itemBrowser;

export default ItemBrowser;
