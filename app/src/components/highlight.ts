// Tiny, dependency-free syntax tokenizer. Not a full parser — a fast regex pass that
// colors the common token classes (comments, strings, numbers, keywords) across most
// C-family / scripting languages. Chosen over react-native-syntax-highlighter to avoid a
// heavy dependency + module-resolution fragility on the iPhone 7 (see plan: perf cap).
import { colors } from '../theme';

export type Token = { text: string; color: string };

const TOKEN_COLORS = {
  comment: '#6a7a6a',
  string: '#c2986a',
  number: '#d19a66',
  keyword: '#c678a8',
  plain: colors.text,
} as const;

// A broad keyword set spanning JS/TS, Python, and other common languages. Highlighting a
// keyword that isn't one in a given language is harmless.
const KEYWORDS = new Set([
  'const', 'let', 'var', 'function', 'return', 'if', 'else', 'for', 'while', 'do',
  'switch', 'case', 'break', 'continue', 'class', 'extends', 'new', 'this', 'super',
  'import', 'export', 'from', 'default', 'async', 'await', 'try', 'catch', 'finally',
  'throw', 'typeof', 'instanceof', 'in', 'of', 'void', 'delete', 'yield', 'static',
  'public', 'private', 'protected', 'interface', 'type', 'enum', 'implements',
  'def', 'elif', 'lambda', 'pass', 'with', 'as', 'global', 'nonlocal', 'and', 'or',
  'not', 'is', 'None', 'True', 'False', 'self', 'print',
  'true', 'false', 'null', 'undefined', 'package', 'func', 'struct', 'fn', 'let',
  'use', 'mut', 'pub', 'impl', 'match', 'where',
]);

// Order matters: comments and strings first so their inner contents aren't re-tokenized.
const PATTERNS: { re: RegExp; cls: keyof typeof TOKEN_COLORS }[] = [
  { re: /\/\/[^\n]*|#[^\n]*|\/\*[\s\S]*?\*\//y, cls: 'comment' },
  { re: /"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`/y, cls: 'string' },
  { re: /\b\d[\d_.]*(?:e[+-]?\d+)?\b/iy, cls: 'number' },
  { re: /[A-Za-z_$][A-Za-z0-9_$]*/y, cls: 'keyword' }, // resolved to plain unless in KEYWORDS
  { re: /\s+/y, cls: 'plain' },
  { re: /[^A-Za-z0-9_$\s]+/y, cls: 'plain' }, // punctuation/operators
];

/** Tokenize `code` into colored spans. Capped by the caller for large blocks. */
export function tokenize(code: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  const n = code.length;
  outer: while (i < n) {
    for (const { re, cls } of PATTERNS) {
      re.lastIndex = i;
      const m = re.exec(code);
      if (m && m.index === i && m[0].length > 0) {
        const text = m[0];
        let color: string = TOKEN_COLORS[cls];
        if (cls === 'keyword') color = KEYWORDS.has(text) ? TOKEN_COLORS.keyword : TOKEN_COLORS.plain;
        tokens.push({ text, color });
        i += text.length;
        continue outer;
      }
    }
    // Safety: consume one char so we never loop forever.
    tokens.push({ text: code[i], color: TOKEN_COLORS.plain });
    i += 1;
  }
  return tokens;
}
