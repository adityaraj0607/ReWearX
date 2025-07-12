// Firestore Database Operations
import { db } from '../firebase-config.js';
import { 
  collection, 
  doc, 
  addDoc, 
  getDoc, 
  getDocs, 
  updateDoc, 
  deleteDoc, 
  query, 
  where, 
  orderBy, 
  limit, 
  startAfter,
  onSnapshot,
  serverTimestamp,
  increment
} from 'firebase/firestore';

export class FirestoreOperations {
  // Generic CRUD operations
  
  // Create document
  static async create(collectionName, data) {
    const docRef = await addDoc(collection(db, collectionName), {
      ...data,
      createdAt: serverTimestamp()
    });
    return docRef.id;
  }

  // Read document by ID
  static async read(collectionName, docId) {
    const docRef = doc(db, collectionName, docId);
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
      return { id: docSnap.id, ...docSnap.data() };
    } else {
      return null;
    }
  }

  // Update document
  static async update(collectionName, docId, data) {
    const docRef = doc(db, collectionName, docId);
    await updateDoc(docRef, {
      ...data,
      updatedAt: serverTimestamp()
    });
  }

  // Delete document
  static async delete(collectionName, docId) {
    const docRef = doc(db, collectionName, docId);
    await deleteDoc(docRef);
  }

  // Query documents with conditions
  static async query(collectionName, conditions = [], orderByField = null, limitCount = null) {
    let q = collection(db, collectionName);
    
    // Apply where conditions
    conditions.forEach(condition => {
      q = query(q, where(condition.field, condition.operator, condition.value));
    });
    
    // Apply ordering
    if (orderByField) {
      q = query(q, orderBy(orderByField.field, orderByField.direction || 'asc'));
    }
    
    // Apply limit
    if (limitCount) {
      q = query(q, limit(limitCount));
    }
    
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
  }

  // Real-time listener
  static listenToCollection(collectionName, conditions = [], callback, orderByField = null) {
    let q = collection(db, collectionName);
    
    // Apply conditions
    conditions.forEach(condition => {
      q = query(q, where(condition.field, condition.operator, condition.value));
    });
    
    // Apply ordering
    if (orderByField) {
      q = query(q, orderBy(orderByField.field, orderByField.direction || 'asc'));
    }
    
    return onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      callback(docs);
    });
  }

  // Paginated query
  static async getPaginated(collectionName, limitCount, lastDocument = null, conditions = [], orderByField = null) {
    try {
      let q = collection(db, collectionName);
      
      // Apply where conditions
      conditions.forEach(condition => {
        q = query(q, where(condition.field, condition.operator, condition.value));
      });
      
      // Apply ordering
      if (orderByField) {
        q = query(q, orderBy(orderByField.field, orderByField.direction || 'asc'));
      } else {
        // Default sorting by createdAt desc if no sorting specified
        q = query(q, orderBy('createdAt', 'desc'));
      }
      
      // Apply pagination
      if (lastDocument) {
        q = query(q, startAfter(lastDocument));
      }
      
      // Apply limit
      q = query(q, limit(limitCount));
      
      const querySnapshot = await getDocs(q);
      
      const docs = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      // Check if there are more documents
      let hasMore = docs.length === limitCount;
      
      // Return the documents, the last document for pagination, and hasMore flag
      return {
        docs,
        lastDoc: docs.length > 0 ? querySnapshot.docs[querySnapshot.docs.length - 1] : null,
        hasMore
      };
    } catch (error) {
      console.error('Error in getPaginated:', error);
      throw error;
    }
  }

  // Update user points
  static async updateUserPoints(userId, pointsToAdd) {
    await this.update('users', userId, {
      points: increment(pointsToAdd),
      totalPoints: increment(pointsToAdd)
    });
  }

  // User operations
  static async createUser(userId, userData) {
    const docRef = doc(db, 'users', userId);
    await updateDoc(docRef, {
      ...userData,
      points: 0,
      totalPoints: 0,
      level: 1,
      joinedAt: serverTimestamp(),
      isActive: true
    });
  }

  static async getUserByEmail(email) {
    const users = await this.query('users', [
      { field: 'email', operator: '==', value: email }
    ]);
    return users.length > 0 ? users[0] : null;
  }

  static async updateUserProfile(userId, updates) {
    await this.update('users', userId, updates);
  }

  // Item operations
  static async searchItems(searchTerm, filters = []) {
    const items = await this.query('items', [
      { field: 'status', operator: '==', value: 'available' },
      ...filters
    ], { field: 'createdAt', direction: 'desc' });

    if (!searchTerm) {
      return items;
    }

    // Simple text search (for production, consider using Algolia or similar)
    const searchLower = searchTerm.toLowerCase();
    return items.filter(item => 
      item.title.toLowerCase().includes(searchLower) ||
      item.description.toLowerCase().includes(searchLower) ||
      (item.tags && item.tags.some(tag => tag.toLowerCase().includes(searchLower)))
    );
  }

  static async getItemsByUser(userId) {
    return await this.query('items', [
      { field: 'userId', operator: '==', value: userId }
    ], { field: 'createdAt', direction: 'desc' });
  }

  static async getItemsByCategory(category) {
    return await this.query('items', [
      { field: 'category', operator: '==', value: category },
      { field: 'status', operator: '==', value: 'available' }
    ], { field: 'createdAt', direction: 'desc' });
  }

  static async getFeaturedItems(limitCount = 6) {
    return await this.query('items', [
      { field: 'featured', operator: '==', value: true },
      { field: 'status', operator: '==', value: 'available' }
    ], { field: 'createdAt', direction: 'desc' }, limitCount);
  }

  static async getRecentItems(limitCount = 12) {
    return await this.query('items', [
      { field: 'status', operator: '==', value: 'available' }
    ], { field: 'createdAt', direction: 'desc' }, limitCount);
  }

  static async updateItemStatus(itemId, status) {
    await this.update('items', itemId, { status });
  }

  // Statistics
  static async getTotalCounts() {
    const [users, items, swaps] = await Promise.all([
      this.query('users', [{ field: 'isActive', operator: '==', value: true }]),
      this.query('items', []),
      this.query('swapRequests', [{ field: 'status', operator: '==', value: 'completed' }])
    ]);

    return {
      users: users.length,
      items: items.length,
      swaps: swaps.length
    };
  }

  static async getTopCategories(limitCount = 5) {
    const items = await this.query('items', [
      { field: 'status', operator: '==', value: 'available' }
    ]);

    const categoryCount = {};
    items.forEach(item => {
      categoryCount[item.category] = (categoryCount[item.category] || 0) + 1;
    });

    return Object.entries(categoryCount)
      .sort(([,a], [,b]) => b - a)
      .slice(0, limitCount)
      .map(([category, count]) => ({ category, count }));
  }

  static async getUserLeaderboard(limitCount = 10) {
    return await this.query('users', [
      { field: 'isActive', operator: '==', value: true }
    ], { field: 'points', direction: 'desc' }, limitCount);
  }

  // Admin operations
  static async getPendingItems() {
    return await this.query('items', [
      { field: 'status', operator: '==', value: 'pending' }
    ], { field: 'createdAt', direction: 'asc' });
  }

  static async getReportedItems() {
    return await this.query('items', [
      { field: 'reported', operator: '==', value: true }
    ], { field: 'reportedAt', direction: 'desc' });
  }

  static async getAllUsers() {
    return await this.query('users', [], { field: 'joinedAt', direction: 'desc' });
  }

  static async approveItem(itemId) {
    await this.update('items', itemId, {
      status: 'available',
      approvedAt: serverTimestamp()
    });
  }

  static async rejectItem(itemId, reason = '') {
    await this.update('items', itemId, {
      status: 'rejected',
      rejectedAt: serverTimestamp(),
      rejectionReason: reason
    });
  }

  static async suspendUser(userId) {
    await this.update('users', userId, {
      isActive: false,
      suspendedAt: serverTimestamp()
    });
  }

  static async reactivateUser(userId) {
    await this.update('users', userId, {
      isActive: true,
      reactivatedAt: serverTimestamp()
    });
  }

  static async getAdminStats() {
    const [totalUsers, activeUsers, totalItems, pendingItems, reportedItems, totalSwaps] = await Promise.all([
      this.query('users', []),
      this.query('users', [{ field: 'isActive', operator: '==', value: true }]),
      this.query('items', []),
      this.query('items', [{ field: 'status', operator: '==', value: 'pending' }]),
      this.query('items', [{ field: 'reported', operator: '==', value: true }]),
      this.query('swapRequests', [{ field: 'status', operator: '==', value: 'completed' }])
    ]);

    return {
      totalUsers: totalUsers.length,
      activeUsers: activeUsers.length,
      totalItems: totalItems.length,
      pendingItems: pendingItems.length,
      reportedItems: reportedItems.length,
      totalSwaps: totalSwaps.length
    };
  }

  static async getCategoryStats() {
    const items = await this.query('items', []);
    const stats = {};
    
    items.forEach(item => {
      if (!stats[item.category]) {
        stats[item.category] = { total: 0, available: 0, swapped: 0 };
      }
      stats[item.category].total++;
      if (item.status === 'available') {
        stats[item.category].available++;
      }
      if (item.status === 'swapped') {
        stats[item.category].swapped++;
      }
    });

    return stats;
  }

  static async searchUsers(searchTerm) {
    const users = await this.getAllUsers();
    if (!searchTerm) {
      return users;
    }

    const searchLower = searchTerm.toLowerCase();
    return users.filter(user => 
      user.displayName?.toLowerCase().includes(searchLower) ||
      user.email?.toLowerCase().includes(searchLower)
    );
  }

  static async updateUserStatus(userId, isActive) {
    await this.update('users', userId, { 
      isActive,
      statusUpdatedAt: serverTimestamp()
    });
  }

  // Item interactions
  static async incrementItemViews(itemId) {
    await this.update('items', itemId, {
      views: increment(1)
    });
  }

  static async getSimilarItems(itemId, category, limitCount = 4) {
    const items = await this.query('items', [
      { field: 'category', operator: '==', value: category },
      { field: 'status', operator: '==', value: 'available' }
    ], { field: 'createdAt', direction: 'desc' }, limitCount + 10);

    return items.filter(item => item.id !== itemId).slice(0, limitCount);
  }

  // Swap operations
  static async createSwapRequest(swapData) {
    return await this.create('swapRequests', {
      ...swapData,
      status: 'pending',
      requestedAt: serverTimestamp()
    });
  }

  static async getUserSwapRequests(userId) {
    const [sentRequests, receivedRequests] = await Promise.all([
      this.query('swapRequests', [
        { field: 'requesterId', operator: '==', value: userId }
      ], { field: 'requestedAt', direction: 'desc' }),
      this.query('swapRequests', [
        { field: 'ownerId', operator: '==', value: userId }
      ], { field: 'requestedAt', direction: 'desc' })
    ]);

    return { sentRequests, receivedRequests };
  }

  static async getSwapRequestsByItem(itemId) {
    return await this.query('swapRequests', [
      { field: 'requestedItemId', operator: '==', value: itemId }
    ], { field: 'requestedAt', direction: 'desc' });
  }

  static async redeemItem(itemId, userId, pointsCost) {
    const batch = [
      this.update('items', itemId, {
        status: 'redeemed',
        redeemedBy: userId,
        redeemedAt: serverTimestamp()
      }),
      this.update('users', userId, {
        points: increment(-pointsCost)
      })
    ];

    await Promise.all(batch);
  }

  static async updateSwapRequest(requestId, updates) {
    await this.update('swapRequests', requestId, {
      ...updates,
      updatedAt: serverTimestamp()
    });
  }
}

