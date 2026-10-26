// Unit tests for the selection rules and data handling. Run with: node --test tests/unit
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../../engine.js');
const C = require('../../content.js');

const TODAY = '2026-10-26';
const rng = () => E.seededRng('test');
const fb = (over) => Object.assign(E.defaultFeedback(), over || {});
const ids = (list) => list.map((x) => x.id);

function ctx(over) {
  return Object.assign({ mood: 'okay', moment: 'morning', focus: [], feedback: fb(), seen: {}, today: TODAY }, over);
}

// ---------- Content ----------
test('content: ids are unique and statements stay short', () => {
  const seen = new Set();
  for (const a of C.AFFIRMATIONS) {
    assert.ok(!seen.has(a.id), 'duplicate id ' + a.id);
    seen.add(a.id);
    assert.ok(a.text.length <= 90, 'too long: ' + a.text);
    assert.ok(['gentle', 'steady', 'bright'].includes(a.tone), a.id);
    assert.ok(a.moments.length > 0);
    if (a.softer) assert.ok(a.softer.length <= 90);
  }
  for (const x of C.ACTIONS) assert.ok(!seen.has(x.id)), seen.add(x.id);
});

test('content: every moment has at least 5 general statements and each mood has options', () => {
  for (const m of E.MOMENT_IDS) {
    const general = C.AFFIRMATIONS.filter((a) => !a.focus.length && a.moments.includes(m));
    assert.ok(general.length >= 5, m);
    for (const mood of ['rough', 'okay', 'good']) {
      assert.ok(E.rankAffirmations(C.AFFIRMATIONS, ctx({ mood, moment: m }), rng()).length >= 4, m + ' ' + mood);
    }
  }
});

test('content: every focus area has gentle statements, actions and an evidence prompt', () => {
  for (const f of E.FOCUS_IDS) {
    assert.ok(C.AFFIRMATIONS.filter((a) => a.focus.includes(f) && a.tone === 'gentle').length >= 2, f);
    assert.ok(C.ACTIONS.filter((a) => a.focus.includes(f)).length >= 2, f);
    assert.ok(C.EVIDENCE_PROMPTS[f], f);
  }
});

test('content: every bright statement has a softer version', () => {
  for (const a of C.AFFIRMATIONS.filter((x) => x.tone === 'bright')) assert.ok(a.softer, a.id);
});

// ---------- Preference matching ----------
test('matching: rough mood never gets bright statements', () => {
  for (const m of E.MOMENT_IDS) {
    const r = E.rankAffirmations(C.AFFIRMATIONS, ctx({ mood: 'rough', moment: m, focus: ['anxiety', 'money'] }), rng());
    assert.ok(r.every((a) => a.tone !== 'bright'));
    assert.equal(r[0].tone, 'gentle');
  }
});

test('matching: okay leads with steady, good leads with bright', () => {
  for (const m of E.MOMENT_IDS) {
    const okay = E.rankAffirmations(C.AFFIRMATIONS, ctx({ mood: 'okay', moment: m }), rng()).slice(0, 4);
    const good = E.rankAffirmations(C.AFFIRMATIONS, ctx({ mood: 'good', moment: m }), rng()).slice(0, 4);
    assert.ok(okay.every((a) => a.tone === 'steady'), m + ' okay: ' + ids(okay));
    assert.ok(good.every((a) => a.tone === 'bright'), m + ' good: ' + ids(good));
  }
});

test('matching: focus statements only appear for chosen focus areas, and rank first when chosen', () => {
  const none = E.rankAffirmations(C.AFFIRMATIONS, ctx({ moment: 'hard' }), rng());
  assert.ok(none.every((a) => a.focus.length === 0));

  const money = E.rankAffirmations(C.AFFIRMATIONS, ctx({ moment: 'hard', focus: ['money'] }), rng());
  assert.ok(money.every((a) => a.focus.length === 0 || a.focus.includes('money')));
  assert.ok(money.slice(0, 3).every((a) => a.focus.includes('money')), ids(money.slice(0, 3)).join());
});

