/* The re-key: figure transcription from memory. One of the five
   calibration instruments; the contract is documented in the shell
   at /calibration/index.html. */
(function () {
"use strict";
if (!window.CAL) { return; }

/* One entry per round: digit count, decimal tail, comma grouping,
   how long the figure shows, and the brief read before the flash. */
var SPECS = [
  { d: 5, dec: false, group: false, ms: 1200, brief: "Five digits." },
  { d: 6, dec: false, group: true,  ms: 1400, brief: "Six digits, comma grouped." },
  { d: 7, dec: false, group: true,  ms: 1600, brief: "Seven digits, comma grouped." },
  { d: 6, dec: true,  group: true,  ms: 1800, brief: "Six digits, then two decimal places." },
  { d: 7, dec: true,  group: true,  ms: 2000, brief: "Seven digits, two decimal places, one glance." }
];

function groupDigits(s) {
  var out = "", i, c = 0;
  for (i = s.length - 1; i >= 0; i--) {
    out = s.charAt(i) + out;
    c += 1;
    if (c % 3 === 0 && i > 0) { out = "," + out; }
  }
  return out;
}

/* plain is the normalised truth the entry is scored against;
   shown is the same figure as it appears on the stage */
function makeFigure(spec, rng) {
  var s = String(1 + Math.floor(rng() * 9)), i;
  for (i = 1; i < spec.d; i++) { s += String(Math.floor(rng() * 10)); }
  var shown = spec.group ? groupDigits(s) : s;
  if (spec.dec) {
    var p = Math.floor(rng() * 100);
    var tail = (p < 10 ? "0" : "") + p;
    s += "." + tail;
    shown += "." + tail;
  }
  return { plain: s, shown: shown };
}

/* commas and spaces are forgiven; only digits and the point are
   the entry, so nothing else can reach the report line */
function normalise(s) { return s.replace(/[^0-9.]/g, ""); }

/* 10 for exact; 2 off per wrong, missing or extra character
   position; the floor is 0 */
function scoreEntry(keyed, plain) {
  var n = Math.max(keyed.length, plain.length), errs = 0, i;
  for (i = 0; i < n; i++) {
    if (keyed.charAt(i) !== plain.charAt(i)) { errs += 1; }
  }
  var s = 10 - errs * 2;
  return s > 0 ? s : 0;
}

window.CAL.register({
  id: "rekey",
  name: "The re-key",
  blurb: "A reference shown once, then entered from memory, exactly.",
  build: function (stageEl, api) {

    function btn(label, onPress) {
      var b = document.createElement("button");
      b.type = "button";
      b.className = "btn primary";
      b.textContent = label;
      b.addEventListener("click", onPress);
      return b;
    }

    function startRound() {
      var r = api.round;
      var spec = SPECS[r - 1];
      var fig = makeFigure(spec, api.rng);
      if (api.RM) {
        /* no flash under reduced motion: the figure sits still
           until Ready puts it away */
        api.setPrompt(
          '<p class="rlab">' + (r === 1 ? "The figure" : "Next figure") + '</p>' +
          '<p class="cal-figure">' + fig.shown + '</p>' +
          '<p class="cal-note">take it in, then press ready to put it away</p>'
        );
        api.setControls(btn("Ready", function () { askEntry(r, spec, fig); }));
      } else {
        api.setPrompt(
          '<p class="rlab">' + (r === 1 ? "The figure" : "Next figure") + '</p>' +
          '<p class="rinst">' + spec.brief +
          (r === 1
            ? " It shows for a moment, then it is gone. Key it back exactly and press Enter to log it."
            : "") +
          '</p>'
        );
        api.setControls(btn("Flash the figure", function () { flash(r, spec, fig); }));
      }
    }

    function flash(r, spec, fig) {
      api.setControls(null);
      api.setPrompt(
        '<p class="rlab">Hold it</p>' +
        '<p class="cal-figure">' + fig.shown + '</p>'
      );
      window.setTimeout(function () { askEntry(r, spec, fig); }, spec.ms);
    }

    function askEntry(r, spec, fig) {
      api.setPrompt(
        '<p class="rlab">From memory</p>' +
        '<p class="rinst">Key the figure exactly. Commas may be dropped; digits and the point may not.</p>'
      );
      var wrap = document.createElement("div");
      wrap.className = "btnrow";
      var input = document.createElement("input");
      input.className = "cal-input";
      input.type = "text";
      input.setAttribute("inputmode", spec.dec ? "decimal" : "numeric");
      input.setAttribute("autocomplete", "off");
      input.setAttribute("autocapitalize", "off");
      input.setAttribute("spellcheck", "false");
      input.setAttribute("maxlength", "18");
      input.setAttribute("aria-label", "Key the figure from memory");
      var note = document.createElement("p");
      note.className = "cal-note";
      var logged = false;
      function log() {
        if (logged) { return; }
        logged = true;
        var keyed = normalise(input.value);
        api.submitRound(
          scoreEntry(keyed, fig.plain),
          "keyed " + (keyed === "" ? "nothing" : keyed) + " against " + fig.plain
        );
        if (r >= 5) { closing(); } else { startRound(); }
      }
      input.addEventListener("keydown", function (e) {
        if (e.key === "Enter") { e.preventDefault(); log(); }
      });
      input.addEventListener("input", function () {
        var v = input.value.replace(/[^0-9.,]/g, "");
        if (v !== input.value) { input.value = v; }
      });
      input.addEventListener("paste", function (e) {
        e.preventDefault();
        note.textContent = "from memory, not the clipboard";
      });
      input.addEventListener("drop", function (e) { e.preventDefault(); });
      wrap.appendChild(input);
      wrap.appendChild(btn("Log the entry", log));
      wrap.appendChild(note);
      api.setControls(wrap);
      input.focus();
    }

    function closing() {
      api.setPrompt(
        '<p class="rlab">Fifth entry logged</p>' +
        '<p class="rinst">Now imagine three hundred rows of these.</p>'
      );
      api.setControls(btn("The reading", function () { api.done(); }));
    }

    startRound();
  }
});
})();
