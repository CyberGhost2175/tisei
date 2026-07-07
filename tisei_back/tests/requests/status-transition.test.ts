import { describe, it, expect } from 'vitest';
import {
  canTransition,
  allowedTransitions,
} from '../../src/modules/requests/status-transition.service.js';
import { InvalidStatusTransitionError } from '../../src/common/errors/AppError.js';
import { assertTransition } from '../../src/modules/requests/status-transition.service.js';

describe('status transition graph', () => {
  it('allows valid transitions from new', () => {
    expect(canTransition('new', 'in_progress')).toBe(true);
    expect(canTransition('new', 'frozen')).toBe(true);
    expect(canTransition('new', 'cancelled')).toBe(true);
    expect(canTransition('new', 'closed')).toBe(false);
  });

  it('allows valid transitions from in_progress', () => {
    expect(canTransition('in_progress', 'awaiting_parts')).toBe(true);
    expect(canTransition('in_progress', 'frozen')).toBe(true);
    expect(canTransition('in_progress', 'closed')).toBe(true);
  });

  it('allows awaiting_parts → in_progress and frozen', () => {
    expect(canTransition('awaiting_parts', 'in_progress')).toBe(true);
    expect(canTransition('awaiting_parts', 'frozen')).toBe(true);
    expect(canTransition('awaiting_parts', 'closed')).toBe(false);
  });

  it('allows frozen → in_progress and cancelled', () => {
    expect(canTransition('frozen', 'in_progress')).toBe(true);
    expect(canTransition('frozen', 'cancelled')).toBe(true);
  });

  it('blocks transitions from final states', () => {
    expect(canTransition('closed', 'in_progress')).toBe(false);
    expect(canTransition('cancelled', 'new')).toBe(false);
    expect(allowedTransitions('closed')).toEqual([]);
    expect(allowedTransitions('cancelled')).toEqual([]);
  });

  it('rejects same-status transition', () => {
    expect(canTransition('new', 'new')).toBe(false);
  });

  it('assertTransition throws InvalidStatusTransitionError with 409 semantics', () => {
    expect(() => assertTransition('closed', 'in_progress')).toThrow(InvalidStatusTransitionError);
    try {
      assertTransition('new', 'closed');
    } catch (e) {
      expect(e).toBeInstanceOf(InvalidStatusTransitionError);
      expect((e as InvalidStatusTransitionError).statusCode).toBe(409);
    }
  });
});
