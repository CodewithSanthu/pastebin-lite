# Pastebin Lite

A simple Pastebin-style app where users can create text pastes and share a link. Pastes may optionally expire based on time-to-live (TTL seconds) and/or maximum view count.

## Run locally
npm install
node server.js

The app runs at http://localhost:3000

## Persistence
This project uses SQLite stored in 'pastes.db' so data survives across requests.

## Notes
Fetching a paste counts as a view.
Expired or view-exhausted pastes return HTTP 404.