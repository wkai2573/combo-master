import { presetDeck, PRESET_CHARACTER_IDS } from '../src/data/presetDecks';
import { playOut } from '../src/engine/bot';
import { Game } from '../src/engine/game';
import { Rng } from '../src/engine/rng';

const args = process.argv.slice(2);
const charsInArgs = args.filter((a) => (PRESET_CHARACTER_IDS as readonly string[]).includes(a));
const charA = charsInArgs[0] ?? '勇者';
const charB = charsInArgs[1] ?? (charA === '刺客' ? '勇者' : '刺客');
const mode = args.includes('--random') ? 'random' : 'smart';
const seedArg = args.find((a) => /^\d+$/.test(a));
const seed = seedArg ? Number(seedArg) : Math.floor(Math.random() * 100000);

const d0 = presetDeck(charA);
const d1 = presetDeck(charB);

console.log(`\n⚔️  一般對決展示：【${charA}】vs【${charB}】（模式：${mode === 'smart' ? '啟發式 AI' : '隨機'}，種子：${seed}）\n`);

const game = new Game({
  decks: [
    { charId: charA, cards: d0 },
    { charId: charB, cards: d1 },
  ],
  seed,
});

playOut(game, new Rng(seed ^ 0x9e3779b9), [d0.length, d1.length], { mode });

for (const line of game.state.log) {
  console.log(line);
}
console.log('');
