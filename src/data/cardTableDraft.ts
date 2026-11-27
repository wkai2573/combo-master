import { characterDefaults, generatedCards, generatedCharacters, readTableCards, readTableCharacters, sortByOrder, type CardTableData, type UidPrefix } from './cardTableData';
import { isCardEnabled } from './enabledCards';
import { checkExLeaveRule, EX_LEAVE_RULES, isExCardId, type ExZone } from './exCards';
import type { Keyword } from './keywords';
import { TUTORIAL_CHARACTERS } from './tutorialCharacters';
import type { CardData, CardKind, CharacterData } from './types';

export const classes = ['共用', '劍士', '盜賊', '商人', '弓箭手', '法師'] as const;
export const kinds = { move: '招式', equip: '裝備', buff: '增益' } as const;
export const slots = ['武器', '防具', '飾品'] as const;
export const fieldLabels = {
  name: '卡名', kind: '類型', cls: '職業', traits: '特徵',
  atk: '攻擊力', def: '防禦力', combo: '連擊值', expReq: '經驗需求',
  slot: '部位', duration: '持續回合', text: '效果文字',
  hp: '生命值', awakenText: '覺醒效果', group: '分類', desc: '說明', order: '清單順序',
} as const;
export type Field = keyof typeof fieldLabels;
type Value = string | number | string[] | null;
export interface Edit { uid: string; field: Field; base: Value; value: Value }
export type Addition = { uid: string; card: CardData } | { uid: string; keyword: Keyword }
  | { uid: string; character: CharacterData };
export interface Deletion { uid: string; id: string }
export interface Draft { edits: Edit[]; additions: Addition[]; deletions: Deletion[] }
interface Diff extends Draft { formatVersion: 1; baseVersion: string }

export const emptyDraft = (): Draft => ({ edits: [], additions: [], deletions: [] });
export const equalValue = (a: Value, b: Value): boolean => JSON.stringify(a) === JSON.stringify(b);
type RecordData = CardData | ReturnType<typeof readTableCharacters>[number] | Keyword;
export const cardValue = (card: RecordData, field: Field): Value => (card as Partial<Record<Field, Value>>)[field] ?? null;
const prefixes = { move: 'A', equip: 'E', buff: 'B' } as const;
const cardUid = /^[AEB][1-9]\d*$/;
const uidPattern = /^[ABECKX][1-9]\d*$/;
export const cardFields = ['name', 'kind', 'cls', 'traits', 'atk', 'def', 'combo', 'expReq', 'slot', 'duration', 'text'] as const;
export const exFields = ['name', 'traits', 'atk', 'def', 'combo', 'text'] as const;
export const keywordFields = ['name', 'group', 'desc'] as const;
export const characterFields = ['name', 'cls', 'hp', 'expReq'] as const;
export const addedCharacterFields = [...characterFields, 'text', 'awakenText'] as const;
export const orderLists = { cards: '卡片', added: '新增卡', characters: '角色', exCards: 'Ex 卡', keywords: '關鍵字' } as const;
export type OrderList = keyof typeof orderLists;
const isOrderList = (uid: string): uid is OrderList => Object.hasOwn(orderLists, uid);
export function orderOf(table: CardTableData, list: OrderList): string[] {
  if (list === 'cards') return readTableCards(table).filter(({ id }) => !isExCardId(id)).map(({ id }) => id);
  if (list === 'characters') return readTableCharacters(table).map(({ id }) => id);
  return table[list].map((entry) => 'id' in entry ? entry.id : entry.name);
}
export { sortByOrder };

function proposedOrder(list: OrderList, base: string[], order: string[], draft: Draft): string[] {
  const prefixes = { cards: 'AEB', added: 'AEB', characters: 'C', keywords: 'K', exCards: 'X' };
  const deleted = new Set(draft.deletions.filter(({ uid }) => prefixes[list].includes(uid[0])).map(({ id }) => id));
  const added = draft.additions.flatMap((addition) => {
    if ('keyword' in addition) return list === 'keywords' ? [addition.keyword.name] : [];
    if ('character' in addition) return list === 'characters' ? [addition.character.id] : [];
    const included = isExCardId(addition.card.id) ? list === 'exCards' : list === 'cards' || list === 'added';
    return included ? [addition.card.id] : [];
  });
  return sortByOrder([...base.filter((id) => !deleted.has(id)), ...added], order, (id) => id);
}
const baseIds = new Set(generatedCards.map((card) => card.id));

