/** 觸控上點手牌的兩段式操作：第一下選取並預覽，同一張再點一下才送出 */
export interface TapResult {
  /** 點完之後正在預覽的牌（沒有就是 null） */
  preview: number | null;
  /** 這一下要送出這張牌 */
  submit: boolean;
}

/** preview 是目前預覽的牌，uid 是被點的牌，canSubmit 是這張牌現在能不能送出（提示要求選的牌） */
export function tapCard(preview: number | null, uid: number, canSubmit: boolean): TapResult {
  if (preview === uid) return canSubmit ? { preview: null, submit: true } : { preview: null, submit: false };
  return { preview: uid, submit: false };
}
