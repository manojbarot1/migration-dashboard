#!/usr/bin/env bash
set -e

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" >/dev/null 2>&1 && pwd)"
cd "$DIR"

echo "=========================================================="
echo " Starting Simple VM Migration Dashboard (QEMU/KVM to AWS)"
echo "=========================================================="

export PYTHONPATH="$DIR/backend"
export DATABASE_URL="sqlite:///$DIR/migration.db"
export SECRET_KEY_PATH="$DIR/.secret_key"

# Ensure log directory
mkdir -p "$DIR/logs"

# Start backend
echo "Starting Backend API on http://127.0.0.1:8888..."
python3 -m uvicorn app.main:app --host 0.0.0.0 --port 8888 > "$DIR/logs/backend.log" 2>&1 &
BACKEND_PID=$!
echo "Backend running with PID $BACKEND_PID (Logs: $DIR/logs/backend.log)"

# Wait for backend to be ready
echo -n "Waiting for backend health check..."
for i in {1..30}; do
    if curl -s http://127.0.0.1:8888/api/health >/dev/null 2>&1; then
        echo " Ready!"
        break
    fi
    sleep 0.5
    echo -n "."
done

# Start frontend
echo "Starting Frontend UI on http://localhost:3333..."
cd "$DIR/frontend"
npm run dev -- --port 3333 --host > "$DIR/logs/frontend.log" 2>&1 &
FRONTEND_PID=$!
echo "Frontend running with PID $FRONTEND_PID (Logs: $DIR/logs/frontend.log)"

echo ""
echo "=========================================================="
echo " VM Migration Dashboard is online!"
echo " UI Dashboard:  http://localhost:3333"
echo " Backend API:   http://localhost:8888"
echo " API Docs:      http://localhost:8888/docs"
echo "=========================================================="
echo "Press Ctrl+C to stop both services."

trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null || true; exit 0" INT TERM
wait
