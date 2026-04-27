const form = document.querySelector("#searchForm");
const submitButton = document.querySelector("#submitButton");
const statusBox = document.querySelector("#statusBox");
const summaryBox = document.querySelector("#summaryBox");
const resultsTable = document.querySelector("#resultsTable");
const resultsBody = document.querySelector("#resultsBody");

function setStatus(message, type = "info") {
  statusBox.textContent = message;
  statusBox.className = `status ${type}`;
}

function hideStatus() {
  statusBox.textContent = "";
  statusBox.className = "status hidden";
}

function renderSummary(search) {
  summaryBox.innerHTML = `
    <strong>Arama Bilgileri</strong>
    <span>Giris: ${search.start}</span>
    <span>Cikis: ${search.end}</span>
    <span>Yetiskin: ${search.adult}</span>
  `;
  summaryBox.classList.remove("hidden");
}

function renderResults(rows) {
  resultsBody.innerHTML = rows.map((row) => `
    <tr>
      <td>${row.hotelName}</td>
      <td>
        <div>${row.formatted.tatilsepeti}</div>
        ${row.formatted.tatilsepetiNote ? `<div class="cell-note">${row.formatted.tatilsepetiNote}</div>` : ""}
      </td>
      <td>${row.formatted.mng}</td>
      <td>${row.formatted.jolly}</td>
      <td>${row.bestAgency}</td>
      <td>${row.formatted.diff}</td>
    </tr>
  `).join("");

  resultsTable.classList.remove("hidden");
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  hideStatus();
  summaryBox.classList.add("hidden");
  resultsTable.classList.add("hidden");
  resultsBody.innerHTML = "";

  const formData = new FormData(form);
  const payload = {
    start: formData.get("start"),
    end: formData.get("end"),
    adult: Number(formData.get("adult"))
  };

  submitButton.disabled = true;
  submitButton.textContent = "Yukleniyor...";
  setStatus("Acenteler taraniyor. Bu islem browser taklidi nedeniyle biraz surebilir.", "info");

  try {
    const response = await fetch("/api/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || "Istek basarisiz oldu.");
    }

    renderSummary(data.search);
    renderResults(data.results);
    setStatus("Karsilastirma tamamlandi.", "success");
  } catch (error) {
    setStatus(error.message, "error");
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = "Karsilastir";
  }
});
