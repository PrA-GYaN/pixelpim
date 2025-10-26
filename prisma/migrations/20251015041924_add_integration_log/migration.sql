-- CreateTable
CREATE TABLE "public"."IntegrationLog" (
    "id" SERIAL NOT NULL,
    "productId" INTEGER NOT NULL,
    "status" TEXT NOT NULL,
    "message" TEXT,
    "woocommerceProductId" INTEGER,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" INTEGER NOT NULL,

    CONSTRAINT "IntegrationLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "IntegrationLog_userId_productId_idx" ON "public"."IntegrationLog"("userId", "productId");

-- CreateIndex
CREATE INDEX "IntegrationLog_timestamp_idx" ON "public"."IntegrationLog"("timestamp");

-- AddForeignKey
ALTER TABLE "public"."IntegrationLog" ADD CONSTRAINT "IntegrationLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