export function nextCardUid(table: CardTableData, kind: CardKind, previous: string[]): string {
  return nextUid(table, prefixes[kind], previous);
}

export function nextUid(table: CardTableData, prefix: UidPrefix, previous: string[]): string {
  const latest = previous.reduce((max, uid) => uid.startsWith(prefix) ? Math.max(max, Number(uid.slice(1))) : max,
    table.uidSeq[prefix]);
  return prefix + (latest + 1);
}

function recordsByUid(table: CardTableData): Map<string, RecordData> {
  const records = new Map<string, RecordData>(readTableCards(table).map((card) => [(isExCardId(card.id) ? 'X:' : 'card:') + card.id, card]));
  for (const character of readTableCharacters(table)) records.set('C:' + character.id, character);
  for (const keyword of table.keywords) records.set('K:' + keyword.name, keyword);
  const indexed = new Map<string, RecordData>();
  for (const [uid, id] of Object.entries(table.uids)) {
    const record = records.get((cardUid.test(uid) ? 'card' : uid[0]) + ':' + id);
    if (record) indexed.set(uid, record);
  }
  return indexed;
}

export function realignDraft(table: CardTableData, draft: Draft): { draft: Draft; invalidated: Edit[] } {
  const records = recordsByUid(table);
  const invalidated: Edit[] = [];
  const edits = draft.edits.filter((edit) => {
    const record = records.get(edit.uid);
    const current = isOrderList(edit.uid) ? orderOf(table, edit.uid) : record && cardValue(record, edit.field);
    if (isOrderList(edit.uid) && Array.isArray(edit.base) && Array.isArray(edit.value)) {
      const proposed = proposedOrder(edit.uid, edit.base, edit.value, draft);
      const renamed = new Map<string, string>();
      if (edit.uid === 'keywords') {
        for (const { uid, field, base, value } of draft.edits) {
          if (uid.startsWith('K') && field === 'name' && records.get(uid)?.name === value) renamed.set(String(base), String(value));
        }
      }
      if (equalValue(current!, proposed.map((id) => renamed.get(id) ?? id))) return false;
    } else if (current !== undefined && equalValue(current, edit.value)) {
      return false;
    }
    if (current !== undefined && equalValue(current, edit.base)) return true;
    invalidated.push(edit);
    return false;
  });
  const addedById = new Map([...table.added, ...table.exCards].map((card) => [card.id, card]));
  const keywordNames = new Set(table.keywords.map(({ name }) => name));
  const charactersById = new Map((table.addedCharacters ?? []).map((character) => [character.id, character]));
  const additions = draft.additions.filter((addition) => {
    if ('keyword' in addition) return !keywordNames.has(addition.keyword.name);
    if ('character' in addition) {
      const current = charactersById.get(addition.character.id);
      return !current || addedCharacterFields.some((field) =>
        !equalValue(cardValue(current, field), cardValue(addition.character, field)));
    }
    const { card } = addition;
    const current = addedById.get(card.id);
    if (!current) return true;
    const ex = isExCardId(card.id);
    const proposed = ex ? card : applyFields(card, []);
    return (ex ? exFields : cardFields).some((field) => !equalValue(cardValue(current, field), cardValue(proposed, field)));
  });
  const deletions = draft.deletions.filter(({ uid }) => Object.hasOwn(table.uids, uid));
  return { draft: { edits, additions, deletions }, invalidated };
}