test('matching: moment filter respects specific moments and "any"', () => {
  const night = E.rankAffirmations(C.AFFIRMATIONS, ctx({ moment: 'night', focus: ['anxiety'] }), rng());
  assert.ok(night.every((a) => a.moments.includes('night') || a.moments.includes('any')));
  assert.ok(!ids(night).includes('fx-s3')); // anxiety statement limited to hard/morning
});

test('matching: custom statements fit any mood for their moment', () => {
  const pool = C.AFFIRMATIONS.concat([{ id: 'cust1', text: 'Mine.', moments: ['night'], focus: [], tone: null, custom: true }]);
  for (const mood of ['rough', 'okay', 'good']) {
    assert.ok(ids(E.rankAffirmations(pool, ctx({ mood, moment: 'night' }), rng())).includes('cust1'));
  }
  assert.ok(!ids(E.rankAffirmations(pool, ctx({ moment: 'morning' }), rng())).includes('cust1'));
});

// ---------- Feedback ----------
test('feedback: hidden statements never appear', () => {
  const r = E.rankAffirmations(C.AFFIRMATIONS, ctx({ feedback: fb({ hidden: ['mo-s1', 'mo-s2'] }) }), rng());
  assert.ok(!ids(r).includes('mo-s1') && !ids(r).includes('mo-s2'));
});

test('feedback: favorites and helpful move up, "not believable" moves down', () => {
  const base = ctx({ mood: 'okay', moment: 'morning' });
  const s = (over, id) => E.scoreAffirmation(C.AFFIRMATIONS.find((a) => a.id === id), Object.assign({}, base, over));
  assert.ok(s({ feedback: fb({ favorites: ['mo-g1'] }) }, 'mo-g1') > s({}, 'mo-g1'));
  assert.ok(s({ feedback: fb({ helpful: { 'mo-g1': 1 } }) }, 'mo-g1') > s({}, 'mo-g1'));
  assert.ok(s({ feedback: fb({ unbelievable: { 'mo-s1': 1 } }) }, 'mo-s1') < s({}, 'mo-s1'));
  // a favorited gentle line can outrank unmarked steady lines on an okay day
  const r = E.rankAffirmations(C.AFFIRMATIONS, ctx({ feedback: fb({ favorites: ['mo-g1'], helpful: { 'mo-g1': 2 } }) }), rng());
  assert.equal(r[0].id, 'mo-g1');
});

test('believable: uses the softer version first, then a gentle alternative', () => {
  const bright = C.AFFIRMATIONS.find((a) => a.id === 'mo-b4');
  const soft = E.believableAlternative(bright, C.AFFIRMATIONS, ctx({ mood: 'good' }), rng());
  assert.equal(soft.text, bright.softer);
  assert.equal(soft.baseId, 'mo-b4');
  const next = E.believableAlternative(soft, C.AFFIRMATIONS, ctx({ mood: 'good' }), rng());
  assert.equal(next.tone, 'gentle');
  assert.notEqual(next.id, 'mo-b4');
  const steady = C.AFFIRMATIONS.find((a) => a.id === 'mo-s1');
  assert.equal(E.believableAlternative(steady, C.AFFIRMATIONS, ctx(), rng()).tone, 'gentle');
});

// ---------- Rotation ----------
test('rotation: statements seen today or yesterday drop behind fresh ones', () => {
  const top = E.rankAffirmations(C.AFFIRMATIONS, ctx(), rng()).slice(0, 4);
  const seen = {};
  top.forEach((a) => { seen[a.id] = '2026-10-25'; });
  const after = E.rankAffirmations(C.AFFIRMATIONS, ctx({ seen }), rng());
  const firstFour = ids(after.slice(0, 4));
  assert.ok(top.every((a) => !firstFour.includes(a.id)), 'yesterday’s statements should not lead today');
  assert.equal(E.scoreAffirmation(top[0], ctx({ seen: { [top[0].id]: TODAY } })) < E.scoreAffirmation(top[0], ctx()), true);
});

