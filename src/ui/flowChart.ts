// 戰鬥流程圖的版面資料：橫向分區，回合主幹由共用步驟表（src/data/turnSteps.ts）產生，分支手寫。
// 座標單位是 SVG 的設計寬度（CHART_W），實際顯示時由彈窗寬度縮放，手機上固定最小寬度、在彈窗內捲動。
// 中文在 SVG 裡不會自動換行，所以每個節點的文字預先斷成標題一行、說明一行，字數上限由測試把關。
import { STEP_GROUPS, STEP_ORDER } from '../data/turnSteps';
import type { Phase } from '../engine/types';

export const CHART_W = 1230;
/** 節點文字：標題一行、說明一行 */
export const MAX_LINES = 2;
export const MAX_TITLE_CHARS = 8;
export const MAX_SUB_CHARS = 12;

/** 節點顏色語意：回合階段綠、戰鬥步驟黃、追擊成功綠、失敗與勝負紅、備註灰虛線 */
export type Tone = 'turn' | 'combat' | 'good' | 'bad' | 'note';
/** 邊的顏色語意：branch 是條件分支與回到下一步的虛線 */
export type EdgeTone = 'plain' | 'turn' | 'combat' | 'good' | 'bad' | 'branch';

export interface FlowNode {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  /** 第一行是標題，第二行是一句說明 */
  lines: string[];
  tone: Tone;
  dashed?: boolean;
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
  tone: EdgeTone;
  dashed?: boolean;
  label?: { text: string; x: number; y: number };
}

export interface FlowLane {
  label: string;
  x: number;
  y: number;
  w: number;
  h: number;
  /** 例外分區用紅色虛線框 */
  exception: boolean;
}

export interface FlowChart {
  width: number;
  height: number;
  lanes: FlowLane[];
  nodes: FlowNode[];
  edges: FlowEdge[];
  legendY: number;
}

type SpinePhase = Exclude<Phase, '設置' | '結束'>;

// 主幹節點的文字：標題與一句話
const SPINE_TEXT: Record<SpinePhase, string[]> = {
  重置: ['重置階段', '回合開始的效果'],
  先手: ['先手步驟', '先攻出 1 張招式'],
  反擊: ['反擊步驟', '後攻先，輪流出招'],
  追擊: ['追擊判定', '雙方翻牌組頂 1 張'],
  傷害: ['傷害計算', '對方攻擊 − 我方防禦'],
  歸還: ['歸還', '招式與追擊卡入經驗區'],
  抽牌: ['抽牌階段', '雙方各抽 1 張'],
  爆發: ['爆發階段', '放手牌，抽 2 張'],
  增益: ['增益階段', '打出裝備或增益'],
  回合結束: ['回合結束', '交換先後攻'],
};

// 主幹箭頭旁的短條件，以箭頭起點的階段為鍵
const SPINE_EDGE_LABEL: Partial<Record<SpinePhase, string>> = {
  反擊: '雙方收招',
  追擊: '判定完畢',
};

// 版面常數
const NW = 140;
const NH = 58;
const COL0 = 72;
const COL_PITCH = 192;
const LANE_X = 40;
const LANE_W = 1154;
const LANE_H = 118;
const LANE_PITCH = 138;
const LANE_TOP = 56;
const EXTRA_BOTTOM = 66; // 圖例

const colX = (c: number) => COL0 + c * COL_PITCH;
const colCx = (c: number) => colX(c) + NW / 2;
const laneY = (k: number) => LANE_TOP + k * LANE_PITCH;
const nodeY = (k: number) => laneY(k) + 44;
const nodeCy = (k: number) => nodeY(k) + NH / 2;

function missing(phase: Phase): never {
  throw new Error(`流程圖主幹缺少「${phase}」的節點文字，請在 SPINE_TEXT 補上`);
}

