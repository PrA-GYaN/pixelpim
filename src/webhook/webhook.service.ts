import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateWebhookDto } from './dto';
import * as crypto from 'crypto';

@Injectable()
export class WebhookService {
  constructor(private prisma: PrismaService) {}

  async createWebhook(userId: number, dto: CreateWebhookDto) {
    return this.prisma.webhook.create({
      data: {
        userId,
        url: dto.url,
        events: dto.events,
        isActive: dto.isActive ?? true,
      },
    });
  }

  async getWebhooks(userId: number) {
    return this.prisma.webhook.findMany({
      where: { userId },
    });
  }

  async updateWebhook(userId: number, webhookId: number, dto: Partial<CreateWebhookDto>) {
    return this.prisma.webhook.update({
      where: { id: webhookId, userId },
      data: dto,
    });
  }

  async deleteWebhook(userId: number, webhookId: number) {
    return this.prisma.webhook.delete({
      where: { id: webhookId, userId },
    });
  }

  async deliverWebhook(webhookId: number, event: string, payload: any) {
    const webhook = await this.prisma.webhook.findUnique({
      where: { id: webhookId },
      include: { user: true },
    });

    if (!webhook || !webhook.isActive) return;

    const secretKey = webhook.user.secretKey;
    if (!secretKey) return;

    // Generate HMAC signature
    const signature = crypto
      .createHmac('sha256', secretKey)
      .update(JSON.stringify(payload))
      .digest('hex');

    try {
      console.log(`Sending webhook POST request to ${webhook.url} for event: ${event}`);
      // Use fetch or axios to send POST
      const response = await fetch(webhook.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Signature': `sha256=${signature}`,
          'X-Webhook-Event': event,
        },
        body: JSON.stringify(payload),
      });

      const responseText = await response.text();

      await this.prisma.webhookDelivery.create({
        data: {
          webhookId,
          event,
          payload,
          status: response.ok ? 'success' : 'failed',
          response: responseText,
        },
      });
    } catch (error) {
      await this.prisma.webhookDelivery.create({
        data: {
          webhookId,
          event,
          payload,
          status: 'failed',
          response: error.message,
        },
      });
    }
  }

  async getActiveWebhooksForEvent(userId: number, event: string) {
    return this.prisma.webhook.findMany({
      where: {
        userId,
        isActive: true,
        events: {
          has: event,
        },
      },
    });
  }
}