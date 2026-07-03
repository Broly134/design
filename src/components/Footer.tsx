import { Snowflake, Mail } from "lucide-react";
import { Container } from "./ui/Container";
import { NAV_LINKS, BRAND_NAME, CONTACT_EMAIL } from "../lib/constants";

// Liens placeholders : créez les pages légales correspondantes avant la mise
// en production (obligatoires pour un site e-commerce en France).
const LEGAL_LINKS = [
  { label: "Mentions légales", href: "#mentions-legales" },
  { label: "Politique de confidentialité", href: "#confidentialite" },
  { label: "CGV", href: "#cgv" },
  { label: "Contact", href: "#contact" },
];

export function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-ink-900/5 bg-white py-14">
      <Container className="flex flex-col gap-10">
        <div className="flex flex-col gap-10 md:flex-row md:items-start md:justify-between">
          <div className="max-w-sm">
            <a href="#accueil" className="mb-4 inline-flex items-center gap-2.5 text-ink-900">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-brand-600 to-brand-400 text-white shadow-sm">
                <Snowflake className="h-5 w-5" strokeWidth={2.25} />
              </span>
              <span className="text-lg font-semibold tracking-tight">{BRAND_NAME}</span>
            </a>
            <p className="text-sm leading-relaxed text-ink-500">
              La climatisation mobile pensée pour les logements français : puissante, simple à
              installer et accessible.
            </p>
            <p className="mt-4 inline-flex items-center gap-2 text-sm text-ink-500">
              <Mail className="h-4 w-4 text-brand-600" />
              {CONTACT_EMAIL}
            </p>
          </div>

          <nav aria-label="Navigation du site">
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-ink-900">
              Navigation
            </h2>
            <ul className="flex flex-col gap-2.5">
              {NAV_LINKS.map((link) => (
                <li key={link.href}>
                  <a
                    href={link.href}
                    className="text-sm text-ink-500 transition-colors hover:text-ink-900"
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>

          <nav aria-label="Informations légales">
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-ink-900">
              Informations
            </h2>
            <ul className="flex flex-col gap-2.5">
              {LEGAL_LINKS.map((link) => (
                <li key={link.href}>
                  <a
                    href={link.href}
                    className="text-sm text-ink-500 transition-colors hover:text-ink-900"
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        </div>

        <div className="flex flex-col gap-2 border-t border-ink-900/5 pt-8 text-xs text-ink-400 sm:flex-row sm:items-center sm:justify-between">
          <p>
            © {year} {BRAND_NAME}. Tous droits réservés.
          </p>
          <p>Climatiseur mobile pour appartement, chambre, bureau et salon — France.</p>
        </div>
      </Container>
    </footer>
  );
}
