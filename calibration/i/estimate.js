/* The estimate: duration reproduction. A brass bar fills for a drawn
   stretch of time and clears; the reader holds a button for the same
   stretch and releases to enter it. Scored on proportional error:
   within 4 percent scores 10, sliding to 0 at 40 percent out. Under
   reduced motion the bar becomes a row of shade steps that go out one
   at a time, no sweep. The shell contract is documented at the top of
   the script in /calibration/index.html. */
(function () {
"use strict";
if (!window.CAL) { return; }

window.CAL.register({
  id: "estimate",
  name: "The estimate",
  blurb: "A stretch of time shown once, then held from memory.",
  build: function (stageEl, api) {

    /* one target per round, drawn up front so the session is coherent:
       about 2s in round one rising to about 7s in round five, and never
       a whole or half second */
    var MIN = [1.7, 2.8, 4.0, 5.2, 6.4];
    var SPAN = [0.7, 0.9, 0.9, 1.0, 1.1];
    var targets = [];
    var i, t, n;
    for (i = 0; i < 5; i++) {
      t = MIN[i] + api.rng() * SPAN[i];
      n = Math.round(t * 2) / 2;
      if (Math.abs(t - n) < 0.07) {
        t = n + (t >= n ? 1 : -1) * (0.11 + api.rng() * 0.05);
      }
      targets[i] = Math.round(t * 100) / 100;
    }

    /* every width the fill can take, built once: the frame loop only
       looks strings up, it never makes them */
    var W = [];
    for (i = 0; i <= 200; i++) { W[i] = (i / 2) + "%"; }

    var r = 0;        /* rounds entered so far */
    var raf = null;

    function armButton(label, fn) {
      var b = document.createElement("button");
      b.type = "button";
      b.className = "btn primary";
      b.textContent = label;
      b.addEventListener("click", fn);
      api.setControls(b);
      b.focus();
    }

    /* ---------- the watch phase ---------- */
    function watch() {
      api.setControls(null);
      var durMs = targets[r] * 1000;
      var stepMs = durMs / 8;
      var html, k;
      if (api.RM) {
        html = '<p class="rlab">Watch</p>' +
          '<div id="est-steps" aria-hidden="true" style="display:flex;gap:.35rem;margin:.9rem 0 .35rem;">';
        for (k = 0; k < 8; k++) {
          html += '<span style="flex:1;height:1.1rem;border:1px solid var(--line);border-radius:.25rem;background:rgba(201,170,124,' +
            (0.2 + k * 0.09).toFixed(2) + ');"></span>';
        }
        html += '</div><p class="cal-note">Feel the length of this.</p>';
      } else {
        html = '<p class="rlab">Watch</p>' +
          '<div class="meter noanim" aria-hidden="true" style="height:1rem;">' +
          '<div class="meter-fill" id="est-fill" style="width:0%;"></div></div>' +
          '<p class="cal-note">Feel the length of this.</p>';
      }
      api.setPrompt(html);
      var fill = api.RM ? null : stageEl.querySelector("#est-fill");
      var steps = api.RM ? stageEl.querySelector("#est-steps") : null;
      var watchEl = api.RM ? steps : fill;
      if (!watchEl) { return; }  /* stale session: the prompt never landed */
      var t0 = -1;
      var lastQ = -1;
      var gone = 0;
      function frame(now) {
        raf = null;
        if (!watchEl.isConnected) { return; }  /* the session moved on */
        if (t0 < 0) { t0 = now; }
        var elapsed = now - t0;
        if (elapsed >= durMs) { hold(); return; }  /* the swap marks the end */
        if (steps) {
          var due = Math.floor(elapsed / stepMs);
          while (gone < due) {
            steps.children[gone].style.background = "transparent";
            gone += 1;
          }
        } else {
          var q = Math.floor(elapsed / durMs * 200);
          if (q !== lastQ) { lastQ = q; fill.style.width = W[q]; }
        }
        raf = requestAnimationFrame(frame);
      }
      raf = requestAnimationFrame(frame);
    }

    /* ---------- the hold phase ---------- */
    function hold() {
      api.setPrompt('<p class="rlab">Your turn</p>' +
        '<p class="rinst">Hold the button for the stretch you just watched. Pointer or the space bar. Release to enter it.</p>' +
        '<p class="cal-note">No counting.</p>');
      var b = document.createElement("button");
      b.type = "button";
      b.className = "btn primary";
      b.style.cssText = "width:100%;max-width:26rem;padding:1.5rem 1rem;font-size:.8125rem;letter-spacing:.18em;border-radius:.7rem;touch-action:none;-webkit-user-select:none;user-select:none;-webkit-touch-callout:none;";
      b.textContent = "Press and hold";
      var t0 = null;
      var entered = false;

      function start() {
        if (entered || t0 !== null) { return; }
        t0 = performance.now();
        b.textContent = "Holding";
      }
      function end() {
        if (entered || t0 === null) { return; }
        var held = performance.now() - t0;
        if (held < 250) {  /* a slip, not a reading: quietly rearm */
          t0 = null;
          b.textContent = "Press and hold";
          return;
        }
        entered = true;
        settle(held);
      }
      b.addEventListener("pointerdown", function (e) {
        e.preventDefault();
        try { b.setPointerCapture(e.pointerId); } catch (err) {}
        start();
      });
      b.addEventListener("pointerup", function (e) { e.preventDefault(); end(); });
      b.addEventListener("pointercancel", end);
      b.addEventListener("keydown", function (e) {
        if ((e.key === " " || e.key === "Spacebar") && !e.repeat) {
          e.preventDefault();
          start();
        }
      });
      b.addEventListener("keyup", function (e) {
        if (e.key === " " || e.key === "Spacebar") { e.preventDefault(); end(); }
      });
      b.addEventListener("blur", end);
      b.addEventListener("contextmenu", function (e) { e.preventDefault(); });
      api.setControls(b);
      b.focus();
    }

    /* ---------- scoring and pacing ---------- */
    function settle(heldMs) {
      var tgtMs = targets[r] * 1000;
      var p = Math.abs(heldMs - tgtMs) / tgtMs;
      var score = p <= 0.04 ? 10 : (p >= 0.40 ? 0 : 10 * (0.40 - p) / 0.36);
      var detail = "held " + (heldMs / 1000).toFixed(2) + "s against " + targets[r].toFixed(2) + "s";
      r += 1;
      api.submitRound(score, detail);
      if (r < 5) {
        api.setPrompt('<p class="rlab">Logged</p>' +
          '<p class="rinst">The reading is on the line below. The next stretch runs longer.</p>');
        armButton("Next length", watch);
      } else {
        api.setPrompt('<p class="rlab">Logged</p>' +
          '<p class="rinst">Five lengths held. Nothing left to enter.</p>');
        armButton("The reading", function () { api.done(); });
      }
    }

    /* ---------- open ---------- */
    api.setPrompt('<p class="rlab">Five lengths</p>' +
      '<p class="rinst">' + (api.RM
        ? "A row of brass steps goes out, one at a time, then clears."
        : "A brass bar fills, then clears.") +
      ' Hold the button for the same stretch of time, then release. Five rounds, each one longer. No clock, no counting.</p>');
    armButton("Begin", watch);
  }
});
})();
