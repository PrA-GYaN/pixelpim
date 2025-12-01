-- CreateEnum
CREATE TYPE "public"."Role" AS ENUM ('ADMIN', 'OWNER', 'STAFF');

-- AlterTable
ALTER TABLE "public"."User" ADD COLUMN     "ownerId" INTEGER,
ADD COLUMN     "role" "public"."Role" NOT NULL DEFAULT 'OWNER';

-- CreateTable
CREATE TABLE "public"."UserPermission" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "resource" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "granted" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserPermission_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "UserPermission_userId_resource_idx" ON "public"."UserPermission"("userId", "resource");

-- CreateIndex
CREATE UNIQUE INDEX "UserPermission_userId_resource_action_key" ON "public"."UserPermission"("userId", "resource", "action");

-- AddForeignKey
ALTER TABLE "public"."User" ADD CONSTRAINT "User_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."UserPermission" ADD CONSTRAINT "UserPermission_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
