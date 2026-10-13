import { describe, expect, it } from 'vitest';
import { botChoice } from '../src/engine/bot';
import { Rng } from '../src/engine/rng';
import type { Opt, Request } from '../src/engine/types';
import type { GameView, PlayerView } from '../src/engine/view';

function makePlayerView(overrides: Partial<PlayerView> = {}): PlayerView {
  return {
    charId: '勇者',
    deckCount: 30,
    hand: [],
    discard: [],
    rage: [],
    exp: [],
    moves: [],
    pursuit: [],
    gear: [],
    buff: [],
    passed: false,
    atk: 0,
    def: 0,
    ...overrides,
  };
}

function makeGameView(overrides: Partial<GameView> = {}): GameView {
  return {
    me: 1,
    players: [makePlayerView({ charId: '勇者' }), makePlayerView({ charId: '刺客' })],
    first: 1,
    turn: 1,
    phase: '先手',
    log: [],
    winner: null,
    winReason: '',
    cheated: false,
    forfeited: false,
    prompt: null,
    waitingFor: 1,
    ...overrides,
  };
}

describe('AI 決策：先手步驟出招', () => {
  const rng = new Rng(42);

  it('手牌有 0 攻卡與攻擊招式時，絕對不選 0 攻卡', () => {
    // 黑桃7 (攻0 守8 連擊7), 梅花5 (攻3 守3 連擊5)
    const options: Opt[] = [
      { key: 'c1', label: '黑桃7', uid: 1, cardId: '黑桃7' },
      { key: 'c2', label: '梅花5', uid: 2, cardId: '梅花5' },
    ];
    const req: Request = {
      player: 1,
      title: '先手步驟：選擇 1 張招式出招',
      options,
      min: 1,
      max: 1,
      dropZone: 'moves',
    };
    const view = makeGameView({
      players: [
        makePlayerView(),
        makePlayerView({
          hand: [
            { uid: 1, id: '黑桃7', covered: false, counters: 0 },
            { uid: 2, id: '梅花5', covered: false, counters: 0 },
          ],
        }),
      ],
    });

    const choice = botChoice(req, rng, view);
    expect(choice).toEqual(['c2']);
  });

  it('手牌有 [先] 標籤招式時，優先選出', () => {
    // 狙擊印記（弓箭手，攻4 守2 連擊1，帶 [先]）
    // 梅花5（攻3 守3 連擊5）
    const options: Opt[] = [
      { key: 'c1', label: '梅花5', uid: 1, cardId: '梅花5' },
      { key: 'c2', label: '狙擊印記', uid: 2, cardId: '狙擊印記' },
    ];
    const req: Request = {
      player: 1,
      title: '先手步驟：選擇 1 張招式出招',
      options,
      min: 1,
      max: 1,
      dropZone: 'moves',
    };
    const view = makeGameView({
      players: [
        makePlayerView(),
        makePlayerView({
          hand: [
            { uid: 1, id: '梅花5', covered: false, counters: 0 },
            { uid: 2, id: '狙擊印記', covered: false, counters: 0 },
          ],
        }),
      ],
    });

    const choice = botChoice(req, rng, view);
    expect(choice).toEqual(['c2']);
  });

  it('手牌全為 0 攻招式時，依然能合法出牌', () => {
    const options: Opt[] = [{ key: 'c1', label: '黑桃7', uid: 1, cardId: '黑桃7' }];
    const req: Request = {
      player: 1,
      title: '先手步驟：選擇 1 張招式出招',
      options,
      min: 1,
      max: 1,
      dropZone: 'moves',
    };
    const view = makeGameView();
    const choice = botChoice(req, rng, view);
    expect(choice).toEqual(['c1']);
  });
});

