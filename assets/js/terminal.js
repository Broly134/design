/* Manne · Radar — logique de l'application.
   État mutable en mémoire : déposer un dossier, le marquer versé ou
   préparer un guichet change réellement les chiffres à l'écran.
   Aucune écoute directe du scroll : IntersectionObserver + ResizeObserver. */
(function () {
  "use strict";

  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

  var euro = new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0
  });

  function el(tag, cls, html) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (html != null) n.innerHTML = html;
    return n;
  }

  /* ============================================================
     ÉTAT
     ============================================================ */

  var ENTITES = {
    conso: { nom: "Groupe consolidé", facteur: 1 },
    sas: { nom: "Maison Bocage SAS", facteur: 0.72 },
    holding: { nom: "Bocage Holding", facteur: 0.28 }
  };

  var etat = {
    entite: "conso",
    detecte: 87400,
    verse: 46900,
    periode: "6m",
    dispositifs: [
      { nom: "Crédit d'impôt recherche", score: 91, montant: 31200 },
      { nom: "Décarbonation ADEME", score: 88, montant: 24000 },
      { nom: "France Num vague 2", score: 96, montant: 5000 }
    ],
    dossiers: [
      {
        id: "cir", nom: "Crédit d'impôt recherche 2026", montant: 31200,
        statut: "instruction", tampon: { texte: "En instruction", classe: "relance" },
        meta: "Déposé le 28 juin",
        seq: [
          { quand: "12 juin", quoi: "Dossier préparé par votre chargé Manne", fait: true },
          { quand: "28 juin", quoi: "Déposé auprès de la DGFiP", fait: true },
          { quand: "Avant le 15 sept", quoi: "Attestation expert-comptable attendue", fait: false }
        ]
      },
      {
        id: "ademe", nom: "Décarbonation ADEME", montant: 24000,
        statut: "a-monter", tampon: { texte: "À monter", classe: "attente" },
        meta: "Guichet ferme le 12 sept.",
        seq: [
          { quand: "8 juil", quoi: "Éligibilité confirmée, score 88", fait: true },
          { quand: "Avant le 12 sept", quoi: "Dépôt du dossier au guichet", fait: false }
        ]
      },
      {
        id: "region", nom: "Numérique Région AURA", montant: 12000,
        statut: "instruction", tampon: { texte: "En instruction", classe: "relance" },
        meta: "Déposé le 20 juin",
        seq: [
          { quand: "6 juin", quoi: "Dossier préparé par votre chargé Manne", fait: true },
          { quand: "20 juin", quoi: "Déposé auprès de la Région", fait: true },
          { quand: "Fin août", quoi: "Passage en commission", fait: false }
        ]
      },
      {
        id: "alternance", nom: "Aide à l'alternance", montant: 6000,
        statut: "depose", tampon: { texte: "Déposé", classe: "attente" },
        meta: "Déposé il y a 4 jours",
        seq: [
          { quand: "2 juil", quoi: "Contrat d'apprentissage joint", fait: true },
          { quand: "7 juil", quoi: "Déposé auprès de l'ASP", fait: true }
        ]
      },
      {
        id: "francenum", nom: "France Num", montant: 5000,
        statut: "verse", tampon: { texte: "Versé", classe: "paye" },
        meta: "Versé le 10 juillet",
        seq: [
          { quand: "14 mai", quoi: "Dossier déposé", fait: true },
          { quand: "26 juin", quoi: "Accord de la commission", fait: true },
          { quand: "10 juil", quoi: "5 000 € versés, dossier clos", fait: true }
        ]
      }
    ],
    journal: [
      { d: "10 juil", lib: "Versement France Num", cat: "Subvention", credit: 5000 },
      { d: "10 juil", lib: "Commission au succès", cat: "Frais", debit: 400 },
      { d: "26 juin", lib: "Acompte CIR 2025", cat: "Crédit d'impôt", credit: 18600 },
      { d: "26 juin", lib: "Commission au succès", cat: "Frais", debit: 1488 },
      { d: "12 juin", lib: "Versement Région AURA", cat: "Subvention", credit: 7300 },
      { d: "2 juin", lib: "Abonnement Pilote", cat: "Frais", debit: 119 }
    ],
    guichets: [
      { id: "fn2", quoi: "France Num vague 2", quand: "Clôture le 30 juillet", montant: 5000, dossier: null },
      { id: "ademe-g", quoi: "Décarbonation ADEME", quand: "Clôture le 12 septembre", montant: 24000, dossier: "ademe" },
      { id: "innov", quoi: "Innovation Région AURA", quand: "Clôture le 30 novembre", montant: 12000, dossier: null }
    ]
  };

  var SERIES = {
    "6m": {
      labels: ["Fév", "Mars", "Avr", "Mai", "Juin", "Juil"],
      valeurs: [12400, 21300, 29800, 38400, 43100, 46900]
    },
    "12m": {
      labels: ["Août", "Oct", "Déc", "Fév", "Avr", "Juin", "Juil"],
      valeurs: [0, 6200, 12400, 21300, 33600, 43100, 46900]
    },
    "tout": {
      labels: ["S1 24", "S2 24", "S1 25", "S2 25", "S1 26", "Auj."],
      valeurs: [0, 8400, 19700, 31200, 39400, 46900]
    }
  };

  /* Simulateur : montant éligible selon effectif et budget innovation */
  var PREV = {
    hist: [12400, 21300, 29800, 38400, 46900], // versé cumulé, mars à juillet
    histLabels: ["Mars", "Avr", "Mai", "Juin", "Juil"],
    presets: {
      artisan: { eff: 6, rd: 10 },
      scaleup: { eff: 38, rd: 220 },
      industrie: { eff: 120, rd: 340 }
    }
  };

  function eligible(eff, rd) {
    return Math.round((18000 + eff * 420 + rd * 280) / 100) * 100;
  }

  function projection(eff, rd) {
    var base = etat.verse;
    var e = eligible(eff, rd);
    return [0.18, 0.42, 0.65].map(function (f) { return Math.round(base + e * f); });
  }

  function facteur() { return ENTITES[etat.entite].facteur; }

  /* ============================================================
     COMPTEURS ANIMÉS
     ============================================================ */

  var enCours = new WeakMap();

  function afficheMontant(node, valeur) {
    if (!node) return;
    var cible = Math.round(valeur);
    if (reduceMotion.matches) { node.textContent = euro.format(cible); return; }
    var depart = enCours.get(node);
    if (depart == null) {
      var brut = parseInt(node.textContent.replace(/[^\d-]/g, ""), 10);
      depart = isNaN(brut) ? cible : brut;
    }
    enCours.set(node, cible);
    var t0 = null, dur = 600, de = depart;
    function pas(t) {
      if (enCours.get(node) !== cible) return;
      if (!t0) t0 = t;
      var p = Math.min((t - t0) / dur, 1);
      var e = 1 - Math.pow(1 - p, 3);
      node.textContent = euro.format(Math.round(de + (cible - de) * e));
      if (p < 1) requestAnimationFrame(pas);
    }
    requestAnimationFrame(pas);
  }

  /* ============================================================
     GRAPHE DE FLUX (repris du moteur validé dataviz)
     ============================================================ */

  var SVG_NS = "http://www.w3.org/2000/svg";

  function svgEl(name, attrs) {
    var n = document.createElementNS(SVG_NS, name);
    for (var k in attrs) n.setAttribute(k, attrs[k]);
    return n;
  }

  function cssVar(nom) {
    return getComputedStyle(document.documentElement).getPropertyValue(nom).trim();
  }

  function flowChart(rootId, opts) {
    var wrap = document.getElementById(rootId);
    if (!wrap) return null;
    var canvas = wrap.querySelector(".chart-canvas");
    var uid = rootId.replace(/[^a-z]/gi, "");
    var height = opts.height;
    var hist = opts.hist.slice();
    var proj = opts.proj ? opts.proj.slice() : null;
    var band = opts.band || null;
    var labels = opts.labels.slice();
    var domaine = opts.domain || null;

    var hair = el("div", "chart-hair");
    var dot = el("div", "chart-dot");
    var tip = el("div", "chart-tip");
    canvas.appendChild(hair); canvas.appendChild(dot); canvas.appendChild(tip);

    var svg = null, geom = null;

    function bornes() {
      if (domaine) return domaine;
      var v = hist.slice();
      if (proj) v = v.concat(proj);
      if (band) v = v.concat(band.low, band.high);
      var min = Math.min.apply(null, v), max = Math.max.apply(null, v);
      var pad = (max - min) * 0.14 || 1;
      return [min - pad, max + pad];
    }

    function build() {
      if (svg) svg.remove();
      var w = canvas.clientWidth;
      if (w < 40) return;
      var h = height, padX = 4, padY = 10;
      var d = bornes();
      var total = (proj ? hist.length + proj.length : hist.length) - 1;

      function x(i) { return padX + (i * (w - padX * 2)) / total; }
      function y(v) { return padY + (1 - (v - d[0]) / (d[1] - d[0])) * (h - padY * 2); }
      geom = { x: x, y: y, w: w };

      svg = svgEl("svg", { width: w, height: h, viewBox: "0 0 " + w + " " + h });
      var couleur = cssVar("--menthe-data") || "#31A87D";
      var filet = cssVar("--filet-fort") || "rgba(255,255,255,.15)";

      var defs = svgEl("defs", {});
      var grad = svgEl("linearGradient", { id: "g" + uid, x1: 0, y1: 0, x2: 0, y2: 1 });
      grad.appendChild(svgEl("stop", { offset: "0", "stop-color": couleur, "stop-opacity": "0.24" }));
      grad.appendChild(svgEl("stop", { offset: "1", "stop-color": couleur, "stop-opacity": "0" }));
      defs.appendChild(grad);
      svg.appendChild(defs);

      for (var g = 1; g <= 3; g++) {
        var gy = padY + ((h - padY * 2) * g) / 4;
        svg.appendChild(svgEl("line", {
          x1: padX, x2: w - padX, y1: gy, y2: gy,
          stroke: filet, "stroke-width": 1, "stroke-dasharray": "1 5", "stroke-linecap": "round"
        }));
      }

      if (band && proj) {
        var s0 = hist.length - 1, pts = [], i;
        pts.push(x(s0) + "," + y(hist[s0]));
        for (i = 0; i < band.high.length; i++) pts.push(x(s0 + 1 + i) + "," + y(band.high[i]));
        for (i = band.low.length - 1; i >= 0; i--) pts.push(x(s0 + 1 + i) + "," + y(band.low[i]));
        svg.appendChild(svgEl("polygon", { points: pts.join(" "), fill: couleur, "fill-opacity": "0.09" }));
      }

      var aire = "M" + x(0) + "," + y(hist[0]);
      for (var a = 1; a < hist.length; a++) aire += " L" + x(a) + "," + y(hist[a]);
      aire += " L" + x(hist.length - 1) + "," + (h - padY) + " L" + x(0) + "," + (h - padY) + " Z";
      svg.appendChild(svgEl("path", { d: aire, fill: "url(#g" + uid + ")" }));

      var trait = "M" + x(0) + "," + y(hist[0]);
      for (var l = 1; l < hist.length; l++) trait += " L" + x(l) + "," + y(hist[l]);
      svg.appendChild(svgEl("path", {
        d: trait, fill: "none", stroke: couleur,
        "stroke-width": 2, "stroke-linejoin": "round", "stroke-linecap": "round"
      }));

      if (proj) {
        var s1 = hist.length - 1;
        var pd = "M" + x(s1) + "," + y(hist[s1]);
        for (var p = 0; p < proj.length; p++) pd += " L" + x(s1 + 1 + p) + "," + y(proj[p]);
        svg.appendChild(svgEl("path", {
          d: pd, fill: "none", stroke: couleur, "stroke-width": 2,
          "stroke-dasharray": "5 6", "stroke-linejoin": "round", "stroke-linecap": "round"
        }));
      }

      var lastI = proj ? total : hist.length - 1;
      var lastV = proj ? proj[proj.length - 1] : hist[hist.length - 1];
      svg.appendChild(svgEl("circle", {
        cx: x(lastI), cy: y(lastV), r: 4,
        fill: couleur, stroke: cssVar("--encre-2") || "#0D1310", "stroke-width": 2
      }));

      canvas.insertBefore(svg, hair);
    }

    function valeurs() { return proj ? hist.concat(proj) : hist; }

    canvas.addEventListener("pointermove", function (evt) {
      if (!geom) return;
      var rect = canvas.getBoundingClientRect();
      var mx = evt.clientX - rect.left;
      var vals = valeurs();
      var total = vals.length - 1;
      var idx = Math.max(0, Math.min(total, Math.round(((mx - 4) / (geom.w - 8)) * total)));
      var px = geom.x(idx), py = geom.y(vals[idx]);
      hair.style.left = px + "px"; hair.style.opacity = "1";
      dot.style.left = px + "px"; dot.style.top = py + "px"; dot.style.opacity = "1";
      tip.textContent = labels[idx] + " : " + euro.format(vals[idx]);
      tip.style.left = Math.max(56, Math.min(geom.w - 56, px)) + "px";
      tip.style.top = py + "px";
      tip.style.opacity = "1";
    });
    canvas.addEventListener("pointerleave", function () {
      hair.style.opacity = "0"; dot.style.opacity = "0"; tip.style.opacity = "0";
    });

    if ("ResizeObserver" in window) {
      new ResizeObserver(function () { build(); }).observe(canvas);
    }
    build();

    return {
      setHist: function (v, l) { hist = v.slice(); labels = l ? l.slice() : labels; build(); },
      bump: function (delta) {
        hist[hist.length - 1] += delta;
        build();
      },
      setProjection: function (next) {
        if (!proj) return;
        if (reduceMotion.matches) { proj = next.slice(); build(); return; }
        var de = proj.slice(), t0 = null, dur = 300;
        function pas(t) {
          if (!t0) t0 = t;
          var p = Math.min((t - t0) / dur, 1);
          var e = 1 - Math.pow(1 - p, 3);
          proj = de.map(function (v, i) { return v + (next[i] - v) * e; });
          build();
          if (p < 1) requestAnimationFrame(pas);
          else { proj = next.slice(); build(); }
        }
        requestAnimationFrame(pas);
      }
    };
  }

  /* ============================================================
     TOASTS
     ============================================================ */

  var zoneToasts = document.getElementById("toasts");

  function toast(html) {
    var t = el("div", "toast",
      '<svg class="icon" aria-hidden="true"><use href="#i-check"/></svg><span>' + html + "</span>");
    zoneToasts.appendChild(t);
    setTimeout(function () {
      t.classList.add("sortie");
      setTimeout(function () { t.remove(); }, 320);
    }, 4200);
  }

  /* ============================================================
     RENDUS
     ============================================================ */

  function rendDispositifs() {
    var zone = document.getElementById("liste-comptes");
    zone.innerHTML = "";
    etat.dispositifs.forEach(function (d) {
      var row = el("div", "compte",
        '<svg class="icon" aria-hidden="true"><use href="#i-receipt"/></svg>' +
        '<span><span class="nom">' + d.nom + '</span><br><span class="maj">score ' + d.score + " / 100</span></span>" +
        '<span class="num">' + euro.format(d.montant) + "</span>");
      zone.appendChild(row);
    });
  }

  function rendJournal() {
    var corps = document.getElementById("livre-corps");
    corps.innerHTML = "";
    etat.journal.slice(0, 6).forEach(function (e) {
      var tr = document.createElement("tr");
      tr.innerHTML =
        '<td class="date">' + e.d + "</td>" +
        "<td>" + e.lib + "</td>" +
        '<td class="col-cat"><span class="cat">' + e.cat + "</span></td>" +
        '<td class="debit">' + (e.debit ? euro.format(e.debit) : "") + "</td>" +
        '<td class="credit">' + (e.credit ? euro.format(e.credit) : "") + "</td>";
      corps.appendChild(tr);
    });
  }

  function rendVeille() {
    var zone = document.getElementById("liste-veille");
    zone.innerHTML = "";
    var items = [
      { classe: "warn", icone: "bell-ringing", html: "<strong>Décarbonation ADEME</strong> ferme dans 9 semaines. 24&#8239;000&#8239;€ pour votre profil.", vue: "guichets" },
      { classe: "alerte", icone: "receipt", html: "CIR 2026&nbsp;: attestation expert-comptable attendue avant le 15 septembre. <strong>Voir le dossier.</strong>", vue: "dossiers" },
      { classe: "ok", icone: "check", html: "France Num&nbsp;: <strong>5&#8239;000&#8239;€ versés</strong> le 10 juillet. Dossier clos." }
    ];
    items.forEach(function (it) {
      var n = el(it.vue ? "button" : "div", "veille-item " + it.classe,
        '<svg class="icon" aria-hidden="true"><use href="#i-' + it.icone + '"/></svg><p>' + it.html + "</p>");
      if (it.vue) {
        n.style.textAlign = "left";
        n.addEventListener("click", function () { montreVue(it.vue); });
      }
      zone.appendChild(n);
    });
  }

  var selectionne = null;
  var tamponFrais = null;

  function rendDossiers() {
    var zone = document.getElementById("liste-factures");
    zone.innerHTML = "";
    etat.dossiers.forEach(function (f) {
      var b = el("button", "facture");
      b.setAttribute("role", "option");
      b.setAttribute("aria-selected", String(selectionne === f.id));
      b.dataset.id = f.id;
      b.innerHTML =
        '<span class="client">' + f.nom + "</span>" +
        '<span class="num">' + euro.format(f.montant) + "</span>" +
        '<span class="meta"><span class="tampon ' + f.tampon.classe + '">' + f.tampon.texte + "</span></span>" +
        '<span class="retard ' + (f.statut === "verse" ? "neutre" : "") + '">' + f.meta + "</span>";
      b.addEventListener("click", function () { ouvreDetail(f.id); });
      zone.appendChild(b);
    });
    afficheMontant(document.getElementById("kpi-encours"),
      etat.dossiers.filter(function (f) { return f.statut === "instruction"; })
        .reduce(function (s, f) { return s + f.montant; }, 0));
    afficheMontant(document.getElementById("kpi-instruction"),
      etat.dossiers.filter(function (f) { return f.statut === "instruction"; })
        .reduce(function (s, f) { return s + f.montant; }, 0));
    afficheMontant(document.getElementById("kpi-encaisse"), etat.verse * facteur());
  }

  function rendDetail() {
    var zone = document.getElementById("detail-contenu");
    var f = etat.dossiers.find(function (x) { return x.id === selectionne; });
    if (!f) {
      zone.innerHTML =
        '<p class="detail-vide"><svg class="icon" aria-hidden="true"><use href="#i-receipt"/></svg>' +
        "Sélectionnez un dossier pour voir son avancement.</p>";
      return;
    }
    var chrono = f.seq.map(function (s) {
      return '<div class="chrono-item ' + (s.fait ? "fait" : "") + '">' +
        '<span class="quand">' + s.quand + "</span>" + s.quoi + "</div>";
    }).join("");

    var actions = "";
    if (f.statut === "a-monter") {
      actions =
        '<button class="btn btn-menthe" id="action-deposer">' +
        '<svg class="icon" aria-hidden="true"><use href="#i-arrow-up-right"/></svg>Déposer le dossier</button>';
    } else if (f.statut === "verse") {
      actions =
        '<button class="btn btn-menthe" disabled>' +
        '<svg class="icon" aria-hidden="true"><use href="#i-check"/></svg>Versé, dossier clos</button>';
    } else {
      actions =
        '<button class="btn btn-menthe" id="action-verse">' +
        '<svg class="icon" aria-hidden="true"><use href="#i-check"/></svg>Marquer versé</button>' +
        '<button class="btn btn-ligne" id="action-relance">' +
        '<svg class="icon" aria-hidden="true"><use href="#i-envelope-simple"/></svg>Relancer l’instructeur</button>';
    }

    zone.innerHTML =
      '<div class="detail-tete"><div>' +
      '<span class="tampon ' + f.tampon.classe + " " + (tamponFrais === f.id ? "applique" : "") + '">' + f.tampon.texte + "</span>" +
      '<p class="client">' + f.nom + '</p><span class="num">' + euro.format(f.montant) + "</span>" +
      "</div>" +
      '<button class="detail-fermer" id="detail-fermer" aria-label="Fermer le détail">' +
      '<svg class="icon" aria-hidden="true"><use href="#i-x"/></svg></button></div>' +
      '<div class="chrono">' + chrono + "</div>" +
      '<div class="actions">' + actions + "</div>";
    tamponFrais = null;

    var fermer = document.getElementById("detail-fermer");
    if (fermer) fermer.addEventListener("click", fermeDetail);
    var aD = document.getElementById("action-deposer");
    var aV = document.getElementById("action-verse");
    var aR = document.getElementById("action-relance");
    if (aD) aD.addEventListener("click", function () { deposeDossier(f.id); });
    if (aV) aV.addEventListener("click", function () { marqueVerse(f.id); });
    if (aR) aR.addEventListener("click", function () { relanceInstructeur(f.id); });
  }

  function ouvreDetail(id) {
    selectionne = id;
    rendDossiers();
    rendDetail();
    var panneau = document.getElementById("panneau-detail");
    var scrim = document.getElementById("scrim");
    if (window.matchMedia("(max-width: 1160px)").matches) {
      panneau.classList.add("ouvert");
      scrim.classList.add("visible");
      var fermer = document.getElementById("detail-fermer");
      if (fermer) fermer.focus();
    }
  }

  function fermeDetail() {
    var panneau = document.getElementById("panneau-detail");
    var etaitOuvert = panneau.classList.contains("ouvert") || selectionne !== null;
    panneau.classList.remove("ouvert");
    document.getElementById("scrim").classList.remove("visible");
    if (!etaitOuvert) return;
    var ancien = selectionne;
    selectionne = null;
    rendDossiers();
    rendDetail();
    var b = document.querySelector('.facture[data-id="' + ancien + '"]');
    if (b) b.focus();
  }

  function rendGuichets() {
    var zone = document.getElementById("liste-echeances");
    zone.innerHTML = "";
    if (!etat.guichets.length) {
      zone.innerHTML = '<p class="detail-vide">Aucune fenêtre imminente. La veille tourne pour vous.</p>';
      return;
    }
    etat.guichets.forEach(function (g) {
      var action = g.dossier
        ? '<button class="regler" data-id="' + g.id + '">Voir le dossier</button>'
        : '<button class="regler" data-id="' + g.id + '">Préparer le dossier</button>';
      var row = el("div", "echeance",
        '<svg class="icon" aria-hidden="true"><use href="#i-calendar-check"/></svg>' +
        '<span><span class="quoi">' + g.quoi + '</span><br><span class="quand">' + g.quand + "</span></span>" +
        '<span class="num">' + euro.format(g.montant) + "</span>" +
        action);
      row.querySelector(".regler").addEventListener("click", function () { prepareGuichet(g.id); });
      zone.appendChild(row);
    });
  }

  /* ============================================================
     ACTIONS
     ============================================================ */

  function majDetecte(delta) {
    etat.detecte += delta;
    afficheMontant(document.getElementById("ticker-solde"), etat.detecte * facteur());
    afficheMontant(document.getElementById("kpi-solde"), etat.detecte * facteur());
  }

  function deposeDossier(id) {
    var f = etat.dossiers.find(function (x) { return x.id === id; });
    if (!f || f.statut !== "a-monter") return;
    f.statut = "depose";
    f.tampon = { texte: "Déposé", classe: "attente" };
    f.meta = "Déposé aujourd'hui";
    f.seq.push({ quand: "Aujourd'hui", quoi: "Déposé au guichet par votre chargé Manne", fait: true });
    tamponFrais = id;
    rendDossiers();
    rendDetail();
    toast("<strong>" + f.nom + "</strong> déposé. L'instructeur a accusé réception.");
  }

  function relanceInstructeur(id) {
    var f = etat.dossiers.find(function (x) { return x.id === id; });
    if (!f) return;
    f.seq.push({ quand: "Aujourd'hui", quoi: "Relance envoyée à l'instructeur", fait: true });
    rendDetail();
    toast("<strong>Relance envoyée</strong> pour " + f.nom + ".");
  }

  function marqueVerse(id) {
    var f = etat.dossiers.find(function (x) { return x.id === id; });
    if (!f || f.statut === "verse" || f.statut === "a-monter") return;
    f.statut = "verse";
    f.tampon = { texte: "Versé", classe: "paye" };
    f.meta = "Versé aujourd'hui";
    f.seq.push({ quand: "Aujourd'hui", quoi: euro.format(f.montant) + " versés, dossier clos", fait: true });
    tamponFrais = id;
    var commission = Math.round(f.montant * 0.08);
    etat.verse += f.montant;
    etat.journal.unshift({ d: "Auj.", lib: "Commission au succès", cat: "Frais", debit: commission });
    etat.journal.unshift({ d: "Auj.", lib: "Versement " + f.nom, cat: "Subvention", credit: f.montant });
    Object.keys(SERIES).forEach(function (k) {
      var v = SERIES[k].valeurs;
      v[v.length - 1] += f.montant;
    });
    if (chartVersements) montrePeriode(etat.periode, true);
    afficheMontant(document.getElementById("kpi-entrees"), etat.verse * facteur());
    rendDossiers();
    rendDetail();
    rendJournal();
    recalculeSim();
    toast("<strong>" + f.nom + "</strong>&nbsp;: " + euro.format(f.montant) +
      " versés. Commission " + euro.format(commission) + ", prélevée après coup.");
  }

  function prepareGuichet(id) {
    var i = etat.guichets.findIndex(function (x) { return x.id === id; });
    if (i < 0) return;
    var g = etat.guichets[i];
    if (g.dossier) {
      montreVue("dossiers");
      ouvreDetail(g.dossier);
      return;
    }
    etat.guichets.splice(i, 1);
    var nid = "g-" + g.id;
    etat.dossiers.unshift({
      id: nid, nom: g.quoi, montant: g.montant,
      statut: "a-monter", tampon: { texte: "À monter", classe: "attente" },
      meta: g.quand,
      seq: [{ quand: "Aujourd'hui", quoi: "Ajouté à vos dossiers depuis la veille", fait: true },
            { quand: g.quand.replace("Clôture", "Avant"), quoi: "Dépôt du dossier au guichet", fait: false }]
    });
    rendGuichets();
    rendDossiers();
    toast("<strong>" + g.quoi + "</strong> ajouté à vos dossiers.");
  }

  /* ============================================================
     VUES
     ============================================================ */

  var TITRES = {
    radar: "Radar",
    simulateur: "Simulateur",
    dossiers: "Dossiers",
    guichets: "Guichets"
  };

  var barresPosees = false;

  function poseBarres() {
    if (barresPosees) return;
    barresPosees = true;
    requestAnimationFrame(function () {
      document.querySelectorAll("#barres-guichets .barre").forEach(function (b) {
        b.style.height = b.getAttribute("data-h") + "%";
      });
    });
  }

  function montreVue(nom) {
    if (!TITRES[nom]) nom = "radar";
    document.querySelectorAll(".vue").forEach(function (v) {
      var active = v.id === "vue-" + nom;
      v.classList.toggle("active", active);
      if (active) v.removeAttribute("hidden");
      else v.setAttribute("hidden", "");
    });
    document.querySelectorAll("[data-vue]").forEach(function (b) {
      if (b.dataset.vue === nom) b.setAttribute("aria-current", "page");
      else b.removeAttribute("aria-current");
    });
    document.getElementById("vue-titre").textContent = TITRES[nom];
    if (nom === "guichets") poseBarres();
    fermeDetail();
    if (location.hash !== "#" + nom) {
      try { history.replaceState(null, "", "#" + nom); } catch (e) {}
    }
    window.scrollTo({ top: 0, behavior: "instant" in window ? "instant" : "auto" });
  }

  document.querySelectorAll("[data-vue]").forEach(function (b) {
    b.addEventListener("click", function () { montreVue(b.dataset.vue); });
  });
  document.querySelectorAll("[data-vue-lien]").forEach(function (b) {
    b.addEventListener("click", function () { montreVue(b.dataset.vueLien); });
  });
  window.addEventListener("hashchange", function () {
    montreVue(location.hash.replace("#", ""));
  });

  /* ============================================================
     GRAPHES + PÉRIODES + ENTITÉS
     ============================================================ */

  var chartVersements = flowChart("chart-solde", {
    height: 230,
    hist: SERIES["6m"].valeurs.map(function (v) { return v * facteur(); }),
    labels: SERIES["6m"].labels
  });

  function etiquettes(nom) {
    var zone = document.getElementById("chart-solde-labels");
    zone.innerHTML = SERIES[nom].labels.map(function (l) { return "<span>" + l + "</span>"; }).join("");
  }
  etiquettes("6m");

  function montrePeriode(nom, silencieux) {
    etat.periode = nom;
    document.querySelectorAll("[data-periode]").forEach(function (c) {
      c.setAttribute("aria-pressed", String(c.dataset.periode === nom));
    });
    var f = facteur();
    chartVersements.setHist(SERIES[nom].valeurs.map(function (v) { return v * f; }), SERIES[nom].labels);
    if (!silencieux) etiquettes(nom);
  }

  document.querySelectorAll("[data-periode]").forEach(function (c) {
    c.addEventListener("click", function () { montrePeriode(c.dataset.periode); });
  });

  /* Entités */

  var entite = document.getElementById("entite");
  var entiteBtn = document.getElementById("entite-btn");

  entiteBtn.addEventListener("click", function () {
    var ouvert = entite.classList.toggle("open");
    entiteBtn.setAttribute("aria-expanded", String(ouvert));
  });
  document.addEventListener("click", function (e) {
    if (!entite.contains(e.target)) {
      entite.classList.remove("open");
      entiteBtn.setAttribute("aria-expanded", "false");
    }
  });

  document.querySelectorAll("[data-entite]").forEach(function (b) {
    b.addEventListener("click", function () {
      etat.entite = b.dataset.entite;
      document.querySelectorAll("[data-entite]").forEach(function (x) {
        x.setAttribute("aria-selected", String(x === b));
      });
      document.getElementById("entite-nom").textContent = ENTITES[etat.entite].nom;
      entite.classList.remove("open");
      entiteBtn.setAttribute("aria-expanded", "false");
      var f = facteur();
      afficheMontant(document.getElementById("ticker-solde"), etat.detecte * f);
      afficheMontant(document.getElementById("kpi-solde"), etat.detecte * f);
      afficheMontant(document.getElementById("kpi-entrees"), etat.verse * f);
      afficheMontant(document.getElementById("kpi-encaisse"), etat.verse * f);
      montrePeriode(etat.periode, true);
    });
  });

  /* ============================================================
     SIMULATEUR : curseurs + profils
     ============================================================ */

  var curseurEff = document.getElementById("curseur-eff");
  var curseurRd = document.getElementById("curseur-rd");
  var sortieEff = document.getElementById("sortie-eff");
  var sortieRd = document.getElementById("sortie-rd");
  var verdict = document.getElementById("verdict-valeur");
  var alerteSeuil = document.getElementById("alerte-seuil");

  var chartSim = null;

  function initSim() {
    var bas = projection(PREV.presets.artisan.eff, PREV.presets.artisan.rd);
    var haut = projection(PREV.presets.industrie.eff, PREV.presets.industrie.rd);
    chartSim = flowChart("chart-prev", {
      height: 300,
      hist: PREV.hist,
      proj: projection(PREV.presets.scaleup.eff, PREV.presets.scaleup.rd),
      band: { low: bas, high: haut },
      domain: [8000, 168000],
      labels: PREV.histLabels.concat(["Août", "Sept", "Oct"])
    });
  }
  initSim();

  function recalculeSim() {
    var eff = parseInt(curseurEff.value, 10);
    var rd = parseInt(curseurRd.value, 10);
    sortieEff.textContent = eff + (eff > 1 ? " salariés" : " salarié");
    sortieRd.textContent = rd + " k€";
    chartSim.setProjection(projection(eff, rd));
    afficheMontant(verdict, eligible(eff, rd));
    alerteSeuil.classList.toggle("visible", rd >= 250 || eff >= 90);
    document.querySelectorAll("[data-scenario]").forEach(function (s) {
      var p = PREV.presets[s.dataset.scenario];
      s.setAttribute("aria-pressed", String(p.eff === eff && p.rd === rd));
    });
  }

  curseurEff.addEventListener("input", recalculeSim);
  curseurRd.addEventListener("input", recalculeSim);

  document.querySelectorAll("[data-scenario]").forEach(function (s) {
    s.addEventListener("click", function () {
      var p = PREV.presets[s.dataset.scenario];
      curseurEff.value = p.eff;
      curseurRd.value = p.rd;
      recalculeSim();
    });
  });

  /* ============================================================
     GUICHETS : interrupteur de veille
     ============================================================ */

  var interrupteur = document.getElementById("interrupteur-veille");
  var veilleNote = document.getElementById("veille-note");

  interrupteur.addEventListener("click", function () {
    var actif = interrupteur.getAttribute("aria-checked") !== "true";
    interrupteur.setAttribute("aria-checked", String(actif));
    veilleNote.textContent = actif
      ? "Nouveau guichet correspondant à votre profil : alerte sous 24 h."
      : "Veille suspendue. Les nouveaux guichets ne seront plus signalés.";
    toast(actif
      ? "<strong>Veille des guichets</strong> réactivée."
      : "<strong>Veille des guichets</strong> suspendue.");
  });

  /* ============================================================
     Divers & démarrage
     ============================================================ */

  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") fermeDetail();
  });
  document.getElementById("scrim").addEventListener("click", fermeDetail);

  var syncBtn = document.getElementById("sync-btn");
  if (syncBtn) {
    syncBtn.addEventListener("click", function () {
      syncBtn.classList.remove("tourne");
      void syncBtn.offsetWidth;
      syncBtn.classList.add("tourne");
      document.querySelector(".sync-note").lastChild.textContent = " Base à jour à l'instant";
      majDetecte(2400);
      etat.dispositifs.unshift({ nom: "Volontariat territorial", score: 82, montant: 2400 });
      if (etat.dispositifs.length > 3) etat.dispositifs.pop();
      rendDispositifs();
      toast("<strong>Scan terminé.</strong> 1 nouveau dispositif : Volontariat territorial, 2&#8239;400&#8239;€.");
    });
  }

  if (reduceMotion.matches) poseBarres();

  rendDispositifs();
  rendJournal();
  rendVeille();
  rendDossiers();
  rendDetail();
  rendGuichets();
  recalculeSim();
  montreVue((location.hash || "#radar").replace("#", ""));
})();
