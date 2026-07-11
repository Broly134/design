# Percer · Le cockpit des créateurs

Produit fictif complet pour la newgen : **Percer** réunit TikTok, YouTube,
Twitch et Insta dans un seul cockpit : audience, revenus, deals de marques
(0 % de commission) et calendrier de posts. Landing marketing + application
« Studio » entièrement interactive, en HTML/CSS/JS sans dépendance ni build.

## Ouvrir

```bash
python3 -m http.server 8123   # puis http://localhost:8123 (landing) et /app.html (Radar)
```

## Identité

- **Logo** : squircle iOS en dégradé rose, violet, cyan, glyphe « confluence »
  blanc (toutes tes plateformes convergent vers toi).
- **Polices** : Gabarito (titres), Figtree (interface), Spline Sans Mono (chiffres),
  auto-hébergées en woff2 variable.
- **Couleurs** : accent violet électrique, teintes iOS par vue (Studio cyan,
  Simulateur violet, Deals rose, Calendrier ambre) ; couleurs de graphe
  validées par le validateur dataviz (luminance OKLCH, CVD, contraste).

## L'application Studio (`app.html`)

Quatre vues teintées, tout est manipulable : marquer un deal « payé » crédite
les revenus au journal (0 % de commission) ; « Programmer » un post depuis le
calendrier ; le simulateur recalcule les revenus selon le rythme de posts et
l'engagement ; « Rafraîchir » ajoute des abonnés. Rail desktop, tab bar mobile
avec safe-area, tiroir de détail, toasts, reduced-motion.

## Crédits

Icônes Phosphor (MIT), photos picsum.photos, polices Google Fonts (OFL).
Marques, personnes et chiffres fictifs, à but de démonstration.
