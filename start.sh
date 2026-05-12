#!/bin/bash
set -e

# Source cargo env if available but not in PATH
if [ -f "$HOME/.cargo/env" ] && ! command -v cargo &> /dev/null; then
    source "$HOME/.cargo/env"
fi

# Install Rust if missing
if ! command -v cargo &> /dev/null; then
    echo "Rust not found. Installing..."
    curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
    source "$HOME/.cargo/env"
fi

# Add wasm target if missing
if ! rustup target list --installed | grep -q wasm32-unknown-unknown; then
    echo "Adding wasm32-unknown-unknown target..."
    rustup target add wasm32-unknown-unknown
fi

# Build wasm
cd frontend
pnpm wasm-dev

if [ "$1" == "tauri" ]; then
  echo "Starting Tauri dev..."
  pnpm tauri dev
else
  # Start dev server
  pnpm dev
fi
