#!/bin/sh
set -e
service ssh start
exec pm2-runtime ./dist/bundle.js
