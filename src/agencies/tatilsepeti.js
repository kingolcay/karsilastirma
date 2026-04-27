import fs from "node:fs/promises";
import path from "node:path";

function parsePrice(value) {
  let normalized = String(value || "").trim();

  if (normalized.includes(",") && normalized.includes(".")) {
    normalized = normalized.replaceAll(".", "").replace(",", ".");
  } else if (normalized.includes(",")) {
    normalized = normalized.replace(",", ".");
  }

  return Number.parseFloat(normalized) || 0;
}

function decodeHtml(value) {
  return String(value || "")
    .replaceAll("&quot;", "\"")
    .replaceAll("&amp;", "&")
    .replaceAll("&#39;", "'")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("\\u003c", "<")
    .replaceAll("\\u003e", ">");
}

async function writeDebugFile(fileName, content) {
  const debugDir = path.resolve(process.cwd(), "debug");
  await fs.mkdir(debugDir, { recursive: true });
  await fs.writeFile(path.join(debugDir, fileName), String(content || ""), "utf8");
}

function getInputValue(html, id) {
  const match = html.match(new RegExp(`id="${id}"[^>]*value="([^"]+)"`, "i"));
  return match ? parsePrice(match[1]) : 0;
}

function getPackageTotalFromHtml(html) {
  const decoded = decodeHtml(html);
  const patterns = [
    /([\d\.,]+)\s*TL[\s\S]{0,120}Oda\s*\+\s*Uçak[\s\S]{0,80}Toplam Fiyat/i,
    /Oda\s*\+\s*Uçak[\s\S]{0,120}([\d\.,]+)\s*TL/i
  ];

  for (const pattern of patterns) {
    const match = decoded.match(pattern);
    if (match?.[1]) {
      return parsePrice(match[1]);
    }
  }

  return 0;
}

function getTransferPrice(html) {
  const decoded = html
    .replaceAll("\\u003c", "<")
    .replaceAll("\\u003e", ">");

  if (
    /Arama kriterlerinize uygun transfer seçeneği bulamadık/i.test(decoded) ||
    /oda\+uçak olarak rezervasyonunuza devam edebilirsiniz/i.test(decoded)
  ) {
    return { price: 0, note: "Transfer bulunamadi, toplam oda + ucak olarak hesaplandi." };
  }

  const regex = /name="(departureTransfers|returnTransfers)"[^>]*data-price="([\d.,]+)"/gi;
  const dep = [];
  const ret = [];
  let match;

  while ((match = regex.exec(decoded)) !== null) {
    const price = parsePrice(match[2]);
    if (match[1] === "departureTransfers") {
      dep.push(price);
    } else {
      ret.push(price);
    }
  }

  return {
    price: (dep.length ? Math.min(...dep) : 0) + (ret.length ? Math.min(...ret) : 0),
    note: ""
  };
}

export function extractPricesFromResponse(responseText) {
  if (!responseText) {
    return { room: 0, flight: 0, transfer: 0, result: 0, note: "" };
  }

  let data;
  try {
    data = JSON.parse(responseText);
  } catch {
    return { room: 0, flight: 0, transfer: 0, result: 0, note: "" };
  }

  if (!data?.roomList) {
    return { room: 0, flight: 0, transfer: 0, result: 0, note: "" };
  }

  const roomHtml = decodeHtml(data.roomList);
  const transferHtml = decodeHtml(data.transferList || "");

  const room = getInputValue(roomHtml, "TotalRoomPrice");
  const flight = getInputValue(roomHtml, "FlightPrice");
  const transfer = getTransferPrice(transferHtml);
  const fallbackPackageTotal = getPackageTotalFromHtml(roomHtml);
  const calculatedTotal = room + flight + transfer.price;
  const finalTotal = calculatedTotal || fallbackPackageTotal;

  return {
    room,
    flight,
    transfer: transfer.price,
    result: finalTotal,
    note: transfer.note
  };
}

export async function fetchTatilsepetiPrice(hotel, search) {
  if (!hotel.tatilsepetiId) {
    return { price: 0, note: "" };
  }

  const searchText = `oda:${search.adult};tarih:${search.start},${search.end};click:true`;
  const url = `https://www.tatilsepeti.com/Hotel/GetFlyingPackages?Search=${encodeURIComponent(searchText)}&Id=${hotel.tatilsepetiId}&IsFlightPocket=true&depatureCode=${hotel.dep}&destinationCode=${hotel.des}`;

  const response = await fetch(url, {
    method: "GET",
    headers: {
      "User-Agent": "Mozilla/5.0",
      "X-Requested-With": "XMLHttpRequest"
    }
  });

  const responseText = await response.text();
  const parsed = extractPricesFromResponse(responseText);

  if (!parsed.result) {
    await writeDebugFile(`tatilsepeti-${hotel.tatilsepetiId}.json`, responseText);
  }

  return {
    price: parsed.result,
    note: parsed.note || ""
  };
}
