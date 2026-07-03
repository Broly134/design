import { Sparkles, ThermometerSun, KeyRound, CalendarClock } from "lucide-react";
import { Container } from "./ui/Container";
import { SectionHeading } from "./ui/SectionHeading";
import { Reveal } from "./ui/Reveal";

const REASONS = [
  {
    icon: Sparkles,
    title: "Un vrai confort sans installation compliquée",
    text: "Déballez, branchez, placez la gaine d'évacuation à la fenêtre : votre pièce commence à rafraîchir en quelques minutes. Aucun outil, aucun installateur, aucune démarche.",
  },
  {
    icon: ThermometerSun,
    title: "Idéal pour les périodes de canicule",
    text: "Quand les températures s'installent au-dessus de 30°C, un simple ventilateur ne suffit plus. Le climatiseur mobile abaisse réellement la température, là où vous en avez besoin.",
  },
  {
    icon: KeyRound,
    title: "Une solution flexible pour les logements français",
    text: "Locataire, en copropriété ou en appartement ancien : pas besoin d'autorisation ni de modification du logement. Vous l'emportez même avec vous en cas de déménagement.",
  },
  {
    icon: CalendarClock,
    title: "Un achat intelligent avant l'été",
    text: "Chaque année, les fortes chaleurs arrivent plus tôt et les stocks partent vite. S'équiper en avance, c'est aborder l'été l'esprit tranquille.",
  },
];

export function WhyChooseSection() {
  return (
    <section className="relative overflow-hidden py-20 sm:py-28">
      {/* Forme floue de fond */}
      <div
        className="pointer-events-none absolute right-[-12%] top-1/3 h-96 w-96 rounded-full bg-brand-400/10 blur-3xl"
        aria-hidden="true"
      />

      <Container className="flex flex-col items-center gap-14">
        <SectionHeading
          eyebrow="Pourquoi le choisir"
          title="Pourquoi choisir ce climatiseur mobile ?"
          description="Parce qu'il répond exactement aux contraintes des logements français : efficace, sans travaux, et pensé pour durer."
        />

        <div className="grid w-full gap-6 md:grid-cols-2">
          {REASONS.map((reason, index) => (
            <Reveal
              key={reason.title}
              delay={index * 90}
              className="group flex gap-5 rounded-[1.75rem] border border-ink-900/5 bg-white p-7 shadow-[0_2px_12px_-4px_rgba(15,23,42,0.06)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_20px_40px_-16px_rgba(37,99,235,0.15)] sm:p-8"
            >
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-600 to-brand-400 text-white shadow-md shadow-brand-600/20">
                <reason.icon className="h-5.5 w-5.5" strokeWidth={1.75} />
              </span>
              <div>
                <h3 className="mb-2 text-lg font-semibold leading-snug text-ink-900">
                  {reason.title}
                </h3>
                <p className="text-sm leading-relaxed text-ink-500">{reason.text}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </Container>
    </section>
  );
}
