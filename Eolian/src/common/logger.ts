import { LoggingWinston } from '@google-cloud/logging-winston';
import * as winston from 'winston';
import environment from '../environments/env';

const transports: any[] = [
  new winston.transports.Console()
];

if (environment.prod) {
  transports.push(new LoggingWinston());
}

export const logger = winston.createLogger({
  level: environment.prod ? 'info' : 'debug',
  exitOnError: false,
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.colorize(),
    winston.format.printf(info => {
      return `${info.timestamp} ${info.level}: ${info.message}`
    })
  ),
  transports
});