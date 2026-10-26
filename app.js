(function () {
  'use strict';

  var C = window.GWContent;
  var E = window.GWEngine;

  var MOOD_NOTE = {
    rough: "Thanks for being honest. We'll keep things gentle today.",
    okay: 'Okay is a perfectly fine place to start.',
    good: "Good. Let's put that to use."
  };

  // ---------- Storage ----------
  // v1 used ma.evidence, ma.custom and ma.history. v2 keeps those keys and shapes (new fields are optional)
  // and adds the rest, so existing data carries over untouched.
  var KEYS = {
    evidence: 'ma.evidence', custom: 'ma.custom', history: 'ma.history',
    prefs: 'ma.prefs', feedback: 'ma.feedback', seen: 'ma.seen',
    daily: 'ma.daily', schema: 'ma.schema', backup: 'ma.backup.v1'
  };
  var STATE_PARTS = ['evidence', 'custom', 'history', 'prefs', 'feedback', 'seen'];

  function readRaw(key) {
    try { return localStorage.getItem(key); } catch (e) { return null; }
  }
  function readJSON(key) {
    try { return JSON.parse(readRaw(key)); } catch (e) { return null; }
  }
  function writeJSON(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (e) {
      alert("Couldn't save. Your browser may be blocking storage (private mode?).");
      return false;
    }
  }

  function loadState() {
    var schema = readJSON(KEYS.schema);
    // First run of v2 on top of v1 data: keep an untouched copy of the old values, just in case.
    if (schema !== E.SCHEMA && readRaw(KEYS.backup) === null) {
      var old = { evidence: readRaw(KEYS.evidence), custom: readRaw(KEYS.custom), history: readRaw(KEYS.history) };
      if (old.evidence || old.custom || old.history) {
        try { localStorage.setItem(KEYS.backup, JSON.stringify({ savedAt: new Date().toISOString(), data: old })); } catch (e) { /* storage full or blocked */ }
      }
    }
    var raw = {};
    STATE_PARTS.forEach(function (k) { raw[k] = readJSON(KEYS[k]); });
    var s = E.normalizeState(raw).state;
    if (schema !== E.SCHEMA) {
      try { localStorage.setItem(KEYS.schema, JSON.stringify(E.SCHEMA)); } catch (e) { /* ignore */ }
    }
    return s;
  }

  var state = loadState();

  function persist(part) { writeJSON(KEYS[part], state[part]); }
  function persistAll() { STATE_PARTS.forEach(persist); }

  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }

  // ---------- Small helpers ----------
  function $(id) { return document.getElementById(id); }
  function el(tag, attrs, text) {
    var node = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) { node.setAttribute(k, attrs[k]); });
    if (text != null) node.textContent = text;
    return node;
  }
  function todayKey() { return E.dateKey(new Date()); }
  function formatDate(key) {
    return E.parseKey(key).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  }
  function focusName(id) {
    for (var i = 0; i < C.FOCUS_AREAS.length; i++) if (C.FOCUS_AREAS[i].id === id) return C.FOCUS_AREAS[i].name;
    return '';
  }
  function moment(id) {
    for (var i = 0; i < C.MOMENTS.length; i++) if (C.MOMENTS[i].id === id) return C.MOMENTS[i];
    return null;
  }
  function momentForNow() {
    var h = new Date().getHours();
    if (h >= 4 && h < 12) return 'morning';
    if (h >= 20 || h < 4) return 'night';
    return 'hard';
  }
  function streakText(n) { return n === 1 ? '1-day streak' : n + '-day streak'; }
  function setStatus(id, text) {
    var node = $(id);
    node.textContent = '';
    // Re-set on the next frame so screen readers announce repeated messages too.
    requestAnimationFrame(function () { node.textContent = text; });
  }

  function pool() {
    return C.AFFIRMATIONS.concat(state.custom.map(function (c) {
      return { id: c.id, text: c.text, moments: [c.moment], focus: [], tone: null, custom: true };
    }));
  }
  function findAffirmation(id) {
    var p = pool();
    for (var i = 0; i < p.length; i++) if (p[i].id === id) return p[i];
    return null;
  }

  function isFav(id) { return state.feedback.favorites.indexOf(id) !== -1; }
  function isHidden(id) { return state.feedback.hidden.indexOf(id) !== -1; }
  function toggleIn(list, id) {
    var i = list.indexOf(id);
    if (i === -1) list.push(id); else list.splice(i, 1);
    return i === -1;
  }

  // ---------- Focus chips (used on Home and in Settings) ----------
  function renderFocusChips(container, selected, onChange) {
    container.innerHTML = '';
    var full = selected.length >= E.MAX_FOCUS;
    C.FOCUS_AREAS.forEach(function (f) {
      var on = selected.indexOf(f.id) !== -1;
      var b = el('button', { type: 'button', 'class': 'chip', 'aria-pressed': String(on) }, f.name);
      if (full && !on) b.disabled = true;
      b.addEventListener('click', function () {
        toggleIn(selected, f.id);
        renderFocusChips(container, selected, onChange);
        if (onChange) onChange(selected);
        var again = container.querySelectorAll('.chip');
        for (var i = 0; i < again.length; i++) if (again[i].textContent === f.name) again[i].focus();
      });
      container.appendChild(b);
    });
  }

  function fillFocusSelect(sel, preferred) {
    sel.innerHTML = '';
    sel.appendChild(el('option', { value: '' }, 'General'));
    var mine = state.prefs.focus;
    var ordered = mine.concat(E.FOCUS_IDS.filter(function (f) { return mine.indexOf(f) === -1; }));
    ordered.forEach(function (id) { sel.appendChild(el('option', { value: id }, focusName(id))); });
    sel.value = preferred != null ? preferred : (mine[0] || '');
  }

  function promptFor(focusId) { return C.EVIDENCE_PROMPTS[focusId || 'general'] || C.EVIDENCE_PROMPTS.general; }

  // ---------- Home ----------
  function dailyAffirmation() {
    var today = todayKey();
    var saved = readJSON(KEYS.daily);
    if (saved && saved.date === today) {
      var item = findAffirmation(saved.id);
      if (item && !isHidden(item.id)) return item;
    }
    var recent = saved && Array.isArray(saved.recent) ? saved.recent.slice(-7) : [];
    var pick = E.dailyPick(pool(), { focus: state.prefs.focus, feedback: state.feedback, recentDaily: recent }, today);
    if (pick) {
      if (recent.indexOf(pick.id) === -1) recent.push(pick.id);
      writeJSON(KEYS.daily, { date: today, id: pick.id, recent: recent.slice(-7) });
      state.seen[pick.id] = today;
      persist('seen');
    }
    return pick;
  }

  var onboardPick = [];

  function renderHome() {
    var now = new Date();
    $('home-date').textContent = now.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
    var daily = dailyAffirmation();
    $('daily-affirmation').textContent = daily ? daily.text : "I don't have to feel ready to begin.";

    var streak = E.currentStreak(state.history);
    var doneToday = state.history.indexOf(todayKey()) !== -1;
    var pill = $('home-streak');
    var label;
    if (streak === 0) {
      pill.textContent = 'Start a streak';
      label = 'No current streak. Today is a fine day to start.';
    } else if (doneToday) {
      pill.textContent = streakText(streak) + ' ✓';
      label = streakText(streak) + ', done today.';
    } else {
      pill.textContent = streakText(streak);
      label = streakText(streak) + '. Not done yet today.';
    }
    pill.classList.toggle('is-empty', streak === 0);
    pill.setAttribute('title', label);

    $('home-sub').textContent = doneToday
      ? "You've done today's routine. Coming back is always allowed."
      : 'About a minute: how you feel, your evidence, one statement.';

    var showOnboard = !state.prefs.onboarded;
    $('onboard').hidden = !showOnboard;
    if (showOnboard) {
      onboardPick = state.prefs.focus.slice();
      renderFocusChips($('onboard-chips'), onboardPick);
    }
  }

  // ---------- Routine ----------
  var routine;

  function resetRoutine() {
    routine = {
      mood: null, moment: momentForNow(), queue: [], shown: [], current: null,
      recalled: [], helpfulMarked: {}, actionId: null
    };
  }

  function showStep(n) {
    document.querySelectorAll('#view-routine .step').forEach(function (s) {
      s.hidden = s.getAttribute('data-step') !== String(n);
    });
    var title = document.querySelector('#view-routine .step:not([hidden]) .step-title');
    if (title) title.focus({ preventScroll: true });
    window.scrollTo(0, 0);
  }

  function startRoutine() {
    resetRoutine();
    var f = state.prefs.focus;
    var line = $('focus-line');
    line.innerHTML = '';
    line.appendChild(document.createTextNode(f.length ? 'Focus: ' + f.map(focusName).join(', ') + ' · ' : 'No focus areas chosen · '));
    line.appendChild(el('a', { href: '#settings' }, f.length ? 'Change' : 'Choose'));
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
    var picked = E.pickEvidence(state.evidence, state.prefs.focus, 3);
    routine.recalled = picked.map(function (e) { return e.id; });
    $('evidence-empty').hidden = state.evidence.length > 0;
    $('routine-evidence-text').placeholder = promptFor(state.prefs.focus[0]);
    $('evidence-continue').textContent = state.evidence.length ? 'Continue' : 'Continue without one';
    picked.forEach(function (e) {
      var li = el('li');
      li.appendChild(el('span', null, e.text));
      var meta = formatDate(e.date) + (e.focus ? ' · ' + focusName(e.focus) : '');
      li.appendChild(el('span', { 'class': 'date' }, meta));
      list.appendChild(li);
    });
  }

  function ctx() {
    return {
      mood: routine.mood, moment: routine.moment, focus: state.prefs.focus,
      feedback: state.feedback, seen: state.seen, today: todayKey()
    };
  }

  function buildQueue() {
    var c = ctx();
    // Don't repeat anything from this session until everything that fits has been seen.
    c.exclude = routine.shown.slice();
    var q = E.rankAffirmations(pool(), c);
    if (!q.length) {
      c.exclude = routine.current ? [routine.current.baseId || routine.current.id] : [];
      routine.shown = [];
      q = E.rankAffirmations(pool(), c);
    }
    routine.queue = q;
  }

  function showAffirmation(item) {
    routine.current = item;
    var baseId = item.baseId || item.id;
    if (routine.shown.indexOf(baseId) === -1) routine.shown.push(baseId);
    state.seen[baseId] = todayKey();
    persist('seen');

    var box = $('routine-affirmation');
    box.textContent = item.text;
    box.classList.remove('fade-in');
    void box.offsetWidth;
    box.classList.add('fade-in');

    var proof = E.proofFor(item, state.evidence, state.prefs.focus);
    $('proof').hidden = !proof;
    if (proof) $('proof-text').textContent = '“' + proof.text + '” · ' + formatDate(proof.date);

    $('fb-fav').setAttribute('aria-pressed', String(isFav(baseId)));
    $('fb-fav').querySelector('span').textContent = isFav(baseId) ? 'Saved' : 'Save';
    $('fb-helpful').setAttribute('aria-pressed', String(!!routine.helpfulMarked[baseId]));
    $('fb-unbelievable').hidden = false;
    $('fb-status').textContent = '';
  }

  function nextAffirmation() {
    // The queue can go stale (an alternative was shown directly, or something was hidden), so skip those.
    var item;
    for (var tries = 0; tries < 2 && !item; tries++) {
      if (!routine.queue.length) buildQueue();
      while (routine.queue.length && !item) {
        var cand = routine.queue.shift();
        if (routine.shown.indexOf(cand.id) === -1 && !isHidden(cand.id)) item = cand;
      }
    }
    if (item) showAffirmation(item);
  }

  function renderMomentPicker() {
    var wrap = $('routine-moments');
    wrap.innerHTML = '';
    C.MOMENTS.forEach(function (m) {
      var b = el('button', { type: 'button', 'aria-pressed': String(m.id === routine.moment), 'aria-label': m.name }, m.short);
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

  function currentBaseId() { return routine.current.baseId || routine.current.id; }

  function onFavorite() {
    var id = currentBaseId();
    var added = toggleIn(state.feedback.favorites, id);
    persist('feedback');
    $('fb-fav').setAttribute('aria-pressed', String(added));
    $('fb-fav').querySelector('span').textContent = added ? 'Saved' : 'Save';
    setStatus('fb-status', added ? 'Saved. Find it under Affirmations › Saved.' : 'Removed from saved.');
  }

  function onHelpful() {
    var id = currentBaseId();
    var h = state.feedback.helpful;
    if (routine.helpfulMarked[id]) {
      routine.helpfulMarked[id] = false;
      h[id] = (h[id] || 1) - 1;
      if (h[id] <= 0) delete h[id];
    } else {
      routine.helpfulMarked[id] = true;
      h[id] = (h[id] || 0) + 1;
    }
    persist('feedback');
    $('fb-helpful').setAttribute('aria-pressed', String(!!routine.helpfulMarked[id]));
    setStatus('fb-status', routine.helpfulMarked[id] ? "Noted. You'll see this one a bit more often." : 'Okay, unmarked.');
  }

  function onHide() {
    var id = currentBaseId();
    if (!isHidden(id)) state.feedback.hidden.push(id);
    persist('feedback');
    nextAffirmation();
    setStatus('fb-status', "Hidden. It won't come up again. You can bring it back in Settings.");
  }

  function onUnbelievable() {
    var item = routine.current;
    var id = currentBaseId();
    var u = state.feedback.unbelievable;
    u[id] = (u[id] || 0) + 1;
    persist('feedback');
    var c = ctx();
    c.exclude = routine.shown.slice();
    var alt = E.believableAlternative(item, pool(), c);
    if (alt) {
      showAffirmation(alt);
      setStatus('fb-status', alt.isSofter ? "Here's a smaller version of it." : "Here's a more grounded one.");
    } else {
      setStatus('fb-status', "Noted. You'll see that one less.");
    }
  }

  function finishRoutine() {
    var key = todayKey();
    var already = state.history.indexOf(key) !== -1;
    if (!already) {
      state.history.push(key);
      state.history.sort();
      persist('history');
    }
    var streak = E.currentStreak(state.history);
    $('done-message').textContent = already
      ? "You'd already checked in today, so your streak stays the same. Coming back is still worth it."
      : 'That was a minute well spent.';
    $('done-streak').textContent = streakText(streak);

    routine.actionId = null;
    $('action-card').hidden = !state.prefs.showActions;
    if (state.prefs.showActions) showAction();

    fillFocusSelect($('done-evidence-focus'));
    $('done-evidence').open = false;
    $('done-status').textContent = '';
    showStep(4);
  }

  function showAction() {
    var a = E.pickAction(C.ACTIONS, state.prefs.focus, routine.moment, Math.random, routine.actionId);
    routine.actionId = a ? a.id : null;
    $('action-text').textContent = a ? a.text : '';
    var t = $('action-text');
    t.classList.remove('fade-in');
    void t.offsetWidth;
    t.classList.add('fade-in');
  }

  // ---------- Evidence Bank ----------
  function addEvidence(text, focus) {
    text = text.trim();
    if (!text) return false;
    state.evidence.push({ id: uid(), text: text, date: todayKey(), created: Date.now(), focus: focus || '' });
    persist('evidence');
    return true;
  }

  var evidenceFilter = 'all';

  function renderEvidence() {
    var entries = state.evidence.slice().sort(function (a, b) {
      if (a.date !== b.date) return a.date < b.date ? 1 : -1;
      return (b.created || 0) - (a.created || 0);
    });

    var n = entries.length;
    $('evidence-count').textContent = n ? (n === 1 ? '1 piece of evidence saved.' : n + ' pieces of evidence saved.') : '';

    // Filter chips only earn their space once entries span more than one category.
    var used = {};
    entries.forEach(function (e) { used[e.focus || ''] = true; });
    var cats = Object.keys(used);
    var filterWrap = $('evidence-filter');
    filterWrap.innerHTML = '';
    filterWrap.hidden = cats.length < 2;
    if (cats.length < 2) evidenceFilter = 'all';
    if (cats.length >= 2) {
      var opts = [['all', 'All']].concat(cats.sort().map(function (c) { return [c, c ? focusName(c) : 'General']; }));
      opts.forEach(function (o) {
        var b = el('button', { type: 'button', 'class': 'chip', 'aria-pressed': String(evidenceFilter === o[0]) }, o[1]);
        b.addEventListener('click', function () { evidenceFilter = o[0]; renderEvidence(); });
        filterWrap.appendChild(b);
      });
    }

    var shown = entries.filter(function (e) { return evidenceFilter === 'all' || (e.focus || '') === evidenceFilter; });
    var list = $('evidence-list');
    list.innerHTML = '';
    $('evidence-list-empty').hidden = n > 0;
    shown.forEach(function (e) {
      var li = el('li');
      var body = el('div', { 'class': 'entry-text' }, e.text);
      var meta = el('span', { 'class': 'entry-meta' }, formatDate(e.date));
      if (e.focus) meta.appendChild(el('span', { 'class': 'tag' }, focusName(e.focus)));
      body.appendChild(meta);
      var actions = el('div', { 'class': 'entry-actions' });
      var del = el('button', { type: 'button', 'class': 'btn-text danger', 'aria-label': 'Delete: ' + e.text }, 'Delete');
      del.addEventListener('click', function () {
        if (!confirm("Delete this entry? This can't be undone.")) return;
        state.evidence = state.evidence.filter(function (x) { return x.id !== e.id; });
        persist('evidence');
        renderEvidence();
      });
      actions.appendChild(del);
      li.appendChild(body);
      li.appendChild(actions);
      list.appendChild(li);
    });
  }

  // ---------- Affirmations library ----------
  var libraryTab = 'morning';
  var editingId = null;

  function libraryTabs() {
    var tabs = [{ id: 'saved', name: 'Saved' }];
    C.MOMENTS.forEach(function (m) { tabs.push({ id: m.id, name: m.short }); });
    var mine = state.prefs.focus;
    mine.concat(E.FOCUS_IDS.filter(function (f) { return mine.indexOf(f) === -1; })).forEach(function (f) {
      tabs.push({ id: 'focus:' + f, name: focusName(f) });
    });
    return tabs;
  }

  function libraryItems(tab) {
    if (tab === 'saved') {
      return state.feedback.favorites.map(findAffirmation).filter(Boolean);
    }
    if (tab.indexOf('focus:') === 0) {
      var f = tab.slice(6);
      return C.AFFIRMATIONS.filter(function (x) { return x.focus.indexOf(f) !== -1; });
    }
    var custom = pool().filter(function (x) { return x.custom && x.moments[0] === tab; });
    var built = C.AFFIRMATIONS.filter(function (x) { return !x.focus.length && x.moments.indexOf(tab) !== -1; });
    return custom.concat(built);
  }

  function renderLibrary() {
    var wrap = $('library-tabs');
    wrap.innerHTML = '';
    libraryTabs().forEach(function (t) {
      var b = el('button', { type: 'button', role: 'tab', 'class': 'chip', 'aria-selected': String(t.id === libraryTab) }, t.name);
      b.addEventListener('click', function () { libraryTab = t.id; renderLibrary(); });
      wrap.appendChild(b);
    });

    var note = '';
    if (libraryTab === 'saved') note = 'Statements you saved. They come up more often in your routine.';
    else if (libraryTab.indexOf('focus:') === 0) {
      var f = libraryTab.slice(6);
      note = state.prefs.focus.indexOf(f) !== -1
        ? 'Part of your focus areas, so these appear in your routine.'
        : 'These only appear in your routine if you choose this focus area in Settings.';
    }
    $('library-note').textContent = note;

    var list = $('library-list');
    list.innerHTML = '';
    var items = libraryItems(libraryTab);
    if (!items.length) {
      list.appendChild(el('li', { 'class': 'empty' }, libraryTab === 'saved'
        ? 'Nothing saved yet. Tap Save during a routine, or the heart next to any statement here.'
        : 'Nothing here yet.'));
      return;
    }
    items.forEach(function (a) {
      var li = el('li');
      if (isHidden(a.id)) li.className = 'is-hidden';
      var body = el('div', { 'class': 'entry-text' }, a.text);
      var metaText = a.custom ? 'Yours' : (isHidden(a.id) ? 'Hidden' : '');
      if (metaText) body.appendChild(el('span', { 'class': 'entry-meta' + (a.custom ? ' is-yours' : '') }, metaText));
      var actions = el('div', { 'class': 'entry-actions' });

      if (a.custom) {
        var edit = el('button', { type: 'button', 'class': 'btn-text', 'aria-label': 'Edit: ' + a.text }, 'Edit');
        edit.addEventListener('click', function () { startEdit(a); });
        var del = el('button', { type: 'button', 'class': 'btn-text danger', 'aria-label': 'Delete: ' + a.text }, 'Delete');
        del.addEventListener('click', function () {
          if (!confirm('Delete this affirmation?')) return;
          state.custom = state.custom.filter(function (x) { return x.id !== a.id; });
          state.feedback.favorites = state.feedback.favorites.filter(function (x) { return x !== a.id; });
          persist('custom');
          persist('feedback');
          if (editingId === a.id) resetCustomForm();
          renderLibrary();
        });
        actions.appendChild(edit);
        actions.appendChild(del);
      } else if (isHidden(a.id)) {
        var unhide = el('button', { type: 'button', 'class': 'btn-text', 'aria-label': 'Show again: ' + a.text }, 'Show again');
        unhide.addEventListener('click', function () {
          state.feedback.hidden = state.feedback.hidden.filter(function (x) { return x !== a.id; });
          persist('feedback');
          renderLibrary();
        });
        actions.appendChild(unhide);
      } else {
        var fav = el('button', {
          type: 'button', 'class': 'heart-btn', 'aria-pressed': String(isFav(a.id)),
          'aria-label': (isFav(a.id) ? 'Unsave: ' : 'Save: ') + a.text
        });
        fav.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/></svg>';
        fav.addEventListener('click', function () {
          toggleIn(state.feedback.favorites, a.id);
          persist('feedback');
          renderLibrary();
        });
        actions.appendChild(fav);
      }
      li.appendChild(body);
      li.appendChild(actions);
      list.appendChild(li);
    });
  }

  function fillMomentSelect() {
    var sel = $('custom-moment');
    C.MOMENTS.forEach(function (m) { sel.appendChild(el('option', { value: m.id }, m.name)); });
  }

  function startEdit(a) {
    editingId = a.id;
    $('custom-text').value = a.text;
    $('custom-moment').value = a.moments[0];
    $('custom-form-label').textContent = 'Edit your affirmation';
    $('custom-submit').textContent = 'Save changes';
    $('custom-cancel').hidden = false;
    $('custom-text').focus();
    window.scrollTo(0, 0);
  }

  function resetCustomForm() {
    editingId = null;
    $('custom-text').value = '';
    $('custom-moment').value = E.MOMENT_IDS.indexOf(libraryTab) !== -1 ? libraryTab : momentForNow();
    $('custom-form-label').textContent = 'Write your own';
    $('custom-submit').textContent = 'Add';
    $('custom-cancel').hidden = true;
  }

  function submitCustom(ev) {
    ev.preventDefault();
    var text = $('custom-text').value.trim();
    var m = $('custom-moment').value;
    if (!text) return;
    if (editingId) {
      state.custom.forEach(function (c) { if (c.id === editingId) { c.text = text; c.moment = m; } });
    } else {
      state.custom.push({ id: uid(), text: text, moment: m });
    }
    persist('custom');
    libraryTab = m;
    resetCustomForm();
    renderLibrary();
  }

  // ---------- Settings ----------
  function renderSettings() {
    renderFocusChips($('settings-focus'), state.prefs.focus, function () {
      state.prefs.onboarded = true;
      persist('prefs');
    });
    $('pref-actions').checked = state.prefs.showActions;
    renderFeedbackSummary();
    $('import-preview').hidden = true;
    $('settings-status').textContent = '';
  }

  function renderFeedbackSummary() {
    var fb = state.feedback;
    var parts = [
      fb.favorites.length + ' saved',
      fb.hidden.length + ' hidden',
      Object.keys(fb.helpful).length + ' marked helpful'
    ];
    $('feedback-summary').textContent = parts.join(' · ') + '.';
    $('reset-feedback').disabled = !(fb.favorites.length || fb.hidden.length || Object.keys(fb.helpful).length || Object.keys(fb.unbelievable).length);
  }

  function exportData() {
    var payload = E.buildExport(state);
    var blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    var url = URL.createObjectURL(blob);
    var a = el('a', { href: url, download: 'groundwork-backup-' + todayKey() + '.json' });
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
    setStatus('settings-status', 'Backup downloaded. Keep the file somewhere safe; it contains your personal entries.');
  }

  var pendingImport = null;

  function onImportFile(ev) {
    var file = ev.target.files && ev.target.files[0];
    ev.target.value = '';
    $('import-preview').hidden = true;
    pendingImport = null;
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      setStatus('settings-status', "That file is too large to be a Groundwork backup.");
      return;
    }
    file.text().then(function (text) {
      var parsed;
      try { parsed = JSON.parse(text); } catch (e) {
        setStatus('settings-status', "That file couldn't be read. Is it a Groundwork backup (.json)?");
        return;
      }
      var res = E.validateImport(parsed);
      if (!res.ok) { setStatus('settings-status', res.error); return; }
      pendingImport = res;
      var c = res.counts;
      var msg = 'This backup has ' + c.evidence + ' evidence ' + (c.evidence === 1 ? 'entry' : 'entries') + ', ' +
        c.custom + ' of your own affirmations, ' + c.days + ' routine ' + (c.days === 1 ? 'day' : 'days') +
        ' and ' + c.favorites + ' saved statements.';
      var skipped = res.dropped.evidence + res.dropped.custom;
      if (skipped) msg += ' ' + skipped + ' damaged ' + (skipped === 1 ? 'item was' : 'items were') + ' skipped.';
      msg += ' Adding keeps everything already here.';
      $('import-summary').textContent = msg;
      $('import-preview').hidden = false;
      $('import-merge').focus();
    }, function () {
      setStatus('settings-status', "That file couldn't be read.");
    });
  }

  function applyImport(mode) {
    if (!pendingImport) return;
    if (mode === 'replace' && !confirm('Replace everything in this browser with the backup? Anything not in the backup will be lost.')) return;
    var before = state;
    var result;
    if (mode === 'replace') {
      state = pendingImport.state;
      state.prefs.onboarded = true;
    } else {
      result = E.mergeState(before, pendingImport.state);
      state = result.state;
    }
    persistAll();
    try { localStorage.removeItem(KEYS.daily); } catch (e) { /* ignore */ }
    pendingImport = null;
    renderSettings();
    setStatus('settings-status', mode === 'replace'
      ? 'Backup restored.'
      : 'Added ' + result.added.evidence + ' evidence ' + (result.added.evidence === 1 ? 'entry' : 'entries') + ', ' +
        result.added.custom + ' affirmations and ' + result.added.days + ' routine days. Nothing was removed.');
  }

  // ---------- Routing ----------
  var VIEWS = ['home', 'routine', 'evidence', 'affirmations', 'settings'];

  function route() {
    var name = location.hash.replace('#', '');
    if (VIEWS.indexOf(name) === -1) name = 'home';
    VIEWS.forEach(function (v) { $('view-' + v).hidden = v !== name; });
    document.body.classList.toggle('in-routine', name === 'routine');
    document.querySelectorAll('.tabbar a').forEach(function (a) {
      if (a.getAttribute('data-nav') === name) a.setAttribute('aria-current', 'page');
      else a.removeAttribute('aria-current');
    });

    if (name === 'home') renderHome();
    if (name === 'routine') startRoutine();
    if (name === 'evidence') {
      fillFocusSelect($('evidence-focus'));
      $('evidence-text').placeholder = promptFor($('evidence-focus').value);
      renderEvidence();
    }
    if (name === 'affirmations') { renderLibrary(); resetCustomForm(); }
    if (name === 'settings') renderSettings();

    if (name !== 'routine') {
      window.scrollTo(0, 0);
      var heading = document.querySelector('#view-' + name + ' h1[tabindex]');
      if (heading && location.hash) heading.focus({ preventScroll: true });
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
  $('fb-fav').addEventListener('click', onFavorite);
  $('fb-helpful').addEventListener('click', onHelpful);
  $('fb-hide').addEventListener('click', onHide);
  $('fb-unbelievable').addEventListener('click', onUnbelievable);
  $('action-another').addEventListener('click', showAction);
  $('action-skip').addEventListener('click', function () { $('action-card').hidden = true; });

  $('routine-evidence-form').addEventListener('submit', function (ev) {
    ev.preventDefault();
    if (addEvidence($('routine-evidence-text').value, state.prefs.focus[0])) {
      $('routine-evidence-text').value = '';
      renderRecall();
    }
  });

  $('done-evidence-form').addEventListener('submit', function (ev) {
    ev.preventDefault();
    if (addEvidence($('done-evidence-text').value, $('done-evidence-focus').value)) {
      $('done-evidence-text').value = '';
      $('done-evidence').open = false;
      setStatus('done-status', 'Saved to your Evidence Bank.');
    }
  });

  $('evidence-form').addEventListener('submit', function (ev) {
    ev.preventDefault();
    if (addEvidence($('evidence-text').value, $('evidence-focus').value)) {
      $('evidence-text').value = '';
      renderEvidence();
    }
  });
  $('evidence-focus').addEventListener('change', function () {
    $('evidence-text').placeholder = promptFor($('evidence-focus').value);
  });

  $('onboard-save').addEventListener('click', function () {
    state.prefs.focus = onboardPick.slice(0, E.MAX_FOCUS);
    state.prefs.onboarded = true;
    persist('prefs');
    try { localStorage.removeItem(KEYS.daily); } catch (e) { /* ignore */ }
    renderHome();
  });
  $('onboard-skip').addEventListener('click', function () {
    state.prefs.onboarded = true;
    persist('prefs');
    renderHome();
  });

  $('pref-actions').addEventListener('change', function () {
    state.prefs.showActions = $('pref-actions').checked;
    persist('prefs');
  });
  $('reset-feedback').addEventListener('click', function () {
    if (!confirm('Reset your saved, hidden and helpful marks? Your evidence, own affirmations and streak stay.')) return;
    state.feedback = E.defaultFeedback();
    persist('feedback');
    renderFeedbackSummary();
    setStatus('settings-status', 'Feedback reset.');
  });
  $('export-btn').addEventListener('click', exportData);
  $('import-file').addEventListener('change', onImportFile);
  $('import-merge').addEventListener('click', function () { applyImport('merge'); });
  $('import-replace').addEventListener('click', function () { applyImport('replace'); });
  $('import-cancel').addEventListener('click', function () {
    pendingImport = null;
    $('import-preview').hidden = true;
    setStatus('settings-status', 'Import cancelled. Nothing changed.');
  });

  fillMomentSelect();
  $('custom-form').addEventListener('submit', submitCustom);
  $('custom-cancel').addEventListener('click', resetCustomForm);

  // Another tab changed the data: reload state so this one doesn't overwrite it.
  window.addEventListener('storage', function (ev) {
    if (ev.key && ev.key.indexOf('ma.') === 0) { state = loadState(); }
  });

  resetRoutine();
  window.addEventListener('hashchange', route);
  route();
})();
