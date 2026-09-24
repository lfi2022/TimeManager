CREATE TABLE "UserSession" (
  "id" UUID NOT NULL,
  "companyId" UUID NOT NULL,
  "userId" UUID NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "expiresAt" TIMESTAMPTZ(6) NOT NULL,
  "invalidatedAt" TIMESTAMPTZ(6),
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastSeenAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "UserSession_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "PlatformSession" (
  "id" UUID NOT NULL,
  "platformUserId" UUID NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "expiresAt" TIMESTAMPTZ(6) NOT NULL,
  "invalidatedAt" TIMESTAMPTZ(6),
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastSeenAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PlatformSession_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "UserPasswordResetToken" (
  "id" UUID NOT NULL,
  "companyId" UUID NOT NULL,
  "userId" UUID NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "expiresAt" TIMESTAMPTZ(6) NOT NULL,
  "usedAt" TIMESTAMPTZ(6),
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "UserPasswordResetToken_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "PlatformPasswordResetToken" (
  "id" UUID NOT NULL,
  "platformUserId" UUID NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "expiresAt" TIMESTAMPTZ(6) NOT NULL,
  "usedAt" TIMESTAMPTZ(6),
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PlatformPasswordResetToken_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "UserSession_tokenHash_key" ON "UserSession"("tokenHash");
CREATE INDEX "UserSession_companyId_userId_idx" ON "UserSession"("companyId", "userId");
CREATE UNIQUE INDEX "PlatformSession_tokenHash_key" ON "PlatformSession"("tokenHash");
CREATE INDEX "PlatformSession_platformUserId_idx" ON "PlatformSession"("platformUserId");
CREATE UNIQUE INDEX "UserPasswordResetToken_tokenHash_key" ON "UserPasswordResetToken"("tokenHash");
CREATE INDEX "UserPasswordResetToken_companyId_userId_idx" ON "UserPasswordResetToken"("companyId", "userId");
CREATE UNIQUE INDEX "PlatformPasswordResetToken_tokenHash_key" ON "PlatformPasswordResetToken"("tokenHash");
CREATE INDEX "PlatformPasswordResetToken_platformUserId_idx" ON "PlatformPasswordResetToken"("platformUserId");
ALTER TABLE "UserSession" ADD CONSTRAINT "UserSession_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE;
ALTER TABLE "UserSession" ADD CONSTRAINT "UserSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE;
ALTER TABLE "PlatformSession" ADD CONSTRAINT "PlatformSession_platformUserId_fkey" FOREIGN KEY ("platformUserId") REFERENCES "PlatformUser"("id") ON DELETE CASCADE;
ALTER TABLE "UserPasswordResetToken" ADD CONSTRAINT "UserPasswordResetToken_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE;
ALTER TABLE "UserPasswordResetToken" ADD CONSTRAINT "UserPasswordResetToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE;
ALTER TABLE "PlatformPasswordResetToken" ADD CONSTRAINT "PlatformPasswordResetToken_platformUserId_fkey" FOREIGN KEY ("platformUserId") REFERENCES "PlatformUser"("id") ON DELETE CASCADE;

ALTER TABLE "UserSession" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "UserSession" FORCE ROW LEVEL SECURITY;
ALTER TABLE "UserPasswordResetToken" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "UserPasswordResetToken" FORCE ROW LEVEL SECURITY;
CREATE POLICY "user_session_tenant_isolation" ON "UserSession" FOR ALL
  USING ("companyId" = NULLIF(current_setting('app.company_id', true), '')::uuid)
  WITH CHECK ("companyId" = NULLIF(current_setting('app.company_id', true), '')::uuid);
CREATE POLICY "user_reset_tenant_isolation" ON "UserPasswordResetToken" FOR ALL
  USING ("companyId" = NULLIF(current_setting('app.company_id', true), '')::uuid)
  WITH CHECK ("companyId" = NULLIF(current_setting('app.company_id', true), '')::uuid);

CREATE FUNCTION "auth_company_id_by_slug"(requested_slug TEXT)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT "id" FROM public."Company"
  WHERE "slug" = requested_slug AND "active" = true
  LIMIT 1
$$;

CREATE FUNCTION "auth_user_session_by_token_hash"(requested_hash TEXT)
RETURNS TABLE ("sessionId" UUID, "companyId" UUID, "userId" UUID)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT "id", "companyId", "userId" FROM public."UserSession"
  WHERE "tokenHash" = requested_hash
  LIMIT 1
$$;

CREATE FUNCTION "auth_user_reset_by_token_hash"(requested_hash TEXT)
RETURNS TABLE ("resetId" UUID, "companyId" UUID, "userId" UUID)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT "id", "companyId", "userId" FROM public."UserPasswordResetToken"
  WHERE "tokenHash" = requested_hash
  LIMIT 1
$$;
