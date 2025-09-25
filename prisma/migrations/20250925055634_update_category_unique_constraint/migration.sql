/*
  Warnings:

  - A unique constraint covering the columns `[name,userId,parentCategoryId]` on the table `Category` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "public"."Category_name_userId_key";

-- CreateIndex
CREATE UNIQUE INDEX "Category_name_userId_parentCategoryId_key" ON "public"."Category"("name", "userId", "parentCategoryId");
