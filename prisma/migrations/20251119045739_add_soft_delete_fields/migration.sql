/*
  Warnings:

  - A unique constraint covering the columns `[name,userId,assetGroupId,deletedAt]` on the table `Asset` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[sku,userId,deletedAt]` on the table `Product` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[name,userId,deletedAt]` on the table `Product` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[apiKey]` on the table `User` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "public"."Asset_name_userId_assetGroupId_key";

-- DropIndex
DROP INDEX "public"."Product_name_userId_key";

-- DropIndex
DROP INDEX "public"."Product_sku_userId_key";

-- AlterTable
ALTER TABLE "public"."Asset" ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "isDeleted" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "public"."Product" ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "isDeleted" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "public"."User" ADD COLUMN     "apiKey" TEXT,
ADD COLUMN     "secretKey" TEXT;

-- CreateTable
CREATE TABLE "public"."UserIntegrationCredentials" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "integrationType" TEXT NOT NULL,
    "credentials" JSONB NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserIntegrationCredentials_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Webhook" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "url" TEXT NOT NULL,
    "events" TEXT[],
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Webhook_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."WebhookDelivery" (
    "id" SERIAL NOT NULL,
    "webhookId" INTEGER NOT NULL,
    "event" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "status" TEXT NOT NULL,
    "response" TEXT,
    "deliveredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WebhookDelivery_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "UserIntegrationCredentials_userId_integrationType_key" ON "public"."UserIntegrationCredentials"("userId", "integrationType");

-- CreateIndex
CREATE UNIQUE INDEX "Webhook_userId_url_key" ON "public"."Webhook"("userId", "url");

-- CreateIndex
CREATE INDEX "WebhookDelivery_webhookId_deliveredAt_idx" ON "public"."WebhookDelivery"("webhookId", "deliveredAt");

-- CreateIndex
CREATE INDEX "Asset_userId_isDeleted_idx" ON "public"."Asset"("userId", "isDeleted");

-- CreateIndex
CREATE UNIQUE INDEX "Asset_name_userId_assetGroupId_deletedAt_key" ON "public"."Asset"("name", "userId", "assetGroupId", "deletedAt");

-- CreateIndex
CREATE INDEX "Product_userId_isDeleted_idx" ON "public"."Product"("userId", "isDeleted");

-- CreateIndex
CREATE UNIQUE INDEX "Product_sku_userId_deletedAt_key" ON "public"."Product"("sku", "userId", "deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Product_name_userId_deletedAt_key" ON "public"."Product"("name", "userId", "deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "User_apiKey_key" ON "public"."User"("apiKey");

-- AddForeignKey
ALTER TABLE "public"."UserIntegrationCredentials" ADD CONSTRAINT "UserIntegrationCredentials_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Webhook" ADD CONSTRAINT "Webhook_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."WebhookDelivery" ADD CONSTRAINT "WebhookDelivery_webhookId_fkey" FOREIGN KEY ("webhookId") REFERENCES "public"."Webhook"("id") ON DELETE CASCADE ON UPDATE CASCADE;
