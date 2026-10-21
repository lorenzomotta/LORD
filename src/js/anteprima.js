// Divide la relazione in pagine A4, come un'anteprima di stampa.

import { foglio } from "./editor.js";
import { esportaDocx } from "./esporta-docx.js";
import { opzioniPagina } from "./documento.js";
import { attendiImmagini, costruisciVista } from "./vista.js";
import { avviaZoomAnteprima } from "./zoom-anteprima.js";

export function avviaAnteprima() {
  document.getElementById("btn-anteprima").addEventListener("click", apriAnteprima);
  document.addEventListener("keydown", (evento) => {
    if (evento.key === "Escape") chiudiAnteprima();
  });
}

export async function apriAnteprima() {
  const pannello = document.getElementById("anteprima");
  pannello.classList.remove("nascosta");
  pannello.replaceChildren();

  const barra = document.createElement("div");
  barra.className = "anteprima-barra";
  barra.innerHTML = `
    <button type="button" data-chiudi>Torna alla scrittura</button>
    <span>Anteprima ${opzioniPagina().nome}</span>
    <span class="conto-pagine"></span>
    <label>Zoom
      <select id="zoom">
        <option value="0.7">70%</option>
        <option value="0.85" selected>85%</option>
        <option value="1">100%</option>
        <option value="1.2">120%</option>
      </select>
    </label>
    <button type="button" data-stampa="carta" title="Stampa la relazione (Ctrl+P)">Stampa</button>
    <button type="button" data-stampa="pdf" title="Salva la relazione come file PDF">Stampa PDF</button>
    <button type="button" data-esporta>Esporta DOCX</button>
  `;
  const pila = document.createElement("div");
  pila.className = "pila-pagine";
  pannello.append(barra, pila);

  barra.querySelector("[data-chiudi]").addEventListener("click", chiudiAnteprima);
  barra.querySelector("[data-esporta]").addEventListener("click", () => esportaDocx());
  avviaZoomAnteprima(pila, barra.querySelector("#zoom"));

  const vista = costruisciVista(foglio);
  vista.classList.add("fuori-schermo");
  document.body.append(vista);
  await attendiImmagini(vista);
  const pagine = impagina(vista);
  vista.remove();

  const opzioni = opzioniPagina();
  pagine.forEach((corpo, indice) => {
    pila.append(creaPagina(corpo, indice, pagine.length, opzioni));
  });
  barra.querySelector(".conto-pagine").textContent = pagine.length === 1 ? "1 pagina" : `${pagine.length} pagine`;
}

export function chiudiAnteprima() {
  const pannello = document.getElementById("anteprima");
  if (!pannello || pannello.classList.contains("nascosta")) return;
  pannello.classList.add("nascosta");
  pannello.replaceChildren();
}

function creaPagina(corpo, indice, totale, opzioni) {
  const pagina = document.createElement("section");
  pagina.className = "pagina";
  corpo.classList.add("corpo-pagina", "testo-relazione");
  pagina.append(corpo);
  if (opzioni.intestazione) {
    const testa = document.createElement("header");
    testa.className = "intestazione-stampa";
    testa.innerHTML = opzioni.intestazione;
    pagina.append(testa);
  }
  if (opzioni.pie || opzioni.numeri) {
    const pie = document.createElement("footer");
    pie.className = "pie-pagina";
    if (opzioni.pie) {
      const testo = document.createElement("div");
      testo.innerHTML = opzioni.pie;
      pie.append(testo);
    }
    if (opzioni.numeri) {
      const numero = document.createElement("div");
      numero.className = `allinea-${opzioni.posizione}`;
      numero.textContent = `Pagina ${indice + 1} di ${totale}`;
      pie.append(numero);
    }
    pagina.append(pie);
  }
  return pagina;
}

function dimensioniPagina() {
  const pagina = document.createElement("section");
  pagina.className = "pagina";
  pagina.style.position = "absolute";
  pagina.style.left = "-5000px";
  const corpo = document.createElement("div");
  corpo.className = "corpo-pagina";
  pagina.append(corpo);
  document.body.append(pagina);
  const misure = { altezza: corpo.clientHeight, larghezza: corpo.clientWidth };
  pagina.remove();
  return misure;
}

function impagina(vista) {
  const { altezza, larghezza } = dimensioniPagina();
  const massimo = Math.max(100, altezza - 4);
  const misuratore = creaMisuratore(larghezza);
  const pagine = [];
  let corpo = document.createElement("div");
  pagine.push(corpo);

  function paginaNuova() {
    corpo = document.createElement("div");
    misuratore.replaceChildren();
    pagine.push(corpo);
  }

  for (const blocco of [...vista.children]) {
    if (blocco.classList.contains("interruzione-stampa")) {
      paginaNuova();
      continue;
    }

    const pezzi = adatta(blocco, massimo, larghezza);
    for (const pezzo of pezzi) {
      const fantasma = pezzo.cloneNode(true);
      misuratore.append(fantasma);
      if (misuratore.scrollHeight > massimo && corpo.childNodes.length) {
        misuratore.removeChild(fantasma);
        paginaNuova();
        misuratore.append(fantasma);
      }
      corpo.append(pezzo);
    }
  }

  misuratore.remove();
  return pagine.length ? pagine : [document.createElement("div")];
}

