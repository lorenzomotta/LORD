// Inserisce immagini dal pulsante, dal copia-incolla o trascinandole sul foglio.

import { foglio, inserisciBlocco, ripristinaCursore, salvaCursore } from "./editor.js";
import { avvisa } from "./finestre.js";
import { segnaModifica } from "./modifiche.js";
import { zoomPagina } from "./zoom-pagina.js";

export function avviaImmagini() {
  const file = document.getElementById("file-immagine");
  let cursore = null;

  document.getElementById("btn-immagine").addEventListener("mousedown", () => {
    cursore = salvaCursore();
  });
  document.getElementById("btn-immagine").addEventListener("click", () => file.click());
  file.addEventListener("change", async () => {
    const scelto = file.files?.[0];
    file.value = "";
    if (!scelto) return;
    ripristinaCursore(cursore);
    await inserisciDaFile(scelto);
  });

  foglio.addEventListener("paste", async (evento) => {
    const elementi = [...(evento.clipboardData?.items || [])];
    const immagine = elementi.find((item) => item.type.startsWith("image/"));
    if (!immagine) return;
    evento.preventDefault();
    const blob = immagine.getAsFile();
    if (blob) await inserisciDaFile(blob);
  });

  foglio.addEventListener("dragover", (evento) => evento.preventDefault());
  foglio.addEventListener("drop", async (evento) => {
    const fileImmagine = [...(evento.dataTransfer?.files || [])].find((item) => item.type.startsWith("image/"));
    if (!fileImmagine) return;
    evento.preventDefault();
    await inserisciDaFile(fileImmagine);
  });

  foglio.addEventListener("click", (evento) => {
    const bottone = evento.target.closest(".blocco-immagine button[data-azione]");
    if (!bottone) return;
    const figura = bottone.closest(".blocco-immagine");
    const azione = bottone.dataset.azione;
    if (azione === "elimina-immagine") {
      figura.remove();
      segnaModifica();
    }
    if (azione === "porta-davanti") porta(figura, true);
    if (azione === "porta-dietro") porta(figura, false);
  });

  foglio.addEventListener("mousedown", (evento) => {
    const figuraCliccata = evento.target.closest(".blocco-immagine");
    if (figuraCliccata && foglio.contains(figuraCliccata)) scegliImmagine(figuraCliccata);
    const maniglia = evento.target.closest("[data-ridimensiona]");
    if (maniglia) {
      iniziaRidimensiona(evento, maniglia.closest(".cornice-immagine"), maniglia.dataset.ridimensiona);
      return;
    }
    const img = evento.target.closest(".blocco-immagine img");
    if (img && evento.button !== 2) iniziaSposta(evento, img);
  });

  foglio.addEventListener("contextmenu", (evento) => {
    const img = evento.target.closest(".blocco-immagine img");
    if (!img || !foglio.contains(img)) return;
    evento.preventDefault();
    mostraBarra(img.closest(".blocco-immagine"));
  });

  document.addEventListener("mousedown", (evento) => {
    if (evento.target.closest(".immagine-comandi")) return;
    chiudiBarre();
    if (!evento.target.closest(".blocco-immagine")) togliSceltaImmagini();
  });
  document.addEventListener("keydown", (evento) => {
    if (evento.key !== "Escape") return;
    chiudiBarre();
    togliSceltaImmagini();
  });

  foglio.addEventListener("change", (evento) => {
    if (!evento.target.classList.contains("campo-posizione")) return;
    const figura = evento.target.closest(".blocco-immagine");
    if (!figura) return;
    const valore = evento.target.value;
    if (valore === "libera") {
      figura.dataset.allinea = "libera";
      if (figura.dataset.x == null) figura.dataset.x = "0";
      if (figura.dataset.y == null) figura.dataset.y = "0";
    } else {
      figura.dataset.allinea = valore || "sinistra";
      delete figura.dataset.x;
      delete figura.dataset.y;
    }
    [...evento.target.options].forEach((opzione) => opzione.toggleAttribute("selected", opzione.value === evento.target.value));
    applicaPosizione(figura);
    segnaModifica();
  });

  foglio.addEventListener("input", (evento) => {
    if (evento.target.classList.contains("didascalia")) {
      segnaModifica();
      return;
    }
    const figura = evento.target.closest(".blocco-immagine");
    if (!figura) return;
    if (evento.target.classList.contains("campo-larghezza")) {
      applicaLarghezza(figura, Number(evento.target.value) || 70);
      segnaModifica();
      return;
    }
    if (!evento.target.classList.contains("campo-altezza")) return;
    if (!evento.target.value) {
      delete figura.dataset.altezza;
      const img = figura.querySelector("img");
      if (img) {
        img.style.height = "";
        img.style.objectFit = "";
      }
      evento.target.setAttribute("value", "");
      segnaModifica();
      return;
    }
    applicaAltezza(figura, Number(evento.target.value));
    segnaModifica();
  });

  preparaImmagini();
}

