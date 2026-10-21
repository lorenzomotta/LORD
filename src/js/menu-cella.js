// Menu del tasto destro sulle celle della tabella.

import { iniziaSceltaCella } from "./calcola-cella.js";
import { foglio } from "./editor.js";
import { avvisa } from "./finestre.js";
import { applicaFormatoAllaColonna, aggiungiColonnaDaCella, aggiungiRigaDaCella, impostaBordoCelle, impostaDecimaliCelle, impostaStileCella, impostaTipoCelle, haTotaleColonna, togliColonnaDaCella, togliRigaDaCella, totaleColonnaDaCella } from "./tabelle.js";

let cellaMenu = null;

export function avviaMenuCella() {
  const menu = document.getElementById("menu-cella");

  foglio.addEventListener("contextmenu", (evento) => {
    const td = evento.target.closest("td[data-cella]");
    if (!td || !foglio.contains(td)) return;
    evento.preventDefault();
    if (!td.classList.contains("selezionata")) {
      document.dispatchEvent(new CustomEvent("selezione-celle", {
        detail: { ancora: td, celle: [td], fuoco: false },
      }));
    }
    apriMenu(td, evento.clientX, evento.clientY);
  });

  menu.addEventListener("change", (evento) => {
    const celle = celleDelMenu();
    if (!celle.length) return;
    if (evento.target.id === "menu-tipo") {
      impostaTipoCelle(celle, evento.target.value);
      return;
    }
    if (evento.target.id === "menu-decimali") {
      impostaDecimaliCelle(celle, evento.target.value);
      return;
    }
    if (evento.target.id === "menu-bordo") {
      impostaBordoCelle(celle, evento.target.value);
      return;
    }
    if (evento.target.id === "menu-altezza") {
      applicaAltezzaScritta();
      return;
    }
    const campo = campoDelControllo(evento.target.id);
    if (!campo) return;
    celle.forEach((td) => impostaStileCella(td, campo, evento.target.value));
  });

  menu.addEventListener("input", (evento) => {
    if (evento.target.tagName !== "INPUT" || evento.target.id === "menu-altezza") return;
    const campo = campoDelControllo(evento.target.id);
    if (!campo) return;
    celleDelMenu().forEach((td) => impostaStileCella(td, campo, evento.target.value));
  });

  menu.addEventListener("keydown", (evento) => {
    if (evento.target.id !== "menu-altezza" || evento.key !== "Enter") return;
    evento.preventDefault();
    applicaAltezzaScritta();
  });

  menu.addEventListener("click", (evento) => {
    const stile = evento.target.closest("[data-stile]");
    if (stile) {
      const campo = stile.dataset.stile;
      const celle = celleDelMenu();
      if (!celle.length || !cellaMenu) return;
      const acceso = cellaMenu.dataset[campo] !== "1";
      celle.forEach((td) => impostaStileCella(td, campo, acceso ? "1" : ""));
      stile.classList.toggle("acceso", acceso);
      return;
    }
  });

  // I colori arrivano dalla tavolozza (tavolozza-colori.js); colore vuoto vuol dire togliere.
  document.addEventListener("colore-cella", (evento) => {
    const { campo, colore } = evento.detail;
    celleDelMenu().forEach((td) => impostaStileCella(td, campo, colore));
  });

  document.getElementById("menu-applica-colonna").addEventListener("click", () => {
    if (!celleDelMenu().length) return;
    applicaFormatoAllaColonna();
  });

  document.getElementById("menu-calcola").addEventListener("click", () => eseguiSullaCella(iniziaSceltaCella));
  document.getElementById("menu-totale").addEventListener("click", () => eseguiSullaCella(totaleColonnaDaCella));
  document.getElementById("menu-aggiungi-riga").addEventListener("click", () => eseguiSullaCella(aggiungiRigaDaCella));
  document.getElementById("menu-togli-riga").addEventListener("click", () => eseguiSullaCella(togliRigaDaCella));
  document.getElementById("menu-aggiungi-colonna").addEventListener("click", () => eseguiSullaCella(aggiungiColonnaDaCella));
  document.getElementById("menu-togli-colonna").addEventListener("click", () => eseguiSullaCella(togliColonnaDaCella));

  menu.addEventListener("contextmenu", (evento) => evento.preventDefault());
  document.getElementById("menu-cella-chiudi").addEventListener("click", chiudiMenu);
  document.addEventListener("mousedown", (evento) => {
    if (menu.hidden || menu.contains(evento.target) || evento.target.closest("#tavolozza-colori")) return;
    applicaAltezzaScritta();
    chiudiMenu();
  });
  document.addEventListener("keydown", (evento) => {
    if (evento.key === "Escape") chiudiMenu();
  });
  document.addEventListener("wheel", (evento) => {
    if (menu.hidden) return;
    evento.preventDefault();
    menu.scrollTop += passoRotella(evento, menu);
  }, { passive: false });
}

