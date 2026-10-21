// Seleziona più celle trascinando il mouse, e le unisce o le separa.

import { analizzaIndirizzo, lettereDaColonna } from "./formule.js";
import { avvisa } from "./finestre.js";
import { segnaModifica } from "./modifiche.js";
import { foglio } from "./editor.js";
import { ricalcolaTutte } from "./tabelle.js";

let trascinamento = null;

export function avviaGruppoCelle() {
  foglio.addEventListener("mousedown", iniziaSelezione);
  document.addEventListener("mousemove", estendiSelezione);
  document.addEventListener("mouseup", chiudiSelezione);
  document.getElementById("btn-unisci").addEventListener("click", unisciSelezione);
  document.getElementById("btn-separa").addEventListener("click", separaSelezione);
}

function iniziaSelezione(evento) {
  if (evento.button !== 0) return;
  const td = evento.target.closest("td[data-cella]");
  if (!td || !foglio.contains(td)) return;
  if (evento.target.closest("button, input, select")) return;
  evento.preventDefault();
  const figura = td.closest(".blocco-tabella");
  let origine = td;
  if (evento.shiftKey) {
    const ancora = figura.querySelector("td.cella-ancora");
    if (ancora) origine = ancora;
  }
  trascinamento = { figura, origine, attuale: td };
  pubblicaRettangolo(figura, origine, td, false);
}

function estendiSelezione(evento) {
  if (!trascinamento) return;
  const sotto = document.elementFromPoint(evento.clientX, evento.clientY);
  const td = sotto?.closest?.("td[data-cella]");
  if (!td || td.closest(".blocco-tabella") !== trascinamento.figura) return;
  if (td === trascinamento.attuale) return;
  trascinamento.attuale = td;
  pubblicaRettangolo(trascinamento.figura, trascinamento.origine, td, false);
}

function chiudiSelezione() {
  if (!trascinamento) return;
  trascinamento = null;
  const formula = document.getElementById("formula");
  if (document.querySelector("td.cella-ancora")) {
    formula.focus();
    formula.select();
  }
}

function pubblicaRettangolo(figura, da, a, fuoco) {
  const zona = rettangolo(figura, da, a);
  if (!zona) return;
  const ancora = zona.celle.includes(da) ? da : zona.ancora;
  document.dispatchEvent(new CustomEvent("selezione-celle", {
    detail: { ancora, celle: zona.celle, fuoco },
  }));
}

function rettangolo(figura, da, a) {
  const griglia = mappaGriglia(figura);
  const partenza = trovaOrigine(griglia, da);
  const arrivo = trovaOrigine(griglia, a);
  if (!partenza || !arrivo) return null;
  let r1 = Math.min(partenza.r, arrivo.r);
  let r2 = Math.max(partenza.r, arrivo.r);
  let c1 = Math.min(partenza.c, arrivo.c);
  let c2 = Math.max(partenza.c, arrivo.c);
  let cresce = true;
  while (cresce) {
    cresce = false;
    const viste = new Set();
    for (let riga = r1; riga <= r2; riga += 1) {
      for (let colonna = c1; colonna <= c2; colonna += 1) {
        const td = griglia[riga]?.[colonna];
        if (!td || viste.has(td)) continue;
        viste.add(td);
        const origine = trovaOrigine(griglia, td);
        const fineRiga = origine.r + (td.rowSpan || 1) - 1;
        const fineColonna = origine.c + (td.colSpan || 1) - 1;
        if (origine.r < r1) { r1 = origine.r; cresce = true; }
        if (fineRiga > r2) { r2 = fineRiga; cresce = true; }
        if (origine.c < c1) { c1 = origine.c; cresce = true; }
        if (fineColonna > c2) { c2 = fineColonna; cresce = true; }
      }
    }
  }
  const celle = [];
  const viste = new Set();
  for (let riga = r1; riga <= r2; riga += 1) {
    for (let colonna = c1; colonna <= c2; colonna += 1) {
      const td = griglia[riga][colonna];
      if (td && !viste.has(td)) {
        viste.add(td);
        celle.push(td);
      }
    }
  }
  return { celle, ancora: griglia[r1][c1], r1, r2, c1, c2, griglia };
}

export function mappaGriglia(figura) {
  const righe = [...figura.querySelectorAll("tbody tr")];
  const colonne = Math.max(0, figura.querySelectorAll("thead th").length - 1);
  const griglia = righe.map(() => Array(colonne).fill(null));
  righe.forEach((tr, riga) => {
    let colonna = 0;
    for (const td of tr.querySelectorAll(":scope > td")) {
      while (colonna < colonne && griglia[riga][colonna]) colonna += 1;
      const largo = td.colSpan || 1;
      const alto = td.rowSpan || 1;
      for (let dr = 0; dr < alto; dr += 1) {
        for (let dc = 0; dc < largo; dc += 1) {
          if (griglia[riga + dr] && colonna + dc < colonne) griglia[riga + dr][colonna + dc] = td;
        }
      }
      colonna += largo;
    }
  });
  return griglia;
}

function trovaOrigine(griglia, td) {
  for (let riga = 0; riga < griglia.length; riga += 1) {
    for (let colonna = 0; colonna < griglia[riga].length; colonna += 1) {
      if (griglia[riga][colonna] === td) return { r: riga, c: colonna };
    }
  }
  return null;
}

