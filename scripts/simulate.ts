import { presetDeck, PRESET_CHARACTER_IDS } from '../src/data/presetDecks';
import { BOT_MODE_DESCRIPTIONS, playOut, type BotMode } from '../src/engine/bot';
import { Game } from '../src/engine/game';
import { Rng } from '../src/engine/rng';

const args = process.argv.slice(2);

// 1. 查詢可用模式
if (args.includes('--modes') || args.includes('-m')) {
  console.log('\n🤖 可用機器人決策模式清單：');
  for (const [id, meta] of Object.entries(BOT_MODE_DESCRIPTIONS)) {
    console.log(`\n【${id}】${meta.name}`);
    console.log(`  策略打法：${meta.strategy}`);
  }
  console.log('\n使用範例：');
  console.log('  bun run sim 1                     # 單局對決展示（預設 mode2）');
  console.log('  bun run sim 1 勇者 刺客             # 指定角色單局對決');
  console.log('  bun run sim 1 --mode mode1:mode2  # 模式對抗單局對決');
  console.log('  bun run sim 40 --mode mode1:mode2 # 模式對抗實力評測（雙向鏡像對打）');
  console.log('  bun run sim 40 --mode mode2       # 固定模式全角色平衡性分析\n');
  process.exit(0);
}

// 2. 解析模式 (modeA, modeB)
function parseMode(raw: string): BotMode {
  const norm = raw.trim().toLowerCase();
  if (norm === 'mode1') return 'mode1';
  if (norm === 'mode2') return 'mode2';
  console.error(`❌ 未知的模式：${raw}。僅支援 mode1 或 mode2，請使用 --modes 查詢可用模式清單。`);
  process.exit(1);
}

let modeA: BotMode = 'mode2';
let modeB: BotMode = 'mode2';

const modeFlagIdx = args.findIndex((a) => a === '--mode');
if (modeFlagIdx !== -1 && args[modeFlagIdx + 1]) {
  const val = args[modeFlagIdx + 1];
  if (val.includes(':')) {
    const [a, b] = val.split(':');
    modeA = parseMode(a);
    modeB = parseMode(b);
  } else {
    modeA = parseMode(val);
    modeB = modeA;
  }
} else {
  const vsArg = args.find((a) => a.startsWith('--mode='));
  if (vsArg) {
    const rawVal = vsArg.slice(7);
    if (rawVal.includes(':')) {
      const [a, b] = rawVal.split(':');
      modeA = parseMode(a);
      modeB = parseMode(b);
    } else {
      modeA = parseMode(rawVal);
      modeB = modeA;
    }
  } else if (args.includes('--mode1')) {
    modeA = 'mode1';
    modeB = 'mode1';
  } else if (args.includes('--mode2')) {
    modeA = 'mode2';
    modeB = 'mode2';
  }
}

// 3. 解析角色與局數
const charsInArgs = args.filter((a) => (PRESET_CHARACTER_IDS as readonly string[]).includes(a));
const numArg = args.find((a) => /^\d+$/.test(a));
const isSingleDuel =
  numArg === '1' ||
  (charsInArgs.length >= 2 && !numArg) ||
  args.includes('--log');
const perPair = isSingleDuel ? 1 : numArg ? Number(numArg) : 30;

// ───────────────────────── 單局對決模式 ─────────────────────────
if (isSingleDuel) {
  const charA = charsInArgs[0] ?? '勇者';
  const charB = charsInArgs[1] ?? (charA === '刺客' ? '勇者' : '刺客');
  const seedArg = args.find((a) => /^\d+$/.test(a) && a !== '1');
  const seed = seedArg ? Number(seedArg) : Math.floor(Math.random() * 100000);

  const d0 = presetDeck(charA);
  const d1 = presetDeck(charB);

  console.log(`\n⚔️  單局對決展示：【${charA}】(${modeA}) vs 【${charB}】(${modeB})（種子：${seed}）`);
  console.log(`方 A (${modeA})：${BOT_MODE_DESCRIPTIONS[modeA].name} - ${BOT_MODE_DESCRIPTIONS[modeA].strategy}`);
  console.log(`方 B (${modeB})：${BOT_MODE_DESCRIPTIONS[modeB].name} - ${BOT_MODE_DESCRIPTIONS[modeB].strategy}\n`);

  const game = new Game({
    decks: [
      { charId: charA, cards: d0 },
      { charId: charB, cards: d1 },
    ],
    seed,
  });

  playOut(game, new Rng(seed ^ 0x9e3779b9), [d0.length, d1.length], { modes: [modeA, modeB] });

  for (const line of game.state.log) {
    console.log(line);
  }
  console.log('');
  process.exit(0);
}

