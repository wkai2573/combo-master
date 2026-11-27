import { expect, test } from 'vitest';
import { defaultTextLayer, facePresets } from '../src/cardLayout/model';
import { layoutFaceText } from '../src/cardLayout/textLayout';

const measure = (text: string, size: number) => ({
  width: [...text].length * size, left: 0, right: [...text].length * size,
  ascent: size * 0.8, descent: size * 0.1, fontAscent: size * 0.9, fontDescent: size * 0.2,
});

test.each(facePresets)('$name 範本依共用規格設定字級與效果底色', ({ layers }) => {
  expect(layers.find((layer) => layer.id === 'text')).toMatchObject({
    font: 'Noto Sans TC', size: 70, weight: 700, background: { opacity: 0.6 },
  });
  expect(layers.find((layer) => layer.id === 'name')).toMatchObject({
    font: 'Noto Sans TC', weight: 700, flow: 'fit', align: 'center',
    rect: { x: 244, y: 1311, width: 773, height: 350 },
  });
});

test('往上新增行數時固定底緣，先排滿上面的行', () => {
  const layer = { ...defaultTextLayer('效果'), rect: { x: 110, y: 500, width: 420, height: 560 }, flow: 'up' as const };
  const single = layoutFaceText(layer, '甲乙丙丁戊己', [], measure);
  const wrapped = layoutFaceText(layer, '甲乙丙丁戊己庚', [], measure);
  expect(wrapped.rows.map((row) => row.runs.map((run) => run.text).join(''))).toEqual(['甲乙丙丁戊己', '庚']);
  expect(wrapped.rows[1].top).toBe(single.rows[0].top);
  expect(wrapped.rows[0].top).toBeLessThan(single.rows[0].top);
});

test('單行適配在卡名變長時縮小字級，並保留原來整段文字', () => {
  const layer = { ...defaultTextLayer('卡名', 'name'), rect: { x: 120, y: 1310, width: 440, height: 180 }, flow: 'fit' as const };
  const short = layoutFaceText(layer, '卡名', [], measure);
  const long = layoutFaceText(layer, '長一點的卡名保持單行', [], measure);
  expect(long.rows.map((row) => row.runs[0].text)).toEqual(['長一點的卡名保持單行']);
  expect(long.size).toBeLessThan(short.size);
  expect(long.overflow).toBe(false);
});

test('短卡名仍完整留在黑色卡名區內', () => {
  const title = facePresets[0].layers.find((layer) => layer.id === 'name');
  if (title?.kind !== 'text') throw new Error('範本缺少卡名圖層');
  const { rows: [row] } = layoutFaceText(title, '電弧', [], measure);
  expect(title.rect.y + row.baseline - row.ascent).toBeGreaterThan(1386);
  expect(title.rect.y + row.baseline + row.descent).toBeLessThan(1586);
});

test('費用、追擊判定和帶數值的動作保有完整底框', () => {
  const layer = { ...defaultTextLayer('效果', 'text'), keywords: true };
  const layout = layoutFaceText(layer, '[蓋2]：當我方追擊判定成功時，抽 1。', [], measure);
  const runs = layout.rows.flatMap((row) => row.runs);
  expect(runs.map(({ text, style }) => [text, style])).toEqual([
    ['2', 'cover'],
    ['當我方', 'timing'],
    ['追擊判定', 'noun'],
    ['成功時，', 'timing'],
    ['抽1', 'action'],
    ['。', 'plain'],
  ]);
});

test('關鍵字底框以筆畫上下中心對齊，且和正文共用基線', () => {
  const layer = { ...defaultTextLayer('效果', 'text'), keywords: true };
  const metrics = (text: string, size: number) => ({
    ...measure(text, size), ascent: text === '頂' ? 0.9 * size : 0.7 * size, descent: text === '頂' ? 0.04 * size : 0,
  });
  const layout = layoutFaceText(layer, '[頂]：+1+2。', [], metrics);
  expect(layout.rows).toHaveLength(1);
  for (const run of layout.rows[0].runs.slice(0, 2)) {
    const { ascent, descent } = metrics(run.text, run.textSize);
    expect(run.mark).toBeDefined();
    const { y, height } = run.mark!;
    expect(-ascent - y).toBeGreaterThan(0);
    expect(-ascent - y).toBeCloseTo(y + height - descent);
  }
});
