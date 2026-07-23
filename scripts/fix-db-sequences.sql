-- Sync all Postgres identity/serial sequences in the `public` schema to MAX(id).
--
-- Why this is needed for local dev:
-- The Prisma seed inserts rows with EXPLICIT integer ids (e.g. underwriters 1..3),
-- which does NOT advance the backing sequences. As a result the app's first inserts
-- collide with existing ids and fail with:
--   "A record with this id already exists"
-- Running this after seeding fixes every affected table at once.
--
-- Usage (against the local Supabase Postgres):
--   docker exec -e PGPASSWORD=postgres -i supabase_db_microbima \
--     psql -U postgres -d postgres < scripts/fix-db-sequences.sql

DO $$
DECLARE
  r RECORD; seq TEXT; maxid BIGINT;
BEGIN
  FOR r IN
    SELECT c.table_name, c.column_name
    FROM information_schema.columns c
    JOIN information_schema.tables t
      ON t.table_schema = c.table_schema AND t.table_name = c.table_name
    WHERE c.table_schema = 'public'
      AND t.table_type = 'BASE TABLE'
      AND c.column_default LIKE 'nextval(%'
  LOOP
    BEGIN
      seq := pg_get_serial_sequence(format('public.%I', r.table_name), r.column_name);
      IF seq IS NOT NULL THEN
        EXECUTE format('SELECT COALESCE(MAX(%I),0) FROM public.%I', r.column_name, r.table_name) INTO maxid;
        IF maxid > 0 THEN
          EXECUTE format('SELECT setval(%L, %s, true)', seq, maxid);
          RAISE NOTICE 'Set % -> %', seq, maxid;
        END IF;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'SKIP %.% : %', r.table_name, r.column_name, SQLERRM;
    END;
  END LOOP;
END $$;
