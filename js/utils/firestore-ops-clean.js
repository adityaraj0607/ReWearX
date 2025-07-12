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
  static async getPaginated(collectionName, pageSize = 12, lastDoc = null, conditions = [], orderByField = { field: 'createdAt', direction: 'desc' }) {
    let q = collection(db, collectionName);
    
    // Apply conditions
    conditions.forEach(condition => {
      q = query(q, where(condition.field, condition.operator, condition.value));
    });
    
    // Apply ordering
    q = query(q, orderBy(orderByField.field, orderByField.direction));
    
    // Apply pagination
    q = query(q, limit(pageSize));
    if (lastDoc) {
      q = query(q, startAfter(lastDoc));
    }
    
    const querySnapshot = await getDocs(q);
    const docs = querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    
    return {
      docs,
      lastDoc: querySnapshot.docs[querySnapshot.docs.length - 1],
      hasMore: querySnapshot.docs.length === pageSize
    };
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

export default FirestoreOperations;
