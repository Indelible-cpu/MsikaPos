-- AlterTable
ALTER TABLE "Payslip" ADD COLUMN "signature" TEXT,
ADD COLUMN "signedBy" TEXT,
ADD COLUMN "signedByRole" TEXT,
ADD COLUMN "signedAt" TIMESTAMP(3);
