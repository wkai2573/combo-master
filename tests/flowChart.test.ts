import { describe, expect, it } from 'vitest';
import { STEP_ORDER } from '../src/data/turnSteps';
import type { Phase } from '../src/engine/types';
import { buildFlowChart, CHART_W, highlightNode, MAX_CHARS, MAX_LINES, type FlowNode } from '../src/ui/flowChart';

const chart = buildFlowChart();
const byId = new Map(chart.nodes.map((n) => [n.id, n]));
const ALL_PHASES: Phase[] = ['設置', '重置', '先手', '反擊', '追擊', '傷害', '歸還', '抽牌', '爆發', '增益', '回合結束', '結束'];

const overlap = (a: FlowNode, b: FlowNode) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

describe('流程圖主幹', () => {
  it('節點與順序由共用步驟表產生，由上往下', () => {
    const spine = chart.nodes.filter((n) => n.phase);
    expect(spine.map((n) => n.phase)).toEqual(STEP_ORDER);
    for (let i = 1; i < spine.length; i++) expect(spine[i].y).toBeGreaterThan(spine[i - 1].y + spine[i - 1].h);
  });

  it('戰鬥階段的五個步驟畫在同一個分組之中', () => {
    const battle = chart.groups.find((g) => g.label === '戰鬥階段');
    expect(battle).toBeDefined();
    for (const p of ['先手', '反擊', '追擊', '傷害', '歸還'] as Phase[]) {
      const n = byId.get(p)!;
      expect(n.y).toBeGreaterThanOrEqual(battle!.y);
      expect(n.y + n.h).toBeLessThanOrEqual(battle!.y + battle!.h);
    }
  });
});

describe('流程圖節點', () => {
  it('每個節點的文字不超過行數與每行字數上限', () => {
    for (const n of chart.nodes) {
      expect(n.lines.length, n.id).toBeGreaterThan(0);
      expect(n.lines.length, n.id).toBeLessThanOrEqual(MAX_LINES);
      for (const line of n.lines) {
        expect(line.trim(), n.id).not.toBe('');
        expect([...line].length, `${n.id}：${line}`).toBeLessThanOrEqual(MAX_CHARS);
      }
    }
  });

  it('邊的標籤也要夠短', () => {
    for (const e of chart.edges) if (e.label) expect([...e.label.text].length, e.label.text).toBeLessThanOrEqual(6);
  });

  it('分支引用的階段都存在於 Phase，並且屬於回合主幹', () => {
    for (const n of chart.nodes) {
      if (!n.anchor) continue;
      expect(ALL_PHASES, n.id).toContain(n.anchor);
      expect(STEP_ORDER, n.id).toContain(n.anchor);
    }
  });

  it('所有節點都在設計寬度之內，彼此不重疊', () => {
    for (const n of chart.nodes) {
      expect(n.x, n.id).toBeGreaterThanOrEqual(0);
      expect(n.x + n.w, n.id).toBeLessThanOrEqual(CHART_W);
      expect(n.y + n.h, n.id).toBeLessThanOrEqual(chart.height);
    }
    for (let i = 0; i < chart.nodes.length; i++) {
      for (let j = i + 1; j < chart.nodes.length; j++) {
        expect(overlap(chart.nodes[i], chart.nodes[j]), `${chart.nodes[i].id} 與 ${chart.nodes[j].id}`).toBe(false);
      }
    }
  });

  it('邊連接的節點都存在', () => {
    for (const e of chart.edges) {
      expect(byId.has(e.from), `${e.id} 起點`).toBe(true);
      expect(byId.has(e.to), `${e.id} 終點`).toBe(true);
    }
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
      if (!e.label || e.label.vertical) continue;
      const w = [...e.label.text].length * 12;
      const x = e.label.anchor === 'middle' ? e.label.x - w / 2 : e.label.x;
      const box = { x, y: e.label.y - 11, w, h: 13 };
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
  });

  it('反擊：後攻方第一個動作就收招時跳過追擊', () => {
    expect(text('skip-chase')).toContain('跳過追擊');
    expect(chart.edges.some((e) => e.from === 'skip-chase' && e.to === '傷害')).toBe(true);
  });

  it('追擊：分成成功與失敗，並標出一律失敗的情況', () => {
    expect(text('chase-hit')).toContain('成功');
    expect(text('chase-miss')).toContain('失敗');
    expect(text('chase-always')).toContain('裝備或增益');
    expect(text('chase-always')).toContain('無招式');
    expect(labels).toContain('一律失敗');
  });

  it('勝負檢查是旁註，連到主幹，並說明重置與抽牌階段也會判負', () => {
    expect(text('win-check')).toContain('重置');
    expect(text('win-check')).toContain('抽牌');
    expect(chart.edges.filter((e) => e.from === 'win-check' && STEP_ORDER.includes(e.to as Phase))).toHaveLength(1);
    // 不從每個主幹節點各拉一條連到勝負檢查的邊
    expect(chart.edges.filter((e) => e.to === 'win-check')).toHaveLength(0);
  });

  it('勝負：單方歸零落敗，同時歸零比手牌，再比怒氣區連擊值，終點是先翻完落敗、同時翻完才平手', () => {
    expect(text('lose')).toContain('落敗');
    expect(text('tie-hand')).toContain('手牌');
    expect(text('tie-rage')).toContain('怒氣區');
    expect(text('tie-rage')).toContain('同值續翻');
    expect(text('tie-end')).toContain('先翻完');
    expect(text('tie-end')).toContain('同時翻完');
    expect(text('tie-end')).toContain('平手');
    expect(text('tie-end')).not.toContain('全部同值');
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