// ───────────────────────── 大量模擬評測模式 ─────────────────────────
const ids = PRESET_CHARACTER_IDS;
const isCrossMode = modeA !== modeB;

console.log(`\n⚔️  對戰模擬評測：${isCrossMode ? `【${modeA}】vs【${modeB}】跨模式對抗` : `【${modeA}】固定模式平衡性測試`}`);
console.log(`方 A (${modeA})：${BOT_MODE_DESCRIPTIONS[modeA].name} - ${BOT_MODE_DESCRIPTIONS[modeA].strategy}`);
if (isCrossMode) {
  console.log(`方 B (${modeB})：${BOT_MODE_DESCRIPTIONS[modeB].name} - ${BOT_MODE_DESCRIPTIONS[modeB].strategy}`);
}
console.log(`每組對陣 ${perPair} 局（共 ${ids.length * ids.length * perPair} 局）\n`);

let games = 0, draws = 0, unfinished = 0, turns = 0, steps = 0;
let firstWins = 0, decisiveGames = 0;
const errors: string[] = [];

// 模式勝負追蹤 (isCrossMode 時使用)
let modeAWins = 0, modeBWins = 0;
let modeAFirstWins = 0, modeAFirstGames = 0;
let modeBFirstWins = 0, modeBFirstGames = 0;

// 各角色勝率追蹤
const charStats: Record<
  string,
  {
    games: number;
    winsAsModeA: number;
    gamesAsModeA: number;
    winsAsModeB: number;
    gamesAsModeB: number;
  }
> = {};
for (const id of ids) {
  charStats[id] = { games: 0, winsAsModeA: 0, gamesAsModeA: 0, winsAsModeB: 0, gamesAsModeB: 0 };
}

for (const a of ids) {
  for (const b of ids) {
    for (let i = 0; i < perPair; i++) {
      const seed = (games + 1) * 7919;
      // 跨模式鏡像對打：前半局 a 用 modeA、b 用 modeB；後半局 a 用 modeB、b 用 modeA
      const activeModes: [BotMode, BotMode] = isCrossMode
        ? i % 2 === 0
          ? [modeA, modeB]
          : [modeB, modeA]
        : [modeA, modeB];

      const decks = [
        { charId: a, cards: presetDeck(a) },
        { charId: b, cards: presetDeck(b) },
      ] as const;

      try {
        const game = new Game({ decks: [decks[0], decks[1]], seed });
        const r = playOut(
          game,
          new Rng(seed ^ 0x9e3779b9),
          [decks[0].cards.length, decks[1].cards.length],
          { modes: activeModes },
        );
        games++;
        steps += r.steps;
        turns += game.state.turn;

        if (!r.finished) {
          unfinished++;
          errors.push(`未結束：${a} vs ${b} seed=${seed}`);
          continue;
        }

        charStats[a].games++;
        charStats[b].games++;

        if (activeModes[0] === modeA) charStats[a].gamesAsModeA++;
        else charStats[a].gamesAsModeB++;

        if (activeModes[1] === modeA) charStats[b].gamesAsModeA++;
        else charStats[b].gamesAsModeB++;

        if (game.state.winner === 'draw') {
          draws++;
        } else if (game.state.winner === 0 || game.state.winner === 1) {
          decisiveGames++;
          const winnerIndex = game.state.winner; // 0 或 1
          const winnerMode = activeModes[winnerIndex];

          if (winnerIndex === game.state.openingFirst) firstWins++;

          // 跨模式勝負累積
          if (winnerMode === modeA) {
            modeAWins++;
            if (activeModes[0] === modeA) charStats[a].winsAsModeA++;
            else charStats[b].winsAsModeA++;
            if (winnerIndex === game.state.openingFirst) modeAFirstWins++;
          } else {
            modeBWins++;
            if (activeModes[0] === modeB) charStats[a].winsAsModeB++;
            else charStats[b].winsAsModeB++;
            if (winnerIndex === game.state.openingFirst) modeBFirstWins++;
          }

          if (activeModes[game.state.openingFirst] === modeA) modeAFirstGames++;
          else modeBFirstGames++;
        }
      } catch (e) {
        games++;
        errors.push(`${a} vs ${b} seed=${seed}：${(e as Error).stack?.split('\n').slice(0, 4).join(' | ')}`);
      }
    }
  }
}

