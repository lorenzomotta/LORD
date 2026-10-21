// Prepara una copia pulita della relazione, senza i pulsanti dell'editor.
// L'anteprima e l'esportazione Word usano questa copia.

import { pezziStampa } from "./asse-tabella.js";
import { calcolaBordi, segnaLati } from "./bordi-tabella.js";

export function costruisciVista(foglio) {
  const vista = document.createElement("div");
  vista.className = "vista-documento testo-relazione";
  foglio.childNodes.forEach((nodo) => visita(nodo, vista));
  vista.querySelectorAll("[data-inline-aperto]").forEach((el) => el.removeAttribute("data-inline-aperto"));
  return vista;
}

export function attendiImmagini(root) {
  const immagini = [...root.querySelectorAll("img")];
  return Promise.all(
    immagini.map((img) => {
      if (img.complete && img.naturalWidth) return Promise.resolve();
      if (img.decode) return img.decode().catch(() => {});
      return new Promise((resolve) => {
        img.onload = img.onerror = () => resolve();
      });
    }),
  );
}

function visita(nodo, destinazione) {
  if (nodo.nodeType !== Node.ELEMENT_NODE && nodo.nodeType !== Node.TEXT_NODE) return;
  if (nodo.nodeType === Node.ELEMENT_NODE && nodo.classList.contains("solo-editor")) return;

  if (eInline(nodo)) {
    mettiInline(nodo, destinazione);
    return;
  }

  chiudiInline(destinazione);
  if (nodo.nodeType !== Node.ELEMENT_NODE) return;
  if (nodo.classList.contains("solo-editor")) return;

  if (nodo.classList.contains("interruzione")) {
    const segno = document.createElement("div");
    segno.className = "interruzione-stampa";
    destinazione.append(segno);
    return;
  }
  if (nodo.classList.contains("blocco-tabella")) {
    destinazione.append(tabellaPulita(nodo));
    return;
  }
  if (nodo.classList.contains("blocco-immagine")) {
    destinazione.append(immaginePulita(nodo));
    return;
  }
  if (nodo.tagName === "UL" || nodo.tagName === "OL") {
    destinazione.append(elencoPulito(nodo));
    return;
  }

  const haBlocchi = nodo.querySelector("p, div, h1, h2, h3, ul, ol, table, figure, .interruzione, .blocco-tabella, .blocco-immagine");
  if (haBlocchi) {
    nodo.childNodes.forEach((figlio) => visita(figlio, destinazione));
    return;
  }

  destinazione.append(paragrafoPulito(nodo));
}

function eInline(nodo) {
  if (nodo.nodeType === Node.TEXT_NODE) return true;
  const inline = ["SPAN", "B", "STRONG", "I", "EM", "U", "S", "STRIKE", "FONT", "BR", "A", "SUB", "SUP"];
  return inline.includes(nodo.tagName);
}

function mettiInline(nodo, destinazione) {
  if (nodo.nodeType === Node.TEXT_NODE) {
    if (!nodo.textContent) return;
    if (!nodo.textContent.trim() && !destinazione.lastElementChild?.dataset.inlineAperto) return;
  }
  let paragrafo = destinazione.lastElementChild;
  if (!paragrafo || !paragrafo.dataset.inlineAperto) {
    paragrafo = document.createElement("p");
    paragrafo.dataset.inlineAperto = "1";
    destinazione.append(paragrafo);
  }
  if (nodo.nodeType === Node.TEXT_NODE) {
    paragrafo.append(document.createTextNode(nodo.textContent));
    return;
  }
  if (nodo.classList.contains("riferimento")) {
    paragrafo.append(document.createTextNode(nodo.textContent || ""));
    return;
  }
  if (nodo.tagName === "BR") {
    paragrafo.append(document.createElement("br"));
    return;
  }
  const clone = nodo.cloneNode(true);
  pulisciInline(clone);
  paragrafo.append(clone);
}

function chiudiInline(destinazione) {
  const ultimo = destinazione.lastElementChild;
  if (ultimo?.dataset.inlineAperto) ultimo.removeAttribute("data-inline-aperto");
}

function paragrafoPulito(nodo) {
  const clone = nodo.cloneNode(true);
  pulisciInline(clone);
  clone.removeAttribute("contenteditable");
  return clone;
}

function elencoPulito(lista) {
  const clone = lista.cloneNode(true);
  pulisciInline(clone);
  return clone;
}

function pulisciInline(root) {
  root.querySelectorAll(".riferimento").forEach((span) => {
    span.replaceWith(document.createTextNode(span.textContent || ""));
  });
  root.querySelectorAll(".solo-editor").forEach((el) => el.remove());
}

