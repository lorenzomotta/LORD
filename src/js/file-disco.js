// Salva e apre i file. Dentro Tauri usa la finestra di Windows.
// Nel browser, per le prove, scarica il file.

function dentroTauri() {
  return Boolean(window.__TAURI_INTERNALS__ || window.__TAURI__);
}

function scarica(nome, byte, mime) {
  const blob = new Blob([byte], { type: mime });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = nome;
  link.click();
  URL.revokeObjectURL(link.href);
}

export async function salvaByte(nome, estensione, nomeFiltro, byte, mime) {
  if (dentroTauri()) {
    const { invoke } = await import("@tauri-apps/api/core");
    return invoke("salva_file", {
      nome,
      nomeFiltro,
      estensione,
      byte: Array.from(byte),
    });
  }
  scarica(nome, byte, mime);
  return true;
}

export async function apriTesto(nomeFiltro, estensioni) {
  const lista = Array.isArray(estensioni) ? estensioni : [estensioni];
  if (dentroTauri()) {
    const { invoke } = await import("@tauri-apps/api/core");
    return invoke("apri_file", { nomeFiltro, estensioni: lista });
  }

  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = `${lista.map((estensione) => `.${estensione}`).join(",")},application/json`;
    input.addEventListener("change", () => {
      const file = input.files?.[0];
      if (!file) {
        resolve(null);
        return;
      }
      const lettore = new FileReader();
      lettore.onload = () => resolve(String(lettore.result));
      lettore.onerror = () => resolve(null);
      lettore.readAsText(file);
    });
    input.click();
  });
}
