/**
 * Validators - Pure Validation Logic Layer
 * 
 * ✅ MARCH 10, 2026: Created during constants refactoring
 * - Extracted validation functions from /constants/validation.ts
 * - Pure functions with no side effects
 * - Fully testable
 * 
 * Usage:
 * ```typescript
 * import { isValidEmail, validatePaymentProofFile } from '@/services/validators';
 * 
 * if (!isValidEmail(email)) {
 *   throw new Error('Invalid email address');
 * }
 * 
 * const validation = validatePaymentProofFile(file);
 * if (!validation.isValid) {
 *   alert(validation.error);
 * }
 * ```
 * 
 * @author Bakery Order Management System
 */

export * from './inputValidator';
