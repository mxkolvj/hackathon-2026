import { useEffect, useState, useRef } from "react";
import type { AnalyzeResponse } from "@fakescope/shared";
import { ScoreCard } from "./ScoreCard";
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
  Moon,
  RotateCcw,
  Sun,
  ThumbsDown,
  ThumbsUp,
} from "lucide-react";

function updateCommunity(
  prev: AnalyzeResponse | null,
  up: number,
  down: number,
): AnalyzeResponse | null {
  if (!prev) return null;
  return {
    ...prev,
    community: prev.community
      ? { ...prev.community, up, down }
      : { up, down, community_score: null },
  };
}

export function Popup() {
  const [result, setResult] = useState<AnalyzeResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [notArticle, setNotArticle] = useState(false);
  const [voted, setVoted] = useState<1 | -1 | null>(null);
  const [tooltip, setTooltip] = useState<"up" | "down" | null>(null);
  const tooltipTimer = useRef<ReturnType<typeof setTimeout>>();
  const [reanalyzing, setReanalyzing] = useState(false);
  const [dark, setDark] = useState(
    () => localStorage.getItem("fs-theme") === "dark",
  );
  const [transitioning, setTransitioning] = useState(false);

  function toggleDark() {
    setTransitioning(true);
    setTimeout(() => setTransitioning(false), 400);
    setDark((d) => {
      const next = !d;
      localStorage.setItem("fs-theme", next ? "dark" : "light");
      return next;
    });
  }

  async function runAnalysis(force = false) {
    setLoading(true);
    try {
      const data = await analyzeCurrentTab(force);
      setResult(data);

      try {
        const { up, down } = await fetchCommunity(data.url);
        setResult((prev) => updateCommunity(prev, up, down));
      } catch {
        // Ignoruj błędy dot. samej społeczności
      }
    } catch (e) {
      if (e instanceof NotArticleError) {
        setNotArticle(true);
      } else {
        setError((e as Error).message);
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    runAnalysis();
  }, []);

  useEffect(() => {
    return () => clearTimeout(tooltipTimer.current);
  }, []);

  async function handleReanalyze() {
    if (!result) return;

    setReanalyzing(true);
    setResult(null);
    setError(null);
    setNotArticle(false);
    setVoted(null);

    try {
      const [tab] = await chrome.tabs.query({
        active: true,
        currentWindow: true,
      });
      if (tab?.url) await clearCache(tab.url);
    } catch {
      // ignoruj błąd czyszczenia cache
    }

    await runAnalysis(true);
    setReanalyzing(false);
  }

  async function handleVote(vote: 1 | -1) {
    if (!result || voted !== null) return;

    setVoted(vote);
    setTooltip(vote === 1 ? "up" : "down");
    clearTimeout(tooltipTimer.current);
    tooltipTimer.current = setTimeout(() => setTooltip(null), 2000);

    setResult((prev) =>
      prev
        ? updateCommunity(
            prev,
            (prev.community?.up ?? 0) + (vote === 1 ? 1 : 0),
            (prev.community?.down ?? 0) + (vote === -1 ? 1 : 0),
          )
        : prev,
    );

    try {
      await voteOnUrl(result.url, vote);
      const { up, down } = await fetchCommunity(result.url);
      setResult((prev) => (prev ? updateCommunity(prev, up, down) : prev));
    } catch {
      setResult((prev) =>
        prev
          ? updateCommunity(
              prev,
              (prev.community?.up ?? 0) - (vote === 1 ? 1 : 0),
              (prev.community?.down ?? 0) - (vote === -1 ? 1 : 0),
            )
          : prev,
      );
      setVoted(null);
    }
  }

  const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

  return (
    <div className={`tranisiton-all ${dark ? "dark" : ""}`}>
      {transitioning && (
        <style>{`* { transition: color 350ms ease, background-color 350ms ease, border-color 350ms ease, opacity 500ms ease !important; }`}</style>
      )}
      <div className="p-1 overflow-hidden relative">
        {/* gradient light */}
        <div
          className="absolute inset-0 transition-opacity duration-500"
          style={{
            background:
              "linear-gradient(326deg, rgba(14, 124, 134, 1) 0%, rgba(164, 218, 222, 1) 100%)",
            opacity: dark ? 0 : 1,
          }}
        />
        {/* gradient dark */}
        <div
          className="absolute inset-0 transition-opacity duration-500"
          style={{
            background:
              "linear-gradient(326deg, rgba(14, 124, 134, 1) 0%, rgba(7, 62, 67, 1) 100%)",
            opacity: dark ? 1 : 0,
          }}
        />

        {/* cała reszta contentu w relative żeby była nad gradientami */}
        <div className="relative flex flex-col text-sm text-gray-900 bg-white dark:bg-gray-900 dark:text-gray-100 max-h-[560px]">
          {/* Header */}
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
            <div className="flex flex-col items-end ml-auto gap-1">
              <button
                onClick={toggleDark}
                className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                aria-label={dark ? "Enable light mode" : "Enable dark mode"}
                title={dark ? "Enable light mode" : "Enable dark mode"}
              >
                {dark ? <Sun size={15} /> : <Moon size={15} />}
              </button>
              <span className="tracking-tight text-gray-400 dark:text-gray-500 text-xs">
                v1.0.0
              </span>
              <span className="tracking-tight text-gray-400 dark:text-gray-500 text-xs">
                &copy; 2026 3.5IQ
              </span>
            </div>
          </div>
          <hr className="dark:border-gray-700" />
          {loading && !result && (
            <div className="space-y-3 animate-pulse p-5">
              <div className="flex items-center gap-4 p-3 rounded-lg border border-gray-300 dark:border-gray-700">
                <div className="w-[100px] h-[100px] rounded-full bg-gray-300 dark:bg-gray-700" />
                <div className="flex-1 space-y-2">
                  <div className="h-8 w-16 bg-gray-300 dark:bg-gray-700 rounded" />
                  <div className="h-3 w-24 bg-gray-300 dark:bg-gray-700 rounded" />
                </div>
              </div>
              <div className="h-3 bg-gray-300 dark:bg-gray-700 rounded w-full" />
              <div className="h-3 bg-gray-300 dark:bg-gray-700 rounded w-4/5" />
              <div className="h-3 bg-gray-300 dark:bg-gray-700 rounded w-3/5" />
            </div>
          )}
          {notArticle && (
            <div className="p-5 text-xs text-gray-500 dark:text-gray-400 flex gap-2 items-start animate-[fadeSlideIn_0.3s_ease_forwards]">
              <AlertCircle size={16} className="shrink-0" />
              <div className="flex flex-col gap-1">
                <span className="font-semibold">No article on this site</span>
                Go to a site with an article and click on FakeScope again.
              </div>
            </div>
          )}
          {error && (
            <div className="m-5 p-4 rounded-2xl bg-red-700 dark:bg-red-900 text-xs text-red-300 animate-[fadeSlideIn_0.3s_ease_forwards]">
              <div className="font-semibold mb-1 text-base text-white flex gap-1.5 items-center">
                <AlertTriangle size={20} strokeWidth={2.5} />
                An error occured
              </div>
              <div>{error}</div>
            </div>
          )}
          {result && (
            <div className="flex flex-col gap-4 p-5 pt-4 overflow-y-auto overflow-x-hidden mr-1 my-1 mb-3 animate-[fadeSlideIn_0.35s_ease_forwards]">
              <ScoreCard
                score={result.final_score}
                verdict={result.llm.verdict}
              />

              <div>
                <h2 className="font-semibold text-xs uppercase text-gray-500 dark:text-gray-400 mb-1">
                  Summary
                </h2>
                <p className="text-sm">{result.llm.summary}</p>
              </div>
              <hr className="dark:border-gray-700" />

              <div className="py-2 flex flex-col gap-4">
                {result.llm.red_flags.length === 0 &&
                  result.llm.positive_signals.length === 0 && (
                    <div className="text-gray-500 dark:text-gray-400">
                      No key indicators detected.
                    </div>
                  )}

                {result.llm.red_flags.length > 0 && (
                  <div>
                    <div className="font-semibold mb-1 text-xs text-red-600 dark:text-red-400 flex gap-1.5 items-center uppercase">
                      <AlertCircle size={16} strokeWidth={2.5} />
                      Red flags
                    </div>
                    <ul className="list-disc pl-5 text-sm">
                      {result.llm.red_flags.map((f, i) => (
                        <li
                          key={i}
                          className="opacity-0 animate-[fadeSlideIn_0.3s_ease_forwards]"
                          style={{ animationDelay: `${i * 60}ms` }}
                        >
                          {cap(f)}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {result.llm.positive_signals.length > 0 && (
                  <div>
                    <div className="font-semibold mb-1 text-xs text-green-600 dark:text-green-400 flex gap-1.5 items-center uppercase">
                      <CircleCheckBig size={16} strokeWidth={2.5} />
                      Green flags
                    </div>
                    <ul className="list-disc pl-5 text-sm">
                      {result.llm.positive_signals.map((f, i) => (
                        <li
                          key={i}
                          className="opacity-0 animate-[fadeSlideIn_0.3s_ease_forwards]"
                          style={{ animationDelay: `${i * 60}ms` }}
                        >
                          {cap(f)}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              {/* Voting */}
              <div className="flex flex-col items-center justify-center gap-2 pt-4 border-t dark:border-gray-700">
                <div className="flex items-center w-full gap-2">
                  {result.community != null && (
                    <div>
                      <div className="flex items-center gap-1">
                        <span className="text-xs text-gray-500 dark:text-gray-400 mr-2">
                          Vote:
                        </span>

                        <div className="relative">
                          <button
                            disabled={voted !== null}
                            className={`px-2 py-1 text-xs rounded flex gap-2 items-center transition-all duration-150
                          ${
                            voted === 1
                              ? "bg-green-500 cursor-default text-white"
                              : "bg-green-100 hover:bg-green-200 dark:bg-green-900 dark:hover:bg-green-800 active:scale-95 cursor-pointer"
                          }`}
                            onClick={() => handleVote(1)}
                          >
                            <ThumbsUp
                              size={16}
                              className={`${voted !== 1 && "text-green-900 dark:text-green-100"}`}
                            />
                            {result.community?.up ?? 0}
                          </button>
                          {tooltip === "up" && (
                            <div className="absolute -top-8 left-1/2 -translate-x-1/2 z-10 bg-gray-800 text-white text-xs px-2 py-1 rounded whitespace-nowrap pointer-events-none animate-[fadeSlideIn_0.2s_ease_forwards]">
                              Thank you!
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
                              : "bg-red-100 hover:bg-red-200 dark:bg-red-900 dark:hover:bg-red-800 active:scale-95 disabled:cursor-not-allowed disabled:hover:bg-red-100 dark:disabled:hover:bg-red-900"
                          }`}
                            onClick={() => handleVote(-1)}
                          >
                            <ThumbsDown
                              size={16}
                              className={`${voted !== -1 && "text-red-900 dark:text-red-100"}`}
                            />
                            {result.community?.down ?? 0}
                          </button>
                          {tooltip === "down" && (
                            <div className="absolute -top-8 left-1/2 -translate-x-1/2 z-10 bg-gray-800 text-white text-xs px-2 py-1 rounded whitespace-nowrap pointer-events-none animate-[fadeSlideIn_0.2s_ease_forwards]">
                              Thank you!
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <button
                  onClick={handleReanalyze}
                  disabled={reanalyzing}
                  className="mt-5 flex items-center gap-1 text-xs text-white transition disabled:opacity-50 px-3 py-1.5 bg-[#0E7C86aa] hover:bg-[#0E7C86] rounded-xl"
                >
                  <RotateCcw size={13} />
                  Analyze again
                </button>

                {result.cached && (
                  <span className="text-xs text-gray-400 dark:text-gray-500">
                    Showing cached result
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
