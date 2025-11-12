import { Controller, Post, Get, Put, Delete, Body, Param, UseGuards, Request } from '@nestjs/common';
import { WebhookService } from './webhook.service';
import { CreateWebhookDto } from './dto/create-webhook.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('webhooks')
export class WebhookController {
  constructor(private webhookService: WebhookService) {}

  @UseGuards(JwtAuthGuard)
  @Post()
  async createWebhook(@Request() req, @Body() dto: CreateWebhookDto) {
    const userId = req.user.id;
    return this.webhookService.createWebhook(userId, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Get()
  async getWebhooks(@Request() req) {
    const userId = req.user.id;
    return this.webhookService.getWebhooks(userId);
  }

  @UseGuards(JwtAuthGuard)
  @Put(':id')
  async updateWebhook(@Request() req, @Param('id') id: string, @Body() dto: Partial<CreateWebhookDto>) {
    const userId = req.user.id;
    return this.webhookService.updateWebhook(userId, +id, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  async deleteWebhook(@Request() req, @Param('id') id: string) {
    const userId = req.user.id;
    return this.webhookService.deleteWebhook(userId, +id);
  }
}