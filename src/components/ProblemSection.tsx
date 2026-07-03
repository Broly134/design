import { BedDouble, Building2, Laptop, Fan, Hammer, Euro, ArrowDown } from "lucide-react";
import { Container } from "./ui/Container";
import { SectionHeading } from "./ui/SectionHeading";
import { Reveal } from "./ui/Reveal";

const PROBLEMS = [
  {
    icon: BedDouble,
    title: "Des nuits difficiles",
    text: "Impossible de trouver le sommeil quand la chambre reste à 28°C toute la nuit.",
  },
  {
    icon: Building2,
    title: "Un appartement trop chaud",
    text: "Les logements en ville accumulent la chaleur et ne redescendent jamais vraiment.",
  },
  {
    icon: Laptop,
    title: "Un télétravail inconfortable",
    text: "Difficile de rester concentré et productif quand le bureau devient étouffant.",
  },
  {
    icon: Fan,
    title: "Un ventilateur qui brasse de l'air chaud",
    text: "Le ventilateur donne une impression de fraîcheur, mais ne baisse pas la température.",
  },
  {
    icon: Hammer,
    title: "Pas envie de faire des travaux",
    text: "Percer un mur, demander une autorisation, faire venir un installateur… non merci.",
  },
  {
    icon: Euro,
    title: "Une clim fixe trop chère",
    text: "Entre l'appareil et la pose, une climatisation fixe représente un vrai budget.",
  },
];

export function ProblemSection() {
  return (
    <section className="relative py-20 sm:py-28">
      <Container className="flex flex-col items-center gap-14">
        <SectionHeading
          eyebrow="Le problème"
          title="Quand la chaleur devient invivable…"
          description="Chaque été, les fortes chaleurs transforment nos logements en fournaise. Et les solutions habituelles montrent vite leurs limites."
        />

        <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {PROBLEMS.map((problem, index) => (
            <Reveal
              as="li"
              key={problem.title}
              delay={index * 70}
              className="group rounded-3xl border border-ink-900/5 bg-white p-7 shadow-[0_2px_12px_-4px_rgba(15,23,42,0.06)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_16px_32px_-12px_rgba(15,23,42,0.12)]"
            >
              <span className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-frost-100 text-ink-500 transition-colors group-hover:bg-brand-500/10 group-hover:text-brand-600">
                <problem.icon className="h-5 w-5" strokeWidth={1.75} />
              </span>
              <h3 className="mb-1.5 text-base font-semibold text-ink-900">{problem.title}</h3>
              <p className="text-sm leading-relaxed text-ink-500">{problem.text}</p>
            </Reveal>
          ))}
        </ul>

        <Reveal className="flex flex-col items-center gap-4 text-center">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-500/10 text-brand-600">
            <ArrowDown className="h-5 w-5" />
          </span>
          <p className="max-w-xl text-balance text-lg font-medium text-ink-700">
            Le climatiseur mobile est la solution simple : il refroidit vraiment la pièce,
            se branche sur une prise classique et s'installe en quelques minutes.
          </p>
        </Reveal>
      </Container>
    </section>
  );
}
