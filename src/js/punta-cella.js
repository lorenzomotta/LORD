// Mentre scrivi una formula, il clic su una cella inserisce il suo nome (come in Excel).

import { foglio } from "./editor.js";

const DOPO_QUESTI = "=+-*/(;:,";

export function avviaPuntaCella() {
  const formula = document.getElementById("formula");
  document.addEventListener("mousedown", inserisciConMouse, true);
  ["input", "keyup", "click", "focus"].forEach((tipo) => formula.addEventListener(tipo, aggiornaStato));
  formula.addEventListener("blur", () => document.body.classList.remove("formula-punta"));
}

function puoiPuntare() {
  const formula = document.getElementById("formula");
  if (document.activeElement !== formula || formula.disabled) return false;
  const valore = formula.value;
  if (!valore.trim().startsWith("=")) return false;
  if (formula.selectionStart !== formula.selectionEnd) return false;
  const prima = valore.slice(0, formula.selectionStart).trimEnd();
  return prima.length > 0 && DOPO_QUESTI.includes(prima[prima.length - 1]);
}

function aggiornaStato() {
  document.body.classList.toggle("formula-punta", puoiPuntare());
}

function inserisciConMouse(evento) {
  if (evento.button !== 0 || !puoiPuntare()) return;
  const td = evento.target.closest("td[data-cella]");
  if (!td || !foglio.contains(td)) return;
  evento.preventDefault();
  evento.stopPropagation();
  const attiva = document.querySelector(".blocco-tabella td.cella-ancora");
  if (td === attiva) return;
  const tabellaAttiva = attiva?.closest(".blocco-tabella")?.dataset.id;
  const tabellaCliccata = td.closest(".blocco-tabella")?.dataset.id;
  const nome = tabellaAttiva === tabellaCliccata ? td.dataset.cella : `${tabellaCliccata}.${td.dataset.cella}`;

  const formula = document.getElementById("formula");
  const cursore = formula.selectionStart;
  formula.value = formula.value.slice(0, cursore) + nome + formula.value.slice(cursore);
  const fine = cursore + nome.length;
  formula.setSelectionRange(fine, fine);
  segnaAppenaInserita(td);
  aggiornaStato();
}

function segnaAppenaInserita(td) {
  td.classList.add("cella-puntata");
  setTimeout(() => td.classList.remove("cella-puntata"), 600);
}
