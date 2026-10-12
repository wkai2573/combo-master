import { describe, expect, it } from 'vitest';
import { STEP_GROUPS, STEP_ORDER } from '../src/data/turnSteps';
import { buildFlowChart, CHART_VERTICAL_W, MAX_LINES, MAX_SUB_CHARS, MAX_TITLE_CHARS, type FlowNode } from '../src/ui/flowChart';

const wide = buildFlowChart();
const chart = buildFlowChart('vertical');
const byId = new Map(chart.nodes.map((n) => [n.id, n]));

const overlap = (a: FlowNode, b: FlowNode) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
const laneOf = (n: FlowNode) => chart.lanes.find((l) => n.y >= l.y && n.y + n.h <= l.y + l.h);

// 手機版面的直式流程圖：節點、邊與橫向版面一樣，只是排成單欄、窄寬度
describe('直式流程圖', () => {
  it('節點與邊的集合和橫向版面一致', () => {
    expect(chart.nodes.map((n) => n.id).sort()).toEqual(wide.nodes.map((n) => n.id).sort());
    // 橫向版面的第一行有一條從戰鬥格直接接到回合結束的邊；直式版面戰鬥格往下展開成步驟，由歸還接回合結束，不重複畫
    expect(chart.edges.map((e) => e.id).sort()).toEqual(wide.edges.map((e) => e.id).filter((id) => id !== '戰鬥>回合結束').sort());
  });

  it('寬度適合手機，不需要橫向捲動', () => {
    expect(chart.width).toBe(CHART_VERTICAL_W);
    expect(chart.width).toBeLessThanOrEqual(420);
  });

  it('主幹由上到下的順序和共用步驟表一致，而且排在同一欄', () => {
    const spine = chart.nodes.filter((n) => n.phase).sort((a, b) => a.y - b.y);
    expect(spine.map((n) => n.phase)).toEqual(STEP_ORDER);
    expect(new Set(spine.map((n) => n.x)).size).toBe(1);
  });

  it('展開的分組節點排在它的步驟上方', () => {
    const multi = STEP_GROUPS.find((g) => g.steps.length > 1)!;
    expect(byId.get(multi.label)!.y).toBeLessThan(byId.get(multi.steps[0].phase)!.y);
  });

  it('每個節點文字不超過字數上限', () => {
    for (const n of chart.nodes) {
      expect(n.lines.length, n.id).toBe(MAX_LINES);
      expect([...n.lines[0]].length, n.id).toBeLessThanOrEqual(MAX_TITLE_CHARS);
      expect([...n.lines[1]].length, n.id).toBeLessThanOrEqual(MAX_SUB_CHARS);
    }
  });

  it('所有節點都在寬度與高度之內，彼此不重疊，並且落在某一條分區裡', () => {
    for (const n of chart.nodes) {
      expect(n.x, n.id).toBeGreaterThanOrEqual(0);
      expect(n.x + n.w, n.id).toBeLessThanOrEqual(chart.width);
      expect(n.y + n.h, n.id).toBeLessThanOrEqual(chart.height);
      expect(laneOf(n), `${n.id} 不在任何分區`).toBeDefined();
    }
    for (let i = 0; i < chart.nodes.length; i++) {
      for (let j = i + 1; j < chart.nodes.length; j++) {
        expect(overlap(chart.nodes[i], chart.nodes[j]), `${chart.nodes[i].id} 與 ${chart.nodes[j].id}`).toBe(false);
      }
    }
  });

  it('圖例放得進寬度', () => {
    expect(chart.legendCols).toBeGreaterThan(0);
    expect(chart.legendCols).toBeLessThan(wide.legendCols);
  });
});

// 邊的路徑只有 M／H／V 三種指令，轉成線段後檢查有沒有穿過起訖以外的節點或標籤
function segments(d: string): [number, number, number, number][] {
  const out: [number, number, number, number][] = [];
  let x = 0;
  let y = 0;
  for (const [, cmd, a, b] of d.matchAll(/([MHV])\s*(-?[\d.]+)(?:,(-?[\d.]+))?/g)) {
    const [nx, ny] = cmd === 'M' ? [Number(a), Number(b)] : cmd === 'H' ? [Number(a), y] : [x, Number(a)];
    if (cmd !== 'M') out.push([x, y, nx, ny]);
    [x, y] = [nx, ny];
  }
  return out;
}
const hits = (s: [number, number, number, number], r: { x: number; y: number; w: number; h: number }) => {
  const [x1, y1, x2, y2] = s;
  return Math.max(x1, x2) > r.x && Math.min(x1, x2) < r.x + r.w && Math.max(y1, y2) > r.y && Math.min(y1, y2) < r.y + r.h;
};

describe('直式流程圖邊線', () => {
  it('邊連接的節點都存在', () => {
    for (const e of chart.edges) {
      expect(byId.has(e.from), `${e.id} 起點`).toBe(true);
      expect(byId.has(e.to), `${e.id} 終點`).toBe(true);
    }
  });

  it('邊線不穿過起訖以外的節點，也不超出寬度', () => {
    for (const e of chart.edges) {
      for (const s of segments(e.d)) {
        expect(Math.min(s[0], s[2]), `${e.id} 超出左邊`).toBeGreaterThanOrEqual(0);
        expect(Math.max(s[0], s[2]), `${e.id} 超出右邊`).toBeLessThanOrEqual(chart.width);
      }
      for (const n of chart.nodes) {
        if (n.id === e.from || n.id === e.to) continue;
        for (const s of segments(e.d)) expect(hits(s, n), `${e.id} 穿過 ${n.id}`).toBe(false);
      }
    }
  });

  it('邊的標籤不壓到節點，也不超出寬度', () => {
    for (const e of chart.edges) {
      if (!e.label) continue;
      const w = [...e.label.text].length * 11;
      const box = { x: e.label.x - w / 2, y: e.label.y - 8, w, h: 14 };
      expect(box.x, `${e.id} 的標籤超出左邊`).toBeGreaterThanOrEqual(0);
      expect(box.x + box.w, `${e.id} 的標籤超出右邊`).toBeLessThanOrEqual(chart.width);
      for (const n of chart.nodes) expect(hits([box.x, box.y, box.x + box.w, box.y + box.h], n), `${e.id} 的標籤壓到 ${n.id}`).toBe(false);
    }
  });
});
