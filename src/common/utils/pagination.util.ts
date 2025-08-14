import { PaginatedResponse, PaginationMeta, PaginationParams } from '../dto/pagination.dto';

export class PaginationUtils {
  /**
   * Creates a paginated response object
   */
  static createPaginatedResponse<T>(
    data: T[],
    total: number,
    page: number,
    limit: number
  ): PaginatedResponse<T> {
    const pagination = new PaginationMeta(page, limit, total);
    
    return {
      data,
      pagination: {
        page: pagination.page,
        limit: pagination.limit,
        total: pagination.total,
        totalPages: pagination.totalPages,
        hasNext: pagination.hasNext,
        hasPrev: pagination.hasPrev,
      },
    };
  }

  /**
   * Extracts pagination parameters from query
   */
  static extractPaginationParams(page: number = 1, limit: number = 10): PaginationParams {
    const validPage = Math.max(1, page);
    const validLimit = Math.min(100, Math.max(1, limit));
    const skip = (validPage - 1) * validLimit;

    return {
      page: validPage,
      limit: validLimit,
      skip,
    };
  }

  /**
   * Creates Prisma pagination options
   */
  static createPrismaOptions(page: number = 1, limit: number = 10) {
    const params = this.extractPaginationParams(page, limit);
    
    return {
      skip: params.skip,
      take: params.limit,
    };
  }
}
