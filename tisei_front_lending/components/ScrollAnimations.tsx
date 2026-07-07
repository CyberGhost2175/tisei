"use client";

import { useEffect } from "react";

export function ScrollAnimations() {
  useEffect(() => {
    const els = Array.from(
      document.querySelectorAll<HTMLElement>("section > div"),
    );

    // Dev aid: force all sections visible (used for full-page screenshots).
    if (
      typeof window !== "undefined" &&
      new URLSearchParams(window.location.search).get("reveal") === "all"
    ) {
      els.forEach((el) => el.classList.add("reveal-show"));
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("reveal-show");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.1 },
    );

    els.forEach((el) => {
      el.classList.add("reveal-init");
      observer.observe(el);
    });

    return () => observer.disconnect();
  }, []);

  return null;
}
