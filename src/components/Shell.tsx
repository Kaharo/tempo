"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Menu, House, ChartNoAxesColumn, Globe, Layers, TrendingUp, Lightbulb, File, Calendar, Wallet, Box, Search, Bell, CircleUserRound } from "lucide-react";

type NavState = "auto" | "open" | "closed";
const PRIMARY = [
  { href: "/", label: "Обзор дня", Icon: House },
  { href: "/analytics", label: "Аналитика", Icon: ChartNoAxesColumn },
  { href: "/world", label: "Мир", Icon: Globe },
  { href: "/projects", label: "Проекты", Icon: Layers },
  { href: "/progress", label: "Прогресс", Icon: TrendingUp },
  { href: "/ideas", label: "Идеи", Icon: Lightbulb },
  { href: "/publications", label: "Публикации", Icon: File },
];
const PERSONAL = [
  { href: "/calendar", label: "Календарь", Icon: Calendar },
  { href: "/finance", label: "Финансы", Icon: Wallet },
];
const ENGINE = [{ href: "/aimos", label: "AIMos", Icon: Box }];
const FOOT = [
  { href: "/search", label: "Поиск", Icon: Search },
  { href: "/status", label: "Уведомления", Icon: Bell },
  { href: "/settings", label: "Профиль", Icon: CircleUserRound },
];

export default function Shell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const [nav, setNav] = useState<NavState>("auto");
  useEffect(() => {
    try { const v = localStorage.getItem("tempo.nav"); if (v === "open" || v === "closed") setNav(window.innerWidth < 1200 ? "auto" : v); } catch {}
  }, []);
  // Close the overlay drawer after navigation on small screens.
  useEffect(() => { if (window.innerWidth < 1200) setNav("auto"); }, [path]);
  const toggle = () => {
    const wide = window.innerWidth >= 1200;
    const expanded = nav === "open" || (nav === "auto" && wide);
    const next: NavState = expanded ? (wide ? "closed" : "auto") : "open";
    setNav(next);
    try { if (wide) localStorage.setItem("tempo.nav", next); } catch {}
  };
  const item = ({ href, label, Icon }: (typeof PRIMARY)[number]) => {
    const active = href === "/" ? path === "/" || path.startsWith("/article") : path.startsWith(href);
    return (
      <Link key={href} href={href} className="nav-item" aria-current={active ? "page" : undefined} title={label}>
        <Icon size={18} strokeWidth={1.75} aria-hidden /><span>{label}</span>
      </Link>
    );
  };
  return (
    <div className="shell" data-nav={nav}>
      <nav className="nav" aria-label="Разделы">
        <button className="nav-toggle" onClick={toggle} aria-label="Свернуть или развернуть меню"><Menu size={20} strokeWidth={1.75} /></button>
        <div className="nav-group">{PRIMARY.map(item)}</div>
        <div className="nav-sep" />
        <div className="nav-group">{PERSONAL.map(item)}</div>
        <div className="nav-sep" />
        <div className="nav-group">{ENGINE.map(item)}</div>
        <div className="nav-group nav-foot">{FOOT.map(item)}</div>
      </nav>
      <div className="scrim" onClick={() => setNav("auto")} />
      <div className="main">
        <header className="mast">
          <button className="mast-menu" onClick={toggle} aria-label="Меню"><Menu size={20} strokeWidth={1.75} /></button>
          <Link href="/" className="wordmark">TEMPO</Link>
        </header>
        {children}
      </div>
    </div>
  );
}
