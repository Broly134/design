import { useEffect, useState } from "react";
import { Menu, Snowflake, X } from "lucide-react";
import { Container } from "./ui/Container";
import { NAV_LINKS, BRAND_NAME } from "../lib/constants";

export function Header() {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    document.body.style.overflow = menuOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [menuOpen]);

  return (
    <header
      className={`sticky top-0 z-50 transition-all duration-300 ${
        scrolled
          ? "glass border-b border-ink-900/5 shadow-[0_1px_0_rgba(15,23,42,0.04)]"
          : "bg-transparent"
      }`}
    >
      <Container className="flex items-center justify-between py-4">
        <a href="#accueil" className="flex items-center gap-2.5 text-ink-900" aria-label={`${BRAND_NAME} - accueil`}>
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-brand-600 to-brand-400 text-white shadow-sm">
            <Snowflake className="h-5 w-5" strokeWidth={2.25} />
          </span>
          <span className="text-lg font-semibold tracking-tight">{BRAND_NAME}</span>
        </a>

        <nav className="hidden items-center gap-8 md:flex" aria-label="Navigation principale">
          {NAV_LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="text-sm font-medium text-ink-500 transition-colors hover:text-ink-900"
            >
              {link.label}
            </a>
          ))}
        </nav>

        <div className="hidden md:block">
          <a
            href="#offre"
            className="inline-flex items-center justify-center rounded-full bg-gradient-to-r from-brand-600 to-brand-500 px-5 py-2.5 text-sm font-semibold text-white shadow-sm shadow-brand-600/20 transition-all hover:shadow-md hover:shadow-brand-600/30 hover:-translate-y-0.5 active:translate-y-0"
          >
            Voir l'offre
          </a>
        </div>

        <button
          type="button"
          className="inline-flex items-center justify-center rounded-full p-2 text-ink-700 md:hidden"
          aria-label={menuOpen ? "Fermer le menu" : "Ouvrir le menu"}
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((open) => !open)}
        >
          {menuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </Container>

      {menuOpen && (
        <div className="glass border-t border-ink-900/5 md:hidden">
          <Container className="flex flex-col gap-1 py-4">
            {NAV_LINKS.map((link) => (
              <a
                key={link.href}
                href={link.href}
                onClick={() => setMenuOpen(false)}
                className="rounded-xl px-3 py-3 text-base font-medium text-ink-700 transition-colors hover:bg-ink-900/5"
              >
                {link.label}
              </a>
            ))}
            <a
              href="#offre"
              onClick={() => setMenuOpen(false)}
              className="mt-2 inline-flex items-center justify-center rounded-full bg-gradient-to-r from-brand-600 to-brand-500 px-5 py-3 text-base font-semibold text-white shadow-sm"
            >
              Voir l'offre
            </a>
          </Container>
        </div>
      )}
    </header>
  );
}
