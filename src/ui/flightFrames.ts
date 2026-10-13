/** 一張飛行卡的位移資料：起點相對終點的位移與縮放 */
export interface FlyGeometry { dx: number; dy: number; sx: number; sy: number }

/**
 * 飛行卡從起點飛到終點的關鍵影格。
 * 從中央放大出發（fromSpot）的卡：放大的那張牌還停在中央時，飛行卡先全透明，免得兩張版面比例不同的牌疊在一起
 * （飛行卡是終點那張小卡放大來的），開始飛的時候才淡入，一邊飛一邊接手
 */
export function flyFrames({ dx, dy, sx, sy }: FlyGeometry, fromSpot: boolean): Keyframe[] {
  const start = `translate(${dx}px, ${dy}px) scale(${sx}, ${sy})`;
  if (!fromSpot) return [{ transform: start, opacity: 1 }, { transform: 'none', opacity: 1 }];
  return [
    { transform: start, opacity: 0, offset: 0 },
    // 這一格沒有寫 transform：位移照整段飛行時間插值，翻面動畫才對得上
    { opacity: 1, offset: 0.25 },
    { transform: 'none', opacity: 1, offset: 1 },
  ];
}
