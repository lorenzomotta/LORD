// Grassetto, corsivo, titoli, allineamento e le altre formattazioni del testo.

import { convertiFontTemporanei, foglio, ricordaDimensione, salvaCursore, ripristinaCursore } from "./editor.js";
import { segnaModifica } from "./modifiche.js";
import { applicaInterlinea } from "./interlinea.js";
import { applicaStileParagrafo } from "./stili-documento.js";

const COMANDI = ["bold", "italic", "underline", "strikeThrough", "justifyLeft", "justifyCenter", "justifyRight", "justifyFull"];
const FASCE = "#intestazione-foglio, #pie-foglio";

export function avviaFormato() {
  document.querySelectorAll("[data-formato]").forEach((bottone) => {
    bottone.addEventListener("mousedown", (evento) => evento.preventDefault());
    bottone.addEventListener("click", () => {
      zonaScrittura().focus();
      document.execCommand(bottone.dataset.formato, false, null);
      segnaModifica();
      aggiornaPulsanti();
    });
  });

  preparaScelta("font", (valore) => document.execCommand("fontName", false, valore));
  preparaScelta("dimensione", (valore) => applicaDimensione(valore));
  preparaScelta("stile-paragrafo", applicaStileParagrafo);
  preparaScelta("interlinea", applicaInterlinea);

  foglio.addEventListener("input", () => {
    if (document.activeElement?.matches("input, textarea")) return;
    convertiFontTemporanei();
  });
  document.addEventListener("selectionchange", aggiornaPulsanti);
}

function preparaScelta(id, applica) {
  const controllo = document.getElementById(id);
  let memoria = null;
  controllo.addEventListener("mousedown", () => {
    memoria = salvaZona();
  });
  controllo.addEventListener("change", () => {
    ripristinaZona(memoria);
    applica(controllo.value);
    segnaModifica();
  });
}

function salvaZona() {
  const selezione = window.getSelection();
  if (!selezione?.rangeCount) return null;
  const fascia = zonaDalNodo(selezione.anchorNode);
  if (fascia) return { fascia, range: selezione.getRangeAt(0).cloneRange() };
  const range = salvaCursore();
  return range ? { fascia: null, range } : null;
}

function ripristinaZona(memoria) {
  if (!memoria) return;
  if (memoria.fascia) {
    memoria.fascia.focus();
    const selezione = window.getSelection();
    selezione.removeAllRanges();
    selezione.addRange(memoria.range);
    return;
  }
  ripristinaCursore(memoria.range);
}

function zonaDalNodo(nodo) {
  const elemento = nodo && (nodo.nodeType === 1 ? nodo : nodo.parentElement);
  return elemento?.closest?.(FASCE) || null;
}

function zonaScrittura() {
  return zonaDalNodo(window.getSelection()?.anchorNode) || foglio;
}

function applicaDimensione(punti) {
  ricordaDimensione(punti);
  const fascia = zonaDalNodo(window.getSelection()?.anchorNode);
  document.execCommand("styleWithCSS", false, false);
  document.execCommand("fontSize", false, "7");
  document.execCommand("styleWithCSS", false, true);
  convertiFontTemporanei(fascia || foglio);
}

function aggiornaPulsanti() {
  const attivo = document.activeElement;
  const dentro = foglio && attivo && (attivo === foglio || foglio.contains(attivo) || attivo.closest?.(FASCE));
  for (const comando of COMANDI) {
    const bottone = document.querySelector(`[data-formato="${comando}"]`);
    if (!bottone) continue;
    bottone.classList.toggle("premuto", Boolean(dentro && document.queryCommandState(comando)));
  }
  if (dentro) mostraCarattere();
}

// Carattere e dimensione della parola dove sta il cursore.
function mostraCarattere() {
  const nodo = window.getSelection()?.anchorNode;
  const elemento = nodo?.nodeType === 1 ? nodo : nodo?.parentElement;
  if (!elemento) return;
  const stile = getComputedStyle(elemento);

  const font = stile.fontFamily.split(",")[0].replace(/['"]/g, "").trim().toLowerCase();
  const sceltaFont = document.getElementById("font");
  const trovato = [...sceltaFont.options].find((voce) => voce.value.toLowerCase() === font);
  if (trovato) sceltaFont.value = trovato.value;

  const punti = Math.round(parseFloat(stile.fontSize) * 0.75 * 2) / 2;
  if (punti > 0) mostraDimensione(String(punti));
}

// Se la dimensione non è tra quelle della tendina (per esempio 13), la si aggiunge al posto giusto.
function mostraDimensione(valore) {
  const tendina = document.getElementById("dimensione");
  const voci = [...tendina.options];
  if (!voci.some((voce) => voce.value === valore)) {
    const nuova = new Option(valore, valore);
    const dopo = voci.find((voce) => Number(voce.value) > Number(valore));
    tendina.insertBefore(nuova, dopo || null);
  }
  tendina.value = valore;
}
