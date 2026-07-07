import { describe, expect, it } from 'vitest';
import { assertClosingFormComplete, isClosingFormComplete } from '../../src/modules/closing-form/validate-closing.js';

describe('validateClosingForm', () => {
  it('accepts complete form', () => {
    expect(
      isClosingFormComplete({
        workPerformed: 'Заменили компрессор',
        incomeAmount: 50_000,
        expenseAmount: 10_000,
      }),
    ).toBe(true);
    expect(() =>
      assertClosingFormComplete({
        workPerformed: 'Заменили компрессор',
        incomeAmount: 50_000,
        expenseAmount: 10_000,
      }),
    ).not.toThrow();
  });

  it('rejects empty work and zero income', () => {
    expect(
      isClosingFormComplete({
        workPerformed: '',
        incomeAmount: 0,
        expenseAmount: 0,
      }),
    ).toBe(false);
    expect(() =>
      assertClosingFormComplete({
        workPerformed: '',
        incomeAmount: 0,
        expenseAmount: 0,
      }),
    ).toThrow('Заполните поле «Что выполнено»');
  });
});
