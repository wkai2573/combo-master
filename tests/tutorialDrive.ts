import type { TutorialSession } from '../src/net/session';

/** 玩家做出說明要求的那個操作：點擊畫面、選指定的手牌，或按指定的按鈕選項。腳本走完時什麼都不做 */
export function act(s: TutorialSession): void {
  const a = s.getState().tutorial!.awaiting;
  if (a === 'click') {
    s.advance();
  } else if (a) {
    const opts = s.getState().view!.prompt!.options;
    const opt = 'play' in a ? opts.find((o) => o.cardId === a.play)! : opts.find((o) => o.key === a.choose)!;
    s.submit([opt.key]);
  }
}

/** 照說明一路操作到腳本走完；回傳經過的說明文字 */
export function driveToEnd(s: TutorialSession, limit = 300): string[] {
  const texts: string[] = [];
  for (let i = 0; i < limit && s.getState().tutorial!.awaiting !== null; i++) {
    texts.push(s.getState().tutorial!.text);
    act(s);
  }
  return texts;
}
