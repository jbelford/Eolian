// @ts-check

const path = require('path');
const fs = require('fs');
const nodeExternals = require('webpack-node-externals');
const webpack = require('webpack');

const alias = {};
const dir = path.join(__dirname, 'src');

fs.readdirSync(dir)
  .filter(filename => fs.statSync(path.join(dir, filename)).isDirectory())
  .forEach(filename => {
    const absPath = path.join(dir, filename);
    const aliasPath = path.join('@eolian', filename);
    console.log(`\t${aliasPath} -> ${absPath}`);
    alias[aliasPath] = absPath;
  });

let commitHash = require('child_process')
  .execSync('git log -1 --date=format:"%d.%m.%y" --format="%ad"')
  .toString()
  .trim();

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
  plugins: [
    new webpack.DefinePlugin({
      __COMMIT_DATE__: JSON.stringify(commitHash)
    })
  ],
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
