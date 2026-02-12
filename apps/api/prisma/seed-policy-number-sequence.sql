-- Seed policy_number_sequences for all existing packages
-- Loops over all packages and inserts with last_sequence = 0
-- Use ON CONFLICT DO NOTHING so existing records (e.g. manually updated) are preserved
-- For production: run this after migration, then manually UPDATE last_sequence per package to the desired value

INSERT INTO policy_number_sequences ("packageId", "lastSequence")
SELECT id, 0 FROM packages
ON CONFLICT ("packageId") DO NOTHING;

-- Verification
DO $$
DECLARE
    v_count INTEGER;
    v_package_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO v_package_count FROM "packages";
    SELECT COUNT(*) INTO v_count FROM "policy_number_sequences";

    IF v_count >= v_package_count THEN
        RAISE NOTICE '✓ Policy number sequences seeded: % sequence(s) for % package(s)', v_count, v_package_count;
    ELSE
        RAISE WARNING '✗ Expected % sequences for % packages, got %', v_package_count, v_package_count, v_count;
    END IF;
END $$;
