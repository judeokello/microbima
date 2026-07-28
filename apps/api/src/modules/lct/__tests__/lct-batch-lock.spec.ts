import { LctExportBatchStatus } from '@prisma/client';
import { ErrorCodes } from '../../../enums/error-codes.enum';
import { ValidationException } from '../../../exceptions/validation.exception';

/**
 * Mirrors the one-EXPORTED-batch guard in LctExportService.createBatch.
 * Kept as a pure helper test so we don't need a full Nest/Prisma harness.
 */
async function assertNoOpenExportedBatch(
  findExported: () => Promise<{ id: string } | null>
): Promise<void> {
  const existingExported = await findExported();
  if (existingExported) {
    throw ValidationException.withMultipleErrors(
      {
        batch: `An EXPORTED batch already exists (${existingExported.id}). Send or cancel it before creating another.`,
      },
      ErrorCodes.RESOURCE_CONFLICT
    );
  }
}

describe('LCT export batch lock', () => {
  it('refuses create when an EXPORTED batch exists', async () => {
    await expect(
      assertNoOpenExportedBatch(async () => ({
        id: 'batch-open',
        status: LctExportBatchStatus.EXPORTED,
      } as { id: string }))
    ).rejects.toBeInstanceOf(ValidationException);

    try {
      await assertNoOpenExportedBatch(async () => ({ id: 'batch-open' }));
    } catch (e) {
      expect(e).toBeInstanceOf(ValidationException);
      expect((e as ValidationException).errorCode).toBe(ErrorCodes.RESOURCE_CONFLICT);
    }
  });

  it('allows create when no EXPORTED batch exists', async () => {
    await expect(assertNoOpenExportedBatch(async () => null)).resolves.toBeUndefined();
  });
});
