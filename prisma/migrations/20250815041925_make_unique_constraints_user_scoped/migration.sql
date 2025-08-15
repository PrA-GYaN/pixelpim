/*
  Warnings:

  - A unique constraint covering the columns `[name,userId]` on the table `Attribute` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[name,userId]` on the table `AttributeGroup` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "public"."Attribute_name_key";

-- DropIndex
DROP INDEX "public"."AttributeGroup_name_key";

-- CreateIndex
CREATE UNIQUE INDEX "Attribute_name_userId_key" ON "public"."Attribute"("name", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "AttributeGroup_name_userId_key" ON "public"."AttributeGroup"("name", "userId");
