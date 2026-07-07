"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MSym } from "../../components/symbols";
import { AlertModal, ConfirmModal } from "../../components/Modal";
import { MediaViewer, type MediaViewerItem } from "../../components/MediaViewer";
import { deleteAttachment, fetchAttachments, uploadAttachment } from "@/lib/requests-api";
import { useAuth } from "@/lib/AuthProvider";
import { formatDate } from "@/lib/labels";
import type { Attachment } from "@/lib/types";
import { ApiError } from "@/lib/api";

function formatSize(bytes: number | null) {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function isImage(type: string | null, name: string | null) {
  if (type?.startsWith("image/")) return true;
  return !!name?.match(/\.(jpe?g|png|gif|webp|heic|heif)$/i);
}

function isVideo(type: string | null, name: string | null) {
  if (type?.startsWith("video/")) return true;
  return !!name?.match(/\.(mp4|m4v|mov|webm|avi|3gp)$/i);
}

function toMediaItem(a: Attachment): MediaViewerItem | null {
  if (isImage(a.fileType, a.fileName)) {
    return { id: a.id, url: a.url, fileName: a.fileName, fileType: a.fileType, kind: "image" };
  }
  if (isVideo(a.fileType, a.fileName)) {
    return { id: a.id, url: a.url, fileName: a.fileName, fileType: a.fileType, kind: "video" };
  }
  return null;
}

const MAX_FILE_BYTES = 100 * 1024 * 1024;

function MediaThumb({
  item,
  onOpen,
  onDelete,
  canDelete,
}: {
  item: MediaViewerItem;
  onOpen: () => void;
  onDelete: () => void;
  canDelete: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="group relative aspect-square rounded-xl overflow-hidden border border-outline-variant bg-surface-container-low text-left w-full focus:ring-2 focus:ring-primary focus:outline-none"
    >
      {item.kind === "image" ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={item.url}
          alt={item.fileName ?? "Фото"}
          className="w-full h-full object-cover"
          referrerPolicy="no-referrer"
        />
      ) : (
        <>
          <video
            src={item.url}
            preload="metadata"
            muted
            playsInline
            className="w-full h-full object-cover pointer-events-none"
          />
          <div className="absolute inset-0 flex items-center justify-center bg-black/35">
            <MSym name="play_circle" className="text-white text-[44px]" fill />
          </div>
        </>
      )}

      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
        <p className="text-white text-[10px] truncate">{item.fileName}</p>
      </div>

      {canDelete && (
        <span
          role="button"
          tabIndex={0}
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              e.stopPropagation();
              onDelete();
            }
          }}
          className="absolute top-2 right-2 w-8 h-8 rounded-full bg-error/90 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
          title="Удалить"
          aria-label="Удалить"
        >
          <MSym name="delete" className="text-[16px]" />
        </span>
      )}

      <span className="absolute top-2 left-2 px-1.5 py-0.5 rounded-md bg-black/50 text-white text-[10px] uppercase font-bold pointer-events-none">
        {item.kind === "video" ? "Видео" : "Фото"}
      </span>
    </button>
  );
}

