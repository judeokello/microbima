-- CreateEnum
CREATE TYPE "MpesaStatementReasonType" AS ENUM ('PayBill_STK', 'Ratiba', 'Paybill_MobileApp', 'PayBill_Fuliza_STK', 'PayBill_Fuliza_Online', 'Withdrawal', 'Unmapped');

-- CreateTable
CREATE TABLE "mpesa_payment_report_uploads" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "accountHolder" VARCHAR(100) NOT NULL,
    "shortCode" VARCHAR(100),
    "account" VARCHAR(50),
    "timeFrom" TIMESTAMP(3) NOT NULL,
    "timeTo" TIMESTAMP(3) NOT NULL,
    "operator" VARCHAR(100),
    "openingBalance" DECIMAL(10,2),
    "closingBalance" DECIMAL(10,2),
    "availableBalance" DECIMAL(10,2),
    "totalPaidIn" DECIMAL(10,2),
    "totalWithdrawn" DECIMAL(10,2),
    "filePath" VARCHAR(500),
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mpesa_payment_report_uploads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mpesa_payment_report_items" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "mpesaPaymentReportUploadId" UUID NOT NULL,
    "transactionReference" VARCHAR(50) NOT NULL,
    "completionTime" TIMESTAMP(3) NOT NULL,
    "initiationTime" TIMESTAMP(3) NOT NULL,
    "paymentDetails" VARCHAR(500),
    "transactionStatus" VARCHAR(100),
    "paidIn" DECIMAL(10,2) NOT NULL,
    "withdrawn" DECIMAL(10,2) NOT NULL,
    "accountBalance" DECIMAL(10,2) NOT NULL,
    "balanceConfirmed" VARCHAR(20),
    "reasonType" "MpesaStatementReasonType" NOT NULL,
    "otherPartyInfo" VARCHAR(500),
    "linkedTransactionId" VARCHAR(100),
    "accountNumber" VARCHAR(100),
    "isProcessed" BOOLEAN NOT NULL DEFAULT false,
    "isMapped" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mpesa_payment_report_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_transaction_reference" ON "mpesa_payment_report_items"("transactionReference");

-- CreateIndex
CREATE INDEX "idx_mpesa_payment_report_upload_id" ON "mpesa_payment_report_items"("mpesaPaymentReportUploadId");

-- AddForeignKey
ALTER TABLE "mpesa_payment_report_items" ADD CONSTRAINT "mpesa_payment_report_items_mpesaPaymentReportUploadId_fkey" FOREIGN KEY ("mpesaPaymentReportUploadId") REFERENCES "mpesa_payment_report_uploads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

