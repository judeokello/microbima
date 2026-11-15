-- Waiting period is required and capped at 365 days.
-- Null rows must already be filled; this migration does not invent a default.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM package_schemes
    WHERE "generalSchemeWaitingPeriod" IS NULL
  ) THEN
    RAISE EXCEPTION 'package_schemes.generalSchemeWaitingPeriod still has NULL rows';
  END IF;
END $$;

ALTER TABLE "package_schemes"
  DROP CONSTRAINT IF EXISTS "package_schemes_generalSchemeWaitingPeriod_check";

ALTER TABLE "package_schemes"
  ALTER COLUMN "generalSchemeWaitingPeriod" SET NOT NULL;

ALTER TABLE "package_schemes"
  ADD CONSTRAINT "package_schemes_generalSchemeWaitingPeriod_check"
  CHECK (
    "generalSchemeWaitingPeriod" >= 0
    AND "generalSchemeWaitingPeriod" <= 365
  );
