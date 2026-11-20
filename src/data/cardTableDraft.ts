import { generatedCards, readTableCards, type CardTableData } from './cardTableData';
import { ENABLED_EFFECT_CARDS } from './enabledCards';
import { isExCardId } from './exCards';
import type { CardData, CardKind } from './types';

export const classes = ['共用', '劍士', '盜賊', '商人', '弓箭手', '法師'] as const;
export const kinds = { move: '招式', equip: '裝備', buff: '增益' } as const;
export const slots = ['武器', '防具', '飾品'] as const;
export const fieldLabels = {
  name: '卡名', kind: '類型', cls: '職業', traits: '特徵',
  atk: '攻擊力', def: '防禦力', combo: '連擊值', expReq: '經驗需求',
  slot: '部位', duration: '持續回合', text: '效果文字',
} as const;
export type Field = keyof typeof fieldLabels;
type Value = string | number | string[] | null;
export interface Edit { uid: string; field: Field; base: Value; value: Value }
export interface Addition { uid: string; card: CardData }
export interface Deletion { uid: string; id: string }
export interface Draft { edits: Edit[]; additions: Addition[]; deletions: Deletion[] }
interface Diff extends Draft { formatVersion: 1; baseVersion: string }

export const emptyDraft = (): Draft => ({ edits: [], additions: [], deletions: [] });
export const equalValue = (a: Value, b: Value): boolean => JSON.stringify(a) === JSON.stringify(b);
export const cardValue = (card: CardData, field: Field): Value => card[field] ?? null;
const prefixes = { move: 'A', equip: 'E', buff: 'B' } as const;
const cardUid = /^[AEB][1-9]\d*$/;
const baseIds = new Set(generatedCards.map((card) => card.id));
const enabledIds = new Set(ENABLED_EFFECT_CARDS);

export function canDelete(card: CardData): boolean {
  return !baseIds.has(card.id) && !enabledIds.has(card.id) && !isExCardId(card.id);
}

export function nextCardUid(table: CardTableData, kind: CardKind, previous: string[]): string {
  const prefix = prefixes[kind];
  const latest = previous.reduce((max, uid) => uid.startsWith(prefix) ? Math.max(max, Number(uid.slice(1))) : max,
    table.uidSeq[prefix]);
  return prefix + (latest + 1);
}

function cardsByUid(table: CardTableData): Map<string, CardData> {
  const byId = new Map(readTableCards(table).map((card) => [card.id, card]));
  return new Map(Object.entries(table.uids).filter(([uid, id]) => cardUid.test(uid) && byId.has(id))
    .map(([uid, id]) => [uid, byId.get(id)!]));
}

