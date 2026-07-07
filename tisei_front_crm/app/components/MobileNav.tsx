import Link from "next/link";
import { filled } from "./symbols";

type MobileKey = "tasks" | "map" | "alerts" | "profile";

const ITEMS: {
  key: MobileKey;
  label: string;
  icon: string;
  href: string;
  dot?: boolean;
}[] = [
  { key: "tasks", label: "Работы", icon: "engineering", href: "/" },
  { key: "map", label: "Карта", icon: "location_on", href: "/map" },
  { key: "alerts", label: "Уведомл.", icon: "notifications", href: "#", dot: true },
  { key: "profile", label: "Профиль", icon: "person", href: "/master" },
];

export function MobileNav({ active }: { active: MobileKey }) {
  return (
    <nav className="fixed bottom-0 left-0 w-full flex justify-around items-center px-4 py-2 bg-surface-container-lowest border-t border-outline-variant z-50 md:hidden">
      {ITEMS.map((item) => {
        const isActive = item.key === active;
        return (
          <Link
            key={item.key}
            href={item.href}
            className={
              isActive
                ? "flex flex-col items-center justify-center bg-primary-container text-on-primary-container rounded-xl p-2 active:scale-90 transition-transform relative"
                : "flex flex-col items-center justify-center text-on-surface-variant p-2 active:scale-90 transition-transform relative"
            }
          >
            <span
              className="material-symbols-outlined"
              style={isActive ? filled : undefined}
            >
              {item.icon}
            </span>
            {item.dot && (
              <span className="absolute top-2 right-2 w-2 h-2 bg-error rounded-full" />
            )}
            <span className="font-label-md text-[10px]">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
