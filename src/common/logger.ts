import { Format } from 'logform';
import * as winston from 'winston';
import { environment } from './env';

const formats: Format[] = [
  winston.format.timestamp(),
  winston.format.splat()
];

if (!environment.prod) {
  formats.push(winston.format.colorize());
}

formats.push(winston.format.printf(info => {
  return `${info.timestamp} ${info.level}: ${info.message}`
}))

export const logger = winston.createLogger({
  level: environment.debug ? 'debug' : 'info',
  exitOnError: false,
  format: winston.format.combine(...formats),
  transports: [
    new winston.transports.Console()
  ]
});