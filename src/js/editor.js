// Il foglio dove si scrive, e i punti in cui si inseriscono tabelle e immagini.

import { segnaModifica } from "./modifiche.js";

export let foglio = null;
let dimensioneInAttesa = null;

export function avviaEditor() {
  foglio = document.getElementById("foglio");
  document.execCommand("styleWithCSS", false, true);

  document.getElementById("btn-interruzione").addEventListener("mousedown", (evento) => {
    evento.preventDefault();
  });
  document.getElementById("btn-interruzione").addEventListener("click", inserisciInterruzione);

  document.getElementById("scrivania").addEventListener("mousedown", (evento) => {
    if (evento.target.id === "scrivania" || evento.target.id === "zoom-contenitore") foglio.focus();
  });

  foglio.addEventListener("keydown", chiudiCampoConInvio);
  foglio.addEventListener("click", (evento) => {
    const bottone = evento.target.closest("[data-azione='elimina-interruzione']");
    if (!bottone) return;
    bottone.closest(".interruzione")?.remove();
    segnaModifica();
  });
}

export function ricordaDimensione(punti) {
  dimensioneInAttesa = punti;
}

export function convertiFontTemporanei(radice = foglio) {
  if (!dimensioneInAttesa || !radice) return;
  radice.querySelectorAll('font[size="7"]').forEach((font) => {
    const span = document.createElement("span");
    span.style.fontSize = `${dimensioneInAttesa}pt`;
    while (font.firstChild) span.append(font.firstChild);
    font.replaceWith(span);
  });
}

export function salvaCursore() {
  const selezione = window.getSelection();
  if (!selezione || !selezione.rangeCount || !foglio.contains(selezione.anchorNode)) return null;
  return selezione.getRangeAt(0).cloneRange();
}

export function ripristinaCursore(range) {
  foglio.focus();
  if (!range) return;
  const selezione = window.getSelection();
  selezione.removeAllRanges();
  selezione.addRange(range);
}

export function inserisciBlocco(nodo) {
  foglio.focus();
  const selezione = window.getSelection();
  const dentro = selezione && selezione.rangeCount && foglio.contains(selezione.anchorNode);

  if (!dentro) {
    foglio.append(nodo);
    const vuoto = paragrafoVuoto();
    nodo.after(vuoto);
    poniCursore(vuoto);
    return;
  }

  const range = selezione.getRangeAt(0);
  if (!range.collapsed) range.deleteContents();

  const speciale = elementoDi(selezione.anchorNode)?.closest(".blocco-tabella, .blocco-immagine, .interruzione");
  if (speciale && foglio.contains(speciale)) {
    const vuoto = paragrafoVuoto();
    speciale.after(nodo);
    nodo.after(vuoto);
    poniCursore(vuoto);
    return;
  }

  const blocco = bloccoDiretto(selezione.anchorNode);
  if (!blocco) {
    foglio.append(nodo);
    const vuoto = paragrafoVuoto();
    nodo.after(vuoto);
    poniCursore(vuoto);
    return;
  }

  if (blocco.tagName === "UL" || blocco.tagName === "OL") {
    const vuoto = paragrafoVuoto();
    blocco.after(nodo);
    nodo.after(vuoto);
    poniCursore(vuoto);
    return;
  }

  const dopo = dividiBlocco(blocco);
  blocco.after(nodo);
  if (dopo) nodo.after(dopo);
  else if (!nodo.nextElementSibling) nodo.after(paragrafoVuoto());
  poniCursore(nodo.nextElementSibling || nodo);
}

function inserisciInterruzione() {
  const blocco = document.createElement("div");
  blocco.className = "interruzione";
  blocco.contentEditable = "false";
  const testo = document.createElement("span");
  testo.textContent = "Interruzione di pagina";
  const elimina = document.createElement("button");
  elimina.type = "button";
  elimina.className = "solo-editor";
  elimina.dataset.azione = "elimina-interruzione";
  elimina.textContent = "Elimina";
  blocco.append(testo, elimina);
  inserisciBlocco(blocco);
  segnaModifica();
}

function chiudiCampoConInvio(evento) {
  if (evento.key === "Enter" && evento.target.matches("input, textarea")) evento.target.blur();
}

function dividiBlocco(blocco) {
  const selezione = window.getSelection();
  if (!selezione.rangeCount) return null;
  const origine = selezione.getRangeAt(0);
  if (!blocco.contains(origine.startContainer)) return null;

  const range = document.createRange();
  range.setStart(origine.startContainer, origine.startOffset);
  range.setEnd(blocco, blocco.childNodes.length);
  const coda = range.extractContents();
  const dopo = blocco.cloneNode(false);
  dopo.append(coda);
  if (!dopo.textContent && !dopo.querySelector("br, img")) return null;
  if (!blocco.textContent && !blocco.querySelector("br, img")) blocco.append(document.createElement("br"));
  return dopo;
}

function paragrafoVuoto() {
  const p = document.createElement("p");
  p.append(document.createElement("br"));
  return p;
}

function poniCursore(elemento) {
  const selezione = window.getSelection();
  const range = document.createRange();
  range.selectNodeContents(elemento);
  range.collapse(true);
  selezione.removeAllRanges();
  selezione.addRange(range);
  elemento.scrollIntoView({ block: "nearest" });
}

function elementoDi(nodo) {
  return nodo.nodeType === 1 ? nodo : nodo.parentElement;
}

function bloccoDiretto(nodo) {
  let elemento = elementoDi(nodo);
  if (!elemento || elemento === foglio) return null;
  while (elemento.parentElement && elemento.parentElement !== foglio) elemento = elemento.parentElement;
  return elemento.parentElement === foglio ? elemento : null;
}
