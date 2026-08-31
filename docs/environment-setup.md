# ⚙️ Environment Setup Guide

This guide covers the complete environment configuration for the Delight Bakehouse system across development, staging, and production environments.

## Environment Overview

### Development Environment
- **Purpose**: Local development and testing
- **Firebase Project**: Separate dev project
- **Data**: Test data, can be reset anytime
- **Features**: Full Firebase emulator support

### Staging Environment
- **Purpose**: Pre-production testing and validation
- **Firebase Project**: Separate staging project
- **Data**: Production-like data for testing
- **Features**: Mirrors production setup

### Production Environment
- **Purpose**: Live customer-facing application
- **Firebase Project**: Production project
- **Data**: Real customer and business data
- **Features**: Full production optimizations

## Firebase Project Configuration

### Creating Multiple Environments

1. **Development Project**
   ```
   Project ID: delight-bakehouse-dev
   Name: Delight Bakehouse (Dev)
   ```

2. **Staging Project**
   ```
   Project ID: delight-bakehouse-staging
   Name: Delight Bakehouse (Staging)
   ```

3. **Production Project**
   ```
   Project ID: delight-bakehouse-prod
   Name: Delight Bakehouse (Prod)
   ```

### Service Configuration

For each project, enable these services:

#### Firestore Database
- **Location**: Choose closest to your users (e.g., `australia-southeast1`)
- **Security**: Start in test mode, deploy production rules later

#### Authentication
- **Sign-in methods**: Email/Password (primary)
- **Additional providers**: Google, Microsoft (optional)
- **Authorized domains**: Add your custom domains

#### Storage
- **Location**: Same as Firestore
- **Security**: Start in test mode

#### Functions
- **Runtime**: Node.js 20
- **Location**: Same as Firestore
- **Memory**: 256 MB (default), scale up if needed

#### Hosting
- **Site name**: Default for production, custom for others
- **Custom domain**: Configure for production

## Environment Variables

### Base Configuration (.env.example)

```env
# =============================================================================
# DELIGHT BAKEHOUSE - ENVIRONMENT CONFIGURATION
# =============================================================================

# Firebase Configuration
VITE_FIREBASE_API_KEY=your-firebase-api-key
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your-messaging-sender-id
VITE_FIREBASE_APP_ID=your-app-id

# Application Configuration
VITE_APP_NAME=Delight Bakehouse
VITE_APP_VERSION=1.0.0
VITE_APP_ENV=development

# Admin Configuration
VITE_ADMIN_EMAIL=admin@yourbakery.com
VITE_ADMIN_PASSWORD=secure-admin-password-change-immediately

# External APIs
VITE_GOOGLE_MAPS_API_KEY=your-google-maps-api-key

# Feature Flags
VITE_ENABLE_ANALYTICS=true
VITE_ENABLE_NOTIFICATIONS=true
VITE_ENABLE_DEBUG_LOGGING=false

# Business Configuration
VITE_BUSINESS_NAME=Delight Bakehouse
VITE_BUSINESS_EMAIL=orders@delightbakehouse.com
VITE_BUSINESS_PHONE=+61 2 1234 5678
VITE_BUSINESS_ADDRESS=123 Bakery Street, Sydney NSW 2000

# Payment Configuration
VITE_CURRENCY=AUD
VITE_GST_RATE=0.10
VITE_MINIMUM_ORDER=50.00

# Security Configuration
VITE_SESSION_TIMEOUT=3600000
VITE_MAX_LOGIN_ATTEMPTS=5
VITE_PASSWORD_MIN_LENGTH=8
```

### Environment-Specific Overrides

#### Development (.env.development)

```env
# Development-specific settings
VITE_APP_ENV=development
VITE_ENABLE_DEBUG_LOGGING=true
VITE_FIREBASE_PROJECT_ID=delight-bakehouse-dev

# Use Firebase emulators
VITE_USE_EMULATOR=true
VITE_EMULATOR_HOST=localhost
VITE_EMULATOR_PORT=8080

# Relaxed security for development
VITE_SESSION_TIMEOUT=86400000
VITE_MAX_LOGIN_ATTEMPTS=10
```

#### Staging (.env.staging)