test('rotation: old views stop counting after a week', () => {
  const a = C.AFFIRMATIONS[0];
  assert.equal(E.scoreAffirmation(a, ctx({ seen: { [a.id]: '2026-10-10' } })), E.scoreAffirmation(a, ctx()));
});

test('rotation: daily pick is stable for a date and changes across days', () => {
  const c = { focus: ['burnout'], feedback: fb(), recentDaily: [] };
  const a = E.dailyPick(C.AFFIRMATIONS, c, TODAY);
  assert.equal(E.dailyPick(C.AFFIRMATIONS, c, TODAY).id, a.id);
  const week = new Set();
  let recent = [];
  for (let i = 0; i < 7; i++) {
    const day = E.dateKey(E.addDays(E.parseKey(TODAY), i));
    const p = E.dailyPick(C.AFFIRMATIONS, Object.assign({}, c, { recentDaily: recent }), day);
    week.add(p.id);
    recent = recent.concat([p.id]).slice(-7);
  }
  assert.equal(week.size, 7, 'no repeats within a week');
});

test('rotation: daily pick skips hidden statements', () => {
  const first = E.dailyPick(C.AFFIRMATIONS, { focus: [], feedback: fb(), recentDaily: [] }, TODAY);
  const again = E.dailyPick(C.AFFIRMATIONS, { focus: [], feedback: fb({ hidden: [first.id] }), recentDaily: [] }, TODAY);
  assert.notEqual(again.id, first.id);
});

// ---------- Evidence ----------
const EVID = [
  { id: 'e1', text: 'General win', date: '2026-10-01', focus: '' },
  { id: 'e2', text: 'Paid the bill', date: '2026-10-02', focus: 'money' },
  { id: 'e3', text: 'Spoke up', date: '2026-10-03', focus: 'confidence' },
  { id: 'e4', text: 'Called the bank', date: '2026-10-04', focus: 'money' },
  { id: 'e5', text: 'Another', date: '2026-10-05', focus: '' }
];

test('evidence: focus-matched entries come first, max n', () => {
  for (let i = 0; i < 20; i++) {
    const p = E.pickEvidence(EVID, ['money'], 3, E.seededRng('e' + i));
    assert.equal(p.length, 3);
    assert.deepEqual(new Set(ids(p.slice(0, 2))), new Set(['e2', 'e4']));
  }
  assert.equal(E.pickEvidence([], ['money'], 3).length, 0);
});

test('evidence: proof matches the statement’s focus, then the user’s focus, then anything', () => {
  const moneyLine = C.AFFIRMATIONS.find((a) => a.focus.includes('money'));
  assert.ok(['e2', 'e4'].includes(E.proofFor(moneyLine, EVID, [], rng()).id));
  const general = C.AFFIRMATIONS.find((a) => !a.focus.length);
  assert.equal(E.proofFor(general, EVID, ['confidence'], rng()).id, 'e3');
  assert.ok(E.proofFor(general, EVID, [], rng()));
  assert.equal(E.proofFor(general, [], [], rng()), null);
});

// ---------- Actions ----------
test('actions: match focus when chosen, fall back to the moment otherwise', () => {
  for (let i = 0; i < 20; i++) {
    const a = E.pickAction(C.ACTIONS, ['burnout'], 'morning', E.seededRng('a' + i));
    assert.ok(a.focus.includes('burnout') || a.focus.length === 0);
    const g = E.pickAction(C.ACTIONS, [], 'night', E.seededRng('b' + i));
    assert.ok(g.focus.length === 0 && (g.moments.includes('night') || g.moments.includes('any')));
  }
  const first = E.pickAction(C.ACTIONS, ['money'], 'hard', rng());
  assert.notEqual(E.pickAction(C.ACTIONS, ['money'], 'hard', rng(), first.id).id, first.id);
});

