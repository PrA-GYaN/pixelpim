// utils/productStatusUtils.ts

import { PrismaClient } from '../../generated/prisma';

const prisma = new PrismaClient();

export async function updateProductStatus(productId: number) {
  console.log(`[updateProductStatus] Called for productId: ${productId}`);
  const product = await prisma.product.findUnique({
    where: { id: productId },
    include: {
      family: {
        include: {
          familyAttributes: {
            where: { isRequired: true },
            include: {
              attribute: {
                select: { id: true, name: true, defaultValue: true }
              }
            }
          }
        }
      },
      attributes: {
        select: {
          value: true,
          attribute: {
            select: { id: true, name: true, defaultValue: true }
          }
        }
      }
    }
  });

  if (!product) {
    console.warn(`[updateProductStatus] Product not found for productId: ${productId}`);
    return;
  }

  const hasFamily = !!product.family;
  const productAttributes = product.attributes || [];

  let status = 'incomplete';
  let reason = '';

  // Product is complete ONLY if it has a family AND all required attributes have values
  if (hasFamily) {
    const requiredAttributes = product.family?.familyAttributes || [];

    if (requiredAttributes.length > 0) {
      // Check if all required family attributes have product-attribute values (not default values)
      const requiredAttributeIds = requiredAttributes.map((fa: any) => fa.attribute.id);
      const familyAttributeValues = productAttributes.filter((pa: any) =>
        requiredAttributeIds.includes(pa.attribute.id)
      );

      const allRequiredHaveProductValues = requiredAttributes.every((fa: any) => {
        const productAttr = familyAttributeValues.find((pa: any) => pa.attribute.id === fa.attribute.id);
        // Only consider product-attribute values, not default values
        const hasProductValue = productAttr && productAttr.value !== null && productAttr.value !== '';
        return hasProductValue;
      });

      if (allRequiredHaveProductValues) {
        status = 'complete';
        reason = 'Family exists and all required attributes have product-attribute values.';
      } else {
        status = 'incomplete';
        reason = 'Family exists but not all required attributes have product-attribute values.';
      }
    } else {
      // Family exists but has no required attributes - still incomplete
      status = 'incomplete';
      reason = 'Family exists but has no required attributes.';
    }
  } else {
    // No family - incomplete
    status = 'incomplete';
    reason = 'Product does not have a family assigned.';
  }

  await prisma.product.update({
    where: { id: productId },
    data: { status }
  });
  console.log(`[updateProductStatus] Saved status '${status}' for productId ${productId}. Reason: ${reason}`);
}
