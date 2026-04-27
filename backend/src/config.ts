import "dotenv/config";

function required(name: string, fallback?: string): string {
  const v = process.env[name] ?? fallback;
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

export const config = {
  port: Number(process.env.PORT ?? 3000),
  ollamaUrl: required("OLLAMA_LLAMA_URL", "http://100.117.62.118:11434"),
  ollamaModel: required("OLLAMA_LLAMA_MODEL", "llama3.2"),
  supabaseUrl: process.env.SUPABASE_URL ?? "",
  supabaseKey: process.env.SUPABASE_KEY ?? "",
  corsOrigins: (process.env.CORS_ORIGINS ?? "chrome-extension://*")
    .split(",")
    .map((s) => s.trim()),
};
