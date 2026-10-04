import * as XLSX from 'xlsx';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import type { CardData, CharacterData, ClassName, EquipSlot } from '../src/data/types';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const xlsxPath = resolve(root, 'docs', '連擊大師.xlsx');
const outDir = resolve(root, 'src', 'data', 'generated');

const wb = XLSX.read(readFileSync(xlsxPath), { type: 'buffer' });

type Row = Record<string, unknown>;
function sheet(name: string): Row[] {
  const ws = wb.Sheets[name];
  if (!ws) throw new Error(`找不到工作表：${name}`);
  return XLSX.utils.sheet_to_json<Row>(ws, { defval: null });
}
const str = (v: unknown) => (v === null || v === undefined ? '' : String(v).trim());
const num = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};
const CLASSES: ClassName[] = ['共用', '劍士', '盜賊', '商人', '弓箭手', '法師'];
const toClass = (v: unknown): ClassName => {
  const s = str(v);
  return (CLASSES as string[]).includes(s) ? (s as ClassName) : '共用';
};

const cards: CardData[] = [];

for (const r of sheet('招式')) {
  const name = str(r['卡名']);
  if (!name) continue;
  cards.push({
    id: name, name, kind: 'move', cls: toClass(r['職業']), traits: [],
    atk: num(r['攻擊']), def: num(r['防禦']), combo: num(r['連擊值']),
    expReq: 0, text: str(r['效果']),
  });
}

for (const r of sheet('招式_效果')) {
  const name = str(r['卡名']);
  if (!name) continue;
  cards.push({
    id: name, name, kind: 'move', cls: toClass(r['職業']),
    traits: str(r['特徵']).split(/[,，、/]/).map((s) => s.trim()).filter(Boolean),
    atk: num(r['攻擊']), def: num(r['防禦']), combo: num(r['連擊值']),
    expReq: 0, text: str(r['效果']),
  });
}

for (const r of sheet('裝備／增益')) {
  const name = str(r['卡名']);
  if (!name) continue;
  const part = str(r['裝備部位/增益']);
  const isBuff = part === '增益';
  const dur = num(r['持續時間']);
  cards.push({
    id: name, name, kind: isBuff ? 'buff' : 'equip', cls: toClass(r['職業']), traits: [],
    atk: 0, def: 0, combo: 0, expReq: num(r['經驗需求']),
    slot: isBuff ? undefined : (part as EquipSlot),
    duration: isBuff ? dur : undefined,
    text: str(r['效果']),
  });
}

const characters: CharacterData[] = [];
for (const r of sheet('角色')) {
  const cls = str(r['職業']);
  if (!cls) continue;
  const name = str(r['角色名']);
  characters.push({
    id: name || `${cls}（待補）`,
    name: name || `${cls}（待補）`,
    cls: toClass(cls),
    hp: num(r['生命值']),
    expReq: num(r['經驗需求']),
    text: str(r['效果']),
    awakenText: str(r['覺醒效果']),
    pending: !name,
  });
}

// 資料檢查
const names = new Set<string>();
for (const c of cards) {
  if (names.has(c.id)) throw new Error(`卡名重複：${c.id}`);
  names.add(c.id);
  if (c.kind === 'move' && (c.combo < 1 || c.combo > 9)) throw new Error(`連擊值超出 1~9：${c.id}`);
}

mkdirSync(outDir, { recursive: true });
writeFileSync(resolve(outDir, 'cards.json'), JSON.stringify(cards, null, 2) + '\n');
writeFileSync(resolve(outDir, 'characters.json'), JSON.stringify(characters, null, 2) + '\n');

const count = (k: string) => cards.filter((c) => c.kind === k).length;
console.log(`卡片 ${cards.length} 張（招式 ${count('move')}、裝備 ${count('equip')}、增益 ${count('buff')}）`);
console.log(`角色 ${characters.length} 位（待補 ${characters.filter((c) => c.pending).length}）`);
