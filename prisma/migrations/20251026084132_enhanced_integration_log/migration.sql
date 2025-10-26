/*
  Warnings:

  - You are about to drop the column `woocommerceProductId` on the `IntegrationLog` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[name,userId,assetGroupId]` on the table `Asset` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[groupName,userId,parentGroupId]` on the table `AssetGroup` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `integrationType` to the `IntegrationLog` table without a default value. This is not possible if the table is not empty.
  - Added the required column `operation` to the `IntegrationLog` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "public"."Asset_name_userId_key";

-- DropIndex
DROP INDEX "public"."AssetGroup_groupName_userId_key";

-- AlterTable
ALTER TABLE "public"."AssetGroup" ADD COLUMN     "parentGroupId" INTEGER;

-- AlterTable
ALTER TABLE "public"."IntegrationLog" DROP COLUMN "woocommerceProductId",
ADD COLUMN     "errorDetails" JSONB,
ADD COLUMN     "externalProductId" TEXT,
ADD COLUMN     "externalSku" TEXT,
ADD COLUMN     "integrationType" TEXT NOT NULL,
ADD COLUMN     "metadata" JSONB,
ADD COLUMN     "operation" TEXT NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Asset_name_userId_assetGroupId_key" ON "public"."Asset"("name", "userId", "assetGroupId");

-- CreateIndex
CREATE UNIQUE INDEX "AssetGroup_groupName_userId_parentGroupId_key" ON "public"."AssetGroup"("groupName", "userId", "parentGroupId");

-- CreateIndex
CREATE INDEX "IntegrationLog_userId_integrationType_idx" ON "public"."IntegrationLog"("userId", "integrationType");

-- CreateIndex
CREATE INDEX "IntegrationLog_externalProductId_integrationType_idx" ON "public"."IntegrationLog"("externalProductId", "integrationType");

-- AddForeignKey
ALTER TABLE "public"."AssetGroup" ADD CONSTRAINT "AssetGroup_parentGroupId_fkey" FOREIGN KEY ("parentGroupId") REFERENCES "public"."AssetGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;
