-- CreateEnum
CREATE TYPE "public"."AttributeType" AS ENUM ('STRING', 'TEXT', 'NUMBER', 'INTEGER', 'FLOAT', 'BOOLEAN', 'DATE', 'DATETIME', 'TIME', 'EMAIL', 'URL', 'PHONE', 'ENUM', 'JSON', 'ARRAY', 'FILE', 'IMAGE', 'COLOR', 'CURRENCY', 'PERCENTAGE');

-- AlterTable
ALTER TABLE "public"."Attribute" ALTER COLUMN "type" SET DATA TYPE "public"."AttributeType" USING ("type"::"public"."AttributeType");

-- AlterTable
ALTER TABLE "public"."Attribute" ALTER COLUMN "defaultValue" SET DATA TYPE JSONB;

-- AlterTable
ALTER TABLE "public"."AttributeGroupAttribute" ALTER COLUMN "defaultValue" SET DATA TYPE JSONB;

-- AlterTable
ALTER TABLE "public"."FamilyAttribute" ALTER COLUMN "additionalValue" SET DATA TYPE JSONB;
