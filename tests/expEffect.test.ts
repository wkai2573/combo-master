import { describe, expect, it } from 'vitest';
import { isExCardId } from '../src/data/exCards';
import { ALL_CARDS, getCard } from '../src/data/cards';
import { isCardEnabled } from '../src/data/enabledCards';
import { createEffects, hasExpEffect } from '../src/engine/effects';
import { allSources } from '../src/engine/sources';
import { defineSource } from '../src/engine/effectKit';
import { expEffectActive } from '../src/ui/components/CardFace';

const view = (id: string | null, covered = false) => ({ uid: 1, id, covered, counters: 0 });

// 卡文裡轉述別張卡（例如 Ex 卡）的說明，會以單獨一行「[卡名]：」開頭；那之後的 [經] 屬於別張卡
const EMBEDDED_HEADER = /^\[(?!(?:先|追|發|頂|經)\])[^\]]+\]：\s*$/m;
// 行首的標籤組：可有前綴 (回合X次)，例如 [經]、[經_怒3]、(回合1次)[經_蓋2]
const LINE_TAGS = /^(?:\([^)]*\))?\[([^\]]+)\]：/;

/** 卡文是否有某一行以 [經] 標籤開頭。卡文是外部權威，這裡只用來對照登記表，執行期不讀卡文 */
function textSaysExpEffect(cardId: string): boolean {
  const own = getCard(cardId).text.split(EMBEDDED_HEADER)[0];
  return own.split('\n').some((line) => LINE_TAGS.exec(line.trim())?.[1].split('_').includes('經'));
}

describe('經驗效果：登記表的查詢', () => {
  it('放在經驗區的條目才算，其他位置、沒有條目的都不算', () => {
    expect(hasExpEffect('低價買進')).toBe(true);
    expect(hasExpEffect('復仇之嚎')).toBe(true);
    expect(hasExpEffect('Ex卡-中毒')).toBe(true);
    expect(hasExpEffect('火球')).toBe(false);
    expect(hasExpEffect('高利貸')).toBe(false); // 文字裡引用 [經]，但它不是經驗效果
    expect(hasExpEffect('塗毒')).toBe(false); // 內嵌 Ex卡-中毒 的 [經]，不算它自己的
    expect(hasExpEffect('紅心5')).toBe(false);
  });

  it('自己建立的登記表也能查', () => {
    const fx = createEffects([
      defineSource({ id: 'A', at: 'exp', on: {} }),
      defineSource({ id: 'B', at: 'hand', on: {} }),
    ]);
    expect(fx.hasExpEffect('A')).toBe(true);
    expect(fx.hasExpEffect('B')).toBe(false);
    expect(fx.hasExpEffect('C')).toBe(false);
  });
});

describe('經驗效果：卡文與登記表一致', () => {
  const cards = ALL_CARDS.filter((c) => isCardEnabled(c) || isExCardId(c.id));

  it('有開放的卡與 Ex 卡可以對照', () => {
    expect(cards.length).toBeGreaterThan(20);
  });

  it('每張開放的卡與 Ex 卡：卡文帶 [經] 標籤，登記表就有放在經驗區的條目', () => {
    const mismatch = cards.filter((c) => textSaysExpEffect(c.id) !== hasExpEffect(c.id)).map((c) => c.id);
    expect(mismatch).toEqual([]);
  });

  it('反方向：登記在經驗區的條目，對應的卡卡文都帶 [經] 標籤', () => {
    const exp = allSources().filter((s) => s.at === 'exp');
    expect(exp.length).toBeGreaterThan(0);
    const wrong = exp.filter((s) => !ALL_CARDS.some((c) => c.id === s.id) || !textSaysExpEffect(s.id)).map((s) => s.id);
    expect(wrong).toEqual([]);
  });

  it('讀卡文的判斷本身：轉述別張卡的 [經] 說明不算，引用 [經] 的說明不算', () => {
    expect(textSaysExpEffect('塗毒')).toBe(false);
    expect(textSaysExpEffect('高利貸')).toBe(false);
    expect(textSaysExpEffect('低價買進')).toBe(true);
    expect(textSaysExpEffect('復仇之嚎')).toBe(true); // [經_怒3]
  });
});

describe('經驗效果：畫面提示', () => {
  it('只有在經驗區、正面朝上、且有經驗效果的卡才是生效中', () => {
    expect(expEffectActive(view('低價買進'))).toBe(true);
    expect(expEffectActive(view('低價買進', true))).toBe(false); // 覆蓋後無效
    expect(expEffectActive(view('火球'))).toBe(false);
  });

  it('看不到牌面的卡（對手覆蓋的經驗卡）不提示', () => {
    expect(expEffectActive(view(null, true))).toBe(false);
    expect(expEffectActive(view(null))).toBe(false);
  });
});
