import { describe, expect, it } from 'vitest';
import { isExCardId } from '../src/data/exCards';
import { ALL_CARDS, ALL_CHARACTERS } from '../src/data/cards';
import { checkCardText, checkWording, lineBoxes, parseCardLine, parseCardText } from '../src/data/cardText';
import { isCardEnabled } from '../src/data/enabledCards';
import { keywordsIn } from '../src/data/keywords';

describe('卡片文字句型：切成各段', () => {
  it('規範範例一：費用、時機、條件、效果各自切開，接起來等於原文', () => {
    const raw = '[蓋3]：當我方收招時，且我方戰鬥區的卡共有特徵「冰」「雷」，抽1，回復1。';
    const l = parseCardLine(raw);
    expect(l.kind).toBe('line');
    expect(l.count).toBe('');
    expect(l.bracket).toBe('[蓋3]：');
    expect(l.costs).toEqual(['蓋3']);
    expect(l.tags).toEqual([]);
    expect(l.timing).toBe('當我方收招時，');
    expect(l.condition).toBe('且我方戰鬥區的卡共有特徵「冰」「雷」，');
    expect(l.effect).toBe('抽1，回復1。');
    expect(l.errors).toEqual([]);
    expect(l.count + l.bracket + l.timing + l.condition + l.effect).toBe(raw);
  });

  it('規範範例二：回合X次、費用、時機、效果', () => {
    const l = parseCardLine('(回合1次)[蓋2]：當我方追擊判定失敗時，額外翻 1 張卡做追擊判定。');
    expect(l.count).toBe('(回合1次)');
    expect(l.costs).toEqual(['蓋2']);
    expect(l.timing).toBe('當我方追擊判定失敗時，');
    expect(l.condition).toBe('');
    expect(l.effect).toBe('額外翻 1 張卡做追擊判定。');
    expect(l.errors).toEqual([]);
  });

  it('開頭關鍵字與費用寫在同一組方括號，以底線相連', () => {
    const l = parseCardLine('[發_蓋X]：抽X，此回合我方總防禦 −X。X最大為2。');
    expect(l.tags).toEqual(['發']);
    expect(l.costs).toEqual(['蓋X']);
    expect(l.timing).toBe('');
    expect(l.effect).toBe('抽X，此回合我方總防禦 −X。X最大為2。');
    const both = parseCardLine('[經_怒3]：當傷害計算後，且對方給予的傷害 > 我方給予的傷害，將怒氣區上方 1 張卡加入手牌。');
    expect(both.tags).toEqual(['經']);
    expect(both.costs).toEqual(['怒3']);
    expect(both.timing).toBe('當傷害計算後，');
    expect(both.condition).toBe('且對方給予的傷害 > 我方給予的傷害，');
  });

  it('沒有時機的條件以「若」開頭；沒有方括號的行只有效果', () => {
    const l = parseCardLine('[頂]：若我方戰鬥區僅有此卡，追擊+1。');
    expect(l.timing).toBe('');
    expect(l.condition).toBe('若我方戰鬥區僅有此卡，');
    expect(l.effect).toBe('追擊+1。');
    const plain = parseCardLine('獲得【瞄準】。');
    expect([plain.bracket, plain.timing, plain.condition, plain.effect]).toEqual(['', '', '', '獲得【瞄準】。']);
  });

  it('多行卡文逐行切；轉述別張卡的標題行是 header', () => {
    const lines = parseCardText('[先_蓋1]：當歸還時，將 [Ex-中毒] 移入出招卡較少那方的經驗區。\n[Ex-中毒]：\n[經]：當我方後攻的回合開始時，直擊我方3。\n當此卡離開經驗區時，移除遊戲。');
    expect(lines.map((l) => l.kind)).toEqual(['line', 'header', 'line', 'line']);
    expect(lines[2].tags).toEqual(['經']);
    expect(lines[3].timing).toBe('當此卡離開經驗區時，');
    expect(lines.every((l) => l.errors.length === 0)).toBe(true);
  });
});