export function buildFlowChart(): FlowChart {
  const nodes: FlowNode[] = [];
  const edges: FlowEdge[] = [];
  const at = (id: string) => nodes.find((n) => n.id === id)!;
  const edge = (from: string, to: string, d: string, tone: EdgeTone, o: { dashed?: boolean; label?: [string, number, number] } = {}) =>
    edges.push({ id: `${from}>${to}`, from, to, d, tone, dashed: o.dashed, label: o.label && { text: o.label[0], x: o.label[1], y: o.label[2] } });

  // ── 主幹：順序、分組、階段都來自共用步驟表 ──
  // 第 0 行是回合階段，一個分組一格；有多個步驟的分組在第 1 行向下展開，從該分組的欄開始往右排
  const groupNode: string[] = [];
  const colOf = new Map<Phase, number>();
  const laneOf = new Map<Phase, number>();
  STEP_GROUPS.forEach((g, gi) => {
    if (g.steps.length === 1) {
      const phase = g.steps[0].phase as SpinePhase;
      colOf.set(phase, gi);
      laneOf.set(phase, 0);
      groupNode.push(phase);
      nodes.push({ id: phase, x: colX(gi), y: nodeY(0), w: NW, h: NH, lines: SPINE_TEXT[phase] ?? missing(phase), tone: 'turn', phase });
      return;
    }
    groupNode.push(g.label);
    nodes.push({ id: g.label, x: colX(gi), y: nodeY(0), w: NW, h: NH, lines: [`${g.label}階段`, '展開成下方步驟'], tone: 'turn' });
    g.steps.forEach((s, i) => {
      const phase = s.phase as SpinePhase;
      colOf.set(phase, gi + i);
      laneOf.set(phase, 1);
      nodes.push({ id: phase, x: colX(gi + i), y: nodeY(1), w: NW, h: NH, lines: SPINE_TEXT[phase] ?? missing(phase), tone: 'combat', phase });
    });
  });
  const battle = STEP_GROUPS.findIndex((g) => g.steps.length > 1);
  const battleSteps = STEP_GROUPS[battle].steps.map((s) => s.phase as SpinePhase);
  const colAt = (p: Phase) => colOf.get(p)!;
  const cx = (p: Phase) => colCx(colAt(p));
  const left = (p: Phase) => colX(colAt(p));
  const right = (p: Phase) => left(p) + NW;
  const cyOf = (p: Phase) => nodeCy(laneOf.get(p)!);
  const topY = (p: Phase) => nodeY(laneOf.get(p)!);
  const botY = (p: Phase) => topY(p) + NH;

  // 第 0 行：由左到右，最後一格以虛線回到第一格
  for (let i = 0; i < groupNode.length - 1; i++) {
    const a = at(groupNode[i]);
    const b = at(groupNode[i + 1]);
    edge(a.id, b.id, `M${a.x + NW},${nodeCy(0)} H${b.x}`, 'turn');
  }
  const first = at(groupNode[0]);
  const last = at(groupNode[groupNode.length - 1]);
  const loopY = laneY(0) + 30;
  edge(last.id, first.id, `M${last.x + NW / 2},${last.y} V${loopY} H${first.x + NW / 2} V${first.y}`, 'branch', {
    dashed: true,
    label: ['下一回合', (first.x + last.x + NW) / 2, loopY],
  });

  // 戰鬥各步驟：由左到右；從戰鬥格展開，歸還之後回到下一個回合階段
  const group = at(STEP_GROUPS[battle].label);
  const firstStep = battleSteps[0];
  edge(group.id, firstStep, `M${cx(firstStep)},${group.y + NH} V${topY(firstStep)}`, 'branch', {
    dashed: true,
    label: ['展開步驟', cx(firstStep) + 28, (group.y + NH + topY(firstStep)) / 2 + 3],
  });
  battleSteps.slice(0, -1).forEach((p, i) => {
    const q = battleSteps[i + 1];
    const text = SPINE_EDGE_LABEL[p];
    edge(p, q, `M${right(p)},${cyOf(p)} H${left(q)}`, 'combat', { label: text ? [text, (right(p) + left(q)) / 2, cyOf(p) - 6] : undefined });
  });
  const lastStep = battleSteps[battleSteps.length - 1];
  const next = STEP_GROUPS[battle + 1]?.steps[0].phase;
  if (next) {
    const gapY = laneY(0) + LANE_H + 10;
    edge(lastStep, next, `M${cx(lastStep)},${topY(lastStep)} V${gapY} H${cx(next)} V${botY(next)}`, 'turn', {
      label: ['戰鬥結束，進入抽牌', cx(lastStep) - 56, laneY(1) + 22],
    });
  }

  // ── 分支：座標掛在主幹節點旁邊，文字與條件手寫 ──
  const branch = (id: string, anchor: Phase, col: number, lane: number, lines: string[], tone: Tone, dashed = false) =>
    nodes.push({ id, x: colX(col), y: nodeY(lane), w: NW, h: NH, lines, tone, dashed, anchor });

  // 先手：沒有可打出的招式時展示手牌，不算收招
  branch('show-hand', '先手', colAt('先手') - 1, 1, ['先手沒招式', '展示手牌，不算收招'], 'note', true);
  edge('先手', 'show-hand', `M${left('先手')},${cyOf('先手')} H${colX(colAt('先手') - 1) + NW}`, 'plain', {
    dashed: true,
    label: ['無招式', (left('先手') + colX(colAt('先手') - 1) + NW) / 2, cyOf('先手') - 6],
  });
  // 反擊：後攻方第一個動作就收招，跳過追擊
  const skipY = laneY(1) + 30;
  edge('反擊', '傷害', `M${cx('反擊')},${topY('反擊')} V${skipY} H${cx('傷害')} V${topY('傷害')}`, 'branch', {
    dashed: true,
    label: ['後攻首手就收招：跳過追擊', (cx('反擊') + cx('傷害')) / 2, skipY],
  });

  // 追擊判定的結果
  const chase = colAt('追擊');
  branch('chase-always', '追擊', chase - 2, 2, ['一律失敗', '裝備增益，或沒招式'], 'bad', true);
  branch('chase-miss', '追擊', chase - 1, 2, ['追擊失敗', '該卡加入手牌'], 'bad');
  branch('chase-hit', '追擊', chase, 2, ['追擊成功', '成為追擊卡，計入攻擊'], 'good');
  const e1 = laneY(2) + 18;
  const e2 = laneY(2) + 30;
  edge('追擊', 'chase-miss', `M${cx('追擊')},${botY('追擊')} V${e1} H${colCx(chase - 1)} V${nodeY(2)}`, 'bad', {
    label: ['在範圍內', (cx('追擊') + colCx(chase - 1)) / 2, e1],
  });
  edge('追擊', 'chase-always', `M${cx('追擊')},${botY('追擊')} V${e2} H${colCx(chase - 2)} V${nodeY(2)}`, 'bad', {
    dashed: true,
    label: ['一律失敗', (colCx(chase - 1) + colCx(chase - 2)) / 2, e2],
  });
  // 成功的邊最後畫，三條邊共用的那一段垂直線才會維持綠色
  edge('追擊', 'chase-hit', `M${cx('追擊')},${botY('追擊')} V${nodeY(2)}`, 'good', { label: ['不在範圍內', cx('追擊') + 38, laneY(2) + 3] });

  // 勝負：每個步驟結束都檢查，分區標題說明包含重置與抽牌階段；單方歸零落敗，同時歸零進入加賽
  const dmg = colAt('傷害');
  branch('lose', '傷害', dmg - 1, 3, ['牌組歸零者落敗', '只有一方歸零'], 'bad');
  branch('win-check', '傷害', dmg, 3, ['勝負檢查', '每個步驟結束都檢查'], 'bad');
  branch('tie', '傷害', dmg + 1, 3, ['雙方同時歸零', '進入加賽判定'], 'bad');
  edge('傷害', 'win-check', `M${cx('傷害')},${botY('傷害')} V${nodeY(3)}`, 'bad', {
    dashed: true,
    label: ['隨時檢查', cx('傷害') + 28, (laneY(2) + laneY(3)) / 2 + 28],
  });
  edge('win-check', 'lose', `M${colX(dmg)},${nodeCy(3)} H${colX(dmg - 1) + NW}`, 'bad', {
    dashed: true,
    label: ['單方歸零', (colX(dmg) + colX(dmg - 1) + NW) / 2, nodeCy(3) - 6],
  });
  edge('win-check', 'tie', `M${colX(dmg) + NW},${nodeCy(3)} H${colX(dmg + 1)}`, 'bad', {
    dashed: true,
    label: ['同時歸零', (colX(dmg) + NW + colX(dmg + 1)) / 2, nodeCy(3) - 6],
  });

  // 加賽：先比手牌張數，再逐張翻怒氣區比連擊值，一方先翻完落敗，雙方同時翻完才平手
  branch('tie-hand', '傷害', dmg + 1, 4, ['比手牌張數', '手牌多者獲勝'], 'bad');
  branch('tie-rage', '傷害', dmg, 4, ['比怒氣區連擊值', '大者勝，同值續翻'], 'bad');
  branch('tie-end', '傷害', dmg - 1, 4, ['先翻完者落敗', '同時翻完才平手'], 'bad');
  edge('tie', 'tie-hand', `M${colCx(dmg + 1)},${nodeY(3) + NH} V${nodeY(4)}`, 'bad', { dashed: true });
  edge('tie-hand', 'tie-rage', `M${colX(dmg + 1)},${nodeCy(4)} H${colX(dmg) + NW}`, 'bad', {
    dashed: true,
    label: ['手牌相同', (colX(dmg + 1) + colX(dmg) + NW) / 2, nodeCy(4) - 6],
  });
  edge('tie-rage', 'tie-end', `M${colX(dmg)},${nodeCy(4)} H${colX(dmg - 1) + NW}`, 'bad', {
    dashed: true,
    label: ['翻完', (colX(dmg) + colX(dmg - 1) + NW) / 2, nodeCy(4) - 6],
  });

  const lanes: FlowLane[] = [
    ['01 / 回合階段', false],
    [`02 / ${STEP_GROUPS[battle].label}階段`, false],
    ['03 / 追擊結果', false],
    ['EX / 勝負判定（每個步驟結束後都檢查，含重置與抽牌階段）', true],
    ['EX / 同時歸零加賽', true],
  ].map(([label, exception], k) => ({ label: label as string, exception: exception as boolean, x: LANE_X, y: laneY(k), w: LANE_W, h: LANE_H }));

  return { width: CHART_W, height: laneY(4) + LANE_H + EXTRA_BOTTOM, lanes, nodes, edges, legendY: laneY(4) + LANE_H + 18 };
}

/** 目前階段在主幹上對應的節點；設置、結束或沒有階段時沒有對應 */
export function highlightNode(phase: Phase | undefined): string | null {
  return phase && STEP_ORDER.includes(phase) ? phase : null;
}
