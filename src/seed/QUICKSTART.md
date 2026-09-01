# Seed Quickstart

## Prerequisites

1. **Create your admin user in Firebase Auth first**
   - Firebase Console → Authentication → Add User
   - Note the UID (you'll need it)

2. **Download your service account key**
   - Firebase Console → Project Settings → Service Accounts
   - Click "Generate new private key"
   - Save as `src/seed/serviceAccountKey.json`

3. **Update the storageBucket** in `src/seed/index.js`:
   ```js
   storageBucket: 'your-project-id.appspot.com'
   ```

## Run the seed

```bash
cd src/seed
npm install firebase-admin   # one-time
node index.js                # seeds everything

# Or selective:
node index.js --only=settings,categories,products
node index.js --skip=notifications
```

## After seeding

1. The seed creates a demo admin customer profile with email `admin@deliciousbakery.com`.
   **You must update this** to match your real admin UID and email.
   
   In Firestore Console → customers → find the admin doc → update `id` to your real Firebase Auth UID.

2. Update the admin customer profile in Firestore:
   - Find the customer document for your admin UID
   - Set `customerType: 'admin'`
   - Set `status: 'approved'`
   - Ensure the document ID matches the Firebase Auth UID

   The app uses the Firestore `customerType` check for admin access; no custom claim is required.

3. Deploy rules:
   ```bash
   firebase deploy --only firestore,storage
   ```

4. Start the app:
   ```bash
   cp .env.example .env   # fill in your Firebase config
   npm install
   npm run dev
   ```
