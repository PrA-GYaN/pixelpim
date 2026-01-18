-- CreateTable
CREATE TABLE "MyDealWorkItem" (
    "id" SERIAL NOT NULL,
    "workItemId" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "productId" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "operation" TEXT NOT NULL,
    "requestPayload" JSONB,
    "responseData" JSONB,
    "errorMessage" TEXT,
    "pendingUri" TEXT,
    "externalProductId" TEXT,
    "externalSku" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "MyDealWorkItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MyDealConnection" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "connectionName" TEXT NOT NULL,
    "baseApiUrl" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "clientSecret" TEXT NOT NULL,
    "sellerId" TEXT NOT NULL,
    "sellerToken" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "lastSyncedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MyDealConnection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MyDealExportMapping" (
    "id" SERIAL NOT NULL,
    "connectionId" INTEGER NOT NULL,
    "fieldMappings" JSONB NOT NULL,
    "selectedFields" TEXT[] NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MyDealExportMapping_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MyDealImportMapping" (
    "id" SERIAL NOT NULL,
    "connectionId" INTEGER NOT NULL,
    "attributeMappings" JSONB NOT NULL,
    "fieldMappings" JSONB NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MyDealImportMapping_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MyDealWorkItem_workItemId_key" ON "MyDealWorkItem"("workItemId");

-- CreateIndex
CREATE INDEX "MyDealWorkItem_userId_productId_idx" ON "MyDealWorkItem"("userId", "productId");

-- CreateIndex
CREATE INDEX "MyDealWorkItem_userId_status_idx" ON "MyDealWorkItem"("userId", "status");

-- CreateIndex
CREATE INDEX "MyDealWorkItem_workItemId_idx" ON "MyDealWorkItem"("workItemId");

-- CreateIndex
CREATE UNIQUE INDEX "MyDealConnection_userId_baseApiUrl_key" ON "MyDealConnection"("userId", "baseApiUrl");

-- CreateIndex
CREATE INDEX "MyDealConnection_userId_isActive_idx" ON "MyDealConnection"("userId", "isActive");

-- CreateIndex
CREATE INDEX "MyDealConnection_userId_isDefault_idx" ON "MyDealConnection"("userId", "isDefault");

-- CreateIndex
CREATE INDEX "MyDealExportMapping_connectionId_isActive_idx" ON "MyDealExportMapping"("connectionId", "isActive");

-- CreateIndex
CREATE INDEX "MyDealImportMapping_connectionId_isActive_idx" ON "MyDealImportMapping"("connectionId", "isActive");

-- AddForeignKey
ALTER TABLE "MyDealWorkItem" ADD CONSTRAINT "MyDealWorkItem_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MyDealConnection" ADD CONSTRAINT "MyDealConnection_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MyDealExportMapping" ADD CONSTRAINT "MyDealExportMapping_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "MyDealConnection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MyDealImportMapping" ADD CONSTRAINT "MyDealImportMapping_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "MyDealConnection"("id") ON DELETE CASCADE ON UPDATE CASCADE;
