import { describe, expect, it } from 'vitest';
import { cardTable, readTableCards, readTableCharacters } from '../src/data/cardTableData';
import { applyDiff, blankMoveAdditions, blankMoveMessage, emptyDraft, makeDiff, nextCardUid, nextUid, orderOf, parseDiff, realignDraft, type Draft } from '../src/data/cardTableDraft';
import { getCharacter } from '../src/data/cards';
import { EX_LEAVE_RULES } from '../src/data/exCards';

const card = readTableCards(cardTable).find((c) => c.id === '黑桃1')!;
const uid = Object.keys(cardTable.uids).find((key) => cardTable.uids[key] === card.id)!;
const change = { uid, field: 'atk' as const, base: card.atk, value: card.atk + 1 };
const diffOf = (partial: Partial<Draft>) => makeDiff(cardTable, { ...emptyDraft(), ...partial }, '0.63.1');
const newCard = { ...card, id: '測試新卡', name: '測試新卡', text: '提案效果。' };

describe('卡表草稿', () => {
  it.each(['text', 'awakenText'] as const)('基準角色可獨立匯出、重新載入與匯入 %s', (field) => {
    const id = cardTable.uids.C1;
    const character = getCharacter(id);
    const edit = { uid: 'C1', field, base: character[field], value: '新角色文案' };
    const draft = parseDiff(JSON.parse(JSON.stringify(diffOf({ edits: [edit] }))));
    expect(realignDraft(cardTable, draft).draft.edits).toEqual([edit]);
    const { table } = applyDiff(cardTable, draft);
    expect(readTableCharacters(table).find((entry) => entry.id === id)).toEqual({ ...character, [field]: edit.value });
    expect(realignDraft(table, draft).draft.edits).toEqual([]);
    const restore = { ...edit, base: edit.value, value: edit.base };
    const restored = applyDiff(table, makeDiff(table, { ...emptyDraft(), edits: [restore] }, '0.78.0')).table;
    expect(restored.chars[id]).toEqual(cardTable.chars[id]);
  });

  it('新增角色可匯出與匯入，保留角色編號並清除已匯入草稿', () => {
    const uid = nextUid(cardTable, 'C', []);
    const character = {
      id: '測試角色', name: '測試角色', cls: '劍士' as const, hp: 20, expReq: 6,
      text: '角色效果', awakenText: '覺醒效果', pending: true,
    };
    const diff = diffOf({ additions: [{ uid, character }] });
    const { table } = applyDiff(cardTable, JSON.parse(JSON.stringify(diff)));
    expect(table.uids[uid]).toBe(character.id);
    expect(table.uidSeq.C).toBe(Number(uid.slice(1)));
    expect(readTableCharacters(table)).toContainEqual(character);
    expect(realignDraft(table, diff).draft.additions).toEqual([]);

    const edit = { uid, field: 'awakenText' as const, base: character.awakenText, value: '新覺醒效果' };
    const edited = applyDiff(table, makeDiff(table, { ...emptyDraft(), edits: [edit] }, '0.71.0')).table;
    expect(readTableCharacters(edited)).toContainEqual({ ...character, awakenText: edit.value });
    expect(() => applyDiff(table, diff)).toThrow('角色 id 重複');
  });

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
    expect(Object.keys(table.uids).filter((key) => key.startsWith('A')).slice(-2)).toEqual(['A92', 'A93']);
    expect(table.added.find((entry) => entry.id === newCard.id)).toEqual({ ...newCard, textPending: true });
    expect(notes).toContainEqual(expect.stringContaining('A91 → A93'));
    expect(() => applyDiff(cardTable, { ...diff, additions: [diff.additions[0], diff.additions[0]] })).toThrow('編號重複');
  });

  it('刪除新增卡後永久編號不再被使用', () => {
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
  });

  it.each([
    ['cards', /^[AEB]/],
    ['characters', /^C/],
    ['keywords', /^K/],
  ] as const)('可同時調整 %s 順序和刪除已收錄項目', (list, prefix) => {
    const base = orderOf(cardTable, list);
    const [first, second, removed, ...rest] = base;
    const removedUid = Object.keys(cardTable.uids).find((key) => prefix.test(key) && cardTable.uids[key] === removed)!;
    const value = [second, first, ...rest];
    const diff = diffOf({ edits: [{ uid: list, field: 'order', base, value }], deletions: [{ uid: removedUid, id: removed }] });
    const { table } = applyDiff(cardTable, JSON.parse(JSON.stringify(diff)));
    expect(orderOf(table, list)).toEqual(value);
    expect(table.uids[removedUid]).toBeUndefined();
    expect(realignDraft(table, diff).draft).toEqual(emptyDraft());
    expect(table.uidSeq).toEqual(cardTable.uidSeq);
  });

  it('新增裝備不帶攻守連擊，保留部位與待確認用語提醒', () => {
    const equip = { ...newCard, kind: 'equip' as const, slot: '防具' as const, atk: 5, def: 5, combo: 5 };
    const { table, notes } = applyDiff(cardTable, diffOf({ additions: [{ uid: 'E9', card: equip }] }));
    expect(table.added.find((entry) => entry.id === newCard.id)).toMatchObject({ kind: 'equip', slot: '防具', atk: 0, def: 0, combo: 0, textPending: true });
    expect(notes).toContainEqual(expect.stringContaining('待確認用語並實作效果'));
  });

  it('新增卡的內部 id 與既有卡重複就拒絕', () => {
    expect(() => applyDiff(cardTable, diffOf({ additions: [{ uid: 'A91', card: { ...newCard, id: card.id, name: '另一個顯示名' } }] })))
      .toThrow('內部 id 重複');
  });

  describe('新增招式需要特徵或效果文字', () => {
    const blank = { ...newCard, id: '空白招式', name: '空白招式', traits: [], text: '' };
    const exCard = { ...blank, id: 'Ex-空白', name: 'Ex-空白' };

    it('找出特徵與文字皆空的新增招式，補上其中之一就通過', () => {
      const additions = [
        { uid: 'A91', card: blank },
        { uid: 'A92', card: { ...blank, id: '有特徵', name: '有特徵', traits: ['測試'] } },
        { uid: 'A93', card: { ...blank, id: '有文字', name: '有文字', text: '提案效果。' } },
      ];
      expect(blankMoveAdditions(additions)).toEqual([additions[0]]);
    });

    it('裝備、增益、Ex 卡與關鍵字不受影響', () => {
      expect(blankMoveAdditions([
        { uid: 'E91', card: { ...blank, kind: 'equip' as const, slot: '武器' as const } },
        { uid: 'B91', card: { ...blank, kind: 'buff' as const } },
        { uid: 'X91', card: exCard },
        { uid: 'K91', keyword: { name: '新詞', group: '名詞', desc: '' } },
      ])).toEqual([]);
    });

    it('匯入端用同一個判斷拒絕，錯誤訊息指出卡名', () => {
      expect(() => applyDiff(cardTable, diffOf({ additions: [{ uid: 'A91', card: blank }] }))).toThrow(blankMoveMessage(blank.name));
    });
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

describe('角色、關鍵字與 Ex 卡', () => {
  const character = readTableCharacters(cardTable)[0];
  const charUid = Object.keys(cardTable.uids).find((key) => key.startsWith('C') && cardTable.uids[key] === character.id)!;
  const keyword = { name: '試驗標記', group: '名詞', desc: '效果說明。' };
  const keywordUid = nextUid(cardTable, 'K', []);
  const exUid = nextUid(cardTable, 'X', []);
  const ex = { ...newCard, id: 'Ex-測試', name: 'Ex-測試', traits: ['毒'], text: EX_LEAVE_RULES.exp };

  it('角色改名、生命值與職業只寫入覆蓋值，保留內部 id 並提醒專用卡', () => {
    const edits: Draft['edits'] = [
      { uid: charUid, field: 'name', base: character.name, value: '新角色名' },
      { uid: charUid, field: 'hp', base: character.hp, value: character.hp + 1 },
      { uid: charUid, field: 'cls', base: character.cls, value: '法師' },
    ];
    const draft = { ...emptyDraft(), edits };
    const { table, notes } = applyDiff(cardTable, diffOf(draft));
    expect(table.chars[character.id]).toEqual({ ...cardTable.chars[character.id], name: '新角色名', hp: character.hp + 1, cls: '法師' });
    expect(table.uids[charUid]).toBe(character.id);
    expect(readTableCharacters(table)[0]).toMatchObject({ id: character.id, hp: character.hp + 1, name: '新角色名' });
    expect(notes).toContainEqual(expect.stringContaining('專用卡'));
    expect(realignDraft(table, draft).draft).toEqual(emptyDraft());
    expect(realignDraft({ ...cardTable, chars: { ...cardTable.chars, [character.id]: { hp: character.hp - 1 } } }, draft).invalidated).toEqual([edits[1]]);
  });

  it('關鍵字新增與編輯會保留 K 編號，並報告待確認說明及作廢欄位', () => {
    const existing = cardTable.keywords[0];
    const uid = Object.keys(cardTable.uids).find((key) => key.startsWith('K') && cardTable.uids[key] === existing.name)!;
    const edit = { uid, field: 'desc' as const, base: existing.desc, value: '更新說明。' };
    const draft = { ...emptyDraft(), additions: [{ uid: keywordUid, keyword }], edits: [edit] };
    const { table, notes } = applyDiff(cardTable, diffOf(draft));
    expect(table.keywords[0]).toEqual({ ...existing, desc: edit.value });
    expect(table.keywords.at(-1)).toEqual(keyword);
    expect(table.uids[keywordUid]).toBe(keyword.name);
    expect(notes).toEqual([expect.stringContaining(uid), expect.stringContaining(keywordUid)]);
    expect(realignDraft(table, draft)).toEqual({ draft: emptyDraft(), invalidated: [] });
    expect(realignDraft({ ...cardTable, keywords: [{ ...existing, desc: '別人的修改' }, ...cardTable.keywords.slice(1)] }, draft).invalidated).toEqual([edit]);
    expect(() => applyDiff(cardTable, diffOf({ additions: [{ uid: keywordUid, keyword }, { uid: keywordUid, keyword }] }))).toThrow('編號重複');
  });

  it('已收錄的同名關鍵字即使說明經過修訂，也會清除新增草稿', () => {
    const applied = ['K36', 'K37', 'K38', 'K39'].map((uid) => ({
      uid,
      keyword: { ...cardTable.keywords.find(({ name }) => name === cardTable.uids[uid])!, desc: '匯入前的舊說明。' },
    }));
    const pending = { uid: keywordUid, keyword };
    const draft = { ...emptyDraft(), additions: [...applied, pending] };
    expect(realignDraft(cardTable, draft)).toEqual({
      draft: { ...emptyDraft(), additions: [pending] },
      invalidated: [],
    });
  });

  it('Ex 卡新增、改名及刪除保留內部 id 與發號進度', () => {
    const draft = { ...emptyDraft(), additions: [{ uid: exUid, card: ex }] };
    const { table, notes } = applyDiff(cardTable, diffOf(draft));
    expect(table.exCards.at(-1)).toMatchObject({ id: ex.id, kind: 'move', cls: '共用', atk: ex.atk, def: ex.def, combo: ex.combo });
    expect(notes).toContainEqual(expect.stringContaining('尚未實作效果'));
    expect(realignDraft(table, draft).draft).toEqual(emptyDraft());
    const rename = makeDiff(table, { ...emptyDraft(), edits: [{ uid: exUid, field: 'name', base: ex.name, value: 'Ex-新名稱' }] }, '0.65.0');
    const renamed = applyDiff(table, rename, { hasEffect: () => true });
    expect(renamed.table.exCards.at(-1)).toMatchObject({ id: ex.id, name: 'Ex-新名稱' });
    expect(renamed.table.uids[exUid]).toBe(ex.id);
    expect(renamed.notes).toContainEqual(expect.stringContaining('內部 id 不變'));
    const removed = applyDiff(renamed.table, makeDiff(renamed.table, { ...emptyDraft(), deletions: [{ uid: exUid, id: ex.id }] }, '0.65.0')).table;
    expect(removed.exCards).toEqual(cardTable.exCards);
    expect(removed.uids[exUid]).toBeUndefined();
    expect(nextUid(removed, 'X', [])).not.toBe(exUid);
    expect(() => applyDiff(table, { ...diffOf({}), additions: [{ uid: nextUid(table, 'X', []), card: ex }] })).toThrow('內部 id 重複');
  });

  it('Ex 卡可編輯攻擊、防禦與連擊值，並在新增草稿套用後保留非預設數值', () => {
    const addition = { uid: exUid, card: { ...ex, atk: 4, def: 3, combo: 2 } };
    const { table } = applyDiff(cardTable, diffOf({ additions: [addition] }));
    expect(table.exCards.at(-1)).toMatchObject({ atk: 4, def: 3, combo: 2 });
    expect(realignDraft(table, { ...emptyDraft(), additions: [addition] }).draft).toEqual(emptyDraft());

    const source = cardTable.exCards[0];
    const sourceUid = Object.keys(cardTable.uids).find((uid) => cardTable.uids[uid] === source.id)!;
    const edits = [
      { uid: sourceUid, field: 'atk' as const, base: source.atk, value: 6 },
      { uid: sourceUid, field: 'def' as const, base: source.def, value: 5 },
      { uid: sourceUid, field: 'combo' as const, base: source.combo, value: 3 },
    ];
    expect(applyDiff(cardTable, diffOf({ edits })).table.exCards[0]).toMatchObject({ atk: 6, def: 5, combo: 3 });
  });

  it('Ex 卡可選類型，匯入時保留所有欄位值供切換類型後繼續編輯', () => {
    const equipment = { uid: exUid, card: { ...ex, kind: 'equip' as const, atk: 8, def: 4, combo: 2, expReq: 3, slot: '飾品' as const } };
    const equipped = applyDiff(cardTable, diffOf({ additions: [equipment] })).table.exCards.at(-1)!;
    expect(equipped).toMatchObject({ kind: 'equip', atk: 8, def: 4, combo: 2, expReq: 3, slot: '飾品' });
    expect(realignDraft({ ...cardTable, exCards: [...cardTable.exCards, equipped] }, { ...emptyDraft(), additions: [equipment] }).draft).toEqual(emptyDraft());

    const buff = { uid: nextUid({ ...cardTable, uidSeq: { ...cardTable.uidSeq, X: cardTable.uidSeq.X + 1 } }, 'X', []),
      card: { ...ex, kind: 'buff' as const, atk: 8, def: 4, combo: 2, expReq: 5, duration: 3 } };
    const buffed = applyDiff(cardTable, diffOf({ additions: [buff] })).table.exCards.at(-1)!;
    expect(buffed).toMatchObject({ kind: 'buff', atk: 8, def: 4, combo: 2, expReq: 5, duration: 3 });

    const source = cardTable.exCards[0];
    const sourceUid = Object.keys(cardTable.uids).find((uid) => cardTable.uids[uid] === source.id)!;
    const edits = [
      { uid: sourceUid, field: 'kind' as const, base: source.kind, value: 'equip' as const },
      { uid: sourceUid, field: 'expReq' as const, base: source.expReq, value: 4 },
      { uid: sourceUid, field: 'slot' as const, base: source.slot ?? null, value: '飾品' as const },
    ];
    expect(applyDiff(cardTable, diffOf({ edits })).table.exCards[0]).toMatchObject({ kind: 'equip', atk: source.atk, def: source.def, combo: source.combo, expReq: 4, slot: '飾品' });

    const timed = cardTable.exCards.find((entry) => entry.duration !== undefined)!;
    const timedUid = Object.keys(cardTable.uids).find((uid) => cardTable.uids[uid] === timed.id)!;
    const result = applyDiff(cardTable, diffOf({ edits: [{ uid: timedUid, field: 'kind', base: timed.kind, value: 'buff' }] }));
    expect(result.table.exCards.find((entry) => entry.id === timed.id)?.duration).toBe(timed.duration);
    expect(result.notes).not.toContainEqual(expect.stringContaining('缺少「持續回合：N。」'));
  });

  it('驗證 Ex 卡名稱、離場區域與增益回合', () => {
    const add = (name: string, text: string) => diffOf({ additions: [{ uid: exUid, card: { ...ex, name, text } }] });
    expect(() => applyDiff(cardTable, add('無前綴', ex.text))).toThrow('Ex-');
    expect(() => applyDiff(cardTable, add(ex.name, '無離場規則。'))).toThrow('缺少');
    expect(() => applyDiff(cardTable, add(ex.name, ex.text), { exZone: () => 'buff' })).toThrow(EX_LEAVE_RULES.buff);
    expect(applyDiff(cardTable, add(ex.name, `持續回合：3。\n${EX_LEAVE_RULES.buff}`)).table.exCards.at(-1)?.duration).toBe(3);
    expect(applyDiff(cardTable, add(ex.name, EX_LEAVE_RULES.buff)).notes).toContainEqual(expect.stringContaining('不會到期'));
  });

  it('檢查卡、角色與 Ex 卡的引用，拒絕刪除並列出引用者', () => {
    const referenced = cardTable.exCards.find(({ name }) => name === 'Ex-中毒')!;
    const uid = Object.keys(cardTable.uids).find((key) => cardTable.uids[key] === referenced.id)!;
    expect(() => applyDiff(cardTable, diffOf({ deletions: [{ uid, id: referenced.id }] }))).toThrow(/【.+】引用了不存在的 Ex 卡：\[Ex-中毒\]/);
    const referencing = (name: string) => diffOf({ additions: [{ uid: exUid, card: { ...ex, text: `[${name}]\n${ex.text}` } }] });
    expect(() => applyDiff(cardTable, referencing('Ex-不存在'))).toThrow('【Ex-測試】引用了不存在的 Ex 卡');
    expect(() => applyDiff(cardTable, diffOf({ additions: [{ uid: 'A91', card: { ...newCard, text: '[Ex-不存在]' } }] })))
      .toThrow('【測試新卡】引用了不存在的 Ex 卡');
    expect(() => applyDiff(cardTable, referencing(referenced.name))).not.toThrow();
    expect(() => applyDiff(cardTable, diffOf({}), { characterTexts: ['[Ex-不存在]'] })).toThrow('引用了不存在的 Ex 卡');
  });

  it.each(['added', 'exCards', 'keywords'] as const)('匯出、套用與重新對齊 %s 順序', (list) => {
    const base = orderOf(cardTable, list);
    const value = [...base].reverse();
    const order = { uid: list, field: 'order' as const, base, value };
    const draft = { ...emptyDraft(), edits: [order] };
    const diff = diffOf(draft);
    expect(diff.edits).toEqual([order]);
    const { table } = applyDiff(cardTable, diff);
    expect(orderOf(table, list)).toEqual(value);
    expect(realignDraft(table, draft)).toEqual({ draft: emptyDraft(), invalidated: [] });
    const newer = { ...cardTable, [list]: [...cardTable[list].slice(1), cardTable[list][0]] };
    expect(realignDraft(newer, draft).invalidated).toEqual([order]);
    expect(applyDiff(newer, diff).notes).toContainEqual(expect.stringContaining('排序衝突'));
  });

  it('先排序再新增和改名時，匯入順序及重新對齊仍一致', () => {
    const base = orderOf(cardTable, 'keywords');
    const oldName = base[0];
    const uid = Object.keys(cardTable.uids).find((key) => key.startsWith('K') && cardTable.uids[key] === oldName)!;
    const draft: Draft = {
      ...emptyDraft(),
      additions: [{ uid: keywordUid, keyword }],
      edits: [
        { uid, field: 'name', base: oldName, value: '另一個名稱' },
        { uid: 'keywords', field: 'order', base, value: [...base].reverse() },
      ],
    };
    const { table } = applyDiff(cardTable, diffOf(draft));
    expect(orderOf(table, 'keywords')).toEqual([...base.slice(1).reverse(), '另一個名稱', keyword.name]);
    expect(table.uids[uid]).toBe('另一個名稱');
    expect(realignDraft(table, draft)).toEqual({ draft: emptyDraft(), invalidated: [] });
  });
});
