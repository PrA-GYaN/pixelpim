import { Injectable } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import { SupportTicket } from '../support/types/support-ticket.interface';

@Injectable()
export class EmailService {
  private transporter: nodemailer.Transporter;

  constructor() {
    // Configure your email provider here
    // For Gmail: Use App Password (not your regular Gmail password)
    // Steps to get App Password:
    // 1. Enable 2-factor authentication on your Google account
    // 2. Go to Google Account settings > Security > App passwords
    // 3. Generate a new app password for "Mail"
    // 4. Use this 16-character app password in SMTP_PASS
    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: false, // true for 465, false for other ports
      auth: {
        user: process.env.SMTP_USER, // your Gmail address
        pass: process.env.SMTP_PASS, // your Gmail App Password (16 characters)
      },
    });
  }

  async sendOtpEmail(email: string, otp: string): Promise<void> {
    const mailOptions = {
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to: email,
      subject: 'PixelPim - Email Verification Code',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #333; text-align: center;">Email Verification</h2>
          <p style="color: #666; font-size: 16px;">Hello,</p>
          <p style="color: #666; font-size: 16px;">
            You have requested to create an account with PixelPim. Please use the following verification code to complete your registration:
          </p>
          <div style="background-color: #f4f4f4; padding: 20px; border-radius: 8px; text-align: center; margin: 20px 0;">
            <h1 style="color: #333; font-size: 32px; letter-spacing: 8px; margin: 0;">${otp}</h1>
          </div>
          <p style="color: #666; font-size: 14px;">
            This code will expire in 10 minutes for security reasons.
          </p>
          <p style="color: #666; font-size: 14px;">
            If you didn't request this code, please ignore this email.
          </p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
          <p style="color: #999; font-size: 12px; text-align: center;">
            This is an automated message from PixelPim. Please do not reply to this email.
          </p>
        </div>
      `,
    };

    try {
      await this.transporter.sendMail(mailOptions);
    } catch (error) {
      console.error('Failed to send email:', error);
      throw new Error('Failed to send OTP email');
    }
  }

  async sendSupportTicketEmail(ticket: SupportTicket): Promise<void> {
    const attachmentInfo = ticket.attachments && ticket.attachments.length > 0 
      ? ticket.attachments.map(file => `${file.originalname} (${Math.round(file.size / 1024)} KB)`).join(', ')
      : 'No attachments';

    const mailOptions = {
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to: 'pragyankc147@gmail.com',
      subject: `[PixelPim Support] ${ticket.priority} - ${ticket.subject}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 700px; margin: 0 auto; padding: 20px;">
          <div style="background-color: #064f2c; color: white; padding: 20px; border-radius: 8px 8px 0 0;">
            <h1 style="margin: 0; font-size: 24px;">New Support Ticket</h1>
            <p style="margin: 5px 0 0 0; opacity: 0.9;">Priority: ${ticket.priority}</p>
          </div>
          
          <div style="background-color: #f9f9f9; padding: 20px; border: 1px solid #e0e0e0;">
            <h2 style="color: #064f2c; margin-top: 0;">${ticket.subject}</h2>
            
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin: 20px 0;">
              <div>
                <strong>Customer Information:</strong><br>
                Name: ${ticket.name}<br>
                Email: ${ticket.email}<br>
                ${ticket.workspace ? `Workspace: ${ticket.workspace}<br>` : ''}
              </div>
              <div>
                <strong>Ticket Details:</strong><br>
                Category: ${ticket.category}<br>
                Priority: ${ticket.priority}<br>
                Submitted: ${ticket.submittedAt.toLocaleString()}<br>
              </div>
            </div>

            ${ticket.url ? `<p><strong>Related URL:</strong> <a href="${ticket.url}" target="_blank">${ticket.url}</a></p>` : ''}
            
            <div style="margin: 20px 0;">
              <h3 style="color: #064f2c; margin-bottom: 10px;">Description</h3>
              <div style="background-color: white; padding: 15px; border-radius: 6px; border-left: 4px solid #064f2c;">
                ${ticket.description.replace(/\n/g, '<br>')}
              </div>
            </div>

            ${ticket.steps ? `
              <div style="margin: 20px 0;">
                <h3 style="color: #064f2c; margin-bottom: 10px;">Steps to Reproduce</h3>
                <div style="background-color: white; padding: 15px; border-radius: 6px;">
                  ${ticket.steps.replace(/\n/g, '<br>')}
                </div>
              </div>
            ` : ''}

            ${ticket.expected ? `
              <div style="margin: 20px 0;">
                <h3 style="color: #064f2c; margin-bottom: 10px;">Expected Behavior</h3>
                <div style="background-color: white; padding: 15px; border-radius: 6px;">
                  ${ticket.expected.replace(/\n/g, '<br>')}
                </div>
              </div>
            ` : ''}

            ${ticket.actual ? `
              <div style="margin: 20px 0;">
                <h3 style="color: #064f2c; margin-bottom: 10px;">Actual Behavior</h3>
                <div style="background-color: white; padding: 15px; border-radius: 6px;">
                  ${ticket.actual.replace(/\n/g, '<br>')}
                </div>
              </div>
            ` : ''}

            <div style="margin: 20px 0;">
              <h3 style="color: #064f2c; margin-bottom: 10px;">Attachments</h3>
              <div style="background-color: white; padding: 15px; border-radius: 6px;">
                ${attachmentInfo}
              </div>
            </div>

            ${ticket.userAgent || ticket.ipAddress ? `
              <div style="margin: 20px 0; padding: 15px; background-color: #f0f0f0; border-radius: 6px; font-size: 12px; color: #666;">
                <strong>Technical Information:</strong><br>
                ${ticket.userAgent ? `User Agent: ${ticket.userAgent}<br>` : ''}
                ${ticket.ipAddress ? `IP Address: ${ticket.ipAddress}<br>` : ''}
              </div>
            ` : ''}
          </div>
          
          <div style="background-color: #064f2c; color: white; padding: 15px; border-radius: 0 0 8px 8px; text-align: center; font-size: 12px;">
            <p style="margin: 0;">PixelPim Support System - Respond to: ${ticket.email}</p>
          </div>
        </div>
      `,
      attachments: ticket.attachments?.map(file => ({
        filename: file.originalname,
        content: file.buffer, // Using file.buffer from memoryStorage to attach files to email
      })) || [],
    };

    try {
      await this.transporter.sendMail(mailOptions);
    } catch (error) {
      console.error('Failed to send support ticket email:', error);
      throw new Error('Failed to send support ticket email');
    }
  }

  async sendSupportConfirmationEmail(email: string, name: string, subject: string): Promise<void> {
    const mailOptions = {
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to: email,
      subject: 'PixelPim Support - Ticket Received',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background-color: #064f2c; color: white; padding: 20px; border-radius: 8px 8px 0 0; text-align: center;">
            <h1 style="margin: 0; font-size: 24px;">Thank You for Contacting Us</h1>
          </div>
          
          <div style="background-color: #f9f9f9; padding: 20px; border: 1px solid #e0e0e0;">
            <p style="color: #333; font-size: 16px; margin-top: 0;">Hi ${name},</p>
            
            <p style="color: #666; font-size: 16px;">
              We've received your support request and wanted to confirm that it's in our queue. 
              Here are the details we have on file:
            </p>
            
            <div style="background-color: white; padding: 15px; border-radius: 6px; border-left: 4px solid #064f2c; margin: 20px 0;">
              <strong>Subject:</strong> ${subject}
            </div>
            
            <p style="color: #666; font-size: 16px;">
              <strong>What happens next?</strong>
            </p>
            
            <ul style="color: #666; font-size: 16px; line-height: 1.6;">
              <li>Our support team will review your request</li>
              <li>We aim to respond within one business day</li>
              <li>You'll receive a follow-up email from our team</li>
              <li>If urgent, we may contact you directly</li>
            </ul>
            
            <div style="background-color: #e8f5e8; padding: 15px; border-radius: 6px; margin: 20px 0;">
              <p style="margin: 0; color: #064f2c; font-weight: bold;">
                💡 Tip: Keep this email for your records. You can reply to any follow-up emails to continue the conversation.
              </p>
            </div>
            
            <p style="color: #666; font-size: 14px;">
              If you have any additional information or screenshots that might help us resolve your issue faster, 
              feel free to reply to this email.
            </p>
          </div>
          
          <div style="background-color: #064f2c; color: white; padding: 15px; border-radius: 0 0 8px 8px; text-align: center;">
            <p style="margin: 0; font-size: 14px;">
              Thank you for using PixelPim! <br>
              <span style="font-size: 12px; opacity: 0.8;">This is an automated confirmation. Please do not reply to this email.</span>
            </p>
          </div>
        </div>
      `,
    };

    try {
      await this.transporter.sendMail(mailOptions);
    } catch (error) {
      console.error('Failed to send confirmation email:', error);
      throw new Error('Failed to send confirmation email');
    }
  }
}
