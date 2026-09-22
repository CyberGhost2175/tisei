"use client";

import { useState } from "react";
import { MSym } from "../../components/symbols";
import { createActShare } from "@/lib/requests-api";
import { ApiError } from "@/lib/api";

export function ActShareButton({ requestId }: { requestId: string }) {
  const [url, setUrl] = useState("");
  const [pdfUrl, setPdfUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");

  const onShare = async () => {
    setLoading(true);
    setError("");
    setCopied(false);
    try {
      const data = await createActShare(requestId);
      setUrl(data.url);
      setPdfUrl(data.pdfUrl);
      try {
        await navigator.clipboard.writeText(data.url);
        setCopied(true);
        setTimeout(() => setCopied(false), 2500);
      } catch {
        /* clipboard may be blocked — URL still shown */
      }
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Не удалось создать ссылку");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mt-4 p-4 rounded-xl border border-outline-variant bg-surface-container-low space-y-3">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <p className="font-medium text-body-md">Акт выполненных работ</p>
          <p className="text-body-sm text-on-surface-variant mt-0.5">
            Публичная ссылка: проблема, работы, комментарии, запчасти, вложения и итоговая сумма
          </p>
        </div>
        <button
          type="button"
          onClick={() => void onShare()}
          disabled={loading}
          className="flex items-center justify-center gap-2 px-4 py-2.5 bg-primary text-on-primary rounded-lg font-label-md disabled:opacity-50 shrink-0"
        >
          <MSym name="link" className="text-[18px]" />
          {loading ? "Создание..." : copied ? "Ссылка скопирована" : "Скопировать ссылку"}
        </button>
      </div>
      {error && <p className="text-error text-body-sm">{error}</p>}
      {url && (
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            readOnly
            value={url}
            className="flex-1 bg-surface-container-lowest border border-outline-variant rounded-lg px-3 py-2 text-body-sm font-mono"
            onFocus={(e) => e.target.select()}
          />
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="px-4 py-2 rounded-lg border border-outline-variant text-body-sm text-center hover:bg-surface-container"
          >
            Открыть
          </a>
          {pdfUrl && (
            <a
              href={pdfUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2 rounded-lg border border-outline-variant text-body-sm text-center hover:bg-surface-container"
            >
              PDF
            </a>
          )}
        </div>
      )}
    </div>
  );
}
