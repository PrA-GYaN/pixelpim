import { Controller, Post, Get, UseGuards, Request } from '@nestjs/common';
import { ApiKeyService } from './api-key.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('api-keys')
export class ApiKeyController {
  constructor(private apiKeyService: ApiKeyService) {}

  @UseGuards(JwtAuthGuard)
  @Post('generate')
  async generateKeys(@Request() req) {
    const userId = req.user.id;
    return this.apiKeyService.generateKeys(userId);
  }

  @UseGuards(JwtAuthGuard)
  @Get()
  async getKeys(@Request() req) {
    const userId = req.user.id;
    return this.apiKeyService.getKeys(userId);
  }

  @UseGuards(JwtAuthGuard)
  @Post('regenerate')
  async regenerateKeys(@Request() req) {
    const userId = req.user.id;
    return this.apiKeyService.regenerateKeys(userId);
  }
}