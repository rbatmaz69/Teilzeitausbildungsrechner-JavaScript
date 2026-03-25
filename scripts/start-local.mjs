import { createServer } from "node:net";
import { spawn } from "node:child_process";

const HOST = "0.0.0.0";
const START_PORT = 8000;
const MAX_ATTEMPTS = 50;

function isPortFree(port) {
  return new Promise((resolve) => {
    const server = createServer();

    server.once("error", () => {
      resolve(false);
    });

    server.once("listening", () => {
      server.close(() => resolve(true));
    });

    server.listen(port, HOST);
  });
}

async function findFreePort(startPort, attempts) {
  for (let index = 0; index < attempts; index += 1) {
    const currentPort = startPort + index;
    const free = await isPortFree(currentPort);

    if (free) {
      return currentPort;
    }
  }

  return null;
}

async function main() {
  const port = await findFreePort(START_PORT, MAX_ATTEMPTS);

  if (port === null) {
    console.error(
      `No free port found in range ${START_PORT}-${START_PORT + MAX_ATTEMPTS - 1}.`
    );
    process.exit(1);
  }

  console.log(`Starting local server on http://localhost:${port}`);

  const child = spawn(
    "npx",
    ["--yes", "http-server", ".", "-p", String(port), "-c-1", "-s"],
    {
      stdio: "inherit",
      shell: process.platform === "win32"
    }
  );

  child.on("exit", (code) => {
    process.exit(code ?? 0);
  });

  child.on("error", (error) => {
    console.error("Failed to start http-server:", error.message);
    process.exit(1);
  });

  process.on("SIGINT", () => {
    child.kill("SIGINT");
  });

  process.on("SIGTERM", () => {
    child.kill("SIGTERM");
  });
}

main();
