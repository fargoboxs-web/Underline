import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { ProviderConfigSchema, type ProviderConfig, type ProviderConfigResponse } from "@underline/shared";

import type { AppConfig } from "./config";

export class RuntimeConfigStore {
  private providerConfig: ProviderConfig;

  private readonly runtimeConfigPath: string;

  constructor(private readonly config: AppConfig) {
    this.providerConfig = ProviderConfigSchema.parse({
      apiUrl: config.LLM_API_URL,
      apiKey: config.LLM_API_KEY ?? "",
      model: config.LLM_MODEL ?? "",
      timeoutMs: config.LLM_TIMEOUT_MS,
      wireApi: "auto"
    });
    this.runtimeConfigPath = path.resolve(process.cwd(), config.RUNTIME_CONFIG_PATH);
  }

  async load(): Promise<void> {
    try {
      const content = await readFile(this.runtimeConfigPath, "utf8");
      const parsed = ProviderConfigSchema.partial().parse(JSON.parse(content));
      this.providerConfig = ProviderConfigSchema.parse({
        ...this.providerConfig,
        ...parsed
      });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
        throw error;
      }
    }
  }

  getProviderConfig(): ProviderConfig {
    return {
      ...this.providerConfig
    };
  }

  getProviderConfigResponse(): ProviderConfigResponse {
    const configured = Boolean(this.providerConfig.apiKey && this.providerConfig.model);
    const apiKeyHint = this.providerConfig.apiKey
      ? `${this.providerConfig.apiKey.slice(0, 4)}...${this.providerConfig.apiKey.slice(-4)}`
      : "";

    return {
      apiUrl: this.providerConfig.apiUrl,
      model: this.providerConfig.model,
      timeoutMs: this.providerConfig.timeoutMs,
      wireApi: this.providerConfig.wireApi,
      hasApiKey: Boolean(this.providerConfig.apiKey),
      apiKeyHint,
      configured
    };
  }

  async saveProviderConfig(input: ProviderConfig): Promise<ProviderConfigResponse> {
    this.providerConfig = ProviderConfigSchema.parse(input);
    await mkdir(path.dirname(this.runtimeConfigPath), { recursive: true });
    await writeFile(this.runtimeConfigPath, JSON.stringify(this.providerConfig, null, 2), "utf8");
    return this.getProviderConfigResponse();
  }
}
