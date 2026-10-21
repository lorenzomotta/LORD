// Riempie le tendine dei caratteri con tutti i font installati sul computer.
// Dentro Tauri l'elenco lo dà Rust (comando elenco_font). Nel browser, per le prove,
// si prova a chiederlo al browser; se non si può restano i font scritti nella pagina.

const TENDINE = ["font", "menu-testo-font", "menu-font", "stili-font", "asse-font"];

export async function avviaFontSistema() {
  const nomi = await leggiFont();
  if (!nomi.length) return;
  for (const id of TENDINE) {
    const tendina = document.getElementById(id);
    if (tendina) riempi(tendina, nomi);
  }
}

async function leggiFont() {
  try {
    if (window.__TAURI_INTERNALS__ || window.__TAURI__) {
      const { invoke } = await import("@tauri-apps/api/core");
      return await invoke("elenco_font");
    }
    if (window.queryLocalFonts) {
      const font = await window.queryLocalFonts();
      return [...new Set(font.map((voce) => voce.family))].sort((a, b) => a.localeCompare(b, "it"));
    }
  } catch (errore) {
    console.warn("Non riesco a leggere i font del computer.", errore);
  }
  return [];
}

// Le voci senza nome (come "Come il foglio") restano in cima; la scelta attuale non cambia.
function riempi(tendina, nomi) {
  const scelto = tendina.value;
  const fisse = [...tendina.options].filter((voce) => voce.value === "" || voce.dataset.salta);
  const tutti = new Set(nomi);
  [...tendina.options].forEach((voce) => {
    if (voce.value && !voce.dataset.salta) tutti.add(voce.value);
  });
  const ordinati = [...tutti].sort((a, b) => a.localeCompare(b, "it", { sensitivity: "base" }));

  tendina.replaceChildren(...fisse);
  for (const nome of ordinati) {
    const voce = document.createElement("option");
    voce.value = nome;
    voce.textContent = nome;
    voce.style.fontFamily = `"${nome}"`;
    tendina.append(voce);
  }
  tendina.value = scelto;
}
