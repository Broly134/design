/* ============================================================
   PÉPITE · interactions de la landing
   Aucune écoute directe du scroll : IntersectionObserver only.
   ============================================================ */
(function () {
  "use strict";
  var root = document.documentElement;

  /* ---------- Thème ---------- */
  var themeBtn = document.getElementById("themeBtn");
  function currentTheme() {
    return root.getAttribute("data-theme") ||
      (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
  }
  if (themeBtn) {
    themeBtn.addEventListener("click", function () {
      var next = currentTheme() === "dark" ? "light" : "dark";
      root.setAttribute("data-theme", next);
      try { localStorage.setItem("pepite-theme", next); } catch (e) {}
    });
  }

  /* ---------- En-tête collée (sentinelle, pas de scroll listener) ---------- */
  var head = document.getElementById("siteHead");
  var sentinel = document.createElement("span");
  sentinel.setAttribute("aria-hidden", "true");
  sentinel.style.cssText = "position:absolute;top:0;left:0;width:1px;height:1px;pointer-events:none";
  document.body.insertBefore(sentinel, document.body.firstChild);
  if ("IntersectionObserver" in window && head) {
    new IntersectionObserver(function (entries) {
      head.classList.toggle("is-stuck", !entries[0].isIntersecting);
    }, { rootMargin: "-8px 0px 0px 0px" }).observe(sentinel);
  }

  /* ---------- Révélations ---------- */
  var reveals = [].slice.call(document.querySelectorAll("[data-reveal]"));
  if ("IntersectionObserver" in window && reveals.length) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { en.target.classList.add("revealed"); io.unobserve(en.target); }
      });
    }, { rootMargin: "0px 0px -8% 0px", threshold: 0.08 });
    reveals.forEach(function (el, i) {
      el.style.transitionDelay = (Math.min(i % 4, 3) * 60) + "ms";
      io.observe(el);
    });
  } else {
    reveals.forEach(function (el) { el.classList.add("revealed"); });
  }

  /* ---------- Bandeau défilant : duplique pour boucler ---------- */
  var ticker = document.getElementById("ticker");
  if (ticker && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    ticker.innerHTML += ticker.innerHTML;
  }

  /* ---------- Bascule tarifs mensuel / annuel ---------- */
  var btM = document.getElementById("btMensuel");
  var btA = document.getElementById("btAnnuel");
  var prix = document.getElementById("prix");
  var peryear = document.getElementById("peryear");
  function setPeriode(annuel) {
    if (btM) btM.setAttribute("aria-pressed", String(!annuel));
    if (btA) btA.setAttribute("aria-pressed", String(annuel));
    if (prix) prix.textContent = annuel ? "3,99" : "6,99";
    if (peryear) peryear.textContent = annuel ? "soit 47,88 € par an" : "sans engagement";
  }
  if (btM) btM.addEventListener("click", function () { setPeriode(false); });
  if (btA) btA.addEventListener("click", function () { setPeriode(true); });
})();
