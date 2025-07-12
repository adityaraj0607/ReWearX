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
  }

  setupEventListeners() {
    // Mobile filters toggle
    const mobileFilterBtn = document.getElementById('mobile-filter-toggle');
    const filtersPanel = document.getElementById('filters-panel');
    
    if (mobileFilterBtn && filtersPanel) {
      mobileFilterBtn.addEventListener('click', () => {
        filtersPanel.classList.toggle('hidden');
      });
    }

    // View mode toggle
    const gridViewBtn = document.getElementById('grid-view');
    const listViewBtn = document.getElementById('list-view');
    
    if (gridViewBtn && listViewBtn) {
      gridViewBtn.addEventListener('click', () => {
        this.setViewMode('grid');
      });
      
      listViewBtn.addEventListener('click', () => {
        this.setViewMode('list');
      });
    }
  }

  updateFilters() {
    const filterElements = {
      category: 'category-filter',
      type: 'type-filter',
      size: 'size-filter',
      condition: 'condition-filter',
      sort: 'sort-filter'
    };

    this.currentFilters = {};
    
    Object.entries(filterElements).forEach(([key, elementId]) => {
      const element = document.getElementById(elementId);
      if (element && element.value) {
        this.currentFilters[key] = element.value;
      }
    });

    // Update URL
    this.updateURL();
  }

  updateURL() {
    const url = new URL(window.location);
    url.searchParams.delete('category');
    url.searchParams.delete('search');
    url.searchParams.delete('page');

    if (this.currentFilters.category) {
      url.searchParams.set('category', this.currentFilters.category);
    }
    
    if (this.currentSearch) {
      url.searchParams.set('search', this.currentSearch);
    }
    
    if (this.currentPage > 1) {
      url.searchParams.set('page', this.currentPage);
    }

    window.history.replaceState({}, '', url);
  }

  clearFilters() {
    this.currentFilters = {};
    this.currentSearch = '';
    
    // Reset form elements
    document.getElementById('search-input').value = '';
    document.getElementById('category-filter').value = '';
    document.getElementById('type-filter').value = '';
    document.getElementById('size-filter').value = '';
    document.getElementById('condition-filter').value = '';
    
    this.resetPagination();
    this.updateURL();
    this.searchAndFilter();
  }

  resetPagination() {
    this.currentPage = 1;
    this.lastDocument = null;
    this.hasMoreItems = true;
  }

  async loadInitialItems() {
    try {
      this.showLoading();
      
      // Check cache first
      const cachedData = itemsCache.getItems(this.currentFilters, this.currentPage);
      
      if (cachedData && cachedData.items && cachedData.items.length > 0) {
        this.allItems = cachedData.items;
        this.displayItems(this.allItems);
        this.updatePagination();
      } else {
        // Fetch from Firestore
        await this.fetchItems();
      }
    } catch (error) {
      showToast('Failed to load items. Please try again.', 'error');
    } finally {
      this.hideLoading();
    }
  }

  async fetchItems() {
    const filters = this.buildFirestoreFilters();
    const sortField = this.getSortField();
    const sortDirection = this.getSortDirection();

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
  }

  buildFirestoreFilters() {
    const filters = [
      { field: 'status', operator: '==', value: 'available' }
    ];

    if (this.currentFilters.category) {
      filters.push({
        field: 'category',
        operator: '==',
        value: this.currentFilters.category
      });
    }

    if (this.currentFilters.type) {
      filters.push({
        field: 'type',
        operator: '==',
        value: this.currentFilters.type
      });
    }

    if (this.currentFilters.size) {
      filters.push({
        field: 'size',
        operator: '==',
        value: this.currentFilters.size
      });
    }

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
    const sortValue = this.currentFilters.sort || 'recent';
    const sortMap = {
      recent: 'createdAt',
      popular: 'views',
      'price-low': 'pointsValue',
      'price-high': 'pointsValue',
      alphabetical: 'title'
    };
    return sortMap[sortValue] || 'createdAt';
  }

  getSortDirection() {
    const sortValue = this.currentFilters.sort || 'recent';
    return sortValue === 'price-low' || sortValue === 'alphabetical' ? 'asc' : 'desc';
  }

  async searchAndFilter() {
    try {
      this.showLoading();
      
      // If search term exists, use client-side filtering
      if (this.currentSearch) {
        await this.searchItems();
      } else {
        // Use Firestore filters only
        await this.fetchItems();
      }

      // Apply client-side filters
      this.filteredItems = this.clientSideFilter(this.allItems);
      
      // Calculate pagination
      this.totalItems = this.filteredItems.length;
      const totalPages = Math.ceil(this.totalItems / this.itemsPerPage);
      
      if (this.currentPage > totalPages && totalPages > 0) {
        this.currentPage = totalPages;
      }

      // Get current page items
      const startIndex = (this.currentPage - 1) * this.itemsPerPage;
      const endIndex = startIndex + this.itemsPerPage;
      const pageItems = this.filteredItems.slice(startIndex, endIndex);

      this.displayItems(pageItems);
      this.updatePaginationControls();

    } catch (error) {
      showToast('Failed to search items. Please try again.', 'error');
    } finally {
      this.hideLoading();
    }
  }

  clientSideFilter(items) {
    let filtered = [...items];

    // Apply search filter
    if (this.currentSearch) {
      const searchTerm = this.currentSearch.toLowerCase();
      filtered = filtered.filter(item => 
        item.title.toLowerCase().includes(searchTerm) ||
        item.description.toLowerCase().includes(searchTerm) ||
        item.category.toLowerCase().includes(searchTerm)
      );
    }

    return filtered;
  }

  async searchItems() {
    if (!this.currentSearch) {
      await this.fetchItems();
      return;
    }

    // Search using Firestore text search or fetch all and filter
    await this.fetchItems();
  }

  displayItems(items) {
    const container = document.getElementById('items-container');
    if (!container) {
      return;
    }

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
    const isOwner = authManager.currentUser && authManager.currentUser.uid === item.userId;
    
    return `
      <div class="bg-white rounded-xl shadow-lg overflow-hidden hover:shadow-xl transition-shadow duration-300 group">
        <div class="relative overflow-hidden">
          <img 
            src="${item.imageUrl || '/api/placeholder/300/300'}"
            alt="${item.title}"
            class="w-full h-48 object-cover group-hover:scale-105 transition-transform duration-300"
            loading="lazy"
          >
          <div class="absolute top-2 right-2">
            <span class="bg-green-600 text-white px-2 py-1 rounded-full text-xs font-medium">
              ${item.pointsValue} pts
            </span>
          </div>
          ${isOwner ? '<div class="absolute top-2 left-2"><span class="bg-blue-600 text-white px-2 py-1 rounded-full text-xs">Your Item</span></div>' : ''}
        </div>
        
        <div class="p-4">
          <h3 class="font-semibold text-gray-900 mb-2 line-clamp-2">${item.title}</h3>
          
          <div class="flex items-center justify-between mb-2">
            <span class="text-sm text-gray-600 capitalize">${item.category}</span>
            <span class="text-sm text-gray-600 capitalize">${item.condition}</span>
          </div>
          
          <p class="text-gray-600 text-sm mb-3 line-clamp-2">${item.description}</p>
          
          <div class="flex items-center justify-between">
            <div class="flex items-center space-x-2">
              <img 
                src="${item.userPhoto || '/api/placeholder/24/24'}"
                alt="${item.userName}"
                class="w-6 h-6 rounded-full"
              >
              <span class="text-sm text-gray-600">${item.userName}</span>
            </div>
            
            <div class="text-xs text-gray-500">
              ${formatDate(item.createdAt)}
            </div>
          </div>
          
          <div class="mt-4">
            <a 
              href="item.html?id=${item.id}"
              class="block w-full bg-green-600 hover:bg-green-700 text-white text-center py-2 px-4 rounded-lg transition-colors duration-200 font-medium"
            >
              View Details
            </a>
          </div>
        </div>
      </div>
    `;
  }

  getNoItemsHTML() {
    return `
      <div class="col-span-full flex flex-col items-center justify-center py-12">
        <div class="text-6xl mb-4">♻️</div>
        <h3 class="text-xl font-semibold text-gray-900 mb-2">No items found</h3>
        <p class="text-gray-600 text-center max-w-md">
          Try adjusting your search terms or filters to find more items.
        </p>
        <button 
          onclick="itemBrowser.clearFilters()"
          class="mt-4 bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded-lg transition-colors duration-200"
        >
          Clear Filters
        </button>
      </div>
    `;
  }

  updateResultsCount() {
    const countElement = document.getElementById('results-count');
    if (countElement) {
      const total = this.filteredItems.length;
      const start = (this.currentPage - 1) * this.itemsPerPage + 1;
      const end = Math.min(start + this.itemsPerPage - 1, total);
      
      if (total === 0) {
        countElement.textContent = 'No items found';
      } else {
        countElement.textContent = `Showing ${start}-${end} of ${total} items`;
      }
    }
  }

  updatePagination() {
    this.updatePaginationControls();
    this.updateResultsCount();
  }

  updatePaginationControls() {
    const pagination = document.getElementById('pagination');
    if (!pagination) {
      return;
    }

    const totalPages = Math.ceil(this.filteredItems.length / this.itemsPerPage);
    
    if (totalPages <= 1) {
      pagination.innerHTML = '';
      return;
    }

    let paginationHTML = '';
    
    // Previous button
    if (this.currentPage > 1) {
      paginationHTML += `<button class="pagination-btn" data-page="${this.currentPage - 1}">Previous</button>`;
    }

    // Page numbers
    const startPage = Math.max(1, this.currentPage - 2);
    const endPage = Math.min(totalPages, this.currentPage + 2);

    if (startPage > 1) {
      paginationHTML += '<button class="pagination-btn" data-page="1">1</button>';
      if (startPage > 2) {
        paginationHTML += '<span class="px-2 text-gray-500">...</span>';
      }
    }

    for (let i = startPage; i <= endPage; i++) {
      const isActive = i === this.currentPage;
      paginationHTML += `
        <button class="pagination-btn ${isActive ? 'active' : ''}" data-page="${i}">
          ${i}
        </button>
      `;
    }

    if (endPage < totalPages) {
      if (endPage < totalPages - 1) {
        paginationHTML += '<span class="px-2 text-gray-500">...</span>';
      }
      paginationHTML += `<button class="pagination-btn" data-page="${totalPages}">${totalPages}</button>`;
    }

    // Next button
    if (this.currentPage < totalPages) {
      paginationHTML += `<button class="pagination-btn" data-page="${this.currentPage + 1}">Next</button>`;
    }

    pagination.innerHTML = paginationHTML;

    // Add event listeners to pagination buttons
    pagination.querySelectorAll('.pagination-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const page = parseInt(e.target.dataset.page);
        this.goToPage(page);
      });
    });
  }

  goToPage(page) {
    const totalPages = Math.ceil(this.filteredItems.length / this.itemsPerPage);
    
    if (page < 1 || page === this.currentPage || this.isLoading) {
      return;
    }
    
    if (page > totalPages) {
      return;
    }

    this.currentPage = page;
    this.updateURL();
    
    // Scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' });
    
    // Display items for current page
    const startIndex = (this.currentPage - 1) * this.itemsPerPage;
    const endIndex = startIndex + this.itemsPerPage;
    const pageItems = this.filteredItems.slice(startIndex, endIndex);
    
    this.displayItems(pageItems);
    this.updatePaginationControls();
  }

  setViewMode(mode) {
    const container = document.getElementById('items-container');
    if (!container) {
      return;
    }

    if (mode === 'list') {
      container.classList.remove('grid-cols-1', 'md:grid-cols-2', 'lg:grid-cols-3', 'xl:grid-cols-4');
      container.classList.add('grid-cols-1');
    } else {
      container.classList.remove('grid-cols-1');
      container.classList.add('grid-cols-1', 'md:grid-cols-2', 'lg:grid-cols-3', 'xl:grid-cols-4');
    }

    // Update button states
    document.getElementById('grid-view')?.classList.toggle('active', mode === 'grid');
    document.getElementById('list-view')?.classList.toggle('active', mode === 'list');
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
      <div class="col-span-full flex items-center justify-center py-12">
        <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600"></div>
        <span class="ml-3 text-gray-600">Loading items...</span>
      </div>
    `;
  }

  // Infinite scroll (optional)
  setupInfiniteScroll() {
    window.addEventListener('scroll', () => {
      if (this.isLoading || !this.hasMoreItems) {
        return;
      }

      const scrollPosition = window.innerHeight + window.scrollY;
      const threshold = document.body.offsetHeight - 1000;

      if (scrollPosition >= threshold) {
        this.loadMoreItems();
      }
    });
  }

  async loadMoreItems() {
    if (this.isLoading || !this.hasMoreItems) {
      return;
    }

    try {
      this.isLoading = true;
      
      const moreItems = await this.fetchItems();
      this.allItems = [...this.allItems, ...moreItems];
      
      // Re-apply filters
      this.filteredItems = this.clientSideFilter(this.allItems);
      
      // Display updated items
      this.displayItems(this.filteredItems);
      
    } catch (error) {
      showToast('Failed to load more items', 'error');
    } finally {
      this.isLoading = false;
    }
  }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  window.itemBrowser = new ItemBrowser();
});

export default ItemBrowser;
