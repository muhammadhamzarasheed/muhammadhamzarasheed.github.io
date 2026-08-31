/* The moved entry: a small marksheet shows for a few seconds, a shade
   passes over it, and two cells trade values. The reader points out the
   pair. Five sheets, from three rows of three marks up to four rows of
   five, the study period tightening from five seconds to three and a
   half. Contract: the shell comment block in /calibration/index.html.
   No rAF loop anywhere in this file; all pacing is setTimeout. */
(function () {
"use strict";
if (!window.CAL) { return; }

var SPECS = [
  { rows: 3, cols: 3, ms: 5000 },
  { rows: 3, cols: 4, ms: 4600 },
  { rows: 4, cols: 4, ms: 4200 },
  { rows: 4, cols: 5, ms: 3800 },
  { rows: 4, cols: 5, ms: 3500 }
];

/* cell paint states, inline so the shell's stylesheet stays untouched */
function paintCell(btn, mode) {
  var s = btn.style;
  if (mode === "picked") {
    s.border = "1px solid var(--brass)";
    s.background = "var(--brass-soft)";
    s.color = "var(--text)";
  } else if (mode === "true") {
    s.border = "1px solid var(--brass-hi)";
    s.background = "var(--brass-soft)";
    s.color = "var(--text)";
  } else if (mode === "wrong") {
    s.border = "1px solid var(--text-3)";
    s.background = "var(--void)";
    s.color = "var(--text-3)";
  } else {
    s.border = "1px solid var(--line)";
    s.background = "var(--void)";
    s.color = "var(--text-2)";
  }
}
function baseCell(btn) {
  var s = btn.style;
  s.fontFamily = "var(--mono)";
  s.fontVariantNumeric = "tabular-nums";
  s.fontSize = ".8125rem";
  s.lineHeight = "1.5";
  s.textAlign = "center";
  s.minWidth = "2.25rem";
  s.padding = ".3rem .2rem";
  s.borderRadius = ".4rem";
  s.cursor = "pointer";
  paintCell(btn, "plain");
}
function headSpan(txt) {
  var h = document.createElement("span");
  h.textContent = txt;
  var s = h.style;
  s.fontFamily = "var(--mono)";
  s.fontSize = ".6563rem";
  s.letterSpacing = ".12em";
  s.textTransform = "uppercase";
  s.color = "var(--text-3)";
  s.textAlign = "center";
  return h;
}

window.CAL.register({
  id: "moved",
  name: "The moved entry",
  blurb: "One mark is shifted while you watch. Return it to its place.",
  build: function (stageEl, api) {
    var timers = [];
    function later(fn, ms) { timers.push(setTimeout(fn, ms)); }
    function clearTimers() {
      var i;
      for (i = 0; i < timers.length; i++) { clearTimeout(timers[i]); }
      timers.length = 0;
    }

    function makeShade() {
      var sh = document.createElement("div");
      var s = sh.style;
      s.position = "absolute";
      s.top = "0"; s.right = "0"; s.bottom = "0"; s.left = "0";
      s.zIndex = "2";
      s.display = "flex";
      s.alignItems = "center";
      s.justifyContent = "center";
      s.background = "var(--raise-2)";
      s.borderRadius = ".4rem";
      s.fontFamily = "var(--mono)";
      s.fontSize = ".6875rem";
      s.letterSpacing = ".2em";
      s.textTransform = "uppercase";
      s.color = "var(--text-3)";
      s.opacity = "0";
      s.visibility = "hidden";
      /* reduced motion: the shade lands and lifts as instant states */
      if (!api.RM) { s.transition = "opacity .18s ease, visibility .18s ease"; }
      sh.textContent = "the shade";
      sh.setAttribute("aria-hidden", "true");
      return sh;
    }

    function rlab(ix) {
      return '<p class="rlab">Round 0' + (ix + 1) + ' of 05</p>';
    }

    function round(ix) {
      clearTimers();
      var spec = SPECS[ix];
      var rows = spec.rows, cols = spec.cols, N = rows * cols;
      var rng = api.rng;
      var i, j, t, r, c;

      /* distinct marks, 0 to 100, drawn without replacement */
      var pool = [];
      for (i = 0; i <= 100; i++) { pool[i] = i; }
      for (i = 0; i < N; i++) {
        j = i + Math.floor(rng() * (101 - i));
        t = pool[i]; pool[i] = pool[j]; pool[j] = t;
      }
      var marks = pool.slice(0, N);

      /* candidate refs, ascending and unique */
      var refs = [];
      var refNo = 1000 + Math.floor(rng() * 900);
      for (r = 0; r < rows; r++) {
        refs.push("S-" + refNo);
        refNo += 1 + Math.floor(rng() * 3);
      }

      /* the pair that trades places; values are distinct by construction */
      var a = Math.floor(rng() * N);
      var b = Math.floor(rng() * (N - 1));
      if (b >= a) { b += 1; }

      function labelFor(idx, val) {
        return refs[Math.floor(idx / cols)] + " C" + ((idx % cols) + 1) + ", mark " + val;
      }
      function rc(idx) {
        return "R" + (Math.floor(idx / cols) + 1) + " C" + ((idx % cols) + 1);
      }

      /* ---- the sheet ---- */
      var wrap = document.createElement("div");
      wrap.style.width = "100%";

      var box = document.createElement("div");
      box.style.border = "1px solid var(--line)";
      box.style.borderRadius = ".5rem";
      box.style.background = "var(--void)";
      box.style.overflowX = "auto";

      var grid = document.createElement("div");
      grid.setAttribute("role", "group");
      grid.setAttribute("aria-label", "Marksheet, " + rows + " candidates by " + cols + " columns");
      var gs = grid.style;
      gs.position = "relative";
      gs.display = "grid";
      gs.gridTemplateColumns = "auto repeat(" + cols + ", minmax(2.25rem, 1fr))";
      gs.gap = ".3rem";
      gs.alignItems = "center";
      gs.padding = ".6rem";
      gs.width = "max-content";
      gs.minWidth = "100%";
      gs.webkitUserSelect = "none";
      gs.userSelect = "none";

      grid.appendChild(headSpan(""));
      for (c = 1; c <= cols; c++) { grid.appendChild(headSpan("C" + c)); }

      var cells = [];
      for (r = 0; r < rows; r++) {
        var ref = document.createElement("span");
        ref.textContent = refs[r];
        ref.style.fontFamily = "var(--mono)";
        ref.style.fontVariantNumeric = "tabular-nums";
        ref.style.fontSize = ".75rem";
        ref.style.color = "var(--text-2)";
        ref.style.whiteSpace = "nowrap";
        ref.style.paddingRight = ".35rem";
        grid.appendChild(ref);
        for (c = 0; c < cols; c++) {
          var idx = r * cols + c;
          var cell = document.createElement("button");
          cell.type = "button";
          cell.textContent = String(marks[idx]);
          cell.disabled = true;
          cell.setAttribute("data-i", String(idx));
          cell.setAttribute("aria-pressed", "false");
          cell.setAttribute("aria-label", labelFor(idx, marks[idx]));
          baseCell(cell);
          cells.push(cell);
          grid.appendChild(cell);
        }
      }

      var shade = makeShade();
      grid.appendChild(shade);

      var note = document.createElement("p");
      note.className = "cal-note";
      note.textContent = "the shade passes in " + (spec.ms / 1000).toFixed(1) + " s";

      var act = document.createElement("button");
      act.type = "button";
      act.className = "btn primary";
      act.textContent = "Confirm";
      act.disabled = true;
      act.style.marginTop = ".9rem";

      box.appendChild(grid);
      wrap.appendChild(box);
      wrap.appendChild(note);
      wrap.appendChild(act);
      api.setControls(wrap);
      api.setPrompt(rlab(ix) +
        '<p class="rinst">Hold the sheet in mind. The shade is coming.</p>');

      /* a session ended early leaves the stage hidden; timers stand down */
      function dead() {
        return !document.body.contains(wrap) || wrap.offsetParent === null;
      }

      var phase = "study";
      var picks = [];
      var pickOns = 0;   /* toggles ON; a third means a change of mind */
      var locked = false;
      var settledAt = 0; /* a double click must not skip the reveal */

      /* ---- study countdown ---- */
      var endAt = Date.now() + spec.ms;
      var iv = setInterval(function () {
        if (dead()) { clearTimers(); return; }
        var left = Math.max(0, endAt - Date.now());
        note.textContent = "the shade passes in " + (left / 1000).toFixed(1) + " s";
      }, 100);
      timers.push(iv);

      /* ---- the shade, and the trade beneath it ---- */
      later(function () {
        if (dead()) { return; }
        clearTimeout(iv);
        shade.style.visibility = "visible";
        shade.style.opacity = "1";
        note.textContent = "the shade passes";
      }, spec.ms);
      later(function () {
        if (dead()) { return; }
        var A = cells[a], B = cells[b];
        var tv = A.textContent;
        A.textContent = B.textContent;
        B.textContent = tv;
        A.setAttribute("aria-label", labelFor(a, A.textContent));
        B.setAttribute("aria-label", labelFor(b, B.textContent));
      }, spec.ms + 300);
      later(function () {
        if (dead()) { return; }
        shade.style.opacity = "0";
        shade.style.visibility = "hidden";
        phase = "pick";
        for (var k = 0; k < cells.length; k++) { cells[k].disabled = false; }
        note.textContent = "mark the two that traded places";
        api.setPrompt(rlab(ix) +
          '<p class="rinst">Two entries have traded places. Mark both cells, then confirm.</p>');
        cells[0].focus();
      }, spec.ms + 650);

      /* ---- picking ---- */
      grid.addEventListener("click", function (e) {
        var btn = e.target && e.target.closest ? e.target.closest("button[data-i]") : null;
        if (locked || phase !== "pick" || !btn || btn.disabled) { return; }
        var pi = parseInt(btn.getAttribute("data-i"), 10);
        var at = picks.indexOf(pi);
        if (at > -1) {
          picks.splice(at, 1);
          btn.setAttribute("aria-pressed", "false");
          paintCell(btn, "plain");
        } else {
          if (picks.length >= 2) {
            note.textContent = "two cells only. unpick one first";
            return;
          }
          picks.push(pi);
          pickOns += 1;
          btn.setAttribute("aria-pressed", "true");
          paintCell(btn, "picked");
        }
        act.disabled = picks.length !== 2;
        note.textContent = picks.length === 2
          ? "confirm when you are settled"
          : "mark the two that traded places";
      });

      /* arrow keys walk the sheet; Tab and Enter work regardless */
      grid.addEventListener("keydown", function (e) {
        var btn = e.target;
        if (!btn || !btn.getAttribute || btn.getAttribute("data-i") === null) { return; }
        var pi = parseInt(btn.getAttribute("data-i"), 10);
        var n = null;
        if (e.key === "ArrowRight") { n = (pi % cols === cols - 1) ? pi : pi + 1; }
        else if (e.key === "ArrowLeft") { n = (pi % cols === 0) ? pi : pi - 1; }
        else if (e.key === "ArrowDown") { n = (pi + cols < N) ? pi + cols : pi; }
        else if (e.key === "ArrowUp") { n = (pi - cols >= 0) ? pi - cols : pi; }
        if (n === null) { return; }
        e.preventDefault();
        cells[n].focus();
      });

      /* ---- confirm, then on to the next sheet ---- */
      function settle() {
        phase = "after";
        locked = true;
        settledAt = Date.now();
        clearTimers();
        var k, hit = 0;
        for (k = 0; k < 2; k++) {
          if (picks[k] === a || picks[k] === b) { hit += 1; }
          else { paintCell(cells[picks[k]], "wrong"); }
        }
        paintCell(cells[a], "true");
        paintCell(cells[b], "true");
        for (k = 0; k < cells.length; k++) { cells[k].disabled = true; }
        var fickle = pickOns > 2;
        var base = hit === 2 ? 10 : (hit === 1 ? 4 : 0);
        var score = Math.max(0, base - (fickle ? 2 : 0));
        var lo = Math.min(a, b), hi = Math.max(a, b);
        var detail = hit === 2
          ? "found the moved entries"
          : "the swap was " + rc(lo) + " with " + rc(hi);
        if (fickle) { detail += ", a third pick cost two"; }
        api.submitRound(score, detail);
        note.textContent = hit === 2 ? "both entries returned" : "the pair is marked in brass";
        act.textContent = ix < 4 ? "Next sheet" : "The reading";
        act.disabled = false;
        act.focus();
      }

      act.addEventListener("click", function () {
        if (phase === "pick") {
          if (picks.length === 2) { settle(); }
        } else if (phase === "after") {
          if (Date.now() - settledAt < 350) { return; }
          if (ix < 4) { round(ix + 1); }
          else { api.done(); }
        }
      });
    }

    /* ---- arming step: the study clock must not start unannounced ---- */
    api.setPrompt(
      '<p class="rlab">Five sheets</p>' +
      '<p class="rinst">A marksheet shows for a few seconds. The shade passes over it and two entries trade places. Point out the pair. Settle early: a third pick costs two marks.</p>'
    );
    var go = document.createElement("button");
    go.type = "button";
    go.className = "btn primary";
    go.textContent = "Show the sheet";
    go.addEventListener("click", function () { round(0); });
    api.setControls(go);
  }
});
})();
