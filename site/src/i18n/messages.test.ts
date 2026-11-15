import { describe, expect, it } from 'vitest';
import { MESSAGES, fillTemplate } from './messages';
import type { MessageKey } from './messages';

const keys = Object.keys(MESSAGES.en) as MessageKey[];
const placeholders = (text: string) => [...text.matchAll(/\{(\w+)\}/g)].map((match) => match[1]).sort();

describe('interface texts', () => {
  it('exist in both languages for every key', () => {
    expect(Object.keys(MESSAGES.ru).sort()).toEqual([...keys].sort());
    for (const key of keys) {
      expect(MESSAGES.en[key].trim(), key).not.toBe('');
      expect(MESSAGES.ru[key].trim(), key).not.toBe('');
    }
  });

  it('use the same placeholders in both languages', () => {
    for (const key of keys) {
      expect(placeholders(MESSAGES.ru[key]), key).toEqual(placeholders(MESSAGES.en[key]));
    }
  });

  it('are written in Russian wherever the English text has words', () => {
    const sameInBothLanguages = new Set<MessageKey>(['app.title', 'lang.en', 'lang.ru']);
    const hasWords = (text: string) => /[A-Za-z]/.test(text.replace(/\{\w+\}/g, ''));
    const untranslated = keys.filter(
      (key) =>
        !sameInBothLanguages.has(key) &&
        hasWords(MESSAGES.en[key]) &&
        !/[А-Яа-яЁё]/.test(MESSAGES.ru[key]),
    );
    expect(untranslated).toEqual([]);
  });

  it('keep the Commission terms in the English labels', () => {
    expect(MESSAGES.en['metric.uniform_not_issued']).toBe('Uniform visas not issued');
    expect(MESSAGES.en['metric.not_issued_rate']).toBe('Not issued rate');
    expect(MESSAGES.en['metric.mev_issued']).toContain('Multiple-entry visas');
  });

  it('describe figures without evaluative wording', () => {
    const evaluative =
      /dramatic|unfair|alarming|shocking|striking|surge|plunge|collapse|punish|discriminat|драматич|несправедлив|шокир|резк|обвал|рухнул|взлет|взлёт|дискримин|наказ/i;
    for (const locale of ['en', 'ru'] as const) {
      for (const key of keys) expect(MESSAGES[locale][key], `${locale} ${key}`).not.toMatch(evaluative);
    }
  });
});

describe('fillTemplate', () => {
  it('fills placeholders', () => {
    expect(fillTemplate('{metric}, {year}', { metric: 'Not issued rate', year: 2024 })).toBe(
      'Not issued rate, 2024',
    );
  });

  it('refuses a missing parameter instead of printing a gap', () => {
    expect(() => fillTemplate('{metric}, {year}', { metric: 'x' })).toThrow(/year/);
  });
});
