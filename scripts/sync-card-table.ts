/**
 * 把「連擊大師卡表」網頁（Artifact）裡的數值同步回遊戲：
 *   npm run table -- <資料夾>
 * 資料夾放 Claude 用 ArtifactData 讀出的 cards/、chars/ 兩個子資料夾（每張卡一個 JSON）。
 * 輸出 src/data/cardTable.json：
 *   overrides  既有卡（xlsx）被改過的數值（攻、守、連擊、經驗需求、持續回合）、卡名、類型、部位、職業與特徵
 *              以 id（改名前的卡名）為鍵；改名只改畫面上的卡名，id 不變
 *   chars      角色被改過的名稱、職業、生命值、覺醒經驗（同樣以 id 為鍵）
 *   added      表上新增的卡（卡表上標「新」的卡；若與 xlsx 的卡同名，就整張取代那張卡）
 *   keywords   關鍵字區塊（名稱、分類、說明）；卡上用【名稱】或 [標籤] 引用，遊戲裡滑過就顯示說明
 *   uids       卡表給每張卡、每位角色、每個關鍵字的永久編號（招式 A、裝備 E、增益 B、角色 C、關鍵字 K）→ 內部 id；
 *              只給人與文件指稱用，遊戲引擎仍以 id 為鍵，不讀它
 * 文字（效果描述）不在這裡套用：新描述要先由 Claude 跟你確認用語，再寫進程式。
 */
import { readdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import baseCards from '../src/data/generated/cards.json';
import baseChars from '../src/data/generated/characters.json';
import { scripts } from '../src/engine/scripts';
import type { CardData, CharacterData } from '../src/data/types';

const implemented = scripts as Record<string, unknown>;

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
  // 卡名可以在卡表上改。遊戲內部的 id（程式、啟用清單、牌組都靠它）固定用改名前的名字（base.name），畫面顯示 d.name
  const id: string = d.base?.name ?? d.name;
  const base = d.custom ? undefined : byName.get(id);
  if (id !== d.name) notes.push(`卡名已改：【${id}】顯示為【${d.name}】（內部 id 不變）`);
  if (base) {
    const o: Record<string, unknown> = {};
    for (const k of NUM_KEYS) if (d[k] != null && d[k] !== (base as any)[k]) o[k] = d[k];
    if (d.name !== base.name) o.name = d.name;
    if (d.cls && d.cls !== base.cls) o.cls = d.cls;
    if (d.traits && JSON.stringify(d.traits) !== JSON.stringify(base.traits)) {
      o.traits = d.traits;
      notes.push(`特徵已改：${id}（${base.traits.join('、') || '無'} → ${d.traits.join('、') || '無'}），有特徵就不再算白板卡`);
    }
    if (d.kind !== undefined && d.kind !== base.kind) {
      o.kind = d.kind;
      if (d.kind !== 'move') Object.assign(o, { atk: 0, def: 0, combo: 0 });
      notes.push(`類型已改：${id}（${base.kind} → ${d.kind}），確認引擎與效果是否要跟著調整`);
    }
    if (d.slot && d.slot !== base.slot) o.slot = d.slot;
    if (Object.keys(o).length) overrides[id] = o;
    if (d.text !== base.text) notes.push(`文字不同（未套用，待確認用語）：${d.name}`);
  } else {
    // 非招式（裝備、增益）沒有攻、守、連擊；類型從招式改過來時，舊的數字不帶進遊戲
    const mv = d.kind === 'move';
    const c: CardData = {
      id, name: d.name, kind: d.kind, cls: d.cls, traits: d.traits ?? [],
      atk: mv ? d.atk ?? 0 : 0, def: mv ? d.def ?? 0 : 0, combo: mv ? d.combo ?? 0 : 0, expReq: d.expReq ?? 0, text: d.text ?? '',
    };
    if (d.kind === 'equip' && d.slot) c.slot = d.slot;
    if (d.kind === 'buff' && d.duration != null) c.duration = d.duration;
    added.push(c);
    if (c.text && !(c.id in implemented)) notes.push(`新卡有效果文字，需先確認用語並實作效果：${c.name}`);
  }
}

// 角色也一樣：id（程式裡的 charId）固定為改名前的名字，只改畫面顯示的名稱
const chars: Record<string, { name?: string; cls?: string; hp?: number; expReq?: number }> = {};
const charBase = new Map((baseChars as CharacterData[]).map((c) => [c.name, c]));
for (const d of readDocs('chars')) {
  const id: string = d.base?.name ?? d.name;
  const b = charBase.get(id);
  if (!b) continue;
  const o: { name?: string; cls?: string; hp?: number; expReq?: number } = {};
  if (d.name !== b.name) {
    o.name = d.name;
    notes.push(`角色名稱已改：【${id}】顯示為【${d.name}】（內部 id 不變）`);
  }
  if (d.cls && d.cls !== b.cls) {
    o.cls = d.cls;
    notes.push(`角色職業已改：${id}（${b.cls} → ${d.cls}），能用的專用卡會跟著變，確認預設牌組`);
  }
  if (d.hp !== b.hp) o.hp = d.hp;
  if (d.expReq !== b.expReq) o.expReq = d.expReq;
  if (Object.keys(o).length) chars[id] = o;
}

// 永久編號：編號 → 內部 id（卡與角色用改名前的名字，關鍵字用名稱）。缺編號只提醒，重複編號直接擋下
const uids: Record<string, string> = {};
function addUid(uid: unknown, id: string, label: string) {
  if (typeof uid !== 'string' || !/^[A-Z]\d+$/.test(uid)) { notes.push(`缺少編號：${label}`); return; }
  if (uid in uids) throw new Error(`編號重複：${uid}（${uids[uid]}、${id}）`);
  uids[uid] = id;
}
for (const d of readDocs('cards')) addUid(d.uid, d.base?.name ?? d.name, `卡片【${d.name}】`);
for (const d of readDocs('chars')) addUid(d.uid, d.base?.name ?? d.name, `角色【${d.name}】`);
for (const d of readDocs('keywords')) addUid(d.uid, d.name, `關鍵字【${d.name}】`);
const uidKey = (u: string) => u.charCodeAt(0) * 100000 + Number(u.slice(1));
const sortedUids = Object.fromEntries(Object.entries(uids).sort((x, y) => uidKey(x[0]) - uidKey(y[0])));

const keywords = readDocs('keywords')
  .sort((a, b) => a.order - b.order)
  .map((d) => ({ name: d.name as string, group: d.cls as string, desc: d.desc as string }));
for (const d of readDocs('keywords')) if (d.textPending) notes.push(`關鍵字說明待確認用語：${d.name}`);

writeFileSync(out, JSON.stringify({ overrides, chars, added, keywords, uids: sortedUids }, null, 2) + '\n');
console.log(`已寫入 ${out}：既有卡改動 ${Object.keys(overrides).length} 張、角色改動 ${Object.keys(chars).length} 位、新增 ${added.length} 張、關鍵字 ${keywords.length} 個、編號 ${Object.keys(uids).length} 個`);
for (const n of notes) console.log('注意：' + n);
