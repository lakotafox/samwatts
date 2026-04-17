#!/usr/bin/env python3
"""Scan assets/published/ and build a JSON index for the editor's media palette.

Everything Sam uploads (via the editor's "add from computer / camera roll" button)
lands in assets/published/. That's the library now — no more social scraping.
"""
import json
import re
from pathlib import Path

HERE = Path(__file__).resolve().parent
SITE_ROOT = HERE.parent
PUBLISHED = SITE_ROOT / 'assets' / 'published'
OUT = HERE / 'index.json'

IMG_EXT = ('.jpg', '.jpeg', '.png', '.webp')
VID_EXT = ('.mp4', '.mov', '.webm', '.mkv')

# Files uploaded from the editor look like: upload_YYYY-MM-DDTHH-MM-SS_<name>.<ext>
# Legacy files migrated from IG scrape:    YYYY-MM-DD_HH-MM-SS_<shortcode>[_N].<ext>
UPLOAD_RE = re.compile(r'^upload_(\d{4}-\d{2}-\d{2})[_T](\d{2}-\d{2}-\d{2})_(.+)$')
LEGACY_RE = re.compile(r'^(\d{4}-\d{2}-\d{2})_(\d{2}-\d{2}-\d{2})_([A-Za-z0-9_\-]+?)(?:_(\d+))?$')


def parse_stem(stem: str):
    m = UPLOAD_RE.match(stem)
    if m:
        date, time, name = m.groups()
        return {'date': date, 'time': time.replace('-', ':'), 'key': name, 'origin': 'upload'}
    m = LEGACY_RE.match(stem)
    if m:
        date, time, code, _ = m.groups()
        return {'date': date, 'time': time.replace('-', ':'), 'key': code, 'origin': 'legacy'}
    return None


def main():
    PUBLISHED.mkdir(parents=True, exist_ok=True)
    groups: dict[tuple, dict] = {}
    for p in PUBLISHED.iterdir():
        if not p.is_file() or p.name.startswith('.'):
            continue
        info = parse_stem(p.stem)
        if not info:
            # unknown naming — still include, fall back to file mtime
            key = ('_misc', '00:00:00', p.stem)
            info = {'date': '', 'time': '', 'key': p.stem, 'origin': 'misc'}
        key = (info['date'], info['time'], info['key'])
        g = groups.setdefault(key, {'files': [], **info})
        g['files'].append(p)

    def rel(p: Path) -> str:
        return '/' + str(p.relative_to(SITE_ROOT)).replace('\\', '/')

    items = []
    for key, g in groups.items():
        files = g['files']
        videos = sorted(f for f in files if f.suffix.lower() in VID_EXT)
        imgs   = sorted(f for f in files if f.suffix.lower() in IMG_EXT)
        items.append({
            'id': f"pub_{g['date']}_{g['time']}_{g['key']}",
            'type':  'video' if videos else 'photo',
            'date':  g['date'],
            'time':  g['time'],
            'videos': [rel(v) for v in videos],
            'images': [rel(i) for i in imgs],
            'thumb':  rel(imgs[0]) if imgs else (rel(videos[0]) if videos else None),
            'caption': '',
        })

    items.sort(key=lambda x: (x['date'], x['time']), reverse=True)
    OUT.write_text(json.dumps(items, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
    print(f'Indexed {len(items)} items -> {OUT}')


if __name__ == '__main__':
    main()
