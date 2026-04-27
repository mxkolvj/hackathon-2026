# FakeScope

## Czym jest FakeScope?

Wtyczka do Chromium która sprawdza wiarygodność artykułów na podstawie lokalnie postawionego LLM'a, ale też opinii użytkowników. Istnieje także funkcja cache'owania pobranych już wyników aby przyspieszyć działanie wtyczki.

## Tech Stack

**Frontend**: React.js + Vite (TypeScript), Tailwind CSS

**Backend**: Node.js + Fastify (TypeScript), Handmade Redis Mockup (caching), SupaBase (SQL)

**LLM**: Ollama na serwerze domowym Pawełka<3, model3.2

**Zewnętrzne API**: URLhaus (keyless) do walidacji wiarygodności URLi

## API Contract

TODO

## Team

**@mxkolvj (Full Stack)**: setup repo, iterowanie promptu do LLM'a, końcowe integracje, README

**@oskarkrzysztofek (Frontend)**: cały katalog /extension, vite config, extension UI

**@Igorzysko1 (Backend)**: endpoint /analyze i /votes, poprawne liczenie final score

**@niejajestem (Backend)**: setup LLM'a, debugowanie backendu razem z Igorem
