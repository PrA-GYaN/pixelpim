-- CreateTable
CREATE TABLE "public"."ShareLink" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),
    "accessCount" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "ShareLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."SharedAsset" (
    "id" SERIAL NOT NULL,
    "shareLinkId" TEXT NOT NULL,
    "assetId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SharedAsset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."SharedAssetGroup" (
    "id" SERIAL NOT NULL,
    "shareLinkId" TEXT NOT NULL,
    "assetGroupId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SharedAssetGroup_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ShareLink_slug_key" ON "public"."ShareLink"("slug");

-- CreateIndex
CREATE INDEX "ShareLink_slug_isActive_idx" ON "public"."ShareLink"("slug", "isActive");

-- CreateIndex
CREATE INDEX "ShareLink_userId_idx" ON "public"."ShareLink"("userId");

-- CreateIndex
CREATE INDEX "SharedAsset_shareLinkId_idx" ON "public"."SharedAsset"("shareLinkId");

-- CreateIndex
CREATE UNIQUE INDEX "SharedAsset_shareLinkId_assetId_key" ON "public"."SharedAsset"("shareLinkId", "assetId");

-- CreateIndex
CREATE INDEX "SharedAssetGroup_shareLinkId_idx" ON "public"."SharedAssetGroup"("shareLinkId");

-- CreateIndex
CREATE UNIQUE INDEX "SharedAssetGroup_shareLinkId_assetGroupId_key" ON "public"."SharedAssetGroup"("shareLinkId", "assetGroupId");

-- AddForeignKey
ALTER TABLE "public"."ShareLink" ADD CONSTRAINT "ShareLink_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SharedAsset" ADD CONSTRAINT "SharedAsset_shareLinkId_fkey" FOREIGN KEY ("shareLinkId") REFERENCES "public"."ShareLink"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SharedAssetGroup" ADD CONSTRAINT "SharedAssetGroup_shareLinkId_fkey" FOREIGN KEY ("shareLinkId") REFERENCES "public"."ShareLink"("id") ON DELETE CASCADE ON UPDATE CASCADE;
