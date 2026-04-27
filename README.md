# FakeScope

Chrome MV3 extension that scores news article credibility using a local LLM (Ollama),
Wayback Machine history, domain reputation, and community votes.

See [CLAUDE.md](./CLAUDE.md) for run instructions, API contract, and team ownership map.

# Running /analyze

e.g

curl -s -X POST http://localhost:3000/analyze \
-H "Content-Type: application/json" \
-d '{
"url": "https://www.rp.pl/publicystyka/art44239831-latwogang-dla-pokolenia-z-jest-fajniejszy-niz-panstwo",
"title": "Łatwogang dla pokolenia Z jest fajniejszy niż państwo ",
"text": ""
}' | jq .
