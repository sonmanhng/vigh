#!/usr/bin/env bash
set -e

echo "Downloading cloudflared..."
wget -q https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64
chmod +x cloudflared-linux-amd64

echo "Starting cloudflared tunnel..."
./cloudflared-linux-amd64 access tcp --hostname db-vigh.sonnm.site --url 127.0.0.1:5432 &
sleep 2

echo "Starting backend..."
npm run start
