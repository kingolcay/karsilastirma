import fs from "node:fs/promises";
import path from "node:path";

function parseSelectedFlights(html) {
  const rows = [
    ...html.matchAll(
      /<div class="flight-box[^"]*"[^>]*data-price="0"[^>]*>[\s\S]*?<input class="flight-box-select"[^>]*data-fiyat="([^"]+)"[^>]*data-book="([^"]+)"/g
    )
  ];
  let gidisUcusDeger = null;
  let donusUcusDeger = null;
  let gidisrezbilgi = null;
  let donusrezbilgi = null;

  rows.forEach((row, index) => {
    const price = row[1] ?? null;
    const book = row[2] ?? null;

    if (index === 0) {
      gidisUcusDeger = price;
      gidisrezbilgi = book;
    }

    if (index === 1) {
      donusUcusDeger = price;
      donusrezbilgi = book;
    }
  });

  const bagaj = html.match(/data-bagaj="([^"]+)"/)?.[1] ?? null;
  const xmlsaglayici = html.match(/data-xmlsaglayici="([^"]+)"/)?.[1] ?? null;
  const mintoplam = extractInputValue(html, "mintoplam");
  const pax = extractInputValue(html, "pax");

  return {
    gidisUcusDeger,
    donusUcusDeger,
    gidisrezbilgi,
    donusrezbilgi,
    bagaj,
    xmlsaglayici,
    mintoplam,
    pax
  };
}

function parsePriceResponse(html) {
  const prices = [];
  const blocks = [...html.matchAll(/<div class="new">(.*?)<\/div>/gms)];

  for (const block of blocks) {
    const value = block[1].match(/<span class="a">([^<]+)<\/span>/)?.[1];
    if (!value) {
      continue;
    }

    const clean = value.replace(/[^\d]/g, "");
    if (clean) {
      prices.push(Number(clean));
    }
  }

  return prices.length ? Math.min(...prices) : 0;
}

async function writeDebugFile(fileName, content) {
  const debugDir = path.resolve(process.cwd(), "debug");
  await fs.mkdir(debugDir, { recursive: true });
  await fs.writeFile(path.join(debugDir, fileName), String(content || ""), "utf8");
}

export async function fetchMngPrice(browser, hotel, search) {
  if (!hotel.mngId) {
    return 0;
  }

  if (!browser) {
    throw new Error("MNG icin browser nesnesi gerekli.");
  }

  const page = await browser.newPage();

  try {
    const params = new URLSearchParams({
      otelid: String(hotel.mngId),
      from: "Sabiha Gökçen Havalimanı",
      to: "Ercan Hava Alanı",
      departuredate: search.start,
      returndate: search.end,
      adult: String(search.adult),
      child: "0",
      infant: "0",
      fromid: "air-SAW",
      toid: "air-ECN",
      s: "flightsearch",
      search: "otel",
      ou: "otel+ucak",
      type: "round",
      transfervar: "1",
      childrenages: "-1,-1,-1,-1"
    });

    const flightUrl = `https://www.mngturizm.com/index.php?${params.toString()}`;

    await page.setUserAgent("Mozilla/5.0");
    await page.setExtraHTTPHeaders({
      "Accept-Language": "tr-TR,tr;q=0.9"
    });

    const response = await page.goto(flightUrl, {
      waitUntil: "domcontentloaded",
      timeout: 60000
    });

    await page.waitForNetworkIdle({ idleTime: 1000, timeout: 10000 }).catch(() => {});

    const flightHtml = response ? await response.text() : "";
    if (!flightHtml || flightHtml.length < 2000) {
      await writeDebugFile(`mng-flight-short-${hotel.mngId}.html`, flightHtml);
      return 0;
    }

    const flight = parseSelectedFlights(flightHtml);

    if (!flight.pax || !flight.mintoplam) {
      await writeDebugFile(`mng-flight-parse-${hotel.mngId}.html`, flightHtml);
      await writeDebugFile(`mng-flight-parse-${hotel.mngId}.json`, JSON.stringify(flight, null, 2));
      return 0;
    }

    await writeDebugFile(`mng-flight-success-${hotel.mngId}.json`, JSON.stringify(flight, null, 2));

    const payload = {
      otel: String(hotel.mngId),
      giris: search.start,
      cikis: search.end,
      yetiskin: String(search.adult),
      cocuksayi: "0",
      transfervar: "1",
      mintoplam: flight.mintoplam,
      pax: flight.pax,
      gidisUcusDeger: flight.gidisUcusDeger ?? "",
      donusUcusDeger: flight.donusUcusDeger ?? "",
      gidisrezbilgi: flight.gidisrezbilgi ?? "",
      donusrezbilgi: flight.donusrezbilgi ?? "",
      bagaj: flight.bagaj ?? "",
      xmlsaglayici: flight.xmlsaglayici ?? "",
      toid: "air-ECN"
    };

    await writeDebugFile(`mng-price-payload-${hotel.mngId}.json`, JSON.stringify(payload, null, 2));

    const responseText = await page.evaluate(async (payload) => {
      const formBody = new URLSearchParams(payload);
      const response = await fetch("https://www.mngturizm.com/index.php?s=otelprice", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "X-Requested-With": "XMLHttpRequest",
          "Referer": "https://www.mngturizm.com/"
        },
        credentials: "include",
        body: formBody.toString()
      });

      return response.text();
    }, payload);

    const parsedPrice = parsePriceResponse(responseText);

    if (!parsedPrice) {
      await writeDebugFile(`mng-price-${hotel.mngId}.html`, responseText);
    }

    return parsedPrice;
  } finally {
    await page.close();
  }
}

function extractInputValue(html, inputId) {
  const inputTags = html.match(/<input\b[^>]*>/gi) ?? [];

  for (const tag of inputTags) {
    const idMatch = tag.match(/\bid="([^"]+)"/i);
    if (!idMatch || idMatch[1].toLowerCase() !== inputId.toLowerCase()) {
      continue;
    }

    const valueMatch = tag.match(/\bvalue="([^"]*)"/i);
    return valueMatch?.[1] ?? null;
  }

  return null;
}
