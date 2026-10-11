import { useSyncExternalStore } from 'react';
import { homeScale } from './homeScale';

const subscribe = (cb: () => void) => {
  window.addEventListener('resize', cb);
  return () => window.removeEventListener('resize', cb);
};
// 快照用數字（四捨五入到小數兩位），視窗沒有實質變化時不會重畫
const getSnapshot = () => Math.round(homeScale(window.innerWidth, window.innerHeight) * 100) / 100;

/** 主選單目前的縮放比例，視窗大小改變時跟著更新 */
export function useHomeScale(): number {
  return useSyncExternalStore(subscribe, getSnapshot, () => 1);
}
