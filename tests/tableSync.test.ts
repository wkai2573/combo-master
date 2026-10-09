import { describe, expect, it } from 'vitest';
import baseCards from '../src/data/generated/cards.json';
import baseChars from '../src/data/generated/characters.json';
import type { CardData, CharacterData } from '../src/data/types';
import { buildCardTable, type Doc, type TableDocs } from '../scripts/tableSync';

const base = {
  cards: baseCards as CardData[],
  chars: baseChars as CharacterData[],
  hasEffect: (id: string) => id === '有實作的新卡',
};
const spade1 = (baseCards as CardData[])[0];

const doc = (over: Doc): Doc => ({ order: 1, uid: 'A1', kind: 'move', cls: '共用', traits: [], atk: 0, def: 0, combo: 1, expReq: 0, text: '', ...over });
const spade = (over: Doc = {}): Doc => doc({ ...spade1, order: 1, uid: 'A1', base: { name: spade1.name }, ...over });
const build = (docs: Partial<TableDocs>) => buildCardTable({ cards: [], chars: [], keywords: [], ...docs }, base);

describe('卡表同步', () => {
  it('既有卡只輸出被改過的欄位', () => {
    const { table } = build({ cards: [spade({ atk: spade1.atk + 1 })] });
    expect(table.overrides).toEqual({ [spade1.id]: { atk: spade1.atk + 1 } });
    expect(table.added).toEqual([]);
  });

  it('沒改的卡不產生覆蓋', () => {
    expect(build({ cards: [spade()] }).table.overrides).toEqual({});
  });

  it('改名只改顯示名稱，id 仍是改名前的卡名，並提醒', () => {
    const { table, notes } = build({ cards: [spade({ name: '新名字' })] });
    expect(table.overrides[spade1.id]).toEqual({ name: '新名字' });
    expect(table.uids.A1).toBe(spade1.id);
    expect(notes.some((n) => n.includes('卡名已改'))).toBe(true);
  });

  it('類型改成裝備：攻守連擊歸零並提醒', () => {
    const { table, notes } = build({ cards: [spade({ kind: 'equip', slot: '武器' })] });
    expect(table.overrides[spade1.id]).toMatchObject({ kind: 'equip', slot: '武器', atk: 0, def: 0, combo: 0 });
    expect(notes.some((n) => n.includes('類型已改'))).toBe(true);
  });

  it('文字不同只提醒，不套用', () => {
    const { table, notes } = build({ cards: [spade({ text: '[頂]：新效果。' })] });
    expect(table.overrides).toEqual({});
    expect(notes.some((n) => n.includes('文字不同'))).toBe(true);
  });

  it('表上新增的卡進 added；非招式不帶攻守連擊；有文字卻沒實作時提醒', () => {
    const { table, notes } = build({
      cards: [
        doc({ order: 1, uid: 'E1', custom: true, name: '新裝備', kind: 'equip', slot: '防具', atk: 5, def: 5, combo: 5, text: '[蓋1]：新效果。' }),
        doc({ order: 2, uid: 'A2', custom: true, name: '有實作的新卡', kind: 'move', atk: 2, def: 3, combo: 4, text: '[頂]：效果。' }),
      ],
    });
    expect(table.added.map((c) => c.id)).toEqual(['新裝備', '有實作的新卡']);
    expect(table.added[0]).toMatchObject({ kind: 'equip', slot: '防具', atk: 0, def: 0, combo: 0 });
    expect(table.added[1]).toMatchObject({ atk: 2, def: 3, combo: 4 });
    expect(notes.filter((n) => n.includes('需先確認用語並實作效果')).map((n) => n.split('：')[1])).toEqual(['新裝備']);
  });

  it('新增卡依 order 排序輸出', () => {
    const { table } = build({
      cards: [doc({ order: 5, uid: 'A5', custom: true, name: 'b' }), doc({ order: 2, uid: 'A2', custom: true, name: 'a' })],
    });
    expect(table.added.map((c) => c.id)).toEqual(['a', 'b']);
  });

  it('角色：只輸出被改過的欄位，id 為改名前的名稱', () => {
    const hero = (baseChars as CharacterData[])[0];
    const { table, notes } = build({ chars: [{ uid: 'C1', name: '大勇者', base: { name: hero.name }, cls: hero.cls, hp: hero.hp + 5, expReq: hero.expReq }] });
    expect(table.chars).toEqual({ [hero.id]: { name: '大勇者', hp: hero.hp + 5 } });
    expect(notes.some((n) => n.includes('角色名稱已改'))).toBe(true);
  });

  it('編號：依前綴字母與數字排序，指向內部 id', () => {
    const { table } = build({
      cards: [spade({ uid: 'A10' })],
      chars: [{ uid: 'C2', name: (baseChars as CharacterData[])[0].name, hp: 50, expReq: 8, cls: '劍士' }],
      keywords: [{ uid: 'K3', name: '先', cls: '標籤', desc: 'x', order: 1 }],
    });
    expect(Object.keys(table.uids)).toEqual(['A10', 'C2', 'K3']);
    expect(table.uids.K3).toBe('先');
  });

  it('編號重複就擋下，缺編號只提醒', () => {
    expect(() => build({ cards: [spade({ uid: 'A1' }), spade({ order: 2, uid: 'A1', base: { name: '黑桃2' }, name: '黑桃2' })] })).toThrow('編號重複');
    const { notes } = build({ cards: [spade({ uid: undefined })] });
    expect(notes.some((n) => n.includes('缺少編號'))).toBe(true);
  });

  it('關鍵字依 order 排序，說明待確認時提醒', () => {
    const { table, notes } = build({
      keywords: [
        { uid: 'K2', name: 'b', cls: '名詞', desc: '二', order: 2, textPending: true },
        { uid: 'K1', name: 'a', cls: '標籤', desc: '一', order: 1 },
      ],
    });
    expect(table.keywords).toEqual([{ name: 'a', group: '標籤', desc: '一' }, { name: 'b', group: '名詞', desc: '二' }]);
    expect(notes).toContain('關鍵字說明待確認用語：b');
  });
});
