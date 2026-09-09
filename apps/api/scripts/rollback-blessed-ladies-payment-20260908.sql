-- Rollback Blessed Ladies postpaid batch 28 (UI2NE50357) and Josephine's IPN (UHQHA40KXD)
-- so the CSV can be re-uploaded AFTER this branch is deployed, and Josephine can be
-- remapped from the admin UI after paymentAcNumber is corrected.
--
-- Does NOT delete customers, policies, parents, or any other payments.
-- Do not re-upload the Blessed Ladies CSV until parent joiners + customer-status
-- + D/M/Y date parsing are in production.

BEGIN;

DELETE FROM postpaid_scheme_payment_items WHERE "postpaidSchemePaymentId" = 28;
DELETE FROM policy_payments WHERE "transactionReference" LIKE 'postpaid-UI2NE50357-%';
DELETE FROM postpaid_scheme_payments WHERE id = 28 AND "transactionReference" = 'UI2NE50357';
UPDATE mpesa_payment_report_items
SET "isMapped" = false, "isProcessed" = false
WHERE "transactionReference" = 'UI2NE50357';

DELETE FROM policy_payments WHERE "transactionReference" = 'UHQHA40KXD';
UPDATE mpesa_payment_report_items
SET "isMapped" = false, "isProcessed" = false
WHERE "transactionReference" = 'UHQHA40KXD';

COMMIT;
