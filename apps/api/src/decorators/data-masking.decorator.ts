import { SetMetadata } from '@nestjs/common';

/**
 * Metadata key for data masking
 */
export const DATA_MASKING_KEY = 'dataMasking';

/**
 * Decorator to enable data masking for Brand Ambassadors
 */
export const EnableDataMasking = () => SetMetadata(DATA_MASKING_KEY, true);

/**
 * Decorator to disable data masking (for admin endpoints)
 */
export const DisableDataMasking = () => SetMetadata(DATA_MASKING_KEY, false);
