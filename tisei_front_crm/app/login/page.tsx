"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { login, verify2fa, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/AuthProvider";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { setUser } = useAuth();

  const [email, setEmail] = useState("manager@tisei.kz");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [pendingToken, setPendingToken] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const redirectTo = searchParams.get("from") || "/";

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const result = await login(email, password);
      if ("requires2fa" in result && result.requires2fa) {
        setPendingToken(result.pendingToken);
        return;
      }
      if ("user" in result) {
        setUser(result.user);
        router.replace(redirectTo);
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Ошибка входа");
    } finally {
      setLoading(false);
    }
  };

  const handle2fa = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pendingToken) return;
    setError("");
    setLoading(true);
    try {
      const result = await verify2fa(pendingToken, code);
      setUser(result.user);
      router.replace(redirectTo);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Неверный код");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="w-full max-w-md bg-surface-container-lowest border border-outline-variant rounded-2xl p-8 shadow-lg">
        <div className="mb-8 text-center">
          <img
            src="/bereke-mark.png"
            alt="Береке ТехСервис"
            className="w-16 h-16 rounded-2xl mx-auto mb-4 object-cover shadow-md"
          />
          <h1 className="font-headline-lg text-headline-lg text-primary">Береке ТехСервис</h1>
          <p className="text-on-surface-variant text-body-sm mt-2">CRM · вход в систему управления заявками</p>
        </div>

        {!pendingToken ? (
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-label-md mb-1">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-surface-container-low border border-outline-variant rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary"
                required
              />
            </div>
            <div>
              <label className="block text-label-md mb-1">Пароль</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-surface-container-low border border-outline-variant rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary"
                required
              />
            </div>
            {error && <p className="text-error text-body-sm">{error}</p>}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-primary text-on-primary py-3 rounded-lg font-label-md hover:opacity-90 disabled:opacity-60"
            >
              {loading ? "Вход..." : "Войти"}
            </button>
          </form>
        ) : (
          <form onSubmit={handle2fa} className="space-y-4">
            <p className="text-body-sm text-on-surface-variant">Введите код из приложения-аутентификатора</p>
            <input
              type="text"
              inputMode="numeric"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              className="w-full bg-surface-container-low border border-outline-variant rounded-lg px-3 py-2 text-center text-2xl tracking-widest"
              placeholder="000000"
              required
            />
            {error && <p className="text-error text-body-sm">{error}</p>}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-primary text-on-primary py-3 rounded-lg font-label-md"
            >
              {loading ? "Проверка..." : "Подтвердить"}
            </button>
          </form>
        )}

       
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Загрузка...</div>}>
      <LoginForm />
    </Suspense>
  );
}