export function makeDiff(table: CardTableData, draft: Draft, baseVersion: string): Diff {
  const aligned = realignDraft(table, draft).draft;
  const deleted = new Set(aligned.deletions.map(({ uid }) => uid));
  return {
    formatVersion: 1,
    baseVersion,
    ...aligned,
    edits: aligned.edits.filter(({ uid, base, value }) => !deleted.has(uid) && !equalValue(base, value)),
  };
}

const inRange = (value: unknown, min = 0, max = 99) =>
  typeof value === 'number' && Number.isInteger(value) && value >= min && value <= max;
const nameIsValid = (value: unknown): value is string =>
  typeof value === 'string' && value.length <= 100 && value.trim() === value && value.length > 0 && !isExCardId(value);
const exNameIsValid = (value: unknown): value is string =>
  typeof value === 'string' && isExCardId(value) && nameIsValid(value.slice(3)) && value.length <= 100 && !value.includes(']');
const fieldValidators: Record<Field, (value: unknown) => boolean> = {
  name: (v) => nameIsValid(v) || exNameIsValid(v),
  kind: (v) => typeof v === 'string' && Object.hasOwn(kinds, v),
  cls: (v) => classes.some((cls) => cls === v),
  traits: (v) => Array.isArray(v) && v.length <= 30 && v.every((t) => typeof t === 'string' && t.trim().length > 0 && t.length <= 100),
  atk: (v) => inRange(v), def: (v) => inRange(v), combo: (v) => inRange(v, 0, 9), expReq: (v) => inRange(v),
  slot: (v) => v === null || slots.some((slot) => slot === v),
  duration: (v) => v === null || inRange(v, 0),
  text: (v) => typeof v === 'string' && v.length <= 10000,
  awakenText: (v) => typeof v === 'string' && v.length <= 10000,
  hp: (v) => inRange(v, 0),
  group: nameIsValid,
  desc: (v) => typeof v === 'string' && v.length <= 10000,
  order: (v) => Array.isArray(v) && new Set(v).size === v.length && v.every((id) => nameIsValid(id) || exNameIsValid(id)),
};
export const isFieldValue = (field: Field, value: unknown, prefix = ''): value is Value =>
  field === 'name' && prefix !== 'K' ? (prefix === 'X' ? exNameIsValid(value) : nameIsValid(value)) : fieldValidators[field](value);

function objectWithKeys(value: unknown, keys: string[]): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    && Object.keys(value).every((key) => keys.includes(key));
}

function validUid(value: unknown): value is string {
  return typeof value === 'string' && uidPattern.test(value) && Number.isSafeInteger(Number(value.slice(1)))
    && Number(value.slice(1)) < Number.MAX_SAFE_INTEGER;
}

function editableFields(uid: string): readonly Field[] {
  if (isOrderList(uid)) return ['order'];
  switch (uid[0]) {
    case 'C': return addedCharacterFields;
    case 'K': return keywordFields;
    case 'X': return exFields;
    default: return cardFields;
  }
}

