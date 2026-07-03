import { ArrowRight, Check, Snowflake } from "lucide-react";
import { Container } from "./ui/Container";
import { Reveal } from "./ui/Reveal";
import { ProductMockup } from "./ProductMockup";

const TRUST_POINTS = [
  "Installation facile",
  "Livraison en France",
  "Prix abordable",
  "Idéal fortes chaleurs",
];

export function Hero() {
  return (
    <section id="accueil" className="relative overflow-hidden pb-20 pt-14 sm:pb-28 sm:pt-20">
      {/* Formes floues froides en arrière-plan */}
      <div className="pointer-events-none absolute inset-0" aria-hidden="true">
        <div className="absolute -top-32 right-[-10%] h-96 w-96 rounded-full bg-brand-400/15 blur-3xl" />
        <div className="absolute left-[-8%] top-40 h-80 w-80 rounded-full bg-cyan-300/15 blur-3xl" />
      </div>

      <Container className="relative grid items-center gap-14 lg:grid-cols-2 lg:gap-10">
        <div className="flex max-w-xl flex-col items-start gap-6">
          <Reveal>
            <span className="inline-flex items-center gap-2 rounded-full border border-brand-500/20 bg-brand-500/10 px-4 py-1.5 text-sm font-medium text-brand-700">
              <Snowflake className="h-3.5 w-3.5" />
              Climatisation mobile puissante &amp; abordable
            </span>
          </Reveal>

          <Reveal delay={80}>
            <h1 className="text-balance text-4xl font-semibold leading-[1.08] tracking-tight text-ink-900 sm:text-5xl lg:text-[3.4rem]">
              Rafraîchissez votre intérieur en quelques minutes,{" "}
              <span className="bg-gradient-to-r from-brand-600 to-cyan-500 bg-clip-text text-transparent">
                sans travaux
              </span>
              .
            </h1>
          </Reveal>

          <Reveal delay={160}>
            <p className="text-pretty text-lg leading-relaxed text-ink-500">
              Un climatiseur mobile puissant, élégant et simple à utiliser, pensé pour les
              appartements, chambres, bureaux et salons en France.
            </p>
          </Reveal>

          <Reveal delay={240} className="flex flex-wrap items-center gap-4">
            <a
              href="#offre"
              className="group inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-brand-600 to-brand-500 px-7 py-3.5 text-base font-semibold text-white shadow-lg shadow-brand-600/25 transition-all hover:-translate-y-0.5 hover:shadow-xl hover:shadow-brand-600/30 active:translate-y-0"
            >
              Découvrir l'offre
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </a>
            <a
              href="#avantages"
              className="inline-flex items-center rounded-full border border-ink-900/10 bg-white/70 px-7 py-3.5 text-base font-semibold text-ink-700 backdrop-blur transition-all hover:border-ink-900/20 hover:bg-white"
            >
              Voir les avantages
            </a>
          </Reveal>

          <Reveal delay={320}>
            <ul className="flex flex-wrap gap-x-6 gap-y-2 pt-2">
              {TRUST_POINTS.map((point) => (
                <li key={point} className="flex items-center gap-1.5 text-sm font-medium text-ink-500">
                  <Check className="h-4 w-4 text-brand-500" strokeWidth={2.5} />
                  {point}
                </li>
              ))}
            </ul>
          </Reveal>
        </div>

        <Reveal delay={200} className="lg:justify-self-end">
          <ProductMockup />
        </Reveal>
      </Container>
    </section>
  );
}
