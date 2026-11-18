// Racquet Rules: a static learning page. Content lives in content/ (see README.md).
// Every question shows its answer and the reason right after the pick.
// Addresses: #/<sport>/<rules>                 chapter list
//            #/<sport>/<rules>/<chapter>       chapter page (key points, Learn)
//            #/<sport>/<rules>/<chapter>/learn  the chapter's questions
//            #/<sport>/<rules>/mixed           questions from all chapters
(function () {
  'use strict';

  var STORE = 'racquet-rules-v1';
  var MIXED_SIZE = 15;

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

  function readStore() {
    var s = null;
    try { s = JSON.parse(localStorage.getItem(STORE)); } catch (e) { s = null; }
    s = s || {};
    s.seen = s.seen || {};
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

  function show(html, focusSel) {
    app.innerHTML = html;
    window.scrollTo(0, 0);
    var f = focusSel && app.querySelector(focusSel);
    if (f) f.focus({ preventScroll: true });
  }

  function home(sport, ctx) { return '#/' + sport.id + '/' + ctx.id; }

  // ----- routing

  function route() {
    var hash = location.hash;
    var p = hash.replace(/^#\/?/, '').split('/').filter(Boolean);
    var store = readStore();
    run = null;
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

  // "learned" = answered right the last time it came up
  function chapterStats(ctx, pack, chapter, store) {
    var qs = pack.chapters[chapter.id].questions;
    var learned = qs.filter(function (q) { return store.seen[ctx.path + '/' + q.id] === 1; }).length;
    return { total: qs.length, learned: learned };
  }

  function viewHome(sport, ctx, pack) {
    var store = readStore();
    var h = pickers(sport, ctx);
    if (ctx.note) h += '<p class="muted">' + esc(ctx.note) + '</p>';
    h += '<div class="btns"><a class="btn primary" href="' + home(sport, ctx) + '/mixed">Mixed questions<small>' + MIXED_SIZE + ' from all chapters</small></a></div><h2>Chapters</h2>';
    ctx.chapters.forEach(function (c, i) {
      var st = chapterStats(ctx, pack, c, store);
      h += '<a class="card ch" href="' + home(sport, ctx) + '/' + c.id + '">' +
        '<span class="num">' + (i + 1) + '</span><span class="name">' + esc(c.name) + '</span>' +
        '<span class="sub">' + st.total + ' questions. ' + st.learned + ' learned.</span>' +
        '<span class="meter"><i style="width:' + Math.round(100 * st.learned / st.total) + '%"></i></span></a>';
    });
    show(h);
  }

  // ----- chapter page

  function viewChapter(sport, ctx, pack, chapter) {
    var data = pack.chapters[chapter.id];
    var st = chapterStats(ctx, pack, chapter, readStore());
    var here = home(sport, ctx) + '/' + chapter.id;
    var h = '<a class="crumb" href="' + home(sport, ctx) + '">All chapters</a><h2 tabindex="-1">' + esc(chapter.name) + '</h2>';
    h += '<div class="btns"><a class="btn primary" href="' + here + '/learn">Learn<small>' + st.total + ' questions, answer after each one</small></a></div>';
    h += '<p class="stat">Learned: ' + st.learned + ' of ' + st.total + '.</p>';
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
      picked: null
    };
  }

  // A chapter run asks all its questions in the guide's order; a mixed run draws from every chapter.
  function startRun(spec, items) {
    if (!items) {
      if (spec.chapter) {
        items = spec.pack.chapters[spec.chapter.id].questions.map(function (q) { return makeItem(spec, spec.chapter, q); });
      } else {
        var all = [];
        spec.ctx.chapters.forEach(function (c) {
          spec.pack.chapters[c.id].questions.forEach(function (q) { all.push(makeItem(spec, c, q)); });
        });
        items = shuffle(all).slice(0, MIXED_SIZE);
      }
    }
    run = { spec: spec, items: items, at: 0 };
    viewQuestion();
  }

  function backLink() {
    var s = run.spec;
    return home(s.sport, s.ctx) + (s.chapter ? '/' + s.chapter.id : '');
  }

  function viewQuestion() {
    var it = run.items[run.at];
    var q = it.q;
    var answered = it.picked !== null;
    var n = run.items.length;
    var h = '<div class="bar"><a href="' + backLink() + '">Quit</a><span>Question ' + (run.at + 1) + ' of ' + n + '</span></div>' +
      '<div class="meter"><i style="width:' + Math.round(100 * run.at / n) + '%"></i></div>' +
      '<div class="card quiz"><div class="tags">' +
      (run.spec.chapter ? '' : '<span class="tag">' + esc(it.chapterName) + '</span>') +
      (it.local && run.spec.ctx.localLabel ? '<span class="tag local">' + esc(run.spec.ctx.localLabel) + '</span>' : '') +
      '</div><h2 class="q" tabindex="-1">' + esc(q.q) + '</h2><div class="opts">';
    it.order.forEach(function (oi, pos) {
      var cls = 'opt';
      if (answered && oi === q.answer) cls += ' right';
      else if (answered && oi === it.picked) cls += ' wrong';
      h += '<button type="button" class="' + cls + '" data-act="pick" data-i="' + oi + '"' + (answered ? ' disabled' : '') + '>' +
        '<span class="letter">' + 'ABCD'.charAt(pos) + '</span><span>' + esc(q.options[oi]) + '</span></button>';
    });
    h += '</div>';
    if (answered) {
      var ok = it.picked === q.answer;
      h += '<div class="fb' + (ok ? '' : ' no') + '" role="status"><strong>' + (ok ? 'Right.' : 'Not quite.') + '</strong>' +
        esc(q.why) + '<span class="ref">' + esc(q.ref) + '</span></div>' +
        '<div class="btns"><button type="button" class="btn primary" data-act="next">' + (run.at + 1 < n ? 'Next' : 'See my result') + '</button></div>';
    }
    h += '</div>';
    show(h, answered ? '[data-act="next"]' : 'h2.q');
  }

  function pick(i) {
    var it = run.items[run.at];
    if (it.picked !== null) return;
    it.picked = i;
    var store = readStore();
    store.seen[it.key] = i === it.q.answer ? 1 : 0;
    saveStore(store);
    viewQuestion();
  }

  function next() {
    if (run.at + 1 < run.items.length) { run.at++; viewQuestion(); }
    else viewResult();
  }

  function viewResult() {
    var s = run.spec;
    var n = run.items.length;
    var misses = run.items.filter(function (it) { return it.picked !== it.q.answer; });
    var score = n - misses.length;
    var ratio = score / n;
    var line = ratio === 1 ? 'Perfect.' :
      ratio >= 0.8 ? 'Well done. You know this.' :
      ratio >= 0.5 ? 'Good start. Look at the ones you missed.' :
      'Read the key points, then try again.';
    var h = '<h2 tabindex="-1">' + esc(s.chapter ? s.chapter.name : 'Mixed questions') + '</h2>' +
      '<div class="card"><p class="score">' + score + ' of ' + n + '</p><p>' + line + '</p></div><div class="btns">';
    if (misses.length) h += '<button type="button" class="btn primary" data-act="missed">Practice the ones I missed</button>';
    h += '<button type="button" class="btn' + (misses.length ? '' : ' primary') + '" data-act="again">' + (s.chapter ? 'Start again' : 'New mix') + '</button>' +
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
    run.misses = misses;
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
    else if (act === 'again') startRun(run.spec);
    else if (act === 'missed') {
      startRun(run.spec, run.misses.map(function (it) {
        return { q: it.q, key: it.key, chapterName: it.chapterName, local: it.local, order: it.q.keep ? it.order : shuffle(it.order), picked: null };
      }));
    }
  });

  window.addEventListener('hashchange', route);

  getJson('content/catalog.json').then(function (c) {
    catalog = c;
    route();
  }).catch(function () {
    app.innerHTML = '<div class="card"><p>Could not load the page. Check your connection and reload.</p></div>';
  });
})();