export class ItemOperations {
  static async createItem(itemData) {
    try {
      return await FirestoreOperations.create('items', itemData);
    } catch (error) {
      throw error;
    }
  }
  
  static async getItem(itemId) {
    try {
      return await FirestoreOperations.read('items', itemId);
    } catch (error) {
      throw error;
    }
  }
  
  static async updateItem(itemId, data) {
    try {
      return await FirestoreOperations.update('items', itemId, data);
    } catch (error) {
      throw error;
    }
  }
  
  static async deleteItem(itemId) {
    try {
      return await FirestoreOperations.delete('items', itemId);
    } catch (error) {
      throw error;
    }
  }
  
  static async getUserItems(userId, status = null) {
    try {
      const conditions = [
        { field: 'uploadedBy', operator: '==', value: userId }
      ];
      
      if (status) {
        conditions.push({ field: 'status', operator: '==', value: status });
      }
      
      return await FirestoreOperations.query('items', conditions, { field: 'createdAt', direction: 'desc' });
    } catch (error) {
      throw error;
    }
  }
  
  static async getAvailableItems(limit = 20) {
    try {
      const conditions = [
        { field: 'status', operator: '==', value: 'available' }
      ];
      
      return await FirestoreOperations.query('items', conditions, { field: 'createdAt', direction: 'desc' }, limit);
    } catch (error) {
      throw error;
    }
  }
}

