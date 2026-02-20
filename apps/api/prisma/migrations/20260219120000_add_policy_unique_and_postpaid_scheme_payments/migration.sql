-- Add unique constraint: one policy per customer per package
CREATE UNIQUE INDEX IF NOT EXISTS "policies_customer_id_package_id_key" ON "policies"("customerId", "packageId");

-- Extend PaymentType enum for postpaid scheme payments
ALTER TYPE "PaymentType" ADD VALUE IF NOT EXISTS 'BANK_TRANSFER';
ALTER TYPE "PaymentType" ADD VALUE IF NOT EXISTS 'CHEQUE';

-- CreateTable: postpaid_scheme_payments
CREATE TABLE "postpaid_scheme_payments" (
    "id" SERIAL NOT NULL,
    "schemeId" INTEGER NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "paymentType" "PaymentType" NOT NULL,
    "transactionReference" VARCHAR(35) NOT NULL,
    "createdBy" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "postpaid_scheme_payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable: postpaid_scheme_payment_items
CREATE TABLE "postpaid_scheme_payment_items" (
    "id" SERIAL NOT NULL,
    "postpaidSchemePaymentId" INTEGER NOT NULL,
    "policyPaymentId" INTEGER NOT NULL,

    CONSTRAINT "postpaid_scheme_payment_items_pkey" PRIMARY KEY ("id")
);

-- Unique constraint on transactionReference for postpaid_scheme_payments
CREATE UNIQUE INDEX "postpaid_scheme_payments_transactionReference_key" ON "postpaid_scheme_payments"("transactionReference");

-- Unique constraint on policyPaymentId (one item per policy payment)
CREATE UNIQUE INDEX "postpaid_scheme_payment_items_policyPaymentId_key" ON "postpaid_scheme_payment_items"("policyPaymentId");

-- AddForeignKey
ALTER TABLE "postpaid_scheme_payments" ADD CONSTRAINT "postpaid_scheme_payments_schemeId_fkey" FOREIGN KEY ("schemeId") REFERENCES "schemes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey (policy_payments.id is the PK; PolicyPayment uses Int id)
ALTER TABLE "postpaid_scheme_payment_items" ADD CONSTRAINT "postpaid_scheme_payment_items_postpaidSchemePaymentId_fkey" FOREIGN KEY ("postpaidSchemePaymentId") REFERENCES "postpaid_scheme_payments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "postpaid_scheme_payment_items" ADD CONSTRAINT "postpaid_scheme_payment_items_policyPaymentId_fkey" FOREIGN KEY ("policyPaymentId") REFERENCES "policy_payments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
