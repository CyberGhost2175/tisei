"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { MSym } from "../../components/symbols";
import { AlertModal, ConfirmModal } from "../../components/Modal";
import { confirmClosingForm, fetchClosingForm, saveClosingForm } from "@/lib/requests-api";
import { fetchRequestPartUsages } from "@/lib/parts-api";
import type { ClosingFormData } from "@/lib/types";
import { ApiError } from "@/lib/api";

const fmt = (n: number) => `${Math.round(n).toLocaleString("ru-RU")} ₸`;

function validateForm(input: {
  income: number;
  expense: number;
  workPerformed: string;
}): string | null {
  if (input.income <= 0) return "Укажите сумму прихода больше 0";
  if (input.expense < 0) return "Расход не может быть отрицательным";
  const work = input.workPerformed.trim();
  if (!work) return "Заполните поле «Что выполнено»";
  if (work.length < 3) return "Описание выполненных работ слишком короткое";
  return null;
}

export function ClosingForm({
  requestId,
  onClosed,
  reloadKey = 0,
  /** Доля в кассу: 0.1 штатный, 0.2 партнёрский мастер */
  companyCommissionRate = 0.1,
}: {
  requestId: string;
  onClosed?: () => void;
  reloadKey?: number;
  companyCommissionRate?: number;
}) {
  const router = useRouter();
  const [form, setForm] = useState<ClosingFormData | null>(null);
  const [income, setIncome] = useState(0);
  const [expense, setExpense] = useState(0);
  const [partsExpense, setPartsExpense] = useState(0);
  const [workPerformed, setWorkPerformed] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [alert, setAlert] = useState<{ title: string; description: string } | null>(null);

  const cashRate =
    form?.companyCommissionRate ?? companyCommissionRate;
  const masterRate = form?.executorPayoutRate ?? 1 - cashRate;
  const cashPct = Math.round(cashRate * 100);
  const masterPct = Math.round(masterRate * 100);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await fetchClosingForm(requestId);
      setForm(data);
      setIncome(data.incomeAmount);
      setExpense(data.expenseAmount);
      setPartsExpense(data.partsExpenseAmount);
      setWorkPerformed(data.workPerformed ?? "");
    } catch (e) {
      if (e instanceof ApiError && e.status === 404) {
        setForm(null);
        try {
          const usages = await fetchRequestPartUsages(requestId);
          const partsTotal = usages.reduce((sum, u) => sum + u.lineTotal, 0);
          setPartsExpense(partsTotal);
          setExpense(partsTotal);
          setIncome(0);
          setWorkPerformed("");
        } catch {
          setPartsExpense(0);
          setExpense(0);
        }
      } else {
        setError(e instanceof ApiError ? e.message : "Ошибка загрузки анкеты");
      }
    } finally {
      setLoading(false);
    }
  }, [requestId]);

  useEffect(() => {
    void load();
  }, [load, reloadKey]);

  const calculated = useMemo(() => {
    const profit = income - expense;
    return {
      profit,
      executorPayout: profit * masterRate,
      companyCommission: profit * cashRate,
    };
  }, [income, expense, masterRate, cashRate]);

  const isFormComplete = useMemo(
    () => !validateForm({ income, expense, workPerformed }),
    [income, expense, workPerformed],
  );

  const onSave = async () => {
    setSaving(true);
    setError("");
    setFieldError(null);
    try {
      const saved = await saveClosingForm(requestId, {
        workPerformed,
        incomeAmount: income,
        expenseAmount: expense,
      });
      setForm(saved);
      setIncome(saved.incomeAmount);
      setExpense(saved.expenseAmount);
      setPartsExpense(saved.partsExpenseAmount);
      setWorkPerformed(saved.workPerformed ?? "");
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Ошибка сохранения");
    } finally {
      setSaving(false);
    }
  };

  const onRequestClose = () => {
    const validationError = validateForm({ income, expense, workPerformed });
    if (validationError) {
      setFieldError(validationError);
      setAlert({
        title: "Форма не заполнена",
        description: `${validationError}. Заполните все поля — калькуляция выполнится автоматически.`,
      });
      return;
    }
    setFieldError(null);
    setShowConfirm(true);
  };

  const onConfirm = async () => {
    setSaving(true);
    try {
      const saved = await confirmClosingForm(requestId, {
        workPerformed: workPerformed.trim(),
        incomeAmount: income,
        expenseAmount: expense,
      });
      setForm(saved);
      setShowConfirm(false);
      setShowSuccess(true);
    } catch (e) {
      setShowConfirm(false);
      setAlert({
        title: "Не удалось закрыть заявку",
        description: e instanceof ApiError ? e.message : "Ошибка подтверждения",
      });
    } finally {
      setSaving(false);
    }
  };

  const goHome = () => {
    setShowSuccess(false);
    if (onClosed) onClosed();
    else router.push("/");
  };

  useEffect(() => {
    if (!showSuccess) return;
    const t = setTimeout(goHome, 1800);
    return () => clearTimeout(t);
  }, [showSuccess, onClosed, router]);

  const locked = form?.isLocked ?? false;

  const stats = locked && form
    ? {
        profit: form.profit,
        executorPayout: form.executorPayout,
        companyCommission: form.companyCommission,
      }
    : calculated;

  const confirmDescription = (
    <div className="space-y-3 text-left">
      <p>Вы уверены, что хотите закрыть заявку? После закрытия финансовые данные изменить будет нельзя.</p>
      <div className="rounded-lg bg-surface-container-low p-3 text-body-sm space-y-1 font-mono-data">
        <p>Приход: {fmt(income)}</p>
        <p>Расход: {fmt(expense)}</p>
        {partsExpense > 0 && <p className="text-on-surface-variant">В т.ч. запчасти: {fmt(partsExpense)}</p>}
        <p className="font-bold text-primary">Прибыль: {fmt(calculated.profit)}</p>
        <p>Мастеру ({masterPct}%): {fmt(calculated.executorPayout)}</p>
        <p>В кассу ({cashPct}%): {fmt(calculated.companyCommission)}</p>
      </div>
    </div>
  );

  return (
    <>
      <section className="bg-primary-container/10 border-2 border-primary-container rounded-xl p-gutter overflow-hidden relative mt-6">
        <div className="absolute top-0 right-0">
          <span className="bg-primary-container text-on-primary px-3 py-1 text-[10px] font-bold uppercase tracking-wider rounded-bl-lg">
            Форма закрытия {locked ? "· подтверждена" : ""}
          </span>
        </div>
        <div className="flex items-center gap-2 mb-4">
          <MSym name="account_balance_wallet" className="text-primary-container" />
          <h3 className="font-headline-sm text-headline-sm text-on-primary-fixed-variant">Закрытие</h3>
        </div>
        {error && <p className="text-error mb-3">{error}</p>}
        {fieldError && <p className="text-error mb-3">{fieldError}</p>}
        {loading ? <p>Загрузка...</p> : null}
        {!locked && (
          <p className="text-body-sm text-on-surface-variant mb-4">
            Для закрытия заявки заполните приход, расход и описание работ. Калькуляция обновляется автоматически.
          </p>
        )}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-gutter mb-6">
          <div className="space-y-2">
            <label className="font-label-md text-on-surface-variant">Приход *</label>
            <input
              className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-4 py-3 font-mono-data text-headline-sm"
              type="number"
              min={0}
              step={1}
              value={income}
              disabled={locked || saving}
              onChange={(e) => setIncome(Number(e.target.value) || 0)}
            />
          </div>
          <div className="space-y-2">
            <label className="font-label-md text-on-surface-variant">Расход</label>
            <input
              className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-4 py-3 font-mono-data text-headline-sm"
              type="number"
              min={0}
              step={1}
              value={expense}
              disabled={locked || saving}
              onChange={(e) => setExpense(Number(e.target.value) || 0)}
            />
            {partsExpense > 0 && (
              <p className="text-[11px] text-on-surface-variant">
                В т.ч. запчасти со склада: <span className="font-mono-data">{fmt(partsExpense)}</span>
              </p>
            )}
          </div>
        </div>
        <div className="space-y-2 mb-6">
          <label className="font-label-md text-on-surface-variant">Что выполнено *</label>
          <textarea
            className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-4 py-3"
            rows={4}
            value={workPerformed}
            disabled={locked || saving}
            onChange={(e) => setWorkPerformed(e.target.value)}
            placeholder="Опишите выполненные работы..."
          />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-gutter mb-6">
          <StatCard label="Прибыль" value={fmt(stats.profit)} />
          <StatCard label={`Мастеру (${masterPct}%)`} value={fmt(stats.executorPayout)} accent />
          <StatCard label={`В кассу (${cashPct}%)`} value={fmt(stats.companyCommission)} />
        </div>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => void onSave()}
            disabled={locked || saving}
            className="px-4 py-2 rounded-lg bg-primary text-on-primary disabled:opacity-50"
          >
            Сохранить
          </button>
          <button
            type="button"
            onClick={onRequestClose}
            disabled={locked || saving || !isFormComplete}
            className="px-4 py-2 rounded-lg border border-outline-variant disabled:opacity-50"
            title={!isFormComplete ? "Заполните все обязательные поля" : undefined}
          >
            Подтвердить и закрыть
          </button>
        </div>
      </section>

      <ConfirmModal
        open={showConfirm}
        onClose={() => setShowConfirm(false)}
        onConfirm={() => void onConfirm()}
        title="Вы уверены, что хотите закрыть заявку?"
        description={confirmDescription}
        confirmLabel="Да, закрыть заявку"
        loading={saving}
      />

      <AlertModal
        open={showSuccess}
        onClose={goHome}
        title="Заявка закрыта"
        description="Данные сохранены. Вы будете перенаправлены на главную."
        tone="success"
      />

      <AlertModal
        open={!!alert}
        onClose={() => setAlert(null)}
        title={alert?.title ?? ""}
        description={alert?.description}
        tone="danger"
      />
    </>
  );
}

function StatCard({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div
      className={`p-4 rounded-xl border ${accent ? "bg-secondary-container/20 border-secondary-container/30" : "bg-surface-container-high border-outline-variant"}`}
    >
      <label className="text-[10px] uppercase font-bold text-on-surface-variant mb-1 block">{label}</label>
      <p className="font-mono-data text-headline-md font-bold">{value}</p>
    </div>
  );
}
