# Racquet Rules

A page where club players learn the rules, one question at a time. Made by members; not an official club or USTA page.

For now it is a learning support only: every question shows the answer and the reason right after the pick. There is no scored test mode.

It is a static page: plain HTML, CSS and JavaScript plus question files. There is no server, no login and no build step. A player's progress is kept in their own browser.

Status: published with GitHub Pages at https://rules.rallygators.com.

## How a player uses it

1. Pick a sport (Tennis is the default) and the rules (USTA is the default).
2. Pick a chapter. Read the key points, then tap **Learn**: the questions of the chapter not learned yet, with the answer and the reason after each one.
3. **Mixed questions** takes 15 questions from all chapters, new and still learning ones first, and works the same way.
4. **Jump back in** on the first screen goes straight to the last chapter studied, or to the next one that still has questions to learn.

How a run works:

- A missed question comes back a few questions later, until the player gets it right.
- Runs are cut in rounds of 7 questions, with a short check screen between rounds.
- A question has three levels: new, still learning, learned. It counts as "learned" after two right answers in a row. A miss sets it back to still learning.
- While a question is open the page shows only the question (no header, no footer). On phones the Next button stays at the bottom of the screen.

Links can point straight to a place, for a QR code or the hub:

- `#/tennis/usta` the chapter list
- `#/tennis/usta/timed` one chapter
- `#/tennis/usta/timed/learn` straight into the questions
- `#/tennis/usta/mixed` the mixed questions

## Files

```
index.html, style.css, app.js     the page
content/catalog.json              sports, rules (contexts), chapters, defaults
content/tennis/usta-chicago-2027/ one file per chapter
tests/check_content.js            checks every content file
tools/serve.js                    local server to try the page
CNAME, .nojekyll                  for GitHub Pages
```

## Where it lives

GitHub Pages serves the `main` branch of the repo `Anardino/racquet-rules` at
https://rules.rallygators.com. The `CNAME` file holds that address. The domain
needs one DNS record at Porkbun: type CNAME, host `rules`, answer `anardino.github.io`.
To update the page: run `npm test`, commit, push. The page changes a minute or two later.

## Try it and check it

```
npm start     # then open http://localhost:8123
npm test      # run after every content change
```

## Content

The Tennis / USTA questions come from the guide "USTA League rules and guidelines for players" (Chicago District). Each question points to its section of the guide.

A chapter file looks like this:

```json
{
  "points": ["Key point shown before the questions."],
  "questions": [
    {
      "id": "serving-01",
      "q": "The question.",
      "options": ["First option", "Second option", "Third option"],
      "answer": 0,
      "why": "The reason, shown after the answer.",
      "ref": "Guide section 04, Service lets"
    }
  ]
}
```

- `answer` is the position of the right option, counting from 0. The page shuffles the options, so the right one can sit first in the file.
- `"keep": true` keeps the options in the written order (use it for numbers).
- `"local": true` on a question, or on the whole file, shows the label "Chicago District rule".
- Never change the `id` of a live question: players' progress is saved by id.

To add a chapter: add the file and list it in `content/catalog.json`. To add a sport or another set of rules: add a folder and a `contexts` entry in the catalog. No code change is needed.

The line at the bottom of the page that names the source documents is the `source` list of the rules in `content/catalog.json`: plain text mixed with `{ "text": ..., "url": ... }` links. Update the links there when a new edition comes out.

When the district rules change for a new season: copy the folder to a new year, update the questions, and point the catalog to the new folder.

## Writing rules

- No dashes in any text players read. Use periods, commas or semicolons. `npm test` checks this.
- Plain, short words.
- No club logo and no official look.
