// Pannello che si apre cliccando la lettera di una colonna o il numero di una riga.
// Da lì si cambia la misura, si nasconde l'asse, o si cambia il carattere delle celle.

import { avvisa } from "./finestre.js";
import { segnaModifica } from "./modifiche.js";
import { impostaAltezzaRiga, impostaLarghezzaColonna, impostaStileCella } from "./tabelle.js";
import { zoomPagina } from "./zoom-pagina.js";

const PIXEL_PER_MM = 96 / 25.4;

let scelta = null;

export function avviaAsseTabella() {
  const pannello = document.getElementById("pannello-asse");

  document.addEventListener("scegli-asse", (evento) => {
    const { tipo, testa, riga } = evento.detail || {};
    const nodo = tipo === "colonna" ? testa : riga;
    const figura = nodo?.closest(".blocco-tabella");
    if (!figura) return;
    scelta = { tipo, testa, riga, figura };
    segnaIntestazione();
    selezionaCelle();
    aggiornaControlli();
    posiziona(tipo === "colonna" ? testa : riga.querySelector("th"));
  });

  document.addEventListener("tabelle-ricalcolate", () => {
    applicaNascoste();
    if (!scelta) return;
    const nodo = scelta.tipo === "colonna" ? scelta.testa : scelta.riga;
    if (!nodo.isConnected) {
      chiudi();
      return;
    }
    segnaIntestazione();
  });

  document.getElementById("asse-imposta").addEventListener("click", applicaMisura);
  document.getElementById("asse-misura").addEventListener("keydown", (evento) => {
    if (evento.key !== "Enter") return;
    evento.preventDefault();
    applicaMisura();
  });
  document.getElementById("asse-nascondi").addEventListener("click", alternaNascosta);
  document.getElementById("asse-chiudi").addEventListener("click", chiudi);

  document.getElementById("asse-font").addEventListener("change", (evento) => {
    if (!scelta || evento.target.value === "misto") return;
    celleScelte().forEach((td) => impostaStileCella(td, "font", evento.target.value));
  });

  const altezza = document.getElementById("asse-altezza");
  altezza.addEventListener("input", () => {
    altezza.dataset.toccato = "1";
  });
  altezza.addEventListener("change", applicaAltezza);
  altezza.addEventListener("keydown", (evento) => {
    if (evento.key !== "Enter") return;
    evento.preventDefault();
    altezza.dataset.toccato = "1";
    applicaAltezza();
  });

  pannello.addEventListener("click", (evento) => {
    const bottone = evento.target.closest("[data-stile]");
    if (!bottone || !scelta) return;
    const campo = bottone.dataset.stile;
    const celle = celleScelte();
    if (!celle.length) return;
    const acceso = !celle.every((td) => td.dataset[campo] === "1");
    celle.forEach((td) => impostaStileCella(td, campo, acceso ? "1" : ""));
    bottone.classList.toggle("acceso", acceso);
  });

  document.addEventListener("colore-asse", (evento) => {
    if (!scelta) return;
    const { campo, colore } = evento.detail || {};
    celleScelte().forEach((td) => impostaStileCella(td, campo, colore || ""));
  });

  document.addEventListener("mousedown", (evento) => {
    if (pannello.hidden) return;
    if (pannello.contains(evento.target)) return;
    if (evento.target.closest(".etichetta-asse")) return;
    if (evento.target.closest("#tavolozza-colori")) return;
    chiudi();
  });
  document.addEventListener("keydown", (evento) => {
    if (pannello.hidden || evento.key !== "Escape") return;
    if (!document.getElementById("tavolozza-colori").hidden) return;
    chiudi();
  }, true);

  applicaNascoste();
}

function chiudi() {
  document.getElementById("pannello-asse").hidden = true;
  document.querySelectorAll(".asse-scelto").forEach((el) => el.classList.remove("asse-scelto"));
  scelta = null;
}

function posiziona(ancora) {
  const pannello = document.getElementById("pannello-asse");
  pannello.hidden = false;
  const box = ancora.getBoundingClientRect();
  const larghezza = pannello.offsetWidth;
  const altezza = pannello.offsetHeight;
  let sinistra = box.right + 8;
  if (sinistra + larghezza > window.innerWidth - 8) sinistra = Math.max(8, box.left - larghezza - 8);
  let alto = box.top;
  if (alto + altezza > window.innerHeight - 8) alto = Math.max(8, window.innerHeight - altezza - 8);
  pannello.style.left = `${sinistra}px`;
  pannello.style.top = `${alto}px`;
}

function segnaIntestazione() {
  document.querySelectorAll(".asse-scelto").forEach((el) => el.classList.remove("asse-scelto"));
  const th = scelta.tipo === "colonna" ? scelta.testa : scelta.riga.querySelector("th");
  th?.classList.add("asse-scelto");
}

function selezionaCelle() {
  const celle = celleScelte();
  if (!celle.length) return;
  document.dispatchEvent(new CustomEvent("selezione-celle", {
    detail: { ancora: celle[0], celle, fuoco: false },
  }));
}

function celleScelte() {
  if (!scelta) return [];
  return celleDellAsse(scelta.figura, scelta.tipo, indiceScelto());
}

function indiceScelto() {
  if (scelta.tipo === "colonna") return [...scelta.testa.parentElement.children].indexOf(scelta.testa);
  return [...scelta.riga.parentElement.children].indexOf(scelta.riga) + 1;
}

function aggiornaControlli() {
  const nome = (scelta.tipo === "colonna" ? scelta.testa : scelta.riga).querySelector(".etichetta-asse")?.textContent || "";
  document.getElementById("asse-titolo").textContent = scelta.tipo === "colonna" ? `Colonna ${nome}` : `Riga ${nome}`;
  document.getElementById("asse-misura").value = mostraMisura(misuraAttuale());
  const nascosta = (scelta.tipo === "colonna" ? scelta.testa : scelta.riga).dataset.nascosta === "1";
  document.getElementById("asse-nascondi").textContent = nascosta ? "Mostra" : "Nascondi";

  const celle = celleScelte();
  const font = valoreComune(celle, "font");
  document.getElementById("asse-font").value = font == null ? "misto" : font;
  const punti = valoreComune(celle, "dimensione");
  const altezza = document.getElementById("asse-altezza");
  altezza.value = punti ? String(punti).replace(".", ",") : "";
  altezza.placeholder = punti == null ? "Diversi" : "Come il foglio";
  delete altezza.dataset.toccato;
  aggiornaStili(celle);
}

function aggiornaStili(celle) {
  document.querySelectorAll("#pannello-asse [data-stile]").forEach((bottone) => {
    const campo = bottone.dataset.stile;
    bottone.classList.toggle("acceso", celle.length > 0 && celle.every((td) => td.dataset[campo] === "1"));
  });
}

function valoreComune(celle, campo) {
  if (!celle.length) return "";
  const primo = celle[0].dataset[campo] || "";
  return celle.every((td) => (td.dataset[campo] || "") === primo) ? primo : null;
}

function applicaMisura() {
  if (!scelta) return;
  const campo = document.getElementById("asse-misura");
  const numero = Number(campo.value.trim().replace(",", "."));
  if (!Number.isFinite(numero) || numero <= 0) {
    avvisa(scelta.tipo === "colonna"
      ? "Scrivi la larghezza in millimetri, per esempio 40."
      : "Scrivi l'altezza in millimetri, per esempio 8.");
    campo.value = mostraMisura(misuraAttuale());
    return;
  }
  if (scelta.tipo === "colonna") impostaLarghezzaColonna(scelta.figura, scelta.testa, Math.min(150, Math.max(8, numero)));
  else impostaAltezzaRiga(scelta.riga, Math.min(80, Math.max(6, numero)));
  campo.value = mostraMisura(misuraAttuale());
}

function applicaAltezza() {
  if (!scelta) return;
  const campo = document.getElementById("asse-altezza");
  if (campo.dataset.toccato !== "1") return;
  const valore = leggiAltezza(campo.value);
  const celle = celleScelte();
  if (valore == null) {
    avvisa("Scrivi l'altezza delle lettere in punti, da 1 a 200. Per esempio 12 è normale e 50 è molto grande. Se lasci vuoto, resta come il foglio.");
    const punti = valoreComune(celle, "dimensione");
    campo.value = punti ? String(punti).replace(".", ",") : "";
    delete campo.dataset.toccato;
    return;
  }
  celle.forEach((td) => {
    if (valore) impostaStileCella(td, "interlinea", "");
    impostaStileCella(td, "dimensione", valore);
  });
  campo.value = valore ? String(valore).replace(".", ",") : "";
  campo.placeholder = "Come il foglio";
  delete campo.dataset.toccato;
}

