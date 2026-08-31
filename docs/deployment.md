# 🚀 Deployment Guide

This guide covers the complete deployment process for the Delight Bakehouse order management system to Firebase.

## Prerequisites

- Firebase CLI installed (`npm install -g firebase-tools`)
- Google Cloud Platform project with billing enabled
- Node.js 18+ and npm installed
- Git repository access

## Firebase Project Setup

### 1. Create Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click "Create a project" or "Add project"
3. Enter project name: `delight-bakehouse-prod`
4. Enable Google Analytics (recommended)
5. Choose Google Analytics account
6. Click "Create project"

### 2. Enable Required Services

In your Firebase project console:

#### Firestore Database
1. Go to "Firestore Database" → "Create database"
2. Choose "Start in test mode" (we'll configure security rules later)
3. Select a location (choose closest to your users)

#### Authentication
1. Go to "Authentication" → "Get started"
2. Enable "Email/Password" sign-in method
3. Configure additional providers if needed

#### Storage
1. Go to "Storage" → "Get started"
2. Choose "Start in test mode"
3. Select same location as Firestore

#### Functions
1. Go to "Functions" → "Get started"
2. Select Node.js 20 runtime
3. Choose same location as other services

#### Hosting
1. Go to "Hosting" → "Get started"
2. Follow setup wizard (we'll deploy later)

## Local Configuration

### 1. Clone and Setup Repository

```bash
git clone <repository-url>
cd delight-bakehouse
npm install
```

### 2. Configure Environment Variables

```bash
cp .env.example .env
```

Edit `.env` with your Firebase configuration:

```env
# Firebase Configuration
VITE_FIREBASE_API_KEY=your-api-key
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your-sender-id
VITE_FIREBASE_APP_ID=your-app-id

# Admin Configuration
VITE_ADMIN_EMAIL=admin@yourbakery.com
VITE_ADMIN_PASSWORD=secure-admin-password

# Google Maps API (for address autocomplete)
VITE_GOOGLE_MAPS_API_KEY=your-google-maps-api-key

# Application Settings
VITE_APP_NAME=Delight Bakehouse
VITE_APP_VERSION=1.0.0
```

### 3. Firebase CLI Login and Project Selection

```bash
# Login to Firebase
firebase login

# Select your project
firebase use --add
# Choose your project ID from the list
```

## Security Configuration

### 1. Deploy Security Rules

The project includes pre-configured security rules. Deploy them:

```bash
# Deploy Firestore rules and indexes
firebase deploy --only firestore

# Deploy Storage rules
firebase deploy --only storage
```

### 2. Configure Authentication

In Firebase Console → Authentication → Settings:
- Configure authorized domains
- Set up email templates
- Configure additional sign-in methods if needed

## Database Setup

### 1. Deploy Firestore Indexes

Indexes are automatically deployed with the rules. If you need custom indexes:

```bash
firebase deploy --only firestore:indexes
```

### 2. Seed Initial Data (Optional)

For development/testing, you can seed initial data:

```bash
cd src/seed
# Add your serviceAccountKey.json (download from Firebase Console)
node index.js
```

## Build and Deploy

### 1. Build Application

```bash
# Build for production
npm run build
```

### 2. Deploy Functions First

```bash
# Deploy Cloud Functions
firebase deploy --only functions
```

### 3. Deploy Hosting

```bash
# Deploy to Firebase Hosting
firebase deploy --only hosting
```

### 4. Full Deployment

For complete deployment of all services:

```bash
firebase deploy
```

## Post-Deployment Configuration

### 1. Create Admin User

After deployment, create your first admin user:

1. Visit your deployed app URL
2. Use the admin email/password from your `.env` file
3. The system will automatically grant admin privileges

### 2. Configure Business Settings

In the admin dashboard:
- Set business information
- Configure pricing tiers
- Set up product categories
- Configure delivery zones

### 3. Test Core Functionality

Verify these features work:
- User registration and login
- Admin dashboard access
- Order creation and management
- File uploads (product images, invoices)

## Environment-Specific Configurations

### Development Environment

For development, use Firebase emulators:

```bash
# Start emulators
npm run emulators

# In another terminal, start dev server
npm run dev
```

### Staging Environment

Create a separate Firebase project for staging:

```bash
# Use staging project
firebase use staging-project-id

# Deploy to staging
firebase deploy
```

### Production Environment

Use the production project for live deployment:

```bash
# Switch to production
firebase use production-project-id

# Deploy to production
firebase deploy
```

## Monitoring and Maintenance

### Firebase Console Monitoring

Monitor your app in Firebase Console:
- **Analytics**: User engagement and conversion tracking
- **Crashlytics**: Error monitoring and crash reports
- **Performance**: App performance metrics
- **Functions**: Cloud function execution logs

### Logs and Debugging

```bash
# View function logs
firebase functions:log

# View hosting logs
firebase hosting:log

# Debug functions locally
firebase functions:shell
```

### Backup and Recovery

- Firestore data is automatically backed up
- Export data using Firebase Admin SDK if needed
- Monitor storage usage and costs

## Troubleshooting

### Common Issues

**Functions deployment fails:**
- Check Node.js version (must be 18+)
- Verify package.json in functions directory
- Check Firebase project billing is enabled

**Hosting deployment fails:**
- Ensure build completed successfully
- Check Firebase project has Hosting enabled
- Verify domain configuration

**Authentication issues:**
- Check Firebase Auth settings
- Verify authorized domains
- Check security rules

### Performance Optimization

- Enable Firebase CDN for faster loading
- Configure proper indexes for Firestore queries
- Monitor function execution times
- Use Firebase Performance Monitoring

## Cost Optimization

### Firebase Pricing Considerations

- **Free Tier**: Suitable for small bakeries (up to 100 customers)
- **Blaze Plan**: Pay-as-you-go for growing businesses
- Monitor usage in Firebase Console
- Set up billing alerts

### Scaling Strategies

- Functions auto-scale with usage
- Firestore scales automatically
- Storage scales with data growth
- Monitor costs regularly

## Security Best Practices

- Regularly update Firebase SDK versions
- Monitor authentication logs
- Review security rules periodically
- Use environment variables for sensitive data
- Enable two-factor authentication for admin accounts

## Support

For deployment issues:
1. Check Firebase status dashboard
2. Review deployment logs
3. Consult Firebase documentation
4. Create GitHub issue for app-specific problems

---

**Last updated:** December 2024