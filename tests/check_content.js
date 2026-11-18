// Checks every content file the page will load. Run with: npm test
'use strict';
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const errors = [];
const err = (where, msg) => errors.push(where + ': ' + msg);

function readJson(file) {
  try { return JSON.parse(fs.readFileSync(path.join(root, file), 'utf8')); }
  catch (e) { err(file, 'cannot read: ' + e.message); return null; }
}

// Andrea's rule: no dashes in anything players read (hyphens inside words are fine).
function noDashes(where, value) {
  if (typeof value === 'string') {
    if (/[‒-―]/.test(value) || / - /.test(value)) err(where, 'has a dash: "' + value.slice(0, 60) + '"');
  } else if (value && typeof value === 'object') {
    Object.keys(value).forEach(k => noDashes(where, value[k]));
  }
}

const text = v => typeof v === 'string' && v.trim().length > 0;
const idOk = v => typeof v === 'string' && /^[a-z0-9]+(-[a-z0-9]+)*$/.test(v);

const catalog = readJson('content/catalog.json');
let chapters = 0, questions = 0;

if (catalog) {
  noDashes('catalog.json', catalog);
  const defSport = (catalog.sports || []).find(s => s.id === (catalog.defaults || {}).sport);
  if (!defSport || !defSport.contexts.find(c => c.id === catalog.defaults.context)) err('catalog.json', 'defaults do not point to a sport and rules that exist');

  (catalog.sports || []).forEach(sport => {
    if (!idOk(sport.id) || !text(sport.name)) err('catalog.json', 'sport needs an id and a name');
    (sport.contexts || []).forEach(ctx => {
      const at = sport.id + '/' + ctx.id;
      if (!idOk(ctx.id) || !text(ctx.name) || !text(ctx.path)) err(at, 'rules need id, name and path');
      if (!Array.isArray(ctx.chapters) || !ctx.chapters.length) err(at, 'no chapters');
      if ('source' in ctx) {
        const ok = Array.isArray(ctx.source) && ctx.source.every(p => text(p) || (p && text(p.text) && /^https:\/\//.test(p.url || '')));
        if (!ok) err(at, 'source must be a list of text and { text, url } links (https)');
      }
      const seen = {};
      const reserved = ['mixed'];

      (ctx.chapters || []).forEach(ch => {
        const where = at + '/' + ch.id;
        if (!idOk(ch.id) || reserved.includes(ch.id)) err(where, 'bad chapter id');
        if (!text(ch.name) || !text(ch.file)) err(where, 'chapter needs a name and a file');
        const data = readJson('content/' + ctx.path + '/' + ch.file);
        if (!data) return;
        chapters++;
        noDashes(where, data);
        if (!Array.isArray(data.points) || !data.points.length || !data.points.every(text)) err(where, 'needs key points');
        if (!Array.isArray(data.questions) || data.questions.length < 5) err(where, 'needs at least 5 questions');
        (data.questions || []).forEach(q => {
          const w = where + ' ' + q.id;
          questions++;
          if (!idOk(q.id)) err(w, 'bad question id');
          if (seen[q.id]) err(w, 'id used twice');
          seen[q.id] = true;
          if (!text(q.q)) err(w, 'no question text');
          if (!Array.isArray(q.options) || q.options.length < 2 || q.options.length > 4 || !q.options.every(text)) err(w, 'needs 2 to 4 options');
          else if (new Set(q.options).size !== q.options.length) err(w, 'same option twice');
          if (!Number.isInteger(q.answer) || !q.options || q.answer < 0 || q.answer >= q.options.length) err(w, 'answer must be the number of an option, starting at 0');
          if (!text(q.why)) err(w, 'no explanation');
          if (!text(q.ref)) err(w, 'no reference');
          ['local', 'keep'].forEach(k => { if (k in q && typeof q[k] !== 'boolean') err(w, k + ' must be true or false'); });
        });
      });
    });
  });
}

// the page's own words
['index.html', 'app.js'].forEach(f => {
  const s = fs.readFileSync(path.join(root, f), 'utf8');
  if (/[‒-―]/.test(s)) err(f, 'has a dash');
});

if (errors.length) {
  console.error(errors.join('\n'));
  console.error('\n' + errors.length + ' problem(s).');
  process.exit(1);
}
console.log('Content OK: ' + chapters + ' chapters, ' + questions + ' questions.');
