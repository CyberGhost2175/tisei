"use client";

import { useRef, useState } from "react";
import { MSym } from "../components/symbols";
import { AlertModal, ConfirmModal } from "../components/Modal";
import { MediaViewer, type MediaViewerItem } from "../components/MediaViewer";
import {
  deleteServiceEquipmentPhoto,
  uploadServiceEquipmentPhoto,
  type ServiceEquipmentAttachment,
} from "@/lib/service-equipment-api";
import { ApiError } from "@/lib/api";

const MAX_FILE_BYTES = 20 * 1024 * 1024;

function isImage(type: string | null, name: string | null) {
  if (type?.startsWith("image/")) return true;
  return !!name?.match(/\.(jpe?g|png|gif|webp|heic|heif)$/i);
}

function toMediaItem(a: ServiceEquipmentAttachment): MediaViewerItem | null {
  if (!isImage(a.fileType, a.fileName)) return null;
  return { id: a.id, url: a.url, fileName: a.fileName, fileType: a.fileType, kind: "image" };
}

export function ServiceEquipmentPhotos({
  serviceEquipmentId,
  attachments,
  canManage,
  onChanged,
}: {
  serviceEquipmentId: string;
  attachments: ServiceEquipmentAttachment[];
  canManage: boolean;
  onChanged: () => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ServiceEquipmentAttachment | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);
  const [alert, setAlert] = useState<{ title: string; description: string } | null>(null);

  const mediaItems = attachments
    .map((a) => toMediaItem(a))
    .filter((m): m is MediaViewerItem => m !== null);

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setAlert({ title: "Неверный формат", description: "Можно загружать только фото (JPG, PNG, WebP и др.)" });
      if (fileRef.current) fileRef.current.value = "";
      return;
    }

    if (file.size > MAX_FILE_BYTES) {
      setAlert({ title: "Файл слишком большой", description: "Максимальный размер фото — 20 МБ" });
      if (fileRef.current) fileRef.current.value = "";
      return;
    }

    setUploading(true);
    try {
      await uploadServiceEquipmentPhoto(serviceEquipmentId, file);
      onChanged();
    } catch (err) {
      setAlert({
        title: "Не удалось загрузить",
        description: err instanceof ApiError ? err.message : "Ошибка загрузки",
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
      await deleteServiceEquipmentPhoto(serviceEquipmentId, deleteTarget.id);
      setDeleteTarget(null);
      if (viewerIndex !== null) setViewerIndex(null);
      onChanged();
    } catch (err) {
      setAlert({
        title: "Ошибка удаления",
        description: err instanceof ApiError ? err.message : "Не удалось удалить фото",
      });
    } finally {
      setDeleting(false);
    }
  };

  return (
    <>
      <div className="mt-3 pt-3 border-t border-outline-variant/60">
        <div className="flex items-center justify-between gap-2 mb-2">
          <p className="text-[11px] font-label-md text-outline uppercase">Фото</p>
          {canManage && (
            <>
              <input
                ref={fileRef}
                type="file"
                className="hidden"
                accept="image/*,.jpg,.jpeg,.png,.webp,.heic,.heif"
                onChange={(e) => void onFile(e)}
                disabled={uploading}
              />
              <button
                type="button"
                disabled={uploading}
                onClick={() => fileRef.current?.click()}
                className="flex items-center gap-1 text-primary text-body-sm hover:underline disabled:opacity-50"
              >
                <MSym name="add_a_photo" className="text-[16px]" />
                {uploading ? "Загрузка..." : "Добавить фото"}
              </button>
            </>
          )}
        </div>

        {mediaItems.length === 0 ? (
          <p className="text-body-sm text-on-surface-variant">Нет фото</p>
        ) : (
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
            {mediaItems.map((m, idx) => (
              <button
                key={m.id}
                type="button"
                onClick={() => setViewerIndex(idx)}
                className="group relative aspect-square rounded-lg overflow-hidden border border-outline-variant bg-surface-container-low"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={m.url}
                  alt={m.fileName ?? "Фото"}
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
                {canManage && (
                  <span
                    role="button"
                    tabIndex={0}
                    onClick={(e) => {
                      e.stopPropagation();
                      const att = attachments.find((a) => a.id === m.id);
                      if (att) setDeleteTarget(att);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        e.stopPropagation();
                        const att = attachments.find((a) => a.id === m.id);
                        if (att) setDeleteTarget(att);
                      }
                    }}
                    className="absolute top-1 right-1 w-7 h-7 rounded-full bg-error/90 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    aria-label="Удалить фото"
                  >
                    <MSym name="delete" className="text-[14px]" />
                  </span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {viewerIndex !== null && mediaItems.length > 0 && (
        <MediaViewer
          items={mediaItems}
          index={viewerIndex}
          onClose={() => setViewerIndex(null)}
          onChangeIndex={setViewerIndex}
        />
      )}

      <ConfirmModal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => void onDelete()}
        title="Удалить фото?"
        description="Фото будет удалено без возможности восстановления."
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
