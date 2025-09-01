// utils/productUtils.ts

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
                  select: { id: true }
              }
            }
          }
        }
      },
    attributes: {
      include: { attribute: true }
    }
    }
  });

  if (!product) {
    console.warn(`[updateProductStatus] Product not found for productId: ${productId}`);
    return;
  }

  // 1. If Family exists, all required attributes must have default values, Status Complete
  // 2. If have attribute ids in attributes, then it must have default values, Status Complete
  // 3. If it doesn't have family or attribute ids in attributes, Status Complete

    const hasFamily = !!product.family;
    const productAttributes = (product.attributes as any) || [];
    const hasAttributeIds = productAttributes.length > 0;

  let status = 'complete';
  let reason = '';

  if (hasFamily) {
    // Check all required family attributes for default values
      const requiredAttributes = (product.family as any)?.familyAttributes || [];
      const allRequiredHaveDefault = requiredAttributes.every((fa: any) => fa.attribute?.defaultValue !== null && fa.attribute?.defaultValue !== '');
    if (!allRequiredHaveDefault) {
      status = 'incomplete';
      reason = 'Family exists but not all required attributes have default values.';
    } else {
      reason = 'Family exists and all required attributes have default values.';
    }
  } else if (hasAttributeIds) {
    // Check all product attributes for default values
  console.log('[updateProductStatus] Product attribute default values:', productAttributes.map((attr: any) => attr.attribute?.defaultValue));
  const allAttributesHaveDefault = productAttributes.every((attr: any) => attr.attribute?.defaultValue !== null && attr.attribute?.defaultValue !== '');
    if (!allAttributesHaveDefault) {
      status = 'incomplete';
      reason = 'Product has attribute IDs but not all have default values.';
    } else {
      reason = 'Product has attribute IDs and all have default values.';
    }
  } else {
    // No family and no attribute ids, status is complete
    status = 'complete';
    reason = 'Product has neither family nor attribute IDs.';
  }

  await prisma.product.update({
    where: { id: productId },
    data: { status }
  });
  console.log(`[updateProductStatus] Saved status '${status}' for productId ${productId}. Reason: ${reason}`);
}