export function parseDiff(input: unknown): Diff {
  if (!objectWithKeys(input, ['formatVersion', 'baseVersion', 'edits', 'additions', 'deletions'])
    || input.formatVersion !== 1 || typeof input.baseVersion !== 'string' || !input.baseVersion.trim()
    || !Array.isArray(input.edits) || !Array.isArray(input.additions) || !Array.isArray(input.deletions)) {
    throw new Error('差異檔格式或版本不符');
  }
  const edited = new Set<string>();
  const editedUids = new Set<string>();
  for (const edit of input.edits) {
    if (!objectWithKeys(edit, ['uid', 'field', 'base', 'value'])
      || !(validUid(edit.uid) || typeof edit.uid === 'string' && isOrderList(edit.uid))
      || !editableFields(edit.uid).includes(edit.field as Field)
      || !isFieldValue(edit.field as Field, edit.base, edit.uid[0])
      || !isFieldValue(edit.field as Field, edit.value, edit.uid[0])) {
      throw new Error('欄位改動格式不符、欄位不明或數值超出範圍（Ex 卡名稱須以 Ex- 開頭）');
    }
    const key = edit.uid + ':' + edit.field;
    if (edited.has(key)) throw new Error(`欄位改動重複：${key}`);
    edited.add(key);
    editedUids.add(edit.uid);
  }
  const added = new Set<string>();
  for (const addition of input.additions) {
    if (!objectWithKeys(addition, ['uid', 'card', 'keyword', 'character']) || !validUid(addition.uid)) {
      throw new Error('新增卡格式不符');
    }
    const prefix = addition.uid[0];
    const card = addition.card;
    const keyword = addition.keyword;
    const character = addition.character;
    if (prefix === 'C') {
      if (card !== undefined || keyword !== undefined
        || !objectWithKeys(character, ['id', 'pending', ...addedCharacterFields])
        || !isFieldValue('name', character.id, prefix) || character.pending !== true
        || !addedCharacterFields.every((field) => isFieldValue(field, character[field], prefix))) {
        throw new Error('新增角色格式不符、欄位不明或數值超出範圍');
      }
    } else if (character !== undefined) {
      throw new Error('新增角色須使用角色編號');
    } else if (prefix === 'K') {
      if (card !== undefined || !objectWithKeys(keyword, [...keywordFields])
        || !keywordFields.every((field) => isFieldValue(field, keyword[field], prefix))) throw new Error('新增關鍵字格式不符');
    } else if (keyword !== undefined || !objectWithKeys(card, ['id', ...cardFields]) || !isFieldValue('name', card.id, prefix)
      || !cardFields.every((field) => isFieldValue(field, field === 'slot' || field === 'duration'
        ? card[field] ?? null : card[field], prefix))) {
      throw new Error('新增卡格式不符、欄位不明或數值超出範圍（Ex 卡名稱須以 Ex- 開頭）');
    }
    if (added.has(addition.uid)) throw new Error(`編號重複：${addition.uid}`);
    added.add(addition.uid);
  }
  const deleted = new Set<string>();
  for (const deletion of input.deletions) {
    if (!objectWithKeys(deletion, ['uid', 'id']) || !validUid(deletion.uid)
      || !isFieldValue('name', deletion.id, deletion.uid[0])) {
      throw new Error('刪除標記格式不符');
    }
    if (deleted.has(deletion.uid) || editedUids.has(deletion.uid)) throw new Error(`編號重複：${deletion.uid}`);
    deleted.add(deletion.uid);
  }
  return input as unknown as Diff;
}

function applyFields(card: CardData, edits: Edit[]): CardData {
  const result = { ...card, ...Object.fromEntries(edits.map(({ field, value }) => [field, value ?? undefined])) };
  if (result.kind !== 'move') Object.assign(result, { atk: 0, def: 0, combo: 0 });
  if (result.slot == null || result.kind !== 'equip') delete result.slot;
  if (result.duration == null || result.kind !== 'buff') delete result.duration;
  return result;
}

export const previewCard = applyFields;

/** 新增招式必須有特徵或效果文字，才能與基準白板卡區分（Ex 卡不受限）。匯入端與卡表頁共用。 */
export const isBlankMove = (card: CardData): boolean =>
  card.kind === 'move' && !isExCardId(card.id) && !card.traits.length && !card.text;
export const blankMoveMessage = (name: string): string =>
  `新增招式需要特徵或效果文字，才能與 36 張基準白板卡區分：${name}`;
export const blankMoveAdditions = (additions: Addition[]): { uid: string; card: CardData }[] =>
  additions.filter((addition): addition is { uid: string; card: CardData } => 'card' in addition && isBlankMove(addition.card));

function checkCard(card: CardData) {
  if (card.kind === 'move' && !inRange(card.combo, 1, 9)) {
    throw new Error(`招式連擊值必須介於 1～9：${card.name}`);
  }
  if (card.kind === 'equip' && !card.slot) {
    throw new Error(`裝備必須指定部位：${card.name}`);
  }
}

