# AeroCool Mobile — Landing page climatiseur mobile

Landing page e-commerce premium pour la vente de climatiseurs mobiles en France.
Design minimaliste inspiré iOS/Apple : glassmorphism subtil, animations douces au
scroll, cartes arrondies et palette bleu glacier.

## Stack

- [Vite](https://vite.dev/) + [React 19](https://react.dev/) + TypeScript
- [Tailwind CSS v4](https://tailwindcss.com/) (via `@tailwindcss/vite`)
- [lucide-react](https://lucide.dev/) pour les icônes
- Aucune autre dépendance runtime

## Lancer le projet

```bash
# Installation
npm install

# Serveur de développement (http://localhost:5173)
npm run dev

# Build de production (dossier dist/)
npm run build

# Prévisualiser le build
npm run preview

# Lint
npm run lint
```

## Structure

```
src/
├── App.tsx                  # Assemblage des sections
├── index.css                # Tokens de design Tailwind + styles globaux
├── lib/constants.ts         # Marque, navigation, placeholders produit
├── hooks/useReveal.ts       # Animation d'apparition au scroll (IntersectionObserver)
└── components/
    ├── ui/                  # Container, Reveal, SectionHeading (réutilisables)
    ├── Header.tsx           # Header sticky avec blur + menu mobile
    ├── Hero.tsx             # Section d'accroche + mockup produit
    ├── ProductMockup.tsx    # Climatiseur stylisé en CSS pur
    ├── ProblemSection.tsx   # Points de douleur (chaleur)
    ├── AdvantagesSection.tsx
    ├── ProductSection.tsx   # Modes + fiche technique
    ├── ComparisonSection.tsx # Ventilateur vs clim fixe vs clim mobile
    ├── WhyChooseSection.tsx
    ├── RoomCalculator.tsx   # Estimateur de pièce interactif
    ├── TrustSection.tsx     # Livraison, paiement, garantie…
    ├── TestimonialsSection.tsx
    ├── OfferSection.tsx     # Carte d'offre + prix
    ├── FaqSection.tsx       # Accordéon accessible
    ├── FinalCtaSection.tsx
    └── Footer.tsx
```

## Placeholders à remplacer avant mise en production

Les données produit exactes sont centralisées dans `src/lib/constants.ts` :

| Placeholder            | Description                          |
| ---------------------- | ------------------------------------ |
| `[PRIX]`               | Prix de vente TTC                    |
| `[ANCIEN_PRIX]`        | Ancien prix (seulement si remise réelle) |
| `[PUISSANCE_BTU]`      | Puissance frigorifique en BTU        |
| `[SURFACE_M2]`         | Surface maximale recommandée         |
| `[DB]`                 | Niveau sonore en décibels            |
| `[CLASSE_ENERGETIQUE]` | Classe énergétique (A, A+, …)        |
| `[DURÉE_GARANTIE]`     | Durée de la garantie commerciale     |
| `[DELAI_LIVRAISON]`    | Délai de livraison indicatif         |
| `[EMAIL_CONTACT]`      | Email du support client              |

À remplacer également :

- L'URL canonique et `og:url` dans `index.html` (`https://www.example.com/`)
- Les avis clients d'illustration dans `TestimonialsSection.tsx` par de vrais avis vérifiés
- Les liens légaux du footer (mentions légales, CGV, politique de confidentialité)
  par de vraies pages — obligatoires pour un site e-commerce en France
