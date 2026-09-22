"use client";

import { useEffect, useRef, useState } from "react";

export function RequestForm() {
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [orderNumber, setOrderNumber] = useState("");
  const [error, setError] = useState("");
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [photoName, setPhotoName] = useState("");
  const photoRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    return () => {
      if (photoPreview) URL.revokeObjectURL(photoPreview);
    };
  }, [photoPreview]);

  const onPhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (photoPreview) URL.revokeObjectURL(photoPreview);
    if (!file) {
      setPhotoPreview(null);
      setPhotoName("");
      return;
    }
    setPhotoPreview(URL.createObjectURL(file));
    setPhotoName(file.name);
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setStatus("loading");
    setError("");

    const fd = new FormData(e.currentTarget);
    const company = String(fd.get("company") || "").trim();
    const phone = String(fd.get("phone") || "").trim();
    const address = String(fd.get("address") || "").trim();
    const category = String(fd.get("category") || "").trim();
    const problem = String(fd.get("problem") || "").trim();

    if (!company) {
      setError("Укажите название компании");
      setStatus("error");
      return;
    }
    if (!phone || phone.length < 6) {
      setError("Укажите контактный телефон");
      setStatus("error");
      return;
    }
    if (!address) {
      setError("Укажите адрес объекта");
      setStatus("error");
      return;
    }
    if (!category) {
      setError("Укажите категорию оборудования");
      setStatus("error");
      return;
    }
    if (!problem) {
      setError("Опишите проблему");
      setStatus("error");
      return;
    }

    try {
      const res = await fetch("/api/lead", {
        method: "POST",
        body: fd,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as { message?: string }).message ?? "error");
      }
      const data = await res.json();
      setOrderNumber(data.orderNumber);
      setStatus("success");
      if (photoRef.current) photoRef.current.value = "";
      if (photoPreview) URL.revokeObjectURL(photoPreview);
      setPhotoPreview(null);
      setPhotoName("");
    } catch (e) {
      setError(
        e instanceof Error && e.message !== "error"
          ? e.message
          : "Не удалось отправить заявку. Позвоните нам: +7 778 558 0747",
      );
      setStatus("error");
    }
  };

  if (status === "success") {
    return (
      <div className="flex flex-col items-center justify-center text-center py-lg min-h-[420px]">
        <span
          className="material-symbols-outlined text-secondary-container text-6xl mb-md"
          style={{ fontVariationSettings: "'FILL' 1" }}
        >
          task_alt
        </span>
        <h2 className="text-primary font-headline-lg text-headline-lg mb-xs">Заявка принята!</h2>
        <p className="text-on-surface-variant font-body-md mb-md">
          Наш менеджер свяжется с вами в течение 15 минут.
        </p>
        <p className="text-label-md text-on-surface-variant mb-xs">Номер вашей заявки</p>
        <p className="font-headline-md text-secondary-container mb-lg">{orderNumber}</p>
        <button
          className="border border-outline-variant text-primary px-lg py-sm rounded-[4px] font-label-md text-label-md hover:bg-surface-variant transition-colors"
          onClick={() => setStatus("idle")}
          type="button"
        >
          Отправить ещё одну заявку
        </button>
      </div>
    );
  }

  return (
    <>
      <h2 className="text-primary font-headline-lg text-headline-lg mb-md">
        Подать заявку на ремонт
      </h2>
      <aside
        className="mb-md rounded-[4px] border border-error/40 bg-error-container/15 px-md py-sm text-on-surface"
        role="note"
      >
        <p className="font-label-md text-label-md text-error mb-xs">Важно</p>
        <p className="font-body-md text-body-md text-on-surface-variant">
          Если оплата за работу была произведена наличным расчётом мастеру, компания гарантии на
          оказанные услуги не даёт.
        </p>
      </aside>
      <form className="space-y-md" onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-md">
          <div>
            <label className="block text-label-md font-label-md text-on-surface mb-xs">
              Название компании <span className="text-error">*</span>
            </label>
            <input
              name="company"
              className="w-full bg-surface-container-low border border-outline-variant rounded-[2px] p-sm focus:border-secondary-container focus:ring-1 focus:ring-secondary-container outline-none transition-all"
              type="text"
              required
            />
          </div>
          <div>
            <label className="block text-label-md font-label-md text-on-surface mb-xs">
              Контактный телефон <span className="text-error">*</span>
            </label>
            <input
              name="phone"
              className="w-full bg-surface-container-low border border-outline-variant rounded-[2px] p-sm focus:border-secondary-container focus:ring-1 focus:ring-secondary-container outline-none transition-all"
              placeholder="+7 (___) ___-__-__"
              type="tel"
              required
            />
          </div>
        </div>
        <div>
          <label className="block text-label-md font-label-md text-on-surface mb-xs">
            Адрес объекта <span className="text-error">*</span>
          </label>
          <input
            name="address"
            className="w-full bg-surface-container-low border border-outline-variant rounded-[2px] p-sm focus:border-secondary-container focus:ring-1 focus:ring-secondary-container outline-none transition-all"
            type="text"
            required
          />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-md">
          <div>
            <label className="block text-label-md font-label-md text-on-surface mb-xs">
              Категория оборудования <span className="text-error">*</span>
            </label>
            <input
              name="category"
              className="w-full bg-surface-container-low border border-outline-variant rounded-[2px] p-sm focus:border-secondary-container outline-none"
              type="text"
              placeholder="Например: холодильная витрина, пароконвектомат"
              required
            />
          </div>
          <div>
            <label className="block text-label-md font-label-md text-on-surface mb-xs">
              Модель (если известна)
            </label>
            <input
              name="model"
              className="w-full bg-surface-container-low border border-outline-variant rounded-[2px] p-sm focus:border-secondary-container outline-none"
              type="text"
            />
          </div>
        </div>
        <div>
          <label className="block text-label-md font-label-md text-on-surface mb-xs">
            Описание проблемы <span className="text-error">*</span>
          </label>
          <textarea
            name="problem"
            className="w-full bg-surface-container-low border border-outline-variant rounded-[2px] p-sm focus:border-secondary-container outline-none"
            rows={3}
            required
          />
        </div>
        {error && <p className="text-error font-label-md text-label-md">{error}</p>}
        <div className="flex items-center gap-md">
          <label className="flex-1 cursor-pointer bg-surface-container-highest border-2 border-dashed border-outline-variant rounded-[4px] p-md text-center hover:bg-surface-variant transition-colors overflow-hidden">
            <input
              ref={photoRef}
              className="hidden"
              type="file"
              name="photo"
              accept="image/*"
              onChange={onPhotoChange}
            />
            {photoPreview ? (
              <div className="space-y-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={photoPreview}
                  alt="Превью"
                  className="mx-auto max-h-28 rounded object-cover"
                />
                <p className="text-label-md text-on-surface-variant truncate">{photoName}</p>
              </div>
            ) : (
              <>
                <span className="material-symbols-outlined text-outline">add_a_photo</span>
                <p className="text-label-md text-on-surface-variant mt-xs">
                  Прикрепить фото (опционально)
                </p>
              </>
            )}
          </label>
          <button
            className="flex-[2] bg-secondary-container text-on-primary py-lg rounded-[2px] font-headline-md hover:shadow-lg transition-all active:scale-95 disabled:opacity-70"
            type="submit"
            disabled={status === "loading"}
          >
            {status === "loading" ? "Отправка..." : "Отправить заявку"}
          </button>
        </div>
      </form>
    </>
  );
}
