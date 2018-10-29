const nodeEnvMatcher = /^NODE_ENV=(.+)$/;
const nodeEnv = process.argv.find(arg => nodeEnvMatcher.test(arg));
if (nodeEnv) {
  process.env.NODE_ENV = nodeEnvMatcher.exec(nodeEnv)[1];
}

console.log(`Using environment: ${process.env.NODE_ENV}`)

module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  moduleDirectories: ['node_modules', 'src'],
};