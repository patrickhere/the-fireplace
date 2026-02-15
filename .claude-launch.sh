#!/bin/zsh
cd "/Users/patrick/Documents/projects/fireplace-operations"
exec claude "$(cat .claude-prompt.txt)"
