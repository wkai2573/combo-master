import { getCard } from '../data/cards';
import type { Rng } from './rng';
import type { Request } from './types';
import type { GameView, PlayerView } from './view';

/**
 * 啟發式決策 AI（單機練習用）：
 * 嚴格遵守牌面可見性（Face Visibility），僅依據自身視角（GameView）做決策。
 */

/** 判定是否為先手步驟出招 */
export function isOpeningStep(req: Request, view: GameView): boolean {
  if (req.dropZone !== 'moves' || req.min !== 1 || req.max !== 1) return false;
  if (req.options.some((o) => o.key === 'pass')) return false;
  return view.phase === '先手' || req.title.includes('先手');
}

/** 判定是否為反擊步驟出招或收招 */
export function isCounterStep(req: Request): boolean {
  return req.dropZone === 'moves' && req.options.some((o) => o.key === 'pass');
}

/** 判定是否為爆發階段選擇手牌 */
export function isBurstPhase(req: Request, view: GameView): boolean {
  return req.dropZone === 'exp' && req.min === 0 && (view.phase === '爆發' || req.title.includes('爆發'));
}

/** 判定是否為增益階段打出裝備或增益 */
export function isBuffPhase(req: Request, view: GameView): boolean {
  return req.dropZone === 'gear' && req.min === 0 && (view.phase === '增益' || req.title.includes('增益'));
}

/**
 * 先手步驟決策：
 * 1. 排除 0 攻招式（除非手牌全為 0 攻），避免被後攻方第一動秒收招
 * 2. 優先出連擊值偏中間（4～6）且手牌其他招式能接應最多者
 * 3. 帶有 [先] 標籤之招式大幅加分
 */
export function chooseOpeningMove(req: Request, myView: PlayerView): string[] {
  if (req.options.length === 0) return [];
  if (req.options.length === 1) return [req.options[0].key];

  // 排除 0 攻
  const nonZero = req.options.filter((o) => {
    if (!o.cardId) return true;
    return getCard(o.cardId).atk > 0;
  });
  const pool = nonZero.length > 0 ? nonZero : req.options;

  // 手牌中的招式
  const handMoves = myView.hand.filter((c) => {
    if (!c.id) return false;
    return getCard(c.id).kind === 'move';
  });

  // 計算手牌招式的連擊值重心（avgCombo）
  const avgCombo =
    handMoves.length > 0
      ? handMoves.reduce((sum, c) => sum + (c.id ? getCard(c.id).combo : 5), 0) / handMoves.length
      : 5;

  let bestKey = pool[0].key;
  let bestScore = -Infinity;

  for (const opt of pool) {
    if (!opt.cardId) continue;
    const card = getCard(opt.cardId);

    // 1. 手牌密集端之邊緣牌優先（避免先出中間值卡死後續邊緣牌）
    // 若手牌偏低端（< 5），優先出低端邊緣（1～2）；若偏高端（>= 5），優先出高端邊緣（8～9）
    const edgeScore = avgCombo < 5 ? (9 - card.combo) * 1.8 : card.combo * 1.8;

    // 2. 攻防數值權重
    const statScore = card.atk * 1.2 + card.def * 0.4;

    // 3. [先] 標籤加分：[先] 效果只有在先手步驟才能發動，先手不出就徹底浪費
    const openingTagBonus = card.text.includes('[先]') ? 15 : 0;

    // 4. 手牌連擊接應數：手牌中連擊值與該卡差距 ≤ 2 的卡數量
    let connects = 0;
    for (const hm of handMoves) {
      if (hm.uid === opt.uid || !hm.id) continue;
      const hCard = getCard(hm.id);
      if (hCard.kind === 'move' && Math.abs(hCard.combo - card.combo) <= 2) connects++;
    }
    const connectScore = connects * 2.5;

    const totalScore = edgeScore + statScore + openingTagBonus + connectScore;
    if (totalScore > bestScore) {
      bestScore = totalScore;
      bestKey = opt.key;
    }
  }

  return [bestKey];
}

/**
 * 爆發階段決策：
 * 1. 生命安全防線：牌組剩餘 ≤ 6 張時，禁止主動爆發，避免抽死自己
 * 2. 健康時積極爆發：優先選用不到的裝備（經驗不足/同部位已有）或重複的白板招式換 2 張新牌
 */
