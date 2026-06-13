-- Set default waiting period (days) on all package_scheme rows that have not been configured yet.
-- Run after migration 20260612120000_payment_sms_and_scheme_waiting_period.

UPDATE package_schemes
SET "generalSchemeWaitingPeriod" = 30
WHERE "generalSchemeWaitingPeriod" IS NULL;