function unisciSelezione() {
  document.dispatchEvent(new CustomEvent("salva-formula-cella"));
  const celle = [...document.querySelectorAll(".blocco-tabella td.selezionata")];
  if (celle.length < 2) return;
  const figura = celle[0].closest(".blocco-tabella");
  const griglia = mappaGriglia(figura);
  let rigaMin = 0;
  let colonnaMin = 0;
  let rigaMax = -1;
  let colonnaMax = -1;
  celle.forEach((td) => {
    const origine = trovaOrigine(griglia, td);
    if (!origine) return;
    if (rigaMax < 0) {
      rigaMin = origine.r;
      colonnaMin = origine.c;
    }
    rigaMin = Math.min(rigaMin, origine.r);
    colonnaMin = Math.min(colonnaMin, origine.c);
    rigaMax = Math.max(rigaMax, origine.r + (td.rowSpan || 1) - 1);
    colonnaMax = Math.max(colonnaMax, origine.c + (td.colSpan || 1) - 1);
  });
  const zona = rigaMax < 0 ? null : rettangolo(figura, griglia[rigaMin][colonnaMin], griglia[rigaMax][colonnaMax]);
  if (!zona || zona.celle.length < 2) {
    avvisa("Trascina il mouse su almeno due celle.");
    return;
  }
  const coperte = new Set(zona.celle);
  for (let riga = zona.r1; riga <= zona.r2; riga += 1) {
    for (let colonna = zona.c1; colonna <= zona.c2; colonna += 1) {
      if (!coperte.has(zona.griglia[riga][colonna])) {
        avvisa("Seleziona un blocco pieno di celle, senza buchi.");
        return;
      }
    }
  }
  const ancora = zona.griglia[zona.r1][zona.c1];
  const box = parcheggioDi(figura);
  const giaSpostate = new Set();
  for (let riga = zona.r1; riga <= zona.r2; riga += 1) {
    for (let colonna = zona.c1; colonna <= zona.c2; colonna += 1) {
      const td = zona.griglia[riga][colonna];
      if (!td || td === ancora || giaSpostate.has(td)) continue;
      const origine = trovaOrigine(zona.griglia, td);
      if (!origine || origine.r !== riga || origine.c !== colonna) continue;
      td.colSpan = 1;
      td.rowSpan = 1;
      td.removeAttribute("colspan");
      td.removeAttribute("rowspan");
      box.append(td);
      giaSpostate.add(td);
    }
  }
  const largo = zona.c2 - zona.c1 + 1;
  const alto = zona.r2 - zona.r1 + 1;
  if (largo > 1) ancora.colSpan = largo;
  else ancora.removeAttribute("colspan");
  if (alto > 1) ancora.rowSpan = alto;
  else ancora.removeAttribute("rowspan");
  document.dispatchEvent(new CustomEvent("selezione-celle", {
    detail: { ancora, celle: [ancora], fuoco: true },
  }));
  ricalcolaTutte();
  segnaModifica();
}

function separaSelezione() {
  document.dispatchEvent(new CustomEvent("salva-formula-cella"));
  const celle = [...document.querySelectorAll(".blocco-tabella td.selezionata")].filter((td) => (td.colSpan || 1) > 1 || (td.rowSpan || 1) > 1);
  if (!celle.length) return;
  const ancora = document.querySelector("td.cella-ancora") || celle[0];
  celle.forEach(separaCella);
  document.querySelectorAll(".parcheggio-celle").forEach((box) => {
    if (!box.children.length) box.remove();
  });
  document.dispatchEvent(new CustomEvent("selezione-celle", {
    detail: { ancora, celle: [ancora], fuoco: true },
  }));
  ricalcolaTutte();
  segnaModifica();
}

function separaCella(td) {
  const figura = td.closest(".blocco-tabella");
  const ind = analizzaIndirizzo(td.dataset.cella);
  if (!ind || !figura) return;
  const largo = td.colSpan || 1;
  const alto = td.rowSpan || 1;
  td.colSpan = 1;
  td.rowSpan = 1;
  td.removeAttribute("colspan");
  td.removeAttribute("rowspan");
  const box = figura.querySelector(".parcheggio-celle");
  for (let dr = 0; dr < alto; dr += 1) {
    for (let dc = 0; dc < largo; dc += 1) {
      if (dr === 0 && dc === 0) continue;
      const indirizzo = lettereDaColonna(ind.colonna + dc) + (ind.riga + dr);
      let cella = box?.querySelector(`td[data-cella="${indirizzo}"]`);
      if (!cella) {
        cella = document.createElement("td");
        cella.dataset.cella = indirizzo;
        cella.dataset.raw = "";
      }
      const tr = figura.querySelectorAll("tbody tr")[ind.riga + dr - 1];
      if (tr) inserisciNellaColonna(tr, ind.colonna + dc, cella);
    }
  }
}

function inserisciNellaColonna(tr, colonna, td) {
  let cursore = 1;
  for (const cella of tr.querySelectorAll(":scope > td")) {
    if (cursore >= colonna) {
      cella.before(td);
      return;
    }
    cursore += cella.colSpan || 1;
  }
  tr.append(td);
}

function parcheggioDi(figura) {
  let box = figura.querySelector(":scope > .parcheggio-celle");
  if (!box) {
    box = document.createElement("div");
    box.className = "parcheggio-celle solo-editor";
    box.hidden = true;
    box.contentEditable = "false";
    figura.append(box);
  }
  return box;
}
