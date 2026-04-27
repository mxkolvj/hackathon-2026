import { useEffect, useRef } from "react";
import { ShieldCheck, ShieldAlert, ShieldX } from "lucide-react";

interface Props {
  score: number;
  verdict: string;
}

function colorFor(score: number): {
  ring: string;
  text: string;
  icon: React.ReactNode;
} {
  if (score >= 70)
    return {
      ring: "stroke-green-500",
      text: "text-green-700",
      icon: <ShieldCheck size={42} className="text-green-500" />,
    };
  if (score >= 40)
    return {
      ring: "stroke-yellow-500",
      text: "text-yellow-700",
      icon: <ShieldAlert size={42} className="text-yellow-500" />,
    };
  return {
    ring: "stroke-red-500",
    text: "text-red-700",
    icon: <ShieldX size={42} className="text-red-500" />,
  };
}

export function ScoreCard({ score, verdict }: Props) {
  const { ring, text, icon } = colorFor(score);
  const radius = 44;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - score / 100);
  const circleRef = useRef<SVGCircleElement>(null);
  const countRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const circle = circleRef.current;
    const countEl = countRef.current;
    if (!circle || !countEl) return;

    // Reset bez transition
    circle.style.transition = "none";
    circle.style.strokeDashoffset = String(circumference);

    // Dwie ramki — pierwsza zapisuje reset, druga odpala animację
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        circle.style.transition =
          "stroke-dashoffset 1s cubic-bezier(0.16, 1, 0.3, 1)";
        circle.style.strokeDashoffset = String(offset);
      });
    });

    // Licznik 0 → score
    const duration = 900;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      countEl.textContent = String(Math.round(eased * score));
      if (t < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, [score]);

  return (
    <div className="flex items-center gap-4 rounded-2xl my-3">
      <div className="relative w-[100px] h-[100px]">
        <svg
          width="100"
          height="100"
          viewBox="0 0 100 100"
          className="-rotate-90"
        >
          <circle
            cx="50"
            cy="50"
            r={radius}
            className="stroke-gray-200 fill-none"
            strokeWidth="10"
          />
          <circle
            ref={circleRef}
            cx="50"
            cy="50"
            r={radius}
            className={`${ring} fill-none`}
            strokeWidth="10"
            strokeDasharray={circumference}
            strokeDashoffset={circumference}
            strokeLinecap="round"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          {icon}
        </div>
      </div>
      <div className="flex flex-col">
        <span
          ref={countRef}
          className={`text-4xl font-bold tabular-nums ${text}`}
        >
          0
        </span>
        <span className="text-xs text-gray-600">{verdict}</span>
      </div>
    </div>
  );
}
