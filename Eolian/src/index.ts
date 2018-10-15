import * as fs from 'fs';
import * as moduleAlias from 'module-alias';
import { logger } from './common/logger';

// Set up module aliases
logger.info('Configuring module aliases...');
// Can't use the `withFileTypes` option here because node is broken -> using statSync instead
const files = fs.readdirSync(__dirname);
files.filter(filename => fs.statSync(`${__dirname}/${filename}`).isDirectory())
  .forEach(filename => {
    const path = `${__dirname}/${filename}`;
    logger.info(`\t${filename} -> ${path}`);
    moduleAlias.addAlias(filename, path);
  });

// Start app
require('./app');