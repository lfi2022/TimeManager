-- Preserve FORCE ROW LEVEL SECURITY while allowing explicit platform company creation.
CREATE OR REPLACE FUNCTION "platform_create_company"(company_name TEXT, company_slug TEXT, company_timezone TEXT, company_locale TEXT)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE created_id UUID := gen_random_uuid();
BEGIN
  PERFORM set_config('app.company_id', created_id::text, true);
  INSERT INTO public."Company" ("id", "name", "slug", "active", "timezone", "locale", "createdAt", "updatedAt")
  VALUES (created_id, company_name, company_slug, true, company_timezone, company_locale, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
  RETURN created_id;
END;
$$;

CREATE OR REPLACE FUNCTION "platform_update_company"(target_id UUID, company_name TEXT, company_slug TEXT, company_active BOOLEAN, company_timezone TEXT, company_locale TEXT)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
BEGIN
  PERFORM set_config('app.company_id', target_id::text, true);
  UPDATE public."Company"
  SET "name" = company_name, "slug" = company_slug, "active" = company_active,
      "timezone" = company_timezone, "locale" = company_locale, "updatedAt" = CURRENT_TIMESTAMP
  WHERE "id" = target_id;
  RETURN FOUND;
END;
$$;