function checkReferences(table: CardTableData, extraTexts: string[]) {
  const exNames = new Set(table.exCards.map((card) => card.name));
  const texts = [
    ...readTableCards(table).map(({ name, text }) => ({ name, text })),
    ...readTableCharacters(table).map(({ name, text, awakenText }) => ({ name, text: text + '\n' + awakenText })),
    ...extraTexts.map((text) => ({ name: '角色', text })),
  ];
  const missing = new Set<string>();
  for (const { name: owner, text } of texts) {
    for (const [, name] of text.matchAll(/\[(Ex-[^\]]+)\]/g)) {
      if (!exNames.has(name)) missing.add(`【${owner}】引用了不存在的 Ex 卡：[${name}]`);
    }
  }
  if (missing.size) throw new Error([...missing].join('\n'));
}

function prepareEx(card: CardData, notes: string[], options: ImportOptions): CardData {
  const { id, name, traits, text, atk = 0, def = 0, combo = 0 } = card;
  const leave = checkExLeaveRule(text, options.exZone?.(id));
  if (leave) throw new Error(`Ex 卡${leave}：${name}`);
  if (!options.hasEffect?.(id)) notes.push(`Ex 卡尚未實作效果：${name}`);
  const result: CardData = { id, name, traits, text, kind: 'move', cls: '共用', atk, def, combo, expReq: 0 };
  const duration = /持續回合：(\d+)/.exec(text)?.[1];
  if (duration) {
    const turns = Number(duration);
    if (!Number.isSafeInteger(turns) || turns < 1) throw new Error(`Ex 卡持續回合不符：${name}`);
    result.duration = turns;
  }
  else if (text.includes(EX_LEAVE_RULES.buff)) notes.push(`Ex 卡缺少「持續回合：N。」，不會到期：${name}`);
  return result;
}

type ImportOptions = {
  hasEffect?: (id: string) => boolean;
  exZone?: (id: string) => ExZone | undefined;
  characterTexts?: string[];
};

