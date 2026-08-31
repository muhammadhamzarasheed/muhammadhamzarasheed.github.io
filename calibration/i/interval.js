/* The interval: a reference tone sounds once, then a second live tone
   is tuned onto it by ear and the gap is scored in cents. WebAudio,
   oscillators only, no audio files. The context is created on the
   reader's explicit Sound on press, everything runs through a single
   low master gain, and the context is suspended and closed when the
   reader leaves the instrument. Contract: see the shell comment block
   in /calibration/index.html. */
(function () {
"use strict";
if (!window.CAL) { return; }

var AC = window.AudioContext || window.webkitAudioContext;

/* ---------- the card: say what this one does, and that it speaks ---------- */
(function () {
  var p = document.querySelector("#card-interval .gmain p");
  if (p) { p.textContent = "A tone sounded once, then found again by ear."; }
  var gm = document.querySelector("#card-interval .gmain");
  if (gm) {
    var warn = document.createElement("span");
    warn.className = "cal-note";
    warn.style.display = "block";
    warn.textContent = "This one speaks.";
    gm.insertBefore(warn, document.getElementById("best-interval"));
  }
})();

/* ---------- no WebAudio: the card stands down ---------- */
if (!AC) {
  document.addEventListener("DOMContentLoaded", function () {
    var el = document.getElementById("best-interval");
    if (!el) { return; }
    var LINE = "needs a quieter room";
    el.textContent = LINE;
    // the shell rewrites the best line on every return to the index;
    // keep this card's own notice standing
    if (window.MutationObserver) {
      new MutationObserver(function () {
        if (el.textContent !== LINE) { el.textContent = LINE; }
      }).observe(el, { childList: true, characterData: true, subtree: true });
    }
  });
  return; // never registers, so Begin stays disabled
}

/* ---------- one audio rig for the whole instrument ---------- */
var ctx = null;      // AudioContext, made on the Sound on press only
var master = null;   // the one gain node everything passes through
var curOsc = null;   // the reference tone currently sounding, if any
var liveOsc = null;  // the reader's tunable tone
var liveGain = null;
var pendT = null;    // the listen phase timer
var tok = 0;         // session token; a bump makes stale callbacks inert

function playRef(f, dur) {
  if (!ctx || ctx.state === "closed") { return; }
  var o = ctx.createOscillator();
  var g = ctx.createGain();
  o.type = "sine";
  o.frequency.value = f;
  var t = ctx.currentTime;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(1, t + 0.03);
  g.gain.setValueAtTime(1, t + dur - 0.08);
  g.gain.linearRampToValueAtTime(0.0001, t + dur);
  o.connect(g);
  g.connect(master);
  o.start(t);
  o.stop(t + dur + 0.02);
  curOsc = o;
  o.onended = function () {
    try { g.disconnect(); } catch (e) {}
    if (curOsc === o) { curOsc = null; }
  };
}
function stopRef() {
  if (!curOsc) { return; }
  try { curOsc.stop(0); } catch (e) {}
  curOsc = null;
}
function startLive(f) {
  if (!ctx || ctx.state === "closed") { return; }
  stopLive();
  liveOsc = ctx.createOscillator();
  liveGain = ctx.createGain();
  liveOsc.type = "sine";
  liveOsc.frequency.value = f;
  var t = ctx.currentTime;
  liveGain.gain.setValueAtTime(0.0001, t);
  liveGain.gain.linearRampToValueAtTime(0.5, t + 0.06);
  liveOsc.connect(liveGain);
  liveGain.connect(master);
  liveOsc.start(t);
}
function setLive(f) {
  if (!liveOsc || !ctx) { return; }
  liveOsc.frequency.setTargetAtTime(f, ctx.currentTime, 0.02);
}
function stopLive() {
  if (!liveOsc) { return; }
  var o = liveOsc, g = liveGain;
  liveOsc = null;
  liveGain = null;
  try {
    var t = ctx.currentTime;
    g.gain.cancelScheduledValues(t);
    g.gain.setValueAtTime(g.gain.value, t);
    g.gain.linearRampToValueAtTime(0.0001, t + 0.05);
    o.stop(t + 0.07);
    o.onended = function () { try { g.disconnect(); } catch (e) {} };
  } catch (e) {
    try { o.stop(0); } catch (e2) {}
  }
}
function teardown() {
  tok += 1;
  if (pendT) { clearTimeout(pendT); pendT = null; }
  stopLive();
  stopRef();
  var c = ctx;
  ctx = null;
  master = null;
  if (c && c.state !== "closed") {
    try { if (c.suspend) { c.suspend(); } } catch (e) {}
    try { c.close(); } catch (e) {}
  }
}

/* the shell hides the stage on every route back to the index; that is
   the moment the sound rig is shut down */
var stage = document.getElementById("stage");
if (stage && window.MutationObserver) {
  new MutationObserver(function () {
    if (stage.hidden) { teardown(); }
  }).observe(stage, { attributes: true, attributeFilter: ["hidden"] });
} else {
  var sb = document.getElementById("sback");
  var rb = document.getElementById("rback");
  if (sb) { sb.addEventListener("click", teardown); }
  if (rb) { rb.addEventListener("click", teardown); }
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") { teardown(); }
  });
}

/* ---------- the instrument ---------- */
function build(stageEl, api) {
  tok += 1;
  var myTok = tok;
  var doneRounds = 0;
  var FMIN = 120, FMAX = 840; // the slider's reach, wider than the draw
  var SPAN = 1200 * Math.log(FMAX / FMIN) / Math.LN2; // in cents
  var ref = 0;

  if (pendT) { clearTimeout(pendT); pendT = null; }
  stopLive();
  stopRef();
  stageEl.tabIndex = -1;

  function alive() { return myTok === tok; }
  function vToHz(v) { return FMIN * Math.pow(FMAX / FMIN, v / 1000); }
  function btn(txt) {
    var b = document.createElement("button");
    b.type = "button";
    b.className = "btn primary";
    b.textContent = txt;
    return b;
  }

  function gate() {
    api.setPrompt(
      '<p class="rlab">Sound on</p>' +
      '<p class="rinst">This instrument speaks. Each round a reference tone sounds once, briefly. A second tone is then yours: tune it by ear until the two agree, and submit. The fifth reference is shorter.</p>' +
      '<p class="cal-note">quiet tones &middot; headphones help &middot; nothing sounds until you press</p>'
    );
    var b = btn("Sound on");
    b.addEventListener("click", function () {
      if (!alive()) { return; }
      if (!ctx || ctx.state === "closed") {
        try {
          ctx = new AC();
          master = ctx.createGain();
          master.gain.value = 0.1;
          master.connect(ctx.destination);
        } catch (e) {
          ctx = null;
          master = null;
          api.setPrompt('<p class="rinst">The tone generator would not start. Nothing sounds. Press Escape to return.</p>');
          api.setControls(null);
          return;
        }
      }
      if (ctx.state === "suspended" && ctx.resume) { ctx.resume(); }
      listen();
    });
    api.setControls(b);
  }

  function listen() {
    var r = api.round;
    var dur = r === 5 ? 0.6 : 1.2;
    ref = 180 * Math.pow(640 / 180, api.rng()); // 180 to 640 Hz, log spaced
    api.setPrompt(
      '<p class="rlab">The reference</p>' +
      '<p class="rinst">' + (r === 5
        ? "Last round. The reference sounds for half the usual time. Listen hard."
        : "Listening. The reference is sounding. Hold it in your ear.") + '</p>'
    );
    api.setControls(null);
    stageEl.focus();
    playRef(ref, dur);
    pendT = setTimeout(function () {
      pendT = null;
      if (!alive()) { return; }
      tune();
    }, dur * 1000 + 350);
  }

  function tune() {
    // start the slider well off the reference, on a side with room
    var refC = 1200 * Math.log(ref / FMIN) / Math.LN2;
    var off = 300 + 600 * api.rng();
    var dirn = api.rng() < 0.5 ? -1 : 1;
    var startC = refC + dirn * off;
    if (startC < 0 || startC > SPAN) { startC = refC - dirn * off; }
    startC = Math.max(0, Math.min(SPAN, startC));
    var startV = Math.round(startC / SPAN * 1000);

    api.setPrompt(
      '<p class="rlab">Your tone</p>' +
      '<p class="rinst">The second tone is live. Tune it onto the reference, then submit. Up is higher.</p>' +
      '<p class="cal-note">arrows for fine steps &middot; page up and page down for coarse</p>'
    );

    var sl = document.createElement("input");
    sl.type = "range";
    sl.min = "0";
    sl.max = "1000";
    sl.step = "1";
    sl.value = String(startV);
    sl.setAttribute("orient", "vertical");
    sl.setAttribute("aria-label", "Pitch of the second tone. Up raises it.");
    sl.style.writingMode = "vertical-lr";
    sl.style.direction = "rtl";
    sl.style.webkitAppearance = "slider-vertical";
    sl.style.height = "240px";
    sl.style.width = "2.75rem";
    sl.style.touchAction = "none";
    sl.setAttribute("aria-valuetext", Math.round(vToHz(startV)) + " hertz");
    startLive(vToHz(startV));
    sl.addEventListener("input", function () {
      var f = vToHz(Number(sl.value));
      setLive(f);
      sl.setAttribute("aria-valuetext", Math.round(f) + " hertz");
    });

    var sub = btn("Submit");
    sub.addEventListener("click", function () {
      if (!alive()) { return; }
      var f = vToHz(Number(sl.value));
      stopLive();
      var err = Math.abs(1200 * Math.log(f / ref) / Math.LN2);
      var s = err <= 25 ? 10 : err >= 400 ? 0 : 10 * (400 - err) / 375;
      api.submitRound(s, "you tuned " + Math.round(f) + " Hz against " +
        Math.round(ref) + " Hz, off by " + Math.round(err) + " cents");
      doneRounds += 1;
      if (doneRounds >= 5) { closing(); } else { interlude(); }
    });

    var wrap = document.createElement("div");
    wrap.style.display = "flex";
    wrap.style.flexDirection = "column";
    wrap.style.alignItems = "flex-start";
    wrap.style.gap = ".8rem";
    wrap.appendChild(sl);
    wrap.appendChild(sub);
    api.setControls(wrap);
    sl.focus();
  }

  function interlude() {
    api.setPrompt(
      '<p class="rlab">Logged</p>' +
      '<p class="rinst">The gap is entered below. The next reference sounds the moment you call for it.</p>'
    );
    var b = btn("Next round");
    b.addEventListener("click", function () {
      if (!alive()) { return; }
      listen();
    });
    api.setControls(b);
    b.focus();
  }

  function closing() {
    api.setPrompt(
      '<p class="rlab">Logged</p>' +
      '<p class="rinst">Five rounds on the record. Take the reading.</p>'
    );
    var b = btn("The reading");
    b.addEventListener("click", function () {
      if (!alive()) { return; }
      stopLive();
      api.done();
    });
    api.setControls(b);
    b.focus();
  }

  gate();
}

window.CAL.register({
  id: "interval",
  name: "The interval",
  blurb: "A tone sounded once, then found again by ear. This one speaks.",
  build: build
});
})();
