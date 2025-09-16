import {
  Controller,
  Post,
  Body,
  UseInterceptors,
  UploadedFiles,
  HttpException,
  HttpStatus,
  Req,
  BadRequestException,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import type { Request } from 'express';
import { SupportService } from './support.service';
import { CreateSupportTicketDto } from './dto/create-support-ticket.dto';
import { memoryStorage } from 'multer';

// Configure multer for file uploads (using memory storage to keep files in buffer for email attachments)
const storage = memoryStorage();

const fileFilter = (req: any, file: Express.Multer.File, callback: any) => {
  // Allow specific file types
  const allowedMimes = [
    'image/png',
    'image/jpeg',
    'image/jpg',
    'image/webp',
    'application/pdf',
    'text/csv',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
    'application/vnd.ms-excel', // .xls
  ];

  if (allowedMimes.includes(file.mimetype)) {
    callback(null, true);
  } else {
    callback(new Error('Invalid file type. Only PNG, JPG, WEBP, PDF, CSV, and XLSX files are allowed.'), false);
  }
};

@Controller('api/support')
export class SupportController {
  constructor(private readonly supportService: SupportService) {}

  @Post('tickets')
  @UseInterceptors(
    FilesInterceptor('attachments', 10, {
      storage,
      fileFilter,
      limits: {
        fileSize: 25 * 1024 * 1024, // 25MB per file
        files: 10, // Maximum 10 files
      },
    }),
  )
  async createSupportTicket(
    @Body() createSupportTicketDto: CreateSupportTicketDto,
    @UploadedFiles() files: Express.Multer.File[],
    @Req() req: Request,
  ) {
    try {
      // Extract user agent and IP address for debugging
      const userAgent = req.get('User-Agent');
      const ipAddress = req.ip || req.connection.remoteAddress || 'unknown';

      const result = await this.supportService.createSupportTicket(
        createSupportTicketDto,
        files,
        userAgent,
        ipAddress,
      );

      return result;
    } catch (error) {
      if (error.message === 'Invalid submission detected') {
        throw new BadRequestException('Invalid submission detected');
      }
      
      console.error('Support ticket creation error:', error);
      throw new HttpException(
        {
          success: false,
          message: error.message || 'Failed to submit support ticket. Please try again later.',
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}