import { expect, it } from 'vitest';
import { addBreaks } from '../src/engine/combat';
import { diffFlights } from '../src/engine/flights';
import { viewFor } from '../src/engine/view';
import { atkOf, defOf, matchScenario, pick, scenario } from './helpers';

it('特技出招確認前可取消，確認後可將範圍外的招式打入特技區', () => {
  const g = scenario({
    singlePhase: true,
    p0: { hand: ['黑桃5', '黑桃9', '梅花9', '紅心2'] },
    p1: { hand: ['黑桃6', '梅花6'] },
  });

  pick(g, '黑桃5');
  expect(g.pending?.options.map((o) => o.key)).not.toContain('stunt');
  pick(g, '黑桃6');
  expect(g.pending?.options.map((o) => o.key)).toContain('stunt');
  pick(g, '特技出招');
  expect(g.pending?.dropZone).toBe('stunt');
  expect(g.pending?.options.map((o) => o.label)).toEqual(['黑桃9', '梅花9', '取消']);
  pick(g, '梅花9');
  expect(g.pending?.options.map((o) => o.label)).toEqual(['黑桃9', '取消']);
  pick(g, '取消');
  expect(g.state.players[0].zones.hand.map((c) => c.id)).toEqual(['黑桃9', '梅花9', '紅心2']);
  pick(g, '特技出招');
  pick(g, '梅花9');
  pick(g, '黑桃9');
  pick(g, '確認特技出招');
  expect(g.state.flags.breaksRemaining).toEqual([0, 1]);
  expect(g.state.players[0].zones.discard.map((c) => c.id)).toEqual(['黑桃9']);
  expect(g.state.players[0].zones.stunt.map((c) => c.id)).toEqual(['梅花9']);
  expect(g.pending?.player).toBe(1);
  expect(g.pending?.title).toContain('上一招「梅花9」');
  expect(g.pending?.options.map((o) => o.label)).toContain('梅花6');
});

it('特技與普通招式各自判定頂牌，新特技只取代特技疊的頂牌', () => {
  const g = scenario({
    chars: ['刺客', '勇者'],
    singlePhase: true,
    p0: { hand: ['黑桃5', '梅花5', '戒備打擊', '戒備打擊', '黑桃9', '梅花9', '方塊6'] },
    p1: { hand: ['黑桃6', '梅花6', '紅心6', '黑桃7'] },
  });
  pick(g, '黑桃5');
  pick(g, '黑桃6');
  pick(g, '特技出招');
  pick(g, '戒備打擊');
  pick(g, '梅花5');
  pick(g, '確認特技出招');
  addBreaks(g, 0, 2);
  pick(g, '梅花6');
  pick(g, '戒備打擊');

  const expectedAtk = atkOf('黑桃5') + 2 * atkOf('戒備打擊');
  const expectedDef = defOf('黑桃5') + 2 * defOf('戒備打擊');
  expect(viewFor(g, 0).players[0]).toMatchObject({ atk: expectedAtk + 2, def: expectedDef + 4 });

  pick(g, '特技出招');
  pick(g, '梅花9');
  pick(g, '黑桃9');
  pick(g, '確認特技出招');
  expect(viewFor(g, 0).players[0]).toMatchObject({
    atk: expectedAtk + atkOf('梅花9') + 1,
    def: expectedDef + defOf('梅花9') + 2,
  });
  expect(g.state.flags.breaksRemaining[0]).toBe(0);
});

it.each([0, 1] as const)('席位 %s 的選牌保持私密，確認後兩邊收到相同公開牌與移動', (first) => {
  const hands = [
    { hand: ['黑桃5', '黑桃9', '梅花9'], deck: Array(20).fill('紅心2') },
    { hand: ['黑桃6', '梅花6'], deck: Array(20).fill('紅心2') },
  ];
  const foe = first === 0 ? 1 : 0;
  const match = matchScenario({ first, singlePhase: true, p0: hands[first], p1: hands[foe] });
  const submit = (label: string) => {
    const req = match.pending!;
    const option = req.options.find((o) => o.label === label);
    expect(option).toBeDefined();
    const result = match.submit(req.player, [option!.key]);
    expect(result.error).toBeNull();
    return result.update;
  };

  submit('黑桃5');
  submit('黑桃6');
  const choosingMove = submit('特技出招');
  expect(choosingMove[first].view.prompt?.dropZone).toBe('stunt');
  const selecting = submit('梅花9');
  expect(selecting[first].view.prompt?.dropZone).toBeUndefined();
  expect(selecting[foe].view.prompt).toBeNull();
  expect(selecting[foe].view.players[first].hand.map((c) => c.id)).toEqual([null, null]);
  expect(match.submit(foe, [match.pending!.options[0].key]).error).not.toBeNull();
  expect(match.submit(first, ['invalid']).error).not.toBeNull();
  const cancelled = submit('取消');
  expect(cancelled[first].view.players[first].hand.map((c) => c.id)).toEqual(['黑桃9', '梅花9']);

  submit('特技出招');
  submit('梅花9');
  submit('黑桃9');
  const played = submit('確認特技出招');
  for (const seat of played) {
    expect(seat.view.players[first].stunt.map((c) => c.id)).toEqual(['梅花9']);
    expect(seat.view.players[first].discard.map((c) => c.id)).toEqual(['黑桃9']);
    const index = seat.frames.findIndex((f) => f.fx.type === 'play');
    const flights = diffFlights(selecting[seat.view.me].view, seat.frames[index].view);
    expect(flights).toEqual(expect.arrayContaining([
      expect.objectContaining({ from: 'hand', to: 'stunt', id: '梅花9', faceUpFrom: seat.view.me === first }),
      expect.objectContaining({ from: 'hand', to: 'discard', id: '黑桃9', faceUpFrom: seat.view.me === first }),
    ]));
  }

  const ended = submit('收招');
  for (const seat of ended) {
    const index = seat.frames.findIndex((f) => f.fx.type === 'return');
    expect(seat.frames[index].view.players[first].exp.slice(-3).map((c) => c.id)).toEqual(['黑桃5', '梅花9', '紅心2']);
    const returning = diffFlights(seat.frames[index - 1].view, seat.frames[index].view).filter((f) => f.owner === first && f.to === 'exp');
    expect(returning.map(({ from, order }) => [from, order])).toEqual([['moves', 0], ['stunt', 1], ['pursuit', 2]]);
  }
});

it('特技區頂牌的卡面效果在對方反擊時發動，並依卡文移到招式卡疊', () => {
  const g = scenario({
    chars: ['刺客', '勇者'],
    singlePhase: true,
    p0: { hand: ['黑桃5', '黑桃7', '煙霧陷阱', '黑桃6'] },
    p1: { hand: ['黑桃6', '梅花6'] },
  });
  pick(g, '黑桃5');
  pick(g, '黑桃6');
  pick(g, '特技出招');
  pick(g, '煙霧陷阱');
  pick(g, '黑桃7');
  pick(g, '確認特技出招');
  expect(viewFor(g, 0).players[0].stunt.map((c) => c.id)).toEqual(['煙霧陷阱']);
  pick(g, '梅花6');
  expect(viewFor(g, 0).players[0].stunt).toEqual([]);
  expect(viewFor(g, 0).players[0].moves.map((c) => c.id)).toEqual(['煙霧陷阱', '黑桃5']);
});
