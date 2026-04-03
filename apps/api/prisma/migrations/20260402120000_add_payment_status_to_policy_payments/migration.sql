-- CreateEnum: Add PaymentStatus enum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING_STK_CALLBACK', 'COMPLETED_PENDING_RECEIPT', 'COMPLETED');

-- AlterEnum: Add QUERY to MpesaPaymentSource
ALTER TYPE "MpesaPaymentSource" ADD VALUE 'QUERY';

-- AlterTable: Add paymentStatus column to policy_payments
ALTER TABLE "policy_payments" ADD COLUMN "paymentStatus" "PaymentStatus" NOT NULL DEFAULT 'PENDING_STK_CALLBACK';
