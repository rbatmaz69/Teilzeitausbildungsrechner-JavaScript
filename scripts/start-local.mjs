import { createServer } from "node:net";
import { spawn } from "node:child_process";
import { networkInterfaces } from "node:os";

const HOST = "0.0.0.0";
const START_PORT = 8000;
const MAX_ATTEMPTS = 50;

function getLanIpv4Addresses() {
  const interfaces = networkInterfaces();
  const lanAddresses = [];

  for (const details of Object.values(interfaces)) {
    for (const entry of details ?? []) {
      if (entry.family === "IPv4" && !entry.internal) {
        lanAddresses.push(entry.address);
      }
    }
  }

  return [...new Set(lanAddresses)];
}

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

  const lanAddresses = getLanIpv4Addresses();

  for (const address of lanAddresses) {
    console.log(`Mobile/LAN URL: http://${address}:${port}`);
  }

  if (lanAddresses.length === 0) {
    console.log(
      "No LAN IPv4 address found. Ensure your computer is connected to Wi-Fi or Ethernet."
    );
  }

  const child = spawn(
    "npx",
    [
      "--yes",
      "http-server",
      ".",
      "-a",
      HOST,
      "-p",
      String(port),
      "-c-1",
      "-s"
    ],
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
