import { describe, expect, it } from 'vitest';
import { cardTable, readTableCards } from '../src/data/cardTableData';
import { applyDiff, emptyDraft, makeDiff, nextCardUid, realignDraft, type Draft } from '../src/data/cardTableDraft';

const card = readTableCards(cardTable).find((c) => c.id === '黑桃1')!;
const uid = Object.keys(cardTable.uids).find((key) => cardTable.uids[key] === card.id)!;
const change = { uid, field: 'atk' as const, base: card.atk, value: card.atk + 1 };
const diffOf = (partial: Partial<Draft>) => makeDiff(cardTable, { ...emptyDraft(), ...partial }, '0.63.1');
const newCard = { ...card, id: '測試新卡', name: '測試新卡', text: '提案效果。' };

describe('卡表草稿', () => {
  it('只匯出改動欄位，套用後等於直接修改覆蓋值', () => {
    const diff = makeDiff(cardTable, { ...emptyDraft(), edits: [change, { ...change, field: 'name', base: card.name, value: card.name }] }, '0.63.1');
    expect(diff.edits).toEqual([change]);
    expect(diff).toMatchObject({ formatVersion: 1, baseVersion: '0.63.1' });
    expect(applyDiff(cardTable, diff).table).toEqual({
      ...cardTable,
      overrides: { ...cardTable.overrides, [card.id]: { ...cardTable.overrides[card.id], atk: change.value } },
    });
  });

  it.each([-1, 100, 1.5, '4'])('拒絕無效數值 %s 且保留基準', (value) => {
    const before = structuredClone(cardTable);
    expect(() => applyDiff(cardTable, { ...diffOf({}), edits: [{ ...change, value }] })).toThrow('數值超出範圍');
    expect(cardTable).toEqual(before);
  });

  it('拒絕未知欄位、額外資料與未知格式版本', () => {
    const diff = diffOf({});
    expect(() => applyDiff(cardTable, { ...diff, edits: [{ ...change, field: 'id' }] })).toThrow('欄位不明');
    expect(() => applyDiff(cardTable, { ...diff, unexpected: true })).toThrow('格式或版本不符');
    expect(() => applyDiff(cardTable, { ...diff, formatVersion: 2 })).toThrow('格式或版本不符');
    expect(() => applyDiff(cardTable, { ...diff, edits: [{ uid, field: 'combo', base: card.combo, value: 0 }] })).toThrow('1～9');
    expect(() => applyDiff(cardTable, { ...diff, edits: [{ uid, field: 'combo', base: card.combo, value: 10 }] })).toThrow('數值超出範圍');
  });

  it('報告舊基準衝突，且只提示基準卡的效果文字', () => {
    const diff = diffOf({ edits: [change, { uid, field: 'text', base: card.text, value: '待確認提案。' }] });
    const newer = { ...cardTable, overrides: { ...cardTable.overrides, [card.id]: { atk: card.atk + 2 } } };
    const result = applyDiff(newer, diff);
    expect(result.table).toEqual(newer);
    expect(result.notes).toEqual([expect.stringContaining('欄位衝突'), expect.stringContaining('待確認提案。')]);
  });

  it('重新對齊時列出作廢項目，自動清除已匯入欄位並保留其餘欄位', () => {
    const alreadyApplied = { uid, field: 'name' as const, base: card.name, value: '新顯示名' };
    const unaffected = { uid, field: 'def' as const, base: card.def, value: card.def + 1 };
    const draft = { ...emptyDraft(), edits: [change, alreadyApplied, unaffected] };
    const newer = {
      ...cardTable,
      overrides: { ...cardTable.overrides, [card.id]: { ...cardTable.overrides[card.id], atk: card.atk + 2, name: '新顯示名' } },
    };
    expect(realignDraft(newer, draft)).toEqual({ draft: { ...draft, edits: [unaffected] }, invalidated: [change] });
  });

  it('保留內部 id，轉換類型時歸零並提醒特徵與改名', () => {
    const { table, notes } = applyDiff(cardTable, diffOf({ edits: [
      { uid, field: 'name', base: card.name, value: '新顯示名' },
      { uid, field: 'kind', base: card.kind, value: 'buff' },
      { uid, field: 'traits', base: card.traits, value: ['測試'] },
    ] }));
    expect(readTableCards(table).find((entry) => entry.id === card.id))
      .toMatchObject({ name: '新顯示名', kind: 'buff', atk: 0, def: 0, combo: 0, traits: ['測試'] });
    expect(table.uids[uid]).toBe(card.id);
    expect(notes).toEqual([expect.stringContaining('卡名已改'), expect.stringContaining('類型已改'), expect.stringContaining('白板卡')]);
  });

  it('接受未發過的暫領編號，撞號時改領並保留檔內另一張卡的暫領號', () => {
    const diff = diffOf({ additions: [
      { uid: 'A91', card: newCard },
      { uid: 'A92', card: { ...newCard, id: '另一張新卡', name: '另一張新卡' } },
    ] });
    const { table, notes } = applyDiff(cardTable, diff);
    expect(table.uids).toMatchObject({ A92: '另一張新卡', A93: newCard.id });
    expect(table.uidSeq.A).toBe(93);
    expect(table.added.find((entry) => entry.id === newCard.id)).toEqual({ ...newCard, textPending: true });
    expect(notes).toContainEqual(expect.stringContaining('A91 → A93'));
    expect(() => applyDiff(cardTable, { ...diff, additions: [diff.additions[0], diff.additions[0]] })).toThrow('編號重複');
  });

  it('刪除新增卡後永久編號不再被使用，也不接受刪除基準卡', () => {
    const addition = { uid: 'B1', card: { ...newCard, kind: 'buff' as const, duration: 3 } };
    const { table } = applyDiff(cardTable, diffOf({ additions: [addition] }));
    expect(table.added.find((entry) => entry.id === newCard.id)).toMatchObject({ atk: 0, def: 0, combo: 0, duration: 3 });
    const deletion = { ...emptyDraft(), deletions: [{ uid: 'B1', id: newCard.id }] };
    const removed = applyDiff(table, makeDiff(table, deletion, '0.64.0')).table;
    expect(removed.added).toEqual(cardTable.added);
    expect(removed.uids.B1).toBeUndefined();
    expect(removed.uidSeq.B).toBe(1);
    expect(nextCardUid(removed, 'buff', [])).toBe('B2');
    expect(applyDiff(removed, diffOf({ additions: [addition] })).table.uids.B2).toBe(newCard.id);
    expect(() => applyDiff(cardTable, diffOf({ deletions: [{ uid, id: card.id }] }))).toThrow('基準');
  });

  it('已匯入的新增與刪除在新版基準上不再重複列為草稿', () => {
    const addition = { uid: 'A91', card: newCard };
    const addDraft = { ...emptyDraft(), additions: [addition] };
    const added = applyDiff(cardTable, makeDiff(cardTable, addDraft, '0.63.1')).table;
    expect(realignDraft(added, addDraft).draft).toEqual(emptyDraft());
    const deleteDraft = { ...emptyDraft(), deletions: [{ uid: 'A92', id: newCard.id }] };
    const removed = applyDiff(added, makeDiff(added, deleteDraft, '0.64.0')).table;
    expect(realignDraft(removed, deleteDraft).draft).toEqual(emptyDraft());
  });
});
