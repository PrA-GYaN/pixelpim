-- CreateTable
CREATE TABLE "public"."WooCommerceConnection" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "storeName" TEXT NOT NULL,
    "storeUrl" TEXT NOT NULL,
    "consumerKey" TEXT NOT NULL,
    "consumerSecret" TEXT NOT NULL,
    "webhookSecret" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "lastSyncedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WooCommerceConnection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."WooCommerceExportMapping" (
    "id" SERIAL NOT NULL,
    "connectionId" INTEGER NOT NULL,
    "fieldMappings" JSONB NOT NULL,
    "selectedFields" TEXT[],
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WooCommerceExportMapping_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."WooCommerceImportMapping" (
    "id" SERIAL NOT NULL,
    "connectionId" INTEGER NOT NULL,
    "attributeMappings" JSONB NOT NULL,
    "fieldMappings" JSONB NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WooCommerceImportMapping_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."WooCommerceProductSync" (
    "id" SERIAL NOT NULL,
    "connectionId" INTEGER NOT NULL,
    "productId" INTEGER NOT NULL,
    "wooProductId" INTEGER NOT NULL,
    "lastExportedAt" TIMESTAMP(3),
    "lastImportedAt" TIMESTAMP(3),
    "lastModifiedFields" JSONB,
    "syncStatus" TEXT NOT NULL DEFAULT 'synced',
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WooCommerceProductSync_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WooCommerceConnection_userId_isActive_idx" ON "public"."WooCommerceConnection"("userId", "isActive");

-- CreateIndex
CREATE INDEX "WooCommerceConnection_userId_isDefault_idx" ON "public"."WooCommerceConnection"("userId", "isDefault");

-- CreateIndex
CREATE UNIQUE INDEX "WooCommerceConnection_userId_storeUrl_key" ON "public"."WooCommerceConnection"("userId", "storeUrl");

-- CreateIndex
CREATE INDEX "WooCommerceExportMapping_connectionId_isActive_idx" ON "public"."WooCommerceExportMapping"("connectionId", "isActive");

-- CreateIndex
CREATE INDEX "WooCommerceImportMapping_connectionId_isActive_idx" ON "public"."WooCommerceImportMapping"("connectionId", "isActive");

-- CreateIndex
CREATE INDEX "WooCommerceProductSync_connectionId_syncStatus_idx" ON "public"."WooCommerceProductSync"("connectionId", "syncStatus");

-- CreateIndex
CREATE INDEX "WooCommerceProductSync_productId_idx" ON "public"."WooCommerceProductSync"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "WooCommerceProductSync_connectionId_productId_key" ON "public"."WooCommerceProductSync"("connectionId", "productId");

-- CreateIndex
CREATE UNIQUE INDEX "WooCommerceProductSync_connectionId_wooProductId_key" ON "public"."WooCommerceProductSync"("connectionId", "wooProductId");

-- CreateIndex
CREATE INDEX "UserIntegrationCredentials_userId_integrationType_idx" ON "public"."UserIntegrationCredentials"("userId", "integrationType");

-- AddForeignKey
ALTER TABLE "public"."WooCommerceConnection" ADD CONSTRAINT "WooCommerceConnection_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."WooCommerceExportMapping" ADD CONSTRAINT "WooCommerceExportMapping_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "public"."WooCommerceConnection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."WooCommerceImportMapping" ADD CONSTRAINT "WooCommerceImportMapping_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "public"."WooCommerceConnection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."WooCommerceProductSync" ADD CONSTRAINT "WooCommerceProductSync_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "public"."WooCommerceConnection"("id") ON DELETE CASCADE ON UPDATE CASCADE;
