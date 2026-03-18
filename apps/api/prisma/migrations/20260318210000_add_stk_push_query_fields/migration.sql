-- AlterTable
ALTER TABLE "mpesa_stk_push_requests" ADD COLUMN     "queryAttemptCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "lastQueryAt" TIMESTAMP(3),
ADD COLUMN     "nextQueryAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "mpesa_stk_push_requests_status_nextQueryAt_queryAttemptCou_idx" ON "mpesa_stk_push_requests"("status", "nextQueryAt", "queryAttemptCount");
