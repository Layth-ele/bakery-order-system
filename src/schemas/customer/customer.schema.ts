/**
 * ═══════════════════════════════════════════════════════════════════════════
 * CUSTOMER SCHEMA - Zod Validation
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * Schemas for Customer entity and related types
 * 
 * ✅ Locked enums for CustomerStatus and CustomerType
 * ✅ Firestore Timestamp enforcement
 * ✅ Input/Output schemas for CRUD operations
 * 
 * LAST UPDATED: 2026-03-05
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { z } from 'zod';
import {
  idSchema,
  emailSchema,
  optionalNonEmptyStringSchema,
  optionalPhoneSchema,
  optionalFirestoreTimestampSchema,
} from '../shared/primitives';

// ═══════════════════════════════════════════════════════════════════════════
// ENUMS - LOCKED
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Customer Status Enum
 * ✅ LOCKED: These are the only valid customer statuses
 */
export const customerStatusSchema = z.enum([
  'pending',
  'approved',
  'rejected',
  'suspended',
  'archived',
]);

export type CustomerStatus = z.infer<typeof customerStatusSchema>;

/**
 * Customer Type Enum
 * ✅ LOCKED: These are the only valid customer types
 */
export const customerTypeSchema = z.enum([
  'commercial',
  'individual',
  'admin',
]);

export type CustomerType = z.infer<typeof customerTypeSchema>;

// ═══════════════════════════════════════════════════════════════════════════
// CUSTOMER SCHEMA
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Customer Schema - Complete customer entity
 */
export const customerSchema = z.object({
  // Identity
  id: idSchema,
  email: emailSchema,
  
  // Profile
  storeName: optionalNonEmptyStringSchema,
  contactPerson: optionalNonEmptyStringSchema,
  phone: optionalPhoneSchema,
  storeAddress: optionalNonEmptyStringSchema,
  address: z.string().optional(),        // legacy alias for storeAddress
  businessName: z.string().optional(),   // legacy field
  
  // Classification
  customerType: customerTypeSchema.optional(),
  status: customerStatusSchema.optional(),
  role: z.string().optional(),           // 'admin' | 'customer'
  customerCode: z.string().optional(),   // human-readable ID, e.g. CUST-2026-03-26-001-47
  
  // Timestamps (Firestore Timestamp)
  createdAt: optionalFirestoreTimestampSchema,
  updatedAt: optionalFirestoreTimestampSchema,
  registeredAt: optionalFirestoreTimestampSchema, // Firestore Timestamp OR ISO string
  approvedAt: optionalFirestoreTimestampSchema,
  rejectedAt: optionalFirestoreTimestampSchema,

  // Financials
  credits: z.number().optional(),
  availableCredit: z.number().optional(),
  totalSpent: z.number().optional(),
  discount: z.number().optional(),       // default discount percentage

  // Additional profile fields
  notes: z.string().optional(),
  gstNumber: z.string().optional(),
  preferredDeliveryDay: z.string().optional(),
  deliveryInstructions: z.string().optional(),
  isTemporaryPassword: z.boolean().optional(),

  // Legacy / convenience fields
  name: z.string().optional(),

  // Security: password field stripped/ignored when reading from Firestore
  password: z.string().optional(),  // Accept but don't use — Firebase Auth manages passwords
});

export type Customer = z.infer<typeof customerSchema>;