export function chooseBurstCard(req: Request, myView: PlayerView): string[] {
  if (req.options.length === 0) return [];
  // 生命安全防線：牌組張數 ≤ 6 張時不爆發
  if (myView.deckCount <= 6) return [];

  let bestKey = req.options[0].key;
  let bestScore = -Infinity;

  for (const opt of req.options) {
    if (!opt.cardId) continue;
    const card = getCard(opt.cardId);
    let discardPriority = 0;

    if (card.kind === 'equip') {
      const slotOccupied = myView.gear.some((g) => g.id && getCard(g.id).slot === card.slot);
      if (slotOccupied) {
        // 同部位已有裝備，很難再打出，高優先放進經驗區
        discardPriority += 25;
      } else if (card.expReq && card.expReq > myView.exp.length + 3) {
        // 經驗需求過高，短時間穿不上
        discardPriority += 18;
      } else {
        discardPriority += 5;
      }
    } else if (card.kind === 'move') {
      // 0 攻 0 防招式優先丟
      if (card.atk === 0 && card.def === 0) discardPriority += 15;
      else if (card.atk <= 1) discardPriority += 8;
      else if (card.def <= 1) discardPriority += 5;
      else discardPriority += 2;

      // 手牌同連擊值招式過多時優先放一張進經驗
      const sameComboCount = myView.hand.filter((h) => {
        if (!h.id || h.uid === opt.uid) return false;
        const c = getCard(h.id);
        return c.kind === 'move' && c.combo === card.combo;
      }).length;
      if (sameComboCount >= 1) discardPriority += 6;
    } else if (card.kind === 'buff') {
      discardPriority += 10;
    }

    if (discardPriority > bestScore) {
      bestScore = discardPriority;
      bestKey = opt.key;
    }
  }

  return [bestKey];
}

/**
 * 增益階段決策：
 * 1. 裝備優先於增益（裝備提供長效戰力）
 * 2. 優先打出經驗需求較高者
 */
export function chooseBuffCard(req: Request): string[] {
  if (req.options.length === 0) return [];

  let bestKey = req.options[0].key;
  let bestScore = -Infinity;

  for (const opt of req.options) {
    if (!opt.cardId) continue;
    const card = getCard(opt.cardId);
    let playScore = 0;

    if (card.kind === 'equip') {
      // 裝備優先
      playScore += 20 + (card.expReq ?? 0) * 3;
    } else {
      // 增益其次
      playScore += 10 + (card.expReq ?? 0) * 2;
    }

    if (playScore > bestScore) {
      bestScore = playScore;
      bestKey = opt.key;
    }
  }

  return [bestKey];
}

/**
 * 觸發窗口與技能決策：
 * 1. 減傷效果：僅在實際受傷（damagePending > 0）時支付費用發動
 * 2. 遊俠瞄準：LV1 頂牌成功則保留；失敗且需要攻擊力時換底
 * 3. 增益/抽牌/直擊等正向效果在費用足夠時積極發動
 */
export function chooseTriggerEffect(req: Request, myView: PlayerView, oppView: PlayerView): string[] {
  const optKeys = req.options.map((o) => o.key);

  // 遊俠瞄準 LV1
  if (req.title.includes('【瞄準】') && optKeys.includes('keep') && optKeys.includes('swap')) {
    const wouldSucceed = req.title.includes('成功');
    if (wouldSucceed) return ['keep'];
    // 若會失敗：若我方當前總攻擊落後對方總防禦（需要攻擊破防），換到牌組底拼一張追擊卡；否則留著拿進手牌
    const needAtk = myView.atk <= oppView.def;
    return needAtk ? ['swap'] : ['keep'];
  }

  // 遊俠瞄準 LV2
  if (optKeys.includes('use') && optKeys.includes('skip')) return ['use'];
  if (optKeys.includes('top') && optKeys.includes('bottom')) return ['top'];

  // 減傷效果判斷
  const incomingDamage = Math.max(0, oppView.atk - myView.def);
  const isDamageReduction = req.title.includes('護甲') || req.title.includes('減少') || req.title.includes('復仇之嚎');

  // 單效果發動確認 (yes/no)
  if (optKeys.includes('yes') && optKeys.includes('no')) {
    if (isDamageReduction && incomingDamage <= 0) return ['no'];
    return ['yes'];
  }

  // 窗口選單 (e0, e1..., end)
  if (optKeys.includes('end')) {
    // 檢查是否有強制效果
    const mandatory = req.options.find((o) => o.label.includes('【強制】'));
    if (mandatory) return [mandatory.key];

    // 尋找有效正面效果
    for (const opt of req.options) {
      if (opt.key === 'end') continue;
      const isDmgRed = opt.label.includes('護甲') || opt.label.includes('減少') || opt.label.includes('減免');
      if (isDmgRed && incomingDamage <= 0) continue;
      return [opt.key];
    }
    return ['end'];
  }

  // 預設選第一個合法項目
  return req.options.slice(0, Math.max(1, req.min)).map((o) => o.key);
}