```env
# Staging environment
VITE_APP_ENV=staging
VITE_ENABLE_DEBUG_LOGGING=false
VITE_FIREBASE_PROJECT_ID=delight-bakehouse-staging

# Production-like settings but with staging data
VITE_USE_EMULATOR=false
VITE_SESSION_TIMEOUT=3600000
VITE_MAX_LOGIN_ATTEMPTS=5
```

#### Production (.env.production)

```env
# Production environment
VITE_APP_ENV=production
VITE_ENABLE_DEBUG_LOGGING=false
VITE_FIREBASE_PROJECT_ID=delight-bakehouse-prod

# Strict security settings
VITE_USE_EMULATOR=false
VITE_SESSION_TIMEOUT=3600000
VITE_MAX_LOGIN_ATTEMPTS=3
VITE_PASSWORD_MIN_LENGTH=12

# Production admin credentials (set via CI/CD)
VITE_ADMIN_EMAIL=${ADMIN_EMAIL}
VITE_ADMIN_PASSWORD=${ADMIN_PASSWORD}
```

## Firebase Configuration Files

### firebase.json (Base Configuration)

```json
{
  "firestore": {
    "rules": "firestore.rules",
    "indexes": "firestore.indexes.json"
  },
  "functions": {
    "predeploy": [
      "npm --prefix \"$RESOURCE_DIR\" run lint",
      "npm --prefix \"$RESOURCE_DIR\" run build"
    ],
    "source": "functions",
    "runtime": "nodejs20"
  },
  "hosting": {
    "public": "dist",
    "ignore": [
      "firebase.json",
      "**/.*",
      "**/node_modules/**"
    ],
    "rewrites": [
      {
        "source": "**",
        "destination": "/index.html"
      }
    ],
    "headers": [
      {
        "source": "**/*.js",
        "headers": [
          {
            "key": "Cache-Control",
            "value": "max-age=31536000"
          }
        ]
      },
      {
        "source": "**/*.css",
        "headers": [
          {
            "key": "Cache-Control",
            "value": "max-age=31536000"
          }
        ]
      }
    ]
  },
  "storage": {
    "rules": "storage.rules"
  },
  "emulators": {
    "auth": {
      "port": 9099
    },
    "firestore": {
      "port": 8080
    },
    "functions": {
      "port": 5001
    },
    "hosting": {
      "port": 5000
    },
    "storage": {
      "port": 9199
    },
    "ui": {
      "enabled": true
    }
  }
}
```

### Environment-Specific Firebase Configs

Create separate config files for each environment:

#### .firebaserc (Project Mapping)

```json
{
  "projects": {
    "default": "delight-bakehouse-dev",
    "development": "delight-bakehouse-dev",
    "staging": "delight-bakehouse-staging",
    "production": "delight-bakehouse-prod"
  }
}
```

## Security Configuration

### Firestore Security Rules

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Helper functions
    function isAuthenticated() {
      return request.auth != null;
    }

    function isAdmin() {
      return isAuthenticated() &&
             get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin';
    }

    function isOwner(userId) {
      return isAuthenticated() && request.auth.uid == userId;
    }

    function isCustomer() {
      return isAuthenticated() &&
             get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'customer';
    }

    // Users collection
    match /users/{userId} {
      allow read: if isAuthenticated();
      allow write: if isOwner(userId) || isAdmin();
      allow create: if request.auth != null;
    }

    // Orders collection
    match /orders/{orderId} {
      allow read: if isOwner(resource.data.customerId) || isAdmin();
      allow write: if isOwner(resource.data.customerId) || isAdmin();
      allow create: if isCustomer();
    }

    // Products collection
    match /products/{productId} {
      allow read: if true; // Public read
      allow write: if isAdmin();
    }

    // Business settings
    match /settings/{settingId} {
      allow read: if true;
      allow write: if isAdmin();
    }
  }
}
```

### Storage Security Rules

```javascript
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /products/{allPaths=**} {
      allow read: if true;
      allow write: if request.auth != null &&
                   request.auth.token.role == 'admin';
    }

    match /invoices/{allPaths=**} {
      allow read: if request.auth != null &&
                  (request.auth.uid == resource.metadata.customerId ||
                   request.auth.token.role == 'admin');
      allow write: if request.auth != null &&
                   request.auth.token.role == 'admin';
    }

    match /user-uploads/{userId}/{allPaths=**} {
      allow read, write: if request.auth != null &&
                        request.auth.uid == userId;
    }
  }
}
```

## Build Configuration

### Vite Configuration (vite.config.ts)

```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(({ mode }) => ({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
      },
    }),
  ],
  define: {
    __APP_ENV__: JSON.stringify(mode),
  },
  build: {
    outDir: 'dist',
    sourcemap: mode === 'development',
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          firebase: ['firebase/app', 'firebase/firestore', 'firebase/auth'],
          ui: ['lucide-react', 'tailwindcss'],
        },
      },
    },
  },
  server: {
    port: 3000,
    host: true,
  },
}));
```

### TypeScript Configuration (tsconfig.json)

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "exactOptionalPropertyTypes": true,
    "noImplicitReturns": true,
    "noImplicitOverride": true
  },
  "include": ["src"],
  "references": [{ "path": "./tsconfig.node.json" }]
}
```