describe('AI 決策：爆發階段', () => {
  const rng = new Rng(42);

  it('自身牌組張數 ≤ 6 時，禁止主動爆發（生命安全防線）', () => {
    const options: Opt[] = [{ key: 'c1', label: '梅花5', uid: 1, cardId: '梅花5' }];
    const req: Request = {
      player: 1,
      title: '爆發階段：可選擇 1 張手牌放入經驗區，然後抽 2',
      options,
      min: 0,
      max: 1,
      dropZone: 'exp',
    };
    const view = makeGameView({
      phase: '爆發',
      players: [makePlayerView(), makePlayerView({ deckCount: 6 })],
    });

    const choice = botChoice(req, rng, view);
    expect(choice).toEqual([]);
  });

  it('牌組健康時積極爆發，且優先棄置部位已佔用或無法穿戴的裝備', () => {
    // 布甲 (防具, equip)
    // 梅花5 (招式)
    const options: Opt[] = [
      { key: 'c1', label: '梅花5', uid: 1, cardId: '梅花5' },
      { key: 'c2', label: '布甲', uid: 2, cardId: '布甲' },
    ];
    const req: Request = {
      player: 1,
      title: '爆發階段：可選擇 1 張手牌放入經驗區，然後抽 2',
      options,
      min: 0,
      max: 1,
      dropZone: 'exp',
    };
    // 身上已經裝備了一件布甲 (防具已滿)
    const view = makeGameView({
      phase: '爆發',
      players: [
        makePlayerView(),
        makePlayerView({
          deckCount: 25,
          gear: [{ uid: 99, id: '布甲', covered: false, counters: 0 }],
          hand: [
            { uid: 1, id: '梅花5', covered: false, counters: 0 },
            { uid: 2, id: '布甲', covered: false, counters: 0 },
          ],
        }),
      ],
    });

    const choice = botChoice(req, rng, view);
    expect(choice).toEqual(['c2']);
  });
});

describe('AI 決策：增益階段', () => {
  const rng = new Rng(42);

  it('同時有裝備與增益可打時，優先選擇打出裝備', () => {
    // 木棍 (equip)
    // 生命藥水 (buff)
    const options: Opt[] = [
      { key: 'c1', label: '生命藥水', uid: 1, cardId: '生命藥水' },
      { key: 'c2', label: '木棍', uid: 2, cardId: '木棍' },
    ];
    const req: Request = {
      player: 1,
      title: '增益階段：可打出 1 張裝備或增益',
      options,
      min: 0,
      max: 1,
      dropZone: 'gear',
    };
    const view = makeGameView({ phase: '增益' });

    const choice = botChoice(req, rng, view);
    expect(choice).toEqual(['c2']);
  });
});

describe('AI 決策：觸發窗口與技能', () => {
  const rng = new Rng(42);

  it('遊俠瞄準 LV1：若頂牌判定會成功，選擇保留（keep）', () => {
    const req: Request = {
      player: 1,
      title: '【瞄準】牌組頂是【黑桃5】（連擊值 5），以目前範圍會判定成功。（剩 1 次）',
      options: [
        { key: 'keep', label: '就用這張' },
        { key: 'swap', label: '放到牌組底，改看下一張' },
      ],
      min: 1,
      max: 1,
    };
    const view = makeGameView({ phase: '追擊' });
    const choice = botChoice(req, rng, view);
    expect(choice).toEqual(['keep']);
  });

  it('遊俠瞄準 LV1：若頂牌判定會失敗且我方急需攻擊破防，選擇換底（swap）', () => {
    const req: Request = {
      player: 1,
      title: '【瞄準】牌組頂是【黑桃5】（連擊值 5），以目前範圍會判定失敗。（剩 1 次）',
      options: [
        { key: 'keep', label: '就用這張' },
        { key: 'swap', label: '放到牌組底，改看下一張' },
      ],
      min: 1,
      max: 1,
    };
    // 我方 atk 0，對方 def 5，需要攻擊破防
    const view = makeGameView({
      phase: '追擊',
      players: [makePlayerView({ def: 5 }), makePlayerView({ atk: 0 })],
    });
    const choice = botChoice(req, rng, view);
    expect(choice).toEqual(['swap']);
  });

  it('未受傷時，減傷效果不支付費用發動', () => {
    const req: Request = {
      player: 1,
      title: '【復仇之嚎】要發動嗎？將怒氣區上方 1 常卡加入手牌（怒3）',
      options: [
        { key: 'yes', label: '發動' },
        { key: 'no', label: '不發動' },
      ],
      min: 1,
      max: 1,
    };
    // 對方 atk 2，我方 def 5，沒有受到傷害
    const view = makeGameView({
      phase: '傷害',
      players: [makePlayerView({ atk: 2 }), makePlayerView({ def: 5 })],
    });
    const choice = botChoice(req, rng, view);
    expect(choice).toEqual(['no']);
  });
});