/** 檢查連擊值在範圍內且不違反重複連擊值限制 */
function canChainMove(combo: number, playedCombos: number[], minRange: number, maxRange: number): boolean {
  if (combo < minRange || combo > maxRange) return false;
  const copies = new Map<number, number>();
  for (const c of playedCombos) copies.set(c, (copies.get(c) ?? 0) + 1);
  const hasDuplicate = [...copies.values()].some((n) => n >= 2);
  if (hasDuplicate && copies.has(combo)) return false;
  return true;
}

/**
 * 反擊步驟出招或收招決策：
 * 1. 划算攻擊評估：以戰鬥區＋手牌易連擊的約 3～4 張招式預估總攻擊；淨破防（總攻 − 對方總防）≥ 3 認定為划算進攻。
 * 2. 收招保留與生存防禦：
 *    - 若無法達成划算進攻（淨傷害 < 3）：
 *      - 若對手威脅高（直接收招受傷 ≥ 4 點）：生存優先，出高防招式（守 > 0）防守減傷。
 *      - 若對手威脅低（受傷 ≤ 3 點）：執行「收招保留」，主動選擇 pass。
 * 3. 動態策略切換：
 *    - 我方手牌比對手多 ≥ 2 張：切換至策略 A（連擊潛力優先），以打出後可連擊招式數最多者優先。
 *    - 否則：採用策略 C（逼退對手優先），以打出後最大程度縮小連擊範圍或封鎖連擊值之卡優先。
 */