export async function inserisciDaFile(file) {
  try {
    const dataUrl = await preparaImmagine(file);
    inserisciImmagine(dataUrl);
    segnaModifica();
  } catch {
    await avvisa("Non riesco a leggere questa immagine.");
  }
}

function inserisciImmagine(dataUrl) {
  const figura = document.createElement("figure");
  figura.className = "blocco-immagine";
  figura.contentEditable = "false";

  const comandi = document.createElement("div");
  comandi.className = "immagine-comandi solo-editor";
  const elimina = document.createElement("button");
  elimina.type = "button";
  elimina.dataset.azione = "elimina-immagine";
  elimina.textContent = "Elimina immagine";
  comandi.append(elimina, etichettaLarghezza("70"), etichettaAltezza(""), etichettaPosizione("sinistra"), bottonePiano("porta-davanti", "Davanti"), bottonePiano("porta-dietro", "Dietro"));

  const img = document.createElement("img");
  img.src = dataUrl;
  img.alt = "Immagine";
  const foto = document.createElement("div");
  foto.className = "foto-immagine";
  foto.append(img, maniglia("larghezza", "ridimensiona-larghezza", "Trascina per la larghezza"), maniglia("altezza", "ridimensiona-altezza", "Trascina per l'altezza"), maniglia("entrambi", "ridimensiona-immagine", "Trascina per larghezza e altezza"));

  const didascalia = document.createElement("figcaption");
  didascalia.className = "didascalia";
  didascalia.contentEditable = "true";

  const cornice = document.createElement("div");
  cornice.className = "cornice-immagine allinea-sinistra";
  cornice.style.width = "70%";
  cornice.append(comandi, foto, didascalia);

  figura.dataset.allinea = "sinistra";
  figura.append(cornice);
  inserisciBlocco(figura);
  scegliImmagine(figura);
}

export function preparaImmagini(radice = foglio) {
  if (!radice) return;
  radice.querySelectorAll(".blocco-immagine").forEach((figura) => {
    const img = figura.querySelector("img");
    if (!img) return;
    let cornice = figura.querySelector(".cornice-immagine");
    if (!cornice) {
      cornice = document.createElement("div");
      cornice.className = "cornice-immagine";
      const scritta = figura.querySelector(".campo-larghezza")?.value || String(parseFloat(img.style.width) || 70);
      img.style.width = "";
      img.replaceWith(cornice);
      cornice.append(img);
      cornice.style.width = `${Math.min(100, Math.max(10, Number(scritta) || 70))}%`;
    }
    let foto = cornice.querySelector(".foto-immagine");
    if (!foto) {
      foto = document.createElement("div");
      foto.className = "foto-immagine";
      const presa = cornice.querySelector(".ridimensiona-immagine");
      foto.append(img);
      if (presa) foto.append(presa);
      cornice.append(foto);
    }
    assicuraManiglia(foto, "larghezza", "ridimensiona-larghezza", "Trascina per la larghezza");
    assicuraManiglia(foto, "altezza", "ridimensiona-altezza", "Trascina per l'altezza");
    assicuraManiglia(foto, "entrambi", "ridimensiona-immagine", "Trascina per larghezza e altezza");
    const comandiPresenti = figura.querySelector(".immagine-comandi");
    if (comandiPresenti && !figura.querySelector(".campo-altezza")) comandiPresenti.append(etichettaAltezza(figura.dataset.altezza || ""));
    if (comandiPresenti && !figura.querySelector("[data-azione='porta-davanti']")) {
      comandiPresenti.append(bottonePiano("porta-davanti", "Davanti"), bottonePiano("porta-dietro", "Dietro"));
    }
    if (figura.dataset.altezza) applicaAltezza(figura, figura.dataset.altezza);
    applicaPiano(figura);
    const comandi = figura.querySelector(".immagine-comandi");
    if (comandi && comandi.parentElement !== cornice) cornice.prepend(comandi);
    const didascalia = figura.querySelector(".didascalia");
    if (didascalia && didascalia.parentElement !== cornice) cornice.append(didascalia);
    if (!figura.querySelector(".campo-posizione")) {
      figura.querySelector(".immagine-comandi")?.append(etichettaPosizione(figura.dataset.allinea || "sinistra"));
    }
    if (!figura.dataset.allinea) figura.dataset.allinea = "sinistra";
    applicaPosizione(figura);
  });
}

function scegliImmagine(figura) {
  document.querySelectorAll(".blocco-immagine.scelta").forEach((altra) => {
    if (altra !== figura) altra.classList.remove("scelta");
  });
  figura.classList.add("scelta");
}

