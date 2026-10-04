import tableJson from './cardTable.json';

/** 關鍵字：完整說明只寫在卡表網頁（同步成 cardTable.json），卡上與角色文字只引用名稱 */
export interface Keyword {
  name: string;
  group: string;
  desc: string;
}

export const KEYWORDS: Keyword[] = (tableJson as { keywords?: Keyword[] }).keywords ?? [];

/** 「書寫規範」只是寫卡的規定，不在遊戲裡當關鍵字顯示 */
const SHOWN = KEYWORDS.filter((k) => k.group !== '書寫規範');
const byName = new Map(SHOWN.map((k) => [k.name, k]));
const norm = (s: string) => s.replace(/\d+/g, 'X');

/** 兩個字以上的名稱直接出現在文字中也算引用（名稱末尾的 X 不算，例如「回復X」比對「回復」） */
const plain: Array<[string, Keyword]> = SHOWN.flatMap((k) =>
  k.name.split('／').map((n): [string, Keyword] => [n.replace(/X$/, ''), k]),
)
  .filter(([base]) => [...base].length >= 2)
  .sort((a, b) => b[0].length - a[0].length);
const plainMap = new Map(plain);
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const pattern = new RegExp(['\\[[^\\]]+\\]', '【[^】]+】', ...plain.map(([b]) => esc(b))].join('|'), 'g');

export interface Segment {
  text: string;
  kws: Keyword[];
}

/** 把卡片文字切成「一般文字」與「關鍵字」片段：[發_蓋3]、【瞄準】、以及文字中直接出現的名稱 */
export function segmentsOf(text: string): Segment[] {
  const out: Segment[] = [];
  let last = 0;
  const push = (t: string, kws: Keyword[]) => {
    if (!t) return;
    const prev = out[out.length - 1];
    if (prev && kws.length === 0 && prev.kws.length === 0) prev.text += t;
    else out.push({ text: t, kws });
  };
  for (const m of text.matchAll(pattern)) {
    const at = m.index ?? 0;
    push(text.slice(last, at), []);
    const tok = m[0];
    let kws: Keyword[] = [];
    if (tok.startsWith('[')) {
      kws = tok.slice(1, -1).split('_').map((p) => byName.get(norm(p))).filter((k): k is Keyword => !!k);
    } else if (tok.startsWith('【')) {
      const k = byName.get(tok.slice(1, -1));
      kws = k ? [k] : [];
    } else {
      const k = plainMap.get(tok);
      kws = k ? [k] : [];
    }
    push(tok, kws);
    last = at + tok.length;
  }
  push(text.slice(last), []);
  return out;
}

/** 文字中引用到的關鍵字（不重複，依出現順序） */
export function keywordsIn(text: string): Keyword[] {
  const seen = new Set<string>();
  const list: Keyword[] = [];
  for (const s of segmentsOf(text)) {
    for (const k of s.kws) {
      if (!seen.has(k.name)) {
        seen.add(k.name);
        list.push(k);
      }
    }
  }
  return list;
}
