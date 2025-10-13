-- Add avatar fields to User table
ALTER TABLE "User" ADD COLUMN "publicAvatarBlobId" TEXT;
ALTER TABLE "User" ADD COLUMN "privateAvatarBlobId" TEXT;
ALTER TABLE "User" ADD COLUMN "avatarSealPolicyId" TEXT;
ALTER TABLE "User" ADD COLUMN "avatarUploadedAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN "avatarSettings" JSONB NOT NULL DEFAULT '{}';