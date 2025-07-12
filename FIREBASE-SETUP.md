🔥 **URGENT: Firebase Setup for Hackathon** 🔥

## 🚀 Quick Firebase Configuration (5 minutes)

### Step 1: Get Your Firebase Config
1. Go to [Firebase Console](https://console.firebase.google.com)
2. Select your project OR create new project
3. Click ⚙️ Settings → Project Settings
4. Scroll down to "Your apps" → Web app
5. Copy the `firebaseConfig` object

### Step 2: Replace Config in Code
Open `js/firebase-config.js` and replace lines 3-10:

```javascript
const firebaseConfig = {
  apiKey: "AIzaSyB61ZfFexHKoJwjMRboaOcUHKI1wXjWje4",
  authDomain: "rewearx-8326c.firebaseapp.com",
  projectId: "rewearx-8326c",
  storageBucket: "rewearx-8326c.firebasestorage.app",
  messagingSenderId: "829322612984",
  appId: "1:829322612984:web:e9c6d35911e79134092b0d",
  measurementId: "G-724TT27K91"
};

### Step 3: Enable Firebase Services
1. **Authentication:**
   - Go to Authentication → Sign-in method
   - Enable "Email/Password" ✅
   - Enable "Google" ✅ (Add your domain to authorized domains)

2. **Firestore Database:**
   - Go to Firestore Database → Create database
   - Start in "production mode" ✅
   - Choose region closest to you ✅

3. **Storage:**
   - Go to Storage → Get started
   - Use default security rules ✅

### Step 4: Deploy Security Rules
Copy these rules to Firebase Console:

**Firestore Rules** (Database → Rules):
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
      allow read: if request.auth != null;
    }
    match /items/{itemId} {
      allow read: if request.auth != null;
      allow create: if request.auth != null && request.auth.uid == request.resource.data.uploadedBy;
      allow update: if request.auth != null;
    }
    match /swapRequests/{requestId} {
      allow read, write: if request.auth != null;
    }
    match /redemptions/{redemptionId} {
      allow read, write: if request.auth != null;
    }
  }
}
```

**Storage Rules** (Storage → Rules):
```javascript
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /images/{userId}/{allPaths=**} {
      allow read: if true;
      allow write: if request.auth != null && request.auth.uid == userId
        && request.resource.size < 2 * 1024 * 1024
        && request.resource.contentType.matches('image/.*');
    }
  }
}
```

### Step 5: Test Your Setup
1. Open `index.html` in a browser
2. Try to sign up with email
3. Check Firebase Console → Authentication for new user
4. Check console for any errors

### Step 6: Deploy (Choose One)

**Option A: Firebase Hosting (Recommended)**
```bash
npm install -g firebase-tools
firebase login
firebase init hosting
firebase deploy
```

**Option B: Vercel (Fast)**
```bash
npm install -g vercel
vercel
```

**Option C: Netlify (Simple)**
- Drag your entire `ReWearX` folder to [netlify.com/drop](https://app.netlify.com/drop)

### 🎯 Demo Script for Judges
1. **Landing Page** (Show sustainability focus)
2. **Sign Up** (Google or email - works instantly)
3. **Upload Item** (Drag image, form validation)
4. **Browse** (Real-time updates, search, filters)
5. **Dashboard** (Points, stats, leaderboard)
6. **Admin Panel** (Moderation features)
7. **Mobile View** (Responsive design)

### 🏆 Key Selling Points
- **Real-time everywhere** (live updates as you demo)
- **Complete admin system** (not just user features)
- **Gamification** (points, levels, leaderboard)
- **Production-ready** (proper error handling, validation)
- **Sustainability focused** (CO₂ tracking, impact metrics)

### 🚨 Troubleshooting
- **Firebase errors?** Check API keys and service enablement
- **Console errors?** Check Network tab for 403/401 errors
- **Images not uploading?** Verify Storage rules and bucket name

**You're ready to win! 🚀**
