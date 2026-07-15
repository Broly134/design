/* ============================================================
   PÉPITE · moteur de l'appli
   Boucle de jeu : chemin -> leçon jouable -> récompenses -> état.
   Aucune écoute directe du scroll. Vanilla JS.
   ============================================================ */
(function () {
  "use strict";

  var $  = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return [].slice.call((r || document).querySelectorAll(s)); };

  /* Source de la mascotte (chemin local en dev, data-URI dans l'artifact) */
  var FILOU = (document.getElementById("filouAsset") || {}).src || "assets/img/filou-mascot.webp";

  /* ---------------- État ---------------- */
  var state = {
    serie: 12, gems: 85, coeurs: 5, maxCoeurs: 5, unlimited: false,
    serieFaiteAujourdhui: false,
    xpJour: 10, leconsFaites: 0, sansFautes: 0, xpTotal: 2480
  };

  /* ---------------- Contenu de la leçon ---------------- */
  var LESSON = {
    titre: "La règle 50/30/20",
    questions: [
      { kind: "QCM", filou: true,
        title: "Selon la règle 50/30/20, quelle part va aux besoins essentiels (loyer, courses) ?",
        opts: [{ t: "30 %" }, { t: "50 %", ok: true }, { t: "20 %" }, { t: "70 %" }],
        why: "50 % pour l'essentiel : c'est le socle." },
      { kind: "QCM",
        title: "À quoi servent les 20 % de la règle ?",
        opts: [{ t: "Aux sorties" }, { t: "À l'épargne et rembourser ses dettes", ok: true }, { t: "Au loyer" }, { t: "Aux abonnements" }],
        why: "Les 20 % construisent ton avenir." },
      { kind: "MOT",
        title: "Complète : un ______ d'urgence, c'est de l'argent de côté pour les imprévus.",
        opts: [{ t: "fonds", ok: true }, { t: "prêt" }, { t: "crédit" }, { t: "découvert" }],
        why: "Un « fonds d'urgence » te protège des coups durs." },
      { kind: "QCM",
        title: "Laquelle est une dépense « plaisir » (les 30 %) ?",
        opts: [{ t: "Cinéma entre potes", lead: "🎬", ok: true }, { t: "Le loyer", lead: "🏠" }, { t: "Les courses", lead: "🥖" }, { t: "L'électricité", lead: "💡" }],
        why: "Le loyer et les courses sont des besoins, pas des plaisirs." },
      { kind: "QCM",
        title: "Tu gagnes 1 200 € par mois. Avec la règle, combien mets-tu de côté ?",
        opts: [{ t: "120 €" }, { t: "240 €", ok: true }, { t: "600 €" }, { t: "60 €" }],
        why: "20 % de 1 200 €, ça fait 240 € chaque mois." }
    ]
  };

  /* ---------------- Ligue ---------------- */
  var RANKS = [
    { n: "Sofia", c: "#F2760C", xp: 712 },
    { n: "Malik", c: "#8B5CF6", xp: 690 },
    { n: "Théo",  c: "#29B6F6", xp: 655 },
    { n: "Toi",   c: "#7C4DEF", xp: 640, you: true },
    { n: "Léa",   c: "#FF4D8D", xp: 618 },
    { n: "Nour",  c: "#1FA24A", xp: 602 },
    { n: "Adam",  c: "#F5B921", xp: 577 },
    { n: "Iris",  c: "#29B6F6", xp: 540 },
    { n: "Hugo",  c: "#F2760C", xp: 512 },
    { n: "Zoé",   c: "#8B5CF6", xp: 498 }
  ];

  /* ---------------- Raccourcis DOM ---------------- */
  var nSerie = $("#nSerie"), nGem = $("#nGem"), nCoeur = $("#nCoeur");
  var cSerie = $("#cSerie"), cGem = $("#cGem"), cCoeur = $("#cCoeur");
  var lecon = $("#lecon"), lecBody = $("#lecBody"), lecFoot = $("#lecFoot");
  var lecCheck = $("#lecCheck"), lecProg = $("#lecProg"), lecHearts = $("#lecHearts");
  var lecDone = $("#lecDone"), verdict = $("#verdict"), verIc = $("#verIc"), verTitle = $("#verTitle"), verMsg = $("#verMsg");

  /* ---------------- Utilitaires ---------------- */
  function popChip(el) {
    if (!el) return;
    el.classList.remove("pop"); void el.offsetWidth; el.classList.add("pop");
  }
  function updateTop() {
    nSerie.textContent = state.serie;
    nGem.textContent = state.gems;
    nCoeur.textContent = state.unlimited ? "∞" : state.coeurs;
    var ps = $("#pSerie"); if (ps) ps.textContent = state.serie;
    var px = $("#pXp"); if (px) px.textContent = state.xpTotal.toLocaleString("fr-FR");
  }

  var toast = $("#toast"), toastMsg = $("#toastMsg"), toastT;
  function showToast(msg) {
    toastMsg.textContent = msg;
    toast.classList.add("show");
    clearTimeout(toastT);
    toastT = setTimeout(function () { toast.classList.remove("show"); }, 2400);
  }

  function confetti() {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    var box = $("#confetti");
    var cols = ["#F2760C", "#1FA24A", "#8B5CF6", "#FF4D8D", "#29B6F6", "#F5B921"];
    for (var i = 0; i < 44; i++) {
      var s = document.createElement("i");
      s.style.left = Math.random() * 100 + "%";
      s.style.background = cols[i % cols.length];
      s.style.animationDuration = (1.3 + Math.random() * 1.1) + "s";
      s.style.animationDelay = (Math.random() * 0.35) + "s";
      s.style.transform = "translateY(0) rotate(" + (Math.random() * 360) + "deg)";
      box.appendChild(s);
    }
    setTimeout(function () { box.innerHTML = ""; }, 2600);
  }

  /* ---------------- Onglets ---------------- */
  $$(".tab").forEach(function (tab) {
    tab.addEventListener("click", function () {
      $$(".tab").forEach(function (t) { t.removeAttribute("aria-current"); });
      tab.setAttribute("aria-current", "page");
      $$(".view").forEach(function (v) { v.classList.toggle("on", v.dataset.vue === tab.dataset.tab); });
      window.scrollTo(0, 0);
    });
  });

  /* ---------------- Chemin ---------------- */
  var path1 = $("#path1");
  function positionMascot() {
    var active = path1.querySelector(".node.active");
    var m = path1.querySelector(".path-mascot");
    if (!active || !m) return;
    m.style.top = (active.offsetTop + active.offsetHeight / 2 - 46) + "px";
    var x = parseFloat(active.style.getPropertyValue("--x")) || 0;
    if (x >= 0) { m.style.left = "3%"; m.style.right = "auto"; }
    else { m.style.right = "3%"; m.style.left = "auto"; }
  }

  var openedNode = null;
  $$(".node").forEach(function (node) {
    node.addEventListener("click", function () {
      if (node.classList.contains("locked")) return;
      if (node.dataset.chest) { showToast("Coffre bonus : reviens demain le récupérer."); return; }
      if (node.dataset.lesson) { openedNode = node; openLesson(); }
    });
  });
  var guideBtn = $("#guideBtn");
  if (guideBtn) guideBtn.addEventListener("click", function () { showToast("Le guide de l'unité arrive bientôt."); });

  function progressNode() {
    if (!openedNode || !openedNode.classList.contains("active")) return;
    // Le nœud actif devient validé
    var bubble = openedNode.querySelector(".start-bubble");
    if (bubble) bubble.remove();
    openedNode.classList.remove("active");
    openedNode.classList.add("done");
    openedNode.querySelector("use").setAttribute("href", "#i-check");
    openedNode.setAttribute("aria-label", "Leçon validée, réviser");
    // Le premier nœud verrouillé de l'unité s'ouvre
    var next = path1.querySelector(".node.locked");
    if (next) {
      next.classList.remove("locked");
      next.classList.add("active");
      next.removeAttribute("disabled");
      next.dataset.lesson = "budget";
      next.setAttribute("aria-label", "Commencer la leçon suivante");
      next.querySelector("use").setAttribute("href", "#i-book-open");
      var b = document.createElement("span");
      b.className = "start-bubble"; b.textContent = "Commencer";
      next.insertBefore(b, next.firstChild);
      next.addEventListener("click", function () {
        if (next.dataset.lesson) { openedNode = next; openLesson(); }
      });
    }
    positionMascot();
  }

  /* ---------------- Leçon ---------------- */
  var idx = 0, selected = null, correct = 0, mode = "answer", t0 = 0, awaitingHearts = false;
  var total = LESSON.questions.length;

  function openLesson() {
    idx = 0; correct = 0; t0 = Date.now(); awaitingHearts = false;
    lecDone.classList.remove("on");
    lecBody.style.display = ""; lecFoot.style.display = "";
    lecon.classList.add("on"); lecon.setAttribute("aria-hidden", "false");
    lecHearts.textContent = state.unlimited ? "∞" : state.coeurs;
    renderQuestion();
  }
  function closeLesson() {
    lecon.classList.remove("on"); lecon.setAttribute("aria-hidden", "true");
  }
  $("#lecClose").addEventListener("click", closeLesson);

  function kindLabel(k) { return k === "MOT" ? "Complète la phrase" : "Choisis la bonne réponse"; }

  function renderQuestion() {
    var q = LESSON.questions[idx];
    selected = null; mode = "answer";
    lecFoot.classList.remove("ok", "ko");
    lecProg.style.width = (idx / total * 100) + "%";

    var head = '<p class="q-kind">' + kindLabel(q.kind) + "</p>";
    var body = q.filou
      ? '<div class="q-prompt"><img class="filou" src="' + FILOU + '" alt=""><div class="bubble">' + q.title + "</div></div>"
      : '<h3 class="q-title">' + q.title + "</h3>";
    var opts = '<div class="opts">' + q.opts.map(function (o, i) {
      var lead = o.lead ? '<span class="lead">' + o.lead + "</span>" : "";
      return '<button class="opt" data-i="' + i + '">' + lead + "<span>" + o.t + '</span><span class="key num">' + (i + 1) + "</span></button>";
    }).join("") + "</div>";
    lecBody.innerHTML = head + body + opts;

    $$(".opt", lecBody).forEach(function (btn) {
      btn.addEventListener("click", function () {
        if (mode !== "answer") return;
        $$(".opt", lecBody).forEach(function (b) { b.classList.remove("sel"); });
        btn.classList.add("sel");
        selected = parseInt(btn.dataset.i, 10);
        lecCheck.removeAttribute("disabled");
      });
    });
    lecCheck.textContent = "Vérifier";
    lecCheck.setAttribute("disabled", "");
  }

  lecCheck.addEventListener("click", function () {
    if (mode === "answer") {
      if (selected === null) return;
      var q = LESSON.questions[idx];
      var isOk = !!q.opts[selected].ok;
      $$(".opt", lecBody).forEach(function (b, i) {
        b.setAttribute("disabled", "");
        if (q.opts[i].ok) b.classList.add("good");
        if (i === selected && !q.opts[i].ok) b.classList.add("bad");
      });
      if (isOk) {
        correct++;
        lecFoot.classList.add("ok");
        verIc.querySelector("use").setAttribute("href", "#i-check");
        verTitle.textContent = "Bien vu !";
        verMsg.textContent = q.why || "";
      } else {
        lecFoot.classList.add("ko");
        verIc.querySelector("use").setAttribute("href", "#i-x");
        var bonne = q.opts.filter(function (o) { return o.ok; })[0];
        verTitle.textContent = "Presque !";
        verMsg.textContent = "La bonne réponse : " + (bonne ? bonne.t : "");
        loseHeart();
      }
      lecCheck.textContent = "Continuer";
      mode = "continue";
    } else {
      // Continuer
      if (!state.unlimited && state.coeurs <= 0) { awaitingHearts = true; openScrim("scrimCoeur"); return; }
      next();
    }
  });

  function next() {
    idx++;
    if (idx >= total) { finishLesson(); return; }
    renderQuestion();
    lecBody.scrollTop = 0;
  }

  function loseHeart() {
    if (state.unlimited) return;
    state.coeurs = Math.max(0, state.coeurs - 1);
    lecHearts.textContent = state.coeurs;
    updateTop(); popChip(cCoeur);
  }

  function finishLesson() {
    lecProg.style.width = "100%";
    var acc = Math.round(correct / total * 100);
    var parfait = correct === total;
    var xp = 20 + (parfait ? 5 : 0);
    var secs = Math.max(28, Math.round((Date.now() - t0) / 1000));
    var mm = Math.floor(secs / 60), ss = ("0" + (secs % 60)).slice(-2);

    $("#doneXp").textContent = "+" + xp;
    $("#doneAcc").textContent = acc + " %";
    $("#doneTime").textContent = mm + ":" + ss;
    $("#doneSub").textContent = parfait ? "Sans-faute, Filou est bluffé !" : "Filou est fier de toi.";

    lecBody.style.display = "none"; lecFoot.style.display = "none";
    lecDone.classList.add("on");

    // Récompenses en attente jusqu'au clic « Réclamer »
    pending = { xp: xp, parfait: parfait };
  }

  var pending = null;
  $("#doneClaim").addEventListener("click", function () {
    if (!pending) { closeLesson(); return; }
    var xp = pending.xp;
    state.xpJour += xp;
    state.xpTotal += xp;
    state.leconsFaites++;
    if (pending.parfait) state.sansFautes++;
    var serieUp = false;
    if (!state.serieFaiteAujourdhui) { state.serie++; state.serieFaiteAujourdhui = true; serieUp = true; }
    pending = null;

    progressNode();
    updateQuests();
    bumpLeague(xp);
    updateTop();
    popChip(cSerie);

    closeLesson();
    // Retour sur l'onglet Apprendre
    $$(".tab").forEach(function (t) { t.removeAttribute("aria-current"); });
    $(".tab.t-apprendre").setAttribute("aria-current", "page");
    $$(".view").forEach(function (v) { v.classList.toggle("on", v.dataset.vue === "apprendre"); });
    window.scrollTo(0, 0);
    confetti();
    showToast(serieUp ? "Série de " + state.serie + " jours ! +" + xp + " XP" : "Bien joué ! +" + xp + " XP");
  });

  /* ---------------- Cœurs à zéro ---------------- */
  function loseHeartResume() { awaitingHearts = false; next(); }

  /* ---------------- Défis ---------------- */
  function setQuest(sel, now, goal) {
    var q = $(sel); if (!q) return;
    var pct = Math.min(100, Math.round(now / goal * 100));
    $(".qbar > i", q).style.width = pct + "%";
    $(".qnow", q).textContent = Math.min(now, goal);
    var btn = $("[data-claim]", q);
    if (now >= goal && !btn.dataset.done) btn.removeAttribute("disabled");
  }
  function updateQuests() {
    setQuest('[data-quest="xp"]', state.xpJour, 30);
    setQuest('[data-quest="lecon"]', state.leconsFaites, 1);
    setQuest('[data-quest="parfait"]', state.sansFautes, 1);
  }
  $$("[data-claim]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      if (btn.hasAttribute("disabled") || btn.dataset.done) return;
      var g = parseInt(btn.dataset.claim, 10);
      state.gems += g; updateTop(); popChip(cGem);
      btn.dataset.done = "1"; btn.setAttribute("disabled", "");
      btn.innerHTML = '<svg class="ico"><use href="#i-check"/></svg> Fait';
      showToast("+" + g + " pépites récupérées !");
    });
  });

  /* ---------------- Ligue ---------------- */
  var ranksBox = $("#ranks");
  function renderRanks() {
    var sorted = RANKS.slice().sort(function (a, b) { return b.xp - a.xp; });
    var html = "";
    sorted.forEach(function (r, i) {
      if (i === 3) html += '<hr class="promo-line">';
      if (i === 7) html += '<hr class="demo-line">';
      var cls = "rank" + (r.you ? " you" : "") + (i === 0 ? " top1" : i === 1 ? " top2" : i === 2 ? " top3" : "");
      html += '<div class="' + cls + '"><span class="pos num">' + (i + 1) + '</span>' +
        '<span class="av" style="background:' + r.c + '">' + r.n.charAt(0) + '</span>' +
        '<span class="nm">' + r.n + '</span><span class="xp num">' + r.xp + "</span></div>";
    });
    ranksBox.innerHTML = html;
  }
  function bumpLeague(xp) {
    for (var i = 0; i < RANKS.length; i++) if (RANKS[i].you) { RANKS[i].xp += xp; break; }
    renderRanks();
  }

  /* ---------------- Boutique ---------------- */
  var buyHearts = $("#buyHearts");
  if (buyHearts) buyHearts.addEventListener("click", function () {
    if (state.unlimited || state.coeurs >= state.maxCoeurs) { showToast("Tes cœurs sont déjà pleins."); return; }
    if (state.gems < 40) { showToast("Pas assez de pépites."); return; }
    state.gems -= 40; state.coeurs = state.maxCoeurs; updateTop(); popChip(cCoeur);
    showToast("5 cœurs rechargés !");
  });
  $$("[data-buy]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var kind = btn.dataset.buy;
      if (kind === "pack") { showToast("Achat de pépites bientôt disponible."); return; }
      var cost = parseInt(btn.dataset.cost, 10);
      if (state.gems < cost) { showToast("Pas assez de pépites."); return; }
      state.gems -= cost; updateTop(); popChip(cGem);
      showToast(kind === "booster" ? "Booster XP activé pour 15 min !" : "Gel de série activé !");
    });
  });

  /* ---------------- Modales ---------------- */
  function openScrim(id) { var s = $("#" + id); if (s) { s.classList.add("on"); s.setAttribute("aria-hidden", "false"); } }
  function closeScrim(id) { var s = $("#" + id); if (s) { s.classList.remove("on"); s.setAttribute("aria-hidden", "true"); } }

  $$(".scrim").forEach(function (s) {
    s.addEventListener("click", function (e) { if (e.target === s) closeScrim(s.id); });
  });
  $$("[data-close]").forEach(function (b) {
    b.addEventListener("click", function () { closeScrim(b.dataset.close); });
  });
  ["openMax2", "openMax3"].forEach(function (id) {
    var b = $("#" + id); if (b) b.addEventListener("click", function () { openScrim("scrimMax"); });
  });
  var openMaxFromCoeur = $("#openMaxFromCoeur");
  if (openMaxFromCoeur) openMaxFromCoeur.addEventListener("click", function () { closeScrim("scrimCoeur"); openScrim("scrimMax"); });

  var refillGem = $("#refillGem");
  if (refillGem) refillGem.addEventListener("click", function () {
    if (state.gems < 40) { showToast("Pas assez de pépites."); return; }
    state.gems -= 40; state.coeurs = state.maxCoeurs; updateTop(); popChip(cCoeur);
    lecHearts.textContent = state.coeurs;
    closeScrim("scrimCoeur");
    showToast("5 cœurs rechargés !");
    if (awaitingHearts) loseHeartResume();
  });

  var subMax = $("#subMax");
  if (subMax) subMax.addEventListener("click", function () {
    state.unlimited = true; updateTop();
    lecHearts.textContent = "∞";
    closeScrim("scrimMax");
    showToast("Bienvenue dans Max ! Cœurs illimités.");
    if (awaitingHearts) loseHeartResume();
  });

  /* ---------------- Démarrage ---------------- */
  renderRanks();
  updateQuests();
  updateTop();
  requestAnimationFrame(positionMascot);
  if ("ResizeObserver" in window) { new ResizeObserver(positionMascot).observe(path1); }
})();
