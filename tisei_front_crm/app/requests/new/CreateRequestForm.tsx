"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Sidebar } from "../../components/Sidebar";
import { MobileNav } from "../../components/MobileNav";
import { MSym } from "../../components/symbols";
import { createRequest } from "@/lib/requests-api";
import { fetchDictionary } from "@/lib/dictionaries-api";
import { fetchPartners } from "@/lib/partners-api";
import { useAuth, useRequireAuth } from "@/lib/AuthProvider";
import { PRIORITY_LABELS } from "@/lib/labels";
import type { DictionaryItem, RequestPriority } from "@/lib/types";
import { ApiError } from "@/lib/api";

const PRIORITIES: RequestPriority[] = ["critical", "high", "normal", "low"];
const INPUT_CLS =
  "w-full bg-surface-container-low border border-outline-variant rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-container";

export function CreateRequestForm() {
  useRequireAuth();
  const { user } = useAuth();
  const router = useRouter();
  const [categories, setCategories] = useState<DictionaryItem[]>([]);
  const [malfunctions, setMalfunctions] = useState<DictionaryItem[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [companyOrFullName, setCompanyOrFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [equipmentCategoryId, setEquipmentCategoryId] = useState("");
  const [equipmentName, setEquipmentName] = useState("");
  const [malfunctionTypeId, setMalfunctionTypeId] = useState("");
  const [malfunctionCustomText, setMalfunctionCustomText] = useState("");
  const [problemDescription, setProblemDescription] = useState("");
  const [priority, setPriority] = useState<RequestPriority>("normal");
  const [partnerId, setPartnerId] = useState("");
  const [partners, setPartners] = useState<{ id: string; name: string }[]>([]);

  const canCreate = user?.role === "admin" || user?.role === "manager";

  useEffect(() => {
    async function loadDicts() {
      try {
        const [cats, malf, partnerList] = await Promise.all([
          fetchDictionary("equipment-categories"),
          fetchDictionary("malfunction-types"),
          fetchPartners(),
        ]);
        setCategories(cats);
        setMalfunctions(malf);
        setPartners(partnerList.map((p) => ({ id: p.id, name: p.name })));
      } catch {
        /* optional */
      }
    }
    void loadDicts();
  }, []);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const created = await createRequest({
        companyOrFullName,
        phone,
        email: email || undefined,
        address: address || undefined,
        equipmentCategoryId: equipmentCategoryId || undefined,
        equipmentName: equipmentName || undefined,
        malfunctionTypeId: malfunctionTypeId || undefined,
        malfunctionCustomText: malfunctionCustomText || undefined,
        problemDescription: problemDescription || undefined,
        priority,
        partnerEstablishmentId: partnerId || undefined,
        clientType: "serviced",
      });
      router.push(`/requests/${created.id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Ошибка создания заявки");
    } finally {
      setSaving(false);
    }
  };

  if (!canCreate) {
    return (
      <div className="p-8 md:pl-[260px]">
        <p className="text-error">Недостаточно прав для создания заявки</p>
        <Link href="/requests" className="text-primary underline mt-4 inline-block">
          ← К списку
        </Link>
      </div>
    );
  }

  return (
    <div className="bg-background text-on-surface min-h-screen">
      <Sidebar active="requests" />

      <header className="fixed top-0 left-0 md:left-[240px] right-0 h-16 bg-surface border-b border-outline-variant flex items-center px-container-margin z-30">
        <Link href="/requests" className="text-primary flex items-center gap-2">
          <MSym name="arrow_back" /> Назад
        </Link>
      </header>

      <main className="pt-20 pb-28 md:pb-8 md:pl-[240px] px-container-margin min-h-screen max-w-3xl">
        <h2 className="font-headline-md text-headline-md mb-6">Новая заявка</h2>

        {error && <p className="text-error text-body-sm mb-4">{error}</p>}

        <form onSubmit={(e) => void onSubmit(e)} className="space-y-4">
          <Field label="Клиент / компания *">
            <input
              required
              className={INPUT_CLS}
              value={companyOrFullName}
              onChange={(e) => setCompanyOrFullName(e.target.value)}
            />
          </Field>
          <div className="grid md:grid-cols-2 gap-4">
            <Field label="Телефон *">
              <input
                required
                className={INPUT_CLS}
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+7..."
              />
            </Field>
            <Field label="Email">
              <input
                type="email"
                className={INPUT_CLS}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </Field>
          </div>
          <Field label="Адрес">
            <input className={INPUT_CLS} value={address} onChange={(e) => setAddress(e.target.value)} />
          </Field>
          <div className="grid md:grid-cols-2 gap-4">
            <Field label="Категория оборудования">
              <select
                className={INPUT_CLS}
                value={equipmentCategoryId}
                onChange={(e) => setEquipmentCategoryId(e.target.value)}
              >
                <option value="">—</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Оборудование">
              <input
                className={INPUT_CLS}
                value={equipmentName}
                onChange={(e) => setEquipmentName(e.target.value)}
              />
            </Field>
          </div>
          <Field label="Партнёр-заведение">
            <select
              className={INPUT_CLS}
              value={partnerId}
              onChange={(e) => {
                const id = e.target.value;
                setPartnerId(id);
                if (id) {
                  const p = partners.find((x) => x.id === id);
                  if (p && !companyOrFullName.trim()) setCompanyOrFullName(p.name);
                }
              }}
            >
              <option value="">— не партнёр —</option>
              {partners.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </Field>
          <div className="grid md:grid-cols-2 gap-4">
            <Field label="Тип неисправности">
              <select
                className={INPUT_CLS}
                value={malfunctionTypeId}
                onChange={(e) => setMalfunctionTypeId(e.target.value)}
              >
                <option value="">—</option>
                {malfunctions.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Приоритет">
              <select
                className={INPUT_CLS}
                value={priority}
                onChange={(e) => setPriority(e.target.value as RequestPriority)}
              >
                {PRIORITIES.map((p) => (
                  <option key={p} value={p}>
                    {PRIORITY_LABELS[p]}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <Field label="Другое (неисправность)">
            <input
              className={INPUT_CLS}
              value={malfunctionCustomText}
              onChange={(e) => setMalfunctionCustomText(e.target.value)}
            />
          </Field>
          <Field label="Описание проблемы">
            <textarea
              className={`${INPUT_CLS} min-h-[120px]`}
              value={problemDescription}
              onChange={(e) => setProblemDescription(e.target.value)}
            />
          </Field>

          <button
            type="submit"
            disabled={saving}
            className="w-full md:w-auto px-6 py-3 bg-primary text-on-primary font-label-md rounded-lg disabled:opacity-50"
          >
            {saving ? "Создание..." : "Создать заявку"}
          </button>
        </form>
      </main>

      <MobileNav active="tasks" />
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-label-md text-outline uppercase mb-1 block">{label}</span>
      {children}
    </label>
  );
}
