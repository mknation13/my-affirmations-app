/* Groundwork content: affirmations, small actions and evidence prompts.
 *
 * Every affirmation has:
 *   id      stable id (feedback and history are stored against it, so never reuse or renumber)
 *   text    the statement
 *   tone    gentle (fits a rough day), steady (an okay day) or bright (a good day)
 *   moments where it fits: morning, hard, setback, night, or 'any'
 *   focus   focus areas it belongs to; [] means it suits anyone
 *   softer  optional, a smaller and more believable version used by "This doesn't feel believable"
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.GWContent = factory();
})(this, function () {
  'use strict';

  var MOMENTS = [
    { id: 'morning', name: 'Morning', short: 'Morning' },
    { id: 'hard', name: 'Before a hard task', short: 'Hard task' },
    { id: 'setback', name: 'After a setback', short: 'Setback' },
    { id: 'night', name: 'Winding down at night', short: 'Night' }
  ];

  var FOCUS_AREAS = [
    { id: 'anxiety', name: 'Anxiety' },
    { id: 'money', name: 'Financial stress' },
    { id: 'motivation', name: 'Motivation' },
    { id: 'selfworth', name: 'Self-worth' },
    { id: 'confidence', name: 'Confidence' },
    { id: 'burnout', name: 'Burnout' },
    { id: 'relationships', name: 'Relationships' },
    { id: 'setbacks', name: 'Setbacks' }
  ];

  function a(id, tone, moments, focus, text, softer) {
    var item = { id: id, tone: tone, moments: moments, focus: focus, text: text };
    if (softer) item.softer = softer;
    return item;
  }

  var ANY = ['any'];

  var AFFIRMATIONS = [
    // ---- Morning (general) ----
    a('mo-g1', 'gentle', ['morning'], [], "I don't have to feel ready to begin."),
    a('mo-g2', 'gentle', ['morning'], [], 'Today can be a slow day and still count.'),
    a('mo-g3', 'gentle', ['morning'], [], 'I only need to handle the next hour.'),
    a('mo-g4', 'gentle', ['morning'], [], 'I can be tired and still be kind to myself.'),
    a('mo-s1', 'steady', ['morning'], [], "I don't have to feel motivated to take one small step."),
    a('mo-s2', 'steady', ['morning'], [], 'I can be uncertain and still move forward.'),
    a('mo-s3', 'steady', ['morning'], [], 'One clear priority is enough for today.'),
    a('mo-s4', 'steady', ['morning'], [], 'I can start small and adjust as I go.'),
    a('mo-b1', 'bright', ['morning'], [], 'I have energy today, and I can use it well.', 'I can use the energy I have, however much it is.'),
    a('mo-b2', 'bright', ['morning'], [], "I can build on what's already working.", "Something is working, even if it's small."),
    a('mo-b3', 'bright', ['morning'], [], "Today is a good day to try something I've been putting off.", "I can take one small step on something I've been putting off."),
    a('mo-b4', 'bright', ['morning'], [], 'I trust myself to make good choices today.', 'I can make one decent choice at a time.'),

    // ---- Before a hard task (general) ----
    a('hd-g1', 'gentle', ['hard'], [], 'I can feel anxious and still do this.'),
    a('hd-g2', 'gentle', ['hard'], [], 'Doing it imperfectly is still doing it.'),
    a('hd-g3', 'gentle', ['hard'], [], 'I can take a break and come back to this.'),
    a('hd-g4', 'gentle', ['hard'], [], 'Asking for help is a reasonable thing to do.'),
    a('hd-s1', 'steady', ['hard'], [], 'I have handled difficult things before.'),
    a('hd-s2', 'steady', ['hard'], [], 'I only need to focus on the first step.'),
    a('hd-s3', 'steady', ['hard'], [], 'Hard is not the same as impossible.'),
    a('hd-s4', 'steady', ['hard'], [], 'I can figure this out one piece at a time.'),
    a('hd-b1', 'bright', ['hard'], [], "I'm prepared enough to begin.", "I don't have to be fully prepared to begin."),
    a('hd-b2', 'bright', ['hard'], [], 'Feeling pressure means this matters to me.', 'This feels hard because it matters to me.'),
    a('hd-b3', 'bright', ['hard'], [], "I've done the work, and I can trust it.", "Some of the work is done, and that counts."),
    a('hd-b4', 'bright', ['hard'], [], 'I can meet this with focus and curiosity.', 'I can give this my attention for a few minutes.'),

    // ---- After a setback (general) ----
    a('sb-g1', 'gentle', ['setback'], [], "A difficult day doesn't erase the progress I've made."),
    a('sb-g2', 'gentle', ['setback'], [], "It's okay to be disappointed. It will pass."),
    a('sb-g3', 'gentle', ['setback'], [], "I don't have to fix everything right now."),
    a('sb-g4', 'gentle', ['setback'], [], "One bad moment doesn't define me."),
    a('sb-s1', 'steady', ['setback'], [], 'Mistakes are information, not a verdict.'),
    a('sb-s2', 'steady', ['setback'], [], 'I can take what I learned and try again.'),
    a('sb-s3', 'steady', ['setback'], [], 'Setbacks are part of doing things that matter.'),
    a('sb-s4', 'steady', ['setback'], [], "I've recovered from setbacks before."),
    a('sb-b1', 'bright', ['setback'], [], "I'm steady enough to look at this honestly.", 'I can look at this honestly when I am ready.'),
    a('sb-b2', 'bright', ['setback'], [], 'This can make my next attempt better.', 'I can learn one thing from this.'),
    a('sb-b3', 'bright', ['setback'], [], 'This is one moment among many.', 'This moment is hard, and it is not the whole story.'),
    a('sb-b4', 'bright', ['setback'], [], 'I still have what it takes to move forward.', 'I can take one small step forward from here.'),

    // ---- Winding down at night (general) ----
    a('nt-g1', 'gentle', ['night'], [], "Rest is allowed, even when everything isn't finished."),
    a('nt-g2', 'gentle', ['night'], [], "I made it through today. That's enough."),
    a('nt-g3', 'gentle', ['night'], [], 'I can set today down for now.'),
    a('nt-g4', 'gentle', ['night'], [], 'Tomorrow I can start again.'),
    a('nt-s1', 'steady', ['night'], [], 'I did what I could with what I had today.'),
    a('nt-s2', 'steady', ['night'], [], 'Unfinished tasks can wait until tomorrow.'),
    a('nt-s3', 'steady', ['night'], [], 'I can let my mind slow down now.'),
    a('nt-s4', 'steady', ['night'], [], 'Today had good parts, even if they were small.'),
    a('nt-b1', 'bright', ['night'], [], 'I can feel good about what I did today.', 'I can notice one thing I did today.'),
    a('nt-b2', 'bright', ['night'], [], 'I can enjoy this calm without rushing to the next thing.', 'I can let this be a quiet moment.'),
    a('nt-b3', 'bright', ['night'], [], 'Something went right today, and I noticed it.', 'Something small went okay today.'),
    a('nt-b4', 'bright', ['night'], [], "I'm ending today in a good place.", 'I can end today a little more gently than it started.'),

    // ---- Anxiety ----
    a('fx-g1', 'gentle', ANY, ['anxiety'], 'This feeling is uncomfortable, and it will pass.'),
    a('fx-g2', 'gentle', ANY, ['anxiety'], 'I can breathe more slowly than my thoughts are moving.'),
    a('fx-g3', 'gentle', ['night'], ['anxiety'], "I don't have to solve every what-if tonight."),
    a('fx-s1', 'steady', ANY, ['anxiety'], 'A worry is a guess about the future, not a fact.'),
    a('fx-s2', 'steady', ANY, ['anxiety'], "I've felt this way before and gotten through it."),
    a('fx-s3', 'steady', ['hard', 'morning'], ['anxiety'], "I can focus on what's in front of me right now."),
    a('fx-b1', 'bright', ANY, ['anxiety'], "I'm getting better at noticing anxiety without obeying it.", 'I can notice anxiety for a moment before I react.'),

    // ---- Financial stress ----
    a('mn-g1', 'gentle', ANY, ['money'], "Money stress is heavy, and it isn't a measure of my worth."),
    a('mn-g2', 'gentle', ANY, ['money'], 'I can look at one number today without fixing everything.'),
    a('mn-g3', 'gentle', ['night'], ['money'], 'The numbers will be the same tomorrow. I can rest tonight.'),
    a('mn-s1', 'steady', ANY, ['money'], "Avoiding it won't make it smaller. Looking at it is a step."),
    a('mn-s2', 'steady', ANY, ['money'], 'One sensible decision is still progress.'),
    a('mn-s3', 'steady', ANY, ['money'], 'A rough plan is better than a vague worry.'),
    a('mn-b1', 'bright', ANY, ['money'], "I'm building better habits with money, step by step.", 'I can make one money choice today that helps a little.'),

    // ---- Motivation ----
    a('mv-g1', 'gentle', ANY, ['motivation'], 'Starting badly still counts as starting.'),
    a('mv-g2', 'gentle', ANY, ['motivation'], 'I can lower the bar and still clear it.'),
    a('mv-s1', 'steady', ANY, ['motivation'], 'Action often comes before motivation, not after.'),
    a('mv-s2', 'steady', ['morning', 'hard'], ['motivation'], 'Five minutes is enough to begin.'),
    a('mv-s3', 'steady', ANY, ['motivation'], 'I only need to know the first step, not the whole path.'),
    a('mv-b1', 'bright', ANY, ['motivation'], "There's momentum here, and I can keep it going.", 'One small thing done today keeps me moving.'),

    // ---- Self-worth ----
    a('sw-g1', 'gentle', ANY, ['selfworth'], "My worth isn't up for review based on today."),
    a('sw-g2', 'gentle', ANY, ['selfworth'], "I'm allowed to take up space while I'm still figuring things out."),
    a('sw-s1', 'steady', ANY, ['selfworth'], "I can treat myself the way I'd treat someone I care about."),
    a('sw-s2', 'steady', ['setback', 'night'], ['selfworth'], 'A mistake is something I did, not something I am.'),
    a('sw-s3', 'steady', ANY, ['selfworth'], "I don't have to earn basic kindness, including my own."),
    a('sw-b1', 'bright', ANY, ['selfworth'], "I'm learning to like who I'm becoming.", 'There are parts of me worth respecting, even today.'),

    // ---- Confidence ----
    a('cf-g1', 'gentle', ANY, ['confidence'], 'I can feel unsure and still speak up.'),
    a('cf-g2', 'gentle', ANY, ['confidence'], 'Not knowing yet is part of learning.'),
    a('cf-s1', 'steady', ANY, ['confidence'], "I've been new at things before and figured them out."),
    a('cf-s2', 'steady', ['hard'], ['confidence'], 'My preparation counts, even if I feel nervous.'),
    a('cf-s3', 'steady', ANY, ['confidence'], 'I can trust myself with the next decision.'),
    a('cf-b1', 'bright', ANY, ['confidence'], 'I have skills that are useful here.', "I know more than I'm giving myself credit for."),

    // ---- Burnout ----
    a('bo-g1', 'gentle', ANY, ['burnout'], "I'm tired because I've been carrying a lot. That makes sense."),
    a('bo-g2', 'gentle', ANY, ['burnout'], 'Doing less today is a reasonable choice, not a failure.'),
    a('bo-g3', 'gentle', ['night'], ['burnout'], 'I can stop before I am completely empty.'),
    a('bo-s1', 'steady', ANY, ['burnout'], 'Not everything urgent is important.'),
    a('bo-s2', 'steady', ['hard', 'morning'], ['burnout'], 'Good enough is good enough today.'),
    a('bo-s3', 'steady', ANY, ['burnout'], 'Protecting my energy helps everything else I care about.'),
    a('bo-b1', 'bright', ANY, ['burnout'], "I'm getting better at noticing when I need a break.", 'I can take one real break today.'),

    // ---- Relationships ----
    a('rl-g1', 'gentle', ANY, ['relationships'], 'I can care about someone and still have limits.'),
    a('rl-g2', 'gentle', ['setback', 'night'], ['relationships'], "One hard conversation doesn't have to end a good relationship."),
    a('rl-s1', 'steady', ANY, ['relationships'], 'I can listen without needing to fix everything.'),
    a('rl-s2', 'steady', ['hard'], ['relationships'], 'Saying what I need is fair, even if it feels awkward.'),
    a('rl-s3', 'steady', ANY, ['relationships'], "I'm not responsible for managing everyone's feelings."),
    a('rl-b1', 'bright', ANY, ['relationships'], 'I bring something good to the people around me.', 'Connection can start with one small message.'),

    // ---- Setbacks ----
    a('st-g1', 'gentle', ANY, ['setbacks'], "I'm allowed to be disappointed before I try again."),
    a('st-g2', 'gentle', ['setback', 'night'], ['setbacks'], "This hurts because I cared. That isn't weakness."),
    a('st-s1', 'steady', ANY, ['setbacks'], 'One setback is a data point, not a pattern.'),
    a('st-s2', 'steady', ANY, ['setbacks'], 'I can adjust the plan without giving up the goal.'),
    a('st-s3', 'steady', ANY, ['setbacks'], 'Progress is rarely a straight line.'),
    a('st-b1', 'bright', ANY, ['setbacks'], "I'm someone who gets back up, even if it's slowly.", 'I can take one small step back toward this.')
  ];

  // Small, optional next steps. Shown once at the end of a routine, never tracked as tasks.
  function act(id, focus, moments, text) {
    return { id: id, focus: focus, moments: moments, text: text };
  }

  var ACTIONS = [
    act('ac-fx1', ['anxiety'], ANY, "Name one part of this you can control and one part you can't. Put your energy into the first."),
    act('ac-fx2', ['anxiety'], ANY, 'Breathe out more slowly than you breathe in, five times.'),
    act('ac-fx3', ['anxiety'], ANY, "Write the worry in one sentence, then write what you'd tell a friend who had it."),
    act('ac-mn1', ['money'], ANY, "Open the one account or bill you've been avoiding. Just look. No fixing yet."),
    act('ac-mn2', ['money'], ANY, 'Write down the next bill that is due and its date.'),
    act('ac-mn3', ['money'], ANY, 'Pick one small expense to pause for this week.'),
    act('ac-mv1', ['motivation'], ANY, 'Set a 5-minute timer and start the smallest part of the task.'),
    act('ac-mv2', ['motivation'], ANY, 'Decide the very first physical action, like opening the file or putting on your shoes.'),
    act('ac-mv3', ['motivation'], ANY, "Make the task smaller until it feels almost too easy, then do that version."),
    act('ac-sw1', ['selfworth'], ANY, "Write down one thing you did today that you'd respect in someone else."),
    act('ac-sw2', ['selfworth'], ANY, "Notice one harsh thought about yourself and rewrite it the way a fair friend would say it."),
    act('ac-cf1', ['confidence'], ANY, 'Think of one time you were unsure and it went okay. Add it to your Evidence Bank.'),
    act('ac-cf2', ['confidence'], ['hard'], 'Write down the first sentence you will say or the first step you will take.'),
    act('ac-bo1', ['burnout'], ANY, "Pick one thing to drop, delay, or do at 'good enough' today."),
    act('ac-bo2', ['burnout'], ANY, 'Take ten minutes away from screens. A short walk or a glass of water counts.'),
    act('ac-bo3', ['burnout'], ['night'], 'Write down the one thing you will deal with tomorrow, then close the laptop.'),
    act('ac-rl1', ['relationships'], ANY, 'Send one low-pressure message to someone you trust.'),
    act('ac-rl2', ['relationships'], ['hard'], 'Before a hard conversation, write the one thing you most want them to understand.'),
    act('ac-st1', ['setbacks'], ANY, "Write one sentence about what happened and one thing you'd try differently."),
    act('ac-st2', ['setbacks'], ANY, 'Decide the smallest step that gets you back on track, and when you will take it.'),
    // General fallbacks by moment
    act('ac-mo1', [], ['morning'], 'Choose the one thing that would make today feel worthwhile, and do the first part of it.'),
    act('ac-mo2', [], ['morning'], 'Drink a glass of water before checking your phone again.'),
    act('ac-hd1', [], ['hard'], 'Break the task into three steps and do only the first.'),
    act('ac-hd2', [], ['hard'], 'Set a 10-minute timer and work until it rings. Stopping after that is allowed.'),
    act('ac-sb1', [], ['setback'], 'Step away for five minutes before deciding what to do next.'),
    act('ac-sb2', [], ['setback'], 'Write down one thing that still went okay today.'),
    act('ac-nt1', [], ['night'], "Write tomorrow's first task on paper so your mind can let go of it."),
    act('ac-nt2', [], ['night'], 'Put your phone out of reach for the last ten minutes before sleep.')
  ];

  // Prompts that help people think of evidence they might not count.
  var EVIDENCE_PROMPTS = {
    general: 'e.g. I got through a tough week and still showed up.',
    anxiety: 'e.g. I went to the appointment even though I was nervous.',
    money: 'e.g. I checked my balance instead of avoiding it.',
    motivation: 'e.g. I started the task I had put off for days.',
    selfworth: 'e.g. I said no to something that was not good for me.',
    confidence: 'e.g. I spoke up in the meeting and it went fine.',
    burnout: 'e.g. I took a real break instead of pushing through.',
    relationships: 'e.g. I had an honest conversation and we were okay.',
    setbacks: 'e.g. Things went wrong and I still tried again.'
  };

  return {
    MOMENTS: MOMENTS,
    FOCUS_AREAS: FOCUS_AREAS,
    AFFIRMATIONS: AFFIRMATIONS,
    ACTIONS: ACTIONS,
    EVIDENCE_PROMPTS: EVIDENCE_PROMPTS
  };
});
