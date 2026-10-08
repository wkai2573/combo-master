// 戰鬥流程圖的版面資料：主幹由共用步驟表（src/data/turnSteps.ts）產生，分支手寫。
// 座標單位是 SVG 的設計寬度（CHART_W），實際顯示時由彈窗寬度縮放。
// 中文在 SVG 裡不會自動換行，所以每個節點的文字預先斷成最多 MAX_LINES 行、每行最多 MAX_CHARS 字，由測試把關。
import { STEP_GROUPS, STEP_ORDER } from '../data/turnSteps';
import type { Phase } from '../engine/types';

export const CHART_W = 420;
export const MAX_LINES = 2;
export const MAX_CHARS = 10;

/** 顏色語意：回合階段用一般色，追擊成功／失敗用 good／bad，勝負用 accent，旁註用虛線 */
export type Tone = 'plain' | 'good' | 'bad' | 'accent' | 'note';

export interface FlowNode {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  lines: string[];
  tone: Tone;
  /** 主幹節點對應的階段 */
  phase?: Phase;
  /** 分支節點掛在哪個主幹階段旁邊 */
  anchor?: Phase;
}

export interface FlowEdge {
  id: string;
  from: string;
  to: string;
  d: string;
  tone: Tone;
  dashed?: boolean;
  label?: { text: string; x: number; y: number; anchor?: 'start' | 'middle' | 'end'; vertical?: boolean };
}

