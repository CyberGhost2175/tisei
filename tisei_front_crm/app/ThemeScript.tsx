import Script from "next/script";

/** Тема из cookie пользователя — до гидратации React. */
const THEME_INIT = `(function(){try{var m=document.cookie.match(/(?:^|; )tisei_theme=([^;]+)/);var t=m?decodeURIComponent(m[1]):"light";var d=t==="dark"||(t==="system"&&window.matchMedia("(prefers-color-scheme: dark)").matches);document.documentElement.classList.toggle("dark",d);document.documentElement.style.colorScheme=d?"dark":"light";}catch(e){}})();`;

export function ThemeScript() {
  return (
    <Script id="tisei-theme-init" strategy="beforeInteractive">
      {THEME_INIT}
    </Script>
  );
}
