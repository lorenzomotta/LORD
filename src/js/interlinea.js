// Interlinea dei paragrafi: la usano la barra in alto e il menu del tasto destro.

import { foglio } from "./editor.js";

const FASCE = "#intestazione-foglio, #pie-foglio";
const SCELTE = [1, 1.15, 1.5, 2];
const NON_TESTO = ["taglio-pagina", "blocco-tabella", "blocco-immagine", "blocco-forma", "interruzione"];

export function avviaInterlinea() {
  document.addEventListener("selectionchange", () => {
    const valore = interlineaCorrente();
    if (valore) document.getElementById("interlinea").value = valore;
  });
}

// Applica l'interlinea a tutti i paragrafi toccati dalla selezione (non solo al primo).
export function applicaInterlinea(valore) {
  const selezione = window.getSelection();
  if (!selezione?.rangeCount) return;
  const fascia = elementoDi(selezione.anchorNode)?.closest(FASCE);
  if (fascia) {
    impostaSu(fascia, valore);
    return;
  }
  paragrafiSelezionati(selezione.getRangeAt(0)).forEach((blocco) => impostaSu(blocco, valore));
}

// Il valore della tendina più vicino all'interlinea del paragrafo dove si trova il cursore.
export function interlineaCorrente() {
  const selezione = window.getSelection();
  const elemento = elementoDi(selezione?.anchorNode);
  if (!elemento || !(foglio.contains(elemento) || elemento.closest(FASCE))) return null;
  if (elemento.closest("td, input, textarea, select")) return null;
  const stile = getComputedStyle(elemento.closest("p, div, h1, h2, h3, li") || elemento);
  const font = parseFloat(stile.fontSize) || 16;
  const rapporto = stile.lineHeight === "normal" ? 1.15 : (parseFloat(stile.lineHeight) || font * 1.15) / font;
  const vicina = SCELTE.reduce((meglio, scelta) => (Math.abs(scelta - rapporto) < Math.abs(meglio - rapporto) ? scelta : meglio));
  return String(vicina);
}

// Toglie anche le interlinee rimaste sulle parti interne (per esempio testo incollato),
// altrimenti quelle avrebbero la precedenza e il paragrafo resterebbe a metà.
function impostaSu(blocco, valore) {
  blocco.querySelectorAll("[style]").forEach((interno) => {
    if (interno.closest("td, .blocco-tabella, .blocco-immagine, .blocco-forma")) return;
    interno.style.removeProperty("line-height");
  });
  blocco.style.lineHeight = valore;
}

export function paragrafiSelezionati(range) {
  const primo = bloccoAlPunto(range.startContainer, range.startOffset, false);
  const ultimo = bloccoAlPunto(range.endContainer, range.endOffset, true) || primo;
  if (!primo) return [];
  const blocchi = [];
  for (let blocco = primo; blocco; blocco = blocco.nextElementSibling) {
    if (!NON_TESTO.some((classe) => blocco.classList.contains(classe))) blocchi.push(blocco);
    if (blocco === ultimo) break;
  }
  return blocchi;
}

// Con Ctrl+A la selezione può iniziare o finire sul foglio stesso, tra un paragrafo e l'altro.
function bloccoAlPunto(contenitore, posizione, fine) {
  if (contenitore !== foglio) return bloccoDiretto(contenitore);
  const elementi = [...foglio.childNodes].filter((nodo, indice) => nodo.nodeType === 1 && (fine ? indice < posizione : indice >= posizione));
  return fine ? elementi[elementi.length - 1] : elementi[0];
}

function bloccoDiretto(nodo) {
  let elemento = elementoDi(nodo);
  if (!elemento || !foglio.contains(elemento) || elemento === foglio) return null;
  while (elemento.parentElement !== foglio) elemento = elemento.parentElement;
  return elemento;
}

function elementoDi(nodo) {
  if (!nodo) return null;
  return nodo.nodeType === 1 ? nodo : nodo.parentElement;
}
