import fs from "node:fs/promises";
import path from "node:path";

const JOLLY_ORIGIN_ID = 64118;
const JOLLY_PACKAGE_SEARCH_TYPE = 0;

async function writeDebugFile(fileName, content) {
  const debugDir = path.resolve(process.cwd(), "debug");
  await fs.mkdir(debugDir, { recursive: true });
  await fs.writeFile(path.join(debugDir, fileName), String(content || ""), "utf8");
}

function formatDateForJolly(agencyDate) {
  const [day, month, year] = String(agencyDate).split(".");
  return `${year}.${month}.${day}`;
}

function buildJollyUrl(hotel, search) {
  const query = new URLSearchParams({
    Rooms: String(search.adult),
    StartDate: formatDateForJolly(search.start),
    EndDate: formatDateForJolly(search.end),
    OriginId: String(JOLLY_ORIGIN_ID),
    PackageSearchType: String(JOLLY_PACKAGE_SEARCH_TYPE)
  });

  return `https://www.jollytur.com${hotel.jollyPath}?${query.toString()}`;
}

function parseJollyPrice(text) {
  try {
    const parsed = JSON.parse(String(text || ""));
    const analytics = parsed?.analyticsDataModel;

    const directValues = [
      analytics?.exchangedDiscountedPrice,
      analytics?.discountedPrice,
      analytics?.exchangedTotalPrice,
      analytics?.totalPrice
    ]
      .map((value) => Number(value))
      .filter((value) => Number.isFinite(value) && value > 0);

    if (directValues.length > 0) {
      const minValue = Math.round(Math.min(...directValues));
      return minValue <= 1 ? 0 : minValue;
    }
  } catch {
    // Fallback below handles non-JSON responses.
  }

  const matches = [...String(text || "").matchAll(/(\d{1,3}(?:\.\d{3})+|\d+)(?:,\d{2})?\s*TL/gi)];
  const values = matches
    .map((match) => Number(match[1].replaceAll(".", "")))
    .filter((value) => Number.isFinite(value) && value > 0);

  if (!values.length) {
    return 0;
  }

  const minValue = Math.min(...values);
  return minValue <= 1 ? 0 : minValue;
}

export async function fetchJollyPrice(browser, hotel, search) {
  if (!hotel.jollyId || !hotel.jollyPath) {
    return 0;
  }

  if (!browser) {
    throw new Error("Jolly icin browser nesnesi gerekli.");
  }

  const page = await browser.newPage();
  const capturedResponses = [];

  page.on("response", async (response) => {
    const url = response.url();
    if (!url.includes("jollytur.com")) {
      return;
    }

    if (!url.includes("GetRequestRedirectLinkToHotelSearch") && !url.includes("GetReservationCompletePartial")) {
      return;
    }

    const text = await response.text().catch(() => "");
    capturedResponses.push({
      url,
      status: response.status(),
      text
    });
  });

  try {
    const url = buildJollyUrl(hotel, search);
    await page.goto(url, {
      waitUntil: "networkidle2",
      timeout: 90000
    });

    await page.waitForNetworkIdle({ idleTime: 1500, timeout: 15000 }).catch(() => {});

    await writeDebugFile(
      `jolly-requests-${hotel.jollyId}.json`,
      JSON.stringify(
        {
          hotelName: hotel.name,
          hotelId: hotel.jollyId,
          url,
          originId: JOLLY_ORIGIN_ID,
          packageSearchType: JOLLY_PACKAGE_SEARCH_TYPE,
          responses: capturedResponses.map((item) => ({
            url: item.url,
            status: item.status,
            textLength: item.text.length
          }))
        },
        null,
        2
      )
    );

    for (let i = 0; i < capturedResponses.length; i += 1) {
      const response = capturedResponses[i];
      const suffix = response.url.includes("GetReservationCompletePartial")
        ? "reservation"
        : "redirect";
      await writeDebugFile(`jolly-${suffix}-${hotel.jollyId}-${i + 1}.html`, response.text);
    }

    const reservationResponses = capturedResponses.filter((item) =>
      item.url.includes("GetReservationCompletePartial")
    );

    const prices = [];

    for (const response of reservationResponses) {
      const price = parseJollyPrice(response.text);
      if (price > 0) {
        prices.push(price);
      }
    }

    return prices.length ? Math.min(...prices) : 0;
  } finally {
    await page.close();
  }
}
