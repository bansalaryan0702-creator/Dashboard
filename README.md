# Internal Job/Ticket Tracking System

This application includes a custom Full-Stack setup using **Vite + React (Frontend)** and **Express.js (Backend)**. 
For immediate local/preview testing, the Express server utilizes a simple built-in file-based mock database (`db.json`) which persists across browser reloads.

## Testing Locally
1. The app starts with a default Admin account:
   - **ID/Username:** `admin`
   - **Password:** `password123`
2. With this account, you can create new `Employee` tier credentials from the Admin Dashboard.
3. Login via those newly created users to raise tickets.

## Migrating to a Free Tier Database (Firebase)
When you are ready to move this application from `db.json` into a real production DB, you can connect it directly to **Firebase Firestore** Free Tier. Since the codebase is nicely decoupled (all API requests hit Express JS endpoints), the migration is simple:

1. Create a Firebase Project in the [Firebase Console](https://console.firebase.google.com/).
2. In the "Project Settings", create a new "Service Account" and generate a Node.js JSON Private Key.
3. Install Firebase Admin in your project:
   `npm install firebase-admin`
4. Update the `server.ts` setup to initialize Firebase matching your service account:
```ts
import admin from 'firebase-admin';

// Initialize Firebase Admin (Set your JSON key as an env variable or require it)
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON!);
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();
```
5. Replace the mock `readDB()` and `writeDB()` logic inside the Express routes with Firestore calls:
```ts
// Example GET Users
app.get("/api/users", async (req, res) => {
   const snapshot = await db.collection("users").where("role", "==", "employee").get();
   const employees = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
   res.json(employees);
});
```
This architectural split allows you to keep your client React code identical without any complicated logic swaps; you only patch up the Express `server.ts` handlers to utilize the Firestore client SDK.
