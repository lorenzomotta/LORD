// Menu del tasto destro sul testo: grassetto, carattere, colori e allineamento.

import { convertiFontTemporanei, foglio, ricordaDimensione } from "./editor.js";
import { segnaModifica } from "./modifiche.js";
import { applicaInterlinea, interlineaCorrente } from "./interlinea.js";
import { applicaSpazioDopo, spazioCorrente } from "./spazio-paragrafi.js";
import { applicaStileParagrafo, stileCorrente } from "./stili-documento.js";

const ZONE = "#foglio, #intestazione-foglio, #pie-foglio";
const ESCLUSI = "td[data-cella], .blocco-immagine, .blocco-tabella, input, textarea, select, button";
const COMANDI = ["bold", "italic", "underline", "strikeThrough", "justifyLeft", "justifyCenter", "justifyRight", "justifyFull", "insertUnorderedList", "insertOrderedList"];

let memoria = null;

export function avviaMenuTesto() {
  const menu = document.getElementById("menu-testo");
  const pagina = document.getElementById("cornice-foglio");

  pagina.addEventListener("contextmenu", (evento) => {
    if (!clicSuTesto(evento)) return;
    evento.preventDefault();
    memoria = leggiSelezione();
    aggiornaStato();
    document.getElementById("menu-pagina").hidden = true;
    apriMenu(evento.clientX, evento.clientY);
  });

  menu.addEventListener("mousedown", (evento) => {
    memoria = leggiSelezione() || memoria;
    if (evento.target.closest("button")) evento.preventDefault();
  });

  menu.addEventListener("click", (evento) => {
    const bottone = evento.target.closest("[data-comando]");
    if (!bottone) return;
    ripristina();
    document.execCommand(bottone.dataset.comando, false, null);
    segnaModifica();
    aggiornaStato();
  });

  document.getElementById("menu-testo-font").addEventListener("change", (evento) => {
    ripristina();
    document.execCommand("fontName", false, evento.target.value);
    segnaModifica();
  });
  document.getElementById("menu-testo-dimensione").addEventListener("change", (evento) => {
    ripristina();
    ricordaDimensione(evento.target.value);
    const zona = memoria?.zona || foglio;
    document.execCommand("styleWithCSS", false, false);
    document.execCommand("fontSize", false, "7");
    document.execCommand("styleWithCSS", false, true);
    convertiFontTemporanei(zona);
    segnaModifica();
  });
  document.getElementById("menu-testo-stile").addEventListener("change", (evento) => {
    ripristina();
    applicaStileParagrafo(evento.target.value);
    segnaModifica();
  });
  document.getElementById("menu-testo-interlinea").addEventListener("change", (evento) => {
    ripristina();
    applicaInterlinea(evento.target.value);
    segnaModifica();
  });
  document.getElementById("menu-testo-spazio").addEventListener("change", (evento) => {
    ripristina();
    applicaSpazioDopo(evento.target.value);
  });
  menu.addEventListener("contextmenu", (evento) => evento.preventDefault());
  document.getElementById("menu-testo-chiudi").addEventListener("click", chiudiMenu);
  document.addEventListener("mousedown", (evento) => {
    if (menu.hidden || menu.contains(evento.target)) return;
    chiudiMenu();
  });
  document.addEventListener("keydown", (evento) => {
    if (evento.key === "Escape") chiudiMenu();
  });
  document.addEventListener("wheel", (evento) => {
    if (menu.hidden) return;
    evento.preventDefault();
    const passo = evento.deltaMode === 1 ? evento.deltaY * 16 : evento.deltaMode === 2 ? evento.deltaY * menu.clientHeight : evento.deltaY;
    menu.scrollTop += passo;
  }, { passive: false });
}

export function clicSuTesto(evento) {
  const origine = evento.target.nodeType === 1 ? evento.target : evento.target.parentElement;
  if (!origine || origine.closest(ESCLUSI)) return false;
  const zona = origine.closest(ZONE);
  if (!zona) return false;
  if (clicNellaSelezione(evento.clientX, evento.clientY, zona)) return true;
  const blocco = bloccoNellaZona(origine, zona);
  if (!blocco) return false;
  return blocco.textContent.replace(/\u00a0/g, " ").trim().length > 0;
}

