import { Truck, ShieldCheck, Headphones, BadgeCheck, RotateCcw } from "lucide-react";
import { Container } from "./ui/Container";
import { SectionHeading } from "./ui/SectionHeading";
import { Reveal } from "./ui/Reveal";
import { PRODUCT } from "../lib/constants";

// Formulations volontairement prudentes : complétez avec vos vraies
// conditions commerciales (voir src/lib/constants.ts).
const TRUST_ITEMS = [
  {
    icon: Truck,
    title: "Livraison en France métropolitaine",
    text: `Expédition suivie sous ${PRODUCT.delivery} après validation de la commande.`,
  },
  {
    icon: ShieldCheck,
    title: "Paiement sécurisé",
    text: "Transactions protégées par chiffrement, via les moyens de paiement habituels.",
  },
  {
    icon: Headphones,
    title: "Support client",
    text: "Une équipe disponible pour répondre à vos questions avant et après l'achat.",
  },
  {
    icon: BadgeCheck,
    title: "Garantie",
    text: `Garantie : ${PRODUCT.warranty} selon conditions, en plus des garanties légales applicables en France.`,
  },
  {
    icon: RotateCcw,
    title: "Retours",
    text: "Retours possibles selon la politique de vente, avec droit de rétractation légal de 14 jours.",
  },
];

export function TrustSection() {
  return (
    <section className="relative bg-white py-20 sm:py-28">
      <Container className="flex flex-col items-center gap-14">
        <SectionHeading
          eyebrow="Acheter en confiance"
          title="Une commande simple, un achat serein"
          description="De la commande à la livraison, tout est pensé pour que votre achat se déroule sans mauvaise surprise."
        />

        <ul className="grid w-full gap-5 sm:grid-cols-2 lg:grid-cols-5">
          {TRUST_ITEMS.map((item, index) => (
            <Reveal
              as="li"
              key={item.title}
              delay={index * 70}
              className="flex flex-col items-center gap-3 rounded-3xl border border-ink-900/5 bg-frost-50 px-6 py-8 text-center transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_16px_32px_-12px_rgba(15,23,42,0.1)]"
            >
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-brand-600 shadow-sm ring-1 ring-ink-900/5">
                <item.icon className="h-5.5 w-5.5" strokeWidth={1.75} />
              </span>
              <h3 className="text-sm font-semibold text-ink-900">{item.title}</h3>
              <p className="text-xs leading-relaxed text-ink-500">{item.text}</p>
            </Reveal>
          ))}
        </ul>
      </Container>
    </section>
  );
}
