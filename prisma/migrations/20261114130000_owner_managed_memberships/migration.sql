-- Permit the authenticated tenant OWNER to create memberships for other users.
-- Keep self-service initial membership creation unchanged and keep membership
-- UPDATE/DELETE unavailable to the application runtime role.
CREATE OR REPLACE FUNCTION public.current_user_is_tenant_owner(target_tenant_id text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.tenant_memberships AS owner_membership
    WHERE owner_membership."tenantId" = target_tenant_id
      AND owner_membership."userId" = NULLIF(current_setting('app.user_id', true), '')
      AND owner_membership.role::text = 'OWNER'
  );
$$;

REVOKE ALL ON FUNCTION public.current_user_is_tenant_owner(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_user_is_tenant_owner(text) TO new_host_app;

DROP POLICY IF EXISTS owner_managed_membership_insert ON public.tenant_memberships;
CREATE POLICY owner_managed_membership_insert
  ON public.tenant_memberships
  FOR INSERT
  WITH CHECK (
    "tenantId" = NULLIF(current_setting('app.tenant_id', true), '')
    AND (
      "userId" = NULLIF(current_setting('app.user_id', true), '')
      OR public.current_user_is_tenant_owner("tenantId")
    )
  );
