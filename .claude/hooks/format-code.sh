#!/bin/bash
# PostToolUse hook: auto-format files after Write/Edit
# Reads JSON from stdin, extracts file path, runs prettier

INPUT=$(cat)

FILE_PATH=$(echo "$INPUT" | python3 -c "
import sys, json
try:
    d = json.load(sys.stdin)
    # Try tool_input.file_path (Edit/Write)
    p = d.get('tool_input', {}).get('file_path', '')
    if not p:
        p = d.get('tool_response', {}).get('filePath', '')
    print(p)
except:
    print('')
" 2>/dev/null)

if [ -z "$FILE_PATH" ]; then
    exit 0
fi

# Only format JS/TS/CSS/JSON files
case "$FILE_PATH" in
    *.ts|*.tsx|*.js|*.jsx|*.css|*.json)
        ;;
    *)
        exit 0
        ;;
esac

# Find prettier in project or globally
PRETTIER=""
if [ -f "./node_modules/.bin/prettier" ]; then
    PRETTIER="./node_modules/.bin/prettier"
elif command -v prettier &>/dev/null; then
    PRETTIER="prettier"
elif command -v npx &>/dev/null; then
    PRETTIER="npx prettier"
fi

if [ -n "$PRETTIER" ]; then
    $PRETTIER --write "$FILE_PATH" 2>/dev/null || true
fi

exit 0
