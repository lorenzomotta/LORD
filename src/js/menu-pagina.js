// Menu del tasto destro sul bordo della pagina: formato, misure e margini.
// Il bordo è la fascia bianca intorno al testo (sopra, sotto, sinistra, destra).

import { opzioniPagina } from "./documento.js";
import { clicSuTesto } from "./menu-testo.js";

export function avviaMenuPagina() {
  const menu = document.getElementById("menu-pagina");
  const pagina = document.getElementById("cornice-foglio");

  pagina.addEventListener("contextmenu", (evento) => {
    if (!clicSulBordoPagina(evento)) return;
    evento.preventDefault();
    document.getElementById("menu-testo").hidden = true;
    apriMenu(evento.clientX, evento.clientY);
  });

  pagina.addEventListener("mousemove", (evento) => {
    pagina.classList.toggle("sopra-bordo-pagina", clicSulBordoPagina(evento));
  });
  pagina.addEventListener("mouseleave", () => pagina.classList.remove("sopra-bordo-pagina"));

  menu.addEventListener("contextmenu", (evento) => evento.preventDefault());
  document.getElementById("menu-pagina-chiudi").addEventListener("click", chiudiMenu);
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

function clicSulBordoPagina(evento) {
  if (clicSuTesto(evento)) return false;
  const origine = evento.target.nodeType === 1 ? evento.target : evento.target.parentElement;
  if (!origine || origine.closest("td[data-cella], .blocco-immagine, .blocco-forma, .blocco-tabella, input, textarea, select, button, #menu-testo")) return false;
  if (!origine.closest("#foglio, #intestazione-foglio, #pie-foglio")) return false;

  const x = evento.clientX;
  const y = evento.clientY;
  const carte = document.querySelectorAll("#carte-pagina .carta-pagina");
  if (carte.length) {
    for (const carta of carte) {
      const box = carta.getBoundingClientRect();
      if (x < box.left || x > box.right || y < box.top || y > box.bottom) continue;
      return nelBordo(x, y, box, spessoreDaPagina(box.width));
    }
    return false;
  }

  const foglio = document.getElementById("foglio");
  const box = foglio.getBoundingClientRect();
  const stile = getComputedStyle(foglio);
  return nelBordo(x, y, box, {
    sinistra: parseFloat(stile.paddingLeft) || 8,
    destra: parseFloat(stile.paddingRight) || 8,
    sopra: parseFloat(stile.paddingTop) || 8,
    sotto: parseFloat(stile.paddingBottom) || 8,
  });
}

function spessoreDaPagina(larghezzaPx) {
  const opzioni = opzioniPagina();
  const pxPerMm = larghezzaPx / opzioni.larghezza;
  return {
    sinistra: Math.max(8, opzioni.margineSinistra * pxPerMm),
    destra: Math.max(8, opzioni.margineDestra * pxPerMm),
    sopra: Math.max(8, opzioni.margineSopra * pxPerMm),
    sotto: Math.max(8, opzioni.margineSotto * pxPerMm),
  };
}

function nelBordo(x, y, box, spessore) {
  if (x < box.left || x > box.right || y < box.top || y > box.bottom) return false;
  return x - box.left <= spessore.sinistra
    || box.right - x <= spessore.destra
    || y - box.top <= spessore.sopra
    || box.bottom - y <= spessore.sotto;
}

function apriMenu(x, y) {
  const menu = document.getElementById("menu-pagina");
  menu.hidden = false;
  menu.style.left = "0px";
  menu.style.top = "0px";
  const box = menu.getBoundingClientRect();
  menu.style.left = `${Math.max(8, Math.min(x, window.innerWidth - box.width - 8))}px`;
  menu.style.top = `${Math.max(8, Math.min(y, window.innerHeight - box.height - 8))}px`;
}

function chiudiMenu() {
  document.getElementById("menu-pagina").hidden = true;
}
