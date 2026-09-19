#!/bin/sh
set -e
service ssh start
exec ./node_modules/.bin/pm2-runtime ./dist/bundle.js
