import { z } from "zod";

const ConfigSchema = z.object({
  API_PORT: z.coerce.number().int().min(1).max(65535).default(8787),
  RUNTIME_CONFIG_PATH: z.string().default(".underline-runtime.json"),
  LLM_API_URL: z.string().url().default("https://api.openai.com/v1/chat/completions"),
  LLM_API_KEY: z.string().optional(),
  LLM_MODEL: z.string().optional(),
  LLM_TIMEOUT_MS: z.coerce.number().int().positive().default(30_000)
});

export type AppConfig = z.infer<typeof ConfigSchema>;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  return ConfigSchema.parse(env);
}
