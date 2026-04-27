# FakeScope

Chrome MV3 extension that scores news article credibility using a local LLM (Ollama),
Wayback Machine history, domain reputation, and community votes. Backend in Fastify.

## Layout

- `backend/` — Fastify API. Owners: Igor (analyze + wayback), Paweł (domain + votes + supabase).
- `extension/` — React + Vite MV3 extension. Owner: Oskar.
- `packages/shared/` — TypeScript types shared between backend and extension. Owner: Mikołaj.

## Run

```bash
# 1. Infra
docker compose up -d                 # Redis on :6379
ollama run llama3.1:8b               # warm the model

# 2. Install
pnpm install

# 3. Configure
cp backend/.env.example backend/.env # fill in SUPABASE_URL + SUPABASE_KEY

# 4. Dev
pnpm dev:backend                     # http://localhost:3000
pnpm dev:extension                   # builds extension/dist (load unpacked in Chrome)
```

## API contract

- `POST /analyze` `{ url, title, text }` → `AnalyzeResponse` (see `packages/shared`)
- `GET /domain?url=…` → `{ domain_score, flags[] }`
- `GET /votes?url=…` → `{ up, down }`
- `POST /votes` `{ url, vote: 1 | -1, user_hash }` → `{ ok: true }`

## Score formula

`final = llm*0.5 + domain*0.25 + wayback*0.15 + community*0.1` — clamped 0–100.

## Conventions

- TypeScript strict mode everywhere.
- All cross-boundary types live in `packages/shared`.
- Services must never throw — return a typed fallback so `/analyze` always responds.
- Cache `/analyze` results in Redis for 1h, keyed by SHA-256 of the URL.

## Time table

👨‍💻 Mikołaj (Full Stack) — setup + integracja
H1–H2 — Repo setup: monorepo, package.json w root, Supabase projekt, zmienne środowiskowe, Fastify skeleton działający lokalnie u wszystkich, CLAUDE.md w repo
H3–H5 — ★ llm.ts prompt engineering: iterowanie promptu do Ollamy żeby zwracała stabilny JSON bez halucynacji. llama3.1:8b bywa nieposłuszny — trzeba przetestować kilka wariantów system promptu i zabezpieczyć parser
H6–H8 — score.ts: agregacja wyników z trzech serwisów, testy na edge-casach (Wayback nie odpowiada, domena bez whois, LLM zwraca śmieci), upewnienie się że final_score ma sens na różnych artykułach
H9–H10 — Demo prep, README, pomoc przy bugach integracyjnych

🖥️ Igor (Backend) — core route + cache
H1–H2 — wayback.ts: CDX API → pierwsze i najnowsze snapshoty, fetch HTML, porównanie długości tekstu, change_percent. Timeout 8s + fallback — nie czeka na Ollama, może działać niezależnie
H3–H5 — analyze.ts route: Promise.all([llm, wayback, domain]) + Redis cache (ioredis, TTL 1h). Na tym etapie llm.ts może jeszcze nie być gotowy — mockuje odpowiedź LLM { score: 50 } żeby route działał end-to-end od razu
H6–H8 — Swap mocka na prawdziwy llm.ts gdy Mikołaj skończy prompt, rate limiting (@fastify/rate-limit), obsługa gdy Ollama nie odpowiada (timeout + fallback)
H9–H10 — End-to-end testy całego /analyze, pomoc przy integracji z extension

🎨 Oskar (Frontend) — extension
H1–H2 — ★ Chrome Extension setup: Manifest V3, Vite + @crxjs/vite-plugin, React + Tailwind, pierwsze załadowanie dist/ w chrome://extensions bez błędów (tu najwięcej traci się czasu)
H3–H5 — content/index.ts: wyciąganie tekstu artykułu (target article, main, .post-content, fallback body, strip nav/footer/aside). service-worker.ts: komunikacja content script → /analyze → cache w chrome.storage.session
H6–H8 — UI: ScoreCard.tsx (kółko score czerwony/żółty/zielony, lista flag), HistoryDiff.tsx (zmiana % z ostrzeżeniem >30%), loading state, obsługa błędu gdy backend nie odpowiada
H9–H10 — Polish UI, ikona extensiona, testy na kilku różnych stronach newsowych

⚙️ Paweł (Backend) — domain + votes
H1–H2 — ★ Ollama setup: instalacja, ollama pull llama3.1:8b (pobieranie ~5GB — odpalić jako pierwsze zanim cokolwiek innego), weryfikacja że http://localhost:11434/v1/chat/completions odpowiada. Równolegle (model się pobiera): szkielet domain.ts, struktura URLhaus calla
H3–H5 — domain.ts: heurystyki punktowe (TLD, HTTPS, długość domeny) + integracja URLhaus API. Przekazanie działającego Ollama URL Mikołajowi żeby mógł zacząć prompt engineering
H6–H8 — votes.ts route: POST /votes + GET /votes?url=, Supabase schema + klient w db/supabase.ts, upsert po URL + hashed IP
H9–H10 — Swagger docs, pomoc przy deploymencie, testy Supabase
