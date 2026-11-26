#!/bin/bash
# usage: ./serve.sh cmd...  (serves the app on :8123 while cmd runs)
cd "$(dirname "$0")"
python3 -m http.server 8123 >/tmp/srv.log 2>&1 &
S=$!; sleep 0.7
"$@"; rc=$?
kill $S; exit $rc
