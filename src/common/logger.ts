import * as winston from 'winston';
import { environment } from './env';

const transports: any[] = [
  new winston.transports.Console()
];

if (environment.prod) {
  // transports.push(new LoggingWinston());
}

export const logger = winston.createLogger({
  level: environment.debug ? 'debug' : 'info',
  exitOnError: false,
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.splat(),
    winston.format.colorize(),
    winston.format.printf(info => {
      return `${info.timestamp} ${info.level}: ${info.message}`
    })
  ),
  transports
});