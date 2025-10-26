/*
  Warnings:

  - You are about to drop the `product_variants` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "public"."product_variants" DROP CONSTRAINT "product_variants_productAId_fkey";

-- DropForeignKey
ALTER TABLE "public"."product_variants" DROP CONSTRAINT "product_variants_productBId_fkey";

-- AlterTable
ALTER TABLE "public"."Product" ADD COLUMN     "parentProductId" INTEGER;

-- DropTable
DROP TABLE "public"."product_variants";

-- AddForeignKey
ALTER TABLE "public"."Product" ADD CONSTRAINT "Product_parentProductId_fkey" FOREIGN KEY ("parentProductId") REFERENCES "public"."Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
