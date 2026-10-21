// Le tabulazioni: il tasto Tab mette un salto che arriva fino al prossimo punto fissato sul righello.
// Ogni paragrafo ricorda i suoi punti in data-tabulazioni, per esempio "sinistra:40;destra:170",
// cioè millimetri dal margine sinistro. Senza punti si salta ogni 1,27 cm, come fa Word.

import { foglio } from "./editor.js";
import { segnaModifica } from "./modifiche.js";
import { zoomPagina } from "./zoom-pagina.js";

export const TIPI_TABULAZIONE = ["sinistra", "centro", "destra", "decimale"];
export const PIXEL_PER_MM = 96 / 25.4;
const PASSO_NORMALE = 12.7;
const BLOCCHI = "p, h1, h2, h3, h4, li, div";
const SPECIALI = ".blocco-tabella, .blocco-immagine, .blocco-forma, .interruzione";

let attesa = 0;

export function avviaTabulazioni() {
  foglio.addEventListener("keydown", (evento) => {
    if (evento.key !== "Tab" || evento.ctrlKey || evento.altKey || evento.metaKey || evento.shiftKey) return;
    const selezione = window.getSelection();
    if (!selezione?.rangeCount) return;
    const range = selezione.getRangeAt(0);
    if (!foglio.contains(range.startContainer) || !paragrafoDi(range.startContainer)) return;
    evento.preventDefault();
    inserisciTabulazione(range);
  });

  // Le larghezze dei salti cambiano col testo: si ricalcolano dopo ogni modifica.
  new MutationObserver((cambi) => {
    if (cambi.every((cambio) => cambio.type === "attributes" && cambio.target.classList?.contains("tabulazione"))) return;
    ridisponi();
  }).observe(foglio, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ["class", "style", "data-tabulazioni"] });
  document.addEventListener("formato-pagina", ridisponi);
  document.addEventListener("relazione-modificata", ridisponi);
  window.addEventListener("resize", ridisponi);
  document.fonts?.ready.then(ridisponi);
  ridisponi();
}

export function leggiTabulazioni(paragrafo) {
  return (paragrafo.dataset.tabulazioni || "")
    .split(";")
    .map((voce) => {
      const [tipo, posizione] = voce.split(":");
      return { tipo, pos: Number(posizione) };
    })
    .filter((punto) => TIPI_TABULAZIONE.includes(punto.tipo) && Number.isFinite(punto.pos))
    .sort((a, b) => a.pos - b.pos);
}

export function scriviTabulazioni(paragrafo, punti) {
  const validi = punti.filter((punto) => !punto.tolto).sort((a, b) => a.pos - b.pos);
  if (!validi.length) paragrafo.removeAttribute("data-tabulazioni");
  else paragrafo.dataset.tabulazioni = validi.map((punto) => `${punto.tipo}:${Math.round(punto.pos * 10) / 10}`).join(";");
}

// Il paragrafo che contiene il nodo, se è un paragrafo normale del foglio (non tabelle o immagini).
export function paragrafoDi(nodo) {
  const elemento = nodo?.nodeType === Node.ELEMENT_NODE ? nodo : nodo?.parentElement;
  const paragrafo = elemento?.closest(BLOCCHI);
  if (!paragrafo || paragrafo === foglio || !foglio.contains(paragrafo)) return null;
  if (paragrafo.closest(SPECIALI) || paragrafo.matches(SPECIALI)) return null;
  return paragrafo;
}

export function paragrafiSelezionati() {
  const selezione = window.getSelection();
  if (!selezione?.rangeCount) return [];
  const range = selezione.getRangeAt(0);
  if (!foglio.contains(range.commonAncestorContainer)) return [];
  const primo = paragrafoDi(range.startContainer);
  if (range.collapsed) return primo ? [primo] : [];
  const tutti = [...foglio.querySelectorAll(BLOCCHI)].filter(
    (elemento) => !elemento.querySelector(BLOCCHI) && paragrafoDi(elemento) === elemento && range.intersectsNode(elemento),
  );
  if (tutti.length) return tutti;
  return primo ? [primo] : [];
}

