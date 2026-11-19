/**
 * Tiny, safe arithmetic evaluator for teacher-written numeric questions.
 * Supports + - * / % ^, parentheses, variables, and a few functions. No eval().
 */
const FUNCS: Record<string, (...a: number[]) => number> = {
  sqrt: Math.sqrt,
  abs: Math.abs,
  floor: Math.floor,
  ceil: Math.ceil,
  round: Math.round,
  min: Math.min,
  max: Math.max,
  pow: Math.pow,
  log2: Math.log2,
  log10: Math.log10,
  ln: Math.log,
  exp: Math.exp,
};
const CONSTS: Record<string, number> = { pi: Math.PI, e: Math.E };

type Tok = { t: "num"; v: number } | { t: "id"; v: string } | { t: "op"; v: string };

function lex(src: string): Tok[] {
  const out: Tok[] = [];
  let i = 0;
  while (i < src.length) {
    const c = src[i]!;
    if (/\s/.test(c)) {
      i++;
      continue;
    }
    if (/[0-9.]/.test(c)) {
      const m = /^(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?/.exec(src.slice(i));
      if (!m) throw new Error(`Bad number near "${src.slice(i, i + 6)}"`);
      out.push({ t: "num", v: Number(m[0]) });
      i += m[0].length;
      continue;
    }
    if (/[a-zA-Z_]/.test(c)) {
      let j = i;
      while (j < src.length && /[a-zA-Z0-9_]/.test(src[j]!)) j++;
      out.push({ t: "id", v: src.slice(i, j) });
      i = j;
      continue;
    }
    if ("+-*/%^(),".includes(c)) {
      out.push({ t: "op", v: c });
      i++;
      continue;
    }
    throw new Error(`Unexpected "${c}"`);
  }
  return out;
}

export function evaluate(src: string, vars: Record<string, number>): number {
  const toks = lex(src);
  let p = 0;
  const peek = () => toks[p];
  const eat = (v?: string) => {
    const t = toks[p];
    if (!t || (v !== undefined && (t.t !== "op" || t.v !== v))) throw new Error(v ? `Expected "${v}"` : "Unexpected end");
    p++;
    return t;
  };
  const expr = (): number => {
    let v = term();
    while (peek()?.t === "op" && (peek()!.v === "+" || peek()!.v === "-")) v = eat().v === "+" ? v + term() : v - term();
    return v;
  };
  const term = (): number => {
    let v = power();
    while (peek()?.t === "op" && "*/%".includes(peek()!.v as string)) {
      const op = eat().v;
      const r = power();
      v = op === "*" ? v * r : op === "/" ? v / r : v % r;
    }
    return v;
  };
  const power = (): number => {
    const b = unary();
    if (peek()?.t === "op" && peek()!.v === "^") {
      eat();
      return b ** power();
    }
    return b;
  };
  const unary = (): number => {
    if (peek()?.t === "op" && peek()!.v === "-") {
      eat();
      return -unary();
    }
    if (peek()?.t === "op" && peek()!.v === "+") {
      eat();
      return unary();
    }
    return atom();
  };
  const atom = (): number => {
    const t = eat();
    if (t.t === "num") return t.v;
    if (t.t === "op" && t.v === "(") {
      const v = expr();
      eat(")");
      return v;
    }
    if (t.t === "id") {
      if (peek()?.t === "op" && peek()!.v === "(") {
        const f = FUNCS[t.v];
        if (!f) throw new Error(`Unknown function ${t.v}`);
        eat("(");
        const args: number[] = [];
        if (!(peek()?.t === "op" && peek()!.v === ")")) {
          args.push(expr());
          while (peek()?.t === "op" && peek()!.v === ",") {
            eat();
            args.push(expr());
          }
        }
        eat(")");
        return f(...args);
      }
      if (t.v in vars) return vars[t.v]!;
      if (t.v in CONSTS) return CONSTS[t.v]!;
      throw new Error(`Unknown variable ${t.v}`);
    }
    throw new Error("Unexpected token");
  };
  const v = expr();
  if (p !== toks.length) throw new Error("Unexpected input after expression");
  return v;
}

/** Replace {name} placeholders with values (numbers formatted plainly). */
export function substitute(text: string, vars: Record<string, number>): string {
  return text.replace(/\{([a-zA-Z_][a-zA-Z0-9_]*)\}/g, (m, name: string) => (name in vars ? String(+vars[name]!.toFixed(6)) : m));
}
