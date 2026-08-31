/* The audit trail: HUD. Everything the reader sees outside the canvas
   lives in the DOM and speaks the ledger's language: mono figures,
   brass accents, UK English, no theatrics. */

const els = {};
const done = new Set();
let toastTimer = 0;
let toastFade = 0;
let paused = false;
let signed = false;

export function initHud() {
  els.count = document.getElementById("trailcount");
  els.toast = document.getElementById("trailtoast");
  els.toastNum = document.getElementById("trailtoastnum");
  els.toastTxt = document.getElementById("trailtoasttxt");
  els.link = document.getElementById("traillink");
  els.veil = document.getElementById("trailveil");
  els.cs = document.getElementById("trailcs");
  els.pause = document.getElementById("trailpause");
  els.resume = document.getElementById("trailresume");

  const drive = document.getElementById("trailcsdrive");
  if (drive) drive.addEventListener("click", dismissCountersign);
  if (els.resume) els.resume.addEventListener("click", () => setPaused(false));
}

/* First entry into a district settles it: the tally ticks over once,
   the eyebrow toast shows on every entry. Returns how many of the
   seven districts are reconciled so far. */
export function reconcile(index, title) {
  if (!done.has(index)) {
    done.add(index);
    if (els.count) {
      els.count.textContent = String(done.size).padStart(2, "0");
    }
  }
  if (els.toast) {
    els.toastNum.textContent = String(index).padStart(2, "0");
    els.toastTxt.textContent = " / " + title;
    els.toast.hidden = false;
    clearTimeout(toastTimer);
    clearTimeout(toastFade);
    requestAnimationFrame(() => els.toast.classList.add("on"));
    toastTimer = setTimeout(() => {
      els.toast.classList.remove("on");
      toastFade = setTimeout(() => { els.toast.hidden = true; }, 400);
    }, 2500);
  }
  return done.size;
}

export function reconciledCount() {
  return done.size;
}

export function showLinkPrompt(label) {
  if (!els.link) return;
  els.link.textContent = "Press E / tap to open " + label;
  els.link.hidden = false;
}

export function hideLinkPrompt() {
  if (els.link) els.link.hidden = true;
}

/* 07/07: the mark countersigns the page, drawn stroke by stroke by a
   plain CSS dashoffset transition. */
export function countersign() {
  if (signed || !els.cs) return;
  signed = true;
  els.cs.hidden = false;
  requestAnimationFrame(() => {
    requestAnimationFrame(() => els.cs.classList.add("on"));
  });
  const drive = document.getElementById("trailcsdrive");
  if (drive) drive.focus();
}

export function dismissCountersign() {
  if (!els.cs || els.cs.hidden) return;
  els.cs.classList.remove("on");
  setTimeout(() => { els.cs.hidden = true; }, 450);
}

export function countersignOpen() {
  return !!els.cs && !els.cs.hidden;
}

/* Escape: a small pause card with the same doors as the fallback. */
export function setPaused(next) {
  paused = !!next;
  if (els.pause) {
    els.pause.hidden = !paused;
    if (paused && els.resume) els.resume.focus();
  }
}

export function togglePause() {
  setPaused(!paused);
}

export function isPaused() {
  return paused;
}

export function veilDone() {
  if (!els.veil) return;
  els.veil.classList.add("off");
  setTimeout(() => { els.veil.hidden = true; }, 500);
}
