// @ts-check

const path = require('path');
const fs = require('fs');
const nodeExternals = require('webpack-node-externals');

const alias = {};
const dir = path.join(__dirname, 'src');

fs.readdirSync(dir)
  .filter(filename => fs.statSync(path.join(dir, filename)).isDirectory())
  .forEach(filename => {
    const absPath = path.join(dir, filename);
    console.log(`\t${filename} -> ${absPath}`);
    alias[filename] = absPath;
  });

module.exports = {
  mode: 'production',
  entry: path.join(dir, 'app.ts'),
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: 'ts-loader',
        exclude: /node_modules/,
      },
    ],
  },
  resolve: {
    extensions: ['.tsx', '.ts', '.js'],
    alias: alias,
  },
  target: 'node',
  externals: [nodeExternals()],
  output: {
    filename: 'bundle.js',
    path: path.resolve(__dirname, 'dist'),
  },
};
