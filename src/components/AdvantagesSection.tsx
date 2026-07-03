import { Snowflake, PlugZap, Move, Box, Wallet, Home } from "lucide-react";
import { Container } from "./ui/Container";
import { SectionHeading } from "./ui/SectionHeading";
import { Reveal } from "./ui/Reveal";

const ADVANTAGES = [
  {
    icon: Snowflake,
    title: "Puissance de refroidissement",
    text: "Un vrai système de climatisation qui abaisse la température de la pièce, pas un simple souffle d'air.",
  },
  {
    icon: PlugZap,
    title: "Installation sans travaux",
    text: "Aucun perçage, aucune unité extérieure. Une prise électrique et une fenêtre entrouverte suffisent.",
  },
  {
    icon: Move,
    title: "Facile à déplacer",
    text: "Ses roulettes intégrées permettent de le faire passer du salon à la chambre en quelques secondes.",
  },
  {
    icon: Box,
    title: "Design compact",
    text: "Un format pensé pour les intérieurs français : discret, élégant, il se fond dans votre décoration.",
  },
  {
    icon: Wallet,
    title: "Prix accessible",
    text: "Une fraction du coût d'une climatisation fixe, sans frais d'installation ni intervention d'un professionnel.",
  },
  {
    icon: Home,
    title: "Pour toutes les pièces",
    text: "Chambre, salon, bureau ou studio : il s'adapte à votre quotidien et à votre logement, même en location.",
  },
];

export function AdvantagesSection() {
  return (
    <section id="avantages" className="relative bg-white py-20 sm:py-28">
      <Container className="flex flex-col items-center gap-14">
        <SectionHeading
          eyebrow="Les avantages"
          title="Tout ce qu'il faut pour un été plus serein"
          description="Un concentré de confort, pensé pour être efficace dès le premier jour, sans contrainte technique."
        />

        <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {ADVANTAGES.map((advantage, index) => (
            <Reveal
              as="li"
              key={advantage.title}
              delay={index * 70}
              className="group relative overflow-hidden rounded-3xl border border-ink-900/5 bg-gradient-to-b from-frost-50 to-white p-7 transition-all duration-300 hover:-translate-y-1 hover:border-brand-500/20 hover:shadow-[0_20px_40px_-16px_rgba(37,99,235,0.18)]"
            >
              <span className="mb-5 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-600 to-brand-400 text-white shadow-md shadow-brand-600/20 transition-transform duration-300 group-hover:scale-105">
                <advantage.icon className="h-5.5 w-5.5" strokeWidth={1.75} />
              </span>
              <h3 className="mb-2 text-lg font-semibold text-ink-900">{advantage.title}</h3>
              <p className="text-sm leading-relaxed text-ink-500">{advantage.text}</p>
            </Reveal>
          ))}
        </ul>
      </Container>
    </section>
  );
}
