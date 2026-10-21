// Copia formato, il "pennello" di Word: prende l'aspetto del testo dove si trova il cursore
// e lo mette sul testo che si seleziona dopo.
// Un clic: vale per una volta sola. Doppio clic: resta acceso finché non si preme Esc o di nuovo il pulsante.

import { messaggio, segnaModifica } from "./modifiche.js";

const STATI = ["bold", "italic", "underline", "strikeThrough"];
const SEGNAPOSTO = "relaziolore-pennello";

let bottone = null;
let formato = null;
let fisso = false;

export function avviaCopiaFormato() {
  bottone = document.getElementById("btn-copia-formato");
  bottone.addEventListener("mousedown", (evento) => evento.preventDefault());
  bottone.addEventListener("click", (evento) => {
    // Il secondo clic del doppio clic lo gestisce "dblclick".
    if (evento.detail === 2) return;
    if (formato) spegni();
    else accendi(false);
  });
  bottone.addEventListener("dblclick", () => accendi(true));

  // In fase di cattura, e senza guardare dove si rilascia il mouse: trascinando si finisce
  // spesso sul margine o tra due pagine, ma conta solo dov'è finita la selezione.
  document.addEventListener(
    "mouseup",
    (evento) => {
      if (!formato || evento.button !== 0) return;
      if (evento.target.closest?.("#barra, .finestra, [role='dialog']")) return;
      // Aspetto che il browser abbia finito di sistemare la selezione.
      setTimeout(applica, 10);
    },
    true,
  );
  document.addEventListener("keydown", (evento) => {
    if (formato && evento.key === "Escape") spegni();
  });
}

function accendi(resta) {
  const letto = leggiFormato();
  if (!letto) {
    messaggio("Metti prima il cursore nel testo di cui vuoi copiare il formato.");
    spegni();
    return;
  }
  formato = letto;
  fisso = resta;
  bottone.classList.add("premuto");
  document.body.classList.add("copia-formato-attivo");
  messaggio(resta ? "Copia formato: seleziona il testo da cambiare. Esc per finire." : "Copia formato: seleziona il testo da cambiare.");
}

function spegni() {
  formato = null;
  fisso = false;
  bottone.classList.remove("premuto");
  document.body.classList.remove("copia-formato-attivo");
}

function elementoSelezione() {
  const selezione = window.getSelection();
  if (!selezione?.rangeCount) return null;
  const nodo = selezione.anchorNode;
  const elemento = nodo?.nodeType === 1 ? nodo : nodo?.parentElement;
  return elemento?.isContentEditable ? elemento : null;
}

function leggiFormato() {
  const elemento = elementoSelezione();
  if (!elemento) return null;
  const stile = getComputedStyle(elemento);
  const letto = {
    font: stile.fontFamily.split(",")[0].replace(/["']/g, "").trim(),
    // Il browser dà i pixel; la barra ragiona in punti (1 pt = 4/3 px).
    dimensione: Math.round(parseFloat(stile.fontSize) * 0.75 * 2) / 2,
    colore: inEsadecimale(stile.color),
    sfondo: sfondoDi(elemento),
  };
  STATI.forEach((comando) => {
    letto[comando] = document.queryCommandState(comando);
  });
  return letto;
}

// Lo sfondo del testo (l'evidenziatore), cercato solo dentro la riga e non sul paragrafo intero.
function sfondoDi(elemento) {
  let nodo = elemento;
  while (nodo && getComputedStyle(nodo).display === "inline") {
    const colore = getComputedStyle(nodo).backgroundColor;
    if (colore && colore !== "transparent" && !/rgba\(.*,\s*0\)$/.test(colore)) return inEsadecimale(colore);
    nodo = nodo.parentElement;
  }
  return null;
}

function inEsadecimale(rgb) {
  const numeri = rgb.match(/\d+(\.\d+)?/g);
  if (!numeri || numeri.length < 3) return null;
  return `#${numeri
    .slice(0, 3)
    .map((n) => Math.round(Number(n)).toString(16).padStart(2, "0"))
    .join("")}`;
}

function applica() {
  if (!formato) return;
  const selezione = window.getSelection();
  const elemento = elementoSelezione();
  if (!elemento) return;
  if (selezione.isCollapsed && !selezionaParola(selezione)) return;
  let zona = elemento;
  while (zona.parentElement?.isContentEditable) zona = zona.parentElement;

  document.execCommand("removeFormat");
  STATI.forEach((comando) => {
    if (document.queryCommandState(comando) !== formato[comando]) document.execCommand(comando);
  });
  if (formato.colore) document.execCommand("foreColor", false, formato.colore);
  if (formato.sfondo) document.execCommand("hiliteColor", false, formato.sfondo);
  // Il browser non sa dare una dimensione in punti: metto un carattere "segnaposto"
  // e poi, solo su quei pezzi, scrivo carattere e dimensione veri. Così il testo resta selezionato.
  document.execCommand("fontName", false, SEGNAPOSTO);
  zona.querySelectorAll("[style*='font-family'], font[face]").forEach((pezzo) => {
    const segnato = pezzo.getAttribute("face") === SEGNAPOSTO || pezzo.style.fontFamily.replace(/["']/g, "") === SEGNAPOSTO;
    if (!segnato) return;
    pezzo.removeAttribute("face");
    pezzo.style.fontFamily = formato.font;
    pezzo.style.fontSize = `${formato.dimensione}pt`;
  });
  segnaModifica();
  messaggio(fisso ? "Formato applicato. Continua, oppure Esc per finire." : "Formato applicato.");
  if (!fisso) spegni();
}

// Con un semplice clic (senza selezionare) il formato va sulla parola sotto il cursore, come in Word.
function selezionaParola(selezione) {
  const nodo = selezione.anchorNode;
  if (nodo?.nodeType !== 3) return false;
  const testo = nodo.textContent;
  const lettera = /[\p{L}\p{N}_'’]/u;
  let inizio = selezione.anchorOffset;
  let fine = inizio;
  while (inizio > 0 && lettera.test(testo[inizio - 1])) inizio--;
  while (fine < testo.length && lettera.test(testo[fine])) fine++;
  if (inizio === fine) return false;
  selezione.setBaseAndExtent(nodo, inizio, nodo, fine);
  return true;
}
