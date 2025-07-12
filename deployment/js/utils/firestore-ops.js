// Firestore Operations Helper
import { db } from '../firebase-config.js';
import { 
  collection, 
  doc, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  getDoc, 
  getDocs, 
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
    try {
      const docRef = await addDoc(collection(db, collectionName), {
        ...data,
        createdAt: serverTimestamp()
      });
      return docRef.id;
    } catch (error) {
      console.error(`Error creating document in ${collectionName}:`, error);
      throw error;
    }
  }

  // Read document by ID
  static async read(collectionName, docId) {
    try {
      const docRef = doc(db, collectionName, docId);
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        return { id: docSnap.id, ...docSnap.data() };
      } else {
        return null;
      }
    } catch (error) {
      console.error(`Error reading document from ${collectionName}:`, error);
      throw error;
    }
  }

  // Update document
  static async update(collectionName, docId, data) {
    try {
      const docRef = doc(db, collectionName, docId);
      await updateDoc(docRef, {
        ...data,
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      console.error(`Error updating document in ${collectionName}:`, error);
      throw error;
    }
  }

  // Delete document
  static async delete(collectionName, docId) {
    try {
      const docRef = doc(db, collectionName, docId);
      await deleteDoc(docRef);
    } catch (error) {
      console.error(`Error deleting document from ${collectionName}:`, error);
      throw error;
    }
  }

  // Query documents with filters
  static async query(collectionName, filters = [], orderByField = 'createdAt', orderDirection = 'desc', limitCount = null) {
    try {
      let q = collection(db, collectionName);

      // Apply filters
      filters.forEach(filter => {
        q = query(q, where(filter.field, filter.operator, filter.value));
      });

      // Apply ordering
      if (orderByField) {
        q = query(q, orderBy(orderByField, orderDirection));
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
    } catch (error) {
      console.error(`Error querying ${collectionName}:`, error);
      throw error;
    }
  }

  // Real-time listener
  static listen(collectionName, callback, filters = [], orderByField = 'createdAt', orderDirection = 'desc') {
    try {
      let q = collection(db, collectionName);

      // Apply filters
      filters.forEach(filter => {
        q = query(q, where(filter.field, filter.operator, filter.value));
      });

      // Apply ordering
      if (orderByField) {
        q = query(q, orderBy(orderByField, orderDirection));
      }

      const unsubscribe = onSnapshot(q, (querySnapshot) => {
        const docs = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        callback(docs);
      });

      return unsubscribe;
    } catch (error) {
      console.error(`Error setting up listener for ${collectionName}:`, error);
      throw error;
    }
  }

  // Paginated query
  static async getPaginated(collectionName, pageSize = 12, lastDoc = null, filters = [], orderByField = 'createdAt', orderDirection = 'desc') {
    try {
      let q = collection(db, collectionName);

      // Apply filters
      filters.forEach(filter => {
        q = query(q, where(filter.field, filter.operator, filter.value));
      });

      // Apply ordering
      if (orderByField) {
        q = query(q, orderBy(orderByField, orderDirection));
      }

      // Apply pagination
      if (lastDoc) {
        q = query(q, startAfter(lastDoc));
      }
      
      q = query(q, limit(pageSize));

      const querySnapshot = await getDocs(q);
      const docs = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      return {
        docs,
        lastDoc: querySnapshot.docs[querySnapshot.docs.length - 1] || null,
        hasMore: querySnapshot.docs.length === pageSize
      };
    } catch (error) {
      console.error(`Error getting paginated data from ${collectionName}:`, error);
      throw error;
    }
  }
}

// Specific operations for different collections

export class UserOperations extends FirestoreOperations {
  static async getUserByUid(uid) {
    return await this.read('users', uid);
  }

  static async updateUserPoints(uid, pointsChange) {
    try {
      const userRef = doc(db, 'users', uid);
      await updateDoc(userRef, {
        points: increment(pointsChange),
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      console.error('Error updating user points:', error);
      throw error;
    }
  }

  static async getUserItems(uid) {
    return await this.query('items', [
      { field: 'ownerId', operator: '==', value: uid }
    ]);
  }

  static async getUserSwapRequests(uid) {
    const sentRequests = await this.query('swapRequests', [
      { field: 'fromId', operator: '==', value: uid }
    ]);

    const receivedRequests = await this.query('swapRequests', [
      { field: 'toId', operator: '==', value: uid }
    ]);

    return { sentRequests, receivedRequests };
  }
}

export class ItemOperations extends FirestoreOperations {
  static async createItem(itemData) {
    return await this.create('items', itemData);
  }

  static async getAvailableItems(filters = [], pageSize = 12, lastDoc = null) {
    const itemFilters = [
      { field: 'status', operator: '==', value: 'available' },
      ...filters
    ];
    
    return await this.getPaginated('items', pageSize, lastDoc, itemFilters);
  }

  static async searchItems(searchTerm, filters = [], pageSize = 12) {
    // Note: This is a simplified search. For production, use Algolia or similar
    const allFilters = [
      { field: 'status', operator: '==', value: 'available' },
      ...filters
    ];

    const items = await this.query('items', allFilters);
    
    if (!searchTerm) return items;

    // Client-side filtering for search term
    return items.filter(item => 
      item.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (item.tags && item.tags.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase())))
    );
  }

  static async updateItemStatus(itemId, status) {
    await this.update('items', itemId, { status });
  }

  static async getItemsByCategory(category) {
    return await this.query('items', [
      { field: 'category', operator: '==', value: category },
      { field: 'status', operator: '==', value: 'available' }
    ]);
  }

  static async getPendingItems() {
    return await this.query('items', [
      { field: 'status', operator: '==', value: 'pending' }
    ]);
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
}

export class SwapRequestOperations extends FirestoreOperations {
  static async createSwapRequest(requestData) {
    return await this.create('swapRequests', requestData);
  }

  static async acceptSwapRequest(requestId) {
    await this.update('swapRequests', requestId, { 
      status: 'accepted',
      acceptedAt: serverTimestamp()
    });
  }

  static async rejectSwapRequest(requestId) {
    await this.update('swapRequests', requestId, { 
      status: 'rejected',
      rejectedAt: serverTimestamp()
    });
  }

  static async completeSwapRequest(requestId) {
    await this.update('swapRequests', requestId, { 
      status: 'completed',
      completedAt: serverTimestamp()
    });
  }

  static async getUserRequests(uid) {
    const sentRequests = await this.query('swapRequests', [
      { field: 'fromId', operator: '==', value: uid }
    ]);

    const receivedRequests = await this.query('swapRequests', [
      { field: 'toId', operator: '==', value: uid }
    ]);

    return { sent: sentRequests, received: receivedRequests };
  }
}

export class ReportOperations extends FirestoreOperations {
  static async createReport(reportData) {
    return await this.create('reports', reportData);
  }

  static async getReports() {
    return await this.query('reports', [], 'createdAt', 'desc');
  }

  static async updateReportStatus(reportId, status) {
    await this.update('reports', reportId, { status });
  }
}

// Analytics and Statistics
export class AnalyticsOperations extends FirestoreOperations {
  static async getTotalCounts() {
    try {
      const [users, items, swapRequests] = await Promise.all([
        getDocs(collection(db, 'users')),
        getDocs(collection(db, 'items')),
        getDocs(collection(db, 'swapRequests'))
      ]);

      return {
        totalUsers: users.size,
        totalItems: items.size,
        totalSwaps: swapRequests.size,
        activeItems: items.docs.filter(doc => doc.data().status === 'available').length
      };
    } catch (error) {
      console.error('Error getting total counts:', error);
      throw error;
    }
  }

  static async getTopCategories(limit = 5) {
    try {
      const items = await this.query('items', [
        { field: 'status', operator: '==', value: 'available' }
      ]);

      const categoryCount = {};
      items.forEach(item => {
        categoryCount[item.category] = (categoryCount[item.category] || 0) + 1;
      });

      return Object.entries(categoryCount)
        .sort(([,a], [,b]) => b - a)
        .slice(0, limit)
        .map(([category, count]) => ({ category, count }));
    } catch (error) {
      console.error('Error getting top categories:', error);
      throw error;
    }
  }

  static async getUserLeaderboard(limit = 10) {
    try {
      return await this.query('users', [], 'points', 'desc', limit);
    } catch (error) {
      console.error('Error getting user leaderboard:', error);
      throw error;
    }
  }
}

// Admin-specific functions
export async function getPendingItems() {
  try {
    const q = query(
      collection(db, 'items'), 
      where('status', '==', 'pending'),
      orderBy('createdAt', 'desc')
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (error) {
    console.error('Error getting pending items:', error);
    throw error;
  }
}

export async function getReportedItems() {
  try {
    const q = query(
      collection(db, 'items'), 
      where('reportCount', '>', 0),
      orderBy('reportCount', 'desc')
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (error) {
    console.error('Error getting reported items:', error);
    throw error;
  }
}

export async function getAllUsers(limitCount = 50) {
  try {
    const q = query(
      collection(db, 'users'), 
      orderBy('createdAt', 'desc'),
      limit(limitCount)
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (error) {
    console.error('Error getting all users:', error);
    throw error;
  }
}

export async function approveItem(itemId) {
  try {
    const itemRef = doc(db, 'items', itemId);
    await updateDoc(itemRef, {
      status: 'available',
      approvedAt: serverTimestamp(),
      approvedBy: 'admin'
    });
  } catch (error) {
    console.error('Error approving item:', error);
    throw error;
  }
}

export async function rejectItem(itemId, reason = null) {
  try {
    const itemRef = doc(db, 'items', itemId);
    await updateDoc(itemRef, {
      status: 'rejected',
      rejectedAt: serverTimestamp(),
      rejectionReason: reason,
      rejectedBy: 'admin'
    });
  } catch (error) {
    console.error('Error rejecting item:', error);
    throw error;
  }
}

export async function getAdminStats(period = 'all') {
  try {
    // Get total counts
    const [itemsSnapshot, usersSnapshot, requestsSnapshot] = await Promise.all([
      getDocs(collection(db, 'items')),
      getDocs(collection(db, 'users')),
      getDocs(collection(db, 'swapRequests'))
    ]);

    const totalItems = itemsSnapshot.size;
    const totalUsers = usersSnapshot.size;
    const totalRequests = requestsSnapshot.size;

    // Count pending and reported items
    const pendingItems = itemsSnapshot.docs.filter(doc => doc.data().status === 'pending').length;
    const reportedItems = itemsSnapshot.docs.filter(doc => (doc.data().reportCount || 0) > 0).length;

    const stats = {
      totalItems,
      totalUsers,
      totalRequests,
      pendingItems,
      reportedItems
    };

    // Add weekly stats if requested
    if (period === 'weekly') {
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);

      const itemsThisWeek = itemsSnapshot.docs.filter(doc => {
        const createdAt = doc.data().createdAt?.toDate();
        return createdAt && createdAt > weekAgo;
      }).length;

      const usersThisWeek = usersSnapshot.docs.filter(doc => {
        const createdAt = doc.data().createdAt?.toDate();
        return createdAt && createdAt > weekAgo;
      }).length;

      const exchangesThisWeek = requestsSnapshot.docs.filter(doc => {
        const createdAt = doc.data().createdAt?.toDate();
        const status = doc.data().status;
        return createdAt && createdAt > weekAgo && (status === 'completed' || status === 'accepted');
      }).length;

      stats.itemsThisWeek = itemsThisWeek;
      stats.usersThisWeek = usersThisWeek;
      stats.exchangesThisWeek = exchangesThisWeek;
    }

    return stats;
  } catch (error) {
    console.error('Error getting admin stats:', error);
    throw error;
  }
}

export async function getCategoryStats() {
  try {
    const snapshot = await getDocs(collection(db, 'items'));
    const categoryCount = {};

    snapshot.docs.forEach(doc => {
      const category = doc.data().category || 'Uncategorized';
      categoryCount[category] = (categoryCount[category] || 0) + 1;
    });

    return Object.entries(categoryCount)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
  } catch (error) {
    console.error('Error getting category stats:', error);
    throw error;
  }
}

export async function searchUsers(searchQuery) {
  try {
    // Simple search by name or email (case-insensitive)
    const snapshot = await getDocs(collection(db, 'users'));
    const searchLower = searchQuery.toLowerCase();
    
    return snapshot.docs
      .filter(doc => {
        const data = doc.data();
        const name = (data.name || '').toLowerCase();
        const email = (data.email || '').toLowerCase();
        return name.includes(searchLower) || email.includes(searchLower);
      })
      .map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (error) {
    console.error('Error searching users:', error);
    throw error;
  }
}

export async function updateUserStatus(userId, status) {
  try {
    const userRef = doc(db, 'users', userId);
    await updateDoc(userRef, {
      status,
      statusUpdatedAt: serverTimestamp()
    });
  } catch (error) {
    console.error('Error updating user status:', error);
    throw error;
  }
}

export async function incrementItemViews(itemId) {
  try {
    const itemRef = doc(db, 'items', itemId);
    await updateDoc(itemRef, {
      views: increment(1),
      lastViewed: serverTimestamp()
    });
  } catch (error) {
    console.error('Error incrementing item views:', error);
    // Don't throw error for view tracking
  }
}

export async function getSimilarItems(category, excludeId, limitCount = 4) {
  try {
    const q = query(
      collection(db, 'items'),
      where('category', '==', category),
      where('status', '==', 'available'),
      orderBy('createdAt', 'desc'),
      limit(limitCount + 1) // Get one extra to exclude current item
    );
    
    const snapshot = await getDocs(q);
    return snapshot.docs
      .map(doc => ({ id: doc.id, ...doc.data() }))
      .filter(item => item.id !== excludeId)
      .slice(0, limitCount);
  } catch (error) {
    console.error('Error getting similar items:', error);
    throw error;
  }
}

export async function createSwapRequest(requestData) {
  try {
    const docId = await FirestoreOperations.create('swapRequests', {
      ...requestData,
      status: 'pending',
      createdAt: serverTimestamp()
    });
    return docId;
  } catch (error) {
    console.error('Error creating swap request:', error);
    throw error;
  }
}

export async function redeemItem(itemId, userId) {
  try {
    // Start a transaction to update both item and user points atomically
    const itemRef = doc(db, 'items', itemId);
    const userRef = doc(db, 'users', userId);
    
    // Get current item and user data
    const [itemDoc, userDoc] = await Promise.all([
      getDoc(itemRef),
      getDoc(userRef)
    ]);
    
    if (!itemDoc.exists() || !userDoc.exists()) {
      throw new Error('Item or user not found');
    }
    
    const item = itemDoc.data();
    const user = userDoc.data();
    const pointsNeeded = item.pointsValue || 0;
    const userPoints = user.totalPoints || 0;
    
    if (userPoints < pointsNeeded) {
      throw new Error('Insufficient points');
    }
    
    if (item.status !== 'available') {
      throw new Error('Item is no longer available');
    }
    
    // Update item status
    await updateDoc(itemRef, {
      status: 'redeemed',
      redeemedBy: userId,
      redeemedAt: serverTimestamp()
    });
    
    // Update user points
    await updateDoc(userRef, {
      totalPoints: increment(-pointsNeeded),
      pointsSpent: increment(pointsNeeded)
    });
    
    // Create redemption record
    await FirestoreOperations.create('redemptions', {
      itemId,
      userId,
      pointsSpent: pointsNeeded,
      redeemedAt: serverTimestamp()
    });
    
  } catch (error) {
    console.error('Error redeeming item:', error);
    throw error;
  }
}

// Enhanced update function for swap requests
export async function updateSwapRequest(requestId, updates) {
  try {
    const requestRef = doc(db, 'swapRequests', requestId);
    await updateDoc(requestRef, {
      ...updates,
      updatedAt: serverTimestamp()
    });
  } catch (error) {
    console.error('Error updating swap request:', error);
    throw error;
  }
}
