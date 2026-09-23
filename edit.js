/* ===========================================================================
   EDIT MODE — local authoring tool. Not part of the website.

   Loaded only when the page is served from localhost (see the guard at the
   bottom of index.html), so it is inert on GitHub Pages.

   HOW IT SAVES
   It does NOT serialize the live DOM — that would drag in browser-sync's
   injected script and lose the comments. Instead it re-fetches the raw
   index.html from disk, parses it, copies your edited text into the matching
   elements, and writes that back. Comments, formatting and structure survive.

   Requires save-server.py running on port 8001.
   =========================================================================== */
(function () {
  "use strict";

  // Every selector here becomes editable. Order matters only in that it must
  // resolve identically against the live page and the file on disk.
  var SELECTORS = [
    "h1",
    ".stats dt",            // stat labels — SCHOOL, MAJOR, …
    ".stats dd",            // stat values (the .qual italic rides along inside)
    ".about .tag",          // the "About" label
    ".about p",
    ".prose p",
    ".prose h3",
    ".takeaway p",
    // :not(.ed-x) matters — edit mode injects helper spans into each TK, and a
    // TK inside a .meta block would otherwise be counted as an editable field
    // in the live page but not in the file, desyncing the save.
    ".entry .meta span:not(.ed-x)",
    "figcaption",
    ".section-head h2",
    "footer p"
    // Deliberately NOT editable: the nav rail and the contact links. Editing
    // link text here would leave the href pointing somewhere else, which is a
    // silent way to break your own email link. Those belong in the file.
  ].join(",");

  var SAVE_URL = "http://127.0.0.1:8001/save";
  var on = sessionStorage.getItem("editmode") === "1";

  /* ----------------------------- styles ----------------------------- */
  var css = document.createElement("style");
  css.textContent = [
    "#ed-bar{position:fixed;right:18px;bottom:18px;z-index:9999;display:flex;gap:8px;",
      "align-items:center;font:500 12px/1 ui-monospace,SFMono-Regular,Menlo,monospace;",
      "background:#15181B;color:#E9EBEC;padding:8px;border-radius:8px;",
      "box-shadow:0 6px 24px rgba(0,0,0,.28)}",
    "#ed-bar button{font:inherit;color:inherit;background:#2A2F34;border:0;padding:8px 12px;",
      "border-radius:5px;cursor:pointer;letter-spacing:.06em;text-transform:uppercase}",
    "#ed-bar button:hover{background:#3A4147}",
    "#ed-bar button.on{background:#0D5C6B}",
    "#ed-bar #ed-msg{padding:0 6px;opacity:.75;min-width:90px}",
    "body.ed [contenteditable]{outline:1px dashed rgba(13,92,107,.45);outline-offset:3px;border-radius:2px}",
    "body.ed [contenteditable]:focus{outline:2px solid #0D5C6B;background:rgba(13,92,107,.05)}",
    "body.ed .tk{position:relative}",
    ".ed-x{position:absolute;top:-9px;right:-9px;width:17px;height:17px;line-height:16px;",
      "text-align:center;border-radius:50%;background:#0D5C6B;color:#fff;font:700 11px/16px sans-serif;",
      "cursor:pointer;z-index:5;user-select:none}"
  ].join("");
  document.head.appendChild(css);

  /* ----------------------------- toolbar ---------------------------- */
  var bar = document.createElement("div");
  bar.id = "ed-bar";
  bar.innerHTML =
    '<button id="ed-toggle">Edit</button>' +
    '<button id="ed-save">Save</button>' +
    '<span id="ed-msg"></span>';
  document.body.appendChild(bar);

  var btnToggle = bar.querySelector("#ed-toggle"),
      btnSave   = bar.querySelector("#ed-save"),
      msg       = bar.querySelector("#ed-msg");

  function say(t, ms) {
    msg.textContent = t;
    if (ms) setTimeout(function () { if (msg.textContent === t) msg.textContent = ""; }, ms);
  }

  /* --------------------------- enable / disable --------------------- */
  function fields() { return document.querySelectorAll(SELECTORS); }

  function enable(state) {
    on = state;
    sessionStorage.setItem("editmode", state ? "1" : "0");
    document.body.classList.toggle("ed", state);
    btnToggle.classList.toggle("on", state);
    btnToggle.textContent = state ? "Editing" : "Edit";

    fields().forEach(function (el) {
      if (state) el.setAttribute("contenteditable", "true");
      else el.removeAttribute("contenteditable");
    });

    document.querySelectorAll(".ed-x").forEach(function (x) { x.remove(); });
    if (state) {
      // Each TK gets an × that unwraps it — keeps the text, drops the marker.
      document.querySelectorAll(".tk").forEach(function (tk) {
        var x = document.createElement("span");
        x.className = "ed-x";
        x.textContent = "×";
        x.title = "Clear this TK marker (keeps the text)";
        x.contentEditable = "false";
        x.addEventListener("click", function (e) {
          e.preventDefault(); e.stopPropagation();
          x.remove();
          var parent = tk.parentNode;
          while (tk.firstChild) parent.insertBefore(tk.firstChild, tk);
          parent.removeChild(tk);
          say("TK cleared — Save to keep", 2500);
        });
        tk.appendChild(x);
      });
    }
    say(state ? "editing" : "", state ? 1500 : 0);
  }

  /* ------------------------------ saving ---------------------------- */
  function stripHelpers(root) {
    root.querySelectorAll(".ed-x").forEach(function (x) { x.remove(); });
  }

  async function save() {
    say("saving…");
    try {
      // Raw source off disk. fetch() sends Accept: */*, so browser-sync
      // hands back the unmodified file rather than the injected one.
      var res = await fetch("index.html?raw=" + Date.now(), { cache: "no-store" });
      var src = await res.text();
      var doc = new DOMParser().parseFromString(src, "text/html");

      var live = document.querySelectorAll(SELECTORS);
      var file = doc.querySelectorAll(SELECTORS);
      if (live.length !== file.length) {
        say("out of sync — reload", 5000);
        console.warn("edit.js: live", live.length, "vs file", file.length);
        return;
      }

      var changed = 0;
      live.forEach(function (el, i) {
        var clone = el.cloneNode(true);
        stripHelpers(clone);
        if (file[i].innerHTML !== clone.innerHTML) {
          file[i].innerHTML = clone.innerHTML;
          changed++;
        }
      });

      if (!changed) { say("no changes", 2000); return; }

      var out = "<!DOCTYPE html>\n" + doc.documentElement.outerHTML + "\n";
      var post = await fetch(SAVE_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ html: out })
      });
      var j = await post.json();
      say(j.ok ? "saved " + changed + " edit" + (changed > 1 ? "s" : "") : "error: " + j.error, 4000);
    } catch (err) {
      say("save failed — is save-server.py running?", 6000);
      console.error(err);
    }
  }

  /* ------------------------------ wiring ---------------------------- */
  btnToggle.addEventListener("click", function () { enable(!on); });
  btnSave.addEventListener("click", save);

  // Paste as plain text, so Word/Docs formatting never leaks into the markup.
  document.addEventListener("paste", function (e) {
    if (!on || !e.target.isContentEditable) return;
    e.preventDefault();
    document.execCommand("insertText", false, (e.clipboardData || window.clipboardData).getData("text"));
  });

  document.addEventListener("keydown", function (e) {
    if ((e.metaKey || e.ctrlKey) && e.key === "s") { e.preventDefault(); save(); }
    if ((e.metaKey || e.ctrlKey) && e.key === "e") { e.preventDefault(); enable(!on); }
  });

  enable(on);   // survives the reload browser-sync fires after each save
  console.log("edit.js ready — ⌘E toggles editing, ⌘S saves");
})();
