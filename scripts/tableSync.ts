/**
 * 卡表同步的核心：把「連擊大師卡表」各集合的文件，轉成 src/data/cardTable.json 的內容。
 * 純函式，不讀寫檔案；scripts/sync-card-table.ts 負責讀檔與寫檔。
 */
import type { CardData, CharacterData } from '../src/data/types';

export type Doc = Record<string, any>;

/** 卡表資料庫各集合的文件 */
export interface TableDocs {
  cards: Doc[];
  chars: Doc[];
  keywords: Doc[];
}

/** 遊戲端的基準資料（xlsx 產生的卡與角色），以及「這張卡有沒有實作效果」的查詢 */
export interface TableBase {
  cards: CardData[];
  chars: CharacterData[];
  hasEffect: (id: string) => boolean;
}

export interface CardTableJson {
  overrides: Record<string, Partial<CardData>>;
  chars: Record<string, { name?: string; cls?: string; hp?: number; expReq?: number }>;
  added: CardData[];
  keywords: { name: string; group: string; desc: string }[];
  uids: Record<string, string>;
}

const NUM_KEYS = ['atk', 'def', 'combo', 'expReq', 'duration'] as const;
const byOrder = (a: Doc, b: Doc) => a.order - b.order;

export function buildCardTable(docs: TableDocs, base: TableBase): { table: CardTableJson; notes: string[] } {
  const byName = new Map(base.cards.map((c) => [c.name, c]));
  const overrides: Record<string, Partial<CardData>> = {};
  const added: CardData[] = [];
  const notes: string[] = [];

  for (const d of [...docs.cards].sort(byOrder)) {
    // 卡名可以在卡表上改。遊戲內部的 id（程式、啟用清單、牌組都靠它）固定用改名前的名字（base.name），畫面顯示 d.name
    const id: string = d.base?.name ?? d.name;
    const card = d.custom ? undefined : byName.get(id);
    if (id !== d.name) notes.push(`卡名已改：【${id}】顯示為【${d.name}】（內部 id 不變）`);
    if (card) {
      const o: Record<string, unknown> = {};
      for (const k of NUM_KEYS) if (d[k] != null && d[k] !== (card as any)[k]) o[k] = d[k];
      if (d.name !== card.name) o.name = d.name;
      if (d.cls && d.cls !== card.cls) o.cls = d.cls;
      if (d.traits && JSON.stringify(d.traits) !== JSON.stringify(card.traits)) {
        o.traits = d.traits;
        notes.push(`特徵已改：${id}（${card.traits.join('、') || '無'} → ${d.traits.join('、') || '無'}），有特徵就不再算白板卡`);
      }
      if (d.kind !== undefined && d.kind !== card.kind) {
        o.kind = d.kind;
        if (d.kind !== 'move') Object.assign(o, { atk: 0, def: 0, combo: 0 });
        notes.push(`類型已改：${id}（${card.kind} → ${d.kind}），確認引擎與效果是否要跟著調整`);
      }
      if (d.slot && d.slot !== card.slot) o.slot = d.slot;
      if (Object.keys(o).length) overrides[id] = o;
      if (d.text !== card.text) notes.push(`文字不同（未套用，待確認用語）：${d.name}`);
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
      if (c.text && !base.hasEffect(c.id)) notes.push(`新卡有效果文字，需先確認用語並實作效果：${c.name}`);
    }
  }

  // 角色也一樣：id（程式裡的 charId）固定為改名前的名字，只改畫面顯示的名稱
  const chars: CardTableJson['chars'] = {};
  const charBase = new Map(base.chars.map((c) => [c.name, c]));
  for (const d of docs.chars) {
    const id: string = d.base?.name ?? d.name;
    const b = charBase.get(id);
    if (!b) continue;
    const o: CardTableJson['chars'][string] = {};
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
  for (const d of docs.cards) addUid(d.uid, d.base?.name ?? d.name, `卡片【${d.name}】`);
  for (const d of docs.chars) addUid(d.uid, d.base?.name ?? d.name, `角色【${d.name}】`);
  for (const d of docs.keywords) addUid(d.uid, d.name, `關鍵字【${d.name}】`);
  const uidKey = (u: string) => u.charCodeAt(0) * 100000 + Number(u.slice(1));
  const sortedUids = Object.fromEntries(Object.entries(uids).sort((x, y) => uidKey(x[0]) - uidKey(y[0])));

  const keywords = [...docs.keywords]
    .sort(byOrder)
    .map((d) => ({ name: d.name as string, group: d.cls as string, desc: d.desc as string }));
  for (const d of docs.keywords) if (d.textPending) notes.push(`關鍵字說明待確認用語：${d.name}`);

  return { table: { overrides, chars, added, keywords, uids: sortedUids }, notes };
}
