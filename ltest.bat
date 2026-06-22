@echo off
echo Starting local HTTP server...
echo Open http://localhost:8000

python -m http.server 8000

pause