import { Prisma } from '@prisma/client';

/** Copy the one-NOK join from a source policy onto a superseding/renewed policy. */
export async function copyPolicyBeneficiaryJoins(
  tx: Prisma.TransactionClient,
  fromPolicyId: string,
  toPolicyId: string
): Promise<void> {
  const rows = await tx.policyBeneficiary.findMany({
    where: { policyId: fromPolicyId },
  });
  for (const row of rows) {
    await tx.policyBeneficiary.upsert({
      where: { policyId: toPolicyId },
      create: {
        policyId: toPolicyId,
        beneficiaryId: row.beneficiaryId,
        percentage: row.percentage,
      },
      update: { beneficiaryId: row.beneficiaryId, percentage: row.percentage },
    });
  }
}
