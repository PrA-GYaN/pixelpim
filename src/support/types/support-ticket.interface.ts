export interface SupportTicket {
  subject: string;
  category: string;
  priority: 'Low' | 'Normal' | 'High' | 'Urgent';
  name: string;
  email: string;
  workspace?: string;
  url?: string;
  description: string;
  steps?: string;
  expected?: string;
  actual?: string;
  attachments?: Express.Multer.File[];
  submittedAt: Date;
  userAgent?: string;
  ipAddress?: string;
}