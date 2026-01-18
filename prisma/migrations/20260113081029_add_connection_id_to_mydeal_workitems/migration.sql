-- AlterTable
ALTER TABLE "public"."MyDealWorkItem" ADD COLUMN     "connectionId" INTEGER;

-- AddForeignKey
ALTER TABLE "public"."MyDealWorkItem" ADD CONSTRAINT "MyDealWorkItem_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "public"."MyDealConnection"("id") ON DELETE CASCADE ON UPDATE CASCADE;
