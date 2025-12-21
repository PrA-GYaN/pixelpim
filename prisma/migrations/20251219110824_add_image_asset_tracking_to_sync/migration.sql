-- AlterTable
ALTER TABLE "public"."WooCommerceProductSync" ADD COLUMN     "lastSyncedAssets" JSONB,
ADD COLUMN     "lastSyncedImages" JSONB;
