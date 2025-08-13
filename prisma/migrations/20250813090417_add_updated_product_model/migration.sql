-- DropIndex
DROP INDEX "public"."Product_sku_key";

-- AlterTable
ALTER TABLE "public"."Product" ADD COLUMN     "attributeGroupId" INTEGER,
ADD COLUMN     "attributeId" INTEGER,
ADD COLUMN     "familyId" INTEGER,
ALTER COLUMN "status" SET DEFAULT 'incomplete';

-- AddForeignKey
ALTER TABLE "public"."Product" ADD CONSTRAINT "Product_attributeId_fkey" FOREIGN KEY ("attributeId") REFERENCES "public"."Attribute"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Product" ADD CONSTRAINT "Product_attributeGroupId_fkey" FOREIGN KEY ("attributeGroupId") REFERENCES "public"."AttributeGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Product" ADD CONSTRAINT "Product_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "public"."Family"("id") ON DELETE SET NULL ON UPDATE CASCADE;
