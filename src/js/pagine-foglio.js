// Mostra, mentre si scrive, dove finisce una pagina e inizia la successiva.

import { opzioniPagina } from "./documento.js";
import { foglio, salvaCursore } from "./editor.js";
import { sistemaFasce } from "./fasce-foglio.js";
import { bloccoDiretto, cursoreAllaFine, cursoreAllInizio } from "./proteggi-blocchi.js";

let ultimaFirma = "";
let timer = 0;

export function avviaPagineFoglio() {
  const osserva = new ResizeObserver(() => programma());
  osserva.observe(foglio);
  foglio.addEventListener("input", (evento) => {
    if (evento.target.closest("input, textarea")) return;
    programma();
  });
  foglio.addEventListener("load", () => programma(), true);
  foglio.addEventListener("keydown", saltaStacco);
  document.addEventListener("relazione-modificata", programma);
  document.addEventListener("formato-pagina", programma);
  aggiornaPagineFoglio();
}

function programma() {
  clearTimeout(timer);
  timer = setTimeout(aggiornaPagineFoglio, 60);
}

function aggiornaPagineFoglio() {
  const { altezza, sopra, sotto, utile } = misuraPagina();
  const stacco = staccoPx();
  const desiderati = calcolaSpezzature(utile);
  const opzioni = opzioniPagina();
  const firma = `${altezza}|${sopra}|${sotto}|${opzioni.margineSinistra}|${opzioni.margineDestra}|${opzioni.distanzaIntestazione}|${opzioni.numeri}|${opzioni.posizione}|${firmaContenuto()}`;
  const giaPronte = firma === ultimaFirma && stessiTagli(desiderati) && document.querySelector(".carta-pagina");
  if (giaPronte) return;

  if (!stessiTagli(desiderati)) {
    tieniCursore(() => {
      foglio.querySelectorAll(":scope > .taglio-pagina").forEach((nodo) => nodo.remove());
      for (const nodo of desiderati) {
        const taglio = creaTaglio();
        if (nodo) nodo.before(taglio);
        else foglio.append(taglio);
      }
    });
  }

  sistemaTagli(altezza, sopra, sotto, stacco);
  ultimaFirma = firma;
}

function tieniCursore(azione) {
  const range = salvaCursore();
  azione();
  if (!range) return;
  const attivo = document.activeElement;
  if (attivo && attivo !== foglio && !foglio.contains(attivo)) return;
  const selezione = window.getSelection();
  if (!selezione) return;
  try {
    selezione.removeAllRanges();
    selezione.addRange(range);
  } catch {
    /* Il cursore era su un pezzo appena spostato. */
  }
}

function creaTaglio() {
  const taglio = document.createElement("div");
  taglio.className = "taglio-pagina solo-editor";
  taglio.contentEditable = "false";
  taglio.setAttribute("aria-hidden", "true");
  taglio.innerHTML = '<div class="taglio-vuoto"></div><div class="taglio-stacco"><span></span></div><div class="taglio-margine"></div>';
  return taglio;
}

function calcolaSpezzature(utile) {
  const blocchi = blocchiContenuto();
  const spezzaPrima = [];
  let fine = 0;
  let margineAperto = 0;

  for (let i = 0; i < blocchi.length; i += 1) {
    const blocco = blocchi[i];
    const mt = margine(blocco, "marginTop");
    const mb = margine(blocco, "marginBottom");
    const h = blocco.offsetHeight;
    const bordoPrecedente = fine - margineAperto;
    const fineSeResta = bordoPrecedente + Math.max(margineAperto, mt) + h + mb;

    if (fine > 0 && fineSeResta > utile + 0.5) {
      spezzaPrima.push(blocco);
      fine = mt + h + mb;
    } else {
      fine = fineSeResta;
    }
    margineAperto = mb;

    if (blocco.classList.contains("interruzione")) {
      spezzaPrima.push(blocchi[i + 1] || null);
      fine = 0;
      margineAperto = 0;
    }
  }

  return spezzaPrima.filter((nodo, indice) => indice === 0 || nodo !== spezzaPrima[indice - 1]);
}

