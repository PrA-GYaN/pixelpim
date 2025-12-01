import { Prisma } from '@prisma/client';

/**
 * Prisma middleware for soft-delete functionality
 * Automatically filters out soft-deleted records in queries unless explicitly requested
 */
export const softDeleteMiddleware: Prisma.Middleware = async (params, next) => {
  // Models that support soft delete
  const softDeleteModels = ['Product', 'Asset'];

  // Check if this is a query on a soft-delete enabled model
  if (softDeleteModels.includes(params.model || '')) {
    // Operations that should filter out soft-deleted records
    const readOperations = [
      'findUnique',
      'findFirst',
      'findMany',
      'count',
      'aggregate',
      'groupBy',
    ];

    if (readOperations.includes(params.action)) {
      // Add isDeleted filter to WHERE clause if not already present
      if (params.args.where) {
        // Only add the filter if isDeleted is not explicitly set
        if (params.args.where.isDeleted === undefined) {
          params.args.where.isDeleted = false;
        }
      } else {
        // Create WHERE clause if it doesn't exist
        params.args.where = { isDeleted: false };
      }
    }

    // For update and delete operations, ensure we're not operating on soft-deleted records
    // unless explicitly requested
    if (['update', 'updateMany', 'delete', 'deleteMany'].includes(params.action)) {
      if (params.args.where) {
        // Only add the filter if isDeleted is not explicitly set
        if (params.args.where.isDeleted === undefined) {
          params.args.where.isDeleted = false;
        }
      } else {
        params.args.where = { isDeleted: false };
      }
    }
  }

  return next(params);
};
