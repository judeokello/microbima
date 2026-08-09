-- Enable Row Level Security on all public tables and auto-enable RLS for
-- future CREATE TABLE statements via a Postgres event trigger.
--
-- Architecture note:
-- MicroBima accesses data through NestJS + Prisma (privileged DB role) and
-- occasional service_role Supabase clients. Those paths bypass RLS.
-- The Supabase Data API roles (anon / authenticated) must not read or write
-- application tables without explicit policies. Enabling RLS with no public
-- policies locks PostgREST while leaving Prisma unchanged.
--
-- Do NOT use FORCE ROW LEVEL SECURITY: that would subject the table owner
-- (used by Prisma migrations/runtime) to RLS and break the API.

-- 1) Enable RLS on every existing table in public
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT n.nspname AS schemaname, c.relname AS tablename
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind IN ('r', 'p') -- ordinary + partitioned tables
      AND NOT c.relrowsecurity
  LOOP
    EXECUTE format(
      'ALTER TABLE %I.%I ENABLE ROW LEVEL SECURITY',
      r.schemaname,
      r.tablename
    );
  END LOOP;
END $$;

-- 2) Defense in depth: revoke Data API table privileges from anon/authenticated.
-- service_role and the privileged Prisma role keep access.
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT n.nspname AS schemaname, c.relname AS tablename
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind IN ('r', 'p')
  LOOP
    EXECUTE format(
      'REVOKE ALL ON TABLE %I.%I FROM anon, authenticated',
      r.schemaname,
      r.tablename
    );
  END LOOP;
EXCEPTION
  WHEN undefined_object THEN
    -- Roles may be absent outside Supabase (e.g. plain local Postgres).
    RAISE NOTICE 'Skipping anon/authenticated revoke: role missing';
END $$;

-- Prevent future tables created by this role from auto-granting to API roles.
DO $$
BEGIN
  EXECUTE 'ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon, authenticated';
  EXECUTE 'ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon, authenticated';
EXCEPTION
  WHEN undefined_object THEN
    RAISE NOTICE 'Skipping default privilege revoke: role missing';
END $$;

-- 3) Event trigger: any new public table gets RLS enabled automatically.
CREATE OR REPLACE FUNCTION public.rls_auto_enable()
RETURNS event_trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE
  cmd record;
BEGIN
  FOR cmd IN
    SELECT *
    FROM pg_event_trigger_ddl_commands()
    WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      AND object_type IN ('table', 'partitioned table')
  LOOP
    IF cmd.schema_name = 'public' THEN
      BEGIN
        EXECUTE format(
          'ALTER TABLE IF EXISTS %s ENABLE ROW LEVEL SECURITY',
          cmd.object_identity
        );
        RAISE LOG 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE LOG 'rls_auto_enable: failed on %: %', cmd.object_identity, SQLERRM;
      END;
    END IF;
  END LOOP;
END;
$$;

DROP EVENT TRIGGER IF EXISTS ensure_rls_on_public_tables;
CREATE EVENT TRIGGER ensure_rls_on_public_tables
ON ddl_command_end
WHEN TAG IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
EXECUTE FUNCTION public.rls_auto_enable();

COMMENT ON FUNCTION public.rls_auto_enable() IS
  'Auto-enables ROW LEVEL SECURITY on new public tables (Supabase Data API lockdown). Prisma/service_role bypass RLS.';