function clicNellaSelezione(x, y, zona) {
  const selezione = window.getSelection();
  if (!selezione?.rangeCount || selezione.isCollapsed) return false;
  const ancora = selezione.anchorNode;
  const elemento = ancora?.nodeType === 1 ? ancora : ancora?.parentElement;
  if (!elemento || !zona.contains(elemento)) return false;
  for (const rect of selezione.getRangeAt(0).getClientRects()) {
    if (x >= rect.left - 2 && x <= rect.right + 2 && y >= rect.top - 2 && y <= rect.bottom + 2) return true;
  }
  return false;
}

function bloccoNellaZona(nodo, zona) {
  let elemento = nodo.nodeType === 1 ? nodo : nodo.parentElement;
  if (!elemento) return null;
  if (zona.id !== "foglio") return zona;
  if (elemento === zona) return null;
  while (elemento.parentElement && elemento.parentElement !== zona) elemento = elemento.parentElement;
  if (elemento.parentElement !== zona) return null;
  if (elemento.classList.contains("taglio-pagina") || elemento.classList.contains("blocco-tabella") || elemento.classList.contains("blocco-immagine")) return null;
  return elemento;
}

function leggiSelezione() {
  const selezione = window.getSelection();
  if (!selezione?.rangeCount) return null;
  const ancora = selezione.anchorNode;
  const elemento = ancora?.nodeType === 1 ? ancora : ancora?.parentElement;
  const zona = elemento?.closest(ZONE);
  if (!zona) return null;
  return { zona, range: selezione.getRangeAt(0).cloneRange() };
}

function ripristina() {
  if (!memoria) return;
  memoria.zona.focus();
  const selezione = window.getSelection();
  selezione.removeAllRanges();
  selezione.addRange(memoria.range);
}

function apriMenu(x, y) {
  const menu = document.getElementById("menu-testo");
  menu.hidden = false;
  menu.style.left = "0px";
  menu.style.top = "0px";
  const box = menu.getBoundingClientRect();
  menu.style.left = `${Math.max(8, Math.min(x, window.innerWidth - box.width - 8))}px`;
  menu.style.top = `${Math.max(8, Math.min(y, window.innerHeight - box.height - 8))}px`;
}

function chiudiMenu() {
  document.getElementById("menu-testo").hidden = true;
}

function aggiornaStato() {
  const nodo = nodoStile();
  if (!nodo) return;
  const stile = getComputedStyle(nodo);
  const font = stile.fontFamily.split(",")[0].replace(/['"]/g, "").trim();
  const sceltaFont = document.getElementById("menu-testo-font");
  const trovato = [...sceltaFont.options].find((opzione) => opzione.value.toLowerCase() === font.toLowerCase());
  if (trovato) sceltaFont.value = trovato.value;
  document.getElementById("menu-testo-dimensione").value = dimensioneVicina(parseFloat(stile.fontSize));
  document.getElementById("menu-testo-stile").value = stileCorrente() || "P";
  document.getElementById("menu-testo-interlinea").value = interlineaCorrente() || "1.15";
  document.getElementById("menu-testo-spazio").value = spazioCorrente() || "8";
  for (const comando of COMANDI) {
    const bottone = document.querySelector(`#menu-testo [data-comando="${comando}"]`);
    if (!bottone) continue;
    let attivo = false;
    try {
      attivo = document.queryCommandState(comando);
    } catch {
      attivo = false;
    }
    bottone.classList.toggle("premuto", attivo);
  }
}

function nodoStile() {
  const selezione = window.getSelection();
  const nodo = selezione?.anchorNode;
  if (!nodo) return null;
  return nodo.nodeType === 1 ? nodo : nodo.parentElement;
}

function dimensioneVicina(pixel) {
  const punti = Math.round(pixel * 0.75) || 12;
  const scelte = [...document.getElementById("menu-testo-dimensione").options].map((opzione) => Number(opzione.value));
  return String(scelte.reduce((vicina, valore) => (Math.abs(valore - punti) < Math.abs(vicina - punti) ? valore : vicina), scelte[0]));
}