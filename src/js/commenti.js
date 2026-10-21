// Commento sulle parole scelte dal menu del testo (tasto destro).
// Resta nel file salvato. Per cambiarlo, rimetti il cursore su quelle parole e premi di nuovo Commento.
// Per toglierlo, cancella il testo del commento e premi Ok.

import { avvisa, chiedi } from "./finestre.js";
import { messaggio, segnaModifica } from "./modifiche.js";

const ZONE = "#foglio, #intestazione-foglio, #pie-foglio";
const ESCLUSI = "td[data-cella], .blocco-immagine, .blocco-forma, .blocco-tabella, input, textarea, select";
const BLOCCHI = "p, h1, h2, h3, h4, li, div";

export function avviaCommenti() {
  const bottone = document.getElementById("menu-testo-commento");
  bottone.addEventListener("mousedown", (evento) => evento.preventDefault());
  bottone.addEventListener("click", () => {
    document.getElementById("menu-testo").hidden = true;
    modificaCommento();
  });
}

async function modificaCommento() {
  const dove = zonaCorrente();
  if (!dove) {
    messaggio("Metti prima il cursore nel testo, oppure seleziona le parole.");
    return;
  }
  const { range } = dove;
  const esistente = elementoDi(range.startContainer)?.closest(".commento");
  if (!esistente && range.collapsed) {
    messaggio("Seleziona le parole a cui attaccare il commento.");
    return;
  }
  if (!esistente && bloccoDi(range.startContainer) !== bloccoDi(range.endContainer)) {
    await avvisa("Il commento si mette su parole di un solo paragrafo. Seleziona meno testo.");
    ripristina(dove);
    return;
  }
  if (!esistente && range.cloneContents().querySelector?.(".commento")) {
    await avvisa("In questa selezione c'è già un commento. Seleziona solo quelle parole per cambiarlo.");
    ripristina(dove);
    return;
  }

  const risposta = await chiedi({
    titolo: esistente ? "Modifica commento" : "Inserisci commento",
    testo: esistente
      ? "Per togliere il commento cancella il testo e premi Ok: le parole restano."
      : "Scrivi l'appunto. Passando il mouse sulle parole evidenziate lo rileggi.",
    campi: [{ nome: "testo", etichetta: "Commento", tipo: "area", valore: esistente?.dataset.commento || "" }],
  });
  ripristina(dove);
  if (!risposta) return;

  const testo = risposta.testo.trim();
  if (esistente) {
    if (!testo) esistente.replaceWith(...esistente.childNodes);
    else scrivi(esistente, testo);
    segnaModifica();
    messaggio(testo ? "Commento aggiornato." : "Commento tolto.");
    return;
  }

  if (!testo) return;
  const span = document.createElement("span");
  scrivi(span, testo);
  span.append(range.extractContents());
  range.insertNode(span);
  segnaModifica();
  messaggio("Commento inserito.");
}

function scrivi(span, testo) {
  span.className = "commento";
  span.dataset.commento = testo;
  span.title = testo;
}

function zonaCorrente() {
  const selezione = window.getSelection();
  if (!selezione?.rangeCount) return null;
  const elemento = elementoDi(selezione.anchorNode);
  const zona = elemento?.closest(ZONE);
  if (!zona || elemento.closest(ESCLUSI)) return null;
  return { zona, range: selezione.getRangeAt(0).cloneRange() };
}

function ripristina({ zona, range }) {
  zona.focus();
  const selezione = window.getSelection();
  selezione.removeAllRanges();
  try {
    selezione.addRange(range);
  } catch {
    /* La selezione era su un pezzo appena spostato. */
  }
}

function elementoDi(nodo) {
  return nodo?.nodeType === Node.ELEMENT_NODE ? nodo : nodo?.parentElement;
}

function bloccoDi(nodo) {
  const elemento = elementoDi(nodo);
  return elemento?.closest(BLOCCHI) || elemento?.closest(ZONE);
}
