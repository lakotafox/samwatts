#!/usr/bin/env python3
"""Scan assets/{ig,tt,yt}-scrape and build a JSON index for the media picker."""
import json, re
from pathlib import Path

HERE = Path(__file__).resolve().parent
SITE_ROOT = HERE.parent
ASSETS = SITE_ROOT / 'assets'
OUT = HERE / 'index.json'

# Where to look. Each entry = (source, folder, url_template).
# url_template gets .format(id=...) where id is the shortcode / video id.
SOURCES = [
    ('instagram', ASSETS / 'ig-scrape' / 'photos', 'https://www.instagram.com/p/{id}/'),
    ('instagram', ASSETS / 'ig-scrape' / 'videos', 'https://www.instagram.com/p/{id}/'),
    ('tiktok',    ASSETS / 'tt-scrape',            'https://www.tiktok.com/@.theguynextdoor/video/{id}'),
    ('youtube',   ASSETS / 'yt-scrape',            'https://www.youtube.com/watch?v={id}'),
]

# filenames:
#   instaloader: 2026-04-16_13-51-06_DXMd0dtFTmm.mp4  (+ optional _N for carousel)
#   yt-dlp:      2026-04-15_00-00-00_7365129485721.mp4
FILE_RE = re.compile(r'^(\d{4}-\d{2}-\d{2})_(\d{2}-\d{2}-\d{2})_([A-Za-z0-9_\-]+?)(?:_(\d+))?$')


def parse_stem(stem):
    m = FILE_RE.match(stem)
    if not m:
        return None
    date, time, code, carousel_n = m.groups()
    return {
        'date': date,
        'time': time,
        'shortcode': code.lstrip('_'),
        'carousel': int(carousel_n) if carousel_n else 0,
    }


def process_folder(folder, source, url_template):
    groups = {}
    for p in folder.iterdir():
        if not p.is_file() or p.name.startswith('.'):
            continue
        if p.name == 'archive.txt':   # yt-dlp's download archive — skip
            continue
        info = parse_stem(p.stem)
        if not info:
            continue
        key = (info['date'], info['time'], info['shortcode'])
        g = groups.setdefault(key, {
            'files': [],
            'date': info['date'], 'time': info['time'], 'shortcode': info['shortcode'],
        })
        g['files'].append(p)

    items = []
    for key, g in groups.items():
        files = g['files']
        videos = sorted([f for f in files if f.suffix.lower() in ('.mp4', '.mov', '.webm', '.mkv')])
        imgs   = sorted([f for f in files if f.suffix.lower() in ('.jpg', '.jpeg', '.png', '.webp')])
        txts   = [f for f in files if f.suffix.lower() == '.txt']
        caption = ''
        if txts:
            try:
                caption = txts[0].read_text(encoding='utf-8', errors='ignore').strip()
            except Exception:
                pass

        def rel(p):
            return '/' + str(p.relative_to(SITE_ROOT)).replace('\\', '/')

        items.append({
            'id':        f"{source[:2]}_{g['date']}_{g['time']}_{g['shortcode']}",
            'source':    source,
            'type':      'video' if videos else 'photo',
            'date':      g['date'],
            'time':      g['time'],
            'shortcode': g['shortcode'],
            'videos':    [rel(v) for v in videos],
            'images':    [rel(i) for i in imgs],
            'thumb':     rel(imgs[0]) if imgs else (rel(videos[0]) if videos else None),
            'caption':   caption[:2000],
            'url':       url_template.format(id=g['shortcode']),
        })
    return items


def main():
    all_items = []
    for source, folder, url_template in SOURCES:
        if folder.exists():
            all_items.extend(process_folder(folder, source, url_template))

    # newest first
    all_items.sort(key=lambda x: (x['date'], x['time']), reverse=True)

    OUT.write_text(json.dumps(all_items, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')

    totals = {}
    for it in all_items:
        totals[it['source']] = totals.get(it['source'], 0) + 1
    breakdown = ', '.join(f"{k}:{v}" for k, v in sorted(totals.items()))
    print(f'Indexed {len(all_items)} posts ({breakdown}) -> {OUT}')


if __name__ == '__main__':
    main()