function creaMisuratore(larghezza) {
  const misuratore = document.createElement("div");
  misuratore.className = "misuratore testo-relazione";
  misuratore.style.width = `${larghezza}px`;
  document.body.append(misuratore);
  return misuratore;
}

function adatta(blocco, massimo, larghezza) {
  if (blocco.classList.contains("tabella-stampa")) return spezzaTabella(blocco, massimo, larghezza);
  const box = creaMisuratore(larghezza);
  box.append(blocco.cloneNode(true));
  const altezza = box.scrollHeight;
  box.remove();
  if (altezza <= massimo) return [blocco];
  return spezzaTesto(blocco, massimo, larghezza);
}

function spezzaTabella(figura, massimo, larghezza) {
  const box = creaMisuratore(larghezza);
  box.append(figura.cloneNode(true));
  if (box.scrollHeight <= massimo) {
    box.remove();
    return [figura];
  }

  const didascalia = figura.querySelector("figcaption");
  const righe = [...figura.querySelectorAll("tbody tr")];
  const parti = [];
  let corrente = tabellaVuota(figura, didascalia);

  for (const riga of righe) {
    const prova = corrente.cloneNode(true);
    prova.querySelector("tbody").append(riga.cloneNode(true));
    box.replaceChildren(prova);
    if (box.scrollHeight > massimo && corrente.querySelector("tbody").children.length) {
      parti.push(corrente);
      corrente = tabellaVuota(figura, null);
    }
    corrente.querySelector("tbody").append(riga.cloneNode(true));
  }
  if (corrente.querySelector("tbody").children.length) parti.push(corrente);
  box.remove();
  return parti.length ? parti : [figura];
}

function tabellaVuota(origine, didascalia) {
  const wrap = document.createElement("figure");
  wrap.className = origine.className;
  if (didascalia) wrap.append(didascalia.cloneNode(true));
  const table = document.createElement("table");
  const gruppo = origine.querySelector("colgroup");
  if (gruppo) table.append(gruppo.cloneNode(true));
  table.append(document.createElement("tbody"));
  wrap.append(table);
  return wrap;
}

function spezzaTesto(elemento, massimo, larghezza) {
  const atomi = [];
  function visita(nodo, antenati) {
    if (nodo.nodeType === Node.TEXT_NODE) {
      for (const parte of nodo.textContent.split(/(\s+)/)) {
        if (parte) atomi.push({ testo: parte, antenati });
      }
      return;
    }
    if (nodo.nodeType !== Node.ELEMENT_NODE) return;
    if (nodo.tagName === "BR") {
      atomi.push({ br: true, antenati });
      return;
    }
    const nuovi = antenati.concat([nodo.cloneNode(false)]);
    nodo.childNodes.forEach((figlio) => visita(figlio, nuovi));
  }
  elemento.childNodes.forEach((figlio) => visita(figlio, []));
  if (!atomi.length) return [elemento];

  const box = creaMisuratore(larghezza);
  const parti = [];
  let corrente = elemento.cloneNode(false);
  let percorso = [];

  function troppoAlto() {
    box.replaceChildren(corrente.cloneNode(true));
    return box.scrollHeight > massimo;
  }

  for (const atomo of atomi) {
    const prima = corrente.cloneNode(true);
    aggiungiAtomo(corrente, atomo, percorso);
    if (!troppoAlto()) continue;
    const vuoto = !prima.textContent.trim() && !prima.querySelector("br");
    if (vuoto) {
      parti.push(corrente);
      corrente = elemento.cloneNode(false);
      percorso = [];
      continue;
    }
    parti.push(prima);
    corrente = elemento.cloneNode(false);
    percorso = [];
    aggiungiAtomo(corrente, atomo, percorso);
  }
  if (corrente.textContent.trim() || corrente.querySelector("br") || corrente.childNodes.length) parti.push(corrente);
  box.remove();
  return parti.filter((parte) => parte.textContent.trim() || parte.querySelector("br")).length
    ? parti.filter((parte) => parte.textContent.trim() || parte.querySelector("br"))
    : [elemento];
}

function aggiungiAtomo(radice, atomo, percorso) {
  let padre = radice;
  for (let i = 0; i < atomo.antenati.length; i += 1) {
    const modello = atomo.antenati[i];
    let figlio = percorso[i];
    if (!figlio || figlio.parentElement !== padre || figlio._modello !== modello) {
      figlio = modello.cloneNode(false);
      figlio._modello = modello;
      padre.append(figlio);
      percorso[i] = figlio;
      percorso.length = i + 1;
    }
    padre = figlio;
  }
  percorso.length = atomo.antenati.length;
  if (atomo.br) {
    padre.append(document.createElement("br"));
    return;
  }
  const ultimo = padre.lastChild;
  if (ultimo && ultimo.nodeType === Node.TEXT_NODE) ultimo.textContent += atomo.testo;
  else padre.append(document.createTextNode(atomo.testo));
}
