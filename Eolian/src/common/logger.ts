import * as winston from 'winston';

const env = process.env.NODE_ENV || 'local';
const isProd = env === 'prod';

export const logger = winston.createLogger({
  level: isProd ? 'info' : 'debug',
  exitOnError: false,
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.colorize(),
    winston.format.printf(info => {
      return `${info.timestamp} ${info.level}: ${info.message}`
    })
  ),
  transports: [
    new winston.transports.Console()
  ]
});