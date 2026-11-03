DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'new_host_app') THEN
    CREATE ROLE new_host_app NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS INHERIT;
  END IF;
END $$;

ALTER ROLE new_host_app NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS INHERIT;
GRANT USAGE ON SCHEMA public TO new_host_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO new_host_app;
GRANT USAGE, SELECT, UPDATE ON ALL SEQUENCES IN SCHEMA public TO new_host_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO new_host_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT, UPDATE ON SEQUENCES TO new_host_app;

DO $$
DECLARE
  tbl RECORD;
BEGIN
  FOR tbl IN
    SELECT c.table_name
    FROM information_schema.columns c
    WHERE c.table_schema = 'public' AND c.column_name = 'tenantId'
    GROUP BY c.table_name
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', tbl.table_name);
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation ON public.%I', tbl.table_name);

    IF tbl.table_name = 'tenant_memberships' THEN
      EXECUTE format(
        'CREATE POLICY tenant_isolation ON public.%I
         USING (
           "userId" = NULLIF(current_setting(''app.user_id'', true), '''')
           OR "tenantId" = NULLIF(current_setting(''app.tenant_id'', true), '''')
         )
         WITH CHECK (
           "userId" = NULLIF(current_setting(''app.user_id'', true), '''')
           OR "tenantId" = NULLIF(current_setting(''app.tenant_id'', true), '''')
         )',
        tbl.table_name
      );
    ELSE
      EXECUTE format(
        'CREATE POLICY tenant_isolation ON public.%I
         USING (
           "tenantId" = NULLIF(current_setting(''app.tenant_id'', true), '''')
           AND EXISTS (
             SELECT 1 FROM public.tenant_memberships m
             WHERE m."tenantId" = %I."tenantId"
               AND m."userId" = NULLIF(current_setting(''app.user_id'', true), '''')
           )
         )
         WITH CHECK (
           "tenantId" = NULLIF(current_setting(''app.tenant_id'', true), '''')
           AND EXISTS (
             SELECT 1 FROM public.tenant_memberships m
             WHERE m."tenantId" = %I."tenantId"
               AND m."userId" = NULLIF(current_setting(''app.user_id'', true), '''')
           )
         )',
        tbl.table_name, tbl.table_name, tbl.table_name
      );
    END IF;
  END LOOP;
END $$;

ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON public.tenants;
CREATE POLICY tenant_isolation ON public.tenants
  USING (
    id = NULLIF(current_setting('app.tenant_id', true), '')
    OR EXISTS (
      SELECT 1 FROM public.tenant_memberships m
      WHERE m."tenantId" = tenants.id
        AND m."userId" = NULLIF(current_setting('app.user_id', true), '')
    )
  )
  WITH CHECK (
    id = NULLIF(current_setting('app.tenant_id', true), '')
    AND NULLIF(current_setting('app.user_id', true), '') IS NOT NULL
  );

-- Financial and security audit events are append-only for the application role.
REVOKE UPDATE, DELETE ON TABLE public.audit_events FROM new_host_app;
