#!/usr/bin/env bash
# Double-click me. Starts the local editor server and opens the editor in Chrome.
cd "$(dirname "$0")"
chmod +x scripts/refresh.sh 2>/dev/null
(sleep 1 && open "http://127.0.0.1:8765/admin/editor.html") &
exec python3 scripts/server.py
