import { Exclude, Expose, Transform } from 'class-transformer';

export class NotificationResponseDto {
  @Expose()
  id: number;

  @Expose()
  entityType: string;

  @Expose()
  entityId?: number;

  @Expose()
  action: string;

  @Expose()
  entityName?: string;

  @Expose()
  message: string;

  @Expose()
  metadata?: any;

  @Expose()
  @Transform(({ value }) => value instanceof Date ? value.toISOString() : value)
  createdAt: string;

  @Exclude()
  userId: number;

  constructor(partial: Partial<NotificationResponseDto>) {
    Object.assign(this, partial);
    if (partial.createdAt && typeof partial.createdAt !== 'string') {
      this.createdAt = new Date(partial.createdAt).toISOString();
    }
  }
}
