import fs from "node:fs/promises";
import path from "node:path";
import { masterHotels } from "../config/hotels.js";
import { fetchJollyPrice } from "../agencies/jolly.js";
import { fetchMngPrice } from "../agencies/mng.js";
import { fetchTatilsepetiPrice } from "../agencies/tatilsepeti.js";
import { formatCurrency, getAdvantage } from "../lib/format.js";

const DEFAULT_CONCURRENCY = 10;

async function runWithConcurrency(items, concurrency, worker) {
  const results = new Array(items.length);
  let cursor = 0;

  async function runNext() {
    while (cursor < items.length) {
      const currentIndex = cursor;
      cursor += 1;
      results[currentIndex] = await worker(items[currentIndex], currentIndex);
    }
  }

  const workerCount = Math.max(1, Math.min(concurrency, items.length || 1));
  await Promise.all(Array.from({ length: workerCount }, () => runNext()));
  return results;
}

export async function compareHotels(browser, search) {
  const debugRows = [];
  const rows = await runWithConcurrency(
    masterHotels,
    search.concurrency ?? DEFAULT_CONCURRENCY,
    async (hotel) => {
      const tatilsepetiData = await fetchTatilsepetiPrice(hotel, search).catch(() => ({ price: 0, note: "" }));
      const tatilsepeti = tatilsepetiData.price ?? 0;
      const mng = await fetchMngPrice(browser, hotel, search).catch(() => 0);
      const jolly = await fetchJollyPrice(browser, hotel, search).catch(() => 0);
      const advantage = getAdvantage({
        Tatilsepeti: tatilsepeti,
        MNG: mng,
        Jolly: jolly
      });

      const row = {
        hotelName: hotel.name,
        tatilsepeti,
        mng,
        jolly,
        bestAgency: advantage.agency,
        diff: advantage.diff,
        formatted: {
          tatilsepeti: `${formatCurrency(tatilsepeti)} TL`,
          tatilsepetiNote: tatilsepetiData.note || "",
          mng: `${formatCurrency(mng)} TL`,
          jolly: `${formatCurrency(jolly)} TL`,
          diff: advantage.diff ? `${formatCurrency(advantage.diff)} TL` : "-",
          advantage: advantage.label
        }
      };

      debugRows.push({
        hotelName: hotel.name,
        tatilsepeti,
        tatilsepetiNote: tatilsepetiData.note || "",
        mng,
        jolly,
        bestAgency: advantage.agency,
        diff: advantage.diff
      });

      return row;
    }
  );

  const debugDir = path.resolve(process.cwd(), "debug");
  await fs.mkdir(debugDir, { recursive: true });
  await fs.writeFile(
    path.join(debugDir, "last-results.json"),
    JSON.stringify(
      {
        search,
        createdAt: new Date().toISOString(),
        concurrency: search.concurrency ?? DEFAULT_CONCURRENCY,
        rows: debugRows
      },
      null,
      2
    ),
    "utf8"
  );

  return rows;
}