// Dove comincia il testo sullo schermo (in pixel) e quanto è largo (in millimetri).
export function misureTesto() {
  const zoom = zoomPagina();
  const stile = getComputedStyle(foglio);
  const sinistra = parseFloat(stile.paddingLeft) || 0;
  const destra = parseFloat(stile.paddingRight) || 0;
  return {
    zoom,
    scala: PIXEL_PER_MM * zoom,
    inizio: foglio.getBoundingClientRect().left + sinistra * zoom,
    larghezza: (foglio.clientWidth - sinistra - destra) / PIXEL_PER_MM,
  };
}

export function ridisponi() {
  if (attesa) return;
  attesa = requestAnimationFrame(() => {
    attesa = 0;
    const paragrafi = new Set([...foglio.querySelectorAll(".tabulazione")].map(paragrafoDi).filter(Boolean));
    paragrafi.forEach(disponiParagrafo);
  });
}

export function disponiParagrafo(paragrafo) {
  const salti = [...paragrafo.querySelectorAll(".tabulazione")].filter((salto) => paragrafoDi(salto) === paragrafo);
  if (!salti.length) return;
  const { scala, inizio, larghezza } = misureTesto();
  const punti = leggiTabulazioni(paragrafo);
  salti.forEach((salto) => {
    salto.style.width = "0mm";
  });
  salti.forEach((salto, indice) => {
    const x = (salto.getBoundingClientRect().left - inizio) / scala;
    const punto = punti.find((voce) => voce.pos > x + 0.2) || { tipo: "sinistra", pos: (Math.floor((x + 0.2) / PASSO_NORMALE) + 1) * PASSO_NORMALE };
    let spazio = punto.pos - x;
    if (punto.tipo !== "sinistra") {
      const pezzo = larghezzaPezzo(salto, salti[indice + 1], paragrafo, punto.tipo) / scala;
      spazio -= punto.tipo === "centro" ? pezzo / 2 : pezzo;
    }
    spazio = Math.max(0, Math.min(spazio, larghezza - x));
    salto.style.width = `${spazio.toFixed(2)}mm`;
  });
}

function inserisciTabulazione(range) {
  range.deleteContents();
  const salto = document.createElement("span");
  salto.className = "tabulazione";
  salto.contentEditable = "false";
  salto.textContent = "\t";
  range.insertNode(salto);

  // Dopo il salto serve del testo dove mettere il cursore: se manca, un carattere invisibile.
  let dopo = salto.nextSibling;
  if (!dopo || dopo.nodeType !== Node.TEXT_NODE || !dopo.textContent) {
    dopo = document.createTextNode("\u200B");
    salto.after(dopo);
  }
  const cursore = document.createRange();
  cursore.setStart(dopo, dopo.textContent.startsWith("\u200B") ? 1 : 0);
  cursore.collapse(true);
  const selezione = window.getSelection();
  selezione.removeAllRanges();
  selezione.addRange(cursore);

  const paragrafo = paragrafoDi(salto);
  if (paragrafo) disponiParagrafo(paragrafo);
  segnaModifica();
}

// Quanto è largo il testo dopo il salto (fino al salto seguente), sulla stessa riga.
// Per la tabulazione decimale conta solo fino alla virgola o al punto.
function larghezzaPezzo(salto, prossimo, paragrafo, tipo) {
  const range = document.createRange();
  range.setStartAfter(salto);
  if (prossimo) range.setEndBefore(prossimo);
  else range.setEnd(paragrafo, paragrafo.childNodes.length);

  if (tipo === "decimale") {
    const giro = document.createTreeWalker(paragrafo, NodeFilter.SHOW_TEXT);
    while (giro.nextNode()) {
      const nodo = giro.currentNode;
      if (!range.intersectsNode(nodo)) continue;
      const dove = nodo.textContent.search(/[,.]/);
      if (dove >= 0) {
        range.setEnd(nodo, dove);
        break;
      }
    }
  }

  const rettangoli = [...range.getClientRects()].filter((r) => r.width > 0);
  if (!rettangoli.length) return 0;
  const riga = rettangoli.filter((r) => Math.abs(r.top - rettangoli[0].top) < 2);
  return Math.max(...riga.map((r) => r.right)) - Math.min(...riga.map((r) => r.left));
}
