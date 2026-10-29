#!/usr/bin/env bash
set -e
cd "$(dirname "$0")"
[ -f backend/.env ] || cp backend/.env.example backend/.env
[ -d node_modules ] || npm install
[ -d backend/node_modules ] || npm --prefix backend install
[ -d frontend/node_modules ] || npm --prefix frontend install
npm run dev