function sistemaTagli(altezza, sopra, sotto, stacco) {
  const tagli = [...foglio.querySelectorAll(":scope > .taglio-pagina")];
  const carte = [];
  let cardTop = 0;

  tagli.forEach((taglio, indice) => {
    const margineBasso = taglio.querySelector(".taglio-margine");
    margineBasso.style.height = `${sopra}px`;
    taglio.style.height = "0px";

    const prima = vicino(taglio, "previousElementSibling");
    const dopo = vicino(taglio, "nextElementSibling");
    const mt = dopo ? margine(dopo, "marginTop") : 0;
    const fondoPrima = prima ? prima.offsetTop + prima.offsetHeight + margine(prima, "marginBottom") : taglio.offsetTop;
    const cardBottom = Math.max(cardTop + altezza, fondoPrima + sotto);
    const target = cardBottom + stacco + sopra + mt;

    if (dopo) {
      let h = Math.max(stacco + sopra, target - dopo.offsetTop);
      taglio.style.height = `${h}px`;
      const errore = target - dopo.offsetTop;
      if (Math.abs(errore) > 1) {
        h = Math.max(stacco + sopra, h + errore);
        taglio.style.height = `${h}px`;
      }
    } else {
      const h = Math.max(stacco + sopra, cardBottom + stacco + sopra - taglio.offsetTop);
      taglio.style.height = `${h}px`;
    }

    taglio.querySelector(".taglio-stacco span").textContent = `Pagina ${indice + 2}`;
    carte.push({ top: cardTop, height: cardBottom - cardTop });
    cardTop = cardBottom + stacco;
  });

  const ultimo = [...blocchiContenuto()].at(-1);
  const fondo = ultimo ? ultimo.offsetTop + ultimo.offsetHeight + margine(ultimo, "marginBottom") + sotto : cardTop + altezza;
  const altezzaUltima = Math.max(altezza, fondo - cardTop);
  carte.push({ top: cardTop, height: altezzaUltima });
  foglio.style.minHeight = `${cardTop + altezzaUltima}px`;
  disegnaCarte(carte);
  sistemaFasce(sopra, sotto);
}

function disegnaCarte(carte) {
  const contenitore = document.getElementById("carte-pagina");
  contenitore.replaceChildren();
  const opzioni = opzioniPagina();
  carte.forEach((carta, indice) => {
    const el = document.createElement("div");
    el.className = "carta-pagina";
    el.style.top = `${carta.top}px`;
    el.style.height = `${carta.height}px`;
    if (opzioni.numeri) {
      const numero = document.createElement("div");
      numero.className = `numero-carta allinea-${opzioni.posizione}`;
      numero.textContent = `Pagina ${indice + 1} di ${carte.length}`;
      el.append(numero);
    }
    contenitore.append(el);
  });
}

function saltaStacco(evento) {
  if (evento.key !== "Backspace" && evento.key !== "Delete") return;
  if (evento.target.closest("input, textarea, button, .didascalia")) return;
  const selezione = window.getSelection();
  if (!selezione || !selezione.isCollapsed) return;
  const blocco = bloccoDiretto(selezione.anchorNode);
  if (!blocco) return;

  if (evento.key === "Backspace" && cursoreAllInizio(blocco)) {
    sistemaVicino(evento, blocco, "previousElementSibling");
  }
  if (evento.key === "Delete" && cursoreAllaFine(blocco)) {
    sistemaVicino(evento, blocco, "nextElementSibling");
  }
}

function sistemaVicino(evento, blocco, verso) {
  let vicinoBlocco = blocco[verso];
  let tolto = false;
  while (vicinoBlocco && vicinoBlocco.classList.contains("taglio-pagina")) {
    const altro = vicinoBlocco[verso];
    vicinoBlocco.remove();
    vicinoBlocco = altro;
    tolto = true;
  }
  if (!tolto) return;
  const speciale =
    vicinoBlocco &&
    (vicinoBlocco.classList.contains("blocco-tabella") ||
      vicinoBlocco.classList.contains("blocco-immagine") ||
      vicinoBlocco.classList.contains("blocco-forma") ||
      vicinoBlocco.classList.contains("interruzione"));
  if (speciale) {
    evento.preventDefault();
    vicinoBlocco.classList.add("evidenziato");
    setTimeout(() => vicinoBlocco.classList.remove("evidenziato"), 700);
  }
  programma();
}

function blocchiContenuto() {
  return [...foglio.children].filter((el) => !el.classList.contains("taglio-pagina"));
}

function stessiTagli(desiderati) {
  const tagli = [...foglio.querySelectorAll(":scope > .taglio-pagina")];
  if (tagli.length !== desiderati.length) return false;
  return tagli.every((taglio, indice) => taglio.nextElementSibling === desiderati[indice]);
}

function firmaContenuto() {
  return blocchiContenuto()
    .map((blocco) => blocco.offsetHeight)
    .join(",");
}

function vicino(nodo, verso) {
  let attuale = nodo[verso];
  while (attuale && attuale.classList.contains("taglio-pagina")) attuale = attuale[verso];
  return attuale;
}

function margine(el, lato) {
  return parseFloat(getComputedStyle(el)[lato]) || 0;
}

function staccoPx() {
  return parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--stacco-pagina")) || 40;
}

function misuraPagina() {
  const sonda = document.createElement("div");
  sonda.style.cssText = "position:absolute;left:-9999px;top:0;width:0;padding:0;border:0;";
  document.body.append(sonda);
  const pagina = opzioniPagina();
  sonda.style.height = `${pagina.altezza}mm`;
  const altezza = sonda.getBoundingClientRect().height;
  sonda.style.height = `${pagina.margineSopra}mm`;
  const sopra = sonda.getBoundingClientRect().height;
  sonda.style.height = `${pagina.margineSotto}mm`;
  const sotto = sonda.getBoundingClientRect().height;
  sonda.remove();
  return { altezza, sopra, sotto, utile: Math.max(40, altezza - sopra - sotto) };
}
