// Stampa e Stampa PDF: prepara le pagine dell'anteprima e apre la finestra di stampa.
// Per il PDF si usa la stessa finestra, scegliendo "Salva come PDF" come stampante.

import { apriAnteprima, chiudiAnteprima } from "./anteprima.js";
import { nomeFile, opzioniPagina } from "./documento.js";
import { messaggio } from "./modifiche.js";

let inCorso = false;

export function avviaStampa() {
  // I pulsanti stanno nella barra dell'anteprima, che viene ricreata ogni volta che si apre.
  document.addEventListener("click", (evento) => {
    const pulsante = evento.target.closest("[data-stampa]");
    if (pulsante) stampa(pulsante.dataset.stampa === "pdf");
  });
  document.addEventListener("keydown", (evento) => {
    if ((evento.ctrlKey || evento.metaKey) && evento.key.toLowerCase() === "p") {
      evento.preventDefault();
      stampa(false);
    }
  });
}

async function stampa(pdf) {
  if (inCorso) return;
  inCorso = true;
  const pannello = document.getElementById("anteprima");
  const eraAperta = !pannello.classList.contains("nascosta");
  const titolo = document.title;

  try {
    if (!eraAperta) await apriAnteprima();
    impostaFoglioStampa();
    document.body.classList.add("in-stampa");
    document.title = nomeFile();
    messaggio(pdf ? "Nella finestra di stampa scegli «Salva come PDF» come stampante." : "Scegli la stampante e premi Stampa.");

    await new Promise((fine) => {
      window.addEventListener("afterprint", fine, { once: true });
      window.print();
      setTimeout(fine, 60000);
    });
  } finally {
    document.body.classList.remove("in-stampa");
    document.title = titolo;
    if (!eraAperta) chiudiAnteprima();
    inCorso = false;
  }
}

// Dice alla stampante quanto è grande il foglio, così ogni pagina dell'anteprima diventa un foglio vero.
function impostaFoglioStampa() {
  const { larghezza, altezza } = opzioniPagina();
  let regola = document.getElementById("stampa-foglio");
  if (!regola) {
    regola = document.createElement("style");
    regola.id = "stampa-foglio";
    document.head.append(regola);
  }
  regola.textContent = `@page { size: ${larghezza}mm ${altezza}mm; margin: 0; }`;
}