function leggiAltezza(testo) {
  const pulito = testo.trim().replace(",", ".");
  if (!pulito) return "";
  if (!/^\d+(?:\.\d+)?$/.test(pulito)) return null;
  const numero = Number(pulito);
  if (numero < 1 || numero > 200) return null;
  return String(numero);
}

function alternaNascosta() {
  if (!scelta) return;
  const nodo = scelta.tipo === "colonna" ? scelta.testa : scelta.riga;
  if (nodo.dataset.nascosta === "1") {
    delete nodo.dataset.nascosta;
  } else if (scelta.tipo === "colonna") {
    ricordaLarghezze(scelta.figura);
    nodo.dataset.nascosta = "1";
  } else {
    if (!nodo.dataset.altezza) {
      const pixel = Math.round(nodo.getBoundingClientRect().height / zoomPagina());
      if (pixel > 22) nodo.dataset.altezza = `${pixel}px`;
    }
    nodo.dataset.nascosta = "1";
  }
  segnaModifica();
  document.dispatchEvent(new Event("tabelle-ricalcolate"));
  aggiornaControlli();
}

function ricordaLarghezze(figura) {
  const teste = [...figura.querySelectorAll("thead th")].slice(1);
  if (teste.every((th) => th.dataset.larghezza)) return;
  const cols = [...figura.querySelectorAll("colgroup col")].slice(1);
  const zoom = zoomPagina();
  const larghezze = cols.map((col) => col.getBoundingClientRect().width / zoom);
  const somma = larghezze.reduce((totale, px) => totale + px, 0) || 1;
  teste.forEach((th, indice) => {
    if (!th.dataset.larghezza) th.dataset.larghezza = ((larghezze[indice] / somma) * 100).toFixed(2);
  });
}

function misuraAttuale() {
  if (scelta.tipo === "colonna") return millimetriColonna(scelta.figura, scelta.testa);
  return millimetriRiga(scelta.riga);
}

function millimetriColonna(figura, th) {
  if (th.dataset.mm) return parseFloat(th.dataset.mm);
  const zoom = zoomPagina();
  const teste = [...figura.querySelectorAll("thead th")].slice(1);
  const cols = [...figura.querySelectorAll("colgroup col")].slice(1);
  const indice = teste.indexOf(th);
  if (th.dataset.nascosta === "1") {
    const percento = parseFloat(th.dataset.larghezza) || 0;
    let pxPerCento = 0;
    teste.forEach((altra, i) => {
      if (pxPerCento || altra.dataset.nascosta === "1") return;
      const quota = parseFloat(altra.dataset.larghezza) || 0;
      const px = (cols[i]?.getBoundingClientRect().width || 0) / zoom;
      if (quota > 0 && px > 0) pxPerCento = px / quota;
    });
    if (!pxPerCento) {
      const tabella = figura.querySelector("table").getBoundingClientRect().width / zoom;
      pxPerCento = (tabella * 0.92) / 100;
    }
    return (percento * pxPerCento) / PIXEL_PER_MM;
  }
  return ((cols[indice]?.getBoundingClientRect().width || 0) / zoom) / PIXEL_PER_MM;
}

function millimetriRiga(tr) {
  if (tr.dataset.mm) return parseFloat(tr.dataset.mm);
  if (tr.dataset.altezza) return parseFloat(tr.dataset.altezza) / PIXEL_PER_MM;
  return (tr.getBoundingClientRect().height / zoomPagina()) / PIXEL_PER_MM;
}

function mostraMisura(millimetri) {
  if (!Number.isFinite(millimetri) || millimetri <= 0) return "";
  return (Math.round(millimetri * 10) / 10).toFixed(1).replace(".", ",");
}

function applicaNascoste() {
  document.querySelectorAll(".blocco-tabella").forEach((figura) => {
    const { colonne, righe } = assiNascosti(figura);
    const cols = [...figura.querySelectorAll("colgroup col")];
    [...figura.querySelectorAll("thead th")].forEach((th, indice) => {
      if (indice === 0) return;
      th.classList.toggle("asse-nascosto", colonne.has(indice));
      const col = cols[indice];
      if (!col) return;
      if (colonne.has(indice)) col.style.width = "22px";
      else if (th.dataset.larghezza) col.style.width = `${((100 - 8) * parseFloat(th.dataset.larghezza)) / 100}%`;
    });
    [...figura.querySelectorAll("table > tbody > tr")].forEach((tr, indice) => {
      const nascosta = righe.has(indice + 1);
      tr.classList.toggle("riga-nascosta", nascosta);
      if (nascosta) tr.style.height = "22px";
      else if (tr.dataset.altezza) tr.style.height = tr.dataset.altezza;
    });
    griglia(figura).forEach((posto) => {
      posto.td.classList.toggle("cella-nascosta", cellaVaNascosta(posto, colonne, righe));
    });
  });
}

