-- Lets the login flow identify an authenticated administrator of a disabled company
-- without exposing the company state to ordinary users.
CREATE FUNCTION "auth_suspended_admin_by_email"(requested_email TEXT)
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
    AND u."role" = 'ADMIN'
    AND c."active" = false
  LIMIT 2
$$;
REVOKE ALL ON FUNCTION "auth_suspended_admin_by_email"(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION "auth_suspended_admin_by_email"(TEXT) TO CURRENT_USER;