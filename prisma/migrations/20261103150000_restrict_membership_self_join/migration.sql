-- A signed-in member may only create their own initial membership in the
-- currently selected tenant. Membership updates/deletes remain unavailable
-- until a dedicated invitation and role-administration workflow is implemented.
DROP POLICY IF EXISTS tenant_isolation ON public.tenant_memberships;
CREATE POLICY tenant_isolation ON public.tenant_memberships
  USING (
    "userId" = NULLIF(current_setting('app.user_id', true), '')
    OR "tenantId" = NULLIF(current_setting('app.tenant_id', true), '')
  )
  WITH CHECK (
    "tenantId" = NULLIF(current_setting('app.tenant_id', true), '')
    AND "userId" = NULLIF(current_setting('app.user_id', true), '')
  );

REVOKE UPDATE, DELETE ON TABLE public.tenant_memberships FROM new_host_app;
