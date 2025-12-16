#!/bin/bash
# Poll for dev instructions from HomeHub

while true; do
  timestamp=$(date '+%H:%M:%S')
  echo "=== $timestamp Checking for instructions ==="

  result=$(curl -s http://localhost:5000/api/sync/dev/instructions 2>/dev/null)

  if [ -z "$result" ]; then
    echo "API not responding"
  else
    count=$(echo "$result" | grep -o '"count":[0-9]*' | cut -d':' -f2)

    if [ "$count" != "0" ] && [ -n "$count" ]; then
      echo "*** NEW INSTRUCTIONS FOUND ($count) ***"
      echo "$result" | jq -r '.instructions[] | "FROM: \(.from) | \(.priority) | \(.title)"'
      echo "---"
      echo "$result" | jq -r '.instructions[] | .message'
    else
      echo "No pending instructions"
    fi
  fi

  sleep 15
done
