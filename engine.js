/* Groundwork engine: the selection rules and data handling, with no DOM access, so they can be unit tested.
 *
 * Nothing here is "AI". Statements are ranked with a few plain rules:
 * mood decides the tone, the chosen moment and focus areas filter the pool, saved/helpful feedback
 * nudges things up, "hide" removes them, "not believable" and recent showings push them down.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.GWEngine = factory();
})(this, function () {
  'use strict';

  var SCHEMA = 2;
  var MAX_FOCUS = 3;
  var MOMENT_IDS = ['morning', 'hard', 'setback', 'night'];
  var FOCUS_IDS = ['anxiety', 'money', 'motivation', 'selfworth', 'confidence', 'burnout', 'relationships', 'setbacks'];

  // How well each tone suits each mood. A missing tone is excluded (a rough day never gets "bright" statements).
  var TONE_SCORE = {
    rough: { gentle: 3, steady: 0.5 },
    okay: { steady: 3, gentle: 1, bright: 1 },
    good: { bright: 3, steady: 1.5, gentle: 0 }
  };
  var CUSTOM_TONE_SCORE = 2; // the user's own statements fit any mood

  // ---------- Dates (always local calendar dates) ----------
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function dateKey(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function isDateKey(s) {
    if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
    var d = parseKey(s);
    return dateKey(d) === s;
  }
  function parseKey(key) {
    var p = key.split('-');
    return new Date(+p[0], +p[1] - 1, +p[2]);
  }
  function addDays(d, n) { return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n); }
  // Whole days from key a to key b (b later = positive). Uses UTC to dodge daylight-saving gaps.
  function daysBetween(a, b) {
    var pa = a.split('-'), pb = b.split('-');
    return Math.round((Date.UTC(+pb[0], +pb[1] - 1, +pb[2]) - Date.UTC(+pa[0], +pa[1] - 1, +pa[2])) / 86400000);
  }

  // ---------- Randomness (injectable so tests are repeatable) ----------
  function seededRng(seedText) {
    var h = 1779033703 ^ seedText.length;
    for (var i = 0; i < seedText.length; i++) {
      h = Math.imul(h ^ seedText.charCodeAt(i), 3432918353);
      h = (h << 13) | (h >>> 19);
    }
    var s = h >>> 0;
    return function () {
      s = (s + 0x6D2B79F5) >>> 0;
      var t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function shuffle(arr, rng) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(rng() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  // ---------- Affirmation selection ----------
  function fitsMoment(item, moment) {
    if (!moment) return true;
    return item.moments.indexOf('any') !== -1 || item.moments.indexOf(moment) !== -1;
  }

  // Focus-specific statements only appear for people who chose that focus.
  function fitsFocus(item, focus) {
    if (!item.focus || !item.focus.length) return true;
    for (var i = 0; i < item.focus.length; i++) if (focus.indexOf(item.focus[i]) !== -1) return true;
    return false;
  }

  function recencyPenalty(lastSeen, today) {
    if (!lastSeen || !today) return 0;
    var d = daysBetween(lastSeen, today);
    if (d <= 0) return 6;
    if (d === 1) return 4;
    if (d <= 3) return 2;
    if (d <= 7) return 1;
    return 0;
  }

  // Returns a number (higher is better) or null when the statement should not be shown at all.
  function scoreAffirmation(item, ctx) {
    var fb = ctx.feedback || {};
    if (fb.hidden && fb.hidden.indexOf(item.id) !== -1) return null;
    if (!fitsMoment(item, ctx.moment)) return null;
    var focus = ctx.focus || [];
    if (!fitsFocus(item, focus)) return null;

    var s;
    if (item.custom) {
      s = CUSTOM_TONE_SCORE;
    } else {
      var tones = TONE_SCORE[ctx.mood] || TONE_SCORE.okay;
      if (!(item.tone in tones)) return null;
      s = tones[item.tone];
    }

    if (ctx.moment && item.moments.indexOf(ctx.moment) !== -1) s += 1;
    if (item.focus && item.focus.length && focus.length) s += 3;
    if (fb.favorites && fb.favorites.indexOf(item.id) !== -1) s += 2;
    if (fb.helpful && fb.helpful[item.id]) s += Math.min(2, fb.helpful[item.id]);
    if (fb.unbelievable && fb.unbelievable[item.id]) s -= Math.min(4, 2 * fb.unbelievable[item.id]);
    if (ctx.seen) s -= recencyPenalty(ctx.seen[item.id], ctx.today);
    return s;
  }

  // Best first. A little randomness keeps equal-scoring statements from always appearing in the same order.
  function rankAffirmations(pool, ctx, rng) {
    rng = rng || Math.random;
    var exclude = ctx.exclude || [];
    var scored = [];
    pool.forEach(function (item) {
      if (exclude.indexOf(item.id) !== -1) return;
      var s = scoreAffirmation(item, ctx);
      if (s === null) return;
      scored.push({ item: item, score: s + rng() * 1.5 });
    });
    scored.sort(function (x, y) { return y.score - x.score; });
    return scored.map(function (x) { return x.item; });
  }

  // A smaller, more believable version of the statement, or the most grounded alternative available.
  function believableAlternative(item, pool, ctx, rng) {
    if (item.softer && !item.isSofter) {
      return {
        id: item.id + '~soft', baseId: item.id, isSofter: true, text: item.softer,
        tone: 'gentle', moments: item.moments, focus: item.focus
      };
    }
    var exclude = (ctx.exclude || []).concat([item.baseId || item.id]);
    var gentleCtx = {
      mood: 'rough', moment: ctx.moment, focus: ctx.focus, feedback: ctx.feedback,
      seen: ctx.seen, today: ctx.today, exclude: exclude
    };
    var ranked = rankAffirmations(pool, gentleCtx, rng).filter(function (x) { return x.tone === 'gentle' || x.custom; });
    return ranked[0] || null;
  }

  // The day's affirmation for Home: same all day, leaning on focus areas and saved statements,
  // and avoiding the ones shown on Home in the past week.
  function dailyPick(pool, ctx, today) {
    var rng = seededRng('daily:' + today);
    var recent = ctx.recentDaily || [];
    var dctx = { mood: 'okay', moment: null, focus: ctx.focus, feedback: ctx.feedback, exclude: recent };
    var ranked = rankAffirmations(pool.filter(function (x) { return !x.custom; }), dctx, rng);
    if (!ranked.length) {
      dctx.exclude = [];
      ranked = rankAffirmations(pool.filter(function (x) { return !x.custom; }), dctx, rng);
    }
    return ranked[0] || null;
  }

  // ---------- Evidence ----------
  // Up to n entries: ones in the user's focus areas first, then the rest, shuffled within each group.
  function pickEvidence(entries, focus, n, rng) {
    rng = rng || Math.random;
    focus = focus || [];
    var match = [], rest = [];
    entries.forEach(function (e) {
      if (e.focus && focus.indexOf(e.focus) !== -1) match.push(e);
      else rest.push(e);
    });
    return shuffle(match, rng).concat(shuffle(rest, rng)).slice(0, n);
  }

  // One saved win that backs up the statement: same focus area first, then the user's focus areas, then any.
  function proofFor(item, entries, focus, rng) {
    if (!entries.length) return null;
    rng = rng || Math.random;
    var itemFocus = (item && item.focus) || [];
    var tiers = [[], [], []];
    entries.forEach(function (e) {
      if (e.focus && itemFocus.indexOf(e.focus) !== -1) tiers[0].push(e);
      else if (e.focus && (focus || []).indexOf(e.focus) !== -1) tiers[1].push(e);
      else tiers[2].push(e);
    });
    for (var i = 0; i < tiers.length; i++) {
      if (tiers[i].length) return tiers[i][Math.floor(rng() * tiers[i].length)];
    }
    return null;
  }

  // ---------- Small actions ----------
  function pickAction(actions, focus, moment, rng, excludeId) {
    rng = rng || Math.random;
    focus = focus || [];
    var byFocus = actions.filter(function (x) {
      return x.focus.length && fitsFocus(x, focus) && fitsMoment(x, moment);
    });
    var general = actions.filter(function (x) { return !x.focus.length && fitsMoment(x, moment); });
    var pool = byFocus.length ? byFocus.concat(general.slice(0, 1)) : general;
    if (!pool.length) pool = actions.filter(function (x) { return !x.focus.length; });
    var options = pool.filter(function (x) { return x.id !== excludeId; });
    if (!options.length) options = pool;
    return options[Math.floor(rng() * options.length)] || null;
  }

  // ---------- Streak ----------
  function currentStreak(history, today) {
    var done = {};
    (history || []).forEach(function (k) { done[k] = true; });
    var day = today || new Date();
    if (!done[dateKey(day)]) day = addDays(day, -1);
    var count = 0;
    while (done[dateKey(day)]) { count++; day = addDays(day, -1); }
    return count;
  }

  // ---------- Data shape, cleaning and migration ----------
  function defaultPrefs() { return { focus: [], onboarded: false, showActions: true }; }
  function defaultFeedback() { return { favorites: [], hidden: [], helpful: {}, unbelievable: {} }; }

  function str(v, max) {
    if (typeof v !== 'string') return '';
    v = v.trim();
    return v.length > max ? v.slice(0, max) : v;
  }
  function isObj(v) { return v !== null && typeof v === 'object' && !Array.isArray(v); }
  function genId(prefix, i) { return prefix + Date.now().toString(36) + i.toString(36) + Math.random().toString(36).slice(2, 6); }

  function cleanEvidence(list, report) {
    var out = [], ids = {};
    (Array.isArray(list) ? list : []).forEach(function (e, i) {
      var text = isObj(e) ? str(e.text, 500) : '';
      if (!text || !isDateKey(e.date)) { if (report) report.evidence++; return; }
      var id = str(e.id, 64) || genId('e', i);
      if (ids[id]) id = genId('e', i);
      ids[id] = true;
      out.push({
        id: id,
        text: text,
        date: e.date,
        created: typeof e.created === 'number' && isFinite(e.created) ? e.created : 0,
        focus: FOCUS_IDS.indexOf(e.focus) !== -1 ? e.focus : ''
      });
    });
    return out;
  }

  function cleanCustom(list, report) {
    var out = [], ids = {};
    (Array.isArray(list) ? list : []).forEach(function (c, i) {
      var text = isObj(c) ? str(c.text, 300) : '';
      if (!text || MOMENT_IDS.indexOf(c.moment) === -1) { if (report) report.custom++; return; }
      var id = str(c.id, 64) || genId('c', i);
      if (ids[id]) id = genId('c', i);
      ids[id] = true;
      out.push({ id: id, text: text, moment: c.moment });
    });
    return out;
  }

  function cleanHistory(list) {
    var seen = {};
    (Array.isArray(list) ? list : []).forEach(function (k) { if (isDateKey(k)) seen[k] = true; });
    return Object.keys(seen).sort();
  }

  function cleanPrefs(p) {
    var out = defaultPrefs();
    if (!isObj(p)) return out;
    if (Array.isArray(p.focus)) {
      p.focus.forEach(function (f) {
        if (FOCUS_IDS.indexOf(f) !== -1 && out.focus.indexOf(f) === -1 && out.focus.length < MAX_FOCUS) out.focus.push(f);
      });
    }
    out.onboarded = p.onboarded === true;
    out.showActions = p.showActions !== false;
    return out;
  }

  function idList(v) {
    var out = [];
    (Array.isArray(v) ? v : []).forEach(function (id) {
      if (typeof id === 'string' && id && id.length <= 64 && out.indexOf(id) === -1) out.push(id);
    });
    return out.slice(0, 2000);
  }
  function countMap(v) {
    var out = {};
    if (!isObj(v)) return out;
    Object.keys(v).slice(0, 2000).forEach(function (id) {
      var n = v[id];
      if (id.length <= 64 && typeof n === 'number' && isFinite(n) && n > 0) out[id] = Math.min(99, Math.floor(n));
    });
    return out;
  }
  function cleanFeedback(f) {
    if (!isObj(f)) return defaultFeedback();
    return { favorites: idList(f.favorites), hidden: idList(f.hidden), helpful: countMap(f.helpful), unbelievable: countMap(f.unbelievable) };
  }
  function cleanSeen(s) {
    var out = {};
    if (!isObj(s)) return out;
    Object.keys(s).slice(0, 2000).forEach(function (id) { if (id.length <= 64 && isDateKey(s[id])) out[id] = s[id]; });
    return out;
  }

  // Works for v1 data (evidence, custom, history only) and for v2 data alike.
  function normalizeState(raw) {
    raw = isObj(raw) ? raw : {};
    var dropped = { evidence: 0, custom: 0 };
    return {
      state: {
        evidence: cleanEvidence(raw.evidence, dropped),
        custom: cleanCustom(raw.custom, dropped),
        history: cleanHistory(raw.history),
        prefs: cleanPrefs(raw.prefs),
        feedback: cleanFeedback(raw.feedback),
        seen: cleanSeen(raw.seen)
      },
      dropped: dropped
    };
  }

  // ---------- Export / import ----------
  function buildExport(state, now) {
    return {
      app: 'groundwork',
      schema: SCHEMA,
      exportedAt: (now || new Date()).toISOString(),
      data: {
        evidence: state.evidence, custom: state.custom, history: state.history,
        prefs: state.prefs, feedback: state.feedback, seen: state.seen
      }
    };
  }

  function validateImport(obj) {
    if (!isObj(obj) || obj.app !== 'groundwork' || !isObj(obj.data)) {
      return { ok: false, error: "This file isn't a Groundwork backup." };
    }
    if (typeof obj.schema !== 'number' || obj.schema < 1) {
      return { ok: false, error: "This backup is missing its version number, so it can't be read safely." };
    }
    if (obj.schema > SCHEMA) {
      return { ok: false, error: 'This backup was made by a newer version of Groundwork. Refresh the app and try again.' };
    }
    var d = obj.data;
    var wrongType = ['evidence', 'custom', 'history'].filter(function (k) { return k in d && !Array.isArray(d[k]); });
    if (wrongType.length) return { ok: false, error: 'This backup looks damaged (' + wrongType.join(', ') + ' is not a list).' };

    var res = normalizeState(d);
    var s = res.state;
    return {
      ok: true,
      state: s,
      dropped: res.dropped,
      counts: { evidence: s.evidence.length, custom: s.custom.length, days: s.history.length, favorites: s.feedback.favorites.length }
    };
  }

  // Combine an imported backup with what's already here. Nothing existing is removed or changed.
  function mergeState(current, incoming) {
    var added = { evidence: 0, custom: 0, days: 0 };

    var evidence = current.evidence.slice();
    var eIds = {}, eKeys = {};
    evidence.forEach(function (e) { eIds[e.id] = true; eKeys[e.date + '|' + e.text] = true; });
    incoming.evidence.forEach(function (e) {
      if (eIds[e.id] || eKeys[e.date + '|' + e.text]) return;
      evidence.push(e); eIds[e.id] = true; eKeys[e.date + '|' + e.text] = true; added.evidence++;
    });

    var custom = current.custom.slice();
    var cIds = {}, cKeys = {};
    custom.forEach(function (c) { cIds[c.id] = true; cKeys[c.moment + '|' + c.text] = true; });
    incoming.custom.forEach(function (c) {
      if (cIds[c.id] || cKeys[c.moment + '|' + c.text]) return;
      custom.push(c); cIds[c.id] = true; cKeys[c.moment + '|' + c.text] = true; added.custom++;
    });

    var history = cleanHistory(current.history.concat(incoming.history));
    added.days = history.length - current.history.length;

    var prefs = {
      focus: current.prefs.focus.length ? current.prefs.focus.slice() : incoming.prefs.focus.slice(),
      onboarded: current.prefs.onboarded || incoming.prefs.onboarded,
      showActions: current.prefs.showActions
    };

    function union(a, b) { return a.concat(b.filter(function (x) { return a.indexOf(x) === -1; })); }
    function maxMap(a, b) {
      var out = {};
      Object.keys(a).forEach(function (k) { out[k] = a[k]; });
      Object.keys(b).forEach(function (k) { out[k] = Math.max(out[k] || 0, b[k]); });
      return out;
    }
    var feedback = {
      favorites: union(current.feedback.favorites, incoming.feedback.favorites),
      hidden: union(current.feedback.hidden, incoming.feedback.hidden),
      helpful: maxMap(current.feedback.helpful, incoming.feedback.helpful),
      unbelievable: maxMap(current.feedback.unbelievable, incoming.feedback.unbelievable)
    };

    var seen = {};
    [current.seen, incoming.seen].forEach(function (m) {
      Object.keys(m).forEach(function (k) { if (!seen[k] || m[k] > seen[k]) seen[k] = m[k]; });
    });

    return {
      state: { evidence: evidence, custom: custom, history: history, prefs: prefs, feedback: feedback, seen: seen },
      added: added
    };
  }

  return {
    SCHEMA: SCHEMA,
    MAX_FOCUS: MAX_FOCUS,
    MOMENT_IDS: MOMENT_IDS,
    FOCUS_IDS: FOCUS_IDS,
    TONE_SCORE: TONE_SCORE,
    dateKey: dateKey,
    isDateKey: isDateKey,
    parseKey: parseKey,
    addDays: addDays,
    daysBetween: daysBetween,
    seededRng: seededRng,
    shuffle: shuffle,
    fitsMoment: fitsMoment,
    fitsFocus: fitsFocus,
    scoreAffirmation: scoreAffirmation,
    rankAffirmations: rankAffirmations,
    believableAlternative: believableAlternative,
    dailyPick: dailyPick,
    pickEvidence: pickEvidence,
    proofFor: proofFor,
    pickAction: pickAction,
    currentStreak: currentStreak,
    defaultPrefs: defaultPrefs,
    defaultFeedback: defaultFeedback,
    normalizeState: normalizeState,
    buildExport: buildExport,
    validateImport: validateImport,
    mergeState: mergeState
  };
});
