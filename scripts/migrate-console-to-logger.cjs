#!/usr/bin/env node
/**
 * Pass 11 — Console-to-logger migration (v2, robust)
 *
 * Improvements over v1:
 *   - Properly walks past multi-line `import { ... } from '...'` blocks
 *     before inserting the new logger import. v1 split a multi-line
 *     import in half by inserting between `import {` and `} from`.
 *   - Skips files where `console.log/warn` only appears inside a
 *     comment block — no need to add a logger import there.
 *   - Uses a parser-style scan for top-level imports rather than
 *     line-by-line heuristics.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SRC = path.join(ROOT, 'src');

const SKIP_PATTERNS = [
  /[/\\]tests?[/\\]/,
  /[/\\]__tests__[/\\]/,
  /\.test\.[tj]sx?$/,
  /\.spec\.[tj]sx?$/,
  /src[/\\]utils[/\\]logger\.ts$/,
  /src[/\\]seed[/\\]/,
  /src[/\\]functions[/\\]/,
];

function shouldSkip(file) {
  return SKIP_PATTERNS.some((p) => p.test(file));
}

function walk(dir, out) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(p, out);
    else if (/\.(ts|tsx)$/.test(entry.name)) out.push(p);
  }
  return out;
}

function isInRealCode(src, regex) {
  let stripped = src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1')
    .replace(/`(?:\\.|[^`\\])*`/g, '``')
    .replace(/"(?:\\.|[^"\\])*"/g, '""')
    .replace(/'(?:\\.|[^'\\])*'/g, "''");
  return regex.test(stripped);
}

/**
 * Walk through the file from index 0 and find the byte offset just after the
 * last top-level `import ... from '...';` statement. Handles multi-line
 * imports with `{...}` blocks. Returns -1 if no imports were found.
 */
function findEndOfImports(src) {
  let i = 0;
  let lastImportEnd = -1;

  function skipWs() {
    while (i < src.length) {
      const c = src[i];
      if (c === ' ' || c === '\t' || c === '\r' || c === '\n') { i++; continue; }
      if (src[i] === '/' && src[i + 1] === '*') {
        const close = src.indexOf('*/', i + 2);
        if (close === -1) { i = src.length; return; }
        i = close + 2;
        continue;
      }
      if (src[i] === '/' && src[i + 1] === '/') {
        const nl = src.indexOf('\n', i + 2);
        if (nl === -1) { i = src.length; return; }
        i = nl + 1;
        continue;
      }
      return;
    }
  }

  while (i < src.length) {
    skipWs();
    if (i >= src.length) break;

    if (src.startsWith('import', i)) {
      let j = i + 'import'.length;
      let depth = 0;
      let foundFromString = false;
      while (j < src.length) {
        const c = src[j];
        if (c === '{') { depth++; j++; continue; }
        if (c === '}') { depth--; j++; continue; }
        if (c === '"' || c === "'") {
          const quote = c;
          j++;
          while (j < src.length && src[j] !== quote) {
            if (src[j] === '\\') j += 2;
            else j++;
          }
          j++;
          if (depth === 0) { foundFromString = true; }
          continue;
        }
        if (c === ';' && depth === 0 && foundFromString) {
          j++;
          break;
        }
        if (c === '\n' && depth === 0 && foundFromString) {
          break;
        }
        j++;
      }
      lastImportEnd = j;
      i = j;
    } else {
      break;
    }
  }
  return lastImportEnd;
}

const files = walk(SRC, []).filter((f) => !shouldSkip(f));

let touched = 0;
let logReplaced = 0;
let warnReplaced = 0;
let importsAdded = 0;

for (const file of files) {
  const orig = fs.readFileSync(file, 'utf8');

  const logCount = (orig.match(/\bconsole\.log\(/g) || []).length;
  const warnCount = (orig.match(/\bconsole\.warn\(/g) || []).length;

  if (logCount === 0 && warnCount === 0) continue;

  const realLog = isInRealCode(orig, /\bconsole\.log\(/);
  const realWarn = isInRealCode(orig, /\bconsole\.warn\(/);
  if (!realLog && !realWarn) continue;

  let src = orig
    .replace(/\bconsole\.log\(/g, 'logger.log(')
    .replace(/\bconsole\.warn\(/g, 'logger.warn(');

  const hasLoggerImport =
    /from\s+['"][^'"]*\/utils\/logger['"]/.test(src) ||
    /from\s+['"]@\/utils\/logger['"]/.test(src);

  if (!hasLoggerImport) {
    const fileDir = path.dirname(file);
    const targetAbs = path.join(SRC, 'utils', 'logger');
    let rel = path.relative(fileDir, targetAbs);
    if (!rel.startsWith('.')) rel = './' + rel;
    rel = rel.replace(/\\/g, '/');

    const importLine = `import { logger } from '${rel}';\n`;

    const insertAt = findEndOfImports(src);
    if (insertAt > 0) {
      const before = src.slice(0, insertAt);
      const after = src.slice(insertAt);
      const sep = before.endsWith('\n') ? '' : '\n';
      src = before + sep + importLine + after;
    } else {
      const m = src.match(/^\s*\/\*[\s\S]*?\*\/\s*\n/);
      if (m) {
        src = m[0] + importLine + src.slice(m[0].length);
      } else {
        src = importLine + src;
      }
    }
    importsAdded++;
  }

  fs.writeFileSync(file, src);
  touched++;
  logReplaced += logCount;
  warnReplaced += warnCount;
}

console.log(`Migration complete:`);
console.log(`  files touched : ${touched}`);
console.log(`  console.log  -> logger.log  : ${logReplaced}`);
console.log(`  console.warn -> logger.warn : ${warnReplaced}`);
console.log(`  imports added : ${importsAdded}`);
