import * as XLSX from 'xlsx';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { characterFill } from '../src/data/characterFill';
import type { CardData, CharacterData, ClassName } from '../src/data/types';

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

// xlsx 的「招式_效果」「裝備／增益」兩張工作表是舊的效果卡，已經不用：效果卡全部改由卡表網頁維護（cardTable.json）。
// 這裡只匯入 36 張花色招式與角色。

const characters: CharacterData[] = [];
for (const r of sheet('角色')) {
  const cls = str(r['職業']);
  if (!cls) continue;
  const name = str(r['角色名']);
  if (name) {
    characters.push({
      id: name, name, cls: toClass(cls), hp: num(r['生命值']), expReq: num(r['經驗需求']),
      text: str(r['效果']), awakenText: str(r['覺醒效果']), pending: false,
    });
    continue;
  }
  // xlsx 該列是空的：有補資料就用補的，否則標為待補
  const fill = characterFill[toClass(cls)];
  characters.push(
    fill
      ? { id: fill.name, name: fill.name, cls: toClass(cls), hp: fill.hp, expReq: fill.expReq, text: fill.text, awakenText: fill.awakenText, pending: false }
      : { id: `${cls}（待補）`, name: `${cls}（待補）`, cls: toClass(cls), hp: 0, expReq: 0, text: '', awakenText: '', pending: true },
  );
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

console.log(`花色招式 ${cards.length} 張`);
console.log(`角色 ${characters.length} 位（待補 ${characters.filter((c) => c.pending).length}）`);
