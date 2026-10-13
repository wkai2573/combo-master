import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const html = readFileSync('index.html', 'utf8');
const css = readFileSync('src/ui/styles.css', 'utf8');

// 畫面文字不可選取、不提示翻譯；輸入框要留著可選，否則 iOS 打不了字
describe('文字選取與自動翻譯', () => {
  it('整頁文字不可選取，也不跳出 iOS 的長按選單', () => {
    expect(css).toMatch(/body \{[^}]*user-select: none;[^}]*-webkit-touch-callout: none;/);
  });

  it('輸入框、文字框與錯誤訊息例外，仍可選取', () => {
    expect(css).toMatch(/input, textarea, \.errormsg \{[^}]*user-select: text;/);
  });

  it('網頁標示不翻譯：html 屬性與 meta 都有', () => {
    expect(html).toMatch(/<html[^>]*translate="no"/);
    expect(html).toContain('<meta name="google" content="notranslate" />');
  });

  it('手牌預覽的層級在全螢幕牌區與卡片說明底下', () => {
    const z = (sel: RegExp) => Number(css.match(sel)![1]);
    expect(z(/\.handpreview \{[^}]*z-index: (\d+)/)).toBeLessThan(z(/\.sheetback \{[^}]*z-index: (\d+)/));
  });
});
