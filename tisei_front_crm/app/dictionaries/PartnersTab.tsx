"use client";

import { useCallback, useEffect, useState } from "react";
import { ConfirmModal, Modal, ModalActions } from "../components/Modal";
import {
  createPartner,
  createPartnerLocation,
  deletePartner,
  deletePartnerLocation,
  fetchPartners,
  updatePartner,
  updatePartnerLocation,
  type PartnerEstablishment,
  type PartnerLocation,
} from "@/lib/partners-api";
import { ApiError } from "@/lib/api";
import { matchesSearch } from "@/lib/search-utils";

export function PartnersTab({ isAdmin, searchQuery = "" }: { isAdmin: boolean; searchQuery?: string }) {
  const [items, setItems] = useState<PartnerEstablishment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [newName, setNewName] = useState("");
  const [newAliases, setNewAliases] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [editItem, setEditItem] = useState<PartnerEstablishment | null>(null);
  const [editName, setEditName] = useState("");
  const [editAliases, setEditAliases] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [addLocationFor, setAddLocationFor] = useState<PartnerEstablishment | null>(null);
  const [editLocation, setEditLocation] = useState<{
    partner: PartnerEstablishment;
    location: PartnerLocation;
  } | null>(null);
  const [deleteLocation, setDeleteLocation] = useState<{
    partnerId: string;
    locationId: string;
  } | null>(null);
  const [locName, setLocName] = useState("");
  const [locCity, setLocCity] = useState("Астана");
  const [locAddress, setLocAddress] = useState("");
  const [locEquipmentQty, setLocEquipmentQty] = useState("");
  const [locMaintenancePrice, setLocMaintenancePrice] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setItems(await fetchPartners(isAdmin, true));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Ошибка загрузки");
    } finally {
      setLoading(false);
    }
  }, [isAdmin]);

  useEffect(() => {
    void load();
  }, [load]);

  const onAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = newName.trim();
    if (!name) return;
    const aliases = newAliases
      .split(",")
      .map((a) => a.trim())
      .filter(Boolean);
    setSaving(true);
    try {
      await createPartner({ name, aliases });
      setNewName("");
      setNewAliases("");
      void load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Не удалось добавить");
    } finally {
      setSaving(false);
    }
  };

  const onToggle = async (item: PartnerEstablishment) => {
    try {
      await updatePartner(item.id, { isActive: !item.isActive });
      void load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Ошибка обновления");
    }
  };

  const onDelete = async () => {
    if (!deleteId) return;
    setDeleting(true);
    try {
      await deletePartner(deleteId);
      setDeleteId(null);
      void load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Не удалось удалить");
    } finally {
      setDeleting(false);
    }
  };

  const openEdit = (item: PartnerEstablishment) => {
    setEditItem(item);
    setEditName(item.name);
    setEditAliases(item.aliases.join(", "));
  };

  const onSaveEdit = async () => {
    if (!editItem) return;
    const name = editName.trim();
    if (!name) return;
    const aliases = editAliases
      .split(",")
      .map((a) => a.trim())
      .filter(Boolean);
    setSaving(true);
    try {
      await updatePartner(editItem.id, { name, aliases });
      setEditItem(null);
      void load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Не удалось сохранить");
    } finally {
      setSaving(false);
    }
  };

  const openAddLocation = (partner: PartnerEstablishment) => {
    setAddLocationFor(partner);
    setLocName("");
    setLocCity("Астана");
    setLocAddress("");
    setLocEquipmentQty("");
    setLocMaintenancePrice("");
  };

  const openEditLocation = (partner: PartnerEstablishment, location: PartnerLocation) => {
    setEditLocation({ partner, location });
    setLocName(location.name);
    setLocCity(location.city);
    setLocAddress(location.address);
    setLocEquipmentQty(
      location.equipmentQuantity != null ? String(location.equipmentQuantity) : "",
    );
    setLocMaintenancePrice(
      location.maintenancePrice != null ? String(location.maintenancePrice) : "",
    );
  };

  const onSaveLocation = async () => {
    const name = locName.trim();
    const city = locCity.trim() || "Астана";
    const address = locAddress.trim();
    if (!name || !address) return;
    const qtyRaw = locEquipmentQty.trim();
    const priceRaw = locMaintenancePrice.trim();
    const equipmentQuantity = qtyRaw === "" ? null : Number(qtyRaw);
    const maintenancePrice = priceRaw === "" ? null : Number(priceRaw);
    if (equipmentQuantity != null && (Number.isNaN(equipmentQuantity) || equipmentQuantity < 0)) {
      setError("Количество оборудования должно быть числом ≥ 0");
      return;
    }
    if (maintenancePrice != null && (Number.isNaN(maintenancePrice) || maintenancePrice < 0)) {
      setError("Цена ТО должна быть числом ≥ 0");
      return;
    }
    setSaving(true);
    try {
      if (addLocationFor) {
        await createPartnerLocation(addLocationFor.id, {
          name,
          city,
          address,
          equipmentQuantity,
          maintenancePrice,
        });
        setExpandedId(addLocationFor.id);
        setAddLocationFor(null);
      } else if (editLocation) {
        await updatePartnerLocation(editLocation.partner.id, editLocation.location.id, {
          name,
          city,
          address,
          equipmentQuantity,
          maintenancePrice,
        });
        setEditLocation(null);
      }
      void load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Не удалось сохранить точку");
    } finally {
      setSaving(false);
    }
  };

  const onToggleLocation = async (partnerId: string, location: PartnerLocation) => {
    try {
      await updatePartnerLocation(partnerId, location.id, { isActive: !location.isActive });
      void load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Ошибка обновления точки");
    }
  };

  const onDeleteLocation = async () => {
    if (!deleteLocation) return;
    setDeleting(true);
    try {
      await deletePartnerLocation(deleteLocation.partnerId, deleteLocation.locationId);
      setDeleteLocation(null);
      void load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Не удалось удалить точку");
    } finally {
      setDeleting(false);
    }
  };

  const filtered = items.filter((item) => {
    if (!searchQuery.trim()) return true;
    const locText = (item.locations ?? []).map((l) => `${l.name} ${l.address} ${l.city}`).join(" ");
    return matchesSearch(searchQuery, item.name, item.aliases.join(" "), locText);
  });

  return (
    <div className="space-y-4">
      <p className="text-body-sm text-on-surface-variant">
        Партнёры-сети (KFC, Hardee&apos;s и т.д.) и их точки с адресами. Раскройте сеть, чтобы
        увидеть и редактировать точки.
      </p>

      {error && <p className="text-error text-body-sm">{error}</p>}

      <form onSubmit={(e) => void onAdd(e)} className="flex flex-col md:flex-row gap-2">
        <input
          className="flex-1 bg-surface-container-low border border-outline-variant rounded-lg px-3 py-2"
          placeholder="Название сети"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
        />
        <input
          className="flex-[2] bg-surface-container-low border border-outline-variant rounded-lg px-3 py-2"
          placeholder="Варианты через запятую: kfc, кфс, kentucky"
          value={newAliases}
          onChange={(e) => setNewAliases(e.target.value)}
        />
        <button
          type="submit"
          disabled={saving}
          className="px-4 py-2 bg-primary text-on-primary rounded-lg disabled:opacity-50"
        >
          Добавить сеть
        </button>
      </form>

      <div className="border border-outline-variant rounded-xl overflow-hidden divide-y divide-outline-variant">
        {loading ? (
          <div className="px-4 py-8 text-center text-on-surface-variant">Загрузка...</div>
        ) : filtered.length === 0 ? (
          <div className="px-4 py-8 text-center text-on-surface-variant">Ничего не найдено</div>
        ) : (
          filtered.map((item) => {
            const expanded = expandedId === item.id;
            const locations = item.locations ?? [];
            return (
              <div key={item.id} className={!item.isActive ? "opacity-50" : undefined}>
                <div className="flex flex-wrap items-center gap-2 px-4 py-3 bg-surface-container-low/40">
                  <button
                    type="button"
                    onClick={() => setExpandedId(expanded ? null : item.id)}
                    className="text-left font-medium flex items-center gap-2 min-w-0 flex-1"
                  >
                    <span className="text-outline w-4 shrink-0">{expanded ? "▾" : "▸"}</span>
                    <span className="truncate">{item.name}</span>
                    {item.isBuiltin && (
                      <span className="text-[10px] uppercase text-outline shrink-0">встроенный</span>
                    )}
                    <span className="text-body-sm text-on-surface-variant shrink-0">
                      {locations.length}{" "}
                      {locations.length === 1 ? "точка" : locations.length < 5 ? "точки" : "точек"}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => void onToggle(item)}
                    className="text-primary text-body-sm hover:underline"
                  >
                    {item.isActive ? "Активен" : "Отключён"}
                  </button>
                  <button
                    type="button"
                    onClick={() => openEdit(item)}
                    className="text-primary text-body-sm hover:underline"
                  >
                    Изменить
                  </button>
                  <button
                    type="button"
                    onClick={() => openAddLocation(item)}
                    className="text-primary text-body-sm hover:underline"
                  >
                    + Точка
                  </button>
                  {!item.isBuiltin && (
                    <button
                      type="button"
                      onClick={() => setDeleteId(item.id)}
                      className="text-error text-body-sm hover:underline"
                    >
                      Удалить
                    </button>
                  )}
                </div>

                {expanded && (
                  <div className="bg-surface">
                    {locations.length === 0 ? (
                      <p className="px-8 py-4 text-body-sm text-on-surface-variant">
                        Точек пока нет. Добавьте первую.
                      </p>
                    ) : (
                      <table className="w-full text-left">
                        <thead>
                          <tr className="border-b border-outline-variant">
                            <th className="px-8 py-2 text-label-md text-outline uppercase font-normal">
                              Точка
                            </th>
                            <th className="px-4 py-2 text-label-md text-outline uppercase font-normal">
                              Город
                            </th>
                            <th className="px-4 py-2 text-label-md text-outline uppercase font-normal">
                              Адрес
                            </th>
                            <th className="px-4 py-2 text-label-md text-outline uppercase font-normal">
                              Техника
                            </th>
                            <th className="px-4 py-2 text-label-md text-outline uppercase font-normal">
                              ТО, ₸
                            </th>
                            <th className="px-4 py-2 text-label-md text-outline uppercase font-normal">
                              Статус
                            </th>
                            <th className="px-4 py-2" />
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-outline-variant">
                          {locations.map((loc) => (
                            <tr
                              key={loc.id}
                              className={!loc.isActive ? "opacity-50" : undefined}
                            >
                              <td className="px-8 py-2.5 font-medium text-body-sm">{loc.name}</td>
                              <td className="px-4 py-2.5 text-body-sm text-on-surface-variant">
                                {loc.city}
                              </td>
                              <td className="px-4 py-2.5 text-body-sm">{loc.address}</td>
                              <td className="px-4 py-2.5 text-body-sm font-mono-data">
                                {loc.equipmentQuantity ?? "—"}
                              </td>
                              <td className="px-4 py-2.5 text-body-sm font-mono-data">
                                {loc.maintenancePrice != null
                                  ? loc.maintenancePrice.toLocaleString("ru-RU")
                                  : "—"}
                              </td>
                              <td className="px-4 py-2.5">
                                <button
                                  type="button"
                                  onClick={() => void onToggleLocation(item.id, loc)}
                                  className="text-primary text-body-sm hover:underline"
                                >
                                  {loc.isActive ? "Активна" : "Отключена"}
                                </button>
                              </td>
                              <td className="px-4 py-2.5 text-right space-x-3 whitespace-nowrap">
                                <button
                                  type="button"
                                  onClick={() => openEditLocation(item, loc)}
                                  className="text-primary text-body-sm hover:underline"
                                >
                                  Изменить
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    setDeleteLocation({
                                      partnerId: item.id,
                                      locationId: loc.id,
                                    })
                                  }
                                  className="text-error text-body-sm hover:underline"
                                >
                                  Удалить
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      <Modal open={!!editItem} onClose={() => setEditItem(null)} title="Изменить партнёра" loading={saving}>
        <div className="space-y-3">
          <input
            className="w-full bg-surface-container-low border border-outline-variant rounded-lg px-3 py-2"
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            placeholder="Название"
          />
          <input
            className="w-full bg-surface-container-low border border-outline-variant rounded-lg px-3 py-2"
            value={editAliases}
            onChange={(e) => setEditAliases(e.target.value)}
            placeholder="Варианты через запятую"
          />
        </div>
        <ModalActions
          onCancel={() => setEditItem(null)}
          onConfirm={() => void onSaveEdit()}
          confirmLabel="Сохранить"
          loading={saving}
          confirmDisabled={!editName.trim()}
        />
      </Modal>

      <Modal
        open={!!addLocationFor || !!editLocation}
        onClose={() => {
          setAddLocationFor(null);
          setEditLocation(null);
        }}
        title={
          editLocation
            ? `Точка — ${editLocation.partner.name}`
            : addLocationFor
              ? `Новая точка — ${addLocationFor.name}`
              : "Точка"
        }
        loading={saving}
      >
        <div className="space-y-3">
          <input
            className="w-full bg-surface-container-low border border-outline-variant rounded-lg px-3 py-2"
            value={locName}
            onChange={(e) => setLocName(e.target.value)}
            placeholder="Название точки (Khan Shatyr, Mega EXPO…)"
          />
          <input
            className="w-full bg-surface-container-low border border-outline-variant rounded-lg px-3 py-2"
            value={locCity}
            onChange={(e) => setLocCity(e.target.value)}
            placeholder="Город"
          />
          <input
            className="w-full bg-surface-container-low border border-outline-variant rounded-lg px-3 py-2"
            value={locAddress}
            onChange={(e) => setLocAddress(e.target.value)}
            placeholder="Адрес"
          />
          <div className="grid grid-cols-2 gap-3">
            <input
              className="w-full bg-surface-container-low border border-outline-variant rounded-lg px-3 py-2"
              type="number"
              min={0}
              value={locEquipmentQty}
              onChange={(e) => setLocEquipmentQty(e.target.value)}
              placeholder="Кол-во оборудования"
            />
            <input
              className="w-full bg-surface-container-low border border-outline-variant rounded-lg px-3 py-2"
              type="number"
              min={0}
              step={0.01}
              value={locMaintenancePrice}
              onChange={(e) => setLocMaintenancePrice(e.target.value)}
              placeholder="Цена ТО, ₸"
            />
          </div>
        </div>
        <ModalActions
          onCancel={() => {
            setAddLocationFor(null);
            setEditLocation(null);
          }}
          onConfirm={() => void onSaveLocation()}
          confirmLabel="Сохранить"
          loading={saving}
          confirmDisabled={!locName.trim() || !locAddress.trim()}
        />
      </Modal>

      <ConfirmModal
        open={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={() => void onDelete()}
        title="Удалить партнёра?"
        description="Все точки сети тоже будут удалены. Заявки сохранятся."
        confirmLabel="Удалить"
        loading={deleting}
        destructive
      />

      <ConfirmModal
        open={!!deleteLocation}
        onClose={() => setDeleteLocation(null)}
        onConfirm={() => void onDeleteLocation()}
        title="Удалить точку?"
        description="Точка будет удалена из справочника."
        confirmLabel="Удалить"
        loading={deleting}
        destructive
      />
    </div>
  );
}
