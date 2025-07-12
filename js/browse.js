// Browse Items with Search, Filter, and Pagination
import { FirestoreOperations } from './utils/firestore-ops.js';
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
      
      // Add search button for external search
      const searchButton = document.getElementById('external-search-btn');
      if (searchButton) {
        searchButton.addEventListener('click', () => {
          const query = searchInput.value.trim();
          if (query) {
            this.searchExternalResults(query);
          } else {
            showToast('Please enter a search term', 'warning');
          }
        });
      }
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

  applyFilters() {
    if (Object.keys(this.currentFilters).length > 0 || this.currentSearch) {
      this.searchAndFilter();
    } else {
      this.loadInitialItems();
    }
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
        try {
          await this.fetchItems();
        } catch (firestoreError) {
          // Log Firestore fetch error and fallback to sample items
          this.loadSampleItems();
        }
      }
    } catch (error) {
      // Fallback to sample items if error occurs
      this.loadSampleItems();
      showToast('Using sample items. Could not connect to database.', 'warning');
    } finally {
      this.hideLoading();
    }
  }

  // Fallback method to load sample items if Firestore connection fails
  loadSampleItems() {
    const sampleItems = this.generateSampleItems();
    this.allItems = sampleItems;
    this.filteredItems = sampleItems;
    this.displayItems(sampleItems);
    this.updateResultsCount();
    this.updatePaginationControls();
    
    // Show toast message
    showToast('Using demo data. You\'re viewing sample items.', 'info');
  }

  // Generate sample items as a fallback
  generateSampleItems() {
    const categories = ['tops', 'bottoms', 'dresses', 'outerwear', 'shoes', 'accessories'];
    const conditions = ['excellent', 'good', 'fair'];
    const types = ['mens', 'womens', 'unisex'];
    const sizes = ['xs', 's', 'm', 'l', 'xl'];
    const titles = [
      'Vintage Denim Jacket', 'Cotton T-Shirt', 'Summer Dress', 
      'Leather Boots', 'Wool Sweater', 'Silk Blouse',
      'Casual Jeans', 'Running Shoes', 'Evening Gown',
      'Winter Coat', 'Knit Cardigan', 'Formal Suit'
    ];
    
    return Array.from({ length: 12 }, (_, i) => ({
      id: `sample-${i + 1}`,
      title: titles[i] || `Sample Item ${i + 1}`,
      description: 'This is a sample item description. This item is part of our sustainable fashion collection.',
      category: categories[Math.floor(Math.random() * categories.length)],
      condition: conditions[Math.floor(Math.random() * conditions.length)],
      type: types[Math.floor(Math.random() * types.length)],
      size: sizes[Math.floor(Math.random() * sizes.length)],
      pointsValue: Math.floor(Math.random() * 50) + 20,
      imageUrl: `https://source.unsplash.com/featured/300x400?fashion,clothing&sig=${i}`,
      userId: 'sample-user-id',
      userName: 'Sample User',
      userPhoto: 'https://ui-avatars.com/api/?name=Sample+User&background=22c55e&color=fff',
      createdAt: new Date(Date.now() - Math.floor(Math.random() * 30) * 24 * 60 * 60 * 1000),
      status: 'available'
    }));
  }

  async fetchItems() {
    const filters = this.buildFirestoreFilters();
    const sortField = this.getSortField();
    const sortDirection = this.getSortDirection();

    try {
      const result = await FirestoreOperations.getPaginated(
        'items',
        this.itemsPerPage,
        this.lastDocument,
        filters,
        { field: sortField, direction: sortDirection }
      );

      if (!result || !result.docs) {
        throw new Error('No results returned from Firestore');
      }

      this.allItems = result.docs;
      this.lastDocument = result.lastDoc;
      this.hasMoreItems = result.hasMore;

      // Update filtered items
      this.filteredItems = this.allItems;

      // Cache the results
      const cacheData = {
        items: this.allItems,
        total: this.allItems.length,
        hasMore: this.hasMoreItems
      };
      
      itemsCache.setItems(this.currentFilters, cacheData, this.currentPage);

      this.displayItems(this.allItems);
      this.updatePaginationControls();
      
      return this.allItems;
    } catch (error) {
      // Handle error and rethrow
      throw error;
    }
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

    if (!items || items.length === 0) {
      container.innerHTML = this.getNoItemsHTML();
      // Update results count
      this.updateResultsCount();
      return;
    }

    // Add grid class if not present
    if (!container.classList.contains('grid')) {
      container.classList.add('grid', 'grid-cols-1', 'md:grid-cols-2', 'lg:grid-cols-3', 'xl:grid-cols-4', 'gap-6');
    }

    container.innerHTML = items.map(item => this.createItemCard(item)).join('');
    
    // Setup lazy loading for images
    setupLazyLoading();
    
    // Update results count
    this.updateResultsCount();
  }

  createItemCard(item) {
    if (!item) {
      return '';
    }

    // Check if the user is the owner of the item
    const isOwner = authManager.currentUser && authManager.currentUser.uid === item.userId;
    
    // Format date or provide fallback
    let formattedDate = '';
    try {
      formattedDate = item.createdAt ? formatDate(item.createdAt) : 'Recently added';
    } catch (error) {
      formattedDate = 'Recently added';
    }
    
    return `
      <div class="bg-white rounded-xl shadow-lg overflow-hidden hover:shadow-xl transition-shadow duration-300 group">
        <div class="relative overflow-hidden">
          <img 
            src="${item.imageUrl || 'https://via.placeholder.com/300x300?text=No+Image'}"
            alt="${item.title || 'Item'}"
            class="w-full h-48 object-cover group-hover:scale-105 transition-transform duration-300"
            loading="lazy"
            onerror="this.src='https://via.placeholder.com/300x300?text=Image+Error'"
          >
          <div class="absolute top-2 right-2">
            <span class="bg-green-600 text-white px-2 py-1 rounded-full text-xs font-medium">
              ${item.pointsValue || 0} pts
            </span>
          </div>
          ${isOwner ? '<div class="absolute top-2 left-2"><span class="bg-blue-600 text-white px-2 py-1 rounded-full text-xs">Your Item</span></div>' : ''}
        </div>
        
        <div class="p-4">
          <h3 class="font-semibold text-gray-900 mb-2 line-clamp-2">${item.title || 'Untitled Item'}</h3>
          
          <div class="flex items-center justify-between mb-2">
            <span class="text-sm text-gray-600 capitalize">${item.category || 'Uncategorized'}</span>
            <span class="text-sm text-gray-600 capitalize">${item.condition || 'Unknown'}</span>
          </div>
          
          <p class="text-gray-600 text-sm mb-3 line-clamp-2">${item.description || 'No description available.'}</p>
          
          <div class="flex items-center justify-between">
            <div class="flex items-center space-x-2">
              <img 
                src="${item.userPhoto || 'https://ui-avatars.com/api/?name=User&background=22c55e&color=fff'}"
                alt="${item.userName || 'User'}"
                class="w-6 h-6 rounded-full"
                onerror="this.src='https://ui-avatars.com/api/?name=User&background=22c55e&color=fff'"
              >
              <span class="text-sm text-gray-600">${item.userName || 'Anonymous'}</span>
            </div>
            
            <div class="text-xs text-gray-500">
              ${formattedDate}
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
    const hasSearchTerm = this.currentSearch && this.currentSearch.trim().length > 0;
    
    return `
      <div class="col-span-full flex flex-col items-center justify-center py-12">
        <div class="text-6xl mb-4">♻️</div>
        <h3 class="text-xl font-semibold text-gray-900 mb-2">No items found</h3>
        <p class="text-gray-600 text-center max-w-md mb-4">
          ${hasSearchTerm 
    ? `We couldn't find any items matching "${this.currentSearch}". Try adjusting your search terms or check external sources.` 
    : 'Try adjusting your filters to find more items.'}
        </p>
        <div class="flex flex-wrap gap-4 justify-center">
          <button 
            onclick="itemBrowser.clearFilters()"
            class="bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded-lg transition-colors duration-200"
          >
            Clear Filters
          </button>
          
          ${hasSearchTerm ? `
            <button 
              onclick="itemBrowser.searchExternalResults('${this.currentSearch.replace(/'/g, '\\\'')}')"
              class="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg transition-colors duration-200"
            >
              <i class="fas fa-globe mr-2"></i>Search External Sources
            </button>
          ` : ''}
        </div>
      </div>
    `;
  }

  updateResultsCount() {
    const countElement = document.getElementById('results-count');
    if (countElement) {
      if (!this.filteredItems || this.filteredItems.length === 0) {
        countElement.textContent = 'No items found';
        return;
      }
      
      const total = this.filteredItems.length;
      const start = (this.currentPage - 1) * this.itemsPerPage + 1;
      const end = Math.min(start + this.itemsPerPage - 1, total);
      
      countElement.textContent = `Showing ${start}-${end} of ${total} items`;
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

  async searchExternalResults(query) {
    try {
      this.showLoading();
      
      // Display message that we're searching external sources
      const container = document.getElementById('items-container');
      if (container) {
        container.innerHTML = `
          <div class="col-span-full py-4 text-center">
            <div class="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-emerald-600 mx-auto mb-4"></div>
            <p class="text-gray-600">Searching external sources for "${query}"...</p>
          </div>
        `;
      }
      
      // Get search results from Google Custom Search API
      // Note: In a real implementation, this would be a backend API call with proper API keys
      // For this example, we'll simulate results
      const externalResults = await this.fetchExternalResults(query);
      
      if (externalResults && externalResults.length > 0) {
        this.displayExternalResults(externalResults, query);
      } else {
        // If no external results, show no results message
        if (container) {
          container.innerHTML = `
            <div class="col-span-full flex flex-col items-center justify-center py-12 text-center">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-16 w-16 text-gray-300 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <h3 class="text-lg font-medium text-gray-900 mb-1">No external results found</h3>
              <p class="text-gray-500 mb-4">Try different search terms or check our catalog</p>
              <button id="back-to-catalog" class="inline-flex items-center px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition">
                Back to Catalog
              </button>
            </div>
          `;
          
          // Add event listener to back button
          const backButton = document.getElementById('back-to-catalog');
          if (backButton) {
            backButton.addEventListener('click', () => {
              this.clearFilters();
            });
          }
        }
      }
    } catch (error) {
      // Log external search error
      if (error) {
        showToast('Error searching external sources', 'error');
      }
    } finally {
      this.hideLoading();
    }
  }
  
  async fetchExternalResults(query) {
    // In a real implementation, this would call your backend API
    // which would use a service like Google Custom Search API
    
    // For demonstration purposes, generate simulated external results
    // with links to actual search engines
    
    // Create a Google search URL
    const googleSearchUrl = `https://www.google.com/search?q=${encodeURIComponent(query + ' clothing sustainable')}`;
    
    // Create an eBay search URL
    const ebaySearchUrl = `https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(query + ' clothing')}`;
    
    // Create an Etsy search URL
    const etsySearchUrl = `https://www.etsy.com/search?q=${encodeURIComponent(query + ' clothing')}`;
    
    // Create a ThredUp search URL
    const thredUpSearchUrl = `https://www.thredup.com/products?search_terms=${encodeURIComponent(query)}`;
    
    // Simulate external results with real search links
    return [
      {
        id: 'external-1',
        title: `Find "${query}" on Google`,
        description: 'Search for sustainable clothing options on Google',
        externalUrl: googleSearchUrl,
        imageUrl: 'https://www.google.com/images/branding/googlelogo/1x/googlelogo_color_272x92dp.png',
        source: 'Google'
      },
      {
        id: 'external-2',
        title: `Shop "${query}" on eBay`,
        description: 'Find pre-owned clothing on eBay',
        externalUrl: ebaySearchUrl,
        imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/1b/EBay_logo.svg/220px-EBay_logo.svg.png',
        source: 'eBay'
      },
      {
        id: 'external-3',
        title: `Discover "${query}" on Etsy`,
        description: 'Handmade and vintage clothing on Etsy',
        externalUrl: etsySearchUrl,
        imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/89/Etsy_logo.svg/220px-Etsy_logo.svg.png',
        source: 'Etsy'
      },
      {
        id: 'external-4',
        title: `Shop secondhand "${query}" on ThredUp`,
        description: 'Sustainable secondhand fashion marketplace',
        externalUrl: thredUpSearchUrl,
        imageUrl: 'https://cf-assets.thredup.com/assets/336990/logos/thredup.svg',
        source: 'ThredUp'
      }
    ];
  }
  
  displayExternalResults(results, query) {
    const container = document.getElementById('items-container');
    if (!container) {
      return;
    }
    
    // Update the heading to show we're displaying external results
    const resultsHeading = document.getElementById('results-heading');
    if (resultsHeading) {
      resultsHeading.textContent = `External Search Results for "${query}"`;
    }
    
    // Update the count
    const resultsCount = document.getElementById('results-count');
    if (resultsCount) {
      resultsCount.textContent = `${results.length} external sources found`;
    }
    
    // Clear any grid classes
    container.className = 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6';
    
    // Generate HTML for external results
    container.innerHTML = results.map(result => this.createExternalResultCard(result)).join('') + `
      <div class="col-span-full mt-6 text-center">
        <button id="back-to-catalog" class="inline-flex items-center px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Back to ReWearX Catalog
        </button>
      </div>
    `;
    
    // Add event listener to back button
    const backButton = document.getElementById('back-to-catalog');
    if (backButton) {
      backButton.addEventListener('click', () => {
        this.clearFilters();
      });
    }
  }
  
  createExternalResultCard(result) {
    return `
      <div class="bg-white rounded-xl shadow-lg overflow-hidden hover:shadow-xl transition-shadow duration-300 group">
        <div class="relative overflow-hidden p-4 flex items-center justify-center h-48">
          <img 
            src="${result.imageUrl || 'https://via.placeholder.com/300x100?text=External+Source'}"
            alt="${result.source || 'External Source'}"
            class="max-h-full object-contain"
          >
          <div class="absolute top-2 right-2 bg-blue-100 text-blue-700 px-2 py-1 text-xs rounded-full">
            External Source
          </div>
        </div>
        <div class="p-4">
          <h3 class="text-lg font-medium text-gray-900 mb-1">${result.title || 'External Result'}</h3>
          <p class="text-sm text-gray-500 mb-4">${result.description || 'Find more options outside ReWearX'}</p>
          <a href="${result.externalUrl}" target="_blank" rel="noopener noreferrer" 
             class="block w-full py-2 bg-emerald-600 text-white text-center rounded-lg hover:bg-emerald-700 transition">
            Visit ${result.source || 'Site'}
          </a>
        </div>
      </div>
    `;
  }
}

// Initialize and export
const itemBrowser = new ItemBrowser();
window.itemBrowser = itemBrowser; // For pagination button onclick handlers

export default itemBrowser;
