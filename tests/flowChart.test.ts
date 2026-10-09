import { describe, expect, it } from 'vitest';
import { STEP_GROUPS, STEP_ORDER } from '../src/data/turnSteps';
import type { Phase } from '../src/engine/types';
import { buildFlowChart, CHART_W, highlightNode, MAX_LINES, MAX_SUB_CHARS, MAX_TITLE_CHARS, type FlowNode } from '../src/ui/flowChart';

const chart = buildFlowChart();
const byId = new Map(chart.nodes.map((n) => [n.id, n]));
const ALL_PHASES: Phase[] = ['設置', '重置', '先手', '反擊', '追擊', '傷害', '歸還', '抽牌', '爆發', '增益', '回合結束', '結束'];

const overlap = (a: FlowNode, b: FlowNode) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
const laneOf = (n: FlowNode) => chart.lanes.find((l) => n.y >= l.y && n.y + n.h <= l.y + l.h);

describe('流程圖主幹', () => {
  it('主幹節點與順序由共用步驟表產生', () => {
    const spine = chart.nodes.filter((n) => n.phase);
    expect(spine.map((n) => n.phase)).toEqual(STEP_ORDER);
  });

  it('單一步驟的分組在第一條分區由左到右，多步驟的分組展開到下一條分區', () => {
    const turnLane = chart.lanes[0];
    const singles = STEP_GROUPS.filter((g) => g.steps.length === 1).map((g) => byId.get(g.steps[0].phase)!);
    for (const n of singles) expect(laneOf(n), n.id).toBe(turnLane);
    for (let i = 1; i < singles.length; i++) expect(singles[i].x, singles[i].id).toBeGreaterThan(singles[i - 1].x);

    const multi = STEP_GROUPS.find((g) => g.steps.length > 1)!;
    const steps = multi.steps.map((s) => byId.get(s.phase)!);
    const lane = laneOf(steps[0])!;
    expect(lane.label).toContain(`${multi.label}階段`);
    for (const n of steps) expect(laneOf(n), n.id).toBe(lane);
    for (let i = 1; i < steps.length; i++) expect(steps[i].x, steps[i].id).toBeGreaterThan(steps[i - 1].x);
    // 展開的分組在第一條分區裡有一個對應的節點
    expect(laneOf(byId.get(multi.label)!)).toBe(turnLane);
  });
});