function togliSceltaImmagini() {
  document.querySelectorAll(".blocco-immagine.scelta").forEach((figura) => figura.classList.remove("scelta"));
}

function mostraBarra(figura) {
  chiudiBarre();
  figura?.querySelector(".immagine-comandi")?.classList.add("aperta");
}

function chiudiBarre() {
  document.querySelectorAll(".immagine-comandi.aperta").forEach((barra) => barra.classList.remove("aperta"));
}

function etichettaLarghezza(valore) {
  const etichetta = document.createElement("label");
  etichetta.append(document.createTextNode("Larghezza % "));
  const larghezza = document.createElement("input");
  larghezza.type = "number";
  larghezza.className = "campo-larghezza";
  larghezza.min = "10";
  larghezza.max = "100";
  larghezza.value = valore;
  larghezza.setAttribute("value", valore);
  etichetta.append(larghezza);
  return etichetta;
}

function etichettaPosizione(valore) {
  const etichetta = document.createElement("label");
  etichetta.append(document.createTextNode("Posizione "));
  const select = document.createElement("select");
  select.className = "campo-posizione";
  select.title = "Allinea la foto, oppure scegli Libera e trascinala";
  [
    ["sinistra", "Sinistra"],
    ["centro", "Centro"],
    ["destra", "Destra"],
    ["libera", "Libera"],
  ].forEach(([chiave, testo]) => {
    const opzione = document.createElement("option");
    opzione.value = chiave;
    opzione.textContent = testo;
    if (chiave === valore) opzione.selected = true;
    select.append(opzione);
  });
  etichetta.append(select);
  return etichetta;
}

function maniglia(tipo, classe, titolo) {
  const presa = document.createElement("span");
  presa.className = `${classe} solo-editor`;
  presa.dataset.ridimensiona = tipo;
  presa.title = titolo;
  return presa;
}

function assicuraManiglia(foto, tipo, classe, titolo) {
  let presa = foto.querySelector(`.${classe}`);
  if (!presa) {
    presa = maniglia(tipo, classe, titolo);
    foto.append(presa);
  }
  presa.dataset.ridimensiona = tipo;
}

function etichettaAltezza(valore) {
  const etichetta = document.createElement("label");
  etichetta.append(document.createTextNode("Altezza px "));
  const altezza = document.createElement("input");
  altezza.type = "number";
  altezza.className = "campo-altezza";
  altezza.min = "20";
  altezza.max = "800";
  altezza.placeholder = "auto";
  altezza.title = "Lascia vuoto per tenere le proporzioni";
  altezza.value = valore;
  altezza.setAttribute("value", valore);
  etichetta.append(altezza);
  return etichetta;
}

function bottonePiano(azione, testo) {
  const button = document.createElement("button");
  button.type = "button";
  button.dataset.azione = azione;
  button.textContent = testo;
  button.title = azione === "porta-davanti" ? "Mette la foto sopra le altre" : "Mette la foto sotto le altre";
  return button;
}

function applicaLarghezza(figura, valore) {
  const percento = Math.min(100, Math.max(10, Math.round(Number(valore) || 70)));
  const cornice = figura.querySelector(".cornice-immagine");
  if (cornice) cornice.style.width = `${percento}%`;
  const campo = figura.querySelector(".campo-larghezza");
  if (campo) {
    campo.value = String(percento);
    campo.setAttribute("value", String(percento));
  }
}

function applicaAltezza(figura, pixel) {
  const altezza = Math.min(800, Math.max(20, Math.round(Number(pixel) || 20)));
  figura.dataset.altezza = String(altezza);
  const img = figura.querySelector("img");
  if (img) {
    img.style.height = `${altezza}px`;
    img.style.objectFit = "fill";
  }
  const campo = figura.querySelector(".campo-altezza");
  if (campo) {
    campo.value = String(altezza);
    campo.setAttribute("value", String(altezza));
  }
}

function applicaPiano(figura) {
  if (figura.dataset.piano) figura.style.zIndex = figura.dataset.piano;
  else figura.style.zIndex = "";
}

function porta(figura, davanti) {
  const tutte = [...document.querySelectorAll(".blocco-immagine")];
  tutte.forEach((item, indice) => {
    if (!item.dataset.piano) item.dataset.piano = String(indice + 1);
  });
  const numeri = tutte.map((item) => Number(item.dataset.piano));
  figura.dataset.piano = String(davanti ? Math.max(...numeri) + 1 : Math.min(...numeri) - 1);
  tutte.forEach(applicaPiano);
  segnaModifica();
}

