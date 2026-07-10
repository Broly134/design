/* Affluent · interactions
   Aucune écoute directe du scroll : IntersectionObserver + ResizeObserver. */
(function () {
  "use strict";

  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  var root = document.documentElement;

  /* ---------- Thème ---------- */

  var themeMeta = document.querySelector('meta[name="theme-color"]');

  function applyThemeColor() {
    if (themeMeta) {
      themeMeta.setAttribute(
        "content",
        root.getAttribute("data-theme") === "dark" ? "#0B100D" : "#F5F7F4"
      );
    }
  }
  applyThemeColor();

  var themeToggle = document.getElementById("theme-toggle");
  if (themeToggle) {
    themeToggle.addEventListener("click", function () {
      var next = root.getAttribute("data-theme") === "dark" ? "light" : "dark";
      root.setAttribute("data-theme", next);
      try { localStorage.setItem("affluent-theme", next); } catch (e) {}
      applyThemeColor();
      document.dispatchEvent(new CustomEvent("themechange"));
    });
  }

  /* ---------- Header : état "scrolled" via sentinelle ---------- */

  var header = document.getElementById("site-header");
  if (header && "IntersectionObserver" in window) {
    var sentinel = document.createElement("div");
    sentinel.setAttribute("aria-hidden", "true");
    sentinel.style.cssText = "position:absolute;top:0;left:0;width:1px;height:8px;pointer-events:none;";
    document.body.prepend(sentinel);
    new IntersectionObserver(function (entries) {
      header.classList.toggle("scrolled", !entries[0].isIntersecting);
    }).observe(sentinel);
  }

  /* ---------- Menu mobile ---------- */

  var menuToggle = document.getElementById("menu-toggle");
  if (menuToggle) {
    menuToggle.addEventListener("click", function () {
      var open = document.body.classList.toggle("menu-open");
      menuToggle.setAttribute("aria-expanded", String(open));
      menuToggle.setAttribute("aria-label", open ? "Fermer le menu" : "Ouvrir le menu");
    });
    document.querySelectorAll("#mobile-menu a").forEach(function (a) {
      a.addEventListener("click", function () {
        document.body.classList.remove("menu-open");
        menuToggle.setAttribute("aria-expanded", "false");
      });
    });
  }

  /* ---------- Révélation au scroll ---------- */

  var revealEls = document.querySelectorAll("[data-reveal]");
  if ("IntersectionObserver" in window && !reduceMotion.matches) {
    var revealObs = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add("revealed");
            revealObs.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.15, rootMargin: "0px 0px -8% 0px" }
    );
    revealEls.forEach(function (el) { revealObs.observe(el); });
  } else {
    revealEls.forEach(function (el) { el.classList.add("revealed"); });
  }

  /* ---------- Compteurs animés ---------- */

  function formatNumber(value, decimals) {
    return value.toLocaleString("fr-FR", {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals
    });
  }

  var euroFmt = new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0
  });

  function animateCount(el) {
    var target = parseFloat(el.getAttribute("data-count-to"));
    var decimals = parseInt(el.getAttribute("data-decimals") || "0", 10);
    var isEuro = el.id === "hero-value";
    if (reduceMotion.matches) return; // le HTML contient déjà la valeur finale
    var t0 = null;
    var dur = 1100;
    function frame(t) {
      if (!t0) t0 = t;
      var p = Math.min((t - t0) / dur, 1);
      var eased = 1 - Math.pow(1 - p, 3);
      var v = target * eased;
      el.textContent = isEuro ? euroFmt.format(Math.round(v)) : formatNumber(v, decimals);
      if (p < 1) requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }

  var countEls = document.querySelectorAll("[data-count-to]");
  if ("IntersectionObserver" in window && !reduceMotion.matches) {
    var countObs = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            animateCount(entry.target);
            countObs.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.6 }
    );
    countEls.forEach(function (el) { countObs.observe(el); });
  }

  /* ---------- Marquee : duplication pour boucle continue ---------- */

  var marqueeTrack = document.getElementById("marquee-track");
  if (marqueeTrack) {
    var clone = marqueeTrack.cloneNode(true);
    clone.setAttribute("aria-hidden", "true");
    while (clone.firstChild) marqueeTrack.appendChild(clone.firstChild);
  }

  /* ---------- Graphiques SVG ---------- */

  var SVG_NS = "http://www.w3.org/2000/svg";

  function cssVar(name) {
    return getComputedStyle(root).getPropertyValue(name).trim();
  }

  function el(name, attrs) {
    var node = document.createElementNS(SVG_NS, name);
    for (var k in attrs) node.setAttribute(k, attrs[k]);
    return node;
  }

  /**
   * Graphique de flux : série réalisée (aplat + trait plein),
   * projection optionnelle (trait pointillé) et bande d'incertitude.
   * Survol : réticule + infobulle (formule dataviz).
   */
  function flowChart(rootId, opts) {
    var wrap = document.getElementById(rootId);
    if (!wrap) return null;
    var canvas = wrap.querySelector(".chart-canvas");
    var uid = rootId.replace(/[^a-z]/gi, "");
    var height = opts.height;
    var hist = opts.hist.slice();
    var proj = opts.proj ? opts.proj.slice() : null;
    var band = opts.band || null;
    var labels = opts.labels;

    var hair = document.createElement("div");
    hair.className = "chart-hair";
    var dot = document.createElement("div");
    dot.className = "chart-dot";
    var tip = document.createElement("div");
    tip.className = "chart-tip";
    canvas.appendChild(hair);
    canvas.appendChild(dot);
    canvas.appendChild(tip);

    var svg = null;
    var geom = null;
    var parts = {};
    var drawn = reduceMotion.matches; // sans animation, tout est visible d'emblée

    function allValues() {
      var v = hist.slice();
      if (proj) v = v.concat(proj);
      if (band) v = v.concat(band.low, band.high);
      return v;
    }

    function domain() {
      var v = opts.domain || allValues();
      var min = Math.min.apply(null, v);
      var max = Math.max.apply(null, v);
      var pad = (max - min) * 0.12 || 1;
      return [min - pad, max + pad];
    }

    function build() {
      if (svg) svg.remove();
      var w = canvas.clientWidth;
      if (w < 40) return;
      var h = height;
      var padX = 4;
      var padY = 10;
      var d = domain();
      var total = (proj ? hist.length + proj.length : hist.length) - 1;

      function x(i) { return padX + (i * (w - padX * 2)) / total; }
      function y(v) {
        return padY + (1 - (v - d[0]) / (d[1] - d[0])) * (h - padY * 2);
      }

      geom = { x: x, y: y, w: w, h: h };
      svg = el("svg", { width: w, height: h, viewBox: "0 0 " + w + " " + h });

      var chartColor = cssVar("--chart") || "#0F8A62";

      // Dégradé de l'aplat
      var defs = el("defs", {});
      var grad = el("linearGradient", { id: "grad-" + uid, x1: 0, y1: 0, x2: 0, y2: 1 });
      var s1 = el("stop", { offset: "0", "stop-color": chartColor, "stop-opacity": "0.22" });
      var s2 = el("stop", { offset: "1", "stop-color": chartColor, "stop-opacity": "0" });
      grad.appendChild(s1); grad.appendChild(s2);
      defs.appendChild(grad);
      svg.appendChild(defs);

      // Lignes de grille discrètes
      var lineColor = cssVar("--line-strong") || "rgba(0,0,0,.15)";
      for (var g = 1; g <= 3; g++) {
        var gy = padY + ((h - padY * 2) * g) / 4;
        svg.appendChild(el("line", {
          x1: padX, x2: w - padX, y1: gy, y2: gy,
          stroke: lineColor, "stroke-width": 1, "stroke-dasharray": "1 5",
          "stroke-linecap": "round"
        }));
      }

      // Bande d'incertitude (sur la zone projetée)
      if (band && proj) {
        var start = hist.length - 1;
        var pts = [];
        var i;
        pts.push(x(start) + "," + y(hist[start]));
        for (i = 0; i < band.high.length; i++) pts.push(x(start + 1 + i) + "," + y(band.high[i]));
        for (i = band.low.length - 1; i >= 0; i--) pts.push(x(start + 1 + i) + "," + y(band.low[i]));
        parts.band = el("polygon", {
          points: pts.join(" "),
          fill: chartColor,
          "fill-opacity": "0.10"
        });
        svg.appendChild(parts.band);
      }

      // Aplat sous la série réalisée
      var areaD = "M" + x(0) + "," + y(hist[0]);
      for (var a = 1; a < hist.length; a++) areaD += " L" + x(a) + "," + y(hist[a]);
      areaD += " L" + x(hist.length - 1) + "," + (h - padY) + " L" + x(0) + "," + (h - padY) + " Z";
      parts.area = el("path", { d: areaD, fill: "url(#grad-" + uid + ")" });
      svg.appendChild(parts.area);

      // Trait réalisé
      var lineD = "M" + x(0) + "," + y(hist[0]);
      for (var l = 1; l < hist.length; l++) lineD += " L" + x(l) + "," + y(hist[l]);
      parts.line = el("path", {
        d: lineD, fill: "none", stroke: chartColor,
        "stroke-width": 2, "stroke-linejoin": "round", "stroke-linecap": "round"
      });
      svg.appendChild(parts.line);

      // Trait projeté (pointillé)
      if (proj) {
        var start2 = hist.length - 1;
        var projD = "M" + x(start2) + "," + y(hist[start2]);
        for (var p = 0; p < proj.length; p++) projD += " L" + x(start2 + 1 + p) + "," + y(proj[p]);
        parts.proj = el("path", {
          d: projD, fill: "none", stroke: chartColor,
          "stroke-width": 2, "stroke-dasharray": "5 6",
          "stroke-linejoin": "round", "stroke-linecap": "round"
        });
        svg.appendChild(parts.proj);
      }

      // Point terminal
      var lastIdx = proj ? total : hist.length - 1;
      var lastVal = proj ? proj[proj.length - 1] : hist[hist.length - 1];
      parts.dot = el("circle", {
        cx: x(lastIdx), cy: y(lastVal), r: 4,
        fill: chartColor, stroke: cssVar("--card") || "#fff", "stroke-width": 2
      });
      svg.appendChild(parts.dot);

      // Avant la première apparition : tout est masqué, prêt à se tracer
      if (!drawn) {
        parts.line.setAttribute("pathLength", "1");
        parts.line.style.strokeDasharray = "1";
        parts.line.style.strokeDashoffset = "1";
        ["area", "band", "proj", "dot"].forEach(function (k) {
          if (parts[k]) parts[k].style.opacity = "0";
        });
      }

      canvas.insertBefore(svg, hair);
    }

    function values() {
      return proj ? hist.concat(proj) : hist;
    }

    function onMove(evt) {
      if (!geom) return;
      var rect = canvas.getBoundingClientRect();
      var mx = evt.clientX - rect.left;
      var vals = values();
      var total = vals.length - 1;
      var idx = Math.round(((mx - 4) / (geom.w - 8)) * total);
      idx = Math.max(0, Math.min(total, idx));
      var px = geom.x(idx);
      var py = geom.y(vals[idx]);
      hair.style.left = px + "px";
      hair.style.opacity = "1";
      dot.style.left = px + "px";
      dot.style.top = py + "px";
      dot.style.opacity = "1";
      tip.textContent = labels[idx] + " : " + euroFmt.format(vals[idx]);
      tip.style.left = Math.max(52, Math.min(geom.w - 52, px)) + "px";
      tip.style.top = py + "px";
      tip.style.opacity = "1";
    }

    function onLeave() {
      hair.style.opacity = "0";
      dot.style.opacity = "0";
      tip.style.opacity = "0";
    }

    canvas.addEventListener("pointermove", onMove);
    canvas.addEventListener("pointerleave", onLeave);

    if ("ResizeObserver" in window) {
      new ResizeObserver(function () { build(); }).observe(canvas);
    }
    build();
    document.addEventListener("themechange", build);

    return {
      draw: function () {
        if (drawn) return;
        drawn = true;
        if (reduceMotion.matches || !parts.line) { build(); return; }
        requestAnimationFrame(function () {
          parts.line.style.transition = "stroke-dashoffset 1.25s cubic-bezier(0.16, 1, 0.3, 1)";
          parts.line.style.strokeDashoffset = "0";
          [["area", 0.45], ["band", 0.7], ["proj", 0.85], ["dot", 1.05]].forEach(function (pair) {
            var n = parts[pair[0]];
            if (!n) return;
            n.style.transition = "opacity 0.7s ease " + pair[1] + "s";
            n.style.opacity = "1";
          });
        });
      },
      setProjection: function (next) {
        if (!proj) return;
        if (reduceMotion.matches) {
          proj = next.slice();
          build();
          return;
        }
        var from = proj.slice();
        var t0 = null;
        var dur = 340;
        function frame(t) {
          if (!t0) t0 = t;
          var p = Math.min((t - t0) / dur, 1);
          var eased = 1 - Math.pow(1 - p, 3);
          proj = from.map(function (v, i) { return v + (next[i] - v) * eased; });
          build();
          if (p < 1) requestAnimationFrame(frame);
          else { proj = next.slice(); build(); }
        }
        requestAnimationFrame(frame);
      }
    };
  }

  /* Données de démonstration (fictives) */

  var heroChart = flowChart("chart-hero", {
    height: 150,
    hist: [131250, 122480, 149300, 141750, 163900, 184320],
    labels: ["Février", "Mars", "Avril", "Mai", "Juin", "Juillet"]
  });

  var SCENARIOS = {
    prudent:   [148700, 24300, 58900],
    neutre:    [176800, 168300, 191400],
    optimiste: [189500, 197200, 218600]
  };

  var projChart = flowChart("chart-proj", {
    height: 260,
    hist: [122480, 149300, 141750, 163900, 184320],
    proj: SCENARIOS.neutre.slice(),
    band: { low: SCENARIOS.prudent, high: SCENARIOS.optimiste },
    domain: [24300, 218600],
    labels: ["Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre"]
  });

  /* Tracé des courbes à leur apparition */
  if ("IntersectionObserver" in window) {
    var chartObs = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          if (entry.target.id === "chart-hero" && heroChart) heroChart.draw();
          if (entry.target.id === "chart-proj" && projChart) projChart.draw();
          chartObs.unobserve(entry.target);
        });
      },
      { threshold: 0.35 }
    );
    ["chart-hero", "chart-proj"].forEach(function (id) {
      var node = document.getElementById(id);
      if (node) chartObs.observe(node);
    });
  } else {
    if (heroChart) heroChart.draw();
    if (projChart) projChart.draw();
  }

  /* ---------- Scénarios ---------- */

  var projValue = document.getElementById("proj-value");
  var projAlert = document.getElementById("proj-alert");
  var scenarioBtns = document.querySelectorAll(".scenario");

  scenarioBtns.forEach(function (btn) {
    btn.addEventListener("click", function () {
      scenarioBtns.forEach(function (b) {
        b.setAttribute("aria-pressed", String(b === btn));
      });
      var name = btn.getAttribute("data-scenario");
      var data = SCENARIOS[name];
      if (projChart) projChart.setProjection(data);
      if (projValue) projValue.textContent = euroFmt.format(data[data.length - 1]);
      if (projAlert) projAlert.classList.toggle("visible", name === "prudent");
    });
  });

  /* ---------- Onglets produit ---------- */

  var tabs = Array.prototype.slice.call(document.querySelectorAll(".tab"));
  var barsGrown = false;

  function growBars() {
    if (barsGrown) return;
    barsGrown = true;
    requestAnimationFrame(function () {
      document.querySelectorAll("#tva-bars .bar").forEach(function (bar) {
        bar.style.height = bar.getAttribute("data-h") + "%";
      });
    });
  }

  function selectTab(tab) {
    tabs.forEach(function (t) {
      var active = t === tab;
      t.setAttribute("aria-selected", String(active));
      t.tabIndex = active ? 0 : -1;
      var panel = document.getElementById(t.getAttribute("aria-controls"));
      if (panel) {
        panel.classList.toggle("active", active);
        if (active) panel.removeAttribute("hidden");
        else panel.setAttribute("hidden", "");
      }
    });
    if (tab.getAttribute("aria-controls") === "panel-tva") growBars();
  }

  tabs.forEach(function (tab, i) {
    tab.addEventListener("click", function () { selectTab(tab); });
    tab.addEventListener("keydown", function (e) {
      var dir = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
      if (!dir) return;
      e.preventDefault();
      var next = tabs[(i + dir + tabs.length) % tabs.length];
      next.focus();
      selectTab(next);
    });
  });

  // Si l'utilisateur préfère un rendu sans animation, les barres sont posées d'emblée
  if (reduceMotion.matches) growBars();

  /* ---------- Interrupteur provision ---------- */

  var provisionSwitch = document.getElementById("provision-switch");
  if (provisionSwitch) {
    provisionSwitch.addEventListener("click", function () {
      var on = provisionSwitch.getAttribute("aria-checked") === "true";
      provisionSwitch.setAttribute("aria-checked", String(!on));
    });
  }

  /* ---------- Facturation mensuelle / annuelle ---------- */

  var billMonthly = document.getElementById("bill-monthly");
  var billYearly = document.getElementById("bill-yearly");

  function setBilling(yearly) {
    if (billMonthly) billMonthly.setAttribute("aria-pressed", String(!yearly));
    if (billYearly) billYearly.setAttribute("aria-pressed", String(yearly));
    document.querySelectorAll(".plan-amount").forEach(function (elm) {
      elm.textContent = elm.getAttribute(yearly ? "data-yearly" : "data-monthly");
    });
    document.querySelectorAll(".plan-note").forEach(function (elm) {
      elm.textContent = elm.getAttribute(yearly ? "data-note-yearly" : "data-note-monthly");
    });
  }

  if (billMonthly && billYearly) {
    billMonthly.addEventListener("click", function () { setBilling(false); });
    billYearly.addEventListener("click", function () { setBilling(true); });
  }

  /* ---------- CTA magnétique (pointeur précis uniquement) ---------- */

  if (window.matchMedia("(pointer: fine)").matches && !reduceMotion.matches) {
    document.querySelectorAll(".magnetic").forEach(function (btn) {
      btn.addEventListener("pointermove", function (e) {
        var r = btn.getBoundingClientRect();
        var dx = (e.clientX - (r.left + r.width / 2)) * 0.16;
        var dy = (e.clientY - (r.top + r.height / 2)) * 0.22;
        btn.style.translate =
          Math.max(-6, Math.min(6, dx)) + "px " + Math.max(-5, Math.min(5, dy)) + "px";
      });
      btn.addEventListener("pointerleave", function () {
        btn.style.translate = "0px 0px";
      });
    });
  }

  /* ---------- Pile d'alertes vivante (bento) ---------- */

  var alertStack = document.querySelector(".alert-stack");
  if (alertStack && !reduceMotion.matches && "IntersectionObserver" in window) {
    var alertTimer = null;
    function cycleAlerts() {
      var first = alertStack.children[0];
      if (!first) return;
      first.classList.add("leaving");
      setTimeout(function () {
        alertStack.appendChild(first);
        first.classList.remove("leaving");
      }, 380);
    }
    new IntersectionObserver(function (entries) {
      if (entries[0].isIntersecting) {
        if (!alertTimer) alertTimer = setInterval(cycleAlerts, 3800);
      } else {
        clearInterval(alertTimer);
        alertTimer = null;
      }
    }, { threshold: 0.4 }).observe(alertStack);
  }

  /* ---------- Newsletter ---------- */

  var newsletter = document.getElementById("newsletter");
  if (newsletter) {
    var nlInput = document.getElementById("nl-email");
    var nlMsg = document.getElementById("nl-msg");
    newsletter.addEventListener("submit", function (e) {
      e.preventDefault();
      var value = (nlInput.value || "").trim();
      var valid = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value);
      if (!valid) {
        nlMsg.textContent = "Cette adresse semble incomplète.";
        nlMsg.className = "newsletter-msg err";
        nlInput.focus();
        return;
      }
      nlMsg.textContent = "Bien reçu. Première lettre le mois prochain.";
      nlMsg.className = "newsletter-msg ok";
      nlInput.value = "";
    });
  }
})();
