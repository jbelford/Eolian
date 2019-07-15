const nodeEnvMatcher = /^NODE_ENV=(.+)$/;
const nodeEnv = process.argv.find(arg => nodeEnvMatcher.test(arg));
process.env.NODE_ENV = nodeEnv ? nodeEnvMatcher.exec(nodeEnv)[1]
  : 'local';

console.log(`Using environment: ${process.env.NODE_ENV}`)

module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  moduleDirectories: ['node_modules', 'src'],
  modulePathIgnorePatterns: [
    '<rootDir>/node_modules'
  ],
  roots: [
    '<rootDir>/test'
  ]
};