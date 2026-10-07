/** 數字旁浮出的差值（k 變動時重播）。tone：sign 依正負上色，neutral 一律用強調色 */
export function Delta({ d, k, tone = 'sign' }: { d?: number; k: number; tone?: 'sign' | 'neutral' }) {
  if (!d) return null;
  return (
    <span key={k} className={`delta ${tone === 'neutral' ? 'n' : d > 0 ? 'up' : 'down'}`}>
      {d > 0 ? `+${d}` : `−${-d}`}
    </span>
  );
}
