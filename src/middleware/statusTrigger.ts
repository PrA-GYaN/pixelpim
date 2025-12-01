import { Prisma, PrismaClient } from '@prisma/client';
import { updateProductStatus } from 'src/utils/productStatusUtils';

export const productAttributeStatusExtension = Prisma.defineExtension({
  name: 'productAttributeStatusExtension',

  query: {
    attribute: {
      async update({ args, query }) {
        console.log('[TRIGGER] Attribute update trigger activated');
        console.log('[Extension] update attribute args:', JSON.stringify(args, null, 2));
        const result = await query(args);
        // Find all products that directly use the attribute or belong to a family that uses the attribute
        const attributeId = args.where?.id;
        if (attributeId) {
          const prisma = new PrismaClient();
          // Products directly using the attribute (ProductAttribute)
          const directProducts = await prisma.product.findMany({
            where: {
              attributes: {
                some: { attributeId: Number(attributeId) }
              }
            },
            select: { id: true }
          });
          // Families containing the attribute (FamilyAttribute)
          const familyAttributes = await prisma.familyAttribute.findMany({
            where: {
              attributeId: Number(attributeId)
            },
            select: { familyId: true }
          });
          const familyIds = familyAttributes.map(fa => fa.familyId);
          let familyProducts: { id: number }[] = [];
          if (familyIds.length > 0) {
            familyProducts = await prisma.product.findMany({
              where: {
                familyId: { in: familyIds }
              },
              select: { id: true }
            });
          }
          // Merge product IDs and remove duplicates
          const allProductIds = Array.from(new Set([
            ...directProducts.map(p => p.id),
            ...familyProducts.map(p => p.id)
          ]));
          for (const productId of allProductIds) {
            console.log('[Extension] Updating product status for productId:', productId);
            await updateProductStatus(productId);
          }
          await prisma.$disconnect();
        }
        return result;
      },
      async create({ args, query }) {
        console.log('[TRIGGER] Attribute create trigger activated');
        // No need to trigger on attribute create
        return query(args);
      },
      async delete({ args, query }) {
        console.log('[TRIGGER] Attribute delete trigger activated');
        console.log('[Extension] delete attribute args:', JSON.stringify(args, null, 2));
        const result = await query(args);
        const attributeId = args.where?.id;
        if (attributeId) {
          const prisma = new PrismaClient();
          const products = await prisma.product.findMany({
            where: {
              attributes: {
                some: { attributeId }
              }
            },
            select: { id: true }
          });
          for (const product of products) {
            console.log('[Extension] Updating product status for productId:', product.id);
            await updateProductStatus(product.id);
          }
          await prisma.$disconnect();
        }
        return result;
      },
      async upsert({ args, query }) {
        console.log('[TRIGGER] Attribute upsert trigger activated');
        // No need to trigger on attribute upsert
        return query(args);
      }
    }
  }
});
