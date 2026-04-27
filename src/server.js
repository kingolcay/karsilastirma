import express from "express";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createBrowser } from "./lib/browser.js";
import { formatDateForAgency } from "./lib/date.js";
import { compareHotels } from "./services/compare.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const publicDir = path.join(__dirname, "..", "public");
const debugDir = path.join(__dirname, "..", "debug");

const app = express();
const port = Number(process.env.PORT || 3000);
let browserPromise;

async function appendServerLog(message, extra) {
  await fs.mkdir(debugDir, { recursive: true });
  const lines = [
    `[${new Date().toISOString()}] ${message}`,
    extra ? String(extra) : null,
    ""
  ].filter(Boolean);

  await fs.appendFile(path.join(debugDir, "server.log"), `${lines.join("\n")}\n`, "utf8");
}

function getBrowser() {
  if (!browserPromise) {
    browserPromise = createBrowser();
  }
  return browserPromise;
}

function validateSearchInput(body) {
  const start = String(body?.start || "");
  const end = String(body?.end || "");
  const adult = Number(body?.adult || 2);
  const concurrency = Number(body?.concurrency || process.env.SEARCH_CONCURRENCY || 10);

  if (!start || !end) {
    return { error: "Giris ve cikis tarihleri zorunludur." };
  }

  if (!Number.isInteger(adult) || adult <= 0) {
    return { error: "Yetiskin sayisi pozitif tam sayi olmali." };
  }

  if (!Number.isInteger(concurrency) || concurrency <= 0 || concurrency > 20) {
    return { error: "Paralel sorgu sayisi 1 ile 20 arasinda olmali." };
  }

  return {
    search: {
      startIso: start,
      endIso: end,
      start: formatDateForAgency(start),
      end: formatDateForAgency(end),
      adult,
      concurrency
    }
  };
}

app.use(express.json());
app.use(express.static(publicDir));

app.post("/api/search", async (req, res) => {
  const validated = validateSearchInput(req.body);
  if (validated.error) {
    await appendServerLog("Validation error", JSON.stringify(req.body));
    return res.status(400).json({ error: validated.error });
  }

  try {
    await appendServerLog("Search started", JSON.stringify(validated.search));
    const browser = await getBrowser();
    const results = await compareHotels(browser, validated.search);
    await appendServerLog("Search completed", JSON.stringify({ count: results.length }));

    return res.json({
      search: validated.search,
      agencies: ["Tatilsepeti", "MNG", "Jolly"],
      results
    });
  } catch (error) {
    await appendServerLog("Search failed", error.stack || error.message);
    return res.status(500).json({
      error: "Karsilastirma sirasinda hata olustu.",
      detail: error.message
    });
  }
});

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

app.listen(port, () => {
  console.log(`Web uygulamasi hazir: http://localhost:${port}`);
});

process.on("uncaughtException", async (error) => {
  try {
    await appendServerLog("uncaughtException", error.stack || error.message);
  } finally {
    process.exit(1);
  }
});

process.on("unhandledRejection", async (reason) => {
  try {
    const message = reason instanceof Error ? reason.stack || reason.message : JSON.stringify(reason);
    await appendServerLog("unhandledRejection", message);
  } finally {
    process.exit(1);
  }
});

async function closeBrowser() {
  if (!browserPromise) {
    return;
  }

  const browser = await browserPromise.catch(() => null);
  browserPromise = null;

  if (browser) {
    await browser.close();
  }
}

process.on("SIGINT", async () => {
  await closeBrowser();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  await closeBrowser();
  process.exit(0);
});
