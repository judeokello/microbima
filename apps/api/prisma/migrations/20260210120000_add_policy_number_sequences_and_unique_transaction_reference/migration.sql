-- CreateTable
CREATE TABLE "policy_number_sequences" (
    "packageId" INTEGER NOT NULL,
    "lastSequence" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "policy_number_sequences_pkey" PRIMARY KEY ("packageId")
);

-- AddForeignKey
ALTER TABLE "policy_number_sequences" ADD CONSTRAINT "policy_number_sequences_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "packages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateUniqueIndex
CREATE UNIQUE INDEX "policy_payments_transactionReference_key" ON "policy_payments"("transactionReference");
