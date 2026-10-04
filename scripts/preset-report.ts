import { getCard } from '../src/data/cards';
import { PRESET_CHARACTER_IDS, presetDeck, presetStyle } from '../src/data/presetDecks';

// 列出各角色預設牌組的組成，調整 presetDecks.ts 後可用 `npm run presets` 檢查
for (const id of PRESET_CHARACTER_IDS) {
  const cards = presetDeck(id).map(getCard);
  const moves = cards.filter((c) => c.kind === 'move');
  const byCombo = Array.from({ length: 9 }, (_, i) => moves.filter((c) => c.combo === i + 1).length);
  const avg = (key: 'atk' | 'def') => (moves.reduce((n, c) => n + c[key], 0) / moves.length).toFixed(2);
  console.log(`${id}（${cards.length} 張，${new Set(cards.map((c) => c.id)).size} 種）　${presetStyle(id)}`);
  console.log(`  連擊值 1~9 張數：${byCombo.join(' ')}　平均攻 ${avg('atk')}／守 ${avg('def')}`);
}
