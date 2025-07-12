// Caching System for Better Performance
class CacheManager {
  constructor() {
    this.cache = new Map();
    this.expirationTimes = new Map();
    this.defaultTTL = 5 * 60 * 1000; // 5 minutes default TTL
  }

  // Set item in cache with TTL
  set(key, value, ttl = this.defaultTTL) {
    const expirationTime = Date.now() + ttl;
    this.cache.set(key, value);
    this.expirationTimes.set(key, expirationTime);
    
    // Store in localStorage for persistence
    try {
      const cacheData = {
        value,
        expirationTime,
        timestamp: Date.now()
      };
      localStorage.setItem(`cache_${key}`, JSON.stringify(cacheData));
    } catch (error) {
      console.warn('Failed to store in localStorage:', error);
    }
  }

  // Get item from cache
  get(key) {
    // Check memory cache first
    if (this.cache.has(key)) {
      const expirationTime = this.expirationTimes.get(key);
      if (Date.now() < expirationTime) {
        return this.cache.get(key);
      } else {
        // Expired, remove from cache
        this.delete(key);
      }
    }

    // Check localStorage
    try {
      const cached = localStorage.getItem(`cache_${key}`);
      if (cached) {
        const cacheData = JSON.parse(cached);
        if (Date.now() < cacheData.expirationTime) {
          // Restore to memory cache
          this.cache.set(key, cacheData.value);
          this.expirationTimes.set(key, cacheData.expirationTime);
          return cacheData.value;
        } else {
          // Expired, remove from localStorage
          localStorage.removeItem(`cache_${key}`);
        }
      }
    } catch (error) {
      console.warn('Failed to retrieve from localStorage:', error);
    }

    return null;
  }

  // Check if key exists and is not expired
  has(key) {
    return this.get(key) !== null;
  }

  // Delete item from cache
  delete(key) {
    this.cache.delete(key);
    this.expirationTimes.delete(key);
    localStorage.removeItem(`cache_${key}`);
  }

  // Clear all cache
  clear() {
    this.cache.clear();
    this.expirationTimes.clear();
    
    // Clear localStorage cache items
    const keysToRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('cache_')) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach(key => localStorage.removeItem(key));
  }

  // Clean expired items
  cleanup() {
    const now = Date.now();
    const expiredKeys = [];

    this.expirationTimes.forEach((expirationTime, key) => {
      if (now >= expirationTime) {
        expiredKeys.push(key);
      }
    });

    expiredKeys.forEach(key => this.delete(key));
  }

  // Get cache statistics
  getStats() {
    return {
      size: this.cache.size,
      memoryUsage: JSON.stringify([...this.cache.entries()]).length,
      oldestEntry: Math.min(...this.expirationTimes.values())
    };
  }
}

// Specific cache implementations
class ItemsCache extends CacheManager {
  constructor() {
    super();
    this.itemTTL = 10 * 60 * 1000; // 10 minutes for items
    this.searchTTL = 5 * 60 * 1000; // 5 minutes for search results
  }

  // Cache items list
  setItems(filters, items, page = 1) {
    const key = this.generateItemsKey(filters, page);
    this.set(key, items, this.itemTTL);
  }

  getItems(filters, page = 1) {
    const key = this.generateItemsKey(filters, page);
    return this.get(key);
  }

  // Cache individual item
  setItem(itemId, item) {
    this.set(`item_${itemId}`, item, this.itemTTL);
  }

  getItem(itemId) {
    return this.get(`item_${itemId}`);
  }

  // Cache search results
  setSearchResults(query, filters, results) {
    const key = this.generateSearchKey(query, filters);
    this.set(key, results, this.searchTTL);
  }

  getSearchResults(query, filters) {
    const key = this.generateSearchKey(query, filters);
    return this.get(key);
  }

  // Helper methods
  generateItemsKey(filters, page) {
    const filterString = JSON.stringify(filters);
    return `items_${btoa(filterString)}_page_${page}`;
  }

  generateSearchKey(query, filters) {
    const searchString = `${query}_${JSON.stringify(filters)}`;
    return `search_${btoa(searchString)}`;
  }

  // Invalidate items cache when item is updated
  invalidateItem(itemId) {
    this.delete(`item_${itemId}`);
    // Also clear items lists that might contain this item
    this.clearItemsLists();
  }

  clearItemsLists() {
    const keysToRemove = [];
    this.cache.forEach((value, key) => {
      if (key.startsWith('items_') || key.startsWith('search_')) {
        keysToRemove.push(key);
      }
    });
    keysToRemove.forEach(key => this.delete(key));
  }
}

class UserCache extends CacheManager {
  constructor() {
    super();
    this.userTTL = 15 * 60 * 1000; // 15 minutes for user data
  }

  setUser(userId, userData) {
    this.set(`user_${userId}`, userData, this.userTTL);
  }

  getUser(userId) {
    return this.get(`user_${userId}`);
  }

  setUserItems(userId, items) {
    this.set(`user_items_${userId}`, items, this.userTTL);
  }

