/* The shade: colour memory inside the house palette.
   A ledger tone shows for two seconds, then it is mixed back from
   memory on three sliders. Scored on a weighted HSL distance, hue
   wrap handled. The exposure never changes; the wait in the dark
   before the sliders arrive grows by a second each round.
   Contract: the shell comment block in /calibration/index.html. */
(function () {
"use strict";
if (!window.CAL) { return; }

var HOLD_MS = 2000;             /* every round: two seconds of looking */
var GAP_MS = 1000;              /* extra dark per round beyond the first */
var WH = 3, WS = 1.5, WL = 2.1; /* channel weights for the distance, tuned
                                   so an untouched neutral submit stands at
                                   or near nought while a careful mix still
                                   reads eight or better */

function css(c) { return "hsl(" + c.h + "," + c.s + "%," + c.l + "%)"; }

function chip(c) {
  return '<span style="display:inline-block;width:1.05em;height:1.05em;' +
    'border:1px solid var(--line);border-radius:3px;vertical-align:-.18em;' +
    'background:' + css(c) + '"></span>';
}

function hueGap(a, b) {
  var dh = Math.abs(a - b);
  return Math.min(dh, 360 - dh);
}

function distance(a, b) {
  var dh = hueGap(a.h, b.h) * WH;
  var ds = Math.abs(a.s - b.s) * WS;
  var dl = Math.abs(a.l - b.l) * WL;
  return Math.sqrt(dh * dh + ds * ds + dl * dl);
}

function scoreOf(d) {
  if (d < 4) { return 10; }
  if (d >= 40) { return 0; }
  return 10 * (40 - d) / 36;
}

function pane(c, cap) {
  return '<div>' +
    '<div class="cal-swatch" style="background:' + css(c) + '"></div>' +
    '<p class="cal-note">' + cap + '</p>' +
    '<p class="cal-note" style="margin:.15rem 0 0;">' +
      c.h + '&deg; &middot; ' + c.s + '% &middot; ' + c.l + '%</p>' +
    '</div>';
}

window.CAL.register({
  id: "shade",
  name: "The shade",
  blurb: "A colour witnessed, then mixed again by eye.",
  build: function (stageEl, api) {

    /* always a brass, parchment or umber family tone, never neon */
    function draw() {
      return {
        h: Math.round(30 + api.rng() * 20),
        s: Math.round(20 + api.rng() * 40),
        l: Math.round(25 + api.rng() * 50)
      };
    }

    function head(r, part) {
      return '<p class="rlab">Round ' + r + ' of 5 &middot; ' + part + '</p>';
    }

    function sliderRow(tag, min, max, start, unit, aria) {
      var row = document.createElement("div");
      row.style.display = "flex";
      row.style.alignItems = "center";
      row.style.gap = ".7rem";
      row.style.margin = ".45rem 0";
      var lab = document.createElement("span");
      lab.className = "rlab";
      lab.style.margin = "0";
      lab.style.flex = "none";
      lab.style.width = "14ch";
      lab.textContent = tag;
      var inp = document.createElement("input");
      inp.type = "range";
      inp.min = String(min);
      inp.max = String(max);
      inp.step = "1";
      inp.value = String(start);
      inp.style.flex = "1";
      inp.style.minWidth = "0";
      inp.style.accentColor = "var(--brass)";
      inp.setAttribute("aria-label", aria);
      var out = document.createElement("span");
      out.className = "cal-note";
      out.style.margin = "0";
      out.style.flex = "none";
      out.style.width = "4ch";
      out.style.textAlign = "right";
      row.appendChild(lab);
      row.appendChild(inp);
      row.appendChild(out);
      return { row: row, inp: inp, out: out, unit: unit, aria: aria };
    }

    function witness(r, target) {
      api.setPrompt(
        head(r, "the record") +
        '<p class="rinst">Two seconds. Look properly.</p>' +
        '<div class="cal-swatch" style="background:' + css(target) + ';"></div>'
      );
      api.setControls(null);
      window.setTimeout(function () {
        var gap = (r - 1) * GAP_MS;
        if (gap <= 0) { mix(r, target); return; }
        api.setPrompt(
          head(r, "the dark") +
          '<p class="rinst">Gone. Hold it in mind.</p>' +
          '<div class="cal-swatch" style="background:none;border-style:dashed;"></div>'
        );
        window.setTimeout(function () { mix(r, target); }, gap);
      }, HOLD_MS);
    }

    function mix(r, target) {
      api.setPrompt(
        head(r, "the mix") +
        '<p class="rinst">Mix it back. The swatch is your entry; the sliders are the only tools.</p>'
      );

      var wrap = document.createElement("div");
      wrap.style.width = "100%";
      var top = document.createElement("div");
      top.style.display = "flex";
      top.style.gap = "1.1rem";
      top.style.flexWrap = "wrap";
      top.style.alignItems = "flex-start";

      var pv = document.createElement("div");
      var sw = document.createElement("div");
      sw.className = "cal-swatch";
      var cap = document.createElement("p");
      cap.className = "cal-note";
      cap.textContent = "your mix";
      pv.appendChild(sw);
      pv.appendChild(cap);

      var cols = document.createElement("div");
      cols.style.flex = "1";
      cols.style.minWidth = "14rem";
      /* neutral starts: the midpoint of each ledger range */
      var rows = [
        sliderRow("HUE", 30, 50, 40, "°", "hue"),
        sliderRow("SATURATION", 20, 60, 40, "%", "saturation"),
        sliderRow("LIGHT", 25, 75, 50, "%", "light")
      ];
      var i;
      for (i = 0; i < 3; i++) { cols.appendChild(rows[i].row); }
      top.appendChild(pv);
      top.appendChild(cols);

      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "btn primary";
      btn.textContent = "Submit the mix";
      btn.style.marginTop = ".9rem";
      wrap.appendChild(top);
      wrap.appendChild(btn);

      function current() {
        return { h: +rows[0].inp.value, s: +rows[1].inp.value, l: +rows[2].inp.value };
      }
      function paint() {
        var c = current(), v = [c.h, c.s, c.l], k;
        sw.style.background = css(c);
        for (k = 0; k < 3; k++) {
          rows[k].out.textContent = v[k] + rows[k].unit;
          rows[k].inp.setAttribute("aria-valuetext",
            v[k] + (rows[k].unit === "%" ? " per cent" : " degrees"));
        }
      }
      for (i = 0; i < 3; i++) { rows[i].inp.addEventListener("input", paint); }
      paint();

      btn.addEventListener("click", function () {
        if (btn.disabled) { return; }
        btn.disabled = true;
        settle(r, target, current());
      });

      api.setControls(wrap);
      rows[0].inp.focus();
    }

    function settle(r, target, yours) {
      var dh = hueGap(yours.h, target.h);
      var ds = Math.abs(yours.s - target.s);
      var dl = Math.abs(yours.l - target.l);
      api.submitRound(scoreOf(distance(yours, target)),
        chip(yours) + " yours &middot; " + chip(target) + " the record");
      api.setPrompt(
        head(r, "logged") +
        '<div style="display:flex;gap:1.2rem;flex-wrap:wrap;align-items:flex-start;">' +
          pane(yours, "yours") + pane(target, "the record") +
        '</div>' +
        '<p class="cal-note">off by ' + dh + ' in hue, ' + ds +
          ' in saturation, ' + dl + ' in light</p>'
      );
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "btn primary";
      btn.textContent = r >= 5 ? "The reading" : "Next round";
      btn.addEventListener("click", function () {
        if (btn.disabled) { return; }
        btn.disabled = true;
        if (r >= 5) { api.done(); } else { start(); }
      });
      api.setControls(btn);
      btn.focus();
    }

    function start() {
      witness(api.round, draw());
    }

    /* the brief; the first exposure waits for the reader's own click */
    api.setPrompt(
      '<p class="rinst">A colour from the ledger, shown for two seconds, then withdrawn. ' +
      'Mix it back from memory: hue, saturation, light. Five rounds, and from the second ' +
      'round the record waits in the dark a little longer before the sliders arrive.</p>' +
      '<p class="cal-note">the sliders answer to the arrow keys</p>'
    );
    var go = document.createElement("button");
    go.type = "button";
    go.className = "btn primary";
    go.textContent = "Show the colour";
    go.addEventListener("click", function () {
      if (go.disabled) { return; }
      go.disabled = true;
      start();
    });
    api.setControls(go);
  }
});
})();
