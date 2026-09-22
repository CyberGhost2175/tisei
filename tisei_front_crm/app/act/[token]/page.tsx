"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { MediaViewer, type MediaViewerItem } from "../../components/MediaViewer";
import { MSym } from "../../components/symbols";
import { API_URL } from "@/lib/types";
import { formatDate } from "@/lib/labels";

type PublicAct = {
  number: string;
  status: string;
  closedAt: string | null;
  createdAt: string;
  companyOrFullName: string;
  phone: string;
  email: string | null;
  address: string | null;
  partnerName: string | null;
  equipmentCategoryName: string | null;
  equipmentName: string | null;
  problemDescription: string | null;
  executors: Array<{ fullName: string }>;
  closing: {
    workPerformed: string | null;
    executorName: string | null;
    confirmedAt: string | null;
    addressSnapshot: string | null;
    incomeAmount: number;
  } | null;
  parts: Array<{
    id: string;
    name: string;
    quantity: number;
    unitPrice: number;
    lineTotal: number;
  }>;
  comments: Array<{
    id: string;
    type: "comment" | "system_event";
    text: string;
    createdAt: string;
    authorName: string | null;
  }>;
  attachments: Array<{
    id: string;
    url: string;
    fileName: string | null;
    fileType: string | null;
    sizeBytes: number | null;
    createdAt: string;
  }>;
};

function isImage(type: string | null, name: string | null) {
  if (type?.startsWith("image/")) return true;
  return !!name?.match(/\.(jpe?g|png|gif|webp|heic|heif)$/i);
}

function isVideo(type: string | null, name: string | null) {
  if (type?.startsWith("video/")) return true;
  return !!name?.match(/\.(mp4|m4v|mov|webm|avi|3gp)$/i);
}

function formatMoney(n: number) {
  return `${n.toLocaleString("ru-RU", { maximumFractionDigits: 2 })} ₸`;
}