function applicaPosizione(figura) {
  const cornice = figura.querySelector(".cornice-immagine");
  if (!cornice) return;
  const modo = figura.dataset.allinea || "sinistra";
  cornice.classList.remove("allinea-sinistra", "allinea-centro", "allinea-destra", "pos-libera");
  cornice.style.left = "";
  cornice.style.top = "";
  if (modo === "libera") {
    cornice.classList.add("pos-libera");
    cornice.style.left = `${figura.dataset.x || 0}px`;
    cornice.style.top = `${figura.dataset.y || 0}px`;
    return;
  }
  cornice.classList.add(`allinea-${modo}`);
}

function iniziaRidimensiona(evento, cornice, modo) {
  if (!cornice) return;
  evento.preventDefault();
  const figura = cornice.closest(".blocco-immagine");
  const startX = evento.clientX;
  const startY = evento.clientY;
  const zoom = zoomPagina();
  const schermo = cornice.querySelector("img").getBoundingClientRect();
  const foto = { width: schermo.width / zoom, height: schermo.height / zoom };
  const spazio = figura.clientWidth || 1;
  const cursore = modo === "larghezza" ? "cursore-larghezza" : modo === "altezza" ? "cursore-altezza" : "cursore-immagine";

  function muovi(movimento) {
    if (modo !== "altezza") applicaLarghezza(figura, ((foto.width + (movimento.clientX - startX) / zoom) / spazio) * 100);
    if (modo !== "larghezza") applicaAltezza(figura, foto.height + (movimento.clientY - startY) / zoom);
  }

  function fine() {
    document.removeEventListener("mousemove", muovi);
    document.removeEventListener("mouseup", fine);
    document.body.classList.remove(cursore);
    segnaModifica();
  }

  document.body.classList.add(cursore);
  document.addEventListener("mousemove", muovi);
  document.addEventListener("mouseup", fine);
}

function iniziaSposta(evento, img) {
  evento.preventDefault();
  const figura = img.closest(".blocco-immagine");
  const cornice = img.closest(".cornice-immagine");
  if (!figura || !cornice) return;
  const startX = evento.clientX;
  const startY = evento.clientY;
  const zoom = zoomPagina();
  const boxFigura = figura.getBoundingClientRect();
  const boxCornice = cornice.getBoundingClientRect();
  const origineX = figura.dataset.allinea === "libera" ? parseFloat(figura.dataset.x || "0") : (boxCornice.left - boxFigura.left) / zoom;
  const origineY = figura.dataset.allinea === "libera" ? parseFloat(figura.dataset.y || "0") : 0;
  let mosso = false;

  function muovi(movimento) {
    const deltaX = (movimento.clientX - startX) / zoom;
    const deltaY = (movimento.clientY - startY) / zoom;
    if (!mosso && Math.hypot(deltaX, deltaY) < 4) return;
    mosso = true;
    const spazio = figura.clientWidth || 0;
    const x = Math.round(Math.min(spazio - 30, Math.max(-80, origineX + deltaX)));
    const y = Math.round(Math.min(480, Math.max(-220, origineY + deltaY)));
    figura.dataset.allinea = "libera";
    figura.dataset.x = String(x);
    figura.dataset.y = String(y);
    const select = figura.querySelector(".campo-posizione");
    if (select && select.value !== "libera") {
      select.value = "libera";
      [...select.options].forEach((opzione) => opzione.toggleAttribute("selected", opzione.value === "libera"));
    }
    applicaPosizione(figura);
    document.body.classList.add("cursore-sposta-immagine");
  }

  function fine() {
    document.removeEventListener("mousemove", muovi);
    document.removeEventListener("mouseup", fine);
    document.body.classList.remove("cursore-sposta-immagine");
    if (mosso) segnaModifica();
  }

  document.addEventListener("mousemove", muovi);
  document.addEventListener("mouseup", fine);
}

function preparaImmagine(file) {
  return new Promise((resolve, reject) => {
    const lettore = new FileReader();
    lettore.onerror = () => reject(lettore.error);
    lettore.onload = async () => {
      try {
        resolve(await riduciSeServe(String(lettore.result)));
      } catch (errore) {
        reject(errore);
      }
    };
    lettore.readAsDataURL(file);
  });
}

function riduciSeServe(dataUrl) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const massimo = 1600;
      if (img.width <= massimo && img.height <= massimo) {
        resolve(dataUrl);
        return;
      }
      const scala = massimo / Math.max(img.width, img.height);
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.width * scala);
      canvas.height = Math.round(img.height * scala);
      canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
      const tipo = dataUrl.startsWith("data:image/png") ? "image/png" : "image/jpeg";
      resolve(canvas.toDataURL(tipo, 0.9));
    };
    img.onerror = () => reject(new Error("immagine"));
    img.src = dataUrl;
  });
}