export async function getUserStats(userId) {
  try {
    // Get user data
    const userDoc = await FirestoreOperations.read('users', userId);
    
    if (!userDoc) {
      // Create user stats if not exists
      const defaultStats = {
        totalItems: 0,
        totalPoints: 0,
        successfulSwaps: 0,
        memberSince: new Date(),
        level: 1,
        pointsToNextLevel: 100
      };
      
      await FirestoreOperations.create('users', {
        id: userId,
        stats: defaultStats
      });
      
      return defaultStats;
    }
    
    return userDoc.stats || {};
  } catch (error) {
    throw error;
  }
}

export async function getSwapRequests(userId) {
  try {
    const conditions = [
      { field: 'receiverId', operator: '==', value: userId },
      { field: 'status', operator: '==', value: 'pending' }
    ];
    
    return await FirestoreOperations.query('swapRequests', conditions, { field: 'createdAt', direction: 'desc' });
  } catch (error) {
    throw error;
  }
}

export async function updateSwapRequest(requestId, status) {
  try {
    return await FirestoreOperations.update('swapRequests', requestId, { status });
  } catch (error) {
    throw error;
  }
}

export async function getLeaderboard(limit = 5) {
  try {
    // Get top users by points
    const users = await FirestoreOperations.query('users', [], { field: 'stats.totalPoints', direction: 'desc' }, limit);
    
    return users.map(user => ({
      id: user.id,
      displayName: user.displayName || 'User',
      photoURL: user.photoURL || null,
      points: user.stats?.totalPoints || 0
    }));
  } catch (error) {
    throw error;
  }
}

export function realTimeListener(collectionName, condition, onUpdate, onError) {
  try {
    const conditions = condition ? [condition] : [];
    
    // Setup real-time listener
    const unsubscribe = FirestoreOperations.listenToCollection(
      collectionName,
      conditions,
      (documents) => {
        onUpdate(documents);
      },
      { field: 'createdAt', direction: 'desc' }
    );
    
    return unsubscribe;
  } catch (error) {
    if (onError) {
      onError(error);
    }
    return () => {}; // Return empty function as fallback
  }
}
