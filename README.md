# Boucan · La radio de ta bande

SaaS de divertissement (fictif) : **Boucan**, les salons d'écoute en direct.
Tu ouvres un salon, ta bande te rejoint avec un lien, chacun met ses morceaux
dans la file, la salle vote le prochain titre, et tout le monde écoute la même
seconde. Réactions qui flottent, chat en direct. Freemium : Gratuit / Boucan Plus.

Univers **nocturne néon**, sombre par choix, précis par exigence. Le contraire
du « slop » : palette documentée, logo vectoriel, typographie choisie.

## Système de marque

Voir **`brand.html`** (planche de marque) pour le détail. En bref :

- **Logo** : marque vectorielle (égaliseur néon dans un squircle, pic ambre) +
  wordmark « Boucan. » (point ambre). Dessiné à la main en SVG, net de 16 px à
  l'affiche. Fichier autonome : `assets/img/logomark.svg`.
- **Couleurs (codes exacts)** :
  Encre `#0D0F14` · Surface `#14171F` · Surface 2 `#1C212C` · Surface 3 `#262D3A` ·
  Rose primaire `#FF2E88` · Rose clair `#FF5CA0` · Cyan `#1FE0D4` · Ambre `#FFC24B` ·
  Lilas `#A98BFF` · Texte `#F5F7FB` · Atténué `#9BA6B6` · Discret `#7A8598`.
  Règles de contraste vérifiées (rose = texte blanc sur bouton ; cyan/ambre/lilas
  portent du texte encre).
- **Typographie** : Bricolage Grotesque (display), Hanken Grotesk (corps),
  Spline Sans Mono (timecodes). Auto-hébergées en woff2 variable.

## Généré avec Higgsfield

Higgsfield sert là où l'IA excelle (les visuels d'ambiance), pas pour le logo :

- `assets/img/hero.webp` / `keyart.webp` — key art cinématique (enceinte, ondes
  néon magenta/cyan) calé sur la palette.
- `assets/img/cover1..4.webp` — pochettes abstraites pour les morceaux du salon.

Le logo, lui, est codé au pixel près en SVG (un logo généré par IA, c'est
justement ce qui fait « slop »).

## Contenu

- `index.html` — la **landing** (hero key art, principe, bento, showcase, tarifs, FAQ).
- `app.html` + `assets/js/room.js` — le **salon jouable** :
  - **Salon** : now-playing (pochette, scrubber synchronisé, lecture/pause, visualiseur),
    réactions qui flottent.
  - **File** : file partagée, votes en direct, la file se réordonne (un vote fait
    monter un titre), ajout de morceaux.
  - **Chat** : messages en direct, réponses simulées de la bande.
- `brand.html` — la **planche de marque**.
- `assets/css/` — `style.css` (landing), `app.css` (salon), `fonts.css`.
- `assets/js/` — `app.js` (landing), `room.js` (salon).

## À tester dans le salon

1. **Salon** : lecture/pause pour toute la salle, réactions 🔥❤️🎉 qui remontent l'écran, titre suivant.
2. **File** : vote un morceau, il remonte. Ajoute un titre depuis le catalogue.
3. **Chat** : écris un message, la bande répond.
