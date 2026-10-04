import { describe, expect, it } from 'vitest';

import { SignedConnectionStates } from './signed-connection-states.ts';

const KEY = Buffer.alloc(32, 5).toString('base64');
const ADA = '00000000-0000-4000-8000-00000000000a';
const BOB = '00000000-0000-4000-8000-00000000000b';

function clock(start = Date.UTC(2026, 9, 4, 8)) {
  let now = start;
  return {
    now: () => new Date(now),
    advance: (minutes: number) => {
      now += minutes * 60_000;
    },
  };
}

describe('SignedConnectionStates', () => {
  it('gives a new state each time, which belongs to its Visitor only', () => {
    const states = new SignedConnectionStates(KEY, clock().now);

    const [first, second] = [states.issue(ADA), states.issue(ADA)];

    expect(first).not.toBe(second);
    expect(states.belongsTo(first, ADA)).toBe(true);
    expect(states.belongsTo(first, BOB)).toBe(false);
  });

  it('refuses a state older than fifteen minutes', () => {
    const time = clock();
    const states = new SignedConnectionStates(KEY, time.now);
    const state = states.issue(ADA);

    time.advance(14);
    expect(states.belongsTo(state, ADA)).toBe(true);
    time.advance(2);
    expect(states.belongsTo(state, ADA)).toBe(false);
  });

  it('refuses a state altered, made with another key, or not a state at all', () => {
    const time = clock();
    const state = new SignedConnectionStates(KEY, time.now).issue(ADA);
    const states = new SignedConnectionStates(KEY, time.now);

    expect(states.belongsTo(`${state.slice(0, -1)}A`, ADA)).toBe(false);
    expect(
      new SignedConnectionStates(Buffer.alloc(32, 6).toString('base64'), time.now).belongsTo(
        state,
        ADA,
      ),
    ).toBe(false);
    expect(states.belongsTo('nonsense', ADA)).toBe(false);
  });
});
