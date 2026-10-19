import { newCard, type GameCtx } from '../engine/ops';
import type { DeckSpec, GameSetup, PlayerId, ZoneName } from '../engine/types';
import type { TutorialChapter, ZonePresets } from './script';

/**
 * 教學對局的開局設定：指定先攻、不洗牌，開局（抽完起始手牌）後把各區域改寫成牌面配置。
 * 牌組清單要夠抽起始手牌，所以用手牌加牌組；實際的場面以改寫後為準。
 * 預設進各區域的牌是另外放進去的，不計入牌組。
 */
export function chapterSetup(c: TutorialChapter): { decks: [DeckSpec, DeckSpec]; setup: Omit<GameSetup, 'decks' | 'animate'> } {
  const deck = (p: PlayerId): DeckSpec => ({ charId: c.characters[p], cards: [...c.hands[p], ...c.decks[p]] });
  return {
    decks: [deck(0), deck(1)],
    setup: {
      first: c.first,
      seed: 1,
      noShuffle: true,
      ...(c.startPhase && { startPhase: c.startPhase }),
      afterSetup: (g) => {
        for (const p of [0, 1] as PlayerId[]) {
          for (const z of Object.keys(g.state.players[p].zones) as ZoneName[]) g.state.players[p].zones[z] = [];
          put(g, p, 'deck', c.decks[p]);
          put(g, p, 'hand', c.hands[p]);
          presetZones(g, p, c.zones?.[p] ?? {});
        }
      },
    },
  };
}

const put = (g: GameCtx, p: PlayerId, zone: ZoneName, ids: string[]) => ids.forEach((id) => newCard(g, id, p, zone));

function presetZones(g: GameCtx, p: PlayerId, zones: ZonePresets): void {
  for (const zone of ['discard', 'rage', 'gear', 'buff'] as const) put(g, p, zone, zones[zone] ?? []);
  for (const card of zones.exp ?? []) {
    const covered = typeof card !== 'string';
    newCard(g, covered ? card.id : card, p, 'exp').covered = covered;
  }
}
