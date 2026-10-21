// Spazio sotto ogni paragrafo, prima di quello successivo (come "Spaziatura dopo" in Word).

import { foglio } from "./editor.js";
import { paragrafiSelezionati } from "./interlinea.js";
import { segnaModifica } from "./modifiche.js";

const SCELTE = [0, 3, 6, 8, 12];

export function avviaSpazioParagrafi() {
  const tendina = document.getElementById("spazio-dopo");
  let memoria = null;
  tendina.addEventListener("mousedown", () => {
    memoria = salvaSelezione();
  });
  tendina.addEventListener("change", () => {
    ripristinaSelezione(memoria);
    applicaSpazioDopo(tendina.value);
  });
  document.addEventListener("selectionchange", () => {
    const valore = spazioCorrente();
    if (valore) tendina.value = valore;
  });
}

export function applicaSpazioDopo(punti) {
  const selezione = window.getSelection();
  if (!selezione?.rangeCount || !foglio.contains(selezione.anchorNode)) return;
  paragrafiSelezionati(selezione.getRangeAt(0)).forEach((blocco) => {
    blocco.style.marginBottom = `${punti}pt`;
  });
  segnaModifica();
}

// La scelta più vicina allo spazio del paragrafo dove si trova il cursore.
export function spazioCorrente() {
  const nodo = window.getSelection()?.anchorNode;
  const elemento = nodo?.nodeType === 1 ? nodo : nodo?.parentElement;
  if (!elemento || !foglio.contains(elemento) || elemento === foglio) return null;
  if (elemento.closest("td, input, textarea, select")) return null;
  let blocco = elemento;
  while (blocco.parentElement !== foglio) blocco = blocco.parentElement;
  const punti = (parseFloat(getComputedStyle(blocco).marginBottom) || 0) * 0.75;
  const vicina = SCELTE.reduce((meglio, scelta) => (Math.abs(scelta - punti) < Math.abs(meglio - punti) ? scelta : meglio));
  return String(vicina);
}

function salvaSelezione() {
  const selezione = window.getSelection();
  if (!selezione?.rangeCount || !foglio.contains(selezione.anchorNode)) return null;
  return selezione.getRangeAt(0).cloneRange();
}

function ripristinaSelezione(range) {
  if (!range) return;
  foglio.focus();
  const selezione = window.getSelection();
  selezione.removeAllRanges();
  selezione.addRange(range);
}
