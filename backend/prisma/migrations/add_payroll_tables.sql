-- Payroll Module Migration (2026-07-05)
-- Adds EmployeeSalaryConfig, SalaryAdvance, and Payslip tables

-- ─── Employee Salary Config ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "EmployeeSalaryConfig" (
  "id"          SERIAL PRIMARY KEY,
  "userId"      INTEGER NOT NULL UNIQUE,
  "basicSalary" DECIMAL(12,2) NOT NULL,
  "allowances"  DECIMAL(12,2) NOT NULL DEFAULT 0,
  "deductions"  DECIMAL(12,2) NOT NULL DEFAULT 0,
  "currency"    TEXT NOT NULL DEFAULT 'MWK',
  "notes"       TEXT,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "EmployeeSalaryConfig_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- ─── Salary Advance ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "SalaryAdvance" (
  "id"          SERIAL PRIMARY KEY,
  "userId"      INTEGER NOT NULL,
  "amount"      DECIMAL(12,2) NOT NULL,
  "reason"      TEXT,
  "status"      TEXT NOT NULL DEFAULT 'PENDING',
  "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "approvedAt"  TIMESTAMP(3),
  "repaidAt"    TIMESTAMP(3),
  "approvedBy"  INTEGER,
  CONSTRAINT "SalaryAdvance_userId_fkey"     FOREIGN KEY ("userId")     REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "SalaryAdvance_approvedBy_fkey" FOREIGN KEY ("approvedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "SalaryAdvance_userId_idx"  ON "SalaryAdvance"("userId");
CREATE INDEX IF NOT EXISTS "SalaryAdvance_status_idx"  ON "SalaryAdvance"("status");

-- ─── Payslip ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "Payslip" (
  "id"            SERIAL PRIMARY KEY,
  "userId"        INTEGER NOT NULL,
  "month"         INTEGER NOT NULL,
  "year"          INTEGER NOT NULL,
  "basicSalary"   DECIMAL(12,2) NOT NULL,
  "allowances"    DECIMAL(12,2) NOT NULL,
  "deductions"    DECIMAL(12,2) NOT NULL,
  "advanceDeduct" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "netPay"        DECIMAL(12,2) NOT NULL,
  "status"        TEXT NOT NULL DEFAULT 'DRAFT',
  "notes"         TEXT,
  "generatedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Payslip_userId_fkey"         FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "Payslip_userId_month_year_key" UNIQUE ("userId","month","year")
);

CREATE INDEX IF NOT EXISTS "Payslip_year_month_idx" ON "Payslip"("year","month");

-- ─── RLS (service-role only, consistent with rest of app) ────────────────────
ALTER TABLE "EmployeeSalaryConfig" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SalaryAdvance"        ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Payslip"              ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role only" ON "EmployeeSalaryConfig" FOR ALL USING (false);
CREATE POLICY "Service role only" ON "SalaryAdvance"        FOR ALL USING (false);
CREATE POLICY "Service role only" ON "Payslip"              FOR ALL USING (false);
