import puppeteer from "puppeteer";

export async function createBrowser() {
  return puppeteer.launch({
    headless: true,
    defaultViewport: { width: 1440, height: 900 },
    args: ["--no-sandbox", "--disable-setuid-sandbox"]
  });
}