// ---------- Streak ----------
test('streak: counts consecutive local days, survives until end of today, resets after a gap', () => {
  const today = new Date(2026, 9, 26, 22, 30);
  assert.equal(E.currentStreak(['2026-10-26', '2026-10-25', '2026-10-24'], today), 3);
  assert.equal(E.currentStreak(['2026-10-25', '2026-10-24'], today), 2);
  assert.equal(E.currentStreak(['2026-10-26', '2026-10-24'], today), 1);
  assert.equal(E.currentStreak(['2026-10-24'], today), 0);
  assert.equal(E.currentStreak(['2026-10-26', '2026-10-26'], today), 1);
  // across a month boundary
  assert.equal(E.currentStreak(['2026-11-01', '2026-10-31', '2026-10-30'], new Date(2026, 10, 1)), 3);
});

// ---------- Migration ----------
test('migration: v1 data passes through unchanged and gets v2 defaults', () => {
  const v1 = {
    evidence: [{ id: 'abc', text: 'I got through a hard week.', date: '2026-10-20', created: 1761000000000 }],
    custom: [{ id: 'xyz', text: 'My own line.', moment: 'night' }],
    history: ['2026-10-24', '2026-10-25']
  };
  const { state, dropped } = E.normalizeState(v1);
  assert.deepEqual(state.evidence, [Object.assign({}, v1.evidence[0], { focus: '' })]);
  assert.deepEqual(state.custom, v1.custom);
  assert.deepEqual(state.history, v1.history);
  assert.deepEqual(state.prefs, { focus: [], onboarded: false, showActions: true });
  assert.deepEqual(state.feedback, E.defaultFeedback());
  assert.deepEqual(dropped, { evidence: 0, custom: 0 });
});

test('migration: empty or corrupt storage gives a clean default state', () => {
  const { state } = E.normalizeState({ evidence: 'oops', custom: null, history: { a: 1 }, prefs: [], feedback: 5 });
  assert.deepEqual(state.evidence, []);
  assert.deepEqual(state.custom, []);
  assert.deepEqual(state.history, []);
  assert.deepEqual(state.prefs.focus, []);
  assert.deepEqual(state.feedback, E.defaultFeedback());
});

test('migration: prefs are cleaned (unknown focus dropped, max 3)', () => {
  const { state } = E.normalizeState({ prefs: { focus: ['money', 'nope', 'money', 'anxiety', 'burnout', 'confidence'], onboarded: true } });
  assert.deepEqual(state.prefs.focus, ['money', 'anxiety', 'burnout']);
  assert.equal(state.prefs.onboarded, true);
});

// ---------- Export / import ----------
function sampleState() {
  return E.normalizeState({
    evidence: [{ id: 'e1', text: 'Win', date: '2026-10-20', created: 1, focus: 'money' }],
    custom: [{ id: 'c1', text: 'Mine', moment: 'morning' }],
    history: ['2026-10-24', '2026-10-25'],
    prefs: { focus: ['money'], onboarded: true, showActions: false },
    feedback: { favorites: ['mo-g1'], hidden: ['mo-s1'], helpful: { 'mo-g1': 2 }, unbelievable: {} },
    seen: { 'mo-g1': '2026-10-25' }
  }).state;
}

test('export/import: round trip preserves everything', () => {
  const s = sampleState();
  const file = JSON.parse(JSON.stringify(E.buildExport(s, new Date('2026-10-26T12:00:00Z'))));
  assert.equal(file.app, 'groundwork');
  assert.equal(file.schema, E.SCHEMA);
  const res = E.validateImport(file);
  assert.equal(res.ok, true);
  assert.deepEqual(res.state, s);
  assert.deepEqual(res.counts, { evidence: 1, custom: 1, days: 2, favorites: 1 });
});

test('import: rejects files that are not Groundwork backups or are from a newer version', () => {
  assert.equal(E.validateImport(null).ok, false);
  assert.equal(E.validateImport({ hello: 1 }).ok, false);
  assert.equal(E.validateImport({ app: 'groundwork', data: {} }).ok, false);
  assert.equal(E.validateImport({ app: 'groundwork', schema: 99, data: {} }).ok, false);
  assert.equal(E.validateImport({ app: 'groundwork', schema: 2, data: { evidence: 'x' } }).ok, false);
});

