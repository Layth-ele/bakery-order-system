# 🍞 Delight Bakehouse - Professional Bakery Order Management System

> A comprehensive, cloud-native order management platform designed specifically for wholesale bakery operations. Built with modern web technologies and Firebase, this system streamlines the entire bakery business workflow from customer onboarding to order fulfillment.

[![TypeScript](https://img.shields.io/badge/TypeScript-5.9.3-blue.svg)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-18.3.1-blue.svg)](https://reactjs.org/)
[![Firebase](https://img.shields.io/badge/Firebase-11.10.0-orange.svg)](https://firebase.google.com/)
[![Vite](https://img.shields.io/badge/Vite-6.4.1-646CFF.svg)](https://vitejs.dev/)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

## ✨ Key Features

### 🏪 **Complete Bakery Management**
- **Customer Lifecycle Management**: Registration → Approval → Order Placement → Ongoing Service
- **Order Processing**: Creation → Approval → Production → Delivery → Payment
- **Product Catalog**: Dynamic pricing, categories, wholesale/retail tiers
- **Payment Processing**: Credit management, payment tracking, automated invoicing

### 👥 **Multi-Role Architecture**
- **Admin Dashboard**: Full system control, analytics, customer management
- **Customer Portal**: Self-service ordering, order history, payment management
- **Commercial Accounts**: Bulk ordering, special pricing, dedicated support

### 📊 **Business Intelligence**
- **Real-time Analytics**: Sales metrics, customer insights, order trends
- **Financial Reporting**: Revenue tracking, payment status, credit management
- **Operational Metrics**: Order fulfillment times, customer satisfaction

### 🔧 **Technical Excellence**
- **Type-Safe**: Full TypeScript coverage with Zod schema validation
- **Real-time**: Live updates via Firebase subscriptions
- **Offline-Ready**: Progressive Web App with caching
- **Mobile-Responsive**: Optimized for all devices
- **Cloud-Native**: Auto-scaling Firebase infrastructure

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ and npm
- Firebase project with Firestore, Auth, Storage, and Functions enabled
- Google Cloud Platform project (for some features)

### Installation

1. **Clone and install**
   ```bash
   git clone <repository-url>
   cd delight-bakehouse
   npm install
   ```

2. **Configure Firebase**
   ```bash
   cp .env.example .env
   # Edit .env with your Firebase credentials
   ```

3. **Setup Firebase project**
   ```bash
   firebase use --add
   firebase deploy --only firestore,storage
   ```

4. **Seed initial data** (optional)
   ```bash
   cd src/seed
   # Add serviceAccountKey.json
   node index.js
   ```

5. **Start development server**
   ```bash
   npm run dev
   ```

## 📁 Project Structure

```
src/
├── components/         # React UI components
│   ├── admin/          # Admin dashboard components
│   ├── customer/       # Customer portal components
│   ├── modals/         # Modal dialogs and forms
│   ├── order/          # Order management components
│   └── shared/         # Reusable UI components
├── hooks/              # Custom React hooks
│   ├── admin/          # Admin-specific hooks
│   ├── useAuth.tsx     # Authentication
│   └── useCachedFirebase.ts # Data caching
├── services/           # Business logic layer
│   ├── data/           # Firestore CRUD operations
│   ├── orders/         # Order workflow logic
│   ├── firebase/       # Firebase integrations
│   └── analytics/      # Business intelligence
├── schemas/            # Zod validation schemas
├── types/              # TypeScript definitions
├── routes/             # React Router configuration
├── contexts/           # React Context providers
├── utils/              # Utility functions
└── constants/          # Application constants

src/functions/          # Firebase Cloud Functions
├── src/                # Function source code
├── lib/                # Compiled JavaScript
└── package.json        # Function dependencies
```

## 🛠️ Tech Stack

### Frontend
- **React 18** - Modern React with hooks and concurrent features
- **TypeScript 5.9** - Type-safe JavaScript with latest features
- **Vite** - Fast build tool and dev server
- **Tailwind CSS** - Utility-first CSS framework
- **TanStack Query** - Powerful data fetching and caching
- **React Router v7** - Declarative routing with data loading

### Backend & Infrastructure
- **Firebase** - Complete backend-as-a-service
  - **Firestore** - NoSQL database with real-time capabilities
  - **Authentication** - User management and security
  - **Cloud Storage** - File uploads and storage
  - **Cloud Functions** - Serverless backend logic
  - **Hosting** - CDN deployment and SSL
- **Zod** - Runtime type validation and schema parsing

### Development & Quality
- **Vitest** - Fast unit testing framework
- **ESLint + Prettier** - Code quality and formatting
- **TypeScript** - Compile-time type checking
- **Firebase Emulator** - Local development environment

## 📊 Business Features

### Customer Management
- ✅ Customer registration and approval workflow
- ✅ Account status management (pending/approved/suspended/archived)
- ✅ Customer types (individual/commercial/admin)
- ✅ Contact information and delivery addresses
- ✅ Order history and preferences

### Order Management
- ✅ Complex order creation with weekly scheduling
- ✅ Order approval and rejection workflow
- ✅ Payment processing and confirmation
- ✅ Order status tracking (pending → approved → in_process → completed)
- ✅ Cancellation and refund management
- ✅ Automated notifications and updates

### Product Management
- ✅ Dynamic product catalog with categories
- ✅ Wholesale vs retail pricing tiers
- ✅ Product availability and inventory tracking
- ✅ Custom product options and variations

### Financial Management
- ✅ Credit system for customer accounts
- ✅ Payment tracking and confirmation
- ✅ Automated invoice generation (PDF)
- ✅ Financial reporting and analytics
- ✅ GST and tax calculations

### Analytics & Reporting
- ✅ Real-time sales metrics
- ✅ Customer behavior analytics
- ✅ Order fulfillment tracking
- ✅ Revenue and profit analysis
- ✅ Custom reporting dashboards

## 🔒 Security & Compliance

- **Role-Based Access Control**: Admin, Customer, and Commercial user roles
- **Firebase Security Rules**: Database and storage access control
- **Authentication**: Secure user authentication with Firebase Auth
- **Data Validation**: Runtime validation with Zod schemas
- **Type Safety**: Full TypeScript coverage prevents runtime errors
- **Audit Trail**: Complete logging of all business operations

## 🚀 Deployment

### Production Deployment
```bash
# Build for production
npm run build

# Deploy to Firebase (Firestore + Storage + Hosting + Functions)
firebase deploy
```

### Environment Configuration
See `.env.example` for all required environment variables including:
- Firebase project configuration
- Google Maps API for address autocomplete
- Admin account settings

### Firebase Project Setup
1. Create Firebase project
2. Enable Firestore, Authentication, Storage, Functions, Hosting
3. Configure security rules (included in project)
4. Set up billing for Cloud Functions
5. Deploy Firestore indexes

## 🧪 Testing

```bash
# Run all tests
npm run test

# Run type checking
npm run typecheck

# Run development server
npm run dev

# Run Firebase emulators
npm run emulators
```

## 📚 Documentation

- **[🚀 Deployment Guide](docs/deployment.md)** - Complete Firebase deployment instructions
- **[⚙️ Environment Setup](docs/environment-setup.md)** - Environment configuration for dev/staging/production
- **[📡 API Documentation](docs/api.md)** - Firebase Cloud Functions API reference
- **[🤝 Contributing Guide](docs/contributing.md)** - Development workflow and standards
- **[✅ Production Readiness](docs/production-readiness.md)** - Comprehensive go-live checklist
- **[💼 Business Overview](docs/business-overview.md)** - Commercial value and market opportunity

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes with tests
4. Run `npm run typecheck` and `npm run test`
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

For support, please contact the development team or create an issue in this repository.

---

**Built with ❤️ for bakery businesses worldwide**

```bash
cp .env.example .env
```

Fill in `.env` with your Firebase project credentials (Firebase Console → Project Settings → Your Apps).

### 3. Seed Firebase (first time only)

```bash
cd src/seed
# Add your serviceAccountKey.json (Firebase Console → Project Settings → Service Accounts)
node index.js
```

See `src/seed/QUICKSTART.md` for full seed instructions.

### 4. Run locally

```bash
npm run dev
```

### 5. Type check

```bash
npm run typecheck
```

### 6. Build for production

```bash
npm run build
```

### 7. Deploy

```bash
# Deploy Firestore rules + indexes + hosting
firebase deploy

# Deploy only rules
firebase deploy --only firestore,storage

# Deploy only hosting
firebase deploy --only hosting
```

## Admin Setup

See `ADMIN_AUTH_MODEL.md` for the complete admin authorization model including:
- How admin access is granted (Firestore `customerType` + custom claim)
- Exact steps to set up a new admin user
- How the two auth layers (Firestore rules vs Storage rules) work together

## Environment Variables

See `.env.example` for all required variables.

## Testing

```bash
npm run test
```

Smoke tests cover: auth guards, order calculations, Zod schemas, credit calculations, order lifecycle, notification modal mapping.
