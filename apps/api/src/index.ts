import { buildServer } from "./app";
import { loadConfig, resolveListenPort } from "./config";
import { RuntimeConfigStore } from "./runtime-config";

async function start() {
  const config = loadConfig();
  const port = resolveListenPort(config);
  const runtimeStore = new RuntimeConfigStore(config);
  await runtimeStore.load();
  const app = buildServer(config, runtimeStore);

  await app.listen({
    port,
    host: "0.0.0.0"
  });

  console.log(`Underline API listening on http://localhost:${port}`);
}

start().catch((error) => {
  console.error(error);
  process.exit(1);
});