console.log(`共 ${games} 局，平手 ${draws}，未結束 ${unfinished}，錯誤 ${errors.length}`);
const firstWinRate = decisiveGames > 0 ? ((firstWins / decisiveGames) * 100).toFixed(1) : '0.0';
console.log(
  `平均回合數 ${(turns / games).toFixed(1)}，平均提示數 ${(steps / games).toFixed(0)}，先手勝率 ${firstWinRate}%（${firstWins}/${decisiveGames}）\n`,
);

if (isCrossMode) {
  const winRateA = decisiveGames > 0 ? ((modeAWins / decisiveGames) * 100).toFixed(1) : '0.0';
  const winRateB = decisiveGames > 0 ? ((modeBWins / decisiveGames) * 100).toFixed(1) : '0.0';
  const firstRateA =
    modeAFirstGames > 0 ? ((modeAFirstWins / modeAFirstGames) * 100).toFixed(1) : '0.0';
  const firstRateB =
    modeBFirstGames > 0 ? ((modeBFirstWins / modeBFirstGames) * 100).toFixed(1) : '0.0';

  console.log(`★ 模式實力對抗總結：`);
  console.log(
    `  【${modeA}】${BOT_MODE_DESCRIPTIONS[modeA].name} 勝率 ${winRateA}%（${modeAWins}/${decisiveGames}）先手勝率 ${firstRateA}%`,
  );
  console.log(
    `  【${modeB}】${BOT_MODE_DESCRIPTIONS[modeB].name} 勝率 ${winRateB}%（${modeBWins}/${decisiveGames}）先手勝率 ${firstRateB}%`,
  );
  console.log(`\n★ 各角色在不同模式操縱下的勝率對比：`);
  for (const id of ids) {
    const s = charStats[id];
    const rA = s.gamesAsModeA > 0 ? ((s.winsAsModeA / s.gamesAsModeA) * 100).toFixed(1) : '0.0';
    const rB = s.gamesAsModeB > 0 ? ((s.winsAsModeB / s.gamesAsModeB) * 100).toFixed(1) : '0.0';
    console.log(
      `  ${id.padEnd(4, '　')} 由 ${modeA} 操縱：${rA}%（${s.winsAsModeA}/${s.gamesAsModeA}） vs 由 ${modeB} 操縱：${rB}%（${s.winsAsModeB}/${s.gamesAsModeB}）`,
    );
  }
} else {
  console.log(`★ 各角色勝率（${modeA} 操縱）：`);
  for (const id of ids) {
    const s = charStats[id];
    const totalWins = s.winsAsModeA;
    const totalG = s.games;
    console.log(`  ${id.padEnd(4, '　')} 勝率 ${((totalWins / totalG) * 100).toFixed(1)}%（${totalWins}/${totalG}）`);
  }
}

if (errors.length) {
  console.log('\n--- 錯誤（前 10 筆）');
  console.log(errors.slice(0, 10).join('\n'));
  process.exit(1);
}
