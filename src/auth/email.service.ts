import { Injectable } from '@nestjs/common';
import * as nodemailer from 'nodemailer';

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
}
