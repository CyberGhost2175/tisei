"use client";

import { useCallback, useEffect, useRef } from "react";
import { MSym } from "./symbols";

export type MediaViewerItem = {
  id: string;
  url: string;
  fileName: string | null;
  fileType: string | null;
  kind: "image" | "video";
};

export function MediaViewer({
  items,
  index,
  onClose,
  onChangeIndex,
  meta,
}: {
  items: MediaViewerItem[];
  index: number;
  onClose: () => void;
  onChangeIndex: (index: number) => void;
  meta?: (item: MediaViewerItem) => string;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const item = items[index];

  const goPrev = useCallback(() => {
    if (items.length <= 1) return;
    onChangeIndex(index === 0 ? items.length - 1 : index - 1);
  }, [index, items.length, onChangeIndex]);

  const goNext = useCallback(() => {
    if (items.length <= 1) return;
    onChangeIndex(index === items.length - 1 ? 0 : index + 1);
  }, [index, items.length, onChangeIndex]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") goPrev();
      if (e.key === "ArrowRight") goNext();
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose, goPrev, goNext]);

  useEffect(() => {
    videoRef.current?.pause();
    if (item?.kind === "video") {
      videoRef.current?.load();
    }
  }, [item?.id, item?.kind]);

  if (!item) return null;

  return (
    <div
      className="fixed inset-0 z-[110] flex flex-col bg-inverse-surface/95"
      role="dialog"
      aria-modal="true"
      aria-label="Просмотр вложения"
    >
      <div className="flex items-center justify-between gap-4 px-4 py-3 shrink-0">
        <div className="min-w-0 flex-1">
          <p className="text-on-primary font-label-md truncate">{item.fileName ?? "Вложение"}</p>
          {meta && (
            <p className="text-on-primary/70 text-body-sm truncate">{meta(item)}</p>
          )}
        </div>
        <p className="text-on-primary/70 text-body-sm shrink-0">
          {index + 1} / {items.length}
        </p>
        <button
          type="button"
          onClick={onClose}
          className="w-10 h-10 rounded-full bg-on-primary/10 hover:bg-on-primary/20 text-on-primary flex items-center justify-center shrink-0"
          aria-label="Закрыть"
        >
          <MSym name="close" className="text-[22px]" />
        </button>
      </div>

      <div className="relative flex-1 flex items-center justify-center min-h-0 px-14 py-4">
        {items.length > 1 && (
          <button
            type="button"
            onClick={goPrev}
            className="absolute left-2 md:left-4 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-on-primary/10 hover:bg-on-primary/20 text-on-primary flex items-center justify-center"
            aria-label="Предыдущее"
          >
            <MSym name="chevron_left" className="text-[28px]" />
          </button>
        )}

        <div className="w-full h-full flex items-center justify-center">
          {item.kind === "image" ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={item.url}
              alt={item.fileName ?? "Фото"}
              className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
              referrerPolicy="no-referrer"
            />
          ) : (
            <video
              ref={videoRef}
              key={item.id}
              src={item.url}
              controls
              autoPlay
              playsInline
              className="max-w-full max-h-full object-contain rounded-lg shadow-2xl bg-black"
            >
              <track kind="captions" />
            </video>
          )}
        </div>

        {items.length > 1 && (
          <button
            type="button"
            onClick={goNext}
            className="absolute right-2 md:right-4 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-on-primary/10 hover:bg-on-primary/20 text-on-primary flex items-center justify-center"
            aria-label="Следующее"
          >
            <MSym name="chevron_right" className="text-[28px]" />
          </button>
        )}
      </div>

      <div
        className="shrink-0 p-4 text-center"
        onClick={onClose}
        role="presentation"
      >
        <p className="text-on-primary/50 text-[11px]">Esc — закрыть · ← → — листать</p>
      </div>
    </div>
  );
}
