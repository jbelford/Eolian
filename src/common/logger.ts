import { Format } from 'logform';
import * as winston from 'winston';
import { environment } from './env';

const formats: Format[] = !environment.prod
  ? [
      winston.format.timestamp(),
      winston.format.splat(),
      winston.format.colorize(),
      winston.format.printf(info => `${info.timestamp} ${info.level}: ${info.message}`),
    ]
  : [winston.format.splat(), winston.format.simple()];

export const logger = winston.createLogger({
  level: environment.debug ? 'debug' : 'info',
  exitOnError: false,
  format: winston.format.combine(...formats),
  transports: [new winston.transports.Console()],
});