export function applyDiff(
  baseline: CardTableData,
  input: unknown,
  options: ImportOptions = {},
): { table: CardTableData; notes: string[] } {
  const diff = parseDiff(input);
  const table = structuredClone(baseline);
  const records = recordsByUid(baseline);
  const notes: string[] = [];
  const editsByUid = new Map<string, Edit[]>();
  const orders = new Map<OrderList, string[]>();
  const keywordRenames = new Map<string, string>();
  for (const edit of diff.edits) {
    const { uid, field, base, value } = edit;
    if (isOrderList(uid)) {
      if (equalValue(orderOf(baseline, uid), base)) orders.set(uid, value as string[]);
      else if (!equalValue(orderOf(baseline, uid), value)) notes.push(`排序衝突（未套用）：${orderLists[uid]}`);
      continue;
    }
    const card = records.get(uid);
    const label = `${uid} ${card?.name ?? ''} ${fieldLabels[field]}`;
    if (!card || !equalValue(cardValue(card, field), base)) {
      notes.push(`欄位衝突（未套用）：${label}`);
      continue;
    }
    if (equalValue(base, value)) continue;
    if (field === 'text' && 'id' in card && baseIds.has(card.id)) {
      notes.push(`文字不同（未套用，待確認用語）：${label} → ${value}`);
      continue;
    }
    const edits = editsByUid.get(uid) ?? [];
    edits.push(edit);
    editsByUid.set(uid, edits);
  }

  for (const [uid, edits] of editsByUid) {
    const before = records.get(uid)!;
    const changed = Object.fromEntries(edits.map(({ field, value }) => [field, value]));
    if ('hp' in before) {
      const addedIndex = (table.addedCharacters ?? []).findIndex(({ id }) => id === before.id);
      if (addedIndex >= 0) {
        table.addedCharacters![addedIndex] = { ...table.addedCharacters![addedIndex], ...changed };
        if (changed.text !== undefined || changed.awakenText !== undefined) notes.push(`請確認角色效果的程式實作：${uid} ${before.name}`);
        continue;
      }
      const original = characterDefaults(generatedCharacters.find(({ id }) => id === before.id)!);
      const override = { ...table.chars[before.id] };
      for (const { field, value } of edits) {
        if (equalValue(cardValue(original, field), value)) delete override[field as keyof typeof override];
        else Object.assign(override, { [field]: value });
      }
      if (Object.keys(override).length) table.chars[before.id] = override;
      else delete table.chars[before.id];
      if (changed.name !== undefined) notes.push(`角色名稱已改：${uid} ${before.name} → ${changed.name}（內部 id 不變）`);
      if (changed.cls !== undefined) notes.push(`角色職業已改：${uid} ${before.cls} → ${changed.cls}，可用的專用卡會改變`);
      continue;
    }
    if (!('id' in before)) {
      const keyword = { ...before, ...changed };
      table.keywords[baseline.keywords.indexOf(before)] = keyword;
      table.uids[uid] = keyword.name;
      if (keyword.name !== before.name) keywordRenames.set(before.name, keyword.name);
      if (changed.desc !== undefined) notes.push(`關鍵字說明待確認用語：${uid} ${keyword.name}`);
      continue;
    }
    if (uid.startsWith('X')) {
      const after = prepareEx({ ...before, ...changed }, notes, options);
      table.exCards[table.exCards.findIndex(({ id }) => id === before.id)] = after;
      if (after.name !== before.name) notes.push(`Ex 卡名已改：${uid} ${before.name} → ${after.name}（內部 id 不變）`);
      continue;
    }
    const after = applyFields(before, edits);
    checkCard(after);
    if (before.name !== after.name) notes.push(`卡名已改：${uid}【${before.name}】→【${after.name}】（內部 id 不變）`);
    if (before.kind !== after.kind) notes.push(`類型已改：${uid} ${kinds[before.kind]} → ${kinds[after.kind]}，請確認攻守連擊與引擎效果`);
    if (!equalValue(before.traits, after.traits)) notes.push(`特徵已改：${uid}，請確認白板卡資格`);
    const addedIndex = table.added.findIndex((card) => card.id === before.id);
    if (addedIndex >= 0) {
      table.added[addedIndex] = after;
      if (before.text !== after.text) {
        if (after.text && !options.hasEffect?.(after.id)) {
          after.textPending = true;
          notes.push(`待確認用語並實作效果：${uid} ${after.name}`);
        } else {
          delete after.textPending;
        }
      }
    } else {
      const override = { ...table.overrides[before.id] };
      const original = generatedCards.find((card) => card.id === before.id)!;
      for (const field of cardFields) {
        const value = cardValue(after, field);
        if (equalValue(value, cardValue(before, field))) continue;
        if (equalValue(value, cardValue(original, field))) delete override[field];
        else Object.assign(override, { [field]: value });
      }
      if (Object.keys(override).length) table.overrides[before.id] = override;
      else delete table.overrides[before.id];
    }
  }

  for (const { uid, id } of diff.deletions) {
    const record = records.get(uid);
    if (!record || ('id' in record ? record.id : record.name) !== id) {
      notes.push(`刪除衝突（未套用）：${uid} ${id}`);
      continue;
    }
    if (!('id' in record)) table.keywords = table.keywords.filter(({ name }) => name !== id);
    else if ('hp' in record) {
      (table.removedCharacters ??= []).push(record);
      if (table.addedCharacters) table.addedCharacters = table.addedCharacters.filter((entry) => entry.id !== id);
      delete table.chars[id];
    } else if (uid.startsWith('X')) table.exCards = table.exCards.filter((entry) => entry.id !== id);
    else {
      if (baseIds.has(id) || isCardEnabled(record)) (table.removedCards ??= []).push(record);
      table.added = table.added.filter((entry) => entry.id !== id);
      delete table.overrides[id];
    }
    delete table.uids[uid];
  }

  // 保留本檔可直接使用的暫領號，避免先處理的撞號卡佔掉後續卡的號碼。
  const reserved = new Set<string>();
  const lastReserved = { ...baseline.uidSeq };
  for (const { uid } of diff.additions) {
    const prefix = uid[0] as UidPrefix;
    const number = Number(uid.slice(1));
    if (number > baseline.uidSeq[prefix] && !Object.hasOwn(baseline.uids, uid)) {
      reserved.add(uid);
      lastReserved[prefix] = Math.max(lastReserved[prefix], number);
    }
  }
  const existingIds = new Set([...readTableCards(baseline), ...(baseline.removedCards ?? [])].map(({ id }) => id));
  const characterIds = new Set([...readTableCharacters(baseline), ...(baseline.removedCharacters ?? []), ...TUTORIAL_CHARACTERS].map(({ id }) => id));
  for (const addition of diff.additions) {
    const { uid } = addition;
    const prefix = uid[0] as UidPrefix;
    const assigned = reserved.has(uid) ? uid : prefix + (Math.max(table.uidSeq[prefix], lastReserved[prefix]) + 1);
    if (!validUid(assigned)) throw new Error(`已超過可用編號範圍：${assigned}`);
    table.uidSeq[prefix] = Math.max(table.uidSeq[prefix], Number(assigned.slice(1)));
    const name = 'keyword' in addition ? addition.keyword.name
      : 'character' in addition ? addition.character.name : addition.card.name;
    if (assigned !== uid) notes.push(`暫領編號重新分配：${uid} → ${assigned}（${name}）`);
    if ('keyword' in addition) {
      table.uids[assigned] = name;
      table.keywords.push({ ...addition.keyword });
      if (addition.keyword.desc) notes.push(`關鍵字說明待確認用語：${assigned} ${name}`);
      continue;
    }
    if ('character' in addition) {
      const { character } = addition;
      if (characterIds.has(character.id)) throw new Error(`角色 id 重複：${character.id}`);
      characterIds.add(character.id);
      table.uids[assigned] = character.id;
      (table.addedCharacters ??= []).push({ ...character });
      notes.push(`新角色暫不可選用，請確認角色效果的程式實作：${assigned} ${name}`);
      continue;
    }
    const { card } = addition;
    if (existingIds.has(card.id)) throw new Error(`內部 id 重複：${card.id}`);
    existingIds.add(card.id);
    table.uids[assigned] = card.id;
    if (prefix === 'X') {
      table.exCards.push(prepareEx(card, notes, options));
      if (card.id !== name) notes.push(`Ex 卡名已改：${assigned} ${card.id} → ${name}（內部 id 不變）`);
      continue;
    }
    const added = applyFields(card, []);
    checkCard(added);
    if (isBlankMove(added)) throw new Error(blankMoveMessage(added.name));
    if (added.text && !options.hasEffect?.(added.id)) {
      added.textPending = true;
      notes.push(`待確認用語並實作效果：${assigned} ${added.name}`);
    }
    table.added.push(added);
  }

  for (const list of ['exCards', 'keywords'] as const) {
    const names = new Set<string>();
    for (const { name } of table[list]) {
      if (names.has(name)) throw new Error(`${orderLists[list]}名稱重複：${name}`);
      names.add(name);
    }
  }
  const addedOrder = orders.get('added');
  const exOrder = orders.get('exCards');
  const keywordOrder = orders.get('keywords');
  if (addedOrder) table.added = sortByOrder(table.added, addedOrder, ({ id }) => id);
  if (exOrder) table.exCards = sortByOrder(table.exCards, exOrder, ({ id }) => id);
  if (keywordOrder) table.keywords = sortByOrder(table.keywords, keywordOrder.map((name) => keywordRenames.get(name) ?? name), ({ name }) => name);
  for (const list of ['cards', 'characters'] as const) {
    const order = orders.get(list) ?? table.order?.[list];
    if (order) (table.order ??= {})[list] = sortByOrder(orderOf(table, list), order, (id) => id);
  }
  if (diff.additions.length || diff.deletions.length) {
    table.uids = Object.fromEntries(Object.entries(table.uids).sort(([a], [b]) =>
      a[0].localeCompare(b[0]) || Number(a.slice(1)) - Number(b.slice(1))));
  }
  checkReferences(table, options.characterTexts ?? []);
  return { table, notes };
}