function cellaVaNascosta(posto, colonne, righe) {
  let colonneTutte = true;
  for (let i = 0; i < posto.cs; i += 1) {
    if (!colonne.has(posto.colonna + i)) colonneTutte = false;
  }
  let righeTutte = true;
  for (let i = 0; i < posto.rs; i += 1) {
    if (!righe.has(posto.riga + i)) righeTutte = false;
  }
  return colonneTutte || righeTutte;
}

function assiNascosti(figura) {
  const colonne = new Set();
  [...figura.querySelectorAll("thead th")].forEach((th, indice) => {
    if (indice > 0 && th.dataset.nascosta === "1") colonne.add(indice);
  });
  const righe = new Set();
  [...figura.querySelectorAll("table > tbody > tr")].forEach((tr, indice) => {
    if (tr.dataset.nascosta === "1") righe.add(indice + 1);
  });
  return { colonne, righe };
}

function griglia(figura) {
  const posti = [];
  const occupata = new Set();
  [...figura.querySelectorAll("table > tbody > tr")].forEach((tr, r) => {
    let colonna = 1;
    [...tr.children].forEach((td) => {
      if (td.tagName !== "TD") return;
      while (occupata.has(`${r + 1},${colonna}`)) colonna += 1;
      const cs = td.colSpan || 1;
      const rs = td.rowSpan || 1;
      posti.push({ td, riga: r + 1, colonna, cs, rs });
      for (let dr = 0; dr < rs; dr += 1) {
        for (let dc = 0; dc < cs; dc += 1) occupata.add(`${r + 1 + dr},${colonna + dc}`);
      }
      colonna += cs;
    });
  });
  return posti;
}

function celleDellAsse(figura, tipo, indice) {
  const viste = new Set();
  griglia(figura).forEach((posto) => {
    const dentro = tipo === "colonna"
      ? indice >= posto.colonna && indice < posto.colonna + posto.cs
      : indice >= posto.riga && indice < posto.riga + posto.rs;
    if (dentro) viste.add(posto.td);
  });
  return [...viste];
}

// Righe e colonne nascoste non vanno in anteprima né in Word.
// Una cella unita che tocca anche parti visibili resta, ma solo per la parte visibile.
export function pezziStampa(figura) {
  const teste = [...figura.querySelectorAll("thead th")].slice(1);
  const righeDom = [...figura.querySelectorAll("table > tbody > tr")];
  const { colonne, righe } = assiNascosti(figura);
  const colonneVisibili = teste.map((_, indice) => indice + 1).filter((numero) => !colonne.has(numero));
  const righeVisibili = righeDom.map((_, indice) => indice + 1).filter((numero) => !righe.has(numero));
  const perRiga = new Map();

  griglia(figura).forEach((posto) => {
    const coperteRighe = contaVisibili(posto.riga, posto.rs, righeVisibili);
    const coperteColonne = contaVisibili(posto.colonna, posto.cs, colonneVisibili);
    if (!coperteRighe.conta || !coperteColonne.conta) return;
    const lista = perRiga.get(coperteRighe.primo) || [];
    lista.push({
      td: posto.td,
      colSpan: coperteColonne.conta,
      rowSpan: coperteRighe.conta,
      colonna: coperteColonne.primo,
    });
    perRiga.set(coperteRighe.primo, lista);
  });

  const quote = colonneVisibili.map((numero) => parseFloat(teste[numero - 1].dataset.larghezza) || 0);
  const somma = quote.reduce((totale, numero) => totale + numero, 0);
  const larghezze = somma > 0
    ? quote.map((numero) => (numero / somma) * 100)
    : colonneVisibili.map(() => 100 / (colonneVisibili.length || 1));

  return {
    larghezze,
    righe: righeVisibili.map((numero) => ({
      tr: righeDom[numero - 1],
      celle: (perRiga.get(numero) || []).sort((a, b) => a.colonna - b.colonna),
    })),
  };
}

function contaVisibili(inizio, span, visibili) {
  let conta = 0;
  let primo = null;
  for (let i = 0; i < span; i += 1) {
    if (!visibili.includes(inizio + i)) continue;
    if (primo == null) primo = inizio + i;
    conta += 1;
  }
  return { primo, conta };
}
