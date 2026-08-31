# 📡 API Documentation

This document describes the Firebase Cloud Functions API endpoints for the Delight Bakehouse system.

## Overview

The system uses Firebase Cloud Functions to handle server-side logic, including:
- Order processing and notifications
- PDF invoice generation
- Email notifications
- Data validation and business logic
- Scheduled tasks and automation

## Function Endpoints

### Order Management

#### `processOrder`
Processes new orders and handles business logic validation.

**Trigger:** Firestore document creation (`orders/{orderId}`)

**Input:**
```typescript
interface OrderData {
  customerId: string;
  items: OrderItem[];
  deliveryDate: Timestamp;
  totalAmount: number;
  status: OrderStatus;
  // ... other order fields
}
```

**Actions:**
- Validates order data against business rules
- Updates customer credit balance
- Sends confirmation notifications
- Creates audit trail entries

**Error Handling:**
- Invalid order data → Function throws error
- Insufficient credit → Order rejected
- Business rule violations → Validation errors

#### `updateOrderStatus`
Handles order status transitions and notifications.

**Trigger:** Firestore document update (`orders/{orderId}`)

**Input:**
```typescript
interface StatusUpdate {
  previousStatus: OrderStatus;
  newStatus: OrderStatus;
  updatedBy: string;
  timestamp: Timestamp;
}
```

**Actions:**
- Validates status transition rules
- Sends appropriate notifications
- Updates related documents
- Logs status changes

### Notification System

#### `sendOrderNotification`
Sends email/SMS notifications for order events.

**Trigger:** Firestore document changes

**Supported Events:**
- Order created
- Order approved/rejected
- Order status updates
- Payment confirmations
- Delivery notifications

**Configuration:**
```typescript
interface NotificationConfig {
  emailEnabled: boolean;
  smsEnabled: boolean;
  templates: NotificationTemplates;
}
```

### Document Generation

#### `generateInvoice`
Creates PDF invoices for completed orders.

**Trigger:** HTTPS callable function

**Input:**
```typescript
interface InvoiceRequest {
  orderId: string;
  includeGST: boolean;
  format: 'pdf' | 'html';
}
```

**Output:**
```typescript
interface InvoiceResponse {
  downloadUrl: string;
  invoiceNumber: string;
  generatedAt: Timestamp;
}
```

**Features:**
- GST calculation and display
- Company branding
- Order details and pricing
- Download links with expiration

#### `generateReport`
Creates business reports (sales, customer, inventory).

**Trigger:** HTTPS callable function

**Input:**
```typescript
interface ReportRequest {
  type: 'sales' | 'customers' | 'inventory';
  dateRange: {
    start: Timestamp;
    end: Timestamp;
  };
  format: 'pdf' | 'xlsx' | 'csv';
}
```

### Customer Management

#### `processCustomerRegistration`
Handles new customer registration workflow.

**Trigger:** Firestore document creation (`customers/{customerId}`)

**Actions:**
- Validates customer data
- Sets initial account status
- Sends welcome notifications
- Creates default preferences

#### `updateCustomerCredit`
Manages customer credit balance updates.

**Trigger:** Firestore document updates

**Business Logic:**
- Credit limit validation
- Payment processing
- Overdue account handling
- Credit history tracking

### Scheduled Tasks

#### `dailyOrderSummary`
Generates daily order summaries and reports.

**Trigger:** Scheduled (daily at 6 AM)

**Actions:**
- Aggregates previous day's orders
- Calculates revenue metrics
- Sends summary emails to admins
- Updates dashboard data

#### `creditReminderNotifications`
Sends payment reminders for overdue accounts.

**Trigger:** Scheduled (daily at 9 AM)

**Configuration:**
- Grace period settings
- Reminder frequency
- Escalation thresholds

## Authentication & Security

### Function Security

All functions implement security measures:

- **Authentication Required:** Functions validate Firebase Auth tokens
- **Authorization Checks:** Role-based access control
- **Input Validation:** Zod schema validation for all inputs
- **Rate Limiting:** Prevents abuse with configurable limits
- **Audit Logging:** All function calls are logged

### HTTPS Callable Functions

For client-side calls, use Firebase SDK:

```typescript
import { httpsCallable } from 'firebase/functions';

const generateInvoice = httpsCallable(functions, 'generateInvoice');
const result = await generateInvoice({
  orderId: 'order123',
  includeGST: true,
  format: 'pdf'
});
```

### Error Handling

Functions return standardized error responses:

```typescript
interface FunctionError {
  code: string;
  message: string;
  details?: any;
}
```

**Common Error Codes:**
- `INVALID_ARGUMENT` - Invalid input parameters
- `PERMISSION_DENIED` - Insufficient permissions
- `NOT_FOUND` - Resource not found
- `INTERNAL` - Server errors

## Monitoring & Logging

### Cloud Logging

All functions log to Google Cloud Logging:

```typescript
// Automatic logging
console.log('Order processed:', orderId);

// Structured logging
logger.info('Order status updated', {
  orderId,
  previousStatus,
  newStatus,
  userId
});
```

### Performance Monitoring

Functions are monitored for:
- Execution time
- Memory usage
- Error rates
- Cold start frequency

### Alerting

Set up alerts for:
- Function failures
- High error rates
- Performance degradation
- Resource exhaustion

## Development

### Local Testing

Test functions locally using Firebase emulators:

```bash
# Start emulators
firebase emulators:start

# Run function tests
npm test
```

### Deployment

Deploy functions with Firebase CLI:

```bash
# Deploy all functions
firebase deploy --only functions

# Deploy specific function
firebase deploy --only functions:processOrder
```

### Function Configuration

Configure in `firebase.json`:

```json
{
  "functions": {
    "runtime": "nodejs20",
    "predeploy": ["npm --prefix functions run build"],
    "source": "functions/lib"
  }
}
```

## Dependencies

Key function dependencies:

```json
{
  "dependencies": {
    "firebase-admin": "^12.0.0",
    "firebase-functions": "^5.0.0",
    "zod": "^3.22.0",
    "pdfkit": "^0.14.0",
    "nodemailer": "^6.9.0"
  }
}
```

## Best Practices

### Performance
- Use async/await for all operations
- Implement proper error handling
- Cache frequently accessed data
- Use batch operations for multiple writes

### Security
- Validate all inputs
- Use Firebase security rules
- Implement proper authentication
- Log security events

### Reliability
- Implement retry logic for external calls
- Use transactions for related operations
- Handle partial failures gracefully
- Monitor function health

### Maintainability
- Keep functions focused and single-purpose
- Use TypeScript for type safety
- Document function interfaces
- Write comprehensive tests

## Troubleshooting

### Common Issues

**Cold Start Delays:**
- Optimize imports
- Reduce bundle size
- Use connection pooling

**Memory Issues:**
- Process data in batches
- Clean up resources
- Monitor memory usage

**Timeout Errors:**
- Break long operations into smaller functions
- Use async processing for heavy tasks
- Implement progress tracking

### Debugging

Use Firebase console and logs:

```bash
# View function logs
firebase functions:log

# Debug locally
firebase functions:shell
```

---

**Last updated:** December 2024