/* Percer · Studio — logique de l'application.
   État mutable en mémoire : envoyer un devis, marquer un deal payé ou
   programmer un post change réellement les chiffres à l'écran.
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
    conso: { nom: "Toutes les chaînes", facteur: 1 },
    sas: { nom: "Chaîne principale", facteur: 0.78 },
    holding: { nom: "Chaîne gaming", facteur: 0.22 }
  };

  var nombre = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 });
  function fmtAbonnes(v) { return nombre.format(Math.round(v)); }

  var etat = {
    entite: "conso",
    detecte: 128400,
    verse: 19300,
    revenusMois: 3180,
    periode: "6m",
    dispositifs: [
      { nom: "TikTok", maj: "il y a 4 min", montant: 84200 },
      { nom: "YouTube", maj: "il y a 12 min", montant: 31700 },
      { nom: "Twitch", maj: "il y a 31 min", montant: 12500 }
    ],
    dossiers: [
      {
        id: "kavo", nom: "Kavo Energy", montant: 5000,
        statut: "instruction", tampon: { texte: "En négo", classe: "relance" },
        meta: "2 vidéos, devis envoyé il y a 3 j",
        seq: [
          { quand: "5 juil", quoi: "Brief reçu : 2 vidéos + 1 short", fait: true },
          { quand: "7 juil", quoi: "Devis envoyé depuis Percer", fait: true },
          { quand: "En attente", quoi: "Signature de la marque", fait: false }
        ]
      },
      {
        id: "wear", nom: "Studio Wear", montant: 3500,
        statut: "a-monter", tampon: { texte: "À chiffrer", classe: "attente" },
        meta: "Collection capsule, brief reçu hier",
        seq: [
          { quand: "9 juil", quoi: "Brief reçu : collection capsule", fait: true },
          { quand: "À toi", quoi: "Envoyer le devis avec tes vraies stats", fait: false }
        ]
      },
      {
        id: "nolt", nom: "Nolt Cosmétiques", montant: 2400,
        statut: "depose", tampon: { texte: "Devis envoyé", classe: "attente" },
        meta: "1 short, envoyé il y a 5 j",
        seq: [
          { quand: "2 juil", quoi: "Brief reçu : 1 short routine", fait: true },
          { quand: "6 juil", quoi: "Devis envoyé depuis Percer", fait: true }
        ]
      },
      {
        id: "lingua", nom: "Appli Lingua", montant: 1200,
        statut: "verse", tampon: { texte: "Payé", classe: "paye" },
        meta: "Payé le 8 juillet",
        seq: [
          { quand: "12 juin", quoi: "Devis signé en ligne", fait: true },
          { quand: "24 juin", quoi: "Intégration publiée", fait: true },
          { quand: "8 juil", quoi: "1 200 € reçus, deal clos", fait: true }
        ]
      }
    ],
    journal: [
      { d: "10 juil", lib: "AdSense YouTube", cat: "Pub", credit: 842 },
      { d: "8 juil", lib: "Deal Appli Lingua", cat: "Marque", credit: 1200 },
      { d: "8 juil", lib: "Abonnement Créateur", cat: "Percer", debit: 9 },
      { d: "5 juil", lib: "Subs et bits Twitch", cat: "Twitch", credit: 312 },
      { d: "28 juin", lib: "Deal Nolt, juin", cat: "Marque", credit: 2400 },
      { d: "21 juin", lib: "Fonds créateurs TikTok", cat: "TikTok", credit: 186 }
    ],
    guichets: [
      { id: "short", quoi: "Short « Backstage »", quand: "Jeudi 18 h 30", info: "Créneau optimal" },
      { id: "live", quoi: "Live spécial 100k", quand: "Dimanche 20 h", info: "Annonce jeudi" },
      { id: "collab", quoi: "Collab Studio Nova", quand: "24 juillet", info: "2 formats" }
    ]
  };

  var SERIES = {
    "6m": {
      labels: ["Fév", "Mars", "Avr", "Mai", "Juin", "Juil"],
      valeurs: [96400, 103100, 108900, 114700, 121300, 128400]
    },
    "12m": {
      labels: ["Août", "Oct", "Déc", "Fév", "Avr", "Juin", "Juil"],
      valeurs: [78200, 84500, 90300, 96400, 108900, 121300, 128400]
    },
    "tout": {
      labels: ["S1 24", "S2 24", "S1 25", "S2 25", "S1 26", "Auj."],
      valeurs: [12400, 28700, 47300, 71800, 103100, 128400]
    }
  };

  /* Simulateur : revenus selon rythme de publication et engagement */
  var PREV = {
    hist: [4300, 7900, 11600, 15800, 19300], // encaissé cumulé, mars à juillet
    histLabels: ["Mars", "Avr", "Mai", "Juin", "Juil"],
    presets: {
      debutant: { eff: 2, rd: 3 },
      croissance: { eff: 4, rd: 5 },
      viral: { eff: 7, rd: 9 }
    }
  };

  function eligible(posts, eng) {
    return Math.round(((40 + posts * 85 + eng * 260) * 12) / 100) * 100;
  }

  function projection(posts, eng) {
    var base = PREV.hist[PREV.hist.length - 1];
    var mensuel = eligible(posts, eng) / 12;
    return [1, 2, 3].map(function (k) { return Math.round(base + mensuel * k); });
  }

  function facteur() { return ENTITES[etat.entite].facteur; }

  /* ============================================================
     COMPTEURS ANIMÉS
     ============================================================ */

  var enCours = new WeakMap();

  function afficheMontant(node, valeur, formate) {
    if (!node) return;
    formate = formate || euro.format;
    var cible = Math.round(valeur);
    if (reduceMotion.matches) { node.textContent = formate(cible); return; }
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
      node.textContent = formate(Math.round(de + (cible - de) * e));
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
    var fmt = opts.fmt || euro.format;

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
      tip.textContent = labels[idx] + " : " + fmt(vals[idx]);
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
        '<svg class="icon" aria-hidden="true"><use href="#i-play"/></svg>' +
        '<span><span class="nom">' + d.nom + '</span><br><span class="maj">' + d.maj + "</span></span>" +
        '<span class="num">' + fmtAbonnes(d.montant) + "</span>");
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
      { classe: "warn", icone: "arrow-up-right", html: "«&nbsp;Studio tour&nbsp;» fait <strong>3× tes vues moyennes</strong>. Programme un follow-up.", vue: "calendrier" },
      { classe: "alerte", icone: "envelope-simple", html: "<strong>Kavo Energy</strong> attend ta réponse depuis 3 jours. <strong>Voir le deal.</strong>", vue: "deals" },
      { classe: "ok", icone: "check", html: "Palier des <strong>100&#8239;000 abonnés TikTok</strong> franchi cette nuit." }
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
    var enCoursTotal = etat.dossiers.filter(function (f) { return f.statut !== "verse"; })
      .reduce(function (s, f) { return s + f.montant; }, 0);
    afficheMontant(document.getElementById("kpi-encours"), enCoursTotal);
    afficheMontant(document.getElementById("kpi-instruction"), enCoursTotal);
    afficheMontant(document.getElementById("kpi-encaisse"), etat.verse);
  }

  function rendDetail() {
    var zone = document.getElementById("detail-contenu");
    var f = etat.dossiers.find(function (x) { return x.id === selectionne; });
    if (!f) {
      zone.innerHTML =
        '<p class="detail-vide"><svg class="icon" aria-hidden="true"><use href="#i-receipt"/></svg>' +
        "Sélectionne un deal pour voir où il en est.</p>";
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
        '<svg class="icon" aria-hidden="true"><use href="#i-arrow-up-right"/></svg>Envoyer le devis</button>';
    } else if (f.statut === "verse") {
      actions =
        '<button class="btn btn-menthe" disabled>' +
        '<svg class="icon" aria-hidden="true"><use href="#i-check"/></svg>Payé, deal clos</button>';
    } else {
      actions =
        '<button class="btn btn-menthe" id="action-verse">' +
        '<svg class="icon" aria-hidden="true"><use href="#i-check"/></svg>Marquer payé</button>' +
        '<button class="btn btn-ligne" id="action-relance">' +
        '<svg class="icon" aria-hidden="true"><use href="#i-envelope-simple"/></svg>Relancer la marque</button>';
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
      zone.innerHTML = '<p class="detail-vide">Tout est programmé. Le prochain créneau optimal apparaîtra ici.</p>';
      return;
    }
    etat.guichets.forEach(function (g) {
      var row = el("div", "echeance",
        '<svg class="icon" aria-hidden="true"><use href="#i-calendar-check"/></svg>' +
        '<span><span class="quoi">' + g.quoi + '</span><br><span class="quand">' + g.quand + "</span></span>" +
        '<span class="num" style="font-size:0.8rem">' + g.info + "</span>" +
        '<button class="regler" data-id="' + g.id + '">Programmer</button>');
      row.querySelector(".regler").addEventListener("click", function () { prepareGuichet(g.id); });
      zone.appendChild(row);
    });
  }

  /* ============================================================
     ACTIONS
     ============================================================ */

  function majDetecte(delta) {
    etat.detecte += delta;
    afficheMontant(document.getElementById("ticker-solde"), etat.detecte * facteur(), fmtAbonnes);
    afficheMontant(document.getElementById("kpi-solde"), etat.detecte * facteur(), fmtAbonnes);
  }

  function deposeDossier(id) {
    var f = etat.dossiers.find(function (x) { return x.id === id; });
    if (!f || f.statut !== "a-monter") return;
    f.statut = "depose";
    f.tampon = { texte: "Devis envoyé", classe: "attente" };
    f.meta = "Devis envoyé aujourd'hui";
    f.seq.push({ quand: "Aujourd'hui", quoi: "Devis envoyé avec tes stats à jour", fait: true });
    tamponFrais = id;
    rendDossiers();
    rendDetail();
    toast("<strong>Devis envoyé</strong> à " + f.nom + ", avec tes stats du jour.");
  }

  function relanceInstructeur(id) {
    var f = etat.dossiers.find(function (x) { return x.id === id; });
    if (!f) return;
    f.seq.push({ quand: "Aujourd'hui", quoi: "Relance envoyée à la marque", fait: true });
    rendDetail();
    toast("<strong>Relance envoyée</strong> à " + f.nom + ".");
  }

  function marqueVerse(id) {
    var f = etat.dossiers.find(function (x) { return x.id === id; });
    if (!f || f.statut === "verse" || f.statut === "a-monter") return;
    f.statut = "verse";
    f.tampon = { texte: "Payé", classe: "paye" };
    f.meta = "Payé aujourd'hui";
    f.seq.push({ quand: "Aujourd'hui", quoi: euro.format(f.montant) + " reçus, deal clos", fait: true });
    tamponFrais = id;
    etat.verse += f.montant;
    etat.revenusMois += f.montant;
    etat.journal.unshift({ d: "Auj.", lib: "Deal " + f.nom, cat: "Marque", credit: f.montant });
    afficheMontant(document.getElementById("kpi-entrees"), etat.revenusMois);
    rendDossiers();
    rendDetail();
    rendJournal();
    toast("<strong>" + f.nom + "</strong>&nbsp;: " + euro.format(f.montant) +
      " encaissés. 0&#8239;% de commission, tout est pour toi.");
  }

  function prepareGuichet(id) {
    var i = etat.guichets.findIndex(function (x) { return x.id === id; });
    if (i < 0) return;
    var g = etat.guichets[i];
    etat.guichets.splice(i, 1);
    rendGuichets();
    toast("<strong>" + g.quoi + "</strong> programmé, " + g.quand.toLowerCase() + ".");
  }

  /* ============================================================
     VUES
     ============================================================ */

  var TITRES = {
    studio: "Studio",
    simulateur: "Simulateur",
    deals: "Deals",
    calendrier: "Calendrier"
  };

  var barresPosees = false;

  function poseBarres() {
    if (barresPosees) return;
    barresPosees = true;
    requestAnimationFrame(function () {
      document.querySelectorAll("#barres-calendrier .barre").forEach(function (b) {
        b.style.height = b.getAttribute("data-h") + "%";
      });
    });
  }

  function montreVue(nom) {
    if (!TITRES[nom]) nom = "studio";
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
    if (nom === "calendrier") poseBarres();
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
    labels: SERIES["6m"].labels,
    fmt: function (v) { return fmtAbonnes(v) + " abonnés"; }
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
      afficheMontant(document.getElementById("ticker-solde"), etat.detecte * f, fmtAbonnes);
      afficheMontant(document.getElementById("kpi-solde"), etat.detecte * f, fmtAbonnes);
      afficheMontant(document.getElementById("kpi-entrees"), etat.revenusMois * f);
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
    var bas = projection(PREV.presets.debutant.eff, PREV.presets.debutant.rd);
    var haut = projection(PREV.presets.viral.eff, PREV.presets.viral.rd);
    chartSim = flowChart("chart-prev", {
      height: 300,
      hist: PREV.hist,
      proj: projection(PREV.presets.croissance.eff, PREV.presets.croissance.rd),
      band: { low: bas, high: haut },
      domain: [3800, 31000],
      labels: PREV.histLabels.concat(["Août", "Sept", "Oct"])
    });
  }
  initSim();

  function recalculeSim() {
    var eff = parseInt(curseurEff.value, 10);
    var rd = parseInt(curseurRd.value, 10);
    sortieEff.textContent = eff + (eff > 1 ? " posts" : " post");
    sortieRd.textContent = rd + " %";
    chartSim.setProjection(projection(eff, rd));
    afficheMontant(verdict, eligible(eff, rd));
    alerteSeuil.classList.toggle("visible", eff >= 6 || rd >= 8);
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
      ? "Percer poste au meilleur créneau calculé pour ton audience."
      : "Publication en pause. Tes brouillons restent prêts.";
    toast(actif
      ? "<strong>Publication automatique</strong> réactivée."
      : "<strong>Publication automatique</strong> en pause.");
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
      document.querySelector(".sync-note").lastChild.textContent = " Synchronisé à l'instant";
      majDetecte(240);
      etat.dispositifs[0].montant += 240;
      etat.dispositifs.forEach(function (d) { d.maj = "à l'instant"; });
      rendDispositifs();
      toast("<strong>Stats à jour.</strong> TikTok : +240 abonnés depuis ce matin.");
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
  montreVue((location.hash || "#studio").replace("#", ""));
})();
