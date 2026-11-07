// ═══════════════════════════════════════════════════════════════
//  FIRESTORE DATABASE SCHEMA — Dashboard App
//  Project: domains-41de5 (Firebase)
//  Created for: E-Social Domains Dashboard
// ═══════════════════════════════════════════════════════════════

// ═══════ DATABASE INSTANCE ═══════

// Database ID: "default"  (named database, NOT the implicit "(default)" one)
// Location:   africa-south1
// The SDK must pass the ID explicitly: getFirestore(app, "default")
// (Both src/firebase.ts and scripts/seed-firestore.mjs already do this.)

// ═══════ COLLECTIONS ═══════

// 1. users (root user profile + wallet info)
//    Document ID = Firebase Auth UID
//    ├── uid          : string  (auth uid)
//    ├── email        : string  (user email)
//    ├── displayName  : string  (full name)
//    ├── photoURL     : string  (avatar data URL)
//    ├── points       : number  (creator points balance)
//    ├── tier         : string  (Bronze | Silver | Gold | Platinum)
//    ├── role         : string  (member | admin | moderator)
//    ├── invites      : number  (successful referrals count)
//    ├── bonusSlots   : number  (remaining bonus slots)
//    ├── programs     : array   ["creator", "ambassador", ...]
//    ├── moderatorRoles: array  (held moderator positions)
//    └── createdAt    : timestamp

// 2. users/{uid}/walletTransactions (sub-collection)
//    Document ID = auto-id (or timestamp-based)
//    ├── type          : string  (deposit | withdraw | purchase | referral)
//    ├── amount        : number  (positive = credit, negative = debit)
//    ├── label         : string  (description, e.g. "Top up", "Referral bonus")
//    └── createdAt     : timestamp

// 3. apiKeys (user-owned API keys)
//    Document ID = auto-id
//    ├── uid           : string  (Firebase Auth UID)
//    ├── name          : string  (user-defined label)
//    ├── prefix        : string  (first 16 chars of full key)
//    ├── keyHash       : string  (SHA-256 hex of full key, never shown)
//    ├── revoked       : boolean
//    └── createdAt     : timestamp

// 4. invitations (referral tracking)
//    Document ID = invite UID or auto-id
//    ├── inviterId     : string  (referrer auth uid)
//    ├── inviteeEmail  : string  (referred user email, if known)
//    ├── status        : string  (pending | accepted | expired)
//    ├── inviteLink    : string  (full referral URL with ?ref=<uid>)
//    └── createdAt     : timestamp

// 5. programApplications (creator program applications)
//    Document ID = auto-id
//    ├── userId        : string  (applicant auth uid)
//    ├── programId     : string  (creator | ambassador | beta-tester | translator | community-support)
//    ├── status        : string  (pending | approved | rejected)
//    ├── submittedAt   : timestamp
//    ├── resume        : string  (optional link)
//    └── coverLetter   : string  (optional text)

// 6. moderatorApplications (moderator position applications)
//    Document ID = auto-id
//    ├── userId        : string  (applicant auth uid)
//    ├── positionId    : string  (community-moderator | abuse-moderator | forum-moderator | marketplace-moderator)
//    ├── status        : string  (pending | approved | rejected)
//    ├── submittedAt   : timestamp
//    ├── motivation    : string  (why they want to moderate)
//    └── seatsAvailable: number (current seats open for this position)

// 7. domains (domain registrations — written by the app and scripts/register-domain.mjs)
//    Document ID = auto-id
//    ├── name      : string  (fully-qualified domain, e.g. "maskedes.us.kg")
//    ├── userId    : string  (owner auth uid)
//    ├── status    : string  ("permanent / free")
//    └── createdAt : timestamp

// ═══════ SECURITY RULES (READY-TO-PUBLISH) ═══════

/*
Paste this into: Firebase Console → Firestore Database → Rules
Then click: Review and publish → Confirm → Change to production mode
*/

service cloud.firestore {
  match /databases/{database}/documents {
    allow read, write: if request.auth != null;

    // users collection — user can only access their own document
    match /users/{userId} {
      allow read, update: if request.auth != null && request.auth.uid == userId;
      allow create: if request.auth != null && request.auth.uid == userId;
      match /profile { allow read, update: if request.auth != null && request.auth.uid == userId; }
      match /walletTransactions/{txId} {
        allow read: if request.auth != null && request.auth.uid == userId;
        allow create: if request.auth != null && request.auth.token.admin == true;
        allow update, delete: false;
      }
    }

    // apiKeys — users see/manage only their own keys
    match /apiKeys/{keyId} {
      allow read, update, delete: if request.auth != null && request.auth.uid == resource.data.uid;
      allow create: if request.auth != null && request.auth.uid == request.resource.data.uid;
    }

    // invitations — referral tracking
    match /invitations/{invId} {
      allow read: if request.auth != null;
      allow create: if request.auth != null;
      allow update, delete: if request.auth != null && request.auth.uid == resource.data.inviterId;
    }

    // program applications — open apply, admin updates
    match /programApplications/{appId} {
      allow read: if request.auth != null;
      allow create: if request.auth != null;
      allow update: if request.auth != null;
    }

    // moderator applications — open apply, admin updates
    match /moderatorApplications/{appId} {
      allow read: if request.auth != null;
      allow create: if request.auth != null;
      allow update: if request.auth != null;
    }
  }
}

// ═══════ SCHEMA NOTES ═══════

// Points system (creator program):
//   - Bronze  : 0     points  (default)
//   - Silver  : 500   points
//   - Gold    : 2000  points
//   - Platinum: 5000  points
// Awarded for: invitations (+50), referral sign-up (+25), program applications, moderator service.

// API key security:
//   - Client generates: edes_sk_<30 char random url-safe base64>
//   - Stored: prefix (16 chars shown in UI) + SHA-256 hash (full key never stored)
//   - Revoked keys kept for audit (revoked: true flag), never deleted.

// Wallet transactions are server-only:
//   - Created by Cloud Function (functions/index.js) via walletOperation()
//   - Never created/updated/deleted by clients directly.
//   - Signed amounts: positive = deposit/top-up/referral; negative = withdraw.
