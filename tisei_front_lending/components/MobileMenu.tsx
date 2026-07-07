"use client";

import { useEffect, useState } from "react";

const LINKS = [
  { href: "#services", label: "Услуги" },
  { href: "#workflow", label: "Как мы работаем" },
  { href: "#cooperation", label: "Сотрудничество" },
  { href: "#reviews", label: "Отзывы" },
  { href: "#contacts", label: "Контакты" },
];

export function MobileMenu() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <div className="md:hidden">
      <button
        type="button"
        aria-label={open ? "Закрыть меню" : "Открыть меню"}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex items-center justify-center w-11 h-11 rounded-[4px] text-on-primary hover:bg-on-primary/10 transition-colors"
      >
        <span
          className={`material-symbols-outlined text-3xl transition-transform duration-300 ${
            open ? "rotate-90" : "rotate-0"
          }`}
        >
          {open ? "close" : "menu"}
        </span>
      </button>

      {open && (
        <>
          <div
            className="fixed inset-0 top-20 z-40 bg-black/50 animate-menu-fade"
            onClick={() => setOpen(false)}
          />
          <nav className="fixed inset-x-0 top-20 z-40 bg-primary border-b border-outline-variant/20 shadow-lg px-5 py-md flex flex-col animate-menu-panel">
            {LINKS.map((l, i) => (
              <a
                key={l.href}
                href={l.href}
                onClick={() => setOpen(false)}
                style={{ animationDelay: `${80 + i * 55}ms` }}
                className="animate-menu-item text-on-primary hover:text-secondary-fixed-dim transition-colors font-label-md text-label-md py-sm border-b border-outline-variant/10 last:border-b-0"
              >
                {l.label}
              </a>
            ))}
            <a
              href="#request"
              onClick={() => setOpen(false)}
              style={{ animationDelay: `${80 + LINKS.length * 55}ms` }}
              className="animate-menu-item mt-md text-center bg-secondary-container text-on-primary px-md py-sm rounded-[2px] font-label-md text-label-md hover:opacity-90 transition-all"
            >
              Оставить заявку
            </a>
          </nav>
        </>
      )}
    </div>
  );
}
