import { useEffect, useState } from "react";
import type { AnalyzeResponse } from "@fakescope/shared";
import { ScoreCard } from "./ScoreCard";
import { HistoryDiff } from "./HistoryDiff";
import { analyzeCurrentTab, NotArticleError, voteOnUrl } from "../lib/api";
import {
  AlertCircle,
  AlertTriangle,
  CircleCheckBig,
  Info,
  ThumbsDown,
  ThumbsUp,
} from "lucide-react";
import { MOCK_RESULT } from "../lib/mock-chrome";

export function Popup() {
  const [result, setResult] = useState<AnalyzeResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [notArticle, setNotArticle] = useState(false);

  // useEffect(() => {
  //   analyzeCurrentTab()
  //     .then(setResult)
  //     .catch((e) => {
  //       if (e instanceof NotArticleError) setNotArticle(true);
  //       else setError((e as Error).message);
  //     })
  //     .finally(() => setLoading(false));
  // }, []);

  // TODO: TYMCZASOWY useEffect del
  useEffect(() => {
    if (import.meta.env.DEV) {
      setTimeout(() => {
        setNotArticle(true);
        setResult(MOCK_RESULT);
        setLoading(false);
      }, 1500); // symuluje loading
      return;
    }
    analyzeCurrentTab()
      .then(setResult)
      .catch((e) => {
        if (e instanceof NotArticleError) setNotArticle(true);
        else setError((e as Error).message);
      })
      .finally(() => setLoading(false));
  }, []);

  async function handleVote(vote: 1 | -1) {
    if (!result) return;
    await voteOnUrl(result.url, vote);
  }

  return (
    <div
      className="p-1.5 rounded-3xl overflow-hidden"
      style={{
        background:
          "linear-gradient(326deg, rgba(14, 124, 134, 1) 0%, rgba(164, 218, 222, 1) 100%)",
      }}
    >
      <div className="flex flex-col text-sm text-gray-900 bg-white rounded-[18px] max-h-[560px]">
        {/* sticky header */}
        <div className="flex items-center gap-2 p-5 pb-4 shrink-0  select-none">
          <img
            src="../../icons/fakescope-icon.svg"
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
            {/* <Info size={16} className="text-gray-400" /> */}
          </div>
        </div>
        <hr />
        {loading && (
          <div className="space-y-3 animate-pulse">
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
          <div className="p-5 text-xs text-gray-500 flex gap-2 items-start ">
            <AlertCircle size={16} className="shrink-0" />

            <div className="flex flex-col gap-1">
              <span className="font-semibold">Brak artykułu na stronie</span>
              Przejdź na stronę jakiegoś artykułu i naciśnij na FakeScope
              ponownie.
            </div>
          </div>
        )}
        {error && (
          <div className="p-4 rounded-2xl bg-red-700 text-xs text-red-300">
            <div className="font-semibold mb-1 text-base text-white flex gap-1.5 items-center">
              <AlertTriangle size={20} strokeWidth={2.5} />
              Wystąpił błąd
            </div>
            <div>{error}</div>
          </div>
        )}
        {result && (
          <div className="flex flex-col gap-4 p-5 pt-4 overflow-y-auto mr-1 my-1 mb-3">
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
            {result.llm.red_flags.length > 0 && (
              <div>
                <div className="font-semibold mb-1 text-xs text-red-600 flex gap-1.5 items-center uppercase">
                  <AlertCircle size={16} strokeWidth={2.5} />
                  Sygnały ostrzegawcze
                </div>
                <ul className="list-disc pl-5 text-sm">
                  {result.llm.red_flags.map((f, i) => (
                    <li key={i}>{f}</li>
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
                    <li key={i}>{f}</li>
                  ))}
                </ul>
              </div>
            )}
            <HistoryDiff wayback={result.wayback} />
            <div className="flex items-center gap-2 pt-4 border-t">
              <span className="text-xs text-gray-500">Głosuj:</span>
              <button
                className="px-2 py-1 text-xs rounded bg-green-100 hover:bg-green-200 flex gap-2 items-center transition"
                onClick={() => handleVote(1)}
              >
                <ThumbsUp size={16} className="text-green-900" />
                {result.community.up}
              </button>
              <button
                className="px-2 py-1 text-xs rounded bg-red-100 hover:bg-red-200 flex gap-2 items-center transition"
                onClick={() => handleVote(-1)}
              >
                <ThumbsDown size={16} className="text-red-900" />
                {result.community.down}
              </button>
              {result.cached && (
                <span className="ml-auto text-xs text-gray-400">cached</span>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