  getUserItems(userId) {
    return this.get(`user_items_${userId}`);
  }

  setUserRequests(userId, requests) {
    this.set(`user_requests_${userId}`, requests, this.userTTL);
  }

  getUserRequests(userId) {
    return this.get(`user_requests_${userId}`);
  }

  invalidateUser(userId) {
    this.delete(`user_${userId}`);
    this.delete(`user_items_${userId}`);
    this.delete(`user_requests_${userId}`);
  }
}

class AppCache extends CacheManager {
  constructor() {
    super();
    this.configTTL = 60 * 60 * 1000; // 1 hour for app config
  }

  setCategories(categories) {
    this.set('categories', categories, this.configTTL);
  }

  getCategories() {
    return this.get('categories');
  }

  setSizes(sizes) {
    this.set('sizes', sizes, this.configTTL);
  }

  getSizes() {
    return this.get('sizes');
  }

  setConditions(conditions) {
    this.set('conditions', conditions, this.configTTL);
  }

  getConditions() {
    return this.get('conditions');
  }

  setStats(stats) {
    this.set('app_stats', stats, this.configTTL);
  }

  getStats() {
    return this.get('app_stats');
  }
}

// Create singleton instances
export const itemsCache = new ItemsCache();
export const userCache = new UserCache();
export const appCache = new AppCache();

// Cache with Firestore integration
export class CachedFirestoreOperations {
  static async getWithCache(cacheManager, cacheKey, firestoreOperation, ttl = null) {
    // Try to get from cache first
    const cached = cacheManager.get(cacheKey);
    if (cached) {
      return cached;
    }

    // If not in cache, fetch from Firestore
    try {
      const data = await firestoreOperation();
      cacheManager.set(cacheKey, data, ttl);
      return data;
    } catch (error) {
      console.error('Error fetching data:', error);
      throw error;
    }
  }

  static async invalidateCache(cacheManager, pattern) {
    if (typeof pattern === 'string') {
      cacheManager.delete(pattern);
    } else if (pattern instanceof RegExp) {
      const keysToRemove = [];
      cacheManager.cache.forEach((value, key) => {
        if (pattern.test(key)) {
          keysToRemove.push(key);
        }
      });
      keysToRemove.forEach(key => cacheManager.delete(key));
    }
  }
}

// Service Worker for offline caching (optional)
export function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js')
        .then((registration) => {
          console.log('SW registered: ', registration);
        })
        .catch((registrationError) => {
          console.log('SW registration failed: ', registrationError);
        });
    });
  }
}

// IndexedDB for large data caching
class IndexedDBCache {
  constructor(dbName = 'ReWearXCache', version = 1) {
    this.dbName = dbName;
    this.version = version;
    this.db = null;
  }

  async init() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.version);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve(this.db);
      };

      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains('cache')) {
          const store = db.createObjectStore('cache', { keyPath: 'key' });
          store.createIndex('expiration', 'expiration', { unique: false });
        }
      };
    });
  }

  async set(key, value, ttl = 24 * 60 * 60 * 1000) { // 24 hours default
    if (!this.db) await this.init();

    const transaction = this.db.transaction(['cache'], 'readwrite');
    const store = transaction.objectStore('cache');
    
    const data = {
      key,
      value,
      expiration: Date.now() + ttl,
      created: Date.now()
    };

    return new Promise((resolve, reject) => {
      const request = store.put(data);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async get(key) {
    if (!this.db) await this.init();

    const transaction = this.db.transaction(['cache'], 'readonly');
    const store = transaction.objectStore('cache');

    return new Promise((resolve, reject) => {
      const request = store.get(key);
      request.onsuccess = () => {
        const result = request.result;
        if (result && Date.now() < result.expiration) {
          resolve(result.value);
        } else {
          if (result) {
            // Remove expired item
            this.delete(key);
          }
          resolve(null);
        }
      };
      request.onerror = () => reject(request.error);
    });
  }

  async delete(key) {
    if (!this.db) await this.init();

    const transaction = this.db.transaction(['cache'], 'readwrite');
    const store = transaction.objectStore('cache');

    return new Promise((resolve, reject) => {
      const request = store.delete(key);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async cleanup() {
    if (!this.db) await this.init();

    const transaction = this.db.transaction(['cache'], 'readwrite');
    const store = transaction.objectStore('cache');
    const index = store.index('expiration');

    const now = Date.now();
    const range = IDBKeyRange.upperBound(now);

    return new Promise((resolve, reject) => {
      const request = index.openCursor(range);
      request.onsuccess = (event) => {
        const cursor = event.target.result;
        if (cursor) {
          cursor.delete();
          cursor.continue();
        } else {
          resolve();
        }
      };
      request.onerror = () => reject(request.error);
    });
  }
}

export const indexedDBCache = new IndexedDBCache();

// Auto cleanup every 30 minutes
setInterval(() => {
  itemsCache.cleanup();
  userCache.cleanup();
  appCache.cleanup();
  indexedDBCache.cleanup();
}, 30 * 60 * 1000);
