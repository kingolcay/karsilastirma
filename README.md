# Node.js + Puppeteer web uygulamasi

Bu proje, mevcut PHP mantiginizi web uzerinden kullanilabilen `Node.js + Puppeteer` yapisina tasir.

Su an dahil edilen acenteler:

- Tatilsepeti
- MNG Turizm
- Jolly Tur

Yapi moduler kuruldugu icin daha sonra `Jolly` gibi browser session, cookie, token veya cache bilgisinden beslenen acenteleri ayni mimariye eklemek kolaylasir.

## Kurulum

```bash
npm install
```

## Calistirma

```bash
npm start
```

Ardindan tarayicida su adresi acin:

```text
http://localhost:3000
```

Windows'ta tek tikla baslatmak isterseniz:

```text
start.bat
```

## Mimari

- `public/index.html`: arama formu ve sonuc tablosu
- `public/app.js`: frontend istek ve tablo render akisi
- `public/styles.css`: arayuz tasarimi
- `src/server.js`: Express server ve API endpointleri
- `src/services/compare.js`: karsilastirma akisi
- `src/agencies/tatilsepeti.js`: Tatilsepeti fiyat motoru
- `src/agencies/mng.js`: MNG iki asamali fiyat motoru
- `src/agencies/jolly.js`: Jolly browser session ve response yakalama motoru
- `src/lib/browser.js`: Puppeteer browser olusturma

## API

`POST /api/search`

Ornek body:

```json
{
  "start": "2026-05-01",
  "end": "2026-05-04",
  "adult": 2,
  "concurrency": 10
}
```

## Notlar

- Tarih formatlari mevcut PHP kodunuzdaki gibi ajans formatina cevriliyor.
- Tatilsepeti toplami: `oda + ucus + transfer`
- MNG toplami: ilk arama ekranindan gerekli hidden ve data degerleri okunup ikinci fiyat istegi yapiliyor.
- Jolly ilk asamada network response yakalama mantigi ile calisir; ham response dosyalari `debug` klasorune yazilir.
- Browser taklidi backend tarafinda oldugu icin zor acenteler sonradan ayni sisteme eklenebilir.
- Oteller kuyruklu paralel mantikla calisir. Varsayilan eszamanlilik `10` dur.
- Hata alan otellerde su an `0` donuyor. Sonraki adimda retry, detayli log ve timeout yonetimi eklenebilir.
- Son calistirmadaki sonuc ozeti `debug/last-results.json` icine yazilir.
- MNG parse sorunu olursa `debug` klasorune ham HTML ve parse JSON dosyalari birakilir.

## Sonraki adimlar

- `Jolly` acentesini Puppeteer icinden token ve cookie toplayarak eklemek
- Sonuclari `CSV` veya `Excel` olarak disa aktarmak
- Eszamanlilik limiti ve kuyruk yapisi eklemek