function passoRotella(evento, menu) {
  if (evento.deltaMode === 1) return evento.deltaY * 16;
  if (evento.deltaMode === 2) return evento.deltaY * menu.clientHeight;
  return evento.deltaY;
}

function apriMenu(td, x, y) {
  cellaMenu = td;
  const menu = document.getElementById("menu-cella");
  document.getElementById("menu-tipo").value = td.dataset.tipo || "auto";
  document.getElementById("menu-totale").textContent = haTotaleColonna(td) ? "Togli totale colonna" : "Totale colonna";
  document.getElementById("menu-decimali").value = td.dataset.decimali || "";
  document.getElementById("menu-bordo").value = td.dataset.bordo || "";
  document.getElementById("menu-font").value = td.dataset.font || "";
  document.getElementById("menu-altezza").value = mostraNumero(td.dataset.dimensione);
  document.getElementById("menu-allinea").value = td.dataset.allinea || "";
  ["grassetto", "corsivo", "sottolineato", "barrato"].forEach((campo) => {
    menu.querySelector(`[data-stile="${campo}"]`).classList.toggle("acceso", td.dataset[campo] === "1");
  });
  menu.hidden = false;
  menu.style.left = "0px";
  menu.style.top = "0px";
  const box = menu.getBoundingClientRect();
  const sinistra = Math.max(8, Math.min(x, window.innerWidth - box.width - 8));
  const alto = Math.max(8, Math.min(y, window.innerHeight - box.height - 8));
  menu.style.left = `${sinistra}px`;
  menu.style.top = `${alto}px`;
}

function celleDelMenu() {
  if (!cellaMenu) return [];
  if (cellaMenu.classList.contains("selezionata")) {
    const gruppo = [...cellaMenu.closest(".blocco-tabella").querySelectorAll("td.selezionata")];
    if (gruppo.length) return gruppo;
  }
  return [cellaMenu];
}

function eseguiSullaCella(azione) {
  const td = cellaMenu;
  if (!td) return;
  chiudiMenu();
  azione(td);
}

function chiudiMenu() {
  document.getElementById("menu-cella").hidden = true;
  cellaMenu = null;
}

function applicaAltezzaScritta() {
  const campo = document.getElementById("menu-altezza");
  const celle = celleDelMenu();
  if (!celle.length) return;
  const valore = leggiAltezza(campo.value);
  if (valore == null) {
    campo.value = mostraNumero(celle[0].dataset.dimensione);
    avvisa("Scrivi l’altezza delle lettere in punti, da 1 a 200. Per esempio 12 è normale e 50 è molto grande. Se lasci vuoto, resta come il foglio.");
    return;
  }
  celle.forEach((td) => {
    impostaStileCella(td, "interlinea", "");
    impostaStileCella(td, "dimensione", valore);
  });
  campo.value = mostraNumero(valore);
}

function leggiAltezza(testo) {
  const pulito = testo.trim().replace(",", ".");
  if (!pulito) return "";
  if (!/^\d+(?:\.\d+)?$/.test(pulito)) return null;
  const numero = Number(pulito);
  if (numero < 1 || numero > 200) return null;
  return String(numero);
}

function mostraNumero(valore) {
  return valore ? String(valore).replace(".", ",") : "";
}

function campoDelControllo(id) {
  return {
    "menu-font": "font",
    "menu-allinea": "allinea",
  }[id] || "";
}
