import { describe, expect, it } from 'vitest';
import { ALL_CHARACTERS, PLAYABLE_CARDS } from '../src/data/cards';
import { keywordsIn, KEYWORDS, segmentsOf } from '../src/data/keywords';

const names = (text: string) => keywordsIn(text).map((k) => k.name);

describe('關鍵字', () => {
  it('標籤與費用：[發_蓋3] 拆成 發、蓋X；文字裡的「回復」也算引用', () => {
    expect(names('[發_蓋3]：回復3。')).toEqual(['發', '蓋X', '回復X']);
    expect(names('[覺_發_怒10]：此回合追擊+1。')).toEqual(['覺', '發', '怒X', '追擊+X']);
  });

  it('【名稱】引用角色技能；不存在的名稱不當關鍵字', () => {
    expect(names('獲得【瞄準】。')).toEqual(['瞄準']);
    expect(names('獲得【不存在】。')).toEqual([]);
    expect(names('此回合我方的瞄準升級1。')).toContain('OO升級X');
    expect(names('(回合1次)當我方追擊判定失敗時')).toContain('(回合X次)');
  });

  it('切片還原成原文，關鍵字片段帶有說明', () => {
    const text = '[頂]：我方總防禦 +2。';
    const segs = segmentsOf(text);
    expect(segs.map((s) => s.text).join('')).toBe(text);
    expect(segs.filter((s) => s.kws.length > 0).map((s) => s.text)).toEqual(['[頂]', '總防禦']);
  });

  it('書寫規範不當關鍵字顯示', () => {
    expect(names('我方抽 1 張牌時。')).not.toContain('我方／對方／雙方');
  });

  it('遊俠只寫【瞄準】，完整說明在關鍵字區塊', () => {
    const archer = ALL_CHARACTERS.find((c) => c.name === '遊俠')!;
    expect(archer.text).toBe('獲得【瞄準】。');
    expect(KEYWORDS.find((k) => k.name === '瞄準')!.desc).toContain('牌組頂');
  });

  it('開放中的卡與角色用到的 [標籤] 都有定義在關鍵字區塊', () => {
    const defined = new Set(KEYWORDS.map((k) => k.name));
    const texts = [...PLAYABLE_CARDS.map((c) => c.text), ...ALL_CHARACTERS.flatMap((c) => [c.text, c.awakenText])];
    for (const t of texts) {
      for (const m of t.matchAll(/\[([^\]]+)\]/g)) {
        if (m[1].startsWith('Ex卡-')) continue; // Ex 卡的卡名
        for (const part of m[1].split('_')) {
          expect(defined.has(part.replace(/\d+/g, 'X')), `關鍵字「${part}」（出自：${t}）沒有定義`).toBe(true);
        }
      }
      for (const m of t.matchAll(/【([^】]+)】/g)) expect(defined.has(m[1]), `關鍵字「${m[1]}」沒有定義`).toBe(true);
    }
  });
});
