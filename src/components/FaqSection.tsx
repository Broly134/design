import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { Container } from "./ui/Container";
import { SectionHeading } from "./ui/SectionHeading";
import { Reveal } from "./ui/Reveal";
import { PRODUCT } from "../lib/constants";

const FAQ_ITEMS = [
  {
    question: "Est-ce qu'un climatiseur mobile refroidit vraiment une pièce ?",
    answer:
      "Oui. Contrairement à un ventilateur qui se contente de brasser l'air, un climatiseur mobile est équipé d'un vrai circuit frigorifique : il capte la chaleur de la pièce et l'évacue vers l'extérieur via une gaine. La température de la pièce baisse réellement.",
  },
  {
    question: "Faut-il faire des travaux ?",
    answer:
      "Non, aucun. Il suffit de brancher l'appareil sur une prise classique et de placer la gaine d'évacuation vers une fenêtre entrouverte. Un kit de calfeutrage pour fenêtre permet d'optimiser l'efficacité, sans perçage ni modification du logement.",
  },
  {
    question: "Est-ce adapté à un appartement ?",
    answer:
      "C'est même son usage idéal. Pas d'unité extérieure, pas d'autorisation de copropriété à demander, pas de travaux : le climatiseur mobile est la solution la plus simple pour les appartements et les locations.",
  },
  {
    question: "Est-ce bruyant ?",
    answer:
      `Le niveau sonore est d'environ ${PRODUCT.db} dB, comparable à une conversation calme. Le mode nuit réduit encore la ventilation pour un fonctionnement discret pendant le sommeil.`,
  },
  {
    question: "Quelle surface peut-il refroidir ?",
    answer:
      `Il est recommandé pour des pièces jusqu'à ${PRODUCT.surfaceM2} m² : chambre, bureau, studio ou salon. Pour une efficacité maximale, fermez les portes de la pièce à rafraîchir.`,
  },
  {
    question: "Comment évacuer l'air chaud ?",
    answer:
      "L'appareil est livré avec une gaine d'évacuation à placer vers une fenêtre entrouverte ou une porte-fenêtre. C'est l'affaire de quelques secondes, et la gaine se range facilement hors saison.",
  },
  {
    question: "Est-ce économique ?",
    answer:
      "Le coût d'achat est nettement inférieur à celui d'une climatisation fixe, sans frais d'installation. À l'usage, vous ne rafraîchissez que la pièce où vous êtes, ce qui limite la consommation par rapport à une installation centralisée.",
  },
  {
    question: "Est-ce livré en France ?",
    answer:
      `Oui, la livraison est assurée en France métropolitaine, avec un délai indicatif de ${PRODUCT.delivery} et un suivi de commande.`,
  },
];

function FaqItem({
  question,
  answer,
  isOpen,
  onToggle,
  index,
}: {
  question: string;
  answer: string;
  isOpen: boolean;
  onToggle: () => void;
  index: number;
}) {
  const panelId = `faq-panel-${index}`;
  const buttonId = `faq-button-${index}`;

  return (
    <div className="overflow-hidden rounded-3xl border border-ink-900/5 bg-white shadow-[0_2px_12px_-4px_rgba(15,23,42,0.05)] transition-shadow hover:shadow-[0_8px_24px_-8px_rgba(15,23,42,0.1)]">
      <h3>
        <button
          type="button"
          id={buttonId}
          aria-expanded={isOpen}
          aria-controls={panelId}
          onClick={onToggle}
          className="flex w-full items-center justify-between gap-4 px-7 py-5 text-left text-base font-semibold text-ink-900 transition-colors hover:text-brand-700"
        >
          {question}
          <span
            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-all duration-300 ${
              isOpen ? "rotate-180 bg-brand-500/10 text-brand-600" : "bg-frost-100 text-ink-400"
            }`}
          >
            <ChevronDown className="h-4.5 w-4.5" />
          </span>
        </button>
      </h3>
      <div
        id={panelId}
        role="region"
        aria-labelledby={buttonId}
        className={`grid transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] ${
          isOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
        }`}
      >
        <div className="overflow-hidden">
          <p className="px-7 pb-6 text-sm leading-relaxed text-ink-500">{answer}</p>
        </div>
      </div>
    </div>
  );
}

export function FaqSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <section id="faq" className="relative bg-white py-20 sm:py-28">
      <Container className="flex flex-col items-center gap-14">
        <SectionHeading
          eyebrow="FAQ"
          title="Questions fréquentes"
          description="Tout ce qu'il faut savoir avant de choisir votre climatiseur mobile."
        />

        <Reveal className="w-full max-w-3xl">
          <div className="flex flex-col gap-3">
            {FAQ_ITEMS.map((item, index) => (
              <FaqItem
                key={item.question}
                question={item.question}
                answer={item.answer}
                index={index}
                isOpen={openIndex === index}
                onToggle={() => setOpenIndex(openIndex === index ? null : index)}
              />
            ))}
          </div>
        </Reveal>
      </Container>
    </section>
  );
}
