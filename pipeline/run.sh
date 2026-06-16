#!/bin/bash
# run.sh — Start the SmartBeachVolley worker
# Usage: bash pipeline/run.sh
# Run from the SmartBeachVolley root folder.

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
VENV_DIR="$SCRIPT_DIR/venv"

echo "SmartBeachVolley Worker"
echo "========================"

# Create venv if it doesn't exist
if [ ! -d "$VENV_DIR" ]; then
    echo "Creating virtual environment..."
    python3 -m venv "$VENV_DIR"
fi

# Activate venv
source "$VENV_DIR/bin/activate"

# Install/update dependencies
echo "Installing dependencies..."
pip install -r "$SCRIPT_DIR/requirements.txt" --quiet

# Copy .env if it doesn't exist yet
if [ ! -f "$SCRIPT_DIR/.env" ]; then
    if [ -f "$SCRIPT_DIR/.env.example" ]; then
        echo "No .env found — copying from .env.example"
        cp "$SCRIPT_DIR/.env.example" "$SCRIPT_DIR/.env"
        echo "Please fill in SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in pipeline/.env"
        exit 1
    fi
fi

echo "Starting worker..."
cd "$SCRIPT_DIR"
python worker.py