export function realignDraft(table: CardTableData, draft: Draft): { draft: Draft; invalidated: Edit[] } {
  const cards = cardsByUid(table);
  const invalidated: Edit[] = [];
  const edits = draft.edits.filter((edit) => {
    const card = cards.get(edit.uid);
    const current = card && cardValue(card, edit.field);
    if (current !== undefined && equalValue(current, edit.value)) return false;
    if (current !== undefined && equalValue(current, edit.base)) return true;
    invalidated.push(edit);
    return false;
  });
  const addedById = new Map(table.added.map((card) => [card.id, card]));
  const additions = draft.additions.filter(({ card }) => {
    const current = addedById.get(card.id);
    if (!current) return true;
    const proposed = applyFields(card, []);
    return (Object.keys(fieldLabels) as Field[]).some((field) => !equalValue(cardValue(current, field), cardValue(proposed, field)));
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
const fieldValidators: Record<Field, (value: unknown) => boolean> = {
  name: nameIsValid,
  kind: (v) => typeof v === 'string' && Object.hasOwn(kinds, v),
  cls: (v) => classes.some((cls) => cls === v),
  traits: (v) => Array.isArray(v) && v.length <= 30 && v.every((t) => typeof t === 'string' && t.trim().length > 0 && t.length <= 100),
  atk: (v) => inRange(v), def: (v) => inRange(v), combo: (v) => inRange(v, 0, 9), expReq: (v) => inRange(v),
  slot: (v) => v === null || slots.some((slot) => slot === v),
  duration: (v) => v === null || inRange(v, 0),
  text: (v) => typeof v === 'string' && v.length <= 10000,
};
export const isFieldValue = (field: Field, value: unknown): value is Value => fieldValidators[field](value);

function objectWithKeys(value: unknown, keys: string[]): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    && Object.keys(value).every((key) => keys.includes(key));
}

function validUid(value: unknown): value is string {
  return typeof value === 'string' && cardUid.test(value) && Number.isSafeInteger(Number(value.slice(1)))
    && Number(value.slice(1)) < Number.MAX_SAFE_INTEGER;
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
    if (!objectWithKeys(edit, ['uid', 'field', 'base', 'value']) || !validUid(edit.uid)
      || typeof edit.field !== 'string' || !Object.hasOwn(fieldValidators, edit.field)
      || !isFieldValue(edit.field as Field, edit.base) || !isFieldValue(edit.field as Field, edit.value)) {
      throw new Error('欄位改動格式不符、欄位不明或數值超出範圍');
    }
    const key = edit.uid + ':' + edit.field;
    if (edited.has(key)) throw new Error(`欄位改動重複：${key}`);
    edited.add(key);
    editedUids.add(edit.uid);
  }
  const added = new Set<string>();
  const fields = Object.keys(fieldValidators) as Field[];
  for (const addition of input.additions) {
    if (!objectWithKeys(addition, ['uid', 'card']) || !validUid(addition.uid)) {
      throw new Error('新增卡格式不符');
    }
    const card = addition.card;
    if (!objectWithKeys(card, ['id', ...fields]) || !nameIsValid(card.id)
      || !fields.every((field) => isFieldValue(field, field === 'slot' || field === 'duration'
        ? card[field] ?? null : card[field]))) {
      throw new Error('新增卡格式不符、欄位不明或數值超出範圍');
    }
    if (added.has(addition.uid)) throw new Error(`編號重複：${addition.uid}`);
    added.add(addition.uid);
  }
  const deleted = new Set<string>();
  for (const deletion of input.deletions) {
    if (!objectWithKeys(deletion, ['uid', 'id']) || !validUid(deletion.uid) || !nameIsValid(deletion.id)) {
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

function checkCard(card: CardData) {
  if (card.kind === 'move' && !inRange(card.combo, 1, 9)) {
    throw new Error(`招式連擊值必須介於 1～9：${card.name}`);
  }
  if (card.kind === 'equip' && !card.slot) {
    throw new Error(`裝備必須指定部位：${card.name}`);
  }
}

function checkReferences(cards: CardData[], exCards: CardData[], characterTexts: string[]) {
  const exNames = new Set(exCards.map((card) => card.name));
  for (const text of [...cards.map((card) => card.text), ...characterTexts]) {
    for (const [, name] of text.matchAll(/\[(Ex-[^\]]+)\]/g)) {
      if (!exNames.has(name)) throw new Error(`引用了不存在的 Ex 卡：[${name}]`);
    }
  }
}

export function applyDiff(
  baseline: CardTableData,
  input: unknown,
  options: { hasEffect?: (id: string) => boolean; characterTexts?: string[] } = {},
): { table: CardTableData; notes: string[] } {
  const diff = parseDiff(input);
  const table = structuredClone(baseline);
  const cards = cardsByUid(baseline);
  const notes: string[] = [];
  const editsByUid = new Map<string, Edit[]>();
  for (const edit of diff.edits) {
    const { uid, field, base, value } = edit;
    const card = cards.get(uid);
    const label = `${uid} ${card?.name ?? ''} ${fieldLabels[field]}`;
    if (!card || !equalValue(cardValue(card, field), base)) {
      notes.push(`欄位衝突（未套用）：${label}`);
      continue;
    }
    if (equalValue(base, value)) continue;
    if (field === 'text' && baseIds.has(card.id)) {
      notes.push(`文字不同（未套用，待確認用語）：${label} → ${value}`);
      continue;
    }
    const edits = editsByUid.get(uid) ?? [];
    edits.push(edit);
    editsByUid.set(uid, edits);
  }

  for (const [uid, edits] of editsByUid) {
    const before = cards.get(uid)!;
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
      for (const field of Object.keys(fieldLabels) as Field[]) {
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
    const card = cards.get(uid);
    if (!card || card.id !== id) {
      notes.push(`刪除衝突（未套用）：${uid} ${id}`);
      continue;
    }
    if (!canDelete(card)) throw new Error(`卡片仍屬於基準資料或已啟用：${uid} ${id}`);
    table.added = table.added.filter((entry) => entry.id !== id);
    delete table.uids[uid];
  }

  // 保留本檔可直接使用的暫領號，避免先處理的撞號卡佔掉後續卡的號碼。
  const reserved = new Set<string>();
  const lastReserved = { ...baseline.uidSeq };
  for (const { uid } of diff.additions) {
    const prefix = uid[0] as 'A' | 'E' | 'B';
    const number = Number(uid.slice(1));
    if (number > baseline.uidSeq[prefix] && !Object.hasOwn(baseline.uids, uid)) {
      reserved.add(uid);
      lastReserved[prefix] = Math.max(lastReserved[prefix], number);
    }
  }
  const existingIds = new Set(readTableCards(baseline).map((card) => card.id));
  for (const { uid, card } of diff.additions) {
    if (existingIds.has(card.id)) throw new Error(`內部 id 重複：${card.id}`);
    existingIds.add(card.id);
    const prefix = uid[0] as 'A' | 'E' | 'B';
    const assigned = reserved.has(uid) ? uid : prefix + (Math.max(table.uidSeq[prefix], lastReserved[prefix]) + 1);
    if (!validUid(assigned)) throw new Error(`已超過可用編號範圍：${assigned}`);
    table.uidSeq[prefix] = Math.max(table.uidSeq[prefix], Number(assigned.slice(1)));
    table.uids[assigned] = card.id;
    const added = applyFields(card, []);
    checkCard(added);
    if (added.kind === 'move' && !added.traits.length && !added.text) {
      throw new Error(`新增招式需要特徵或效果文字，才能與 36 張基準白板卡區分：${added.name}`);
    }
    if (added.text && !options.hasEffect?.(added.id)) {
      added.textPending = true;
      notes.push(`待確認用語並實作效果：${assigned} ${added.name}`);
    }
    table.added.push(added);
    if (assigned !== uid) notes.push(`暫領編號重新分配：${uid} → ${assigned}（${card.name}）`);
  }

  checkReferences(readTableCards(table), table.exCards, options.characterTexts ?? []);
  return { table, notes };
}
