# Bakery Order Management System

A React + TypeScript web application for managing bakery wholesale orders, customer accounts, payments, invoicing, and admin operations. The platform is built around Firebase and follows a route-driven, multi-role architecture for both admin and customer workflows.

## Overview

This project is a bakery business platform for:
- customer sign-up and approval flows
- wholesale order placement and review
- admin approval and production tracking
- payment status and invoice management
- reporting and business insights

It is designed for a bakery operating with wholesale customers, recurring orders, and internal operational workflows.

## Core Features

### Customer portal
- customer login and registration
- account status tracking
- order dashboard with weekly ordering workflows
- product browsing by category and filters
- cart and order submission
- unpaid orders and balance tracking
- invoice history and payment visibility

### Admin dashboard
- pending order review and approval
- approved order workflow tracking
- unpaid order monitoring
- customer management and approval flows
- product catalog management and pricing updates
- system settings and configuration
- production task view for fulfillment operations
- weekly invoice summaries and billing data
- analytics and reporting overview

### Business logic and operations
- order lifecycle states from pending to approved, complete, and paid
- delivery and service fee handling
- customer credit and payment management
- admin notifications and task communication
- route-based access control for admin and customer pages
- Firebase-backed realtime data updates

### Data and validation
- TypeScript-first development
- Zod schema validation for orders, customers, products, and invoice data
- Firebase Firestore integration
- cloud function support for server-side business logic

## Tech Stack

- React 18
- TypeScript
- Vite
- React Router
- TanStack Query
- Firebase (Auth, Firestore, Storage, Hosting, Cloud Functions)
- Tailwind CSS
- Zod validation
- Vitest

## Project Structure

```text
src/
├── components/
│   ├── admin/
│   ├── customer/
│   ├── modals/
│   ├── order/
│   └── shared/
├── config/
├── constants/
├── contexts/
├── firebase/
├── functions/
├── guards/
├── hooks/
├── notifications/
├── pages/
├── routes/
├── schemas/
├── services/
├── styles/
├── tests/
├── types/
├── utils/
├── App.tsx
├── main.tsx
└── vite-env.d.ts

public/
├── assets/
└── ...

scripts/
└── ...

firebase.json
firestore.rules
firestore.indexes.json
storage.rules
vite.config.ts
vitest.config.ts
package.json
.env.example
```

## Routes and app flow

The app uses a route-driven architecture with protected pages:
- public landing/login experience
- admin routes for orders, customers, products, settings, analytics, and invoices
- customer dashboard for order management and account activity
- account status and password reset screens

The route definitions live in the main router configuration under the src/routes folder.

## Getting Started

### Prerequisites
- Node.js 18+
- npm
- Firebase project with Firestore, Authentication, Storage, and Hosting enabled

### Install dependencies

```bash
npm install
```

### Set up environment variables

Copy the example file and update the values for your Firebase and admin configuration:

```bash
cp .env.example .env
```

Then populate the values for:
- Firebase web config
- admin email
- Google Maps API key if needed

### Start the app locally

```bash
npm run dev
```

The app is usually served on:
- http://localhost:5173

## Available Scripts

```bash
npm run dev          # start the dev server
npm run build        # production build
npm run preview      # preview production build
npm run test         # run Vitest tests
npm run typecheck    # TypeScript validation
npm run lint         # ESLint check
npm run format       # format source files
npm run format:check # check formatting
```

## Firebase setup notes

This project expects a Firebase project configured with:
- Firestore
- Firebase Authentication
- Storage
- Hosting
- optional Cloud Functions for backend operations

The app includes Firebase rules and configuration files in the project root and src/firebase folder.

## Security and access model

The application includes role-aware access controls for:
- admins
- customers
- account-status-driven routing

Sensitive configuration and runtime credentials should never be committed. Use environment variables and keep secrets out of Git.

## Notes

This project is structured as a real-world bakery operations platform rather than a simple demo app. The codebase includes production-style concerns such as:
- role-based access
- analytics pages
- invoice generation logic
- payment tracking
- customer lifecycle workflows
- operational admin tools

## License

This project is currently set up for local development and project use as defined by the repository owner.

## Future improvements

Possible next steps for the project include:
- stronger automated tests across customer and admin flows
- more robust invoice/export automation
- notification and email workflow improvements
- deployment automation and CI/CD
- scalability tuning for larger bakery datasets

- **[🚀 Deployment Guide](docs/deployment.md)** - Complete Firebase deployment instructions
- **[⚙️ Environment Setup](docs/environment-setup.md)** - Environment configuration for dev/staging/production
- **[📡 API Documentation](docs/api.md)** - Firebase Cloud Functions API reference
- **[🤝 Contributing Guide](docs/contributing.md)** - Development workflow and standards
- **[✅ Production Readiness](docs/production-readiness.md)** - Comprehensive go-live checklist
- **[💼 Business Overview](docs/business-overview.md)** - Commercial value and market opportunity
- **[🔐 Admin Authorization Model](docs/admin-auth-model.md)** - How admin access is granted and enforced

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

See [`docs/admin-auth-model.md`](docs/admin-auth-model.md) for the complete admin authorization model including:
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
