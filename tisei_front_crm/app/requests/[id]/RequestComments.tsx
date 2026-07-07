"use client";

import { useCallback, useEffect, useState } from "react";
import { fetchComments, postComment } from "@/lib/requests-api";
import { initials, formatDate } from "@/lib/labels";
import type { Comment } from "@/lib/types";
import { ApiError } from "@/lib/api";

export function RequestComments({
  requestId,
  canWrite = true,
}: {
  requestId: string;
  canWrite?: boolean;
}) {
  const [items, setItems] = useState<Comment[]>([]);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchComments(requestId);
      setItems(data.items);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Ошибка загрузки комментариев");
    } finally {
      setLoading(false);
    }
  }, [requestId]);

  useEffect(() => {
    void load();
  }, [load]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed) return;
    setSending(true);
    setError("");
    try {
      const comment = await postComment(requestId, trimmed);
      setItems((prev) => [...prev, comment]);
      setText("");
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Не удалось отправить");
    } finally {
      setSending(false);
    }
  };

  return (
    <section className="mt-6 bg-surface-container-lowest border border-outline-variant rounded-xl p-6">
      <h3 className="font-label-md text-outline uppercase mb-4">Комментарии и события</h3>

      {error && <p className="text-error text-body-sm mb-3">{error}</p>}

      {loading ? (
        <p className="text-on-surface-variant text-body-sm">Загрузка...</p>
      ) : items.length === 0 ? (
        <p className="text-on-surface-variant text-body-sm mb-4">Пока нет записей</p>
      ) : (
        <ul className="space-y-4 mb-6 max-h-80 overflow-y-auto custom-scrollbar">
          {items.map((c) => (
            <li key={c.id} className="flex gap-3">
              <div className="w-9 h-9 rounded-full bg-primary-container flex items-center justify-center text-on-primary-container text-xs font-bold shrink-0">
                {c.author ? initials(c.author.fullName) : "•"}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <span className="font-label-md text-on-surface">
                    {c.type === "system_event" ? "Система" : (c.author?.fullName ?? "—")}
                  </span>
                  {c.type === "system_event" && (
                    <span className="text-[10px] uppercase px-2 py-0.5 rounded bg-surface-container-high text-on-surface-variant">
                      событие
                    </span>
                  )}
                  <span className="text-body-sm text-on-surface-variant">{formatDate(c.createdAt)}</span>
                </div>
                <p className="text-body-md whitespace-pre-wrap">{c.text}</p>
              </div>
            </li>
          ))}
        </ul>
      )}

      {canWrite ? (
        <form onSubmit={(e) => void onSubmit(e)} className="flex gap-2">
          <input
            className="flex-1 bg-surface-container-low border border-outline-variant rounded-lg px-4 py-2 text-body-md focus:ring-2 focus:ring-primary-container"
            placeholder="Добавить комментарий..."
            value={text}
            onChange={(e) => setText(e.target.value)}
            disabled={sending}
          />
          <button
            type="submit"
            disabled={sending || !text.trim()}
            className="px-4 py-2 bg-primary text-on-primary font-label-md rounded-lg disabled:opacity-50"
          >
            {sending ? "..." : "Отправить"}
          </button>
        </form>
      ) : (
        <p className="text-body-sm text-on-surface-variant">
          Возьмите заявку в работу, чтобы оставлять комментарии.
        </p>
      )}
    </section>
  );
}