test('import: damaged entries are skipped and counted, valid ones kept', () => {
  const res = E.validateImport({
    app: 'groundwork', schema: 2,
    data: {
      evidence: [{ text: 'ok', date: '2026-10-01' }, { text: '', date: '2026-10-01' }, { text: 'bad date', date: '2026-13-45' }, 'junk'],
      custom: [{ text: 'fine', moment: 'night' }, { text: 'no moment' }],
      history: ['2026-10-01', 'nope', '2026-10-01']
    }
  });
  assert.equal(res.ok, true);
  assert.equal(res.state.evidence.length, 1);
  assert.ok(res.state.evidence[0].id, 'missing ids are generated');
  assert.equal(res.state.custom.length, 1);
  assert.deepEqual(res.state.history, ['2026-10-01']);
  assert.deepEqual(res.dropped, { evidence: 3, custom: 1 });
});

test('import: text is never interpreted, only stored (very long text is capped)', () => {
  const long = 'x'.repeat(5000);
  const res = E.validateImport({ app: 'groundwork', schema: 2, data: { evidence: [{ text: '<img src=x onerror=alert(1)>' + long, date: '2026-10-01' }] } });
  assert.equal(res.state.evidence[0].text.length, 500);
});

test('merge: adds new data, keeps existing, no duplicates', () => {
  const current = sampleState();
  const incoming = E.normalizeState({
    evidence: [
      { id: 'e1', text: 'Win', date: '2026-10-20' },          // same id
      { id: 'other', text: 'Win', date: '2026-10-20' },       // same content, different id
      { id: 'e9', text: 'New win', date: '2026-10-21' }
    ],
    custom: [{ id: 'c1', text: 'Mine', moment: 'morning' }, { id: 'c9', text: 'New', moment: 'night' }],
    history: ['2026-10-25', '2026-10-26'],
    prefs: { focus: ['anxiety'], onboarded: true },
    feedback: { favorites: ['nt-g1'], hidden: [], helpful: { 'mo-g1': 1, 'nt-g1': 3 } },
    seen: { 'mo-g1': '2026-10-26' }
  }).state;
  const { state, added } = E.mergeState(current, incoming);
  assert.deepEqual(ids(state.evidence), ['e1', 'e9']);
  assert.deepEqual(ids(state.custom), ['c1', 'c9']);
  assert.deepEqual(state.history, ['2026-10-24', '2026-10-25', '2026-10-26']);
  assert.deepEqual(state.prefs.focus, ['money'], 'existing focus wins');
  assert.equal(state.prefs.showActions, false);
  assert.deepEqual(state.feedback.favorites, ['mo-g1', 'nt-g1']);
  assert.deepEqual(state.feedback.hidden, ['mo-s1']);
  assert.deepEqual(state.feedback.helpful, { 'mo-g1': 2, 'nt-g1': 3 });
  assert.equal(state.seen['mo-g1'], '2026-10-26');
  assert.deepEqual(added, { evidence: 1, custom: 1, days: 1 });
  // the original is not mutated
  assert.equal(current.evidence.length, 1);
});

test('merge: an empty current state takes the incoming focus', () => {
  const empty = E.normalizeState({}).state;
  const { state } = E.mergeState(empty, sampleState());
  assert.deepEqual(state.prefs.focus, ['money']);
  assert.equal(state.evidence.length, 1);
});

test('dates: local keys, validation and day differences across DST', () => {
  assert.equal(E.isDateKey('2026-02-29'), false);
  assert.equal(E.isDateKey('2028-02-29'), true);
  assert.equal(E.daysBetween('2026-03-07', '2026-03-09'), 2);
  assert.equal(E.daysBetween('2026-10-31', '2026-11-02'), 2);
});
