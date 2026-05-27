/**
 * Purpose: Dependency-cycle scan for local TypeScript source imports.
 * Caller: npm run scan:imports and verification workflows.
 * Deps: Node.js fs/path modules and project TypeScript source files.
 * MainFuncs: Builds a local import graph for API and web sources and reports import cycles.
 * SideEffects: Reads source files and writes scan results to stdout/stderr.
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, extname, join, normalize, relative, resolve } from 'node:path';

const roots = [resolve('apps/api/src'), resolve('apps/web/src')];
const ignored = new Set(['node_modules', 'dist', 'build', '.next', '.nuxt', '.cache', 'coverage']);
const graph = new Map();

for (const root of roots) {
  for (const file of walk(root)) {
    graph.set(file, importsFor(file));
  }
}

const cycles = findCycles(graph);
if (cycles.length > 0) {
  for (const cycle of cycles) {
    console.error(cycle.map((file) => relative(process.cwd(), file)).join(' -> '));
  }
  process.exit(1);
}

console.log(`No local import cycles found in ${graph.size} files.`);

function* walk(dir) {
  for (const entry of readdirSync(dir)) {
    if (ignored.has(entry)) {
      continue;
    }
    const path = join(dir, entry);
    const stat = statSync(path);
    if (stat.isDirectory()) {
      yield* walk(path);
    } else if (/\.(ts|tsx|mts)$/.test(entry) && !entry.endsWith('.d.ts')) {
      yield path;
    }
  }
}

function importsFor(file) {
  const source = readFileSync(file, 'utf8');
  const imports = [];
  const pattern = /(?:import|export)\s+(?:type\s+)?(?:[^'"]*?\s+from\s+)?['"]([^'"]+)['"]/g;
  for (const match of source.matchAll(pattern)) {
    const resolved = resolveImport(file, match[1]);
    if (resolved) {
      imports.push(resolved);
    }
  }
  return imports;
}

function resolveImport(file, specifier) {
  if (specifier.startsWith('@/')) {
    return resolveCandidate(resolve('apps/web/src', specifier.slice(2)));
  }
  if (!specifier.startsWith('.')) {
    return null;
  }
  return resolveCandidate(resolve(dirname(file), specifier));
}

function resolveCandidate(base) {
  const candidates = [base, `${base}.ts`, `${base}.tsx`, `${base}.mts`, join(base, 'index.ts'), join(base, 'index.tsx')];
  for (const candidate of candidates) {
    if (existsSync(candidate) && statSync(candidate).isFile()) {
      return normalize(candidate);
    }
  }
  return null;
}

function findCycles(localGraph) {
  const cycles = [];
  const visiting = new Set();
  const visited = new Set();
  const stack = [];
  const seen = new Set();

  for (const node of localGraph.keys()) {
    visit(node);
  }
  return cycles;

  function visit(node) {
    if (visiting.has(node)) {
      const start = stack.indexOf(node);
      const cycle = stack.slice(start).concat(node);
      const key = cycle.map((item) => relative(process.cwd(), item)).sort().join('|');
      if (!seen.has(key)) {
        seen.add(key);
        cycles.push(cycle);
      }
      return;
    }
    if (visited.has(node)) {
      return;
    }
    visiting.add(node);
    stack.push(node);
    for (const next of localGraph.get(node) ?? []) {
      if (localGraph.has(next)) {
        visit(next);
      }
    }
    stack.pop();
    visiting.delete(node);
    visited.add(node);
  }
}
