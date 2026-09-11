/* =========================================================
   Future Me — vanilla JS
   Capsules are stored in localStorage under STORAGE_KEY.
   The dashboard renders each capsule once and then patches
   its countdown / progress bar in place every second, so
   entrance animations are never restarted by the ticker.
   ========================================================= */
(function () {
  "use strict";

  var STORAGE_KEY = "futureMe.capsules.v1";
  var THEME_KEY = "futureMe.theme";

  /* ---------------- Motivational quotes ---------------- */
  var QUOTES = [
    { text: "Le meilleur moment pour planter un arbre, c’était il y a vingt ans. Le deuxième meilleur moment, c’est maintenant.", author: "Proverbe chinois" },
    { text: "On n’est jamais trop vieux pour se fixer un nouveau but ou faire un nouveau rêve.", author: "C. S. Lewis" },
    { text: "Ce que vous faites aujourd’hui peut améliorer tous vos lendemains.", author: "Ralph Marston" },
    { text: "L’avenir dépend de ce que vous faites aujourd’hui.", author: "Gandhi" },
    { text: "De petits pas chaque jour finissent par mener très loin.", author: "Anonyme" },
    { text: "Votre avenir se construit par ce que vous faites aujourd’hui, non demain.", author: "Robert Kiyosaki" },
    { text: "Cela semble toujours impossible, jusqu’à ce que ce soit fait.", author: "Nelson Mandela" },
    { text: "Faites aujourd’hui quelque chose dont votre futur vous vous remerciera.", author: "Sean Patrick Flanery" },
    { text: "Le secret pour avancer, c’est de commencer.", author: "Mark Twain" },
    { text: "Dans un an, vous regretterez peut-être de ne pas avoir commencé aujourd’hui.", author: "Karen Lamb" },
    { text: "La discipline, c’est choisir entre ce que l’on veut maintenant et ce que l’on veut le plus.", author: "Abraham Lincoln" },
    { text: "Toute réussite commence par la décision d’essayer.", author: "John F. Kennedy" },
    { text: "La patience n’est pas la capacité d’attendre, mais la manière d’agir en attendant.", author: "Joyce Meyer" },
    { text: "La croissance n’est jamais le fruit du hasard ; elle résulte de forces qui œuvrent ensemble.", author: "James Cash Penney" },
    { text: "Le temps est la monnaie de votre vie. Dépensez-la vous-même.", author: "Carl Sandburg" }
  ];

  /* ---------------- Element handles ---------------- */
  var $ = function (sel, root) { return (root || document).querySelector(sel); };
  var $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };

  var form = $("#capsuleForm");
  var nameInput = $("#name");
  var messageInput = $("#message");
  var dateInput = $("#unlockAt");
  var charCount = $("#charCount");
  var listEl = $("#capsuleList");
  var emptyEl = $("#emptyState");
  var statLine = $("#statLine");
  var toastEl = $("#toast");
  var overlay = $("#revealOverlay");
  var overlayMeta = $("#revealMeta");
  var overlayBody = $("#revealBody");
  var confettiEl = $("#confetti");
  var quoteBox = $("#quoteBox");
  var quoteText = $("#quoteText");
  var quoteAuthor = $("#quoteAuthor");

  var capsules = [];
  var cardRefs = {};          // id -> { root, parts... }
  var activeFilter = "all";
  var revealQueue = [];
  var overlayOpen = false;
  var lastQuoteIndex = -1;

  /* ---------------- Storage ---------------- */
  function load() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      var parsed = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(parsed)) return [];
      return parsed.filter(function (c) {
        return c && typeof c.message === "string" && typeof c.unlockAt === "number";
      });
    } catch (err) {
      console.warn("Moi, plus tard\u00a0: impossible de lire les lettres enregistrées.", err);
      return [];
    }
  }

  function save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(capsules));
    } catch (err) {
      toast("Espace de stockage saturé — la lettre n’a pas pu être enregistrée.");
    }
  }

  /* ---------------- Helpers ---------------- */
  function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, function (ch) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch];
    });
  }

  function makeId() {
    return "c_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  function pad(n) { return n < 10 ? "0" + n : String(n); }

  function formatDate(ts) {
    var d = new Date(ts);
    return d.toLocaleString("fr-FR", {
      year: "numeric", month: "long", day: "numeric",
      weekday: "short", hour: "2-digit", minute: "2-digit"
    });
  }

  function breakdown(ms) {
    var total = Math.max(0, Math.floor(ms / 1000));
    return {
      days: Math.floor(total / 86400),
      hours: Math.floor(total / 3600) % 24,
      minutes: Math.floor(total / 60) % 60,
      seconds: total % 60
    };
  }

  function isUnlocked(c) { return Date.now() >= c.unlockAt; }

  function toLocalInputValue(date) {
    return date.getFullYear() + "-" + pad(date.getMonth() + 1) + "-" + pad(date.getDate()) +
      "T" + pad(date.getHours()) + ":" + pad(date.getMinutes());
  }

  var toastTimer;
  function toast(msg) {
    toastEl.textContent = msg;
    toastEl.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.classList.remove("show"); }, 3200);
  }

  /* ---------------- Theme ---------------- */
  function applyTheme(theme) {
    document.documentElement.setAttribute("data-theme", theme);
    try { localStorage.setItem(THEME_KEY, theme); } catch (err) { /* ignore */ }
  }

  function initTheme() {
    var saved = null;
    try { saved = localStorage.getItem(THEME_KEY); } catch (err) { /* ignore */ }
    if (saved !== "light" && saved !== "dark") {
      var prefersLight = window.matchMedia && window.matchMedia("(prefers-color-scheme: light)").matches;
      saved = prefersLight ? "light" : "dark";
    }
    applyTheme(saved);
  }

  $("#themeToggle").addEventListener("click", function () {
    var next = document.documentElement.getAttribute("data-theme") === "dark" ? "light" : "dark";
    applyTheme(next);
  });

  /* ---------------- Quotes ---------------- */
  function showQuote() {
    var i = lastQuoteIndex;
    while (QUOTES.length > 1 && i === lastQuoteIndex) {
      i = Math.floor(Math.random() * QUOTES.length);
    }
    lastQuoteIndex = i;
    quoteText.textContent = QUOTES[i].text;
    quoteAuthor.textContent = "— " + QUOTES[i].author;
    quoteBox.classList.remove("swap");
    void quoteBox.offsetWidth;   // restart the animation
    quoteBox.classList.add("swap");
  }
  $("#newQuote").addEventListener("click", showQuote);

  /* ---------------- Form ---------------- */
  messageInput.addEventListener("input", function () {
    charCount.textContent = messageInput.value.length;
  });

  function setError(field, msg) {
    var el = $('[data-error-for="' + field.id + '"]');
    if (el) el.textContent = msg || "";
    field.classList.toggle("invalid", Boolean(msg));
  }

  function clearErrors() {
    [nameInput, messageInput, dateInput].forEach(function (f) { setError(f, ""); });
  }

  $$(".quick-picks .chip").forEach(function (chip) {
    chip.addEventListener("click", function () {
      var d = new Date();
      d.setDate(d.getDate() + Number(chip.dataset.days));
      dateInput.value = toLocalInputValue(d);
      setError(dateInput, "");
    });
  });

  form.addEventListener("submit", function (evt) {
    evt.preventDefault();
    clearErrors();

    var name = nameInput.value.trim();
    var message = messageInput.value.trim();
    var when = dateInput.value ? new Date(dateInput.value).getTime() : NaN;
    var ok = true;

    if (!name) { setError(nameInput, "Dites à votre futur vous qui écrit."); ok = false; }
    if (message.length < 5) { setError(messageInput, "Écrivez au moins quelques mots."); ok = false; }
    if (!dateInput.value || isNaN(when)) {
      setError(dateInput, "Choisissez une date et une heure.");
      ok = false;
    } else if (when <= Date.now()) {
      setError(dateInput, "Ce moment est déjà passé — choisissez-en un à venir.");
      ok = false;
    }

    if (!ok) {
      var firstBad = $(".invalid");
      if (firstBad) firstBad.focus();
      return;
    }

    capsules.push({
      id: makeId(),
      name: name,
      message: message,
      createdAt: Date.now(),
      unlockAt: when,
      announced: false
    });
    save();
    render();
    form.reset();
    charCount.textContent = "0";
    setMinDate();
    showQuote();
    toast("Lettre scellée — ouverture le " + formatDate(when) + ".");
  });

  function setMinDate() {
    var d = new Date(Date.now() + 60000);
    dateInput.min = toLocalInputValue(d);
  }

  /* ---------------- Filters ---------------- */
  $$(".filters .chip").forEach(function (chip) {
    chip.addEventListener("click", function () {
      $$(".filters .chip").forEach(function (c) { c.classList.remove("active"); });
      chip.classList.add("active");
      activeFilter = chip.dataset.filter;
      render();
    });
  });

  /* ---------------- Rendering ---------------- */
  function visibleCapsules() {
    var sorted = capsules.slice().sort(function (a, b) {
      var au = isUnlocked(a), bu = isUnlocked(b);
      if (au !== bu) return au ? 1 : -1;          // locked first
      return au ? b.unlockAt - a.unlockAt         // newest unlocks on top
                : a.unlockAt - b.unlockAt;        // soonest to open on top
    });
    if (activeFilter === "locked") return sorted.filter(function (c) { return !isUnlocked(c); });
    if (activeFilter === "unlocked") return sorted.filter(isUnlocked);
    return sorted;
  }

  function buildCard(c) {
    var unlocked = isUnlocked(c);
    var card = document.createElement("article");
    card.className = "capsule " + (unlocked ? "unlocked" : "locked");
    card.dataset.id = c.id;

    card.innerHTML =
      '<div class="cap-top">' +
        '<div>' +
          '<span class="cap-name">' + escapeHtml(c.name) + '</span>' +
          '<span class="cap-date">' + (unlocked ? "Ouverte le " : "Ouverture le ") + escapeHtml(formatDate(c.unlockAt)) + '</span>' +
        '</div>' +
        '<span class="badge ' + (unlocked ? "unlocked" : "locked") + '">' + (unlocked ? "Ouverte" : "Scellée") + '</span>' +
      '</div>' +
      '<div class="cap-body">' +
        (unlocked
          ? '<p class="message-text">' + escapeHtml(c.message) + '</p>'
          : '<p class="locked-note"><span class="lock">❧</span> Scellée jusqu’à la fin du compte à rebours.</p>' +
            '<div class="countdown">' +
              unitHtml("jours") + unitHtml("heures") + unitHtml("minutes") + unitHtml("secondes") +
            '</div>' +
            '<div class="progress"><div class="bar" style="width:0%"></div></div>' +
            '<div class="progress-label"><span class="pct">0%</span><span class="left"></span></div>'
        ) +
      '</div>' +
      '<div class="cap-actions">' +
        (unlocked ? '<button type="button" class="icon-btn" data-act="copy">Copier le texte</button>' : "") +
        '<button type="button" class="icon-btn danger" data-act="delete">Supprimer</button>' +
      '</div>';

    card.addEventListener("click", function (evt) {
      var btn = evt.target.closest("[data-act]");
      if (!btn) return;
      if (btn.dataset.act === "delete") deleteCapsule(c.id);
      if (btn.dataset.act === "copy") copyMessage(c);
    });

    cardRefs[c.id] = {
      root: card,
      values: $$(".unit b", card),
      units: $$(".unit", card),
      bar: $(".bar", card),
      pct: $(".pct", card),
      left: $(".left", card),
      prev: [null, null, null, null]
    };
    return card;
  }

  function unitHtml(label) {
    return '<div class="unit"><b>00</b><span>' + label + '</span></div>';
  }

  function render() {
    cardRefs = {};
    listEl.innerHTML = "";
    var items = visibleCapsules();

    items.forEach(function (c, i) {
      var card = buildCard(c);
      card.style.animationDelay = Math.min(i * 55, 400) + "ms";
      listEl.appendChild(card);
    });

    emptyEl.hidden = items.length > 0;
    if (items.length === 0 && capsules.length > 0) {
      emptyEl.querySelector("p").textContent = "Aucune lettre ne correspond à ce filtre.";
    } else {
      emptyEl.querySelector("p").textContent =
        "Rien de scellé pour l’instant. Votre première lettre vers l’avenir n’attend qu’un formulaire.";
    }

    updateStats();
    tick();
  }

  function updateStats() {
    var total = capsules.length;
    if (!total) { statLine.textContent = "Aucune lettre pour l’instant."; return; }
    var open = capsules.filter(isUnlocked).length;
    var waiting = total - open;
    statLine.textContent = total + (total === 1 ? " lettre" : " lettres") +
      " · " + waiting + " en attente · " + open + " à lire";
  }

  /* ---------------- Ticker ---------------- */
  function tick() {
    var now = Date.now();
    var justUnlocked = [];

    capsules.forEach(function (c) {
      var ref = cardRefs[c.id];
      var remaining = c.unlockAt - now;

      if (remaining <= 0) {
        if (!c.announced) {
          c.announced = true;
          justUnlocked.push(c);
        }
        return;
      }
      if (!ref || !ref.bar) return;   // unlocked card, or filtered out

      var b = breakdown(remaining);
      var vals = [b.days, pad(b.hours), pad(b.minutes), pad(b.seconds)];
      vals.forEach(function (v, i) {
        var text = String(v);
        if (ref.prev[i] !== text) {
          ref.prev[i] = text;
          ref.values[i].textContent = text;
          var unit = ref.units[i];
          unit.classList.remove("pulse");
          void unit.offsetWidth;
          unit.classList.add("pulse");
        }
      });

      var span = c.unlockAt - (c.createdAt || c.unlockAt - 86400000);
      var pct = span > 0 ? Math.min(100, Math.max(0, ((now - (c.unlockAt - span)) / span) * 100)) : 0;
      ref.bar.style.width = pct.toFixed(2) + "%";
      ref.pct.textContent = pct.toFixed(1).replace(".", ",") + "\u00a0% de l’attente écoulés";
      ref.left.textContent = b.days > 0
        ? b.days + (b.days === 1 ? " jour restant" : " jours restants")
        : "ouverture aujourd’hui";
    });

    if (justUnlocked.length) {
      save();
      render();
      justUnlocked.forEach(function (c) { revealQueue.push(c); });
      drainRevealQueue();
    }
  }

  /* ---------------- Reveal overlay ---------------- */
  function drainRevealQueue() {
    if (overlayOpen || !revealQueue.length) return;
    var c = revealQueue.shift();
    overlayOpen = true;
    overlayMeta.textContent = "De " + c.name + " · scellée le " + formatDate(c.createdAt || c.unlockAt);
    overlayBody.textContent = c.message;
    overlay.hidden = false;
    burstConfetti();
    $("#closeReveal").focus();
  }

  function closeOverlay() {
    overlay.hidden = true;
    overlayOpen = false;
    confettiEl.innerHTML = "";
    setTimeout(drainRevealQueue, 250);
  }

  $("#closeReveal").addEventListener("click", closeOverlay);
  overlay.addEventListener("click", function (e) { if (e.target === overlay) closeOverlay(); });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && overlayOpen) closeOverlay();
  });

  function burstConfetti() {
    var colors = ["#8c2f26", "#b08d57", "#5f7a6b", "#6e2019", "#f8f2e7"];
    var frag = document.createDocumentFragment();
    for (var i = 0; i < 40; i++) {
      var p = document.createElement("i");
      p.style.left = Math.random() * 100 + "%";
      p.style.background = colors[i % colors.length];
      p.style.animationDuration = (1.8 + Math.random() * 1.6).toFixed(2) + "s";
      p.style.animationDelay = (Math.random() * 0.5).toFixed(2) + "s";
      frag.appendChild(p);
    }
    confettiEl.innerHTML = "";
    confettiEl.appendChild(frag);
  }

  /* ---------------- Card actions ---------------- */
  function deleteCapsule(id) {
    var c = capsules.find(function (x) { return x.id === id; });
    if (!c) return;
    var label = isUnlocked(c) ? "Supprimer cette lettre déjà ouverte\u00a0?" : "Cette lettre est encore scellée. La supprimer quand même\u00a0?";
    if (!window.confirm(label)) return;

    var ref = cardRefs[id];
    capsules = capsules.filter(function (x) { return x.id !== id; });
    save();

    if (ref && ref.root) {
      ref.root.classList.add("removing");
      setTimeout(function () { render(); }, 320);
    } else {
      render();
    }
    toast("Lettre supprimée.");
  }

  function copyMessage(c) {
    var done = function () { toast("Lettre copiée dans le presse-papiers."); };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(c.message).then(done, fallback);
    } else {
      fallback();
    }
    function fallback() {
      var ta = document.createElement("textarea");
      ta.value = c.message;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand("copy"); done(); }
      catch (err) { toast("Échec de la copie — sélectionnez le texte manuellement."); }
      document.body.removeChild(ta);
    }
  }

  /* ---------------- Boot ---------------- */
  initTheme();
  showQuote();
  setMinDate();
  capsules = load();

  // Capsules that unlocked while the page was closed are already marked as
  // announced so the overlay only celebrates unlocks that happen live.
  capsules.forEach(function (c) {
    if (isUnlocked(c) && !c.announced) c.announced = true;
  });
  save();

  render();
  setInterval(tick, 1000);
  setInterval(setMinDate, 30000);

  // Keep multiple tabs in sync.
  window.addEventListener("storage", function (e) {
    if (e.key === STORAGE_KEY) { capsules = load(); render(); }
    if (e.key === THEME_KEY && e.newValue) applyTheme(e.newValue);
  });
})();
