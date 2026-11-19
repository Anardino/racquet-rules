// Racquet Rules: a static learning page. Content lives in content/ (see README.md).
// Every question shows its answer and the reason right after the pick.
// A missed question comes back a few questions later, until the player gets it right.
// A question is "learned" after two right answers in a row.
// Addresses: #/<sport>/<rules>                 chapter list
//            #/<sport>/<rules>/<chapter>       chapter page (key points, Learn)
//            #/<sport>/<rules>/<chapter>/learn  the chapter's questions
//            #/<sport>/<rules>/mixed           questions from all chapters
(function () {
  'use strict';

  var STORE = 'racquet-rules-v1';
  var MIXED_SIZE = 15;
  var ROUND = 7;        // questions before a short check screen
  var LEARNED = 2;      // right answers in a row that make a question "learned"
  var COME_BACK = 4;    // a missed question returns this many questions later

  var app = document.getElementById('app');
  var sourceLine = document.getElementById('source');
  var catalog = null;
  var packs = {};   // rules path -> { chapters: { id: file data } }
  var run = null;   // the questions in progress

  // ----- small helpers

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  // seen: question key -> right answers in a row (0 after a miss). at: rules path -> last chapter studied.
  function readStore() {
    var s = null;
    try { s = JSON.parse(localStorage.getItem(STORE)); } catch (e) { s = null; }
    s = s || {};
    s.seen = s.seen || {};
    s.at = s.at || {};
    return s;
  }

  function saveStore(s) {
    try { localStorage.setItem(STORE, JSON.stringify(s)); } catch (e) { /* private window: play without saving */ }
  }

  function shuffle(list) {
    var a = list.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  function getJson(url) {
    return fetch(url).then(function (r) {
      if (!r.ok) throw new Error(url + ': ' + r.status);
      return r.json();
    });
  }

  function byId(list, id) {
    for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
    return null;
  }

  function loadPack(ctx) {
    if (packs[ctx.path]) return Promise.resolve(packs[ctx.path]);
    var base = 'content/' + ctx.path + '/';
    var jobs = ctx.chapters.map(function (c) { return getJson(base + c.file); });
    return Promise.all(jobs).then(function (res) {
      var pack = { chapters: {} };
      ctx.chapters.forEach(function (c, i) { pack.chapters[c.id] = res[i]; });
      packs[ctx.path] = pack;
      return pack;
    });
  }

  function show(html, focusSel, keepScroll) {
    app.innerHTML = html;
    if (!keepScroll) window.scrollTo(0, 0);
    var f = focusSel && app.querySelector(focusSel);
    if (f) f.focus({ preventScroll: true });
  }

  // Focus screen: while a question is open, hide the page header and footer.
  function setFocus(on) { document.body.classList.toggle('focus', !!on); }

  function home(sport, ctx) { return '#/' + sport.id + '/' + ctx.id; }

  function plural(n, one, many) { return n + ' ' + (n === 1 ? one : many); }

  // ----- routing

  function route() {
    var hash = location.hash;
    var p = hash.replace(/^#\/?/, '').split('/').filter(Boolean);
    var store = readStore();
    run = null;
    setFocus(false);
    sourceLine.textContent = '';

    if (!p[0]) {
      var last = store.last && byId(catalog.sports, store.last.sport) ? store.last : catalog.defaults;
      location.replace('#/' + last.sport + '/' + last.context);
      return;
    }
    var sport = byId(catalog.sports, p[0]);
    if (!sport) { location.replace('#/' + catalog.defaults.sport + '/' + catalog.defaults.context); return; }
    if (!sport.contexts.length) { show(pickers(sport, null) + '<div class="card"><p>' + esc(sport.name) + ' rules are coming soon.</p></div>'); return; }
    var ctx = byId(sport.contexts, p[1]);
    if (!ctx) { location.replace(home(sport, sport.contexts[0])); return; }

    store.last = { sport: sport.id, context: ctx.id };
    saveStore(store);
    // the source line is a list of plain text and { text, url } links to the documents
    sourceLine.innerHTML = (ctx.source || []).map(function (part) {
      return typeof part === 'string' ? esc(part) :
        '<a href="' + esc(part.url) + '" target="_blank" rel="noopener">' + esc(part.text) + '</a>';
    }).join('');
    if (!packs[ctx.path]) show('<p class="muted">Loading.</p>');

    loadPack(ctx).then(function (pack) {
      if (location.hash !== hash) return;   // the player moved on while it loaded
      var page = p[2];
      var chapter = page && byId(ctx.chapters, page);
      if (!page) viewHome(sport, ctx, pack);
      else if (page === 'mixed') startRun({ sport: sport, ctx: ctx, pack: pack, chapter: null });
      else if (chapter && p[3] === 'learn') startRun({ sport: sport, ctx: ctx, pack: pack, chapter: chapter });
      else if (chapter && !p[3]) viewChapter(sport, ctx, pack, chapter);
      else location.replace(home(sport, ctx));
    }).catch(function () {
      show('<div class="card"><p>Could not load the questions. Check your connection and try again.</p>' +
        '<div class="btns"><button class="btn primary" data-act="reload">Try again</button></div></div>');
    });
  }

  // ----- chapter list

  function pickers(sport, ctx) {
    var h = '<div class="pick"><span class="lab">Sport</span><div class="chips">';
    catalog.sports.forEach(function (s) {
      var to = s.contexts.length ? home(s, s.contexts[0]) : '#/' + s.id;
      h += '<a class="chip" href="' + to + '"' + (s === sport ? ' aria-current="true"' : '') + '>' + esc(s.name) + '</a>';
    });
    h += '</div>';
    if (sport.contexts.length) {
      h += '<span class="lab">Rules</span><div class="chips">';
      sport.contexts.forEach(function (c) {
        h += '<a class="chip" href="' + home(sport, c) + '"' + (c === ctx ? ' aria-current="true"' : '') + '>' + esc(c.name) + '</a>';
      });
      h += '</div>';
    }
    return h + '</div>';
  }

  // Three levels: new (never answered), still learning, learned (two right answers in a row).
  function isLearned(store, key) { return store.seen[key] >= LEARNED; }

  function chapterStats(ctx, pack, chapter, store) {
    var qs = pack.chapters[chapter.id].questions;
    var learned = 0, learning = 0;
    qs.forEach(function (q) {
      var v = store.seen[ctx.path + '/' + q.id];
      if (v >= LEARNED) learned++;
      else if (v !== undefined) learning++;
    });
    return { total: qs.length, learned: learned, learning: learning };
  }

  function meter(st) {
    return '<span class="meter"><i style="width:' + (100 * st.learned / st.total) + '%"></i>' +
      '<i class="part" style="width:' + (100 * st.learning / st.total) + '%"></i></span>';
  }

  // The chapter to go back to: the last one studied, or the next one that still has questions to learn.
  function jumpChapter(ctx, pack, store) {
    var start = -1;
    ctx.chapters.forEach(function (c, i) { if (c.id === store.at[ctx.path]) start = i; });
    if (start < 0) return null;
    for (var k = 0; k < ctx.chapters.length; k++) {
      var c = ctx.chapters[(start + k) % ctx.chapters.length];
      var st = chapterStats(ctx, pack, c, store);
      if (st.learned < st.total) return { chapter: c, st: st };
    }
    return null;
  }

  function viewHome(sport, ctx, pack) {
    var store = readStore();
    var h = pickers(sport, ctx);
    if (ctx.note) h += '<p class="muted">' + esc(ctx.note) + '</p>';
    var jump = jumpChapter(ctx, pack, store);
    if (jump) {
      h += '<a class="card jump" href="' + home(sport, ctx) + '/' + jump.chapter.id + '/learn">' +
        '<span class="lab">Jump back in</span><span class="name">' + esc(jump.chapter.name) + '</span>' +
        '<span class="sub">' + jump.st.learned + ' of ' + jump.st.total + ' learned. ' + (jump.st.total - jump.st.learned) + ' to go.</span>' +
        '<span class="go">Continue</span></a>';
    }
    h += '<div class="btns"><a class="btn' + (jump ? '' : ' primary') + '" href="' + home(sport, ctx) + '/mixed">Mixed questions<small>' + MIXED_SIZE + ' from all chapters</small></a></div><h2>Chapters</h2>';
    ctx.chapters.forEach(function (c, i) {
      var st = chapterStats(ctx, pack, c, store);
      h += '<a class="card ch" href="' + home(sport, ctx) + '/' + c.id + '">' +
        '<span class="num">' + (i + 1) + '</span><span class="name">' + esc(c.name) + '</span>' +
        '<span class="sub">' + st.total + ' questions. ' + st.learned + ' learned' +
        (st.learning ? ', ' + st.learning + ' still learning' : '') + '.</span>' + meter(st) + '</a>';
    });
    show(h);
  }

  // ----- chapter page

  function viewChapter(sport, ctx, pack, chapter) {
    var data = pack.chapters[chapter.id];
    var st = chapterStats(ctx, pack, chapter, readStore());
    var left = st.total - st.learned;
    var here = home(sport, ctx) + '/' + chapter.id;
    var h = '<a class="crumb" href="' + home(sport, ctx) + '">All chapters</a><h2 tabindex="-1">' + esc(chapter.name) + '</h2>';
    h += '<div class="btns"><a class="btn primary" href="' + here + '/learn">' + (left ? 'Learn' : 'Review') + '<small>' +
      (left ? plural(left, 'question', 'questions') + ' to learn, answer after each one' : 'All learned. Go through them again.') + '</small></a></div>';
    h += '<p class="stat">Learned: ' + st.learned + ' of ' + st.total + '.' + (st.learning ? ' Still learning: ' + st.learning + '.' : '') + '</p>';
    if (data.points && data.points.length) {
      h += '<details class="card points" open><summary>Key points</summary><ul>' +
        data.points.map(function (pt) { return '<li>' + esc(pt) + '</li>'; }).join('') + '</ul></details>';
    }
    show(h, 'h2');
  }

  // ----- questions

  function makeItem(spec, chapter, q) {
    var order = q.options.map(function (o, i) { return i; });
    return {
      q: q,
      key: spec.ctx.path + '/' + q.id,
      chapterName: chapter.name,
      local: !!(q.local || spec.pack.chapters[chapter.id].local),
      order: q.keep ? order : shuffle(order),
      picked: null,
      again: false   // true for a missed question that came back
    };
  }

  // A chapter run asks the questions not learned yet, in the guide's order (all of them once all are learned).
  // A mixed run draws from every chapter, new and still learning questions first.
  function startRun(spec) {
    var store = readStore();
    var items;
    if (spec.chapter) {
      var qs = spec.pack.chapters[spec.chapter.id].questions;
      var todo = qs.filter(function (q) { return !isLearned(store, spec.ctx.path + '/' + q.id); });
      items = (todo.length ? todo : qs).map(function (q) { return makeItem(spec, spec.chapter, q); });
      store.at[spec.ctx.path] = spec.chapter.id;
      saveStore(store);
    } else {
      var open = [], done = [];
      spec.ctx.chapters.forEach(function (c) {
        spec.pack.chapters[c.id].questions.forEach(function (q) {
          var it = makeItem(spec, c, q);
          (isLearned(store, it.key) ? done : open).push(it);
        });
      });
      items = shuffle(shuffle(open).concat(shuffle(done)).slice(0, MIXED_SIZE));
    }
    run = { spec: spec, items: items, at: 0, round: 1, gained: 0 };
    startRound();
    viewQuestion();
  }

  // A round is ROUND questions. A short tail of one or two questions joins the round before it.
  function startRound() {
    var end = run.at + ROUND;
    run.roundStart = run.at;
    run.roundEnd = run.items.length - end <= 2 ? run.items.length : end;
  }

  function backLink() {
    var s = run.spec;
    return home(s.sport, s.ctx) + (s.chapter ? '/' + s.chapter.id : '');
  }

  function viewQuestion() {
    var it = run.items[run.at];
    var q = it.q;
    var answered = it.picked !== null;
    var pos = run.at - run.roundStart;
    var size = run.roundEnd - run.roundStart;
    var rounds = run.round > 1 || run.roundEnd < run.items.length;
    setFocus(true);
    var h = '<div class="bar"><a href="' + backLink() + '">Quit</a><span>' + (rounds ? 'Round ' + run.round + '. ' : '') +
      'Question ' + (pos + 1) + ' of ' + size + '</span></div>' +
      '<div class="meter"><i style="width:' + Math.round(100 * (pos + (answered ? 1 : 0)) / size) + '%"></i></div>' +
      '<div class="card quiz"><div class="tags">' +
      (run.spec.chapter ? '' : '<span class="tag">' + esc(it.chapterName) + '</span>') +
      (it.local && run.spec.ctx.localLabel ? '<span class="tag local">' + esc(run.spec.ctx.localLabel) + '</span>' : '') +
      (it.again ? '<span class="tag again">Back again</span>' : '') +
      '</div><h2 class="q" tabindex="-1">' + esc(q.q) + '</h2><div class="opts">';
    it.order.forEach(function (oi, n) {
      var cls = 'opt';
      if (answered && oi === q.answer) cls += ' right';
      else if (answered && oi === it.picked) cls += ' wrong';
      h += '<button type="button" class="' + cls + '" data-act="pick" data-i="' + oi + '"' + (answered ? ' disabled' : '') + '>' +
        '<span class="letter">' + 'ABCD'.charAt(n) + '</span><span>' + esc(q.options[oi]) + '</span></button>';
    });
    h += '</div>';
    if (answered) {
      var ok = it.picked === q.answer;
      h += '<div class="fb' + (ok ? '' : ' no') + '" role="status"><strong>' + (ok ? 'Right.' : 'Not quite. This one will come back.') + '</strong>' +
        esc(q.why) + '<span class="ref">' + esc(q.ref) + '</span></div>';
    }
    h += '</div>';
    // the Next button sits in a bar at the bottom of the screen on phones
    if (answered) {
      h += '<div class="dock"><button type="button" class="btn primary" data-act="next">' +
        (run.at + 1 < run.items.length ? 'Next' : 'See my result') + '</button></div>';
    }
    show(h, answered ? '[data-act="next"]' : 'h2.q', answered);
    var fb = answered && app.querySelector('.fb');
    if (fb && fb.scrollIntoView) fb.scrollIntoView({ block: 'nearest' });
  }

  function pick(i) {
    var it = run.items[run.at];
    if (it.picked !== null) return;
    it.picked = i;
    var ok = i === it.q.answer;
    var store = readStore();
    var before = store.seen[it.key] || 0;
    var now = ok ? Math.min(LEARNED, before + 1) : 0;
    if (now === LEARNED && before < LEARNED) run.gained++;
    store.seen[it.key] = now;
    saveStore(store);
    if (!ok) {
      // the missed question comes back a few questions later, with its options in a new order
      var copy = { q: it.q, key: it.key, chapterName: it.chapterName, local: it.local,
        order: it.q.keep ? it.order : shuffle(it.order), picked: null, again: true };
      run.items.splice(Math.min(run.at + COME_BACK, run.items.length), 0, copy);
    }
    viewQuestion();
  }

  function next() {
    run.at++;
    if (run.at >= run.items.length) viewResult();
    else if (run.at < run.roundEnd) viewQuestion();
    else if (run.items.length - run.at <= 2) { run.roundEnd = run.items.length; viewQuestion(); }
    else viewCheck();
  }

  // Short stop between rounds.
  function viewCheck() {
    var part = run.items.slice(run.roundStart, run.roundEnd);
    var right = part.filter(function (it) { return it.picked === it.q.answer; }).length;
    var left = run.items.length - run.at;
    var line = right === part.length ? 'All right. Keep going.' :
      right >= part.length / 2 ? 'Good. The ones you missed come back until you know them.' :
      'Take your time. The ones you missed come back until you know them.';
    setFocus(true);
    show('<div class="bar"><a href="' + backLink() + '">Quit</a><span>Round ' + run.round + ' done</span></div>' +
      '<div class="card"><p class="score">' + right + ' of ' + part.length + '</p><p>' + line + '</p>' +
      '<p class="muted">' + plural(left, 'question', 'questions') + ' left. Your progress is saved.</p></div>' +
      '<div class="dock"><button type="button" class="btn primary" data-act="go">Keep going</button></div>' +
      '<div class="btns"><a class="btn" href="' + backLink() + '">Stop here</a></div>', '[data-act="go"]');
  }

  function viewResult() {
    var s = run.spec;
    var firsts = run.items.filter(function (it) { return !it.again; });
    var misses = firsts.filter(function (it) { return it.picked !== it.q.answer; });
    var n = firsts.length;
    var score = n - misses.length;
    var ratio = score / n;
    var line = ratio === 1 ? 'Perfect.' :
      ratio >= 0.8 ? 'Well done. You know this.' :
      ratio >= 0.5 ? 'Good start. Look at the ones you missed.' :
      'Read the key points, then try again.';
    var st = s.chapter ? chapterStats(s.ctx, s.pack, s.chapter, readStore()) : null;
    var left = st ? st.total - st.learned : 0;
    setFocus(false);
    var h = '<h2 tabindex="-1">' + esc(s.chapter ? s.chapter.name : 'Mixed questions') + '</h2>' +
      '<div class="card"><p class="score">' + score + ' of ' + n + '</p><p class="muted">right at the first try</p><p>' + line + '</p>' +
      (run.gained ? '<p>You learned ' + plural(run.gained, 'question', 'questions') + ' in this run.</p>' : '') +
      (st ? '<p class="stat">Learned in this chapter: ' + st.learned + ' of ' + st.total + '.</p>' : '') +
      (left ? '<p class="muted">A question counts as learned after two right answers in a row.</p>' : '') +
      '</div><div class="btns">' +
      '<button type="button" class="btn primary" data-act="again">' +
      (!s.chapter ? 'New mix' : left ? 'Keep learning<small>' + left + ' to go</small>' : 'Review again') + '</button>' +
      '<a class="btn" href="' + home(s.sport, s.ctx) + '">All chapters</a></div>';
    if (misses.length) {
      h += '<h2>The ones you missed</h2>';
      misses.forEach(function (it) {
        h += '<div class="card miss"><p class="mq">' + esc(it.q.q) + '</p>' +
          '<p class="yours">Your answer: ' + esc(it.q.options[it.picked]) + '</p>' +
          '<p class="good">Right answer: ' + esc(it.q.options[it.q.answer]) + '</p>' +
          '<p>' + esc(it.q.why) + '<span class="ref">' + esc(it.q.ref) + '</span></p></div>';
      });
    }
    show(h, 'h2');
  }

  // ----- clicks

  document.addEventListener('click', function (e) {
    var b = e.target.closest ? e.target.closest('[data-act], #clear') : null;
    if (!b) return;
    if (b.id === 'clear') {
      if (window.confirm('Clear your progress in this browser?')) {
        var last = readStore().last;
        saveStore({ last: last });
        route();
      }
      return;
    }
    var act = b.getAttribute('data-act');
    if (act === 'reload') route();
    else if (!run) return;
    else if (act === 'pick') pick(Number(b.getAttribute('data-i')));
    else if (act === 'next') next();
    else if (act === 'go') { run.round++; startRound(); viewQuestion(); }
    else if (act === 'again') startRun(run.spec);
  });

  window.addEventListener('hashchange', route);

  getJson('content/catalog.json').then(function (c) {
    catalog = c;
    route();
  }).catch(function () {
    app.innerHTML = '<div class="card"><p>Could not load the page. Check your connection and reload.</p></div>';
  });
})();
