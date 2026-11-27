import { lineBoxes, parseCardLine } from '../data/cardText';
import { KEYWORDS, segmentsOf } from '../data/keywords';
import type { FaceRect, FaceTextLayer, KeywordStyle } from './model';

export interface FaceMetrics {
  width: number;
  left: number;
  right: number;
  ascent: number;
  descent: number;
  fontAscent: number;
  fontDescent: number;
}

type Measure = (text: string, size: number) => FaceMetrics;
type Style = 'plain' | 'timing' | 'condition' | 'tag' | 'cover' | 'rage' | 'action' | 'noun' | 'custom';
type Part = { text: string; style: Style; custom?: KeywordStyle };
interface Run extends Part {
  x: number;
  width: number;
  textX: number;
  textSize: number;
  fontOffset: number;
}

interface Row {
  runs: Run[];
  width: number;
  left: number;
  right: number;
  ascent: number;
  descent: number;
}

export interface FaceTextLayout {
  size: number;
  rows: Array<Row & { x: number; top: number; baseline: number }>;
  background?: FaceRect;
  overflow: boolean;
}

const isInline = (s: Style) => s === 'plain' || s === 'timing' || s === 'condition';
const cost = /^(蓋|怒)(\d+|X)$/;
const escape = (text: string) => text.replace(/[.*+?^$(){}|[\]\\]/g, '\\$&');
// 關鍵字檢索略過容易誤判的單字。在卡面上可用緊接的數值辨識「抽1」等動作。
const shortActions = KEYWORDS.filter((key) => key.group === '動作' && /^.X$/u.test(key.name))
  .map((key) => escape(key.name.slice(0, -1)));
