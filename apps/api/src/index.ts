import { buildServer } from "./app";
import { loadConfig } from "./config";
import { RuntimeConfigStore } from "./runtime-config";

async function start() {
  const config = loadConfig();
  const runtimeStore = new RuntimeConfigStore(config);
  await runtimeStore.load();
  const app = buildServer(config, runtimeStore);

  await app.listen({
    port: config.API_PORT,
    host: "0.0.0.0"
  });

  console.log(`Underline API listening on http://localhost:${config.API_PORT}`);
}

start().catch((error) => {
  console.error(error);
  process.exit(1);
});
