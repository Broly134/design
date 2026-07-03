import {
  Gauge,
  Ruler,
  Volume2,
  SlidersHorizontal,
  Radio,
  Timer,
  Zap,
  Tag,
  Snowflake,
  Wind,
  Droplets,
  Moon,
} from "lucide-react";
import { Container } from "./ui/Container";
import { SectionHeading } from "./ui/SectionHeading";
import { Reveal } from "./ui/Reveal";
import { PRODUCT } from "../lib/constants";

// Remplacez les placeholders [.] par les caractéristiques réelles du produit
// (voir src/lib/constants.ts).
const SPECS = [
  { icon: Gauge, label: "Puissance", value: `${PRODUCT.btu} BTU` },
  { icon: Ruler, label: "Surface recommandée", value: `jusqu'à ${PRODUCT.surfaceM2} m²` },
  { icon: Volume2, label: "Niveau sonore", value: `${PRODUCT.db} dB` },
  { icon: SlidersHorizontal, label: "Modes", value: "Froid, ventilation, déshumidification, nuit" },
  { icon: Radio, label: "Télécommande", value: "Oui" },
  { icon: Timer, label: "Minuteur", value: "Oui, programmable" },
  { icon: Zap, label: "Classe énergétique", value: PRODUCT.energyClass },
  { icon: Tag, label: "Prix", value: `à partir de ${PRODUCT.price} €` },
];

const MODES = [
  {
    icon: Snowflake,
    title: "Mode froid",
    text: "Abaisse rapidement la température de la pièce pour un confort immédiat.",
  },
  {
    icon: Wind,
    title: "Ventilation",
    text: "Fait circuler l'air en douceur quand un simple courant d'air suffit.",
  },
  {
    icon: Droplets,
    title: "Déshumidification",
    text: "Réduit l'humidité ambiante pour une sensation d'air plus léger.",
  },
  {
    icon: Moon,
    title: "Mode nuit",
    text: "Fonctionnement discret et température régulée pour bien dormir.",
  },
];

export function ProductSection() {
  return (
    <section id="fonctionnement" className="relative py-20 sm:py-28">
      <Container className="flex flex-col items-center gap-14">
        <SectionHeading
          eyebrow="Le produit"
          title="Pensé pour votre confort quotidien"
          description="Quatre modes intelligents et des caractéristiques claires, pour choisir en toute confiance."
        />

        <div className="grid w-full gap-8 lg:grid-cols-5">
          {/* Modes de fonctionnement */}
          <div className="grid content-start gap-4 sm:grid-cols-2 lg:col-span-2 lg:grid-cols-1 xl:grid-cols-2">
            {MODES.map((mode, index) => (
              <Reveal
                key={mode.title}
                delay={index * 80}
                className="rounded-3xl border border-ink-900/5 bg-white p-6 shadow-[0_2px_12px_-4px_rgba(15,23,42,0.06)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_16px_32px_-12px_rgba(15,23,42,0.12)]"
              >
                <span className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-brand-500/10 text-brand-600">
                  <mode.icon className="h-5 w-5" strokeWidth={1.75} />
                </span>
                <h3 className="mb-1 text-base font-semibold text-ink-900">{mode.title}</h3>
                <p className="text-sm leading-relaxed text-ink-500">{mode.text}</p>
              </Reveal>
            ))}
          </div>

          {/* Fiche technique */}
          <Reveal delay={160} className="lg:col-span-3">
            <div className="glass h-full rounded-[2rem] border border-white/70 p-8 shadow-[0_24px_60px_-24px_rgba(37,99,235,0.2)] sm:p-10">
              <h3 className="mb-6 text-xl font-semibold text-ink-900">
                Fiche technique — Climatiseur Mobile Performance
              </h3>
              <dl className="grid gap-x-8 gap-y-5 sm:grid-cols-2">
                {SPECS.map((spec) => (
                  <div key={spec.label} className="flex items-start gap-3.5">
                    <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-brand-600 shadow-sm ring-1 ring-ink-900/5">
                      <spec.icon className="h-4.5 w-4.5" strokeWidth={1.75} />
                    </span>
                    <div>
                      <dt className="text-xs font-medium uppercase tracking-wide text-ink-400">
                        {spec.label}
                      </dt>
                      <dd className="mt-0.5 text-sm font-semibold text-ink-900">{spec.value}</dd>
                    </div>
                  </div>
                ))}
              </dl>
              <p className="mt-8 rounded-2xl bg-brand-500/5 px-5 py-4 text-sm leading-relaxed text-ink-500">
                Les caractéristiques précises (puissance, surface couverte, niveau sonore, classe
                énergétique) sont indiquées sur la fiche produit détaillée au moment de la commande.
              </p>
            </div>
          </Reveal>
        </div>
      </Container>
    </section>
  );
}
