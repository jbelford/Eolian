import { logger } from "common/logger";

/**
 * Load the corresponding environment variables
 * Default to local environment if not specified
 */

const env = process.env.NODE_ENV || 'local';

let environment: Environment;

try {
  environment = require(`./env.${env}`);
} catch (e) {
  logger.error(`Failed to resolve environment '${env}'\n${e.stack || e}`);
  process.exit(1);
}

export default environment;