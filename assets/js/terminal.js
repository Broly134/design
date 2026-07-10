/* Affluent · Le Registre — logique du terminal.
   État mutable en mémoire : les actions (relancer, encaisser, régler)
   modifient réellement les chiffres à l'écran. */
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
    conso: { nom: "Consolidé", facteur: 1, comptes: ["qonto", "bnp", "ca"] },
    sas: { nom: "Maison Bocage SAS", facteur: 0.8555, comptes: ["qonto", "bnp"] },
    holding: { nom: "Bocage Holding", facteur: 0.1445, comptes: ["ca"] }
  };

  var COMPTES = {
    qonto: { nom: "Qonto", solde: 96480, maj: "il y a 4 min" },
    bnp: { nom: "BNP Paribas", solde: 61210, maj: "il y a 12 min" },
    ca: { nom: "Crédit Agricole", solde: 26630, maj: "il y a 31 min" }
  };

  var etat = {
    entite: "conso",
    solde: 184320,
    entrees30: 64180,
    periode: "6m",
    provisionAuto: true,
    factures: [
      {
        id: "novelli", client: "Novelli & Associés", montant: 4820, retard: 18,
        tampon: { texte: "Relancée", classe: "relance" }, payee: false,
        seq: [
          { quand: "12 juin", quoi: "Facture nº2026-118 émise", fait: true },
          { quand: "27 juin", quoi: "Relance douce envoyée", fait: true },
          { quand: "10 juil", quoi: "Relance ferme envoyée", fait: true },
          { quand: "17 juil", quoi: "Mise en demeure programmée", fait: false }
        ]
      },
      {
        id: "ardoise", client: "Groupe Ardoise", montant: 12400, retard: 9,
        tampon: { texte: "Programmée", classe: "attente" }, payee: false,
        seq: [
          { quand: "20 juin", quoi: "Facture nº2026-131 émise", fait: true },
          { quand: "Demain", quoi: "Relance douce programmée", fait: false }
        ]
      },
      {
        id: "fournier", client: "Fournier & Cie", montant: 9780, retard: 2,
        tampon: { texte: "En séquence", classe: "attente" }, payee: false,
        seq: [
          { quand: "26 juin", quoi: "Facture nº2026-136 émise", fait: true },
          { quand: "15 juil", quoi: "Relance douce programmée", fait: false }
        ]
      },
      {
        id: "palombe", client: "Studio Palombe", montant: 2310, retard: 4,
        tampon: { texte: "Relancée", classe: "relance" }, payee: false,
        seq: [
          { quand: "18 juin", quoi: "Facture nº2026-127 émise", fait: true },
          { quand: "8 juil", quoi: "Relance douce envoyée", fait: true },
          { quand: "22 juil", quoi: "Relance ferme programmée", fait: false }
        ]
      },
      {
        id: "litt", client: "Maison Litt", montant: 7650, retard: 0,
        tampon: { texte: "Payée", classe: "paye" }, payee: true,
        seq: [
          { quand: "5 juin", quoi: "Facture nº2026-109 émise", fait: true },
          { quand: "20 juin", quoi: "Relance douce envoyée", fait: true },
          { quand: "3 juil", quoi: "Règlement reçu, séquence close", fait: true }
        ]
      }
    ],
    ecritures: [
      { d: "10 juil", lib: "Règlement Stripe", cat: "Encaissements", credit: 8442 },
      { d: "9 juil", lib: "OVHcloud", cat: "Logiciels", debit: 180 },
      { d: "8 juil", lib: "Salaires de juin", cat: "Paie", debit: 38250 },
      { d: "5 juil", lib: "Loyer Part-Dieu", cat: "Locaux", debit: 3200 },
      { d: "4 juil", lib: "Acompte Verger & Fils", cat: "Encaissements", credit: 5310 },
      { d: "2 juil", lib: "URSSAF de juin", cat: "Charges sociales", debit: 11940 }
    ],
    echeances: [
      { id: "urssaf", quoi: "URSSAF", quand: "15 juillet", montant: 12380 },
      { id: "tva", quoi: "TVA CA3 de juillet", quand: "15 août", montant: 8940 },
      { id: "is", quoi: "Acompte IS", quand: "15 septembre", montant: 6200 }
    ]
  };

  var SERIES = {
    "6m": {
      labels: ["Fév", "Mars", "Avr", "Mai", "Juin", "Juil"],
      valeurs: [131250, 122480, 149300, 141750, 163900, 184320]
    },
    "90j": {
      labels: ["15 avr", "1 mai", "15 mai", "1 juin", "15 juin", "1 juil", "10 juil"],
      valeurs: [149300, 144100, 141750, 152600, 163900, 176800, 184320]
    },
    "30j": {
      labels: ["12 juin", "17 juin", "22 juin", "27 juin", "2 juil", "7 juil", "10 juil"],
      valeurs: [163900, 159400, 171800, 168200, 176500, 180900, 184320]
    }
  };

  /* Modèle de projection : recettes, charges saisonnières, effet du délai. */
  var PREV = {
    histLabels: ["Mars", "Avr", "Mai", "Juin", "Juil"],
    hist: [122480, 149300, 141750, 163900, 184320],
    recette: 62000,
    charges: [54000, 86000, 47000], // août · septembre (IS + URSSAF) · octobre
    seuil: 150000,
    presets: {
      prudent: { delai: 45, ca: -6 },
      neutre: { delai: 31, ca: 2 },
      optimiste: { delai: 24, ca: 9 }
    }
  };

  function projection(delai, ca) {
    var s = etat.solde;
    var pts = [];
    for (var k = 1; k <= 3; k++) {
      var flux = PREV.recette * (1 + (ca / 100) * (k / 3)) - PREV.charges[k - 1] - (delai - 31) * 900;
      s += flux;
      pts.push(Math.round(s));
    }
    return pts;
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
      if (enCours.get(node) !== cible) return; // une animation plus récente a pris la main
      if (!t0) t0 = t;
      var p = Math.min((t - t0) / dur, 1);
      var e = 1 - Math.pow(1 - p, 3);
      node.textContent = euro.format(Math.round(de + (cible - de) * e));
      if (p < 1) requestAnimationFrame(pas);
    }
    requestAnimationFrame(pas);
  }

  /* ============================================================
     GRAPHE DE FLUX (réalisé + projection, réticule, infobulle)
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

      if (opts.seuil) {
        var sy = y(opts.seuil);
        svg.appendChild(svgEl("line", {
          x1: padX, x2: w - padX, y1: sy, y2: sy,
          stroke: cssVar("--sienne-data") || "#CE6040",
          "stroke-width": 1, "stroke-dasharray": "3 5", opacity: "0.7"
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
      setProjection: function (next, nouvellesEtiquettes) {
        if (!proj) return;
        if (nouvellesEtiquettes) labels = nouvellesEtiquettes.slice();
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

  function rendComptes() {
    var zone = document.getElementById("liste-comptes");
    var ids = ENTITES[etat.entite].comptes;
    zone.innerHTML = "";
    ids.forEach(function (id) {
      var c = COMPTES[id];
      var row = el("div", "compte",
        '<svg class="icon" aria-hidden="true"><use href="#i-bank"/></svg>' +
        '<span><span class="nom">' + c.nom + '</span><br><span class="maj">' + c.maj + "</span></span>" +
        '<span class="num">' + euro.format(c.solde) + "</span>");
      zone.appendChild(row);
    });
  }

  function rendLivre() {
    var corps = document.getElementById("livre-corps");
    corps.innerHTML = "";
    etat.ecritures.slice(0, 6).forEach(function (e) {
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
      { classe: "warn", icone: "bell-ringing", html: "<strong>Groupe Ardoise</strong> dépasse 12&#8239;000&#8239;€ d'encours. Relance programmée demain." },
      { classe: "alerte", icone: "compass", html: "Creux possible mi-septembre en scénario prudent. <strong>Testez vos hypothèses.</strong>", vue: "previsionnel" },
      { classe: "ok", icone: "receipt", html: "TVA de juillet <strong>provisionnée à 100&#8239;%</strong>. Prélèvement le 15 août." }
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

  function rendFactures() {
    var zone = document.getElementById("liste-factures");
    zone.innerHTML = "";
    etat.factures.forEach(function (f) {
      var b = el("button", "facture");
      b.setAttribute("role", "option");
      b.setAttribute("aria-selected", String(selectionne === f.id));
      b.dataset.id = f.id;
      b.innerHTML =
        '<span class="client">' + f.client + "</span>" +
        '<span class="num">' + euro.format(f.montant) + "</span>" +
        '<span class="meta"><span class="tampon ' + f.tampon.classe + '">' + f.tampon.texte + "</span></span>" +
        '<span class="retard ' + (f.payee ? "neutre" : "") + '">' + (f.payee ? "soldée" : "J+" + f.retard) + "</span>";
      b.addEventListener("click", function () { ouvreDetail(f.id); });
      zone.appendChild(b);
    });
    var kEnc = document.getElementById("kpi-encours");
    var kRet = document.getElementById("kpi-retard");
    var kPay = document.getElementById("kpi-encaisse");
    var ouvertes = etat.factures.filter(function (f) { return !f.payee; });
    afficheMontant(kEnc, ouvertes.reduce(function (s, f) { return s + f.montant; }, 0));
    var retard = ouvertes.length
      ? Math.round(ouvertes.reduce(function (s, f) { return s + f.retard; }, 0) / ouvertes.length)
      : 0;
    kRet.textContent = retard + " j";
    afficheMontant(kPay, etat.factures.filter(function (f) { return f.payee; })
      .reduce(function (s, f) { return s + f.montant; }, 0));
  }

  var selectionne = null;

  function rendDetail() {
    var zone = document.getElementById("detail-contenu");
    var f = etat.factures.find(function (x) { return x.id === selectionne; });
    if (!f) {
      zone.innerHTML =
        '<p class="detail-vide"><svg class="icon" aria-hidden="true"><use href="#i-envelope-simple"/></svg>' +
        "Sélectionnez une facture pour voir sa séquence de relance.</p>";
      return;
    }
    var chrono = f.seq.map(function (s) {
      return '<div class="chrono-item ' + (s.fait ? "fait" : "") + '">' +
        '<span class="quand">' + s.quand + "</span>" + s.quoi + "</div>";
    }).join("");
    zone.innerHTML =
      '<div class="detail-tete"><div>' +
      '<span class="tampon ' + f.tampon.classe + " " + (tamponFrais === f.id ? "applique" : "") + '">' + f.tampon.texte + "</span>" +
      '<p class="client">' + f.client + '</p><span class="num">' + euro.format(f.montant) + "</span>" +
      "</div>" +
      '<button class="detail-fermer" id="detail-fermer" aria-label="Fermer le détail">' +
      '<svg class="icon" aria-hidden="true"><use href="#i-x"/></svg></button></div>' +
      '<div class="chrono">' + chrono + "</div>" +
      '<div class="actions">' +
      '<button class="btn btn-menthe" id="action-payee"' + (f.payee ? " disabled" : "") + ">" +
      '<svg class="icon" aria-hidden="true"><use href="#i-check"/></svg>Marquer payée</button>' +
      '<button class="btn btn-ligne" id="action-relancer"' + (f.payee ? " disabled" : "") + ">" +
      '<svg class="icon" aria-hidden="true"><use href="#i-envelope-simple"/></svg>Relancer maintenant</button>' +
      "</div>";
    tamponFrais = null;

    var fermer = document.getElementById("detail-fermer");
    if (fermer) fermer.addEventListener("click", fermeDetail);
    var aP = document.getElementById("action-payee");
    var aR = document.getElementById("action-relancer");
    if (aP && !f.payee) aP.addEventListener("click", function () { marquePayee(f.id); });
    if (aR && !f.payee) aR.addEventListener("click", function () { relance(f.id); });
  }

  var tamponFrais = null;

  function ouvreDetail(id) {
    selectionne = id;
    rendFactures();
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
    rendFactures();
    rendDetail();
    var b = document.querySelector('.facture[data-id="' + ancien + '"]');
    if (b) b.focus();
  }

  function rendEcheances() {
    var zone = document.getElementById("liste-echeances");
    zone.innerHTML = "";
    if (!etat.echeances.length) {
      zone.innerHTML = '<p class="detail-vide">Tout est réglé. La prochaine échéance apparaîtra ici.</p>';
      return;
    }
    etat.echeances.forEach(function (e) {
      var row = el("div", "echeance",
        '<svg class="icon" aria-hidden="true"><use href="#i-receipt"/></svg>' +
        '<span><span class="quoi">' + e.quoi + '</span><br><span class="quand">' + e.quand + "</span></span>" +
        '<span class="num">' + euro.format(e.montant) + "</span>" +
        '<button class="regler" data-id="' + e.id + '">Marquer réglée</button>');
      row.querySelector(".regler").addEventListener("click", function () { regleEcheance(e.id); });
      zone.appendChild(row);
    });
  }

  /* ============================================================
     ACTIONS (elles changent vraiment les chiffres)
     ============================================================ */

  function majSolde(delta) {
    etat.solde += delta;
    afficheMontant(document.getElementById("ticker-solde"), etat.solde * facteur());
    afficheMontant(document.getElementById("kpi-solde"), etat.solde * facteur());
    majSeries(delta);
    recalculePrev();
  }

  function majSeries(delta) {
    Object.keys(SERIES).forEach(function (k) {
      var v = SERIES[k].valeurs;
      v[v.length - 1] += delta;
    });
    if (chartSolde) montrePeriode(etat.periode, true);
  }

  function relance(id) {
    var f = etat.factures.find(function (x) { return x.id === id; });
    if (!f || f.payee) return;
    f.seq.push({ quand: "Aujourd'hui", quoi: "Relance manuelle envoyée", fait: true });
    f.tampon = { texte: "Relancée", classe: "relance" };
    tamponFrais = id;
    rendFactures();
    rendDetail();
    toast("<strong>Relance envoyée</strong> à " + f.client + ".");
  }

  function marquePayee(id) {
    var f = etat.factures.find(function (x) { return x.id === id; });
    if (!f || f.payee) return;
    f.payee = true;
    f.tampon = { texte: "Payée", classe: "paye" };
    f.seq.push({ quand: "Aujourd'hui", quoi: "Règlement reçu, séquence close", fait: true });
    tamponFrais = id;
    etat.entrees30 += f.montant;
    etat.ecritures.unshift({ d: "Auj.", lib: "Règlement " + f.client, cat: "Encaissements", credit: f.montant });
    majSolde(f.montant);
    afficheMontant(document.getElementById("kpi-entrees"), etat.entrees30 * facteur());
    rendFactures();
    rendDetail();
    rendLivre();
    toast("<strong>" + f.client + "</strong> a réglé " + euro.format(f.montant) + ". Solde mis à jour.");
  }

  function regleEcheance(id) {
    var i = etat.echeances.findIndex(function (x) { return x.id === id; });
    if (i < 0) return;
    var e = etat.echeances[i];
    etat.echeances.splice(i, 1);
    etat.ecritures.unshift({ d: "Auj.", lib: e.quoi, cat: "Charges", debit: e.montant });
    majSolde(-e.montant);
    rendEcheances();
    rendLivre();
    toast("<strong>" + e.quoi + "</strong> réglée : " + euro.format(e.montant) + " décaissés.");
  }

  /* ============================================================
     VUES
     ============================================================ */

  var TITRES = {
    apercu: "Aperçu",
    previsionnel: "Prévisionnel",
    relances: "Relances",
    echeances: "Échéances"
  };

  var barresPosees = false;

  function poseBarres() {
    if (barresPosees) return;
    barresPosees = true;
    requestAnimationFrame(function () {
      document.querySelectorAll("#barres-tva .barre").forEach(function (b) {
        b.style.height = b.getAttribute("data-h") + "%";
      });
    });
  }

  function montreVue(nom) {
    if (!TITRES[nom]) nom = "apercu";
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
    if (nom === "echeances") poseBarres();
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

  var chartSolde = flowChart("chart-solde", {
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
    chartSolde.setHist(SERIES[nom].valeurs.map(function (v) { return v * f; }), SERIES[nom].labels);
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
      afficheMontant(document.getElementById("ticker-solde"), etat.solde * f);
      afficheMontant(document.getElementById("kpi-solde"), etat.solde * f);
      afficheMontant(document.getElementById("kpi-entrees"), etat.entrees30 * f);
      rendComptes();
      montrePeriode(etat.periode, true);
    });
  });

  /* ============================================================
     PRÉVISIONNEL : curseurs + scénarios
     ============================================================ */

  var curseurDelai = document.getElementById("curseur-delai");
  var curseurCa = document.getElementById("curseur-ca");
  var sortieDelai = document.getElementById("sortie-delai");
  var sortieCa = document.getElementById("sortie-ca");
  var verdict = document.getElementById("verdict-valeur");
  var alerteSeuil = document.getElementById("alerte-seuil");
  var alerteTexte = document.getElementById("alerte-texte");

  var bandePrudent = null, bandeOptimiste = null, chartPrev = null;

  function initPrev() {
    bandePrudent = projection(PREV.presets.prudent.delai, PREV.presets.prudent.ca);
    bandeOptimiste = projection(PREV.presets.optimiste.delai, PREV.presets.optimiste.ca);
    chartPrev = flowChart("chart-prev", {
      height: 300,
      hist: PREV.hist,
      proj: projection(31, 2),
      band: { low: bandePrudent, high: bandeOptimiste },
      domain: [86000, 250000],
      seuil: PREV.seuil,
      labels: PREV.histLabels.concat(["Août", "Sept", "Oct"])
    });
  }
  initPrev();

  var MOIS_PROJ = ["août", "septembre", "octobre"];

  function recalculePrev() {
    var delai = parseInt(curseurDelai.value, 10);
    var ca = parseInt(curseurCa.value, 10);
    sortieDelai.textContent = delai + " jours";
    sortieCa.textContent = (ca > 0 ? "+" : "") + ca + " %";
    var pts = projection(delai, ca);
    chartPrev.setProjection(pts);
    afficheMontant(verdict, pts[2]);

    var idx = pts.findIndex(function (v) { return v < PREV.seuil; });
    if (idx >= 0) {
      var encours = etat.factures.filter(function (f) { return !f.payee; })
        .reduce(function (s, f) { return s + f.montant; }, 0);
      alerteTexte.innerHTML = "Passage sous votre seuil de " + euro.format(PREV.seuil) +
        " prévu en " + MOIS_PROJ[idx] + ". Relancer " + euro.format(encours) +
        " d'impayés redonnerait de la marge.";
      alerteSeuil.classList.add("visible");
    } else {
      alerteSeuil.classList.remove("visible");
    }

    // Le scénario reste coché seulement s'il correspond aux curseurs
    document.querySelectorAll("[data-scenario]").forEach(function (s) {
      var p = PREV.presets[s.dataset.scenario];
      s.setAttribute("aria-pressed", String(p.delai === delai && p.ca === ca));
    });
  }

  curseurDelai.addEventListener("input", recalculePrev);
  curseurCa.addEventListener("input", recalculePrev);

  document.querySelectorAll("[data-scenario]").forEach(function (s) {
    s.addEventListener("click", function () {
      var p = PREV.presets[s.dataset.scenario];
      curseurDelai.value = p.delai;
      curseurCa.value = p.ca;
      recalculePrev();
    });
  });

  /* ============================================================
     ÉCHÉANCES : interrupteur de provision
     ============================================================ */

  var interrupteur = document.getElementById("interrupteur-provision");
  var provisionNote = document.getElementById("provision-note");

  interrupteur.addEventListener("click", function () {
    var actif = interrupteur.getAttribute("aria-checked") !== "true";
    interrupteur.setAttribute("aria-checked", String(actif));
    provisionNote.textContent = actif
      ? "2 235 € mis de côté chaque lundi. Le 15 du mois, l'argent est déjà là."
      : "Provision suspendue. Il faudra sortir la TVA d'un coup le 15 du mois.";
    toast(actif
      ? "<strong>Provision automatique</strong> réactivée."
      : "<strong>Provision automatique</strong> suspendue.");
  });

  /* ============================================================
     Clavier & démarrage
     ============================================================ */

  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") fermeDetail();
  });
  document.getElementById("scrim").addEventListener("click", fermeDetail);

  /* Synchronisation manuelle des comptes */
  var syncBtn = document.getElementById("sync-btn");
  if (syncBtn) {
    syncBtn.addEventListener("click", function () {
      syncBtn.classList.remove("tourne");
      void syncBtn.offsetWidth; // relance l'animation
      syncBtn.classList.add("tourne");
      Object.keys(COMPTES).forEach(function (k) { COMPTES[k].maj = "à l'instant"; });
      rendComptes();
      document.querySelector(".sync-note").lastChild.textContent = " Synchronisé à l'instant";
      toast("<strong>Comptes synchronisés.</strong> Soldes à jour.");
    });
  }

  if (reduceMotion.matches) poseBarres();

  rendComptes();
  rendLivre();
  rendVeille();
  rendFactures();
  rendDetail();
  rendEcheances();
  recalculePrev();
  montreVue((location.hash || "#apercu").replace("#", ""));
})();