export function RequestAttachments({
  requestId,
  canWrite = true,
}: {
  requestId: string;
  canWrite?: boolean;
}) {
  const { user } = useAuth();
  const canDelete = user?.role === "admin" || user?.role === "manager";
  const fileRef = useRef<HTMLInputElement>(null);
  const [items, setItems] = useState<Attachment[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<Attachment | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [alert, setAlert] = useState<{ title: string; description: string } | null>(null);
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await fetchAttachments(requestId);
      setItems(data.items);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Ошибка загрузки вложений");
    } finally {
      setLoading(false);
    }
  }, [requestId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!success) return;
    const t = setTimeout(() => setSuccess(""), 4000);
    return () => clearTimeout(t);
  }, [success]);

  const media = useMemo(
    () =>
      items
        .map((a) => ({ attachment: a, media: toMediaItem(a) }))
        .filter((x): x is { attachment: Attachment; media: MediaViewerItem } => x.media !== null),
    [items],
  );

  const mediaItems = useMemo(() => media.map((m) => m.media), [media]);

  const images = media.filter((m) => m.media.kind === "image");
  const videos = media.filter((m) => m.media.kind === "video");
  const others = items.filter(
    (a) => !isImage(a.fileType, a.fileName) && !isVideo(a.fileType, a.fileName),
  );

  const openViewer = (id: string) => {
    const idx = mediaItems.findIndex((m) => m.id === id);
    if (idx >= 0) setViewerIndex(idx);
  };

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > MAX_FILE_BYTES) {
      const msg = "Максимальный размер файла — 100 МБ";
      setError(msg);
      setAlert({ title: "Файл слишком большой", description: msg });
      if (fileRef.current) fileRef.current.value = "";
      return;
    }

    setUploading(true);
    setError("");
    setSuccess("");
    try {
      const attachment = await uploadAttachment(requestId, file);
      setItems((prev) => [attachment, ...prev]);
      setSuccess(`«${attachment.fileName ?? file.name}» загружен`);
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "Ошибка загрузки";
      setError(msg);
      setAlert({
        title: "Не удалось загрузить файл",
        description: msg,
      });
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const onDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteAttachment(requestId, deleteTarget.id);
      setItems((prev) => prev.filter((a) => a.id !== deleteTarget.id));
      if (viewerIndex !== null) {
        const deletedIdx = mediaItems.findIndex((m) => m.id === deleteTarget.id);
        if (deletedIdx === viewerIndex) setViewerIndex(null);
        else if (deletedIdx >= 0 && deletedIdx < viewerIndex) {
          setViewerIndex(viewerIndex - 1);
        }
      }
      setDeleteTarget(null);
      setSuccess("Вложение удалено");
    } catch (err) {
      setAlert({
        title: "Ошибка удаления",
        description: err instanceof ApiError ? err.message : "Не удалось удалить файл",
      });
    } finally {
      setDeleting(false);
    }
  };

  const viewerMeta = useCallback(
    (item: MediaViewerItem) => {
      const att = items.find((a) => a.id === item.id);
      if (!att) return "";
      return `${formatSize(att.sizeBytes)} · ${formatDate(att.createdAt)}`;
    },
    [items],
  );

  return (
    <>
      <section className="mt-6 bg-surface-container-lowest border border-outline-variant rounded-xl p-6">
        <div className="flex items-center justify-between gap-4 mb-4">
          <h3 className="font-label-md text-outline uppercase">Вложения</h3>
          <div>
            <input
              ref={fileRef}
              type="file"
              className="hidden"
              accept="image/*,video/mp4,video/quicktime,video/webm,video/3gpp,.mp4,.mov,.webm,.avi,.3gp,.pdf"
              onChange={(e) => void onFile(e)}
              disabled={!canWrite}
            />
            <button
              type="button"
              disabled={uploading || !canWrite}
              onClick={() => fileRef.current?.click()}
              className="flex items-center gap-2 px-3 py-2 bg-primary text-on-primary font-label-md rounded-lg text-sm disabled:opacity-50"
            >
              <MSym name="upload" className="text-[18px]" />
              {uploading ? "Загрузка..." : "Загрузить"}
            </button>
          </div>
        </div>

        <p className="text-[11px] text-on-surface-variant mb-4 -mt-2">
          Фото, видео (MP4, MOV, WebM) или PDF · до 100 МБ · нажмите на превью для просмотра
          {!canWrite && " · загрузка после взятия в работу"}
        </p>

        {uploading && (
          <div className="mb-4 flex items-center gap-3 p-3 rounded-xl bg-primary-container/10 border border-primary-container/20">
            <span className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            <span className="text-body-sm text-on-surface">Загружаем файл...</span>
          </div>
        )}

        {success && (
          <div className="mb-4 flex items-center gap-2 p-3 rounded-xl bg-primary-container/15 text-primary text-body-sm">
            <MSym name="check_circle" className="text-[18px]" />
            {success}
          </div>
        )}

        {error && <p className="text-error text-body-sm mb-3">{error}</p>}

        {loading ? (
          <p className="text-on-surface-variant text-body-sm">Загрузка...</p>
        ) : items.length === 0 ? (
          <div className="text-center py-8 border border-dashed border-outline-variant rounded-xl">
            <MSym name="image" className="text-outline text-[40px] mb-2" />
            <p className="text-on-surface-variant text-body-sm">
              Нет вложений. Загрузите фото, видео или документ (до 100 МБ).
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {images.length > 0 && (
              <div>
                <p className="text-label-md text-outline uppercase mb-3">Фото</p>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                  {images.map(({ attachment, media: m }) => (
                    <MediaThumb
                      key={m.id}
                      item={m}
                      onOpen={() => openViewer(m.id)}
                      onDelete={() => setDeleteTarget(attachment)}
                      canDelete={canDelete}
                    />
                  ))}
                </div>
              </div>
            )}

            {videos.length > 0 && (
              <div>
                <p className="text-label-md text-outline uppercase mb-3">Видео</p>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                  {videos.map(({ attachment, media: m }) => (
                    <MediaThumb
                      key={m.id}
                      item={m}
                      onOpen={() => openViewer(m.id)}
                      onDelete={() => setDeleteTarget(attachment)}
                      canDelete={canDelete}
                    />
                  ))}
                </div>
              </div>
            )}

            {others.length > 0 && (
              <ul className="divide-y divide-outline-variant">
                {others.map((a) => (
                  <li key={a.id} className="py-3 flex items-center justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <a
                        href={a.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-body-md text-primary hover:underline truncate block"
                      >
                        {a.fileName ?? "Файл"}
                      </a>
                      <p className="text-body-sm text-on-surface-variant">
                        {formatSize(a.sizeBytes)} · {formatDate(a.createdAt)}
                      </p>
                    </div>
                    {canDelete && (
                      <button
                        type="button"
                        onClick={() => setDeleteTarget(a)}
                        className="text-error hover:bg-error-container/20 p-2 rounded-lg"
                        title="Удалить"
                      >
                        <MSym name="delete" className="text-[20px]" />
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </section>

      {viewerIndex !== null && mediaItems.length > 0 && (
        <MediaViewer
          items={mediaItems}
          index={viewerIndex}
          onClose={() => setViewerIndex(null)}
          onChangeIndex={setViewerIndex}
          meta={viewerMeta}
        />
      )}

      <ConfirmModal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => void onDelete()}
        title="Удалить вложение?"
        description={
          deleteTarget
            ? `Файл «${deleteTarget.fileName ?? "без имени"}» будет удалён без возможности восстановления.`
            : undefined
        }
        confirmLabel="Удалить"
        loading={deleting}
        destructive
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
