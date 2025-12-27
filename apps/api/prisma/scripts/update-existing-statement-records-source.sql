-- T028: Update existing statement records to set source = 'STATEMENT'
-- 
-- This script updates all existing MpesaPaymentReportItem records that have
-- a mpesaPaymentReportUploadId set (indicating they came from statement uploads)
-- to have source = 'STATEMENT'.
--
-- Run this script after the migration that adds the source field.
-- This is a one-time data fix to backfill the source field for existing records.
--
-- Usage:
--   psql -d your_database -f update-existing-statement-records-source.sql
--   OR
--   npx prisma db execute --file prisma/scripts/update-existing-statement-records-source.sql

-- Update all existing statement records to have source = 'STATEMENT'
UPDATE mpesa_payment_report_items
SET source = 'STATEMENT'
WHERE mpesa_payment_report_upload_id IS NOT NULL
  AND (source IS NULL OR source = 'IPN'); -- Only update if source is not already set correctly

-- Verify the update
SELECT 
  source,
  COUNT(*) as count
FROM mpesa_payment_report_items
WHERE mpesa_payment_report_upload_id IS NOT NULL
GROUP BY source;