describe('AI 決策：反擊步驟出招與收招保留', () => {
  const rng = new Rng(42);

  it('能達成划算攻擊（淨破防 ≥ 3 點）時，積極出招不收招', () => {
    // 對手出黑桃4 (combo 4, def 5)
    // 我方有黑桃2 (combo 2, atk 5) 和黑桃3 (combo 3, atk 4)
    // 預期 atk: 5 + 4 = 9，淨破防 9 - 5 = 4 >= 3
    const req: Request = {
      player: 1,
      title: '反擊步驟：選擇 1 張招式出招，或收招',
      options: [
        { key: 'c1', label: '黑桃2', uid: 1, cardId: '黑桃2' },
        { key: 'pass', label: '收招' },
      ],
      min: 1,
      max: 1,
      dropZone: 'moves',
    };
    const view = makeGameView({
      phase: '反擊',
      players: [
        makePlayerView({ moves: [{ uid: 99, id: '黑桃4', covered: false, counters: 0 }], def: 5 }),
        makePlayerView({
          hand: [
            { uid: 1, id: '黑桃2', covered: false, counters: 0 },
            { uid: 2, id: '黑桃3', covered: false, counters: 0 },
          ],
        }),
      ],
    });

    const choice = botChoice(req, rng, view);
    expect(choice).toEqual(['c1']);
  });

  it('無法破防（淨破防 < 3）且對手威脅低（受傷 ≤ 3 點）時，主動收招保留手牌', () => {
    // 對方 def 15, atk 2；我方只有梅花5 (atk 3)，手牌無其他卡
    // 預期淨破防 3 - 15 = -12 < 3；且威脅傷 2 - 0 = 2 <= 3
    const req: Request = {
      player: 1,
      title: '反擊步驟：選擇 1 張招式出招，或收招',
      options: [
        { key: 'c1', label: '梅花5', uid: 1, cardId: '梅花5' },
        { key: 'pass', label: '收招' },
      ],
      min: 1,
      max: 1,
      dropZone: 'moves',
    };
    const view = makeGameView({
      phase: '反擊',
      players: [
        makePlayerView({ atk: 2, def: 15, moves: [{ uid: 99, id: '黑桃4', covered: false, counters: 0 }] }),
        makePlayerView({
          hand: [{ uid: 1, id: '梅花5', covered: false, counters: 0 }],
        }),
      ],
    });

    const choice = botChoice(req, rng, view);
    expect(choice).toEqual(['pass']);
  });

  it('無法破防但對手高攻（受傷 ≥ 4 點）時，出高防招式防守減傷，不收招', () => {
    // 對手 atk 8, def 15；我方 def 0（直接收招受傷 8 >= 4）
    // 我方有黑桃7 (守8) 和梅花5 (守3)
    const req: Request = {
      player: 1,
      title: '反擊步驟：選擇 1 張招式出招，或收招',
      options: [
        { key: 'c1', label: '梅花5', uid: 1, cardId: '梅花5' },
        { key: 'c2', label: '黑桃7', uid: 2, cardId: '黑桃7' },
        { key: 'pass', label: '收招' },
      ],
      min: 1,
      max: 1,
      dropZone: 'moves',
    };
    const view = makeGameView({
      phase: '反擊',
      players: [
        makePlayerView({ atk: 8, def: 15, moves: [{ uid: 99, id: '黑桃4', covered: false, counters: 0 }] }),
        makePlayerView({
          hand: [
            { uid: 1, id: '梅花5', covered: false, counters: 0 },
            { uid: 2, id: '黑桃7', covered: false, counters: 0 },
          ],
        }),
      ],
    });

    const choice = botChoice(req, rng, view);
    expect(choice).toEqual(['c2']); // 優先選出最高防禦的黑桃7 (守8) 抵擋傷害
  });

  it('我方手牌資源優勢（多 ≥ 2 張）時切換為策略 A（連擊潛力優先）', () => {
    // 對方出黑桃1 (combo 1)
    // 我方手牌有 4 張，對方手牌 2 張（handDelta = 2 >= 2）
    // 我方候選卡：
    // c1: 梅花5 (combo 5，出招後範圍為 1~5，能連鎖手牌中的黑桃2、黑桃3、黑桃4，chainable 達 3 張)
    // c2: 黑桃1 (combo 1，出招後範圍為 1~1，無法連鎖黑桃2、3、4，chainable 為 0)
    const req: Request = {
      player: 1,
      title: '反擊步驟：選擇 1 張招式出招，或收招',
      options: [
        { key: 'c1', label: '梅花5', uid: 1, cardId: '梅花5' },
        { key: 'c2', label: '黑桃1', uid: 2, cardId: '黑桃1' },
        { key: 'pass', label: '收招' },
      ],
      min: 1,
      max: 1,
      dropZone: 'moves',
    };
    const view = makeGameView({
      phase: '反擊',
      players: [
        makePlayerView({
          moves: [{ uid: 99, id: '黑桃1', covered: false, counters: 0 }],
          def: 0,
          hand: [
            { uid: 10, id: '梅花5', covered: false, counters: 0 },
            { uid: 11, id: '梅花5', covered: false, counters: 0 },
          ],
        }),
        makePlayerView({
          hand: [
            { uid: 1, id: '梅花5', covered: false, counters: 0 },
            { uid: 2, id: '黑桃1', covered: false, counters: 0 },
            { uid: 3, id: '黑桃2', covered: false, counters: 0 },
            { uid: 4, id: '黑桃3', covered: false, counters: 0 },
          ],
        }),
      ],
    });

    const choice = botChoice(req, rng, view);
    // 策略 A 下，梅花5 能擴展連擊空間連鎖後續 3 張牌，連擊潛力最高
    expect(choice).toEqual(['c1']);
  });

  it('雙方手牌充裕時採用策略 C（逼退對手優先，壓縮範圍）', () => {
    // 對方出黑桃5 (combo 5)，對方手牌 4 張，我方手牌 4 張（handDelta = 0 < 2）
    // 我方候選卡：
    // c1: 梅花5 (combo 5，與對方相同連擊值，直接將範圍鎖在 5~5，逼退對手)
    // c2: 黑桃1 (combo 1，範圍 1~5)
    const req: Request = {
      player: 1,
      title: '反擊步驟：選擇 1 張招式出招，或收招',
      options: [
        { key: 'c1', label: '梅花5', uid: 1, cardId: '梅花5' },
        { key: 'c2', label: '黑桃1', uid: 2, cardId: '黑桃1' },
        { key: 'pass', label: '收招' },
      ],
      min: 1,
      max: 1,
      dropZone: 'moves',
    };
    const view = makeGameView({
      phase: '反擊',
      players: [
        makePlayerView({
          moves: [{ uid: 99, id: '黑桃5', covered: false, counters: 0 }],
          def: 0,
          hand: Array.from({ length: 4 }, (_, i) => ({ uid: 10 + i, id: '黑桃5', covered: false, counters: 0 })),
        }),
        makePlayerView({
          hand: [
            { uid: 1, id: '梅花5', covered: false, counters: 0 },
            { uid: 2, id: '黑桃1', covered: false, counters: 0 },
            { uid: 3, id: '黑桃3', covered: false, counters: 0 },
            { uid: 4, id: '黑桃2', covered: false, counters: 0 },
          ],
        }),
      ],
    });

    const choice = botChoice(req, rng, view);
    // 策略 C 下，梅花5 (combo 5) 壓迫度與定住連擊值加分最高，優先打出逼退對手
    expect(choice).toEqual(['c1']);
  });
});

describe('AI 相容性：無視角時平滑降級', () => {
  const rng = new Rng(42);

  it('未傳入 view 時，botChoice 依然能回傳合法選項', () => {
    const req: Request = {
      player: 1,
      title: '先手步驟：選擇 1 張招式出招',
      options: [
        { key: 'c1', label: '黑桃5' },
        { key: 'c2', label: '黑桃6' },
      ],
      min: 1,
      max: 1,
    };
    const choice = botChoice(req, rng);
    expect(choice.length).toBe(1);
    expect(['c1', 'c2']).toContain(choice[0]);
  });
});
