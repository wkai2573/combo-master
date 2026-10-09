/**
 * 把「連擊大師卡表」網頁（Artifact）裡的數值同步回遊戲：
 *   npm run table -- <資料夾>
 * 資料夾放 Claude 用 ArtifactData 讀出的 cards/、chars/、keywords/ 子資料夾（每筆資料一個 JSON）。
 * 輸出 src/data/cardTable.json：
 *   overrides  既有卡（xlsx）被改過的數值（攻、守、連擊、經驗需求、持續回合）、卡名、類型、部位、職業與特徵
 *              以 id（改名前的卡名）為鍵；改名只改畫面上的卡名，id 不變
 *   chars      角色被改過的名稱、職業、生命值、覺醒經驗（同樣以 id 為鍵）
 *   added      表上新增的卡（卡表上標「新」的卡；若與 xlsx 的卡同名，就整張取代那張卡）
 *   keywords   關鍵字區塊（名稱、分類、說明）；卡上用【名稱】或 [標籤] 引用，遊戲裡滑過就顯示說明
 *   uids       卡表給每張卡、每位角色、每個關鍵字的永久編號（招式 A、裝備 E、增益 B、角色 C、關鍵字 K）→ 內部 id；
 *              只給人與文件指稱用，遊戲引擎仍以 id 為鍵，不讀它
 * 文字（效果描述）不在這裡套用：新描述要先由 Claude 跟你確認用語，再寫進程式。
 * 轉換的邏輯在 scripts/tableSync.ts（純函式，有測試），這裡只負責讀檔與寫檔。
 */
import { readdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import baseCards from '../src/data/generated/cards.json';
import baseChars from '../src/data/generated/characters.json';
import { hasEffect } from '../src/engine/effects';
import type { CardData, CharacterData } from '../src/data/types';
import { buildCardTable, type Doc } from './tableSync';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const out = resolve(root, 'src', 'data', 'cardTable.json');
const dir = process.argv[2];
if (!dir) throw new Error('用法：npm run table -- <資料夾>');

function readDocs(sub: string): Doc[] {
  const p = resolve(dir, sub);
  if (!existsSync(p)) return [];
  return readdirSync(p).filter((f) => f.endsWith('.json')).map((f) => JSON.parse(readFileSync(resolve(p, f), 'utf8')));
}

const { table, notes } = buildCardTable(
  { cards: readDocs('cards'), chars: readDocs('chars'), keywords: readDocs('keywords') },
  { cards: baseCards as CardData[], chars: baseChars as CharacterData[], hasEffect },
);

writeFileSync(out, JSON.stringify(table, null, 2) + '\n');
console.log(`已寫入 ${out}：既有卡改動 ${Object.keys(table.overrides).length} 張、角色改動 ${Object.keys(table.chars).length} 位、新增 ${table.added.length} 張、關鍵字 ${table.keywords.length} 個、編號 ${Object.keys(table.uids).length} 個`);
for (const n of notes) console.log('注意：' + n);
