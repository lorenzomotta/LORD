// Taglia, Copia e Incolla dalla barra: fanno quello che fanno Ctrl+X, Ctrl+C e Ctrl+V.

import { avvisa } from "./finestre.js";
import { inserisciDaFile } from "./immagini.js";
import { messaggio, segnaModifica } from "./modifiche.js";
import { blocchiNellaSelezione, confermaSelezione } from "./proteggi-blocchi.js";

export function avviaAppunti() {
  prepara("btn-taglia", taglia);
  prepara("btn-copia", copia);
  prepara("btn-incolla", incolla);
}

function prepara(id, azione) {
  const bottone = document.getElementById(id);
  // Così il clic non toglie la selezione dal foglio.
  bottone.addEventListener("mousedown", (evento) => evento.preventDefault());
  bottone.addEventListener("click", azione);
}

function campoAttivo() {
  const attivo = document.activeElement;
  return attivo?.matches?.("input, textarea") ? attivo : null;
}

// La parte del foglio (o intestazione e piè di pagina) dove si trova la selezione.
function zonaSelezione() {
  const selezione = window.getSelection();
  if (!selezione?.rangeCount) return null;
  const nodo = selezione.anchorNode;
  const elemento = nodo?.nodeType === 1 ? nodo : nodo?.parentElement;
  if (!elemento?.isContentEditable) return null;
  let zona = elemento;
  while (zona.parentElement?.isContentEditable) zona = zona.parentElement;
  return zona;
}

function niente() {
  const campo = campoAttivo();
  if (campo) return campo.selectionStart === campo.selectionEnd;
  return !zonaSelezione() || window.getSelection().isCollapsed;
}

async function copia() {
  if (niente()) {
    messaggio("Seleziona prima il testo da copiare.");
    return;
  }
  if (await copiaSelezione()) messaggio("Copiato.");
  else avvisa("Non riesco a copiare da qui: usa Ctrl+C.");
}

async function taglia() {
  if (niente()) {
    messaggio("Seleziona prima il testo da tagliare.");
    return;
  }
  const campo = campoAttivo();
  if (!(await copiaSelezione())) {
    avvisa("Non riesco a tagliare da qui: usa Ctrl+X.");
    return;
  }
  if (campo) {
    campo.setRangeText("", campo.selectionStart, campo.selectionEnd, "end");
    campo.dispatchEvent(new Event("input", { bubbles: true }));
    return;
  }
  const coinvolti = blocchiNellaSelezione();
  if (coinvolti.length) {
    await confermaSelezione(window.getSelection().getRangeAt(0).cloneRange(), coinvolti);
    return;
  }
  document.execCommand("delete");
  segnaModifica();
}

async function incolla() {
  const campo = campoAttivo();
  const zona = campo ? null : zonaSelezione();
  if (!campo && !zona) {
    messaggio("Metti prima il cursore nel punto dove incollare.");
    return;
  }
  const range = campo ? null : window.getSelection().getRangeAt(0).cloneRange();

  let contenuto = null;
  try {
    contenuto = await leggiAppunti(Boolean(campo));
  } catch {
    await avvisa("Il programma non ha il permesso di leggere gli appunti. Usa Ctrl+V.");
    return;
  }
  if (!contenuto) {
    messaggio("Non c'è niente da incollare.");
    return;
  }

  if (campo) {
    campo.focus();
    campo.setRangeText(contenuto.testo || "", campo.selectionStart, campo.selectionEnd, "end");
    campo.dispatchEvent(new Event("input", { bubbles: true }));
    return;
  }

  // Leggere gli appunti può far perdere il cursore: lo rimetto dov'era.
  zona.focus();
  const selezione = window.getSelection();
  selezione.removeAllRanges();
  selezione.addRange(range);

  const coinvolti = blocchiNellaSelezione();
  if (coinvolti.length && !(await confermaSelezione(range.cloneRange(), coinvolti))) return;

  if (contenuto.immagine) await inserisciDaFile(contenuto.immagine);
  else if (contenuto.html) document.execCommand("insertHTML", false, ripulisci(contenuto.html));
  else document.execCommand("insertText", false, contenuto.testo);
  segnaModifica();
}

// Prima il modo classico; se il programma non lo permette, gli appunti moderni.
async function copiaSelezione() {
  if (document.execCommand("copy")) return true;
  const campo = campoAttivo();
  let testo = "";
  let html = "";
  if (campo) {
    testo = campo.value.slice(campo.selectionStart, campo.selectionEnd);
  } else {
    const range = window.getSelection().getRangeAt(0);
    const contenitore = document.createElement("div");
    contenitore.append(range.cloneContents());
    testo = window.getSelection().toString();
    html = contenitore.innerHTML;
  }
  try {
    if (html && window.ClipboardItem) {
      await navigator.clipboard.write([
        new ClipboardItem({
          "text/html": new Blob([html], { type: "text/html" }),
          "text/plain": new Blob([testo], { type: "text/plain" }),
        }),
      ]);
    } else {
      await navigator.clipboard.writeText(testo);
    }
    return true;
  } catch {
    return false;
  }
}

// Restituisce { html, testo } oppure { immagine }. Se c'è del testo, vince sul disegno.
async function leggiAppunti(soloTesto) {
  if (soloTesto || !navigator.clipboard.read) {
    const testo = await navigator.clipboard.readText();
    return testo ? { testo } : null;
  }
  const elementi = await navigator.clipboard.read();
  for (const elemento of elementi) {
    if (elemento.types.includes("text/html")) {
      const html = await (await elemento.getType("text/html")).text();
      const testo = elemento.types.includes("text/plain") ? await (await elemento.getType("text/plain")).text() : "";
      return { html, testo };
    }
    if (elemento.types.includes("text/plain")) {
      const testo = await (await elemento.getType("text/plain")).text();
      if (testo) return { testo };
    }
    const tipoImmagine = elemento.types.find((tipo) => tipo.startsWith("image/"));
    if (tipoImmagine) return { immagine: await elemento.getType(tipoImmagine) };
  }
  return null;
}

// Tiene solo il pezzo copiato, senza le parti nascoste che aggiungono Word e i browser.
function ripulisci(html) {
  const inizio = html.indexOf("<!--StartFragment-->");
  const fine = html.indexOf("<!--EndFragment-->");
  if (inizio >= 0 && fine > inizio) html = html.slice(inizio + "<!--StartFragment-->".length, fine);
  const modello = document.createElement("template");
  modello.innerHTML = html;
  modello.content.querySelectorAll("script, style, meta, link, title").forEach((nodo) => nodo.remove());
  return modello.innerHTML;
}
