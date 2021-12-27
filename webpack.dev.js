// @ts-check

const config = require('./webpack.prod');

config.mode = 'development';
config.devtool = 'source-map';

module.exports = config;
