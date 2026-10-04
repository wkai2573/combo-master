/**
 * 把「連擊大師卡表」網頁（Artifact）裡的數值同步回遊戲：
 *   npm run table -- <資料夾>
 * 資料夾放 Claude 用 ArtifactData 讀出的 cards/、chars/ 兩個子資料夾（每張卡一個 JSON）。
 * 輸出 src/data/cardTable.json：
 *   overrides  既有卡（xlsx）被改過的數值（攻、守、連擊、經驗需求、持續回合）
 *   chars      角色被改過的生命值、覺醒經驗
 *   added      表上新增的卡
 * 文字（效果描述）不在這裡套用：新描述要先由 Claude 跟你確認用語，再寫進程式。
 */
import { readdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import baseCards from '../src/data/generated/cards.json';
import baseChars from '../src/data/generated/characters.json';
import type { CardData, CharacterData } from '../src/data/types';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const out = resolve(root, 'src', 'data', 'cardTable.json');
const dir = process.argv[2];
if (!dir) throw new Error('用法：npm run table -- <資料夾>');

function readDocs(sub: string): Record<string, any>[] {
  const p = resolve(dir, sub);
  if (!existsSync(p)) return [];
  return readdirSync(p).filter((f) => f.endsWith('.json')).map((f) => JSON.parse(readFileSync(resolve(p, f), 'utf8')));
}

const NUM_KEYS = ['atk', 'def', 'combo', 'expReq', 'duration'] as const;
const byName = new Map((baseCards as CardData[]).map((c) => [c.name, c]));
const overrides: Record<string, Partial<CardData>> = {};
const added: CardData[] = [];
const notes: string[] = [];

for (const d of readDocs('cards').sort((a, b) => a.order - b.order)) {
  const base = byName.get(d.name);
  if (base) {
    const o: Record<string, number> = {};
    for (const k of NUM_KEYS) if (d[k] !== undefined && d[k] !== (base as any)[k]) o[k] = d[k];
    if (Object.keys(o).length) overrides[d.name] = o;
    if (d.text !== base.text) notes.push(`文字不同（未套用，待確認用語）：${d.name}`);
  } else {
    const c: CardData = {
      id: d.name, name: d.name, kind: d.kind, cls: d.cls, traits: d.traits ?? [],
      atk: d.atk ?? 0, def: d.def ?? 0, combo: d.combo ?? 0, expReq: d.expReq ?? 0, text: d.text ?? '',
    };
    if (d.slot) c.slot = d.slot;
    if (d.duration !== undefined) c.duration = d.duration;
    added.push(c);
    if (c.text) notes.push(`新卡有效果文字，需先確認用語並實作效果：${c.name}`);
  }
}

const chars: Record<string, { hp?: number; expReq?: number }> = {};
const charBase = new Map((baseChars as CharacterData[]).map((c) => [c.name, c]));
for (const d of readDocs('chars')) {
  const b = charBase.get(d.name);
  if (!b) continue;
  const o: { hp?: number; expReq?: number } = {};
  if (d.hp !== b.hp) o.hp = d.hp;
  if (d.expReq !== b.expReq) o.expReq = d.expReq;
  if (Object.keys(o).length) chars[d.name] = o;
}

writeFileSync(out, JSON.stringify({ overrides, chars, added }, null, 2) + '\n');
console.log(`已寫入 ${out}：既有卡改動 ${Object.keys(overrides).length} 張、角色改動 ${Object.keys(chars).length} 位、新增 ${added.length} 張`);
for (const n of notes) console.log('注意：' + n);
