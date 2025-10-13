-- CreateTable
CREATE TABLE "AvatarUploadMetric" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fileSize" INTEGER NOT NULL,
    "originalFormat" TEXT NOT NULL,
    "processedFormats" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "processingTime" INTEGER NOT NULL,
    "success" BOOLEAN NOT NULL,
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "compressionRatio" DOUBLE PRECISION,
    "variantsGenerated" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AvatarUploadMetric_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AvatarAccessMetric" (
    "id" TEXT NOT NULL,
    "targetUserId" TEXT NOT NULL,
    "viewerUserId" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "avatarType" TEXT NOT NULL,
    "isEncrypted" BOOLEAN NOT NULL,
    "hasAccess" BOOLEAN NOT NULL,
    "loadTime" INTEGER,
    "cacheHit" BOOLEAN NOT NULL DEFAULT false,
    "userAgent" TEXT,
    "referrer" TEXT,
    "errorCode" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AvatarAccessMetric_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AvatarEngagementMetric" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sessionId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AvatarEngagementMetric_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AvatarUploadMetric_userId_timestamp_idx" ON "AvatarUploadMetric"("userId", "timestamp");

-- CreateIndex
CREATE INDEX "AvatarUploadMetric_timestamp_idx" ON "AvatarUploadMetric"("timestamp");

-- CreateIndex
CREATE INDEX "AvatarUploadMetric_success_idx" ON "AvatarUploadMetric"("success");

-- CreateIndex
CREATE INDEX "AvatarAccessMetric_targetUserId_timestamp_idx" ON "AvatarAccessMetric"("targetUserId", "timestamp");

-- CreateIndex
CREATE INDEX "AvatarAccessMetric_viewerUserId_timestamp_idx" ON "AvatarAccessMetric"("viewerUserId", "timestamp");

-- CreateIndex
CREATE INDEX "AvatarAccessMetric_timestamp_idx" ON "AvatarAccessMetric"("timestamp");

-- CreateIndex
CREATE INDEX "AvatarAccessMetric_avatarType_idx" ON "AvatarAccessMetric"("avatarType");

-- CreateIndex
CREATE INDEX "AvatarEngagementMetric_userId_timestamp_idx" ON "AvatarEngagementMetric"("userId", "timestamp");

-- CreateIndex
CREATE INDEX "AvatarEngagementMetric_timestamp_idx" ON "AvatarEngagementMetric"("timestamp");

-- CreateIndex
CREATE INDEX "AvatarEngagementMetric_action_idx" ON "AvatarEngagementMetric"("action");