/**
 * TEST FILE - Verify schema exports after subcollection migration
 * This file should be deleted after verifying the fix works
 */

import {
  createOrderInputSchema,
  updateOrderInputSchema,
  type CreateOrderInput,
  type UpdateOrderInput,
} from './schemas';
import { logger } from './utils/logger';


// If this compiles without errors, the exports are working correctly
logger.log('createOrderInputSchema:', typeof createOrderInputSchema);
logger.log('updateOrderInputSchema:', typeof updateOrderInputSchema);

export {};