export interface FlowGroup {
  label: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface FlowChart {
  width: number;
  height: number;
  groups: FlowGroup[];
  nodes: FlowNode[];
  edges: FlowEdge[];
}

type SpinePhase = Exclude<Phase, '設置' | '結束'>;

// 主幹節點的文字：第一行是階段名，第二行是一句話
const SPINE_TEXT: Record<SpinePhase, string[]> = {
  重置: ['重置階段', '處理回合開始的效果'],
  先手: ['先手步驟', '先攻出 1 張招式'],
  反擊: ['反擊步驟', '輪流出招或收招'],
  追擊: ['追擊階段', '雙方翻牌組頂'],
  傷害: ['傷害計算', '攻擊減防禦放怒氣區'],
  歸還: ['歸還步驟', '招式與追擊卡進經驗區'],
  抽牌: ['抽牌階段', '各抽 1 張'],
  爆發: ['爆發階段', '可放手牌，抽 2 張'],
  增益: ['增益階段', '可打出裝備或增益'],
  回合結束: ['回合結束', '交換先後攻'],
};

// 主幹箭頭旁的短條件，以箭頭起點的階段為鍵
const SPINE_EDGE_LABEL: Partial<Record<SpinePhase, string>> = {
  反擊: '雙方收招',
  追擊: '判定完畢',
};

// 版面常數
const SX = 28; // 主幹節點左緣
const SW = 160;
const SH = 44;
const CX = SX + SW / 2; // 主幹中線
const SR = SX + SW; // 主幹節點右緣
const LANE = 198; // 主幹與分支之間的轉折線
const BX = 254; // 分支節點左緣
const BW = 150;
const BH = 40;
const BR = BX + BW; // 分支節點右緣
const FAR = 412; // 繞過分支欄的邊
const BCX = BX + BW / 2; // 分支欄中線
const TOP = 16;
const GROUP_LABEL_H = 22;
const GROUP_PAD = 8;
const GAP_BETWEEN = 34; // 分組之間
const GAP_INSIDE = 40; // 分組內
// 這些階段後面要多留空間給右側的分支
const GAP_AFTER: Partial<Record<SpinePhase, number>> = { 先手: 40, 反擊: 64, 追擊: 50 };

const cy = (n: FlowNode) => n.y + n.h / 2;

export function buildFlowChart(): FlowChart {
  const nodes: FlowNode[] = [];
  const groups: FlowGroup[] = [];
  const edges: FlowEdge[] = [];

  // ── 主幹：順序、分組、階段都來自共用步驟表 ──
  let y = TOP;
  for (const g of STEP_GROUPS) {
    const multi = g.steps.length > 1;
    const top = y;
    if (multi) y += GROUP_LABEL_H;
    g.steps.forEach((s, i) => {
      const phase = s.phase as SpinePhase;
      const lines = SPINE_TEXT[phase];
      if (!lines) throw new Error(`流程圖主幹缺少「${phase}」的節點文字，請在 SPINE_TEXT 補上`);
      nodes.push({ id: phase, x: SX, y, w: SW, h: SH, lines, tone: 'plain', phase });
      y += SH;
      const last = i === g.steps.length - 1;
      if (multi && last) return;
      y += GAP_AFTER[phase] ?? (multi ? GAP_INSIDE : GAP_BETWEEN);
    });
    if (multi) {
      y += GROUP_PAD;
      groups.push({ label: `${g.label}階段`, x: SX - 8, y: top, w: SW + 16, h: y - top });
      y += GAP_BETWEEN;
    }
  }

  const spine = nodes.filter((n) => n.phase);
  const at = (p: Phase) => spine.find((n) => n.phase === p)!;
  spine.slice(0, -1).forEach((a, i) => {
    const b = spine[i + 1];
    const text = SPINE_EDGE_LABEL[a.phase as SpinePhase];
    edges.push({
      id: `${a.id}>${b.id}`,
      from: a.id,
      to: b.id,
      d: `M${CX},${a.y + a.h} V${b.y}`,
      tone: 'plain',
      label: text ? { text, x: CX + 8, y: (a.y + a.h + b.y) / 2 + 4 } : undefined,
    });
  });
  // 回合結束後回到下一回合的重置
  const first = spine[0];
  const lastNode = spine[spine.length - 1];
  edges.push({
    id: 'loop',
    from: lastNode.id,
    to: first.id,
    d: `M${SX},${cy(lastNode)} H10 V${cy(first)} H${SX}`,
    tone: 'plain',
    label: { text: '下一回合', x: 22, y: cy(spine.find((n) => n.phase === '爆發')!), anchor: 'middle', vertical: true },
  });

  // ── 分支：座標掛在主幹節點旁邊，文字與條件手寫 ──
  const branch = (id: string, anchor: Phase, dy: number, lines: string[], tone: Tone): FlowNode => {
    const n: FlowNode = { id, x: BX, y: cy(at(anchor)) + dy - BH / 2, w: BW, h: BH, lines, tone, anchor };
    nodes.push(n);
    return n;
  };
  // 從主幹節點右側轉折到分支節點，label 放在橫線上方
  const fan = (from: FlowNode, to: FlowNode, label: string | undefined, tone: Tone) => {
    const a = from.x + from.w;
    edges.push({
      id: `${from.id}>${to.id}`,
      from: from.id,
      to: to.id,
      d: `M${a},${cy(from)} H${LANE} V${cy(to)} H${to.x}`,
      tone,
      label: label ? { text: label, x: (LANE + to.x) / 2, y: cy(to) - 5, anchor: 'middle' } : undefined,
    });
  };

  // 戰鬥階段內
  const showHand = branch('show-hand', '先手', 40, ['展示手牌', '不算收招'], 'plain');
  fan(at('先手'), showHand, '無招式', 'plain');

  const skipChase = branch('skip-chase', '反擊', 12, ['跳過追擊', '直接進傷害計算'], 'plain');
  fan(at('反擊'), skipChase, '首動收招', 'plain');
  edges.push({
    id: 'skip-chase>傷害',
    from: 'skip-chase',
    to: '傷害',
    d: `M${BR},${cy(skipChase)} H${FAR} V${cy(at('傷害'))} H${SR}`,
    tone: 'plain',
    dashed: true,
  });

  const hit = branch('chase-hit', '追擊', -48, ['成功', '成為追擊卡'], 'good');
  const miss = branch('chase-miss', '追擊', 0, ['失敗', '該卡加入手牌'], 'bad');
  const always = branch('chase-always', '追擊', 48, ['翻到裝備或增益', '或戰鬥區無招式'], 'bad');
  fan(at('追擊'), hit, '不在範圍', 'good');
  fan(at('追擊'), miss, '在範圍內', 'bad');
  fan(at('追擊'), always, '一律失敗', 'bad');

  // 勝負：旁註掛在抽牌旁邊，下面是同時歸零的比較流程
  const check = branch('win-check', '抽牌', 0, ['每個步驟結束都檢查', '含重置與抽牌階段'], 'note');
  edges.push({
    id: 'win-check>抽牌',
    from: 'win-check',
    to: '抽牌',
    d: `M${BX},${cy(check)} H${SR}`,
    tone: 'note',
    dashed: true,
  });
  const PITCH = BH + 28;
  const lose = branch('lose', '抽牌', PITCH, ['牌組歸零者落敗'], 'accent');
  const tieHand = branch('tie-hand', '抽牌', PITCH * 2, ['比手牌張數', '多者獲勝'], 'accent');
  const tieRage = branch('tie-rage', '抽牌', PITCH * 3, ['逐張同時翻怒氣區', '大者勝，同值續翻'], 'accent');
  const tieEnd = branch('tie-end', '抽牌', PITCH * 4, ['先翻完者落敗', '同時翻完才平手'], 'accent');
  const down = (a: FlowNode, b: FlowNode, label: string) =>
    edges.push({
      id: `${a.id}>${b.id}`,
      from: a.id,
      to: b.id,
      d: `M${BCX},${a.y + a.h} V${b.y}`,
      tone: 'accent',
      label: { text: label, x: BCX + 8, y: (a.y + a.h + b.y) / 2 + 4 },
    });
  down(check, lose, '有人歸零');
  down(lose, tieHand, '同時歸零');
  down(tieHand, tieRage, '張數相同');
  down(tieRage, tieEnd, '怒氣區翻完');

  const bottom = Math.max(...nodes.map((n) => n.y + n.h));
  return { width: CHART_W, height: bottom + TOP, groups, nodes, edges };
}

/** 目前階段在主幹上對應的節點；設置、結束或沒有階段時沒有對應 */
export function highlightNode(phase: Phase | undefined): string | null {
  return phase && STEP_ORDER.includes(phase) ? phase : null;
}
