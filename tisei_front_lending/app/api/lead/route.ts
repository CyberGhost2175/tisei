import { NextRequest, NextResponse } from "next/server";

const BACKEND_URL =
  process.env.BACKEND_INTERNAL_URL ??
  process.env.NEXT_PUBLIC_API_URL ??
  "http://localhost:4000/api/v1";

async function createBackendRequest(body: Record<string, unknown>) {
  const res = await fetch(`${BACKEND_URL}/public/requests`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    const message =
      (data as { error?: { message?: string } })?.error?.message ?? "Не удалось создать заявку";
    return { ok: false as const, message, status: res.status };
  }

  return {
    ok: true as const,
    id: (data as { id: string }).id,
    number: (data as { number: string }).number,
  };
}

async function uploadPhoto(requestId: string, file: File) {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch(`${BACKEND_URL}/public/requests/${requestId}/attachments`, {
    method: "POST",
    body: form,
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    const message =
      (data as { error?: { message?: string } })?.error?.message ?? "Не удалось загрузить фото";
    throw new Error(message);
  }
}

export async function POST(request: NextRequest) {
  const contentType = request.headers.get("content-type") ?? "";

  try {
    if (contentType.includes("multipart/form-data")) {
      const fd = await request.formData();
      const clientName = String(fd.get("company") ?? "").trim();
      const phone = String(fd.get("phone") ?? "").trim();
      const address = String(fd.get("address") ?? "").trim();
      const category = String(fd.get("category") ?? "").trim();
      const equipmentName = String(fd.get("model") ?? "").trim();
      const problemDescription = String(fd.get("problem") ?? "").trim();
      const photo = fd.get("photo");

      if (!clientName) {
        return NextResponse.json({ message: "Укажите название компании" }, { status: 400 });
      }
      if (!phone || phone.length < 6) {
        return NextResponse.json({ message: "Укажите телефон" }, { status: 400 });
      }
      if (!address) {
        return NextResponse.json({ message: "Укажите адрес" }, { status: 400 });
      }
      if (!category) {
        return NextResponse.json({ message: "Укажите категорию оборудования" }, { status: 400 });
      }
      if (!problemDescription) {
        return NextResponse.json({ message: "Опишите проблему" }, { status: 400 });
      }

      const created = await createBackendRequest({
        companyOrFullName: clientName,
        phone,
        address,
        equipmentCategoryText: category,
        equipmentName: equipmentName || undefined,
        problemDescription,
      });

      if (!created.ok) {
        return NextResponse.json({ message: created.message }, { status: created.status });
      }

      if (photo instanceof File && photo.size > 0) {
        try {
          await uploadPhoto(created.id, photo);
        } catch (e) {
          return NextResponse.json(
            {
              message:
                e instanceof Error
                  ? `Заявка ${created.number} создана, но фото не загрузилось: ${e.message}`
                  : `Заявка ${created.number} создана, но фото не загрузилось`,
              orderNumber: created.number,
              id: created.id,
            },
            { status: 207 },
          );
        }
      }

      return NextResponse.json({ orderNumber: created.number, id: created.id });
    }

    let body: Record<string, unknown> = {};
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ message: "Некорректные данные" }, { status: 400 });
    }

    const clientName = String(body.clientName ?? body.companyOrFullName ?? "").trim();
    const phone = String(body.clientPhone ?? body.phone ?? "").trim();
    const address = String(body.address ?? "").trim();
    const category = String(body.category ?? body.equipmentCategoryText ?? "").trim();
    const equipmentName = String(body.equipmentName ?? "").trim();
    const problemDescription = String(body.problemDescription ?? "").trim();

    if (!clientName || !phone || phone.length < 6 || !address || !category || !problemDescription) {
      return NextResponse.json({ message: "Заполните все обязательные поля" }, { status: 400 });
    }

    const created = await createBackendRequest({
      companyOrFullName: clientName,
      phone,
      address,
      equipmentCategoryText: category,
      equipmentName: equipmentName || undefined,
      problemDescription,
    });

    if (!created.ok) {
      return NextResponse.json({ message: created.message }, { status: created.status });
    }

    return NextResponse.json({ orderNumber: created.number, id: created.id });
  } catch {
    return NextResponse.json(
      { message: "Сервер недоступен. Попробуйте позже или позвоните нам." },
      { status: 503 },
    );
  }
}