export function chooseCounterMove(req: Request, myView: PlayerView, oppView: PlayerView): string[] {
  const moveOptions = req.options.filter((o) => o.key !== 'pass' && o.cardId);
  if (moveOptions.length === 0) return ['pass'];

  // 取得目前雙方招式卡疊的最後一張連擊值與我方已出過的連擊值
  const myPlayedCombos = myView.moves
    .map((m) => (m.id ? getCard(m.id).combo : null))
    .filter((c): c is number => c !== null);
  const oppLastCombo =
    oppView.moves.length > 0 && oppView.moves[oppView.moves.length - 1].id
      ? getCard(oppView.moves[oppView.moves.length - 1].id!).combo
      : null;

  // 手牌中剩餘的招式卡
  const remainingHandMoves = myView.hand.filter((h) => h.id && getCard(h.id).kind === 'move');

  interface CandidateEvaluation {
    opt: (typeof moveOptions)[0];
    candCard: ReturnType<typeof getCard>;
    chainableCount: number;
    projectedNetDmg: number;
  }

  const evaluations: CandidateEvaluation[] = [];

  for (const opt of moveOptions) {
    const candCard = getCard(opt.cardId!);
    const newPlayed = [...myPlayedCombos, candCard.combo];
    const minRange = oppLastCombo !== null ? Math.min(candCard.combo, oppLastCombo) : 1;
    const maxRange = oppLastCombo !== null ? Math.max(candCard.combo, oppLastCombo) : 9;

    // 篩選打出此卡後，手牌中還能接續出招的卡
    const chainable = remainingHandMoves.filter((h) => {
      if (h.uid === opt.uid || !h.id) return false;
      const c = getCard(h.id);
      return canChainMove(c.combo, newPlayed, minRange, maxRange);
    });

    // 估算連擊攻擊力（取攻擊力最高的前 3 張）
    const chainAtk = chainable
      .map((h) => getCard(h.id!).atk)
      .sort((a, b) => b - a)
      .slice(0, 3)
      .reduce((sum, a) => sum + a, 0);

    const projectedAtk = myView.atk + candCard.atk + chainAtk;
    const projectedNetDmg = projectedAtk - oppView.def;

    evaluations.push({
      opt,
      candCard,
      chainableCount: chainable.length,
      projectedNetDmg,
    });
  }

  // 檢查所有候選卡中最優的破防期望
  const maxProjectedNetDmg = Math.max(...evaluations.map((e) => e.projectedNetDmg));
  const isWorthwhile = maxProjectedNetDmg >= 3;

  // 無法達成划算進攻（淨破防 < 3）
  if (!isWorthwhile) {
    const threatDmg = Math.max(0, oppView.atk - myView.def);
    if (threatDmg >= 4) {
      // 生存防線：直接收招受傷 ≥ 4 點，優先打出高防招式防守減傷
      const defensive = evaluations.filter((e) => e.candCard.def > 0);
      if (defensive.length > 0) {
        defensive.sort((a, b) => b.candCard.def - a.candCard.def);
        return [defensive[0].opt.key];
      }
    }
    // 對手也是低攻（受傷 ≤ 3 點）或無防守卡可減傷：執行「收招保留」
    return ['pass'];
  }

  // 可以達成划算進攻：依雙方手牌資源差距切換策略 A 或策略 C
  const handDelta = myView.hand.length - oppView.hand.length;
  const isStrategyA = handDelta >= 2;

  // 動態防禦權重：受傷威脅越重（oppAtk > myDef），防禦權重越高（0.4 ~ 2.0）
  const threat = Math.max(0, oppView.atk - myView.def);
  const defWeight = 0.4 + Math.min(threat, 8) * 0.2;

  let bestKey = evaluations[0].opt.key;
  let bestScore = -Infinity;

  for (const ev of evaluations) {
    const { opt, candCard, chainableCount } = ev;

    // 動態攻擊權重：基礎攻擊力 + 此卡打出後破防溢出攻擊力激勵（breakthrough * 1.5）
    const breakthrough = Math.max(0, myView.atk + candCard.atk - oppView.def);
    const atkScore = candCard.atk * 1.0 + breakthrough * 1.5;
    const defScore = candCard.def * defWeight;

    let score = 0;

    if (isStrategyA) {
      // 策略 A（對手手牌少，全力連擊）：維持較寬開口，最大化自身出招張數
      const newWidth = oppLastCombo !== null ? Math.abs(candCard.combo - oppLastCombo) : 5;
      const openWidthBonus = newWidth * 1.5;
      score = atkScore + defScore + openWidthBonus + chainableCount * 4.0;
    } else {
      // 策略 C（對手手牌多，壓縮連擊範圍迫使對手收招）
      const newWidth = oppLastCombo !== null ? Math.abs(candCard.combo - oppLastCombo) : 5;
      const compressionScore = (9 - newWidth) * 2.2;
      const pinBonus = oppLastCombo !== null && candCard.combo === oppLastCombo ? 6 : 0;
      score = atkScore + defScore + compressionScore + pinBonus + chainableCount * 1.5;
    }

    if (score > bestScore) {
      bestScore = score;
      bestKey = opt.key;
    }
  }

  return [bestKey];
}

/**
 * 啟發式決策入口：
 * 傳入當前提示請求、桌面視角與亂數生成器，回傳選擇的 key 陣列。
 * 若非可識別的智慧場景，回傳 null 以退回基礎隨機回應。
 */
export function smartChoice(req: Request, view: GameView, rng: Rng): string[] | null {
  const myPlayer = req.player;
  const oppPlayer = myPlayer === 0 ? 1 : 0;
  const myView = view.players[myPlayer];
  const oppView = view.players[oppPlayer];

  // 1. 先手步驟出招
  if (isOpeningStep(req, view)) {
    return chooseOpeningMove(req, myView);
  }

  // 2. 反擊步驟出招或收招
  if (isCounterStep(req)) {
    return chooseCounterMove(req, myView, oppView);
  }

  // 3. 爆發階段
  if (isBurstPhase(req, view)) {
    return chooseBurstCard(req, myView);
  }

  // 4. 增益階段
  if (isBuffPhase(req, view)) {
    return chooseBuffCard(req);
  }

  // 5. 觸發窗口與技能
  if (
    req.title.includes('觸發窗口') ||
    req.title.includes('【瞄準】') ||
    req.title.includes('要使用嗎') ||
    req.title.includes('要發動嗎') ||
    req.options.some((o) => o.key === 'yes' || o.key === 'no' || o.key === 'end')
  ) {
    return chooseTriggerEffect(req, myView, oppView);
  }

  return null;
}
