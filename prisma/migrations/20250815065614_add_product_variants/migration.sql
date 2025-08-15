-- CreateTable
CREATE TABLE "public"."product_variants" (
    "id" SERIAL NOT NULL,
    "productAId" INTEGER NOT NULL,
    "productBId" INTEGER NOT NULL,

    CONSTRAINT "product_variants_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "product_variants_productAId_productBId_key" ON "public"."product_variants"("productAId", "productBId");

-- AddForeignKey
ALTER TABLE "public"."product_variants" ADD CONSTRAINT "product_variants_productAId_fkey" FOREIGN KEY ("productAId") REFERENCES "public"."Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."product_variants" ADD CONSTRAINT "product_variants_productBId_fkey" FOREIGN KEY ("productBId") REFERENCES "public"."Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
