/* ============================================================
   BOUCAN · interactions de la landing
   IntersectionObserver only, aucune écoute directe du scroll.
   ============================================================ */
(function () {
  "use strict";

  /* En-tête collée */
  var head = document.getElementById("head");
  var sentinel = document.createElement("span");
  sentinel.setAttribute("aria-hidden", "true");
  sentinel.style.cssText = "position:absolute;top:0;left:0;width:1px;height:1px;pointer-events:none";
  document.body.insertBefore(sentinel, document.body.firstChild);
  if ("IntersectionObserver" in window && head) {
    new IntersectionObserver(function (e) {
      head.classList.toggle("stuck", !e[0].isIntersecting);
    }, { rootMargin: "-8px 0px 0px 0px" }).observe(sentinel);
  }

  /* Révélations */
  var reveals = [].slice.call(document.querySelectorAll("[data-reveal]"));
  if ("IntersectionObserver" in window && reveals.length) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { en.target.classList.add("in"); io.unobserve(en.target); }
      });
    }, { rootMargin: "0px 0px -8% 0px", threshold: 0.06 });
    reveals.forEach(function (el, i) {
      el.style.transitionDelay = (Math.min(i % 4, 3) * 70) + "ms";
      io.observe(el);
    });
  } else {
    reveals.forEach(function (el) { el.classList.add("in"); });
  }

  /* Bascule tarifs */
  var btM = document.getElementById("btM"), btA = document.getElementById("btA");
  var price = document.getElementById("price"), peryear = document.getElementById("peryear");
  function set(annuel) {
    if (btM) btM.setAttribute("aria-pressed", String(!annuel));
    if (btA) btA.setAttribute("aria-pressed", String(annuel));
    if (price) price.textContent = annuel ? "3,49" : "4,99";
    if (peryear) peryear.textContent = annuel ? "soit 41,88 € par an" : "sans engagement";
  }
  if (btM) btM.addEventListener("click", function () { set(false); });
  if (btA) btA.addEventListener("click", function () { set(true); });
})();
