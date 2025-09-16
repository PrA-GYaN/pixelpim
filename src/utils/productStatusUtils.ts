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
                  select: { id: true, defaultValue: true }
              }
            }
          }
        }
      },
    attributes: {
      include: { attribute: { select: { id: true, defaultValue: true } } }
    }
    }
  });

  if (!product) {
    console.warn(`[updateProductStatus] Product not found for productId: ${productId}`);
    return;
  }

  // 1. If Family exists, all required attributes must have either custom values or default values, Status Complete
  // 2. If have attribute ids in attributes, then they must have either custom values or default values, Status Complete
  // 3. If it doesn't have family or attribute ids in attributes, Status Complete

    const hasFamily = !!product.family;
    const productAttributes = (product.attributes as any) || [];
    const hasAttributeIds = productAttributes.length > 0;

  let status = 'complete';
  let reason = '';

  if (hasFamily) {
    // Check all required family attributes - they need to have either custom values or default values
    const requiredAttributes = (product.family as any)?.familyAttributes || [];

    // For family attributes, we need to check if there are ProductAttribute entries with values
    const requiredAttributeIds = requiredAttributes.map((fa: any) => fa.attribute.id);
    const familyAttributeValues = productAttributes.filter((pa: any) =>
      requiredAttributeIds.includes(pa.attribute.id)
    );

    // Check if all required family attributes have values (either custom or default)
    const allRequiredHaveValues = requiredAttributes.every((fa: any) => {
      const productAttr = familyAttributeValues.find((pa: any) => pa.attribute.id === fa.attribute.id);
      const hasCustomValue = productAttr?.value !== null && productAttr?.value !== '';
      const hasDefaultValue = fa.attribute?.defaultValue !== null && fa.attribute?.defaultValue !== '';
      return hasCustomValue || hasDefaultValue;
    });

    if (!allRequiredHaveValues) {
      status = 'incomplete';
      reason = 'Family exists but not all required attributes have values.';
    } else {
      reason = 'Family exists and all required attributes have values.';
    }
  } else if (hasAttributeIds) {
    // Check all product attributes - they need to have either custom values or default values
    const allAttributesHaveValues = productAttributes.every((attr: any) => {
      const hasCustomValue = attr.value !== null && attr.value !== '';
      const hasDefaultValue = attr.attribute?.defaultValue !== null && attr.attribute?.defaultValue !== '';
      return hasCustomValue || hasDefaultValue;
    });

    if (!allAttributesHaveValues) {
      status = 'incomplete';
      reason = 'Product has attributes but not all have values.';
    } else {
      reason = 'Product has attributes and all have values.';
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
