import { describe, expect, it } from 'vitest';

import type { SecondFactors } from '../domain/identity.ts';
import { rememberedSecondFactors } from './remembered-second-factors.ts';

function source(answers: (boolean | Error)[]) {
  let asked = 0;
  const inner: SecondFactors = {
    has: () => {
      const answer = answers[Math.min(asked, answers.length - 1)];
      asked += 1;
      return answer instanceof Error ? Promise.reject(answer) : Promise.resolve(answer ?? false);
    },
  };
  return { inner, asked: () => asked };
}

function clock() {
  let now = 0;
  return {
    now: () => now,
    advance: (seconds: number) => {
      now += seconds * 1000;
    },
  };
}

describe('rememberedSecondFactors', () => {
  it('asks once a minute per Visitor', async () => {
    const { inner, asked } = source([true, false]);
    const time = clock();
    const factors = rememberedSecondFactors(inner, time.now);

    expect(await factors.has('ada')).toBe(true);
    time.advance(59);
    expect(await factors.has('ada')).toBe(true);
    expect(asked()).toBe(1);

    time.advance(2);
    expect(await factors.has('ada')).toBe(false);
    expect(asked()).toBe(2);
  });

  it('fails when asking fails past the minute', async () => {
    const { inner } = source([true, new Error('down')]);
    const time = clock();
    const factors = rememberedSecondFactors(inner, time.now);
    await factors.has('ada');

    time.advance(30);
    expect(await factors.has('ada')).toBe(true);

    time.advance(31);
    await expect(factors.has('ada')).rejects.toThrow('down');
    await expect(factors.has('bob')).rejects.toThrow('down');
  });
});
