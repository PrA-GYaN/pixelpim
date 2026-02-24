-- AlterTable
ALTER TABLE "public"."Product" ADD COLUMN     "thumbnailSubImages" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "thumbnailUrl" TEXT;
