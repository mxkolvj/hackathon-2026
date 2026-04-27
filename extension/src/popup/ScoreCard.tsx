import { ShieldCheck, ShieldAlert, ShieldX } from "lucide-react";

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
            cx="50"
            cy="50"
            r={radius}
            className={`${ring} fill-none transition-all`}
            strokeWidth="10"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
          />
        </svg>
        {/* ikona na środku */}
        <div className="absolute inset-0 flex items-center justify-center">
          {icon}
        </div>
      </div>
      <div className="flex flex-col">
        <span className={`text-4xl font-bold ${text}`}>{score}</span>
        <span className="text-xs text-gray-600">{verdict}</span>
      </div>
    </div>
  );
}
