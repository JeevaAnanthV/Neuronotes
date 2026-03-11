#!/bin/sh
echo "Starting uvicorn on port ${PORT:-8000}"
exec uvicorn main:app \
  --host 0.0.0.0 \
  --port "${PORT:-8000}" \
  --proxy-headers \
  --forwarded-allow-ips "*"
