// Pulsante "Collega cella": scegli col mouse la cella da mostrare nel testo.

import { foglio, salvaCursore } from "./editor.js";
import { avvisa } from "./finestre.js";
import { collegaCellaAlCursore, inserisciDaFinestra } from "./riferimenti.js";

let cursoreTesto = null;
let attivo = false;

export function avviaCollegaCella() {
  const bottone = document.getElementById("btn-riferimento");
  let cursore = null;
  bottone.addEventListener("mousedown", () => {
    cursore = salvaCursore();
  });
  bottone.addEventListener("click", () => iniziaCollegaCella(cursore));

  document.addEventListener("mousedown", sceltaConMouse, true);
  document.addEventListener("keydown", (evento) => {
    if (attivo && evento.key === "Escape") chiudi();
  });
  document.getElementById("collega-annulla").addEventListener("click", chiudi);
  document.getElementById("collega-a-mano").addEventListener("click", () => {
    const cursore = cursoreTesto;
    chiudi();
    inserisciDaFinestra(cursore);
  });
}

function iniziaCollegaCella(cursore) {
  if (!document.querySelector("#foglio .blocco-tabella")) {
    avvisa("Prima inserisci una tabella.");
    return;
  }
  if (!cursoreNelTesto(cursore)) {
    avvisa("Prima clicca nel testo, nel punto dove vuoi far comparire il valore. Poi premi Collega cella.");
    return;
  }
  cursoreTesto = cursore;
  attivo = true;
  document.body.classList.add("scegli-cella-collega");
  document.getElementById("avviso-collega").hidden = false;
}

function cursoreNelTesto(cursore) {
  if (!cursore) return false;
  const nodo = cursore.startContainer;
  const elemento = nodo.nodeType === Node.ELEMENT_NODE ? nodo : nodo.parentElement;
  if (!elemento || !foglio.contains(elemento)) return false;
  return !elemento.closest(".blocco-tabella, .blocco-immagine, .riferimento");
}

function sceltaConMouse(evento) {
  if (!attivo || evento.button !== 0) return;
  if (evento.target.closest("#avviso-collega")) return;
  const td = evento.target.closest("td[data-cella]");
  if (!td || !foglio.contains(td)) {
    chiudi();
    return;
  }
  evento.preventDefault();
  evento.stopPropagation();
  const id = td.closest(".blocco-tabella")?.dataset.id;
  const cursore = cursoreTesto;
  chiudi();
  if (!id || !document.contains(cursore.startContainer)) {
    avvisa("Il punto nel testo non c’è più. Clicca di nuovo nel testo e riprova.");
    return;
  }
  collegaCellaAlCursore(cursore, id, td.dataset.cella);
}

function chiudi() {
  attivo = false;
  cursoreTesto = null;
  document.body.classList.remove("scegli-cella-collega");
  document.getElementById("avviso-collega").hidden = true;
}
