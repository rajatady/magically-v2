/**
 * Tiny template engine for widget DSL expressions.
 * Resolves `{{expr}}` in strings against a data context.
 *
 * Supports:
 *   {{data.count}}         — property access
 *   {{item.title}}         — nested access
 *   {{data.count > 0}}     — simple boolean comparison
 *   {{data.values}}        — arrays pass through as-is
 */

export function resolveTemplate(
  template: string,
  context: Record<string, unknown>,
): unknown {
  // If the entire string is a single expression, return the resolved value
  // (preserves non-string types like arrays, numbers)
  // Only match if the entire string is a single {{...}} with no braces inside
  const singleExpr = /^\{\{([^{}]+)\}\}$/.exec(template);
  if (singleExpr) {
    const val = evaluate(singleExpr[1].trim(), context);
    // Preserve typed values (arrays, numbers, booleans) but coerce undefined to ''
    return val === undefined ? '' : val;
  }

  // Otherwise, replace all {{expr}} occurrences with their string values
  return template.replace(/\{\{(.+?)\}\}/g, (_, expr) => {
    const val = evaluate(expr.trim(), context);
    return val == null ? '' : String(val);
  });
}

function evaluate(expr: string, context: Record<string, unknown>): unknown {
  // Simple comparison: "a.b > 0", "a.b != null", "a.b == 'x'"
  const comparisonMatch = /^(.+?)\s*(==|!=|>=|<=|>|<)\s*(.+)$/.exec(expr);
  if (comparisonMatch) {
    const [, left, op, right] = comparisonMatch;
    const leftVal = resolvePath(left.trim(), context);
    const rightVal = parseLiteral(right.trim(), context);
    return compare(leftVal, op, rightVal);
  }

  return resolvePath(expr, context);
}

function resolvePath(path: string, context: Record<string, unknown>): unknown {
  const parts = path.split('.');
  let current: unknown = context;
  for (const part of parts) {
    if (current == null || typeof current !== 'object') return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

function parseLiteral(
  val: string,
  context: Record<string, unknown>,
): unknown {
  if (val === 'null') return null;
  if (val === 'undefined') return undefined;
  if (val === 'true') return true;
  if (val === 'false') return false;
  const num = Number(val);
  if (!isNaN(num)) return num;
  if (/^['"].*['"]$/.test(val)) return val.slice(1, -1);
  return resolvePath(val, context);
}

function compare(left: unknown, op: string, right: unknown): boolean {
  switch (op) {
    case '==': return left == right;
    case '!=': return left != right;
    case '>':  return (left as number) > (right as number);
    case '<':  return (left as number) < (right as number);
    case '>=': return (left as number) >= (right as number);
    case '<=': return (left as number) <= (right as number);
    default:   return false;
  }
}
