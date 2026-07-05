#!/bin/zsh

set -e

APP_DIR="$(cd "$(dirname "$0")" && pwd)"
PORT="4173"
URL="http://127.0.0.1:${PORT}/"

cd "$APP_DIR"

echo "Starting BatterLens..."
echo "Project folder: $APP_DIR"
echo "Local URL: $URL"
echo ""

if command -v lsof >/dev/null 2>&1 && lsof -iTCP:"$PORT" -sTCP:LISTEN >/dev/null 2>&1; then
  echo "A server is already running on port $PORT."
  echo "Opening BatterLens in your browser..."
  open "$URL"
  echo ""
  echo "If the page does not load, close the old server Terminal and double-click this file again."
  echo ""
  printf "Press Enter to close this window..."
  read -r _
  exit 0
fi

echo "Server is running. Keep this Terminal window open while using BatterLens."
echo "Press Control+C to stop the server."
echo ""

python3 -m http.server "$PORT" &
SERVER_PID=$!

cleanup() {
  kill "$SERVER_PID" >/dev/null 2>&1 || true
}

trap cleanup INT TERM EXIT

sleep 1
open "$URL"
wait "$SERVER_PID"
