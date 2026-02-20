import { WinstonModule } from 'nest-winston';
import * as winston from 'winston';
import * as path from 'path';
import * as fs from 'fs';

const logDir = path.resolve(process.cwd(), 'logs');

// HARD guarantee the folder exists
fs.mkdirSync(logDir, { recursive: true });

export const logger = WinstonModule.createLogger({
  level: 'info',
  transports: [
    new winston.transports.Console(),

    new winston.transports.File({
      dirname: logDir,
      filename: 'app.log',
    }),

    new winston.transports.File({
      dirname: logDir,
      filename: 'error.log',
      level: 'error',
    }),
  ],
});
