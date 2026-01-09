// gulpfile.js — formatted-only; injects ONE doc block: "Contents" (if SECTIONs exist) or "Methods" (if none)
import { src, dest, series } from 'gulp';
import gulpPrettier from 'gulp-prettier';
const prettierStream = gulpPrettier();
import mapStream from 'map-stream';

// ---------------- CLI args ----------------
function getArg(name, fallback) {
  const U = name.toUpperCase();
  const eq = `--${name}=`;
  const hitEq = process.argv.find((a) => a.startsWith(eq));
  if (hitEq) return hitEq.slice(eq.length);
  const i = process.argv.indexOf(`--${name}`);
  if (i !== -1 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--')) return process.argv[i + 1];
  return process.env[U] ?? fallback;
}
const INPUT_FILE = getArg('file', '');
const paths = {
  // If a specific file was passed via --file or FILE env, use it; otherwise format all JS under src/
  src: INPUT_FILE ? [INPUT_FILE] : ['src/**/*.js'],
  formatted: getArg('destFormatted', 'build/formatted/'),
};

// ------------- Babel AST utils -------------
import { parse } from '@babel/parser';
import traverseModule from '@babel/traverse';
const traverse = traverseModule.default || traverseModule;

function firstSummary(blockText) {
  const lines = blockText.split('\n').map((l) => l.replace(/^\s*\*\s?/, '').trim());
  return lines.find((l) => l && !l.startsWith('@')) || '';
}
function isAdjacentDoc(source, endIdx, nodeStart) {
  const between = source.slice(endIdx, nodeStart);
  if (/\/\*/.test(between)) return false; // another block in between
  return !/^\s*(?:\r?\n){2,}/.test(between); // not more than one blank line apart
}

function extractClassInfo(code = '') {
  const ast = parse(code, {
    sourceType: 'module',
    comments: true,
    plugins: [
      'classProperties',
      'classPrivateProperties',
      'classPrivateMethods',
      'decorators-legacy',
      'dynamicImport',
      'importMeta',
      'jsx',
      'topLevelAwait',
    ],
  });

  const allBlocks = (ast.comments || [])
    .filter((c) => c.type === 'CommentBlock')
    .map((c) => ({ start: c.start, end: c.end, value: c.value }));

  const methods = [];
  let firstClassCaptured = false;

  const keyName = (node) => {
    if (!node) return null;
    if (node.type === 'Identifier') return node.name;
    if (node.type === 'PrivateName' && node.id?.name) return `#${node.id.name}`;
    if (node.type === 'StringLiteral') return node.value;
    return null;
  };

  const summaryFor = (nodeStart) => {
    let best = null;
    for (const c of allBlocks) {
      if (c.end <= nodeStart) {
        if (!best || c.end > best.end) best = c;
      }
    }
    if (!best) return '';
    if (/SECTION:/i.test(best.value)) return '';
    if (!isAdjacentDoc(code, best.end, nodeStart)) return '';
    return firstSummary(best.value);
  };

  traverse(ast, {
    ClassDeclaration(p) {
      if (firstClassCaptured) return;
      firstClassCaptured = true;

      for (const m of p.node.body.body) {
        if (m.type === 'ClassMethod' || m.type === 'ClassPrivateMethod') {
          const raw = keyName(m.key);
          if (!raw) continue;
          methods.push({ name: String(raw).replace(/^#/, ''), start: m.start, summary: summaryFor(m.start) });
        } else if (
          m.type === 'ClassProperty' ||
          m.type === 'PropertyDefinition' ||
          m.type === 'ClassPrivateProperty'
        ) {
          if (!(m.value && m.value.type === 'ArrowFunctionExpression')) continue;
          const raw = keyName(m.key);
          if (!raw) continue;
          methods.push({ name: String(raw).replace(/^#/, ''), start: m.start, summary: summaryFor(m.start) });
        }
      }
    },
  });

  methods.sort((a, b) => a.start - b.start);

  // SECTION anchors → anchor to next method
  const anchors = [];
  for (const c of allBlocks) {
    const mm = c.value.match(/SECTION:\s*([^\n*]+)/i);
    if (!mm) continue;
    const title = (mm[1] || '').trim();
    const anchorIdx = methods.findIndex((m) => m.start > c.end);
    if (anchorIdx !== -1) anchors.push({ name: title, anchorIdx });
  }
  anchors.sort((a, b) => a.anchorIdx - b.anchorIdx);

  return { methods, anchors };
}

// ------------- Doc block renderers -------------
function renderContents(anchors, methods) {
  const lines = ['/*', ' * Contents'];
  const covered = new Array(methods.length).fill(false);

  const section = (title, group) => {
    if (!group.length) return;
    lines.push(' *');
    lines.push(` * ─ ${title}`);
    for (const it of group) {
      const row = ` *    ${it.name}()${it.summary ? ' — ' + it.summary : ''}`;
      lines.push(row);
    }
  };

  for (let i = 0; i < anchors.length; i++) {
    const a = anchors[i];
    const next = anchors[i + 1];
    const start = a.anchorIdx;
    const end = next ? next.anchorIdx : methods.length;
    const group = methods.slice(start, end);
    group.forEach((_, k) => (covered[start + k] = true));
    section(a.name, group);
  }

  lines.push(' */');
  return lines.join('\n') + '\n\n';
}

function renderMethods(methods) {
  const lines = ['/*', ' * Methods:'];
  for (const it of methods) {
    const row = ` *    ${it.name}()${it.summary ? ' — ' + it.summary : ''}`;
    lines.push(row);
  }
  lines.push(' */');
  return lines.join('\n') + '\n\n';
}

// ----------- Robust strip helpers (pre-injection) -----------
/** Remove ANY existing doc block that contains a "Methods:" or "Contents" header. */
const STRIP_DOCBLOCKS = /\/\*[\s\S]*?(?:\n\s*\*\s*Methods:|\n\s*\*\s*Contents\b)[\s\S]*?\*\/\s*/g;

/** Keep only the first docblock at BOF if somehow multiple exist after injection. */
function keepFirstDocblockAtTop(text) {
  const rx = /\/\*[\s\S]*?(?:\n\s*\*\s*(?:Methods:|Contents)\b)[\s\S]*?\*\/\s*/g;
  const matches = [...text.matchAll(rx)];
  if (matches.length <= 1) return text;
  const firstBlock = matches[0][0];
  const withoutAll = text.replace(rx, '');
  // Reinsert the first at BOF with exactly one blank line after
  const blockWithNL = firstBlock.endsWith('\n') ? firstBlock : firstBlock + '\n';
  return blockWithNL + '\n' + withoutAll.replace(/^\s+/, '');
}

// ----------------- Transform: inject ONE block -----------------
function injectDocBlock() {
  return mapStream((file, cb) => {
    let content = String(file.contents);

    // 1) Remove any pre-existing Methods/Contents blocks anywhere
    content = content.replace(STRIP_DOCBLOCKS, '');

    // 2) Compute sections vs methods
    const { methods, anchors } = extractClassInfo(content);

    // 3) Choose ONE block only
    const block = anchors.length > 0 ? renderContents(anchors, methods) : renderMethods(methods);

    // 4) Inject at BOF
    content = block + content;

    // 5) Safety: if multiple docblocks exist, keep the first only
    content = keepFirstDocblockAtTop(content);

    // 6) Spacing hygiene
    content = content
      .replace(/(\r?\n){3,}/g, '\n\n') // collapse 3+ blank → 2
      .replace(/\}\s*(\r?\n)+(?=module\.exports\s*=)/g, '}\n\n') // exactly one blank before module.exports
      .replace(/\s*$/g, '') + '\n'; // exactly one trailing newline

    file.contents = Buffer.from(content);
    cb(null, file);
  });
}

// ------------------------------ Task ------------------------------
function formattedOnly() {
  return src(paths.src).pipe(prettierStream).pipe(injectDocBlock()).pipe(dest(paths.formatted));
}

export const build = series(formattedOnly);
export default build;
