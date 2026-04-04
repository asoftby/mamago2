/**
 * Заменяет прямые ASCII-кавычки (") на русские «ёлочки».
 * Учитывает уже введённые « и »: если незакрытая « есть, следующий " станет ».
 */
export function straightQuotesToGuillemets(input: string): string {
  let depth = 0;
  let out = "";
  for (let i = 0; i < input.length; i++) {
    const ch = input[i];
    if (ch === "\u00AB") {
      out += ch;
      depth++;
    } else if (ch === "\u00BB") {
      out += ch;
      depth = Math.max(0, depth - 1);
    } else if (ch === '"') {
      if (depth === 0) {
        out += "\u00AB";
        depth++;
      } else {
        out += "\u00BB";
        depth--;
      }
    } else {
      out += ch;
    }
  }
  return out;
}
