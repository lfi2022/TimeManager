ALTER TABLE "AuditEvent" ADD COLUMN "ipAddress" TEXT, ADD COLUMN "userAgent" TEXT;
CREATE TABLE "PeriodLock" (
  "id" UUID NOT NULL,
  "companyId" UUID NOT NULL,
  "startDate" DATE NOT NULL,
  "endDate" DATE NOT NULL,
  "lockedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lockedByUserId" UUID NOT NULL,
  "reason" TEXT,
  CONSTRAINT "PeriodLock_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "PeriodLock_range" CHECK ("endDate" >= "startDate")
);
CREATE INDEX "PeriodLock_companyId_startDate_endDate_idx" ON "PeriodLock"("companyId", "startDate", "endDate");
ALTER TABLE "PeriodLock" ADD CONSTRAINT "PeriodLock_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE;
ALTER TABLE "PeriodLock" ADD CONSTRAINT "PeriodLock_lockedByUserId_fkey" FOREIGN KEY ("lockedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT;
ALTER TABLE "PeriodLock" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PeriodLock" FORCE ROW LEVEL SECURITY;
CREATE POLICY "period_lock_tenant" ON "PeriodLock" FOR ALL USING("companyId"=NULLIF(current_setting('app.company_id',true),'')::uuid) WITH CHECK("companyId"=NULLIF(current_setting('app.company_id',true),'')::uuid);