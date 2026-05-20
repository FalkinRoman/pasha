-- CreateEnum
CREATE TYPE "IdentityStatus" AS ENUM ('none', 'pending', 'approved', 'rejected', 'auto_approved');

-- AlterTable
ALTER TABLE "User" ADD COLUMN "identityStatus" "IdentityStatus" NOT NULL DEFAULT 'none';
ALTER TABLE "User" ADD COLUMN "pdConsentAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "IdentityVerification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "IdentityStatus" NOT NULL DEFAULT 'pending',
    "photoPath" TEXT NOT NULL,
    "rejectReason" TEXT,
    "pdConsentAt" TIMESTAMP(3) NOT NULL,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "autoApproveAt" TIMESTAMP(3) NOT NULL,
    "resolvedAt" TIMESTAMP(3),
    "resolvedByAdminId" TEXT,

    CONSTRAINT "IdentityVerification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "IdentityVerification_status_submittedAt_idx" ON "IdentityVerification"("status", "submittedAt");
CREATE INDEX "IdentityVerification_userId_submittedAt_idx" ON "IdentityVerification"("userId", "submittedAt");

-- AddForeignKey
ALTER TABLE "IdentityVerification" ADD CONSTRAINT "IdentityVerification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
