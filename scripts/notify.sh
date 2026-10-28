#!/usr/bin/env bash
TITLE="${1:-Coco Squad}"
BODY="${2:-Tarea finalizada}"
osascript -e "display notification \"$BODY\" with title \"$TITLE\"" >/dev/null 2>&1
afplay /System/Library/Sounds/Submarine.aiff >/dev/null 2>&1 &
