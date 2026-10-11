"use client";
import { usePathname } from "next/navigation";

export default function Nav({ open, total }: { open: number; total: number }) {
  const path = usePathname();
  const items = [
    { href: "/", label: "Leads", count: total },
    { href: "/board", label: "Pipeline", count: open },
    { href: "/team", label: "Team" },
    { href: "/reports", label: "Reports" },
  ];
  return (
    <nav className="nav" aria-label="Main">
      {items.map((i) => {
        const on = i.href === "/" ? path === "/" || path.startsWith("/leads") : path.startsWith(i.href);
        return (
          <a key={i.href} href={i.href} aria-current={on ? "page" : undefined}>
            {i.label}
            {i.count != null && <span className="count">{i.count}</span>}
          </a>
        );
      })}
    </nav>
  );
}
