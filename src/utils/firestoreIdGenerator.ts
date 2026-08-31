/**
 * firestoreIdGenerator — compatibility shim → delegates to idCounterService
 * Format: PREFIX-YYYY-MM-DD-NNN-CC
 */
import { getNextId } from '../services/idCounterService';

export type IdPrefix = 'ORD' | 'CUST' | 'DBH';
const MAP: Record<IdPrefix, 'orders'|'customers'|'invoices'> = {
  ORD: 'orders', CUST: 'customers', DBH: 'invoices',
};
export async function getNextId_compat(prefix: IdPrefix): Promise<string> {
  return getNextId(MAP[prefix]);
}
// Keep old export name working
export { getNextId_compat as getNextId };
