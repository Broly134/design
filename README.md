# Pépite · Deviens bon avec ton argent, en jouant

Produit fictif complet, pensé pour la newgen : **Pépite** est l'appli qui
enseigne l'argent comme un jeu. Budget, épargne, banque, investir, arnaques :
une mini-leçon de 5 minutes par jour, guidée par **Filou**, l'écureuil qui
planque ses noisettes comme toi tu planques ton épargne. Séries, XP, cœurs,
ligues et un abonnement *Pépite Max* : tous les ressorts du jeu vidéo au
service de l'éducation financière.

Univers volontairement ludique et coloré, inspiré des apps d'apprentissage
gamifiées : boutons « 3D » qui s'enfoncent, chemin de leçons sinueux, mascotte
expressive, polices rondes et charnues.

## Identité

- **Mascotte** : Filou, écureuil roux, dessiné en SVG (réutilisé via `<use>`).
- **Logo** : squircle iOS dégradé orange → or, avec un gland blanc.
- **Polices** : Baloo 2 (display rond), Nunito (corps), Spline Sans Mono (chiffres),
  auto-hébergées en woff2 dans `assets/fonts/`.
- **Couleurs** : orange écureuil `#F2760C`, vert action `#1FA24A`, violet `#7C4DEF`,
  rose `#FF4D8D`, bleu `#29B6F6`, or/pépites `#F5B921`, cœurs `#FF4B4B`.
  Fonds chauds crème, jamais de gris pur.

## Contenu

- `index.html` — la **landing** (hero mascotte, principe, bento ludique, sujets,
  témoignages, tarifs Gratuit / Pépite Max, FAQ). Thème clair **et** sombre.
- `app.html` — l'**appli jouable** : monde clair assumé, mobile-first.
  - **Apprendre** : chemin de leçons (nœuds validés / actif / verrouillés / coffre),
    Filou à côté du nœud actif, barre de stats (série, pépites, cœurs).
  - **Leçon** : 5 questions réelles sur la règle 50/30/20, feedback juste/faux,
    perte de cœur, écran de fin (XP, précision, temps) et récompense.
  - **Ligues** : classement qui se re-trie quand tu gagnes de l'XP (tu montes
    dans la zone de promotion).
  - **Défis** : quêtes du jour avec barres de progression et récompenses en pépites.
  - **Boutique** : recharge de cœurs, boosters, gel de série, carte Pépite Max.
  - **Profil** : série, XP total, ligue, trophées.
- `assets/css/` — `style.css` (landing), `app.css` (appli), `fonts.css`.
- `assets/js/` — `app.js` (landing), `quest.js` (moteur de l'appli).

## Ce qui est jouable dans l'appli

1. **Apprendre → Commencer** : joue la leçon de bout en bout. La série passe de
   12 à 13, le nœud se valide et débloque le suivant.
2. **Une mauvaise réponse** coûte un cœur ; à zéro cœur, Filou propose de recharger.
3. **Ligues** : après la leçon, « Toi » remonte au 3ᵉ rang, dans la zone de promotion.
4. **Défis** : la quête « Gagne 30 XP » se débloque, réclame tes pépites.
5. **Boutique** : recharge tes cœurs, active un booster, ou passe à Pépite Max
   (cœurs illimités).

## Branding généré avec Higgsfield

Le logo (icône d'app squircle) et la mascotte Filou en 3D ont été générés avec
**Higgsfield** (GPT Image 2, haute qualité), puis détourés (fond transparent) et
optimisés en WebP :

- `assets/img/app-icon.png` / `logo.webp` — l'icône d'app, un écureuil roux tenant
  un gland sur dégradé orange → or.
- `assets/img/filou-mascot.webp` — Filou en pied, style 3D façon studio d'animation,
  tenant un gland doré. Réutilisé dans le hero, l'app, les leçons et le profil.

Les icônes d'interface restent des SVG Phosphor. Il reste des crédits pour générer
d'autres visuels (variantes de pose de Filou, bannières, illustrations de sujets).
