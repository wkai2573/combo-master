/**
 * 卡片文字的句型（撰寫規範見 docs/卡片撰寫規範.md）。
 * 每一行依序為：(回合X次)、[標籤_費用]：、時機、條件、效果。
 * 這裡把一行切成這幾段（各段保留原本的標點，接起來等於原文），並檢查是否符合規範。
 */

/** 開頭關鍵字（標籤） */
const TAGS = new Set(['先', '追', '發', '頂', '經']);
/** 費用：蓋X、怒X（X 可以是數字或字母 X） */
const COST = /^(?:蓋|怒)(?:\d+|X)$/;

export interface CardLine {
  /** header：轉述別張卡的標題行，例如「[Ex卡-中毒]：」；line：一般的一行 */
  kind: 'line' | 'header';
  raw: string;
  /** 回合X次，例如「(回合1次)」 */
  count: string;
  /** 方括號與冒號，例如「[發_蓋2]：」 */
  bracket: string;
  /** 開頭關鍵字，例如「發」 */
  tags: string[];
  /** 費用，例如「蓋2」「怒3」 */
  costs: string[];
  /** 時機，含後面的逗號，例如「當我方收招時，」 */
  timing: string;
  /** 條件，含後面的逗號，例如「且我方戰鬥區…，」 */
  condition: string;
  /** 效果 */
  effect: string;
  /** 不符規範之處（空陣列＝符合） */
  errors: string[];
}

const HEADER = /^\[([^\]]+)\]：$/;
const HEAD = /^(\(回合(?:\d+|X)次\))?(\[[^\]]+\]：)?/;

function emptyLine(raw: string, kind: CardLine['kind']): CardLine {
  return { kind, raw, count: '', bracket: '', tags: [], costs: [], timing: '', condition: '', effect: '', errors: [] };
}

/** 切開一行：從 text 開頭取到第一個逗號（含逗號）。沒有逗號就整段取走 */
function takeClause(text: string): [string, string] {
  const i = text.indexOf('，');
  return i < 0 ? [text, ''] : [text.slice(0, i + 1), text.slice(i + 1)];
}

export function parseCardLine(raw: string): CardLine {
  const header = HEADER.exec(raw);
  if (header) {
    const parts = header[1].split('_');
    const isHead = parts.every((p) => TAGS.has(p) || COST.test(p));
    if (!isHead) return { ...emptyLine(raw, 'header'), bracket: raw };
  }

  const line = emptyLine(raw, 'line');
  const head = HEAD.exec(raw)!;
  line.count = head[1] ?? '';
  line.bracket = head[2] ?? '';
  let rest = raw.slice(line.count.length + line.bracket.length);

  if (line.count && !line.bracket) line.errors.push('(回合X次) 後面要接 [標籤或費用]：');
  if (line.bracket) {
    const parts = line.bracket.slice(1, -2).split('_');
    let seenCost = false;
    for (const part of parts) {
      if (TAGS.has(part)) {
        if (seenCost) line.errors.push(`開頭關鍵字 ${part} 要寫在費用前面`);
        line.tags.push(part);
      } else if (COST.test(part)) {
        seenCost = true;
        line.costs.push(part);
      } else {
        line.errors.push(`[${part}] 不是開頭關鍵字或費用`);
      }
    }
  }

  // 時機：以「當」開頭、以「時」或「後」結尾，後面接逗號
  if (rest.startsWith('當')) {
    const [clause, after] = takeClause(rest);
    line.timing = clause;
    rest = after;
    if (!clause.endsWith('，')) line.errors.push('時機後面要接逗號');
    else if (!/[時後]，$/.test(clause)) line.errors.push(`時機要以「時」或「後」結尾：${clause}`);
  }

  // 條件：有時機時以「且」開頭，沒有時機時以「若」開頭，後面接逗號
  const hasTiming = line.timing !== '';
  if (rest.startsWith(hasTiming ? '且' : '若')) {
    const [clause, after] = takeClause(rest);
    line.condition = clause;
    rest = after;
    if (!clause.endsWith('，')) line.errors.push('條件後面要接逗號');
  } else if (rest.startsWith(hasTiming ? '若' : '且')) {
    line.errors.push(hasTiming ? '有時機時，條件要以「且」開頭，不是「若」' : '沒有時機時，條件要以「若」開頭，不是「且」');
  }

  if (!hasTiming && /^[^，。]{1,20}[時後]，/.test(rest)) line.errors.push('時機要以「當」開頭：' + rest.slice(0, rest.indexOf('，') + 1));
  line.effect = rest;
  if (!line.effect) line.errors.push('沒有效果');
  else if (!line.effect.endsWith('。')) line.errors.push('效果要以句號結尾');
  return line;
}

/** 把整段卡文切成各行 */
export function parseCardText(text: string): CardLine[] {
  return text === '' ? [] : text.split('\n').map(parseCardLine);
}

/** 卡文裡不能出現的用語（舊用語與不一致的寫法） */
const FORBIDDEN: Array<[RegExp, string]> = [
  [/覆蓋/, '請用「裏側」，不寫「覆蓋」'],
  [/正面/, '請用「表側」，不寫「正面」'],
  [/起手/, '請用「先手」，不寫「起手」'],
  [/\[起[\]_]/, '標籤請用 [先]，不寫 [起]'],
  [/[你妳]|敵方|對手/, '請用「我方」「對方」「雙方」稱呼對象'],
  [/[一二三四五六七八九十兩]\s*張/, '數字請用阿拉伯數字'],
];

/** 檢查用語：卡文與角色文字都適用 */
export function checkWording(text: string): string[] {
  return FORBIDDEN.filter(([re]) => re.test(text)).map(([, msg]) => msg);
}

/** 檢查卡文是否符合撰寫規範，回傳各行的問題（空陣列＝符合） */
export function checkCardText(text: string): string[] {
  const errors: string[] = [];
  for (const line of parseCardText(text)) {
    for (const e of line.errors) errors.push(`「${line.raw}」：${e}`);
  }
  for (const e of checkWording(text)) errors.push(e);
  return errors;
}

/** 一行開頭的一個特殊框：回合X次、開頭關鍵字或費用 */
export interface CardBox {
  kind: 'count' | 'tag' | 'cost';
  /** 框上的文字，例如「回合1次」「發」「蓋2」 */
  label: string;
  /** 費用框用圖示取代文字：蓋或怒 */
  icon?: '蓋' | '怒';
  /** 費用框的數字，例如「2」「X」 */
  value?: string;
  /** 這個框對應的卡文寫法，用來查關鍵字說明，例如「[蓋2]」 */
  source: string;
}

/** 把一行開頭的回合X次、開頭關鍵字、費用依序轉成特殊框 */
export function lineBoxes(line: CardLine): CardBox[] {
  const boxes: CardBox[] = [];
  if (line.count) boxes.push({ kind: 'count', label: line.count.slice(1, -1), source: line.count });
  for (const t of line.tags) boxes.push({ kind: 'tag', label: t, source: `[${t}]` });
  for (const c of line.costs) boxes.push({ kind: 'cost', label: c, icon: c[0] as '蓋' | '怒', value: c.slice(1), source: `[${c}]` });
  return boxes;
}
