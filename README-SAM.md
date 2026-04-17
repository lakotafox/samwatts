# thesamwatts editor — cheat sheet

**What it is:** a local tool that runs on your laptop. It shows your landing page, and you click any photo or video on the page to swap it with something from your own Instagram.

## How to open it

1. Double-click **`start.command`** in this folder.
2. A Terminal window opens (leave it running) — the editor page opens in your browser.
3. When you're done, close the Terminal window to shut it down.

## How to edit

- Click any photo or video on the landing page preview.
- The selected slot gets a yellow outline.
- In the right sidebar, click the Instagram post you want to use.
- Boom — it swaps in.
- Click **save** in the top right when you're happy. (It writes to `index.html` and keeps a backup at `index.html.bak`.)

## Getting new Instagram posts

- Click **↻ refresh from IG** (top bar). It pulls all new posts from `@mini_watts` since last time. Takes 30–60s.
- Needs you to be logged into Instagram in Chrome (it borrows your browser's cookies — no password entry here).

## If something breaks

- Close the Terminal window and double-click `start.command` again.
- Scraper log: `scripts/refresh.log`.
- Revert a bad save: `index.html.bak` is the previous version — rename it back to `index.html`.