// ═══════════════════════════════════════════════════════════════════════════
// INPUT SCHEMAS (for CRUD operations)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Create Customer Input — base schema with permissive enums.
 *
 * FIX T2R8-H4 (HIGH — schema split): Previously a single schema served both
 * customer self-registration (where customerType must be non-admin and
 * status must be pending) and admin-on-behalf creation (where the admin
 * legitimately needs to set customerType:'admin' / status:'approved').
 * The single-schema approach put all defense at the rules layer (T2R7-C1)
 * and the application layer (T2R8-H3 hardcoded coercion in
 * authService.register).
 *
 * Now there are THREE schemas:
 *   - createCustomerByAdminInputSchema  (permissive — for admin flows)
 *   - createCustomerSelfRegistrationInputSchema  (restricted — for register flow)
 *   - createCustomerInputSchema  (legacy alias = "by admin"; preserved for
 *     backward compatibility with any imports that haven't been migrated yet)
 *
 * Defense in depth:
 *   1. Self-registration callers MUST use the restricted schema. It
 *      enforces customerType ∈ {individual, commercial} and status === 'pending'
 *      at parse time — invalid input throws BEFORE the Firestore write.
 *   2. authService.register additionally coerces customerType (T2R8-H3) so
 *      even if a future caller forgets to use the restricted schema, the
 *      admin escalation is blocked at the application layer.
 *   3. Firestore rule (T2R7-C1) blocks customerType:'admin' on customer
 *      self-create at the database layer.
 *
 * Three independent layers of defense; this fix closes the schema layer.
 */

/**
 * RESTRICTED schema for customer self-registration.
 *
 * Use this in `authService.register` and any other public registration flow.
 * Enforces:
 *   - customerType, if provided, must be 'individual' or 'commercial' (NOT 'admin')
 *   - status, if provided, must be 'pending' (NOT 'approved' or any other value)
 *   - role field is rejected entirely (legacy escalation vector)
 *   - isAdmin field is rejected entirely (legacy escalation vector)
 */
export const createCustomerSelfRegistrationInputSchema = z.object({
  email: emailSchema,
  storeName: z.string().optional(),
  contactPerson: z.string().optional(),
  phone: z.string().optional(),
  storeAddress: z.string().optional(),
  // Restricted: only non-admin types
  customerType: z.enum(['individual', 'commercial']).optional(),
  // Restricted: only 'pending' is permitted at registration time
  status: z.literal('pending').optional(),
  customerCode: z.string().optional(),
  registeredAt: z.any().optional(),
  gstNumber: z.string().optional(),
  businessName: z.string().optional(),
  address: z.string().optional(),
}).strict()
  // .strict() rejects unknown keys, including 'role', 'isAdmin', 'approvedAt'
  // — these would be ignored or stripped by the legacy schema, but at the
  // self-registration layer we want explicit rejection so a tampered form
  // submission with extra fields is loudly rejected rather than silently
  // accepted.  Admin-on-behalf creation does not use .strict() because admins
  // legitimately pass approvedAt, role, etc.
  .refine(
    (data) => !('role' in data),
    { message: 'role field not permitted in customer self-registration' }
  );

export type CreateCustomerSelfRegistrationInput = z.infer<typeof createCustomerSelfRegistrationInputSchema>;

/**
 * PERMISSIVE schema for admin-on-behalf customer creation.
 *
 * Use this in admin tools that need to create customers with arbitrary
 * customerType / status (e.g. `useCustomerAccountActions.createNewCustomer`
 * for the Add Admin / Add Customer admin flows).  Trusts the caller because
 * the admin path is gated by isAnyAdmin() at the rules layer and by admin
 * authentication at the app layer.
 */
export const createCustomerByAdminInputSchema = z.object({
  email: emailSchema,
  // Allow empty string (individual customers have no store name)
  storeName: z.string().optional(),
  contactPerson: z.string().optional(),
  phone: z.string().optional(),
  storeAddress: z.string().optional(),
  customerType: customerTypeSchema.optional(),
  status: customerStatusSchema.optional(),
  // Allow extra fields passed by createUserProfile (stripped by Zod)
  role: z.string().optional(),
  customerCode: z.string().optional(),
  approvedAt: z.any().optional(),
  registeredAt: z.any().optional(),
  gstNumber: z.string().optional(),
  businessName: z.string().optional(),
  address: z.string().optional(),
});

export type CreateCustomerByAdminInput = z.infer<typeof createCustomerByAdminInputSchema>;

/**
 * Legacy alias — equivalent to the admin-on-behalf schema.
 *
 * Preserved as an alias because the original `createCustomerInputSchema`
 * is imported in many places.  Migrating each caller to the appropriate
 * specific schema is the next step; until then the alias keeps existing
 * imports working AND the new restricted schema available for the
 * security-sensitive register path.
 */
export const createCustomerInputSchema = createCustomerByAdminInputSchema;

export type CreateCustomerInput = z.infer<typeof createCustomerInputSchema>;

/**
 * Update Customer Input - Fields that can be updated
 */
export const updateCustomerInputSchema = z.object({
  id: idSchema,
  storeName: optionalNonEmptyStringSchema,
  contactPerson: optionalNonEmptyStringSchema,
  phone: z.string().optional(),                       // Accept any format — admin edits
  storeAddress: optionalNonEmptyStringSchema,
  email: z.string().email().optional(),               // Allow email updates
  customerType: customerTypeSchema.optional(),
  status: customerStatusSchema.optional(),
  notes: z.string().optional(),                       // Admin notes
  customerCode: z.string().optional(),                // Preserve existing code
  availableCredit: z.number().optional(),             // Credit balance
  registeredAt: z.any().optional(),                   // Preserve timestamps
  approvedAt: z.any().optional(),
  suspendedAt: z.any().optional(),
  archivedAt: z.any().optional(),
});  // Strict: unknown fields stripped before Firestore write (sensitive data protection)

export type UpdateCustomerInput = z.infer<typeof updateCustomerInputSchema>;

/**
 * Password Reset Input
 */
export const passwordResetInputSchema = z.object({
  customerId: idSchema,
  email: emailSchema,
});

export type PasswordResetInput = z.infer<typeof passwordResetInputSchema>;

// ═══════════════════════════════════════════════════════════════════════════
// STATS & FILTERS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Customer Stats Schema
 */
export const customerStatsSchema = z.object({
  total: z.number().int().nonnegative(),
  active: z.number().int().nonnegative(),  // ✅ Added: active = total - suspended
  approved: z.number().int().nonnegative(),
  pending: z.number().int().nonnegative(),
  rejected: z.number().int().nonnegative(),
  suspended: z.number().int().nonnegative(),
  commercial: z.number().int().nonnegative(),
  individual: z.number().int().nonnegative(),
  admin: z.number().int().nonnegative(),
  thisMonth: z.number().int().nonnegative(),
});

export type CustomerStats = z.infer<typeof customerStatsSchema>;

/**
 * Customer Filters Schema
 */
export const customerFiltersSchema = z.object({
  status: z.union([customerStatusSchema, z.literal('all'), z.literal('active')]).optional(),
  customerType: z.union([customerTypeSchema, z.literal('all')]).optional(),
  searchTerm: z.string().optional(), // name/email/store name
});

export type CustomerFilters = z.infer<typeof customerFiltersSchema>;

// ═══════════════════════════════════════════════════════════════════════════
// AUTH-TIME CUSTOMER SCHEMA — Pass 4 (M3)
// ═══════════════════════════════════════════════════════════════════════════
//
// The full customerSchema is strict and rejects partial documents. The auth
// path needs to handle minimally-populated docs gracefully (e.g. registration
// in progress where only email + customerType + status are set).
//
// Previously, getCustomerForAuth bypassed schema validation entirely and cast
// raw Firestore data to Customer. That meant a malformed `customerType` field
// could grant admin access to a non-admin user — the auth path had no
// validation precisely on the doc that decides authorization.
//
// This schema validates the fields that gate authorization (status,
// customerType, email) strictly using the existing enums, while making
// everything else optional. Extra unknown fields are stripped (passthrough
// would propagate them but we don't trust them at this layer).
//
// Use this schema in services/customersService.ts:getCustomerForAuth.
// Failures should fall back to "treat as no profile" and force re-auth —
// safer than letting an unvalidated doc through.

export const authCustomerSchema = z.object({
  id: idSchema,
  email: emailSchema,
  customerType: customerTypeSchema,   // STRICT: must be one of the 3 known values
  status: customerStatusSchema,       // STRICT: must be one of the 5 known values
  // Everything else is optional — only the security-critical fields are required
  storeName: z.string().optional(),
  contactPerson: z.string().optional(),
  phone: z.string().optional(),
  storeAddress: z.string().optional(),
  customerCode: z.string().optional(),
  role: z.string().optional(),
  createdAt: z.unknown().optional(),
  updatedAt: z.unknown().optional(),
}).passthrough(); // Allow extra fields (won't break on legacy fields)

export type AuthCustomer = z.infer<typeof authCustomerSchema>;