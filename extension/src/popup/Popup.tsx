import { useEffect, useState, useRef } from "react";
import type { AnalyzeResponse } from "@fakescope/shared";
import { ScoreCard } from "./ScoreCard";
import { HistoryDiff } from "./HistoryDiff";
import {
  analyzeCurrentTab,
  clearCache,
  fetchCommunity,
  NotArticleError,
  voteOnUrl,
} from "../lib/api";
import {
  AlertCircle,
  AlertTriangle,
  CircleCheckBig,
  RotateCcw,
  ThumbsDown,
  ThumbsUp,
} from "lucide-react";

export function Popup() {
  const [result, setResult] = useState<AnalyzeResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [notArticle, setNotArticle] = useState(false);
  const [voted, setVoted] = useState<1 | -1 | null>(null);
  const [tooltip, setTooltip] = useState<"up" | "down" | null>(null);
  const tooltipTimer = useRef<ReturnType<typeof setTimeout>>();
  const [reanalyzing, setReanalyzing] = useState(false);

  useEffect(() => {
    analyzeCurrentTab()
      .then((data) => {
        setResult(data);
        // Zawsze odśwież liczniki z bazy po załadowaniu
        fetchCommunity(data.url)
          .then((community) =>
            setResult((prev) =>
              prev
                ? { ...prev, community: { ...prev.community, ...community } }
                : prev,
            ),
          )
          .catch(() => {});
      })
      .catch((e) => {
        if (e instanceof NotArticleError) setNotArticle(true);
        else setError((e as Error).message);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    return () => clearTimeout(tooltipTimer.current);
  }, []);

  async function handleReanalyze() {
    if (!result) return;
    setReanalyzing(true);
    setResult(null);
    setLoading(true);
    await clearCache(result.url);
    analyzeCurrentTab()
      .then((data) => {
        setResult(data);
        fetchCommunity(data.url)
          .then((community) =>
            setResult((prev) =>
              prev
                ? { ...prev, community: { ...prev.community, ...community } }
                : prev,
            ),
          )
          .catch(() => {});
      })
      .catch((e) => {
        if (e instanceof NotArticleError) setNotArticle(true);
        else setError((e as Error).message);
      })
      .finally(() => {
        setLoading(false);
        setReanalyzing(false);
      });
  }

  async function handleVote(vote: 1 | -1) {
    if (!result || voted !== null) return;

    setVoted(vote);
    setTooltip(vote === 1 ? "up" : "down");
    clearTimeout(tooltipTimer.current);
    tooltipTimer.current = setTimeout(() => setTooltip(null), 2000);

    try {
      await voteOnUrl(result.url, vote);
      // Odśwież liczniki z bazy
      const updated = await fetchCommunity(result.url);
      setResult((prev) =>
        prev
          ? {
              ...prev,
              community: {
                ...prev.community, // zachowaj community_score
                up: updated.up,
                down: updated.down,
              },
            }
          : prev,
      );
    } catch {
      // zostają optymistyczne wartości
    }
  }

  return (
    <div
      className="p-1.5 overflow-hidden"
      style={{
        background:
          "linear-gradient(326deg, rgba(14, 124, 134, 1) 0%, rgba(164, 218, 222, 1) 100%)",
      }}
    >
      <div className="flex flex-col text-sm text-gray-900 bg-white max-h-[560px]">
        {/* sticky header */}
        <div className="flex items-center gap-2 p-5 pb-4 shrink-0 select-none">
          <img
            src="/icons/fakescope-icon.svg"
            alt="FakeScope logo"
            className="aspect-square h-10"
          />
          <h1
            className="text-xl font-bold"
            style={{ fontFamily: "'Stack Sans Headline', sans-serif" }}
          >
            <span className="text-[#0E7C86]">Fake</span>Scope
          </h1>
          <div className="flex flex-col items-center ml-auto">
            <span className="tracking-tight text-gray-400 ml-auto text-xs">
              v1.0.0
            </span>
            <span className="tracking-tight text-gray-400 ml-auto text-xs">
              &copy; 2026 3.5IQ
            </span>
          </div>
        </div>
        <hr />

        {loading && (
          <div className="space-y-3 animate-pulse p-5">
            <div className="flex items-center gap-4 p-3 rounded-lg border border-gray-200">
              <div className="w-[100px] h-[100px] rounded-full bg-gray-200" />
              <div className="flex-1 space-y-2">
                <div className="h-8 w-16 bg-gray-200 rounded" />
                <div className="h-3 w-24 bg-gray-200 rounded" />
              </div>
            </div>
            <div className="h-3 bg-gray-200 rounded w-full" />
            <div className="h-3 bg-gray-200 rounded w-4/5" />
            <div className="h-3 bg-gray-200 rounded w-3/5" />
          </div>
        )}

        {notArticle && (
          <div
            className="p-5 text-xs text-gray-500 flex gap-2 items-start
                          animate-[fadeSlideIn_0.3s_ease_forwards]"
          >
            <AlertCircle size={16} className="shrink-0" />
            <div className="flex flex-col gap-1">
              <span className="font-semibold">Brak artykułu na stronie</span>
              Przejdź na stronę jakiegoś artykułu i naciśnij na FakeScope
              ponownie.
            </div>
          </div>
        )}

        {error && (
          <div
            className="m-5 p-4 rounded-2xl bg-red-700 text-xs text-red-300
                          animate-[fadeSlideIn_0.3s_ease_forwards]"
          >
            <div className="font-semibold mb-1 text-base text-white flex gap-1.5 items-center">
              <AlertTriangle size={20} strokeWidth={2.5} />
              Wystąpił błąd
            </div>
            <div>{error}</div>
          </div>
        )}

        {result && (
          <div
            className="flex flex-col gap-4 p-5 pt-4 overflow-y-auto overflow-x-hidden mr-1 my-1 mb-3
                          animate-[fadeSlideIn_0.35s_ease_forwards]"
          >
            <ScoreCard
              score={result.final_score}
              verdict={result.llm.verdict}
            />

            <div>
              <h2 className="font-semibold text-xs uppercase text-gray-500 mb-1">
                Podsumowanie
              </h2>
              <p className="text-sm">{result.llm.summary}</p>
            </div>
            <hr />

            <div className="py-2 flex flex-col gap-4">
              {result.llm.red_flags.length === 0 &&
                result.llm.positive_signals.length === 0 && (
                  <div className="text-gray-500">
                    Brak wyróżnionych sygnałów.
                  </div>
                )}

              {result.llm.red_flags.length > 0 && (
                <div>
                  <div className="font-semibold mb-1 text-xs text-red-600 flex gap-1.5 items-center uppercase">
                    <AlertCircle size={16} strokeWidth={2.5} />
                    Sygnały ostrzegawcze
                  </div>
                  <ul className="list-disc pl-5 text-sm">
                    {result.llm.red_flags.map((f, i) => (
                      <li
                        key={i}
                        className="opacity-0 animate-[fadeSlideIn_0.3s_ease_forwards]"
                        style={{ animationDelay: `${i * 60}ms` }}
                      >
                        {f}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {result.llm.positive_signals.length > 0 && (
                <div>
                  <div className="font-semibold mb-1 text-xs text-green-600 flex gap-1.5 items-center uppercase">
                    <CircleCheckBig size={16} strokeWidth={2.5} />
                    Pozytywne sygnały
                  </div>
                  <ul className="list-disc pl-5 text-sm">
                    {result.llm.positive_signals.map((f, i) => (
                      <li
                        key={i}
                        className="opacity-0 animate-[fadeSlideIn_0.3s_ease_forwards]"
                        style={{ animationDelay: `${i * 60}ms` }}
                      >
                        {f}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
            {/* <HistoryDiff wayback={result.wayback} /> */}

            {/* Voting */}
            <div className="flex flex-col items-center gap-2 pt-4 border-t">
              <div className="flex items-center w-full gap-2 mb-5">
                <span className="text-xs text-gray-500">Głosuj:</span>
                <div className="relative">
                  <button
                    disabled={voted !== null}
                    className={`px-2 py-1 text-xs rounded flex gap-2 items-center transition-all duration-150
                      ${
                        voted === 1
                          ? "bg-green-500 cursor-default text-white"
                          : "bg-green-100 hover:bg-green-200 active:scale-95 cursor-pointer"
                      }`}
                    onClick={() => handleVote(1)}
                  >
                    <ThumbsUp
                      size={16}
                      className={`${voted !== 1 && "text-green-900"}`}
                    />
                    {result.community.up + (voted === 1 ? 1 : 0)}
                  </button>
                  {tooltip === "up" && (
                    <div
                      className="absolute -top-8 left-1/2 -translate-x-1/2 z-10
                                    bg-gray-800 text-white text-xs px-2 py-1 rounded
                                    whitespace-nowrap pointer-events-none
                                    animate-[fadeSlideIn_0.2s_ease_forwards]"
                    >
                      Dziękujemy!
                    </div>
                  )}
                </div>
                <div className="relative">
                  <button
                    disabled={voted !== null}
                    className={`px-2 py-1 text-xs rounded flex gap-2 items-center transition-all duration-150
                      ${
                        voted === -1
                          ? "bg-red-500 cursor-default text-white"
                          : "bg-red-100 hover:bg-red-200 active:scale-95 disabled:cursor-not-allowed disabled:hover:bg-red-100"
                      }`}
                    onClick={() => handleVote(-1)}
                  >
                    <ThumbsDown
                      size={16}
                      className={`${voted !== -1 && "text-red-900"}`}
                    />
                    {result.community.down + (voted === -1 ? 1 : 0)}
                  </button>
                  {tooltip === "down" && (
                    <div
                      className="absolute -top-8 left-1/2 -translate-x-1/2 z-10
                                    bg-gray-800 text-white text-xs px-2 py-1 rounded
                                    whitespace-nowrap pointer-events-none
                                    animate-[fadeSlideIn_0.2s_ease_forwards]"
                    >
                      Dziękujemy!
                    </div>
                  )}
                </div>
              </div>
              <button
                onClick={handleReanalyze}
                disabled={reanalyzing}
                className="flex text-nowrap gap-1 text-xs text-white transition disabled:opacity-50 p-3 bg-[#0E7C86aa] hover:bg-[#0E7C86] rounded-xl"
              >
                <RotateCcw size={14} /> Analizuj ponownie
              </button>
              {result.cached && (
                <span className="text-xs text-gray-400 mt-4">
                  Wczytano z pamięci podręcznej
                </span>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
