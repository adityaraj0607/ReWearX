// Firebase Configuration
// TODO: Replace with your actual Firebase config from Firebase Console
const firebaseConfig = {
  apiKey: "your-api-key-here",
  authDomain: "your-project.firebaseapp.com", 
  projectId: "your-project-id",
  storageBucket: "your-project.appspot.com",
  messagingSenderId: "123456789",
  appId: "your-app-id-here",
  measurementId: "your-measurement-id" // Optional for Analytics
};

// Initialize Firebase
import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { getAnalytics } from 'firebase/analytics';

const app = initializeApp(firebaseConfig);

// Initialize Firebase services
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
export const analytics = getAnalytics(app);

// Export auth methods for use in other modules
export { 
  GoogleAuthProvider, 
  signInWithPopup, 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged 
};

// Firestore Security Rules (Deploy these in Firebase Console)
/*
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Users collection
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
      allow read: if request.auth != null; // Allow reading other users for leaderboard
    }
    
    // Items collection
    match /items/{itemId} {
      allow read: if request.auth != null;
      allow create: if request.auth != null && request.auth.uid == request.resource.data.uploadedBy;
      allow update: if request.auth != null && 
        (request.auth.uid == resource.data.uploadedBy || 
         request.auth.token.admin == true);
    }
    
    // Swap requests
    match /swapRequests/{requestId} {
      allow read, write: if request.auth != null && 
        (request.auth.uid == resource.data.requesterId || 
         request.auth.uid == resource.data.receiverId);
    }
    
    // Redemptions
    match /redemptions/{redemptionId} {
      allow read, write: if request.auth != null && request.auth.uid == resource.data.userId;
    }
    
    // Reports (admin only)
    match /reports/{reportId} {
      allow read, write: if request.auth != null && request.auth.token.admin == true;
    }
  }
}
*/

// Storage Security Rules (Deploy these in Firebase Console)
/*
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    // Images can be uploaded by authenticated users
    match /images/{userId}/{allPaths=**} {
      allow read: if true; // Anyone can read images
      allow write: if request.auth != null && request.auth.uid == userId
        && request.resource.size < 2 * 1024 * 1024 // Max 2MB
        && request.resource.contentType.matches('image/.*'); // Only images
    }
  }
}
*/

// Firestore Collection Schema Documentation
/*
USERS COLLECTION:
{
  uid: string (document ID),
  name: string,
  email: string,
  avatar: string (URL),
  totalPoints: number,
  pointsSpent: number,
  itemsShared: number,
  exchangesMade: number,
  co2Saved: number,
  status: string ("active" | "suspended"),
  createdAt: timestamp,
  updatedAt: timestamp
}

ITEMS COLLECTION:
{
  id: string (document ID),
  title: string,
  description: string,
  category: string,
  type: string,
  size: string,
  condition: string,
  brand: string,
  color: string,
  images: array[string], // Storage URLs
  tags: array[string],
  pointsValue: number,
  uploadedBy: string (user ID),
  ownerName: string,
  ownerAvatar: string,
  status: string ("pending" | "available" | "exchanged" | "redeemed" | "rejected"),
  views: number,
  likes: number,
  reportCount: number,
  createdAt: timestamp,
  updatedAt: timestamp,
  approvedAt: timestamp,
  rejectedAt: timestamp
}

SWAP_REQUESTS COLLECTION:
{
  id: string (document ID),
  requesterId: string (user ID),
  requesterName: string,
  requesterEmail: string,
  requesterAvatar: string,
  receiverId: string (user ID),
  receiverName: string,
  requestedItemId: string,
  requestedItemTitle: string,
  requestedItemImage: string,
  offeredItemId: string,
  offeredItemTitle: string,
  offeredItemImage: string,
  message: string,
  status: string ("pending" | "accepted" | "declined" | "completed"),
  createdAt: timestamp,
  respondedAt: timestamp
}

REDEMPTIONS COLLECTION:
{
  id: string (document ID),
  userId: string,
  itemId: string,
  pointsSpent: number,
  createdAt: timestamp
}
*/
