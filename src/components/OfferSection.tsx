import { Check, ShoppingCart, Sun } from "lucide-react";
import { Container } from "./ui/Container";
import { SectionHeading } from "./ui/SectionHeading";
import { Reveal } from "./ui/Reveal";
import { PRODUCT } from "../lib/constants";

const OFFER_POINTS = [
  "Refroidissement puissant et rapide",
  "Mobile, avec roulettes intégrées",
  "Installation simple, sans travaux",
  "Adapté aux appartements et locations",
  "Livraison en France métropolitaine",
];

export function OfferSection() {
  return (
    <section id="offre" className="relative overflow-hidden py-20 sm:py-28">
      {/* Halo de fond */}
      <div
        className="pointer-events-none absolute left-1/2 top-1/2 h-[32rem] w-[32rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-brand-400/10 blur-3xl"
        aria-hidden="true"
      />

      <Container className="relative flex flex-col items-center gap-12">
        <SectionHeading
          eyebrow="L'offre"
          title="Climatiseur Mobile Performance"
          description="Une offre claire, sans option cachée : l'appareil complet, prêt à l'emploi dès réception."
        />

        <Reveal className="w-full max-w-lg">
          <div className="glass relative rounded-[2.5rem] border border-white/70 p-8 shadow-[0_32px_80px_-32px_rgba(37,99,235,0.35)] sm:p-10">
            {/* Badge offre été */}
            <span className="absolute -top-4 left-1/2 inline-flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-gradient-to-r from-amber-400 to-orange-400 px-4 py-1.5 text-xs font-bold uppercase tracking-wide text-white shadow-lg shadow-orange-400/30">
              <Sun className="h-3.5 w-3.5" />
              Offre été
            </span>

            <div className="mb-8 pt-2 text-center">
              <h3 className="mb-4 text-xl font-semibold text-ink-900">
                Climatiseur Mobile Performance
              </h3>
              <div className="flex items-baseline justify-center gap-3">
                {/* [ANCIEN_PRIX] : à renseigner uniquement si une remise réelle existe */}
                <span className="text-sm font-medium text-ink-400 line-through">
                  {PRODUCT.oldPrice} €
                </span>
                <span className="bg-gradient-to-r from-brand-600 to-cyan-500 bg-clip-text text-5xl font-bold tracking-tight text-transparent">
                  {PRODUCT.price} €
                </span>
              </div>
              <p className="mt-2 text-xs text-ink-400">
                Prix TTC, hors éventuels frais de livraison précisés à la commande.
              </p>
            </div>

            <ul className="mb-8 flex flex-col gap-3.5">
              {OFFER_POINTS.map((point) => (
                <li key={point} className="flex items-center gap-3 text-sm font-medium text-ink-700">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600">
                    <Check className="h-3.5 w-3.5" strokeWidth={2.5} />
                  </span>
                  {point}
                </li>
              ))}
            </ul>

            <a
              href="#commander"
              className="group flex w-full items-center justify-center gap-2.5 rounded-full bg-gradient-to-r from-brand-600 to-brand-500 px-7 py-4 text-base font-semibold text-white shadow-lg shadow-brand-600/30 transition-all hover:-translate-y-0.5 hover:shadow-xl hover:shadow-brand-600/40 active:translate-y-0"
            >
              <ShoppingCart className="h-5 w-5 transition-transform group-hover:scale-105" />
              Commander maintenant
            </a>

            <p className="mt-5 text-center text-xs text-ink-400">
              Paiement sécurisé • Garantie {PRODUCT.warranty} selon conditions • Retours selon
              politique de vente
            </p>
          </div>
        </Reveal>
      </Container>
    </section>
  );
}