describe('卡片文字規範檢查：不符規範的寫法會被指出', () => {
  it('有時機時條件要用「且」，沒有時機時條件要用「若」', () => {
    expect(checkCardText('[蓋3]：當我方收招時，若我方戰鬥區有冰，抽1。').join()).toContain('「且」');
    expect(checkCardText('[頂]：且我方戰鬥區僅有此卡，追擊+1。').join()).toContain('「若」');
  });

  it('時機要以「當」開頭、以「時」或「後」結尾；結構順序要對', () => {
    expect(checkCardText('[經]：當此卡被蓋，回復3。').join()).toContain('結尾');
    expect(checkCardText('[蓋2_發]：抽1。').join()).toContain('要寫在費用前面');
    expect(checkCardText('(回合1次)：抽1。').join()).toContain('後面要接');
    expect(checkCardText('[起]：抽1。').join()).toContain('不是開頭關鍵字或費用');
    expect(checkCardText('[發]：抽1').join()).toContain('句號');
    expect(checkCardText('[經]：回合開始時，回復1。').join()).toContain('要以「當」開頭');
  });

  it('舊用語與不一致的寫法', () => {
    for (const bad of ['此卡被覆蓋時', '正面向上', '起手步驟', '你抽1張', '敵方直擊2', '抽一張卡']) {
      expect(checkWording(bad), bad).not.toEqual([]);
    }
    expect(checkWording('當此卡被蓋為裏側時，抽1。')).toEqual([]);
  });
});

describe('全部卡片與角色文字都符合撰寫規範', () => {
  it('每張開放的卡與 Ex 卡的卡文：句型符合、沒有舊用語', () => {
    const problems: string[] = [];
    for (const c of ALL_CARDS.filter((c) => c.text !== '' && (isCardEnabled(c) || isExCardId(c.id)))) {
      for (const e of checkCardText(c.text)) problems.push(`${c.name}：${e}`);
    }
    expect(problems).toEqual([]);
  });

  it('角色文字不套用句型，只檢查用語', () => {
    const problems: string[] = [];
    for (const ch of ALL_CHARACTERS) {
      for (const e of [...checkWording(ch.text ?? ''), ...checkWording(ch.awakenText ?? '')]) problems.push(`${ch.name}：${e}`);
    }
    expect(problems).toEqual([]);
  });
});

describe('卡文開頭的特殊框', () => {
  it('回合X次、開頭關鍵字、費用依序成框；費用框有圖示與數字', () => {
    const boxes = lineBoxes(parseCardLine('(回合1次)[發_蓋2]：當我方追擊判定失敗時，額外翻 1 張卡做追擊判定。'));
    expect(boxes.map((b) => [b.kind, b.label])).toEqual([['count', '回合1次'], ['tag', '發'], ['cost', '蓋2']]);
    expect(boxes[2]).toMatchObject({ icon: '蓋', value: '2', source: '[蓋2]' });
    const rage = lineBoxes(parseCardLine('[蓋1_怒3]：當回合開始時，回復1。'));
    expect(rage.map((b) => [b.icon, b.value])).toEqual([['蓋', '1'], ['怒', '3']]);
    expect(lineBoxes(parseCardLine('[發_蓋X]：抽X。'))[1]).toMatchObject({ icon: '蓋', value: 'X' });
    expect(lineBoxes(parseCardLine('獲得【瞄準】。'))).toEqual([]);
  });

  it('每個框都對得上關鍵字說明，滑入時才有提示可以顯示', () => {
    const problems: string[] = [];
    for (const c of ALL_CARDS.filter((c) => c.text !== '' && (isCardEnabled(c) || isExCardId(c.id)))) {
      for (const line of parseCardText(c.text)) {
        if (line.kind !== 'line') continue;
        for (const box of lineBoxes(line)) {
          if (keywordsIn(box.source).length === 0) problems.push(`${c.name}：${box.source} 沒有關鍵字說明`);
        }
      }
    }
    expect(problems).toEqual([]);
  });
});
