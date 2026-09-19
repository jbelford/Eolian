import { execFileSync } from 'node:child_process';
import { builtinModules } from 'node:module';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { defineConfig } from 'vite';

interface PackageManifest {
  dependencies?: Record<string, string>;
}

const root = import.meta.dirname;
const sourceDirectory = resolve(root, 'src');
const packageManifest = JSON.parse(
  readFileSync(resolve(root, 'package.json'), 'utf8'),
) as PackageManifest;
const runtimeDependencies = Object.keys(packageManifest.dependencies ?? {});
const nodeBuiltins = new Set(builtinModules);

function isRuntimeDependency(id: string): boolean {
  return (
    id.startsWith('node:') ||
    nodeBuiltins.has(id) ||
    runtimeDependencies.some(dependency => id === dependency || id.startsWith(`${dependency}/`))
  );
}

function getCommitDate(): string {
  return execFileSync('git', ['log', '-1', '--date=format:%d.%m.%y', '--format=%ad'], {
    encoding: 'utf8',
  }).trim();
}

export default defineConfig(({ mode }) => ({
  define: {
    __COMMIT_DATE__: JSON.stringify(getCommitDate()),
  },
  resolve: {
    alias: {
      '@eolian': sourceDirectory,
    },
  },
  build: {
    ssr: resolve(sourceDirectory, 'app.ts'),
    target: 'node20',
    outDir: resolve(root, 'dist'),
    emptyOutDir: true,
    sourcemap: mode === 'development',
    minify: mode === 'production' ? 'oxc' : false,
    rolldownOptions: {
      external: isRuntimeDependency,
      output: {
        format: 'cjs',
        entryFileNames: 'bundle.js',
        codeSplitting: false,
      },
    },
  },
}));
