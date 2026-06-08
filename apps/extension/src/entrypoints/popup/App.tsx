import { useEffect, useMemo, useState, type CSSProperties } from "react";

import {
  ProviderConfigResponseSchema,
  ProviderConfigSchema,
  ProviderConfigTestSchema,
  type LearningProfile,
  type ProviderConfigResponse
} from "@underline/shared";

import {
  MESSAGE_TYPES,
  type CleanArticlePageResponse,
  type PageStateResponse
} from "../../lib/messages";
import {
  DEFAULT_SETTINGS,
  createDefaultProfile,
  getProfile,
  getSettings,
  saveProfile,
  saveSettings,
  type ExtensionSettings
} from "../../lib/storage";

type AppVariant = "popup" | "options";

interface AppProps {
  variant?: AppVariant;
}

const shellStyle: CSSProperties = {
  padding: 18,
  display: "grid",
  gap: 14
};

const cardStyle: CSSProperties = {
  background: "rgba(255, 252, 247, 0.82)",
  border: "1px solid rgba(22, 35, 22, 0.12)",
  borderRadius: 18,
  padding: 14,
  boxShadow: "0 10px 26px rgba(64, 48, 21, 0.08)"
};

const fieldStyle: CSSProperties = {
  display: "grid",
  gap: 6
};

const inputStyle: CSSProperties = {
  width: "100%",
  borderRadius: 12,
  border: "1px solid rgba(22, 35, 22, 0.14)",
  padding: "10px 12px",
  background: "rgba(255,255,255,0.92)"
};

const secondaryButtonStyle: CSSProperties = {
  width: "100%",
  borderRadius: 14,
  border: "1px solid rgba(22, 35, 22, 0.18)",
  padding: "12px 14px",
  background: "#fffaf1",
  color: "#162316",
  cursor: "pointer"
};

const primaryButtonStyle: CSSProperties = {
  width: "100%",
  borderRadius: 14,
  border: "none",
  padding: "12px 14px",
  background: "#162316",
  color: "#f7f4ef",
  cursor: "pointer"
};

async function getActiveTab() {
  const currentWindowTabs = await chrome.tabs.query({
    active: true,
    currentWindow: true
  });

  if (currentWindowTabs[0]?.id) {
    return currentWindowTabs[0];
  }

  const lastFocusedTabs = await chrome.tabs.query({
    active: true,
    lastFocusedWindow: true
  });

  return lastFocusedTabs[0];
}

async function queryPageState(tabId: number): Promise<PageStateResponse | null> {
  try {
    const response = (await chrome.tabs.sendMessage(tabId, {
      type: MESSAGE_TYPES.getPageState
    })) as PageStateResponse;
    return response;
  } catch {
    return null;
  }
}

async function fetchProviderConfig(apiBaseUrl: string) {
  const response = await fetch(`${apiBaseUrl.replace(/\/$/, "")}/v1/provider-config`);

  if (!response.ok) {
    throw new Error(`读取后端配置失败 (${response.status})`);
  }

  return ProviderConfigResponseSchema.parse(await response.json());
}

async function syncProviderConfig(settings: ExtensionSettings) {
  const response = await fetch(
    `${settings.apiBaseUrl.replace(/\/$/, "")}/v1/provider-config`,
    {
      method: "PUT",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(
        ProviderConfigSchema.parse({
          apiUrl: settings.providerApiUrl,
          apiKey: settings.providerApiKey,
          model: settings.providerModel,
          timeoutMs: settings.providerTimeoutMs,
          wireApi: settings.providerWireApi
        })
      )
    }
  );

  if (!response.ok) {
    const payload = (await response.json().catch(() => ({}))) as { error?: string };
    throw new Error(payload.error ?? `保存后端配置失败 (${response.status})`);
  }

  return ProviderConfigResponseSchema.parse(await response.json());
}