const numericParts = new RegExp('(' + [
  '[蓋怒](?:\\d+|X)',
  ...shortActions.map((name) => name + '\\s*(?:\\d+X?|X)'),
].join('|') + ')', 'gu');
const word = /[\p{Script=Latin}\p{N}]+(?:[-.'’][\p{Script=Latin}\p{N}]+)*|\s+|./gu;
const atLineStart = /^[，。！？：；、．％）】》〉」』〕…,.!?:;%)\]}]/u;
const atLineEnd = /[（【《〈「『〔(\[{]$/u;
const blank = (part: Part) => isInline(part.style) && !part.text.trim();

function customPart(text: string, custom: KeywordStyle): Part {
  return { text, style: 'custom', custom };
}

function costPart(token: string): Part | undefined {
  const match = cost.exec(token);
  if (match) return { text: match[2], style: match[1] === '蓋' ? 'cover' : 'rage' };
}

/** 讓卡表的關鍵字說明和卡面用同一個詞彙表，數值留在同一個底框。 */
function keywordParts(text: string, style: Style, custom: KeywordStyle[]): Part[] {
  const segments = segmentsOf(text);
  return segments.flatMap(({ text: token, kws }, i): Part[] => {
    if (!token) return [];
    const key = kws[0];
    const label = token.replace(/^\[|\]$|^【|】$/g, '');
    const expense = key?.group === '費用' ? costPart(label) : undefined;
    if (kws.length === 1 && key.group === '標籤') return [{ text: label, style: 'tag' }];
    const badge = key?.group === '動作' || key?.group === '名詞' || key?.group === 'Ex卡';
    if (badge || expense) {
      let value = label;
      const next = segments[i + 1];
      if (next && !next.kws.length && key?.name.endsWith('X') && label === key.name.slice(0, -1)) {
        const suffix = /^\s*(\d+X?|X)/.exec(next.text);
        if (suffix) {
          value += suffix[1];
          next.text = next.text.slice(suffix[0].length);
        }
      }
      const configured = custom.find((rule) => rule.term === value || rule.term === key?.name);
      if (configured) return [customPart(value, configured)];
      return [expense ?? { text: value, style: key?.group === '動作' ? 'action' : 'noun' }];
    }
    return token.split(numericParts).flatMap((chunk, index): Part[] => {
      if (!chunk) return [];
      if (index % 2 === 0) return [{ text: chunk, style }];
      const value = chunk.replace(/\s+/g, '');
      const configured = custom.find((rule) => rule.term === value || rule.term === Array.from(value)[0] + 'X');
      return [configured ? customPart(value, configured) : costPart(value) ?? { text: value, style: 'action' }];
    });
  });
}

function decoratedParts(text: string, style: Style, rules: KeywordStyle[], customMatch: RegExp | undefined): Part[] {
  const parts: Part[] = [];
  let offset = 0;
  if (customMatch) {
    for (const match of text.matchAll(customMatch)) {
      const index = match.index;
      const term = match[0];
      parts.push(...keywordParts(text.slice(offset, index), style, rules));
      parts.push(customPart(term, rules.find((rule) => rule.term === term)!));
      offset = index + term.length;
    }
  }
  return [...parts, ...keywordParts(text.slice(offset), style, rules)];
}

function paragraphsOf(text: string, rich: boolean, rules: KeywordStyle[]): Part[][] {
  const active = rules.filter(({ term }) => term !== '').sort((a, b) => b.term.length - a.term.length);
  const matcher = active.length
    ? new RegExp(active.map(({ term }) => escape(term)).join('|'), 'g')
    : undefined;
  return text.split('\n').map((raw) => {
    if (!rich) return [{ text: raw, style: 'plain' }];
    const line = parseCardLine(raw);
    // 卡表草稿暫時打錯標籤時，仍保留原文供檢查。
    const validHead = !line.errors.some((error) => error.includes('不是開頭關鍵字或費用'));
    const heads = validHead ? lineBoxes(line).map((box): Part => {
      const custom = active.find(({ term }) => term === box.source || term === box.label || (box.icon && term === box.icon + 'X'));
      if (custom) return customPart(box.label, custom);
      return costPart(box.label) ?? { text: box.label, style: 'tag' };
    }) : [{ text: line.count + line.bracket, style: 'plain' as const }];
    return [
      ...heads,
      ...decoratedParts(line.timing, 'timing', active, matcher),
      ...decoratedParts(line.condition, 'condition', active, matcher),
      ...decoratedParts(line.effect, 'plain', active, matcher),
    ];
  });
}

function measureRow(parts: Part[], size: number, measure: Measure): Row {
  const combined: Part[] = [];
  for (const part of parts) {
    const previous = combined.at(-1);
    if (previous?.style === part.style && isInline(part.style)) previous.text += part.text;
    else combined.push({ ...part });
  }

  let x = 0;
  let left = Infinity;
  let right = -Infinity;
  let ascent = 0;
  let descent = 0;
  const runs = combined.map((part): Run => {
    const expense = part.style === 'cover' || part.style === 'rage';
    const box = !isInline(part.style);
    const image = part.custom?.style === 'image' && part.custom.image;
    const showText = !image || part.custom?.showText;
    const textSize = expense ? size * 0.86 : size;
    const metrics = measure(showText ? part.text : '', textSize);
    const padding = part.style === 'noun' || part.style === 'action' ? 0.26 : 0.13;
    const inner = Math.max(
      metrics.width + (box && showText ? textSize * padding * 2 : 0),
      expense ? size * 1.11 : 0,
      image ? size * part.custom!.imageWidth : 0,
    );
    const gap = box ? size * 0.055 : 0;
    const textX = gap + (inner - metrics.width) / 2;
    if (box) {
      left = Math.min(left, x + gap);
      right = Math.max(right, x + gap + inner);
      ascent = Math.max(ascent, size * 0.86, metrics.ascent);
      descent = Math.max(descent, size * 0.24, metrics.descent);
    } else {
      left = Math.min(left, x - metrics.left);
      right = Math.max(right, x + metrics.right);
      ascent = Math.max(ascent, metrics.ascent);
      descent = Math.max(descent, metrics.descent);
    }
    const width = inner + gap * 2;
    const run = { ...part, x, width, textX, textSize, fontOffset: (metrics.fontAscent - metrics.fontDescent) / 2 };
    x += width;
    return run;
  });
  return { runs, width: x, left: runs.length ? left : 0, right: runs.length ? right : 0, ascent, descent };
}

const rowWidth = (row: Row) => Math.max(row.width, row.right) - Math.min(0, row.left);

function wrap(parts: Part[], width: number, size: number, measure: Measure): Row[] {
  const fits = (tokens: Part[]) => rowWidth(measureRow(tokens, size, measure)) <= width + 0.01;
  const tokens = parts.flatMap((part) => {
    if (!isInline(part.style)) return [part];
    return (part.text.match(word) ?? []).flatMap((text) => {
      if (blank({ ...part, text }) || fits([{ ...part, text }])) return [{ ...part, text }];
      return Array.from(text, (letter) => ({ ...part, text: letter }));
    });
  });
  const rows: Row[] = [];
  let start = 0;
  while (start < tokens.length) {
    while (start < tokens.length && blank(tokens[start])) start++;
    if (start === tokens.length) break;
    let end = start + 1;
    while (end < tokens.length && fits(tokens.slice(start, end + 1))) end++;
    while (end > start + 1 && (
      atLineEnd.test(tokens[end - 1].text) || (end < tokens.length && atLineStart.test(tokens[end].text))
    )) end--;
    rows.push(measureRow(tokens.slice(start, end).filter((part, i, line) => !blank(part) || i !== line.length - 1), size, measure));
    start = end;
  }
  return rows.length ? rows : [measureRow([], size, measure)];
}

/** 這份座標同時供編輯預覽與遊戲使用，單位為成品卡面的像素。 */
export function layoutFaceText(layer: FaceTextLayer, value: string, rules: KeywordStyle[], measure: Measure): FaceTextLayout {
  let size = layer.size;
  const text = value.replace(/\r\n?/g, '\n').replace(/\t/g, '  ');
  if (!text.trim()) return { size, rows: [], overflow: false };
  const { width, height } = layer.rect;
  const fit = layer.flow === 'fit';
  const cache = new Map<string, FaceMetrics>();
  const cached: Measure = (value, size) => {
    const key = size + ':' + value;
    const hit = cache.get(key);
    if (hit) return hit;
    const metrics = measure(value, size);
    cache.set(key, metrics);
    return metrics;
  };
  const paragraphs = paragraphsOf(fit ? text.replace(/\s*\n\s*/g, ' ').trim() : text, layer.keywords, rules);
  let layout: Row[];
  if (fit) {
    const nominal = measureRow(paragraphs[0], 100, cached);
    const scale = Math.min(width / Math.max(1, nominal.right - nominal.left), height / Math.max(1, nominal.ascent + nominal.descent));
    size = 99.5 * scale;
    layout = [measureRow(paragraphs[0], size, cached)];
  } else {
    layout = paragraphs.flatMap((parts) => wrap(parts, width, size, cached));
  }

  const pitch = size * 1.35;
  const guide = cached('國', size);
  const baselineOffset = (pitch + guide.ascent - guide.descent) / 2;
  const blockTop = layer.flow === 'up' ? height - layout.length * pitch : 0;
  const rows = layout.map((row, i) => {
    const left = fit ? row.left : Math.min(0, row.left);
    const right = fit ? row.right : Math.max(row.width, row.right);
    const rowSpace = width - (right - left);
    const x = (layer.align === 'right' ? rowSpace : layer.align === 'center' ? rowSpace / 2 : 0) - left;
    const top = blockTop + i * pitch;
    const baseline = fit ? (height + row.ascent - row.descent) / 2 : top + baselineOffset;
    return { ...row, x, top, baseline };
  });

  const minX = Math.min(...rows.map((row) => row.x + row.left));
  const maxX = Math.max(...rows.map((row) => row.x + row.right));
  const minY = Math.min(...rows.map((row) => row.baseline - row.ascent));
  const maxY = Math.max(...rows.map((row) => row.baseline + row.descent));
  const overflow = minX < -0.5 || maxX > width + 0.5 || minY < -0.5 || maxY > height + 0.5;
  const bg = layer.background;
  const background = bg && {
    x: (bg.coverage === 'text' ? minX : 0) - bg.paddingX,
    y: (bg.coverage === 'area' ? 0 : minY) - bg.paddingY,
    width: (bg.coverage === 'text' ? maxX - minX : width) + 2 * bg.paddingX,
    height: (bg.coverage === 'area' ? height : maxY - minY) + 2 * bg.paddingY,
  };
  return { size, rows, background, overflow };
}
