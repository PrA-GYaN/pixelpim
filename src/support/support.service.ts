import { Injectable } from '@nestjs/common';
import { CreateSupportTicketDto } from './dto/create-support-ticket.dto';
import { SupportTicket } from './types/support-ticket.interface';
import { EmailService } from '../auth/email.service';

@Injectable()
export class SupportService {
  constructor(private readonly emailService: EmailService) {}

  async createSupportTicket(
    createSupportTicketDto: CreateSupportTicketDto,
    files: Express.Multer.File[] = [],
    userAgent?: string,
    ipAddress?: string,
  ): Promise<{ success: boolean; message: string }> {
    // Honeypot check - if website field is filled, it's likely a bot
    if (createSupportTicketDto.website && createSupportTicketDto.website.trim() !== '') {
      throw new Error('Invalid submission detected');
    }

    const ticket: SupportTicket = {
      ...createSupportTicketDto,
      priority: createSupportTicketDto.priority as 'Low' | 'Normal' | 'High' | 'Urgent',
      attachments: files,
      submittedAt: new Date(),
      userAgent,
      ipAddress,
    };

    try {
      // Send email notification to support team
      await this.emailService.sendSupportTicketEmail(ticket);

      // Send confirmation email to user
      await this.emailService.sendSupportConfirmationEmail(
        ticket.email,
        ticket.name,
        ticket.subject,
      );

      return {
        success: true,
        message: 'Support ticket submitted successfully. We will respond within one business day.',
      };
    } catch (error) {
      console.error('Failed to process support ticket:', error);
      throw new Error('Failed to submit support ticket. Please try again later.');
    }
  }
}