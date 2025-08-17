-- AlterTable
ALTER TABLE "public"."Product" ADD COLUMN     "subImages" TEXT[] DEFAULT ARRAY[]::TEXT[];