async function testProviderConfig(settings: ExtensionSettings) {
  const response = await fetch(
    `${settings.apiBaseUrl.replace(/\/$/, "")}/v1/provider-config/test`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(
        ProviderConfigSchema.parse({
          apiUrl: settings.providerApiUrl,
          apiKey: settings.providerApiKey,
          model: settings.providerModel,
          timeoutMs: settings.providerTimeoutMs,
          wireApi: settings.providerWireApi
        })
      )
    }
  );

  const payload = ProviderConfigTestSchema.parse(await response.json());

  if (!response.ok || !payload.ok) {
    throw new Error(payload.message);
  }

  return payload;
}

function ProviderStatus({ providerState }: { providerState: ProviderConfigResponse | null }) {
  if (!providerState) {
    return <div>后端状态未知</div>;
  }

  if (!providerState.configured) {
    return <div>当前解释模式：AI demo。还没接入真实模型。</div>;
  }

  return (
    <div>
      当前解释模式：AI bridge。已连接模型：<strong>{providerState.model}</strong>
    </div>
  );
}

export function App({ variant = "popup" }: AppProps) {
  const [profile, setProfile] = useState<LearningProfile>(createDefaultProfile());
  const [settings, setSettings] = useState<ExtensionSettings>(DEFAULT_SETTINGS);
  const [providerState, setProviderState] = useState<ProviderConfigResponse | null>(null);
  const [pageState, setPageState] = useState<PageStateResponse | null>(null);
  const [tabId, setTabId] = useState<number | null>(null);
  const [status, setStatus] = useState("正在读取当前页面状态…");
  const [saving, setSaving] = useState(false);
  const [testingConnection, setTestingConnection] = useState(false);
  const [cleaningArticle, setCleaningArticle] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);

  useEffect(() => {
    void (async () => {
      const [savedProfile, savedSettings] = await Promise.all([getProfile(), getSettings()]);

      setProfile(savedProfile);
      setSettings(savedSettings);

      try {
        const nextProviderState = await fetchProviderConfig(savedSettings.apiBaseUrl);
        setProviderState(nextProviderState);
        setSettings((current) => ({
          ...current,
          providerApiUrl: nextProviderState.apiUrl || current.providerApiUrl,
          providerModel: nextProviderState.model || current.providerModel,
          providerTimeoutMs: nextProviderState.timeoutMs || current.providerTimeoutMs,
          providerWireApi: nextProviderState.wireApi || current.providerWireApi
        }));
      } catch {
        setStatus("本地后端暂时没连上，保存时会再同步一次。");
      }

      if (variant === "options") {
        setStatus("这里是常驻设置页，适合复制粘贴 URL 和 Key。");
        return;
      }

      const tab = await getActiveTab();

      if (!tab?.id) {
        setStatus("没有找到当前网页标签。请在普通网页文章里打开插件。");
        return;
      }

      setTabId(tab.id);
      const state = await queryPageState(tab.id);

      if (state) {
        setPageState(state);
        setStatus("");
        return;
      }

      if (tab.url && !tab.url.startsWith("http")) {
        setStatus("当前页面不支持。请在普通网页文章里打开插件。");
        return;
      }

      if (!state) {
        setStatus("还没连上内容脚本。先刷新文章页，再打开插件。");
        return;
      }
    })();
  }, [variant]);

  const profileReady = useMemo(
    () => Boolean(profile.discipline && profile.roleContext),
    [profile]
  );

  async function handleToggleReaderMode() {
    if (!tabId || !pageState) {
      return;
    }

    const nextEnabled = !pageState.readerModeEnabled;
    const nextState = (await chrome.tabs.sendMessage(tabId, {
      type: MESSAGE_TYPES.setReaderMode,
      enabled: nextEnabled
    })) as PageStateResponse;
    setPageState(nextState);
    setStatus(nextEnabled ? "阅读导师已开启。现在可以直接划词。" : "阅读导师已关闭。");
  }

  async function handleSave() {
    setSaving(true);
    try {
      await Promise.all([
        saveProfile({
          ...profile,
          updatedAt: new Date().toISOString()
        }),
        saveSettings(settings)
      ]);

      const nextProviderState = await syncProviderConfig(settings);
      setProviderState(nextProviderState);
      setStatus(
        nextProviderState.configured
          ? `画像和配置已保存，后端当前模型：${nextProviderState.model}。`
          : "画像已保存；后端仍会使用 mock 模式，直到你填入 key 和模型名。"
      );
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "保存失败。");
    } finally {
      setSaving(false);
    }
  }

  async function handleTestConnection() {
    setTestingConnection(true);

    try {
      const result = await testProviderConfig(settings);
      setStatus(result.message);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "连接测试失败。");
    } finally {
      setTestingConnection(false);
    }
  }

  async function handleOpenOptionsPage() {
    await chrome.runtime.openOptionsPage();
  }

  async function handleOpenCleanArticle() {
    if (!tabId || !pageState || !providerState?.configured) {
      return;
    }

    setCleaningArticle(true);
    setStatus("正在准备纯净正文…");

    try {
      const response = (await chrome.tabs.sendMessage(tabId, {
        type: MESSAGE_TYPES.cleanArticle
      })) as CleanArticlePageResponse;

      if (response.status !== "ready" || !response.cacheKey) {
        throw new Error(response.error ?? "正文清洗失败。");
      }

      await chrome.tabs.create({
        url: chrome.runtime.getURL(
          `article.html?key=${encodeURIComponent(response.cacheKey)}`
        )
      });
      setStatus("已打开纯净正文。");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "正文清洗失败。");
    } finally {
      setCleaningArticle(false);
    }
  }

  if (variant === "popup") {
    return (
      <div style={shellStyle}>
        <section style={cardStyle}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
            <div>
              <div style={{ fontSize: 12, letterSpacing: 1.2, opacity: 0.7 }}>UNDERLINE</div>
              <h1 style={{ margin: "6px 0 4px", fontSize: 22 }}>阅读导师</h1>
              <div style={{ fontSize: 13, lineHeight: 1.5, opacity: 0.82 }}>
                划出不懂的词句，让 AI 推断你真正缺失的背景知识。
              </div>
            </div>
            <button
              onClick={handleToggleReaderMode}
              disabled={!pageState}
              style={{
                alignSelf: "flex-start",
                borderRadius: 999,
                border: "none",
                background: pageState?.readerModeEnabled ? "#15372c" : "#d6743a",
                color: "white",
                padding: "10px 14px",
                cursor: pageState ? "pointer" : "not-allowed"
              }}
            >
              {pageState?.readerModeEnabled ? "关闭导师模式" : "开启导师模式"}
            </button>
          </div>

          <div style={{ marginTop: 14, display: "grid", gap: 6, fontSize: 13 }}>
            <div>当前页：{pageState?.url ?? "未连接"}</div>
            <div>待解释高亮：{pageState?.pendingHighlights ?? 0}</div>
            <div>已插入桥接段：{pageState?.bridgeCount ?? 0}</div>
            <div>最近解释模式：{pageState?.lastBridgeLabel ?? "尚无"}</div>
            {pageState?.lastFallbackReason ? (
              <div style={{ color: "#6a4220" }}>回退原因：{pageState.lastFallbackReason}</div>
            ) : null}
            {status ? <div style={{ color: "#6a4220" }}>{status}</div> : null}
          </div>

          <button
            onClick={handleOpenCleanArticle}
            disabled={!pageState || !providerState?.configured || cleaningArticle}
            style={{
              ...secondaryButtonStyle,
              marginTop: 14,
              cursor:
                !pageState || !providerState?.configured || cleaningArticle
                  ? "not-allowed"
                  : "pointer",
              opacity: !pageState || !providerState?.configured ? 0.62 : 1
            }}
          >
            {cleaningArticle ? "正在准备正文…" : "查看正文"}
          </button>
          {!providerState?.configured ? (
            <div style={{ marginTop: 8, fontSize: 12, lineHeight: 1.45, opacity: 0.72 }}>
              查看正文需要先配置真实模型。
            </div>
          ) : null}
        </section>

        <section style={cardStyle}>
          <h2 style={{ margin: 0, fontSize: 16 }}>模型配置</h2>
          <div style={{ marginTop: 10, display: "grid", gap: 8, fontSize: 13, lineHeight: 1.5 }}>
            <ProviderStatus providerState={providerState} />
            <div>本地 API：{settings.apiBaseUrl}</div>
            <div>
              {providerState?.hasApiKey
                ? `已保存 Key：${providerState.apiKeyHint}`
                : "还没保存模型 API Key"}
            </div>
            <div>协议：{providerState?.wireApi ?? settings.providerWireApi}</div>
            <div>
              {providerState?.configured
                ? "如果上游模型失败，页面会明确标成 AI demo 并显示回退原因。"
                : "当前没有真实模型，页面里的解释会明确标成 AI demo。"}
            </div>
            <div style={{ opacity: 0.78 }}>
              popup 会自动收起，不适合复制粘贴。去设置页里填 URL 和 Key 更顺手；就算真实模型连不上，解释时也会自动回退到 Demo。
            </div>
          </div>

          <button onClick={handleOpenOptionsPage} style={{ ...primaryButtonStyle, marginTop: 14 }}>
            打开设置页
          </button>
        </section>
      </div>
    );
  }

  return (
    <div style={{ ...shellStyle, maxWidth: 920, margin: "0 auto", paddingTop: 28, paddingBottom: 40 }}>
      <section style={cardStyle}>
        <div style={{ fontSize: 12, letterSpacing: 1.2, opacity: 0.7 }}>UNDERLINE SETTINGS</div>
        <h1 style={{ margin: "6px 0 4px", fontSize: 30 }}>阅读导师设置页</h1>
        <div style={{ fontSize: 14, lineHeight: 1.6, opacity: 0.82 }}>
          这里不会像 popup 那样失去焦点就关闭，适合从中转站文档里复制 URL、Key 和模型名。即使上游连接失败，解释功能也会自动回退到本地 Demo。
        </div>
        {status ? <div style={{ marginTop: 10, color: "#6a4220", fontSize: 13 }}>{status}</div> : null}
      </section>

      <section style={cardStyle}>
        <h2 style={{ margin: 0, fontSize: 16 }}>你的学习背景</h2>
        <div style={{ marginTop: 10, display: "grid", gap: 10 }}>
          <label style={fieldStyle}>
            <span>你主要来自什么领域？</span>
            <input
              style={inputStyle}
              value={profile.discipline}
              onChange={(event) =>
                setProfile((current) => ({
                  ...current,
                  discipline: event.target.value
                }))
              }
            />
          </label>

          <label style={fieldStyle}>
            <span>你的角色或语境</span>
            <input
              style={inputStyle}
              value={profile.roleContext}
              onChange={(event) =>
                setProfile((current) => ({
                  ...current,
                  roleContext: event.target.value
                }))
              }
            />
          </label>

          <label style={fieldStyle}>
            <span>你对技术术语的熟悉度</span>
            <select
              style={inputStyle}
              value={profile.technicalFamiliarity}
              onChange={(event) =>
                setProfile((current) => ({
                  ...current,
                  technicalFamiliarity: event.target.value as LearningProfile["technicalFamiliarity"]
                }))
              }
            >
              <option value="low">低</option>
              <option value="medium">中</option>
              <option value="high">高</option>
            </select>
          </label>

          <label style={fieldStyle}>
            <span>你更喜欢的解释方式</span>
            <select
              style={inputStyle}
              value={profile.explanationPreference}
              onChange={(event) =>
                setProfile((current) => ({
                  ...current,
                  explanationPreference: event.target.value as LearningProfile["explanationPreference"]
                }))
              }
            >
              <option value="balanced">平衡</option>
              <option value="analogy">类比优先</option>
              <option value="principles">原理优先</option>
            </select>
          </label>
        </div>
      </section>

      <section style={cardStyle}>
        <h2 style={{ margin: 0, fontSize: 16 }}>本地 API 与模型配置</h2>
        <div style={{ marginTop: 10, display: "grid", gap: 10 }}>
          <ProviderStatus providerState={providerState} />

          <label style={fieldStyle}>
            <span>本地 API Base URL</span>
            <input
              style={inputStyle}
              value={settings.apiBaseUrl}
              onChange={(event) =>
                setSettings((current) => ({
                  ...current,
                  apiBaseUrl: event.target.value
                }))
              }
            />
          </label>

          <label style={fieldStyle}>
            <span>插件请求本地 API 超时时间（毫秒）</span>
            <input
              style={inputStyle}
              type="number"
              value={settings.requestTimeoutMs}
              onChange={(event) =>
                setSettings((current) => ({
                  ...current,
                  requestTimeoutMs: Number(event.target.value) || DEFAULT_SETTINGS.requestTimeoutMs
                }))
              }
            />
          </label>

          <div style={{ fontSize: 12, lineHeight: 1.5, opacity: 0.72 }}>
            这里的本地 API 一般保持 `http://localhost:8787`。真正的模型 URL、Key、模型名填在下面。
          </div>

          <div style={{ fontSize: 12, lineHeight: 1.5, opacity: 0.72 }}>
            真实模型可用时，文章里的桥接会标成 `AI bridge`。如果没配置模型或上游失败，会明确标成 `AI demo` 并给出回退原因。
          </div>

          <label style={fieldStyle}>
            <span>模型 API URL</span>
            <input
              style={inputStyle}
              value={settings.providerApiUrl}
              onChange={(event) =>
                setSettings((current) => ({
                  ...current,
                  providerApiUrl: event.target.value
                }))
              }
            />
          </label>

          <label style={fieldStyle}>
            <span>模型 API Key</span>
            <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 8 }}>
              <input
                style={inputStyle}
                type={showApiKey ? "text" : "password"}
                value={settings.providerApiKey}
                placeholder="sk-..."
                onChange={(event) =>
                  setSettings((current) => ({
                    ...current,
                    providerApiKey: event.target.value
                  }))
                }
              />
              <button
                onClick={() => setShowApiKey((current) => !current)}
                style={{ ...secondaryButtonStyle, width: "auto", minWidth: 88 }}
              >
                {showApiKey ? "隐藏" : "显示"}
              </button>
            </div>
          </label>

          <label style={fieldStyle}>
            <span>模型名</span>
            <input
              style={inputStyle}
              value={settings.providerModel}
              placeholder="gpt-4.1-mini / deepseek-chat / ..."
              onChange={(event) =>
                setSettings((current) => ({
                  ...current,
                  providerModel: event.target.value
                }))
              }
            />
          </label>

          <label style={fieldStyle}>
            <span>模型请求超时时间（毫秒）</span>
            <input
              style={inputStyle}
              type="number"
              value={settings.providerTimeoutMs}
              onChange={(event) =>
                setSettings((current) => ({
                  ...current,
                  providerTimeoutMs:
                    Number(event.target.value) || DEFAULT_SETTINGS.providerTimeoutMs
                }))
              }
            />
          </label>

          <label style={fieldStyle}>
            <span>模型协议</span>
            <select
              style={inputStyle}
              value={settings.providerWireApi}
              onChange={(event) =>
                setSettings((current) => ({
                  ...current,
                  providerWireApi: event.target.value as ExtensionSettings["providerWireApi"]
                }))
              }
            >
              <option value="auto">自动判断（推荐）</option>
              <option value="responses">Responses API</option>
              <option value="chat-completions">Chat Completions API</option>
            </select>
          </label>

          <div style={{ fontSize: 12, lineHeight: 1.5, opacity: 0.72 }}>
            对 `gpt-5 / codex` 一类中转模型，优先试 `Responses API` 更合理。如果你不确定，就保持“自动判断”。
          </div>

          <div style={{ display: "grid", gap: 10, marginTop: 14 }}>
            <button
              onClick={handleTestConnection}
              disabled={testingConnection}
              style={{
                ...secondaryButtonStyle,
                cursor: testingConnection ? "progress" : "pointer"
              }}
            >
              {testingConnection ? "测试中…" : "测试模型连接"}
            </button>

            <button
              onClick={handleSave}
              disabled={saving || !profileReady}
              style={{
                ...primaryButtonStyle,
                cursor: saving ? "progress" : "pointer"
              }}
            >
              {saving ? "保存中…" : "保存全部设置"}
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