## CI/CD Configuration

### GitHub Actions (.github/workflows/deploy.yml)

```yaml
name: Deploy to Firebase

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '18'
          cache: 'npm'
      - run: npm ci
      - run: npm run typecheck
      - run: npm run test

  deploy-dev:
    needs: test
    if: github.ref == 'refs/heads/develop'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '18'
          cache: 'npm'
      - run: npm ci
      - run: npm run build
      - uses: FirebaseExtended/action-hosting-deploy@v0
        with:
          repoToken: '${{ secrets.GITHUB_TOKEN }}'
          firebaseServiceAccount: '${{ secrets.FIREBASE_SERVICE_ACCOUNT_DEV }}'
          projectId: delight-bakehouse-dev

  deploy-prod:
    needs: test
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '18'
          cache: 'npm'
      - run: npm ci
      - run: npm run build
      - run: npm run firebase deploy -- --project delight-bakehouse-prod
        env:
          FIREBASE_TOKEN: ${{ secrets.FIREBASE_TOKEN_PROD }}
```

## Local Development Setup

### Using Firebase Emulators

```bash
# Install Firebase CLI
npm install -g firebase-tools

# Login to Firebase
firebase login

# Start emulators
npm run emulators

# In another terminal, start dev server
npm run dev
```

### Environment Switching

Create npm scripts for different environments:

```json
{
  "scripts": {
    "dev": "vite",
    "dev:staging": "vite --mode staging",
    "dev:prod": "vite --mode production",
    "build": "tsc && vite build",
    "build:staging": "tsc && vite build --mode staging",
    "build:prod": "tsc && vite build --mode production"
  }
}
```

## Monitoring and Logging

### Firebase Console Monitoring

Set up monitoring for:
- Function performance and errors
- Database usage and performance
- Storage usage
- Authentication metrics

### Application Logging

```typescript
// Logger utility
export const logger = {
  info: (message: string, data?: any) => {
    if (import.meta.env.DEV) {
      console.log(`[INFO] ${message}`, data);
    }
    // Send to monitoring service in production
  },
  error: (message: string, error?: any) => {
    console.error(`[ERROR] ${message}`, error);
    // Send to error monitoring service
  },
};
```

## Troubleshooting

### Common Environment Issues

**Environment variables not loading:**
- Check `.env` file exists and is in project root
- Verify variable names match (no spaces around `=`)
- Restart development server after changes

**Firebase project connection issues:**
- Verify project ID in `.firebaserc`
- Check Firebase CLI login status
- Confirm project exists and services are enabled

**Build failures:**
- Clear node_modules and reinstall
- Check TypeScript errors with `npm run typecheck`
- Verify all dependencies are installed

**Emulator connection problems:**
- Ensure emulators are running on correct ports
- Check firewall settings
- Verify emulator UI is accessible

### Environment Validation

Create a validation script to check configuration:

```typescript
// src/utils/env-validation.ts
export const validateEnvironment = () => {
  const required = [
    'VITE_FIREBASE_API_KEY',
    'VITE_FIREBASE_PROJECT_ID',
    'VITE_ADMIN_EMAIL',
  ];

  const missing = required.filter(key => !import.meta.env[key]);

  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
};
```

---

**Last updated:** December 2024