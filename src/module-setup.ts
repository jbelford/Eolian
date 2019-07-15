/**
 * Import this script to map node imports to baseDir alias
 */

import * as fs from 'fs';
import * as moduleAlias from 'module-alias';
import * as path from 'path';
import { logger } from './common/logger';

// Set up module aliases
logger.info('Configuring module aliases...');
// Can't use the `withFileTypes` option here because node is broken -> using statSync instead
const files = fs.readdirSync(__dirname);
files.filter(filename => fs.statSync(path.join(__dirname, filename)).isDirectory())
  .forEach(filename => {
    const absPath = path.join(__dirname, filename);
    logger.info(`\t${filename} -> ${absPath}`);
    moduleAlias.addAlias(filename, absPath);
  });