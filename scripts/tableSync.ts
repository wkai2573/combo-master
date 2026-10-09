/**
 * 卡表同步的核心：把「連擊大師卡表」各集合的文件，轉成 src/data/cardTable.json 的內容。
 * 純函式，不讀寫檔案；scripts/sync-card-table.ts 負責讀檔與寫檔。
 */
import { EX_LEAVE_RULE, EX_PREFIX } from '../src/data/exCards';
import type { CardData, CharacterData } from '../src/data/types';

export type Doc = Record<string, any>;

/** 卡表資料庫各集合的文件 */
export interface TableDocs {
  cards: Doc[];
  chars: Doc[];
  keywords: Doc[];
  /** Ex 卡區域；沒有這個集合的舊資料視為空 */
  exCards?: Doc[];
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
  exCards: CardData[];
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
  for (const d of docs.exCards ?? []) addUid(d.uid, d.base?.name ?? d.name, `Ex 卡【${d.name}】`);
  const uidKey = (u: string) => u.charCodeAt(0) * 100000 + Number(u.slice(1));
  const sortedUids = Object.fromEntries(Object.entries(uids).sort((x, y) => uidKey(x[0]) - uidKey(y[0])));

  const keywords = [...docs.keywords]
    .sort(byOrder)
    .map((d) => ({ name: d.name as string, group: d.cls as string, desc: d.desc as string }));
  for (const d of docs.keywords) if (d.textPending) notes.push(`關鍵字說明待確認用語：${d.name}`);

  const exCards = buildExCards(docs, base, notes);

  return { table: { overrides, chars, added, keywords, exCards, uids: sortedUids }, notes };
}

/** 卡文裡引用的 Ex 卡：[Ex-卡名]，包含單獨一行的 [Ex-卡名]： 標題 */
const EX_REF = /\[(Ex-[^\]]+)\]/g;

/**
 * Ex 卡區域轉成遊戲資料。Ex 卡只有卡名、特徵、效果；內部 id 與卡牌一樣固定為新增時的卡名（base.name）。
 * 卡名不以 Ex- 開頭、卡文引用不存在的 Ex 卡，直接報錯；缺「離開經驗區就移除遊戲」或沒有實作效果只提醒。
 */
function buildExCards(docs: TableDocs, base: TableBase, notes: string[]): CardData[] {
  const exDocs = [...(docs.exCards ?? [])].sort(byOrder);
  const out: CardData[] = [];
  for (const d of exDocs) {
    const id: string = d.base?.name ?? d.name;
    if (!String(d.name).startsWith(EX_PREFIX)) throw new Error(`Ex 卡的卡名要以 ${EX_PREFIX} 開頭：${d.name}`);
    if (id !== d.name) notes.push(`Ex 卡名已改：【${id}】顯示為【${d.name}】（內部 id 不變）`);
    const text: string = d.text ?? '';
    if (!text.includes(EX_LEAVE_RULE)) notes.push(`Ex 卡缺少「${EX_LEAVE_RULE}」：${d.name}`);
    if (!base.hasEffect(id)) notes.push(`Ex 卡尚未實作效果：${d.name}`);
    out.push({ id, name: d.name, kind: 'move', cls: '共用', traits: d.traits ?? [], atk: 0, def: 0, combo: 0, expReq: 0, text });
  }
  // 引用檢查：所有卡、角色、Ex 卡的文字提到的 [Ex-卡名] 都要有對應的 Ex 卡
  const known = new Set(out.map((c) => c.name));
  const texts: [string, string][] = [
    ...docs.cards.map((d): [string, string] => [d.name, d.text ?? '']),
    ...docs.chars.map((d): [string, string] => [d.name, `${d.text ?? ''}\n${d.awakenText ?? ''}`]),
    ...out.map((c): [string, string] => [c.name, c.text]),
  ];
  for (const [owner, text] of texts) {
    for (const m of text.matchAll(EX_REF)) {
      if (!known.has(m[1])) throw new Error(`【${owner}】引用了不存在的 Ex 卡：[${m[1]}]`);
    }
  }
  return out;
}
