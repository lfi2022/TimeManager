-- Locate at most two active tenant accounts for an e-mail without exposing credentials.
-- Execution is restricted to the database role that applies migrations.
CREATE FUNCTION "auth_user_tenant_by_email"(requested_email TEXT)
RETURNS TABLE ("userId" UUID, "companyId" UUID)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT u."id", u."companyId"
  FROM public."User" u
  INNER JOIN public."Company" c ON c."id" = u."companyId"
  WHERE lower(u."email") = lower(requested_email)
    AND u."active" = true
    AND c."active" = true
  ORDER BY u."id"
  LIMIT 2
$$;
REVOKE ALL ON FUNCTION "auth_user_tenant_by_email"(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION "auth_user_tenant_by_email"(TEXT) TO CURRENT_USER;