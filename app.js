(function () {
  'use strict';

  // ---------- Built-in content ----------
  // Each moment has statements in three tones. Mood decides which tone is used:
  // rough -> gentle, okay -> steady, good -> bright.
  var MOMENTS = [
    { id: 'morning', name: 'Morning' },
    { id: 'hard', name: 'Before a hard task' },
    { id: 'setback', name: 'After a setback' },
    { id: 'night', name: 'Winding down at night' }
  ];

  var MOOD_TONE = { rough: 'gentle', okay: 'steady', good: 'bright' };

  var MOOD_NOTE = {
    rough: "Thanks for being honest. We'll keep things gentle today.",
    okay: 'Okay is a perfectly fine place to start.',
    good: "Good. Let's put that to use."
  };

  var BUILT_IN = {
    morning: {
      gentle: [
        "I don't have to feel ready to begin.",
        'Today can be a slow day and still count.',
        'I only need to handle the next hour.',
        'I can be tired and still be kind to myself.'
      ],
      steady: [
        "I don't have to feel motivated to take one small step.",
        'I can be uncertain and still move forward.',
        'One clear priority is enough for today.',
        'I can start small and adjust as I go.'
      ],
      bright: [
        'I have energy today, and I can use it well.',
        "I can build on what's already working.",
        "Today is a good day to try something I've been putting off.",
        'I trust myself to make good choices today.'
      ]
    },
    hard: {
      gentle: [
        'I can feel anxious and still do this.',
        'Doing it imperfectly is still doing it.',
        'I can take a break and come back to this.',
        'Asking for help is a reasonable thing to do.'
      ],
      steady: [
        'I have handled difficult things before.',
        'I only need to focus on the first step.',
        'Hard is not the same as impossible.',
        'I can figure this out one piece at a time.'
      ],
      bright: [
        "I'm prepared enough to begin.",
        'Feeling pressure means this matters to me.',
        "I've done the work, and I can trust it.",
        'I can meet this with focus and curiosity.'
      ]
    },
    setback: {
      gentle: [
        "A difficult day doesn't erase the progress I've made.",
        "It's okay to be disappointed. It will pass.",
        "I don't have to fix everything right now.",
        "One bad moment doesn't define me."
      ],
      steady: [
        'Mistakes are information, not a verdict.',
        'I can take what I learned and try again.',
        'Setbacks are part of doing things that matter.',
        "I've recovered from setbacks before."
      ],
      bright: [
        "I'm steady enough to look at this honestly.",
        'This can make my next attempt better.',
        'This is one moment among many.',
        'I still have what it takes to move forward.'
      ]
    },
    night: {
      gentle: [
        "Rest is allowed, even when everything isn't finished.",
        "I made it through today. That's enough.",
        'I can set today down for now.',
        'Tomorrow I can start again.'
      ],
      steady: [
        'I did what I could with what I had today.',
        'Unfinished tasks can wait until tomorrow.',
        'I can let my mind slow down now.',
        'Today had good parts, even if they were small.'
      ],
      bright: [
        'I can feel good about what I did today.',
        'I can enjoy this calm without rushing to the next thing.',
        'Something went right today, and I noticed it.',
        "I'm ending today in a good place."
      ]
    }
  };

  // ---------- Storage ----------
  var KEYS = { evidence: 'ma.evidence', custom: 'ma.custom', history: 'ma.history' };

  function load(key) {
    try {
      var v = JSON.parse(localStorage.getItem(key));
      return Array.isArray(v) ? v : [];
    } catch (e) {
      return [];
    }
  }

  function save(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
      alert("Couldn't save. Your browser may be blocking storage (private mode?).");
    }
  }

  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  // ---------- Local dates ----------
  function pad(n) { return (n < 10 ? '0' : '') + n; }

  function dateKey(d) {
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }

  function parseKey(key) {
    var p = key.split('-');
    return new Date(+p[0], +p[1] - 1, +p[2]);
  }

  function addDays(d, n) {
    return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
  }

  function formatDate(key) {
    return parseKey(key).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  }

  function todayKey() { return dateKey(new Date()); }

  // ---------- Streak ----------
  function currentStreak() {
    var done = {};
    load(KEYS.history).forEach(function (k) { done[k] = true; });
    var day = new Date();
    // A streak stays alive until the end of today even if today isn't done yet.
    if (!done[dateKey(day)]) day = addDays(day, -1);
    var count = 0;
    while (done[dateKey(day)]) {
      count++;
      day = addDays(day, -1);
    }
    return count;
  }

  function completeToday() {
    var history = load(KEYS.history);
    var key = todayKey();
    var already = history.indexOf(key) !== -1;
    if (!already) {
      history.push(key);
      save(KEYS.history, history);
    }
    return already;
  }

  function streakText(n) {
    return n === 1 ? '1-day streak' : n + '-day streak';
  }

  // ---------- Helpers ----------
  function $(id) { return document.getElementById(id); }

  function el(tag, attrs, text) {
    var node = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) { node.setAttribute(k, attrs[k]); });
    if (text != null) node.textContent = text;
    return node;
  }

  function shuffle(arr) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  function momentName(id) {
    for (var i = 0; i < MOMENTS.length; i++) if (MOMENTS[i].id === id) return MOMENTS[i].name;
    return '';
  }

  function momentForNow() {
    var h = new Date().getHours();
    if (h >= 4 && h < 12) return 'morning';
    if (h >= 20 || h < 4) return 'night';
    return 'hard';
  }

  function customFor(moment) {
    return load(KEYS.custom).filter(function (a) { return a.moment === moment; });
  }

  // ---------- Home ----------
  function renderHome() {
    var now = new Date();
    $('home-date').textContent = now.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });

    // Same built-in statement all day, chosen from the local date.
    var all = [];
    MOMENTS.forEach(function (m) {
      ['steady', 'gentle', 'bright'].forEach(function (t) { all = all.concat(BUILT_IN[m.id][t]); });
    });
    var dayNumber = Math.floor(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) / 86400000);
    var index = (dayNumber * 7) % all.length;
    $('daily-affirmation').textContent = all[index];

    var streak = currentStreak();
    var doneToday = load(KEYS.history).indexOf(todayKey()) !== -1;
    var text;
    if (streak === 0) text = 'No current streak. Today is a fine day to start.';
    else if (doneToday) text = streakText(streak) + ' · done today ✓';
    else text = streakText(streak) + ' · keep it going today';
    $('home-streak').textContent = text;
  }

  // ---------- Routine ----------
  var routine = { mood: null, moment: null, queue: [], current: null };

  function showStep(n) {
    document.querySelectorAll('#view-routine .step').forEach(function (s) {
      s.hidden = s.getAttribute('data-step') !== String(n);
    });
    var title = document.querySelector('#view-routine .step:not([hidden]) .step-title');
    if (title) title.focus();
    window.scrollTo(0, 0);
  }

  function startRoutine() {
    routine = { mood: null, moment: momentForNow(), queue: [], current: null };
    showStep(1);
  }

  function chooseMood(mood) {
    routine.mood = mood;
    $('mood-note').textContent = MOOD_NOTE[mood];
    renderRecall();
    showStep(2);
  }

  function renderRecall() {
    var list = $('evidence-recall');
    list.innerHTML = '';
    var entries = load(KEYS.evidence);
    $('evidence-empty').hidden = entries.length > 0;
    $('evidence-continue').textContent = entries.length ? 'Continue' : 'Continue without one';
    shuffle(entries).slice(0, 3).forEach(function (e) {
      var li = el('li');
      li.appendChild(el('span', null, e.text));
      li.appendChild(el('span', { 'class': 'date' }, formatDate(e.date)));
      list.appendChild(li);
    });
  }

  function buildQueue() {
    var tone = MOOD_TONE[routine.mood] || 'steady';
    var pool = BUILT_IN[routine.moment][tone].concat(
      customFor(routine.moment).map(function (a) { return a.text; })
    );
    var q = shuffle(pool);
    // Avoid showing the same statement twice in a row when the queue refills.
    if (q.length > 1 && q[0] === routine.current) q.push(q.shift());
    routine.queue = q;
  }

  function nextAffirmation() {
    if (!routine.queue.length) buildQueue();
    routine.current = routine.queue.shift();
    $('routine-affirmation').textContent = routine.current;
  }

  function renderMomentPicker() {
    var wrap = $('routine-moments');
    wrap.innerHTML = '';
    MOMENTS.forEach(function (m) {
      var b = el('button', { type: 'button', 'aria-pressed': String(m.id === routine.moment) }, m.name);
      b.addEventListener('click', function () {
        routine.moment = m.id;
        routine.queue = [];
        renderMomentPicker();
        nextAffirmation();
      });
      wrap.appendChild(b);
    });
  }

  function goToAffirmation() {
    routine.queue = [];
    renderMomentPicker();
    nextAffirmation();
    showStep(3);
  }

  function finishRoutine() {
    var already = completeToday();
    var streak = currentStreak();
    $('done-message').textContent = already
      ? "You'd already checked in today, so your streak stays the same. Coming back is still worth it."
      : 'Nice work taking a few minutes for yourself.';
    $('done-streak').textContent = streakText(streak);
    showStep(4);
  }

  // ---------- Evidence Bank ----------
  function addEvidence(text) {
    text = text.trim();
    if (!text) return false;
    var entries = load(KEYS.evidence);
    entries.push({ id: uid(), text: text, date: todayKey(), created: Date.now() });
    save(KEYS.evidence, entries);
    return true;
  }

  function renderEvidence() {
    var list = $('evidence-list');
    list.innerHTML = '';
    var entries = load(KEYS.evidence).sort(function (a, b) {
      if (a.date !== b.date) return a.date < b.date ? 1 : -1;
      return (b.created || 0) - (a.created || 0);
    });
    $('evidence-list-empty').hidden = entries.length > 0;
    entries.forEach(function (e) {
      var li = el('li');
      var body = el('div', { 'class': 'entry-text' }, e.text);
      body.appendChild(el('span', { 'class': 'entry-meta' }, formatDate(e.date)));
      var actions = el('div', { 'class': 'entry-actions' });
      var del = el('button', { type: 'button', 'class': 'btn-text danger', 'aria-label': 'Delete: ' + e.text }, 'Delete');
      del.addEventListener('click', function () {
        if (!confirm('Delete this entry? This can\'t be undone.')) return;
        save(KEYS.evidence, load(KEYS.evidence).filter(function (x) { return x.id !== e.id; }));
        renderEvidence();
      });
      actions.appendChild(del);
      li.appendChild(body);
      li.appendChild(actions);
      list.appendChild(li);
    });
  }

  // ---------- Affirmations library ----------
  var libraryMoment = 'morning';
  var editingId = null;

  function renderLibraryTabs() {
    var wrap = $('library-tabs');
    wrap.innerHTML = '';
    MOMENTS.forEach(function (m) {
      var b = el('button', { type: 'button', role: 'tab', 'aria-selected': String(m.id === libraryMoment) }, m.name);
      b.addEventListener('click', function () {
        libraryMoment = m.id;
        renderLibrary();
      });
      wrap.appendChild(b);
    });
  }

  function renderLibrary() {
    renderLibraryTabs();
    var list = $('library-list');
    list.innerHTML = '';

    var custom = customFor(libraryMoment);
    custom.forEach(function (a) {
      var li = el('li');
      var body = el('div', { 'class': 'entry-text' }, a.text);
      body.appendChild(el('span', { 'class': 'entry-meta' }, 'Yours'));
      var actions = el('div', { 'class': 'entry-actions' });
      var edit = el('button', { type: 'button', 'class': 'btn-text', 'aria-label': 'Edit: ' + a.text }, 'Edit');
      edit.addEventListener('click', function () { startEdit(a); });
      var del = el('button', { type: 'button', 'class': 'btn-text danger', 'aria-label': 'Delete: ' + a.text }, 'Delete');
      del.addEventListener('click', function () {
        if (!confirm('Delete this affirmation?')) return;
        save(KEYS.custom, load(KEYS.custom).filter(function (x) { return x.id !== a.id; }));
        if (editingId === a.id) resetCustomForm();
        renderLibrary();
      });
      actions.appendChild(edit);
      actions.appendChild(del);
      li.appendChild(body);
      li.appendChild(actions);
      list.appendChild(li);
    });

    ['gentle', 'steady', 'bright'].forEach(function (tone) {
      BUILT_IN[libraryMoment][tone].forEach(function (text) {
        var li = el('li');
        li.appendChild(el('div', { 'class': 'entry-text' }, text));
        list.appendChild(li);
      });
    });
  }

  function fillMomentSelect() {
    var sel = $('custom-moment');
    MOMENTS.forEach(function (m) {
      sel.appendChild(el('option', { value: m.id }, m.name));
    });
  }

  function startEdit(a) {
    editingId = a.id;
    $('custom-text').value = a.text;
    $('custom-moment').value = a.moment;
    $('custom-form-label').textContent = 'Edit your affirmation';
    $('custom-submit').textContent = 'Save changes';
    $('custom-cancel').hidden = false;
    $('custom-text').focus();
    window.scrollTo(0, 0);
  }

  function resetCustomForm() {
    editingId = null;
    $('custom-text').value = '';
    $('custom-moment').value = libraryMoment;
    $('custom-form-label').textContent = 'Write your own';
    $('custom-submit').textContent = 'Add';
    $('custom-cancel').hidden = true;
  }

  function submitCustom(ev) {
    ev.preventDefault();
    var text = $('custom-text').value.trim();
    var moment = $('custom-moment').value;
    if (!text) return;
    var all = load(KEYS.custom);
    if (editingId) {
      all.forEach(function (a) {
        if (a.id === editingId) { a.text = text; a.moment = moment; }
      });
    } else {
      all.push({ id: uid(), text: text, moment: moment });
    }
    save(KEYS.custom, all);
    libraryMoment = moment;
    resetCustomForm();
    renderLibrary();
  }

  // ---------- Routing ----------
  var VIEWS = ['home', 'routine', 'evidence', 'affirmations'];

  function route() {
    var name = location.hash.replace('#', '');
    if (VIEWS.indexOf(name) === -1) name = 'home';
    VIEWS.forEach(function (v) { $('view-' + v).hidden = v !== name; });
    document.querySelectorAll('.tabbar a').forEach(function (a) {
      if (a.getAttribute('data-nav') === name) a.setAttribute('aria-current', 'page');
      else a.removeAttribute('aria-current');
    });

    if (name === 'home') renderHome();
    if (name === 'routine') startRoutine();
    if (name === 'evidence') renderEvidence();
    if (name === 'affirmations') { resetCustomForm(); renderLibrary(); }

    if (name !== 'routine') {
      window.scrollTo(0, 0);
      var heading = document.querySelector('#view-' + name + ' h1[tabindex]');
      if (heading && location.hash) heading.focus();
    }
  }

  // ---------- Wire up ----------
  document.querySelectorAll('[data-mood]').forEach(function (b) {
    b.addEventListener('click', function () { chooseMood(b.getAttribute('data-mood')); });
  });

  document.querySelectorAll('[data-back]').forEach(function (b) {
    b.addEventListener('click', function () { showStep(+b.getAttribute('data-back')); });
  });

  $('evidence-continue').addEventListener('click', goToAffirmation);
  $('next-affirmation').addEventListener('click', nextAffirmation);
  $('complete-routine').addEventListener('click', finishRoutine);

  $('routine-evidence-form').addEventListener('submit', function (ev) {
    ev.preventDefault();
    if (addEvidence($('routine-evidence-text').value)) {
      $('routine-evidence-text').value = '';
      renderRecall();
    }
  });

  $('evidence-form').addEventListener('submit', function (ev) {
    ev.preventDefault();
    if (addEvidence($('evidence-text').value)) {
      $('evidence-text').value = '';
      renderEvidence();
    }
  });

  fillMomentSelect();
  $('custom-form').addEventListener('submit', submitCustom);
  $('custom-cancel').addEventListener('click', resetCustomForm);

  window.addEventListener('hashchange', route);
  route();
})();
