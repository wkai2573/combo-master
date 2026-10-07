import type { FrameFx, PlayerId } from '../../engine/types';

/** 橫幅：回合開頭顯示回合數與先後攻，戰鬥的主要階段顯示階段名稱。時間由影格長度與速度倍率決定 */
export function PhaseBanner({ fx, n, me }: { fx?: FrameFx; n: number; me: PlayerId }) {
  if (fx?.type !== 'banner') return null;
  const title = fx.kind === 'turn' ? `第 ${fx.turn} 回合` : fx.name;
  const sub = fx.kind === 'turn' ? (fx.first === me ? '你先攻' : '對手先攻') : undefined;
  return (
    <div className="phasebanner" key={n} aria-hidden>
      <div className="bannerband">
        <b>{title}</b>
        {sub && <small>{sub}</small>}
      </div>
    </div>
  );
}