function tabellaPulita(figura) {
  const wrap = document.createElement("figure");
  wrap.className = "tabella-stampa";
  const classeBordi = ["bordi-tutti", "bordi-cornice", "bordi-orizzontali", "bordi-nessuno"].find((nome) => figura.classList.contains(nome));
  if (classeBordi) wrap.classList.add(classeBordi);
  const titolo = figura.querySelector(".campo-titolo")?.value?.trim() || "";
  const id = figura.dataset.id || "";
  if (titolo || id) {
    const cap = document.createElement("figcaption");
    cap.textContent = titolo ? `${id} — ${titolo}` : id;
    wrap.append(cap);
  }
  const table = document.createElement("table");
  const stampa = pezziStampa(figura);
  if (stampa.larghezze.length) {
    const gruppo = document.createElement("colgroup");
    stampa.larghezze.forEach((larghezza) => {
      const col = document.createElement("col");
      col.style.width = `${larghezza}%`;
      gruppo.append(col);
    });
    table.append(gruppo);
  }
  const tbody = document.createElement("tbody");
  const bordi = calcolaBordi(figura);
  stampa.righe.forEach(({ tr, celle }) => {
    const row = document.createElement("tr");
    if (tr.dataset.totale) row.classList.add("riga-totale");
    if (tr.dataset.altezza) row.style.height = tr.dataset.altezza;
    celle.forEach(({ td, colSpan, rowSpan }) => {
      const cell = document.createElement("td");
      cell.textContent = td.textContent || "";
      ["cella-numero", "cella-errore", "cella-euro", "allinea-sinistra", "allinea-centro", "allinea-destra"].forEach((nome) => {
        if (td.classList.contains(nome)) cell.classList.add(nome);
      });
      segnaLati(cell, bordi.get(td));
      copiaAspettoCella(td, cell);
      if (colSpan > 1) cell.colSpan = colSpan;
      if (rowSpan > 1) cell.rowSpan = rowSpan;
      row.append(cell);
    });
    if (row.childNodes.length) tbody.append(row);
  });
  table.append(tbody);
  wrap.append(table);
  const larghezza = parseFloat(figura.dataset.larghezza);
  if (larghezza >= 20 && larghezza < 99.5) {
    wrap.dataset.larghezza = String(larghezza);
    table.style.width = `${larghezza}%`;
  }
  const scala = parseFloat(figura.dataset.scala);
  if (scala >= 0.4 && Math.abs(scala - 1) > 0.02) {
    wrap.dataset.scala = String(scala);
    table.style.fontSize = `${Math.round(12 * scala)}pt`;
    const base = larghezza >= 20 && larghezza < 99.5 ? larghezza : 100;
    table.style.width = `${Math.max(20, Math.round(base * scala))}%`;
  }
  if (figura.dataset.posto === "centro") table.style.margin = "0 auto";
  if (figura.dataset.posto === "destra") table.style.marginLeft = "auto";
  return wrap;
}

function copiaAspettoCella(da, a) {
  if (da.dataset.sfondo) {
    a.dataset.sfondo = da.dataset.sfondo;
    a.style.backgroundColor = da.dataset.sfondo;
  }
  if (da.dataset.colore) {
    a.dataset.colore = da.dataset.colore;
    a.style.color = da.dataset.colore;
  }
  if (da.dataset.font) {
    a.dataset.font = da.dataset.font;
    a.style.fontFamily = da.dataset.font;
  }
  if (da.dataset.dimensione) {
    a.dataset.dimensione = da.dataset.dimensione;
    a.style.fontSize = `${da.dataset.dimensione}pt`;
  }
  if (da.dataset.interlinea) {
    a.dataset.interlinea = da.dataset.interlinea;
    a.style.lineHeight = da.dataset.interlinea;
  }
  if (da.dataset.grassetto) {
    a.dataset.grassetto = "1";
    a.style.fontWeight = "700";
  }
  if (da.dataset.corsivo) {
    a.dataset.corsivo = "1";
    a.style.fontStyle = "italic";
  }
  const tratti = [];
  if (da.dataset.sottolineato) {
    a.dataset.sottolineato = "1";
    tratti.push("underline");
  }
  if (da.dataset.barrato) {
    a.dataset.barrato = "1";
    tratti.push("line-through");
  }
  if (tratti.length) a.style.textDecoration = tratti.join(" ");
}

function immaginePulita(figura) {
  const wrap = document.createElement("figure");
  wrap.className = "immagine-stampa";
  const originale = figura.querySelector("img");
  const img = document.createElement("img");
  img.src = originale?.src || "";
  img.alt = "Immagine";
  const larghezza = figura.querySelector(".campo-larghezza")?.value || String(parseFloat(figura.querySelector(".cornice-immagine")?.style.width) || 70);
  const cornice = document.createElement("div");
  cornice.className = "cornice-immagine";
  cornice.style.width = `${parseFloat(larghezza) || 70}%`;
  if (figura.dataset.altezza) {
    img.style.height = `${figura.dataset.altezza}px`;
    img.style.objectFit = "fill";
    img.style.maxHeight = "none";
  }
  if (figura.dataset.piano) {
    wrap.style.zIndex = figura.dataset.piano;
    wrap.dataset.piano = figura.dataset.piano;
  }
  const modo = figura.dataset.allinea || "sinistra";
  if (modo === "libera") {
    wrap.dataset.allinea = "libera";
    wrap.dataset.x = figura.dataset.x || "0";
    wrap.dataset.y = figura.dataset.y || "0";
    cornice.classList.add("pos-libera");
    cornice.style.left = `${figura.dataset.x || 0}px`;
    cornice.style.top = `${figura.dataset.y || 0}px`;
  } else {
    wrap.dataset.allinea = modo;
    cornice.classList.add(`allinea-${modo}`);
  }
  cornice.append(img);
  const didascalia = figura.querySelector(".didascalia")?.innerText?.trim() || "";
  if (didascalia) {
    const cap = document.createElement("figcaption");
    cap.textContent = didascalia;
    cornice.append(cap);
  }
  wrap.append(cornice);
  return wrap;
}
