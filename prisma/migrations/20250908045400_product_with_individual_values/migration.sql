-- AlterTable
ALTER TABLE "public"."ProductAttribute" ADD COLUMN     "familyAttributeId" INTEGER;

-- AddForeignKey
ALTER TABLE "public"."ProductAttribute" ADD CONSTRAINT "ProductAttribute_familyAttributeId_fkey" FOREIGN KEY ("familyAttributeId") REFERENCES "public"."FamilyAttribute"("id") ON DELETE CASCADE ON UPDATE CASCADE;
