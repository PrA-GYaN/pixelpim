/*
  Warnings:

  - A unique constraint covering the columns `[name,userId,assetGroupId]` on the table `Asset` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[sku,userId]` on the table `Product` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[name,userId]` on the table `Product` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "public"."Asset_name_userId_assetGroupId_deletedAt_key";

-- DropIndex
DROP INDEX "public"."Product_name_userId_deletedAt_key";

-- DropIndex
DROP INDEX "public"."Product_sku_userId_deletedAt_key";

-- CreateIndex
CREATE UNIQUE INDEX "Asset_name_userId_assetGroupId_key" ON "public"."Asset"("name", "userId", "assetGroupId");

-- CreateIndex
CREATE UNIQUE INDEX "Product_sku_userId_key" ON "public"."Product"("sku", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "Product_name_userId_key" ON "public"."Product"("name", "userId");