describe('流程圖節點', () => {
  it('每個節點是標題一行加說明一行，不超過字數上限', () => {
    for (const n of chart.nodes) {
      expect(n.lines.length, n.id).toBe(MAX_LINES);
      expect([...n.lines[0]].length, `${n.id}：${n.lines[0]}`).toBeLessThanOrEqual(MAX_TITLE_CHARS);
      expect([...n.lines[1]].length, `${n.id}：${n.lines[1]}`).toBeLessThanOrEqual(MAX_SUB_CHARS);
      for (const line of n.lines) expect(line.trim(), n.id).not.toBe('');
    }
  });

  it('邊的標籤也要夠短', () => {
    for (const e of chart.edges) if (e.label) expect([...e.label.text].length, e.label.text).toBeLessThanOrEqual(12);
  });

  it('分支引用的階段都存在於 Phase，並且屬於回合主幹', () => {
    for (const n of chart.nodes) {
      if (!n.anchor) continue;
      expect(ALL_PHASES, n.id).toContain(n.anchor);
      expect(STEP_ORDER, n.id).toContain(n.anchor);
    }
  });

  it('所有節點都在設計寬度之內，彼此不重疊，並且落在某一條分區裡', () => {
    for (const n of chart.nodes) {
      expect(n.x, n.id).toBeGreaterThanOrEqual(0);
      expect(n.x + n.w, n.id).toBeLessThanOrEqual(CHART_W);
      expect(n.y + n.h, n.id).toBeLessThanOrEqual(chart.height);
      expect(laneOf(n), `${n.id} 不在任何分區`).toBeDefined();
    }
    for (let i = 0; i < chart.nodes.length; i++) {
      for (let j = i + 1; j < chart.nodes.length; j++) {
        expect(overlap(chart.nodes[i], chart.nodes[j]), `${chart.nodes[i].id} 與 ${chart.nodes[j].id}`).toBe(false);
      }
    }
  });

  it('邊連接的節點都存在，且沒有重複的邊', () => {
    for (const e of chart.edges) {
      expect(byId.has(e.from), `${e.id} 起點`).toBe(true);
      expect(byId.has(e.to), `${e.id} 終點`).toBe(true);
    }
    expect(new Set(chart.edges.map((e) => e.id)).size).toBe(chart.edges.length);
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

describe('流程圖邊線', () => {
  it('邊線不穿過起訖以外的節點', () => {
    for (const e of chart.edges) {
      for (const n of chart.nodes) {
        if (n.id === e.from || n.id === e.to) continue;
        for (const s of segments(e.d)) expect(hits(s, n), `${e.id} 穿過 ${n.id}`).toBe(false);
      }
    }
  });

  it('邊的標籤不壓到節點', () => {
    for (const e of chart.edges) {
      if (!e.label) continue;
      const w = [...e.label.text].length * 11;
      const box = { x: e.label.x - w / 2, y: e.label.y - 8, w, h: 14 };
      for (const n of chart.nodes) expect(hits([box.x, box.y, box.x + box.w, box.y + box.h], n), `${e.id} 的標籤壓到 ${n.id}`).toBe(false);
    }
  });
});

describe('流程圖內容與規則書一致', () => {
  const text = (id: string) => byId.get(id)!.lines.join('');
  const labels = chart.edges.map((e) => e.label?.text ?? '');

  it('先手：沒有可打出的招式時展示手牌，不算收招', () => {
    expect(text('show-hand')).toContain('展示手牌');
    expect(text('show-hand')).toContain('不算收招');
    expect(chart.edges.some((e) => e.from === '先手' && e.to === 'show-hand')).toBe(true);
  });

  it('反擊：後攻方第一個動作就收招時跳過追擊，直接進傷害計算', () => {
    const skip = chart.edges.find((e) => e.from === '反擊' && e.to === '傷害');
    expect(skip?.label?.text).toContain('跳過追擊');
  });

  it('追擊：分成成功與失敗，並標出一律失敗的情況', () => {
    expect(text('chase-hit')).toContain('成功');
    expect(text('chase-miss')).toContain('失敗');
    expect(text('chase-always')).toContain('裝備增益');
    expect(text('chase-always')).toContain('沒招式');
    expect(labels).toContain('一律失敗');
    expect(labels).toContain('不在範圍內');
    expect(labels).toContain('在範圍內');
  });

  it('勝負檢查：分區標題說明每個步驟結束後都檢查，含重置與抽牌階段', () => {
    const lane = chart.lanes.find((l) => l.label.includes('勝負判定'))!;
    expect(lane.label).toContain('每個步驟結束後都檢查');
    expect(lane.label).toContain('重置');
    expect(lane.label).toContain('抽牌');
    expect(lane.exception).toBe(true);
    expect(laneOf(byId.get('win-check')!)).toBe(lane);
  });

  it('勝負：單方歸零落敗，同時歸零比手牌，手牌相同直接平手', () => {
    expect(text('lose')).toContain('落敗');
    expect(text('tie-hand')).toContain('手牌');
    expect(text('tie-hand')).toContain('平手');
    expect(byId.has('tie-rage')).toBe(false);
    expect(byId.has('tie-end')).toBe(false);
    const ex = chart.lanes.filter((l) => l.exception);
    expect(ex).toHaveLength(2);
    expect(laneOf(byId.get('tie-hand')!)).toBe(ex[1]);
  });
});

describe('你在這裡', () => {
  it('主幹階段能算出要標示的節點', () => {
    for (const p of STEP_ORDER) expect(highlightNode(p)).toBe(p);
    expect(byId.get(highlightNode('追擊')!)?.phase).toBe('追擊');
  });

  it('設置、結束與沒有階段時沒有對應節點', () => {
    expect(highlightNode('設置')).toBeNull();
    expect(highlightNode('結束')).toBeNull();
    expect(highlightNode(undefined)).toBeNull();
  });
});
