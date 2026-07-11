# Manne · SaaS d'aides publiques

Produit fictif complet : **Manne** détecte les aides, subventions et crédits
d'impôt (2 300 dispositifs) auxquels une entreprise a droit, monte les dossiers
et se rémunère au succès. Landing marketing + application « Radar » entièrement
interactive, en HTML/CSS/JS sans dépendance ni build.

## Ouvrir

```bash
python3 -m http.server 8123   # puis http://localhost:8123 (landing) et /app.html (Radar)
```

## Identité

- **Logo** : squircle iOS en dégradé menthe, cyan, indigo, glyphe « confluence »
  blanc (plusieurs sources d'aides convergent vers vous).
- **Polices** : Gabarito (titres), Figtree (interface), Spline Sans Mono (chiffres),
  auto-hébergées en woff2 variable.
- **Couleurs** : teintes iOS par domaine (Radar menthe, Simulateur indigo,
  Dossiers abricot, Guichets rose) ; couleurs de graphe validées par le
  validateur dataviz (bande de luminance OKLCH, CVD, contraste).

## L'application Radar (`app.html`)

Quatre vues teintées, tout est manipulable : marquer un dossier « versé »
crédite les versements et écrit la commission au journal ; « Préparer » un
guichet crée un dossier ; le simulateur recalcule l'éligible selon l'effectif
et le budget innovation ; le scan ajoute un dispositif détecté. Rail desktop,
tab bar mobile avec safe-area, tiroir de détail, toasts, reduced-motion.

## Crédits

Icônes Phosphor (MIT), photos picsum.photos, polices Google Fonts (OFL).
Marques, personnes et chiffres fictifs, à but de démonstration.
