import { BadRequestError } from '../../common/errors/AppError.js';
import type { UpsertClosingFormBody } from './closing-form.schemas.js';

export function assertClosingFormComplete(body: UpsertClosingFormBody): void {
  const work = body.workPerformed?.trim() ?? '';
  if (!work) {
    throw new BadRequestError('Заполните поле «Что выполнено»');
  }
  if (work.length < 3) {
    throw new BadRequestError('Описание выполненных работ слишком короткое');
  }
  if (body.incomeAmount <= 0) {
    throw new BadRequestError('Укажите сумму прихода больше 0');
  }
  if (body.expenseAmount !== undefined && body.expenseAmount < 0) {
    throw new BadRequestError('Расход не может быть отрицательным');
  }
  if (body.additionalExpenseAmount !== undefined && body.additionalExpenseAmount < 0) {
    throw new BadRequestError('Дополнительный расход не может быть отрицательным');
  }
}

export function isClosingFormComplete(input: {
  workPerformed?: string | null;
  incomeAmount: number;
  expenseAmount: number;
}): boolean {
  const work = input.workPerformed?.trim() ?? '';
  return work.length >= 3 && input.incomeAmount > 0 && input.expenseAmount >= 0;
}
