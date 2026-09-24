CREATE TABLE "Team" (
  "id" UUID NOT NULL,
  "companyId" UUID NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Team_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Team_companyId_name_key" UNIQUE ("companyId", "name")
);
CREATE TABLE "TeamMember" (
  "id" UUID NOT NULL,
  "companyId" UUID NOT NULL,
  "teamId" UUID NOT NULL,
  "userId" UUID NOT NULL,
  "isManager" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TeamMember_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "TeamMember_teamId_userId_key" UNIQUE ("teamId", "userId")
);
CREATE TABLE "AuditEvent" (
  "id" UUID NOT NULL,
  "companyId" UUID NOT NULL,
  "platformUserId" UUID,
  "actorUserId" UUID,
  "action" TEXT NOT NULL,
  "entityType" TEXT NOT NULL,
  "entityId" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AuditEvent_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Team_companyId_idx" ON "Team"("companyId");
CREATE INDEX "TeamMember_companyId_idx" ON "TeamMember"("companyId");
CREATE INDEX "TeamMember_userId_idx" ON "TeamMember"("userId");
CREATE INDEX "AuditEvent_companyId_createdAt_idx" ON "AuditEvent"("companyId", "createdAt");
ALTER TABLE "Team" ADD CONSTRAINT "Team_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TeamMember" ADD CONSTRAINT "TeamMember_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TeamMember" ADD CONSTRAINT "TeamMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AuditEvent" ADD CONSTRAINT "AuditEvent_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AuditEvent" ADD CONSTRAINT "AuditEvent_platformUserId_fkey" FOREIGN KEY ("platformUserId") REFERENCES "PlatformUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AuditEvent" ADD CONSTRAINT "AuditEvent_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Team" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Team" FORCE ROW LEVEL SECURITY;
ALTER TABLE "TeamMember" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "TeamMember" FORCE ROW LEVEL SECURITY;
ALTER TABLE "AuditEvent" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AuditEvent" FORCE ROW LEVEL SECURITY;
CREATE POLICY "team_tenant_isolation" ON "Team" FOR ALL
  USING ("companyId" = NULLIF(current_setting('app.company_id', true), '')::uuid)
  WITH CHECK ("companyId" = NULLIF(current_setting('app.company_id', true), '')::uuid);
CREATE POLICY "team_member_tenant_isolation" ON "TeamMember" FOR ALL
  USING ("companyId" = NULLIF(current_setting('app.company_id', true), '')::uuid)
  WITH CHECK ("companyId" = NULLIF(current_setting('app.company_id', true), '')::uuid);
CREATE POLICY "audit_event_tenant_isolation" ON "AuditEvent" FOR ALL
  USING ("companyId" = NULLIF(current_setting('app.company_id', true), '')::uuid)
  WITH CHECK ("companyId" = NULLIF(current_setting('app.company_id', true), '')::uuid);

CREATE FUNCTION "enforce_team_member_company"()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  team_company UUID;
  user_company UUID;
BEGIN
  SELECT "companyId" INTO team_company FROM public."Team" WHERE "id" = NEW."teamId";
  SELECT "companyId" INTO user_company FROM public."User" WHERE "id" = NEW."userId";
  IF team_company IS NULL OR user_company IS NULL OR NEW."companyId" <> team_company OR NEW."companyId" <> user_company THEN
    RAISE EXCEPTION 'TEAM_MEMBER_CROSS_TENANT' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER "TeamMember_company_consistency" BEFORE INSERT OR UPDATE ON "TeamMember"
FOR EACH ROW EXECUTE FUNCTION "enforce_team_member_company"();

CREATE FUNCTION "platform_list_companies"()
RETURNS TABLE ("id" UUID, "name" TEXT, "slug" TEXT, "active" BOOLEAN, "timezone" TEXT, "locale" TEXT, "createdAt" TIMESTAMPTZ(6), "updatedAt" TIMESTAMPTZ(6))
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, public AS $$
  SELECT "id", "name", "slug", "active", "timezone", "locale", "createdAt", "updatedAt" FROM public."Company" ORDER BY "createdAt" DESC
$$;
CREATE FUNCTION "platform_create_company"(company_name TEXT, company_slug TEXT, company_timezone TEXT, company_locale TEXT)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE created_id UUID;
BEGIN
  INSERT INTO public."Company" ("id", "name", "slug", "active", "timezone", "locale", "createdAt", "updatedAt")
  VALUES (gen_random_uuid(), company_name, company_slug, true, company_timezone, company_locale, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
  RETURNING "id" INTO created_id;
  RETURN created_id;
END;
$$;
CREATE FUNCTION "platform_update_company"(target_id UUID, company_name TEXT, company_slug TEXT, company_active BOOLEAN, company_timezone TEXT, company_locale TEXT)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
BEGIN
  UPDATE public."Company" SET "name" = company_name, "slug" = company_slug, "active" = company_active, "timezone" = company_timezone, "locale" = company_locale, "updatedAt" = CURRENT_TIMESTAMP WHERE "id" = target_id;
  RETURN FOUND;
END;
$$;