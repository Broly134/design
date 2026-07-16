/* ============================================================
   BOUCAN · moteur du salon
   Lecture synchronisée (simulée), file votée, réactions, chat.
   Vanilla JS. Aucune écoute directe du scroll.
   ============================================================ */
(function () {
  "use strict";
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return [].slice.call((r || document).querySelectorAll(s)); };
  var CV = ["cvA", "cvB", "cvC", "cvD"].map(function (id) { var e = document.getElementById(id); return e ? e.src : ""; });

  /* --------- Participants --------- */
  var C = { Toi: "#FF5CA0", Sacha: "#FF2E88", Wassim: "#1FE0D4", "Léa": "#A98BFF", Nora: "#FFC24B", Malik: "#5AC8FA" };
  function av(name, cls) { var c = C[name] || "#7A8598"; return '<span class="' + (cls || "av") + '" style="background:' + c + '">' + name.charAt(0) + "</span>"; }

  /* --------- Musique --------- */
  var NOW = { title: "Midnight City", artist: "M83", by: "Sacha", cover: CV[0], dur: 244, cur: 38 };
  var QUEUE = [
    { id: "djadja", title: "Djadja", artist: "Aya Nakamura", by: "Wassim", cover: CV[1], dur: 172, votes: 14, voted: false },
    { id: "nightcall", title: "Nightcall", artist: "Kavinsky", by: "Léa", cover: CV[2], dur: 258, votes: 9, voted: false },
    { id: "blinding", title: "Blinding Lights", artist: "The Weeknd", by: "Nora", cover: CV[3], dur: 200, votes: 9, voted: false },
    { id: "kiffance", title: "La Kiffance", artist: "Naps", by: "Sacha", cover: CV[0], dur: 181, votes: 5, voted: false },
    { id: "instant", title: "Instant Crush", artist: "Daft Punk", by: "Nora", cover: CV[2], dur: 337, votes: 3, voted: false }
  ];
  var CATALOG = [
    { id: "nightcall2", title: "Redbone", artist: "Childish Gambino", cover: CV[3], dur: 327 },
    { id: "tout", title: "Tout Oublier", artist: "Angèle", cover: CV[1], dur: 195 },
    { id: "flash", title: "Flashing Lights", artist: "Kanye West", cover: CV[0], dur: 238 },
    { id: "asitwas", title: "As It Was", artist: "Harry Styles", cover: CV[2], dur: 167 },
    { id: "bella", title: "Bella", artist: "Maître Gims", cover: CV[1], dur: 231 },
    { id: "sunflower", title: "Sunflower", artist: "Post Malone", cover: CV[3], dur: 158 },
    { id: "reine", title: "Ta Reine", artist: "Angèle", cover: CV[0], dur: 218 },
    { id: "alright", title: "Alright", artist: "Kendrick Lamar", cover: CV[2], dur: 219 }
  ];

  function fmt(s) { s = Math.max(0, Math.round(s)); return Math.floor(s / 60) + ":" + ("0" + (s % 60)).slice(-2); }

  /* --------- Rendu now-playing --------- */
  var npCover = $("#npCover"), npProg = $("#npProg"), npCur = $("#npCur"), npDur = $("#npDur");
  function renderNow() {
    npCover.src = NOW.cover;
    $("#npTitle").textContent = NOW.title;
    $("#npArtist").textContent = NOW.artist;
    $("#npBy").textContent = NOW.by;
    var a = $("#npByAv"); a.textContent = NOW.by.charAt(0); a.style.background = C[NOW.by] || "#7A8598";
    npDur.textContent = fmt(NOW.dur);
    tick(true);
  }
  function tick(silent) {
    npProg.style.width = Math.min(100, NOW.cur / NOW.dur * 100) + "%";
    npCur.textContent = fmt(NOW.cur);
    if (!silent && NOW.cur >= NOW.dur) advance();
  }

  /* --------- File --------- */
  var queueBox = $("#queue");
  function sortQueue() { QUEUE.sort(function (a, b) { return b.votes - a.votes; }); }
  function renderQueue() {
    sortQueue();
    queueBox.innerHTML = QUEUE.map(function (t, i) {
      return '<div class="q-item' + (i === 0 ? " lead" : "") + '">' +
        '<img class="cv" src="' + t.cover + '" alt="">' +
        '<div class="qm"><b>' + t.title + '</b><span>' + t.artist + ' · <span class="by">' + t.by + '</span></span></div>' +
        '<button class="vote' + (t.voted ? " voted" : "") + '" data-id="' + t.id + '" aria-label="Voter">' +
        '<svg class="ico"><use href="#i-arrow-fat-up"/></svg><span class="n num">' + t.votes + '</span></button>' +
        '</div>';
    }).join("");
    $("#qCount").textContent = QUEUE.length;
    $$(".vote", queueBox).forEach(function (b) {
      b.addEventListener("click", function () {
        var t = QUEUE.filter(function (x) { return x.id === b.dataset.id; })[0];
        if (!t) return;
        t.voted = !t.voted; t.votes += t.voted ? 1 : -1;
        renderQueue();
        if (t.voted) toast("Vote pour « " + t.title + " »");
      });
    });
  }

  function advance() {
    sortQueue();
    if (!QUEUE.length) { NOW.cur = 0; tick(true); return; }
    var nx = QUEUE.shift();
    NOW = { title: nx.title, artist: nx.artist, by: nx.by, cover: nx.cover, dur: nx.dur, cur: 0 };
    renderNow(); renderQueue();
    toast("Au tour de « " + NOW.title + " »");
  }

  /* --------- Lecture --------- */
  var playing = true, timer = null;
  var viz = $("#viz");
  function loop() { if (playing) { NOW.cur += 1; tick(false); } }
  function setPlaying(p) {
    playing = p;
    $("#playBtn").querySelector("use").setAttribute("href", playing ? "#i-pause" : "#i-play");
    viz.classList.toggle("playing", playing);
  }
  $("#playBtn").addEventListener("click", function () { setPlaying(!playing); toast(playing ? "Lecture" : "En pause pour tout le monde"); });
  $("#nextBtn").addEventListener("click", advance);
  $("#prevBtn").addEventListener("click", function () { NOW.cur = 0; tick(true); toast("On reprend au début"); });

  /* --------- Réactions flottantes --------- */
  var floatLayer = $("#floatLayer");
  $$("#reacts button").forEach(function (b) {
    b.addEventListener("click", function () { fly(b.dataset.emoji); });
  });
  function fly(emoji) {
    var e = document.createElement("span");
    e.className = "fl"; e.textContent = emoji;
    e.style.left = (12 + Math.random() * 68) + "%";
    e.style.fontSize = (1.4 + Math.random() * 1.1) + "rem";
    floatLayer.appendChild(e);
    setTimeout(function () { e.remove(); }, 2200);
  }

  /* --------- Chat --------- */
  var chatList = $("#chatList");
  var MSGS = [
    { who: "Sacha", t: "salut la teamm 🎧" },
    { who: "Léa", t: "qui a mis M83 je vous aime" },
    { who: "Wassim", t: "djadja next c'est obligé 🔥" },
    { sys: "Nora a rejoint le salon" }
  ];
  var REPLIES = ["carrément", "grave 🔥", "je vote pour", "next c'est moi qui choisis", "montez le son 🔊", "ce salon est parfait", "😮😮", "ok là ça envoie", "team afterwork ❤️"];
  var WHOS = ["Sacha", "Wassim", "Léa", "Nora"];
  function pushMsg(m, scroll) {
    var el = document.createElement("div");
    if (m.sys) { el.className = "msg sys"; el.innerHTML = '<p>' + m.sys + '</p>'; }
    else {
      el.className = "msg" + (m.who === "Toi" ? " me" : "");
      el.innerHTML = av(m.who) + '<div class="bub"><b>' + m.who + '</b><p>' + esc(m.t) + '</p></div>';
    }
    chatList.appendChild(el);
    if (scroll !== false) chatList.scrollTop = chatList.scrollHeight;
  }
  function esc(s) { return s.replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  MSGS.forEach(function (m) { pushMsg(m, false); });

  $("#chatForm").addEventListener("submit", function (e) {
    e.preventDefault();
    var inp = $("#chatInput"); var v = inp.value.trim();
    if (!v) return;
    pushMsg({ who: "Toi", t: v });
    inp.value = "";
    setTimeout(function () {
      pushMsg({ who: WHOS[Math.floor(Math.random() * WHOS.length)], t: REPLIES[Math.floor(Math.random() * REPLIES.length)] });
    }, 900 + Math.random() * 900);
  });

  /* --------- Ajouter un morceau --------- */
  var picker = $("#picker");
  function renderPicker() {
    var have = {}; QUEUE.forEach(function (t) { have[t.id] = 1; });
    picker.innerHTML = CATALOG.filter(function (t) { return !have[t.id]; }).map(function (t) {
      return '<button class="pick" data-id="' + t.id + '"><img src="' + t.cover + '" alt=""><div><b>' + t.title + '</b><span>' + t.artist + '</span></div></button>';
    }).join("");
    $$(".pick", picker).forEach(function (b) {
      b.addEventListener("click", function () {
        var t = CATALOG.filter(function (x) { return x.id === b.dataset.id; })[0];
        QUEUE.push({ id: t.id, title: t.title, artist: t.artist, by: "Toi", cover: t.cover, dur: t.dur, votes: 1, voted: true });
        renderQueue(); closeScrim("addScrim"); renderPicker();
        toast("« " + t.title + " » ajouté à la file");
        seg("file");
        pushMsg({ sys: "Toi a ajouté « " + t.title + " »" }, false);
      });
    });
  }
  $("#addBtn").addEventListener("click", function () { renderPicker(); openScrim("addScrim"); });

  /* --------- Onglets --------- */
  function seg(name) {
    $$(".tabbar button").forEach(function (b) { b.setAttribute("aria-current", b.dataset.seg === name ? "page" : "false"); });
    $$(".view").forEach(function (v) { v.classList.toggle("on", v.dataset.view === name); });
  }
  $$(".tabbar button").forEach(function (b) { b.addEventListener("click", function () { seg(b.dataset.seg); }); });

  /* --------- Listeners --------- */
  function renderListeners() {
    $("#listeners").innerHTML = ["Sacha", "Wassim", "Léa", "Nora"].map(function (n) { return av(n); }).join("");
  }

  /* --------- Partage / quitter / modales --------- */
  var toastEl = $("#toast"), toastMsg = $("#toastMsg"), toastT;
  function toast(m) { toastMsg.textContent = m; toastEl.classList.add("show"); clearTimeout(toastT); toastT = setTimeout(function () { toastEl.classList.remove("show"); }, 2200); }
  function openScrim(id) { var s = $("#" + id); s.classList.add("on"); s.setAttribute("aria-hidden", "false"); }
  function closeScrim(id) { var s = $("#" + id); s.classList.remove("on"); s.setAttribute("aria-hidden", "true"); }
  $$(".scrim").forEach(function (s) { s.addEventListener("click", function (e) { if (e.target === s) closeScrim(s.id); }); });
  $$("[data-close]").forEach(function (b) { b.addEventListener("click", function () { closeScrim(b.dataset.close); }); });
  $("#shareBtn").addEventListener("click", function () { toast("Lien du salon copié"); });
  $("#leaveBtn").addEventListener("click", function () { openScrim("leaveScrim"); });

  /* --------- Démarrage --------- */
  var vizHtml = ""; for (var i = 0; i < 13; i++) vizHtml += "<i></i>"; viz.innerHTML = vizHtml;
  renderListeners(); renderNow(); renderQueue(); setPlaying(true);
  timer = setInterval(loop, 1000);

  /* un ami rejoint, pour la vie du salon */
  setTimeout(function () {
    C.Malik = "#5AC8FA";
    pushMsg({ sys: "Malik a rejoint le salon" }, false);
    $("#listenCount").textContent = "8";
    $("#listeners").insertAdjacentHTML("beforeend", av("Malik"));
  }, 9000);
})();
