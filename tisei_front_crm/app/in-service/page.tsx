"use client";

import { AppShell } from "../components/AppShell";
import { ServiceEquipmentTab } from "../dictionaries/ServiceEquipmentTab";
import { useAuth, useRequireAuth } from "@/lib/AuthProvider";
import { useGlobalSearch } from "@/lib/global-search";

export default function InServicePage() {
  useRequireAuth();
  const { user } = useAuth();
  const { debouncedQuery } = useGlobalSearch();
  const isAdmin = user?.role === "admin";

  return (
    <AppShell
      active="in-service"
      mobileActive="profile"
      searchPlaceholder="Поиск по клиенту, оборудованию, заявке..."
      mainClassName="p-container-margin pb-24 md:pb-8"
    >
      <div className="max-w-5xl mx-auto">
        <div className="mb-6">
          <h1 className="font-headline-md text-headline-md text-primary">В сервисе</h1>
          <p className="text-body-md text-on-surface-variant mt-1">
            Оборудование, которое сейчас находится на ремонте в мастерской Береке ТехСервис
          </p>
        </div>
        <ServiceEquipmentTab isAdmin={isAdmin} canManage searchQuery={debouncedQuery} />
      </div>
    </AppShell>
  );
}
