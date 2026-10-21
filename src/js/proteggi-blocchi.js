// Tabelle e immagini non si cancellano per sbaglio con Canc o Backspace:
// prima di toglierle il programma chiede conferma.

import { foglio } from "./editor.js";
import { conferma } from "./finestre.js";
import { segnaModifica } from "./modifiche.js";
import { eliminaTabella, rimuoviTabella, ricalcolaTutte } from "./tabelle.js";

const PROTETTI = ".blocco-tabella, .blocco-immagine";

export function avviaProteggiBlocchi() {
  // In fase di cattura, così questo controllo arriva prima degli altri tasti del foglio.
  foglio.addEventListener("keydown", tastoCancella, true);
  foglio.addEventListener("beforeinput", selezioneConBlocchi, true);
}

export function bloccoDiretto(nodo) {
  let elemento = nodo && nodo.nodeType === 1 ? nodo : nodo?.parentElement;
  if (!elemento || elemento === foglio) return null;
  while (elemento.parentElement && elemento.parentElement !== foglio) elemento = elemento.parentElement;
  return elemento.parentElement === foglio ? elemento : null;
}

// Vero se tra l'inizio della riga e il cursore non c'è niente di visibile.
export function cursoreAllInizio(blocco) {
  const selezione = window.getSelection();
  if (!selezione?.rangeCount) return false;
  const tratto = document.createRange();
  tratto.setStart(blocco, 0);
  tratto.setEnd(selezione.anchorNode, selezione.anchorOffset);
  return trattoVuoto(tratto);
}

// Vero se tra il cursore e la fine della riga non c'è niente di visibile.
export function cursoreAllaFine(blocco) {
  const selezione = window.getSelection();
  if (!selezione?.rangeCount) return false;
  const tratto = document.createRange();
  tratto.setStart(selezione.anchorNode, selezione.anchorOffset);
  tratto.setEnd(blocco, blocco.childNodes.length);
  return trattoVuoto(tratto);
}

function trattoVuoto(tratto) {
  if (tratto.toString().replace(/\u200b/g, "") !== "") return false;
  const pezzo = tratto.cloneContents();
  return !pezzo.querySelector("img, .riferimento, input, table");
}

// Salta i segni di fine pagina, che servono solo a mostrare dove cambia pagina.
function vicinoVero(blocco, verso) {
  let vicino = blocco[verso];
  while (vicino?.classList.contains("taglio-pagina")) vicino = vicino[verso];
  return vicino;
}

function tastoCancella(evento) {
  if (evento.key !== "Backspace" && evento.key !== "Delete") return;
  if (evento.target.closest("input, textarea, button, .didascalia")) return;
  const selezione = window.getSelection();
  if (!selezione?.rangeCount || !selezione.isCollapsed) return;
  const blocco = bloccoDiretto(selezione.anchorNode);
  if (!blocco) return;

  let vicino = null;
  if (evento.key === "Delete" && cursoreAllaFine(blocco)) vicino = vicinoVero(blocco, "nextElementSibling");
  if (evento.key === "Backspace" && cursoreAllInizio(blocco)) vicino = vicinoVero(blocco, "previousElementSibling");
  if (!vicino) return;

  if (vicino.classList.contains("interruzione")) {
    evento.preventDefault();
    evento.stopImmediatePropagation();
    lampeggia(vicino);
    return;
  }
  if (!vicino.matches(PROTETTI)) return;
  evento.preventDefault();
  evento.stopImmediatePropagation();
  lampeggia(vicino);
  chiediEdElimina(vicino);
}

async function chiediEdElimina(blocco) {
  if (blocco.classList.contains("blocco-tabella")) {
    await eliminaTabella(blocco);
    return;
  }
  if (await conferma("Eliminare l'immagine?")) {
    blocco.remove();
    segnaModifica();
  }
}

// Una selezione che prende dentro tabelle o immagini: Canc, una lettera o Taglia le cancellerebbero.
function selezioneConBlocchi(evento) {
  const tipo = evento.inputType || "";
  if (!tipo.startsWith("delete") && !tipo.startsWith("insert")) return;
  const coinvolti = blocchiNellaSelezione();
  if (!coinvolti.length) return;
  evento.preventDefault();
  const testo = tipo === "insertText" ? evento.data : null;
  confermaSelezione(window.getSelection().getRangeAt(0).cloneRange(), coinvolti, testo);
}

// Tabelle e immagini che la selezione attuale cancellerebbe.
export function blocchiNellaSelezione() {
  const selezione = window.getSelection();
  if (!selezione?.rangeCount || selezione.isCollapsed) return [];
  const range = selezione.getRangeAt(0);
  return [...foglio.querySelectorAll(PROTETTI)].filter(
    (blocco) => range.intersectsNode(blocco) && !(blocco.contains(range.startContainer) && blocco.contains(range.endContainer)),
  );
}

// Chiede conferma, poi cancella la selezione con dentro tabelle e immagini. Vero se l'utente ha detto sì.
export async function confermaSelezione(range, coinvolti, testo = null) {
  const tabelle = coinvolti.filter((blocco) => blocco.classList.contains("blocco-tabella"));
  const immagini = coinvolti.length - tabelle.length;
  const parti = [];
  if (tabelle.length) parti.push(tabelle.length === 1 ? `la tabella ${tabelle[0].dataset.id}` : `${tabelle.length} tabelle`);
  if (immagini) parti.push(immagini === 1 ? "un'immagine" : `${immagini} immagini`);
  const si = await conferma(`La selezione contiene ${parti.join(" e ")}. Eliminare anche ${coinvolti.length === 1 ? "quella" : "quelle"}?`);
  if (!si) return false;

  coinvolti.forEach((blocco) => {
    if (blocco.classList.contains("blocco-tabella")) rimuoviTabella(blocco);
    else blocco.remove();
  });
  foglio.focus();
  const selezione = window.getSelection();
  selezione.removeAllRanges();
  selezione.addRange(range);
  if (!range.collapsed) document.execCommand("delete");
  if (testo) document.execCommand("insertText", false, testo);
  if (tabelle.length) ricalcolaTutte();
  segnaModifica();
  return true;
}

function lampeggia(nodo) {
  nodo.classList.add("evidenziato");
  setTimeout(() => nodo.classList.remove("evidenziato"), 700);
}