export default function PublicActPage() {
  const params = useParams<{ token: string }>();
  const token = params.token;
  const [act, setAct] = useState<PublicAct | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError("");
      try {
        const res = await fetch(`${API_URL}/public/acts/${encodeURIComponent(token)}`);
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(
            (data as { error?: { message?: string } })?.error?.message ?? "Акт не найден",
          );
        }
        if (!cancelled) setAct(data as PublicAct);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Не удалось загрузить акт");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [token]);

  const mediaItems = useMemo(() => {
    if (!act) return [] as MediaViewerItem[];
    return act.attachments
      .map((a): MediaViewerItem | null => {
        if (isImage(a.fileType, a.fileName)) {
          return { id: a.id, url: a.url, fileName: a.fileName, fileType: a.fileType, kind: "image" };
        }
        if (isVideo(a.fileType, a.fileName)) {
          return { id: a.id, url: a.url, fileName: a.fileName, fileType: a.fileType, kind: "video" };
        }
        return null;
      })
      .filter((x): x is MediaViewerItem => x !== null);
  }, [act]);

  const otherFiles = act?.attachments.filter(
    (a) => !isImage(a.fileType, a.fileName) && !isVideo(a.fileType, a.fileName),
  ) ?? [];

  const masterComments = act?.comments.filter((c) => c.type === "comment") ?? [];

  return (
    <div className="min-h-screen bg-surface text-on-surface">
      <header className="border-b border-outline-variant bg-surface-container-lowest">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center gap-3">
          <img
            src="/bereke-mark.png"
            alt="Береке ТехСервис"
            className="w-10 h-10 rounded-lg object-cover"
          />
          <div>
            <p className="font-bold text-primary">Береке ТехСервис</p>
            <p className="text-[11px] text-on-surface-variant uppercase tracking-wider">
              Акт выполненных работ
            </p>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8">
        {loading && <p className="text-on-surface-variant">Загрузка...</p>}
        {error && (
          <div className="rounded-xl border border-error-container bg-error-container/10 p-6 text-center">
            <MSym name="link_off" className="text-error text-[40px] mb-2" />
            <p className="font-medium text-error">{error}</p>
            <p className="text-body-sm text-on-surface-variant mt-2">
              Ссылка могла устареть или заявка ещё не закрыта.
            </p>
          </div>
        )}

        {act && (
          <div className="space-y-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h1 className="font-headline-md text-headline-md text-primary">{act.number}</h1>
                <p className="text-body-sm text-on-surface-variant mt-1">
                  Закрыта: {formatDate(act.closedAt ?? act.closing?.confirmedAt)}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <a
                  href={`${API_URL}/public/acts/${encodeURIComponent(token)}/pdf`}
                  className="px-3 py-1.5 rounded-lg bg-primary text-on-primary text-label-md font-bold hover:opacity-90"
                >
                  Скачать PDF
                </a>
                <span className="px-3 py-1.5 rounded-lg bg-primary-container/20 text-primary text-label-md font-bold">
                  Выполнено
                </span>
              </div>
            </div>

            <section className="bg-surface-container-lowest border border-outline-variant rounded-xl p-5 grid sm:grid-cols-2 gap-4">
              <Info title="Клиент" value={act.companyOrFullName} />
              <Info title="Телефон" value={act.phone} />
              <Info title="Адрес" value={act.closing?.addressSnapshot || act.address || "—"} />
              <Info title="Email" value={act.email || "—"} />
              {act.partnerName && <Info title="Партнёр" value={act.partnerName} />}
              <Info
                title="Оборудование"
                value={
                  [act.equipmentCategoryName, act.equipmentName].filter(Boolean).join(" · ") || "—"
                }
              />
              <Info
                title="Исполнитель"
                value={
                  act.closing?.executorName ||
                  act.executors.map((e) => e.fullName).join(", ") ||
                  "—"
                }
              />
              <Info title="Создана" value={formatDate(act.createdAt)} />
            </section>

            {act.problemDescription && (
              <section className="bg-surface-container-lowest border border-outline-variant rounded-xl p-5">
                <h2 className="font-label-md text-outline uppercase mb-2">Описание проблемы</h2>
                <p className="text-body-md whitespace-pre-wrap">{act.problemDescription}</p>
              </section>
            )}

            <section className="bg-primary-container/10 border border-primary-container/30 rounded-xl p-5">
              <h2 className="font-label-md text-outline uppercase mb-2">Что выполнено</h2>
              <p className="text-body-md whitespace-pre-wrap">
                {act.closing?.workPerformed?.trim() || "—"}
              </p>
            </section>

            {masterComments.length > 0 && (
              <section className="bg-surface-container-lowest border border-outline-variant rounded-xl p-5">
                <h2 className="font-label-md text-outline uppercase mb-4">Комментарии</h2>
                <ul className="space-y-3">
                  {masterComments.map((c) => (
                    <li key={c.id} className="border-b border-outline-variant/60 pb-3 last:border-0 last:pb-0">
                      <p className="text-body-md whitespace-pre-wrap">{c.text}</p>
                      <p className="text-[11px] text-outline mt-1">
                        {c.authorName ?? "Система"} · {formatDate(c.createdAt)}
                      </p>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            <section className="bg-surface-container-lowest border border-outline-variant rounded-xl p-5 overflow-x-auto">
              <h2 className="font-label-md text-outline uppercase mb-4">Запчасти</h2>
              {(act.parts?.length ?? 0) === 0 ? (
                <p className="text-body-sm text-on-surface-variant">Запчасти не списывались</p>
              ) : (
                <table className="w-full text-body-sm min-w-[420px]">
                  <thead>
                    <tr className="border-b border-outline-variant text-left text-outline">
                      <th className="py-2 pr-3 font-medium">Наименование</th>
                      <th className="py-2 px-2 font-medium text-right">Кол-во</th>
                      <th className="py-2 px-2 font-medium text-right">Цена</th>
                      <th className="py-2 pl-2 font-medium text-right">Сумма</th>
                    </tr>
                  </thead>
                  <tbody>
                    {act.parts.map((p) => (
                      <tr key={p.id} className="border-b border-outline-variant/50">
                        <td className="py-2.5 pr-3">{p.name}</td>
                        <td className="py-2.5 px-2 text-right tabular-nums">{p.quantity}</td>
                        <td className="py-2.5 px-2 text-right tabular-nums">
                          {formatMoney(p.unitPrice)}
                        </td>
                        <td className="py-2.5 pl-2 text-right tabular-nums font-medium">
                          {formatMoney(p.lineTotal)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </section>

            <section className="bg-surface-container-lowest border border-outline-variant rounded-xl p-5">
              <h2 className="font-label-md text-outline uppercase mb-4">Вложения</h2>
              {mediaItems.length === 0 && otherFiles.length === 0 ? (
                <p className="text-body-sm text-on-surface-variant">Нет прикреплённых файлов</p>
              ) : (
                <>
                  {mediaItems.length > 0 && (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
                      {mediaItems.map((m, idx) => (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => setViewerIndex(idx)}
                          className="relative aspect-square rounded-xl overflow-hidden border border-outline-variant bg-surface-container-low"
                        >
                          {m.kind === "image" ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={m.url}
                              alt={m.fileName ?? "Фото"}
                              className="w-full h-full object-cover"
                              referrerPolicy="no-referrer"
                            />
                          ) : (
                            <>
                              <video
                                src={m.url}
                                preload="metadata"
                                muted
                                playsInline
                                className="w-full h-full object-cover pointer-events-none"
                              />
                              <div className="absolute inset-0 flex items-center justify-center bg-black/35">
                                <MSym name="play_circle" className="text-white text-[40px]" fill />
                              </div>
                            </>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                  {otherFiles.length > 0 && (
                    <ul className="space-y-2">
                      {otherFiles.map((f) => (
                        <li key={f.id}>
                          <a
                            href={f.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary text-body-sm hover:underline"
                          >
                            {f.fileName ?? "Файл"}
                          </a>
                        </li>
                      ))}
                    </ul>
                  )}
                  <p className="text-[11px] text-on-surface-variant mt-3">
                    Только просмотр. Нажмите на фото или видео, чтобы открыть.
                  </p>
                </>
              )}
            </section>

            {act.closing && (
              <section className="bg-primary/5 border border-primary/20 rounded-xl p-5 flex items-center justify-between gap-4">
                <p className="font-label-md text-outline uppercase">ИТОГ</p>
                <p className="text-headline-md font-bold text-primary tabular-nums">
                  {formatMoney(act.closing.incomeAmount)}
                </p>
              </section>
            )}

            <p className="text-center text-[11px] text-outline pt-4">
              Документ сформирован автоматически · Береке ТехСервис CRM
            </p>
          </div>
        )}
      </main>

      {viewerIndex !== null && mediaItems.length > 0 && (
        <MediaViewer
          items={mediaItems}
          index={viewerIndex}
          onClose={() => setViewerIndex(null)}
          onChangeIndex={setViewerIndex}
        />
      )}
    </div>
  );
}

function Info({ title, value }: { title: string; value: string }) {
  return (
    <div>
      <p className="text-label-md text-outline uppercase mb-1">{title}</p>
      <p className="font-medium text-body-md break-words">{value}</p>
    </div>
  );
}
