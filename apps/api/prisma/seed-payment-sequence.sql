-- Seed initial payment account number sequence
INSERT INTO payment_account_number_sequences (id, "currentValue", "lastUpdatedAt")
VALUES (1, 221, NOW())
ON CONFLICT (id) DO NOTHING;

-- Verification
DO $$
DECLARE
    v_sequence_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO v_sequence_count FROM payment_account_number_sequences WHERE id = 1;
    
    IF v_sequence_count > 0 THEN
        RAISE NOTICE '✓ Payment account number sequence seeded successfully';
    ELSE
        RAISE WARNING '✗ Payment account number sequence not created';
    END IF;
END $$;

