// Tasto "Calcola" del menu cella: scegli col mouse la cella con l'espressione da calcolare.

import { foglio } from "./editor.js";
import { avvisa } from "./finestre.js";

let destinazione = null;

export function avviaCalcolaCella() {
  document.addEventListener("mousedown", sceltaConMouse, true);
  document.addEventListener("keydown", (evento) => {
    if (destinazione && evento.key === "Escape") annullaScelta();
  });
  document.getElementById("calcola-annulla").addEventListener("click", annullaScelta);
}

export function iniziaSceltaCella(td) {
  if (!td) return;
  annullaScelta();
  destinazione = td;
  td.classList.add("cella-destinazione-calcolo");
  document.body.classList.add("scegli-cella-calcolo");
  document.getElementById("avviso-calcola").hidden = false;
}

function sceltaConMouse(evento) {
  if (!destinazione || evento.button !== 0) return;
  if (evento.target.closest("#avviso-calcola")) return;
  const td = evento.target.closest("td[data-cella]");
  if (!td || !foglio.contains(td)) {
    annullaScelta();
    return;
  }
  evento.preventDefault();
  evento.stopPropagation();
  if (td === destinazione) {
    avvisa("Scegli un’altra cella: questa è quella dove andrà il risultato.");
    return;
  }
  const arrivo = destinazione;
  annullaScelta();
  scriviFormula(arrivo, td);
}

function scriviFormula(arrivo, sorgente) {
  if (!document.contains(arrivo)) return;
  const tabellaArrivo = arrivo.closest(".blocco-tabella")?.dataset.id;
  const tabellaSorgente = sorgente.closest(".blocco-tabella")?.dataset.id;
  const indirizzo = tabellaArrivo === tabellaSorgente ? sorgente.dataset.cella : `${tabellaSorgente}.${sorgente.dataset.cella}`;
  document.dispatchEvent(new CustomEvent("selezione-celle", {
    detail: { ancora: arrivo, celle: [arrivo], fuoco: false },
  }));
  document.getElementById("formula").value = `=CALCOLA(${indirizzo})`;
  document.dispatchEvent(new CustomEvent("salva-formula-cella"));
}

function annullaScelta() {
  destinazione?.classList.remove("cella-destinazione-calcolo");
  destinazione = null;
  document.body.classList.remove("scegli-cella-calcolo");
  document.getElementById("avviso-calcola").hidden = true;
}
