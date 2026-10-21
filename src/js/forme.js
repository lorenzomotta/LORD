// Inserisce linee, frecce, rettangoli e cerchi sopra il foglio.
// Si trascinano dove si vuole: non seguono il testo.

import { foglio, ripristinaCursore, salvaCursore } from "./editor.js";
import { segnaModifica } from "./modifiche.js";
import { zoomPagina } from "./zoom-pagina.js";

const NS = "http://www.w3.org/2000/svg";
const BORDO = "#1f4d3a";
const SFONDO = "#fffdf8";

const TRATTI = ["continua", "tratti-stretti", "tratti", "tratti-larghi", "punti-stretti", "punti", "punti-larghi"];
const NOMI_TRATTO = {
  continua: "Continua",
  "tratti-stretti": "Trattini stretti",
  tratti: "Trattini medi",
  "tratti-larghi": "Trattini larghi",
  "punti-stretti": "Punti stretti",
  punti: "Punti medi",
  "punti-larghi": "Punti larghi",
};

const TIPI = {
  linea: { nome: "Linea", w: 220, h: 28, chiusa: false },
  freccia: { nome: "Freccia", w: 220, h: 36, chiusa: false },
  rettangolo: { nome: "Rettangolo", w: 180, h: 110, chiusa: true },
  arrotondato: { nome: "Angoli tondi", w: 180, h: 110, chiusa: true },
  cerchio: { nome: "Cerchio", w: 120, h: 120, chiusa: true },
  ellisse: { nome: "Ellisse", w: 180, h: 110, chiusa: true },
  poligono: { nome: "Poligono", w: 160, h: 160, chiusa: true },
};

export function avviaForme() {
  const pannello = document.getElementById("pannello-forme");
  const bottone = document.getElementById("btn-forme");
  let cursore = null;

  bottone.addEventListener("mousedown", (evento) => {
    evento.preventDefault();
    cursore = salvaCursore();
  });
  bottone.addEventListener("click", () => {
    if (pannello.hidden) apriPannello();
    else chiudiPannello();
  });
  pannello.addEventListener("mousedown", (evento) => evento.preventDefault());
  pannello.addEventListener("click", (evento) => {
    const scelta = evento.target.closest("[data-forma]");
    if (!scelta || !TIPI[scelta.dataset.forma]) return;
    ripristinaCursore(cursore);
    inserisciForma(scelta.dataset.forma);
    chiudiPannello();
    segnaModifica();
  });

  const strato = stratoForme();
  strato.addEventListener("mousedown", (evento) => {
    const nodo = evento.target.closest(".blocco-forma [data-nodo-forma]");
    if (nodo) {
      iniziaNodo(evento, nodo);
      return;
    }
    const ruota = evento.target.closest(".blocco-forma [data-ruota-forma]");
    if (ruota) {
      iniziaRuota(evento, ruota);
      return;
    }
    const presa = evento.target.closest(".blocco-forma [data-ridimensiona-forma]");
    if (presa) {
      iniziaRidimensiona(evento, presa);
      return;
    }
    const figura = evento.target.closest(".blocco-forma");
    if (!figura || evento.target.closest(".forma-comandi")) return;
    iniziaSposta(evento, figura);
  });

  strato.addEventListener("contextmenu", (evento) => {
    const figura = evento.target.closest(".blocco-forma");
    if (!figura) return;
    evento.preventDefault();
    apriBarra(figura);
  });

  strato.addEventListener("click", (evento) => {
    const elimina = evento.target.closest(".blocco-forma [data-azione='elimina-forma']");
    if (!elimina) return;
    const figura = elimina.closest(".blocco-forma");
    togliEco(figura);
    figura.remove();
    segnaModifica();
  });

  strato.addEventListener("input", (evento) => {
    const figura = evento.target.closest(".blocco-forma");
    if (!figura) return;
    if (evento.target.classList.contains("campo-bordo")) figura.dataset.bordo = evento.target.value;
    else if (evento.target.classList.contains("campo-angolo")) {
      if (evento.target.value === "" || evento.target.value === "-") return;
      figura.dataset.angolo = String(angoloNormale(evento.target.value));
      applicaRotazione(figura);
      segnaModifica();
      return;
    } else if (evento.target.classList.contains("campo-sfondo")) figura.dataset.riempimento = evento.target.value;
    else if (evento.target.classList.contains("campo-trasparenza")) figura.dataset.trasparenza = evento.target.value;
    else return;
    applicaDisegno(figura);
    segnaModifica();
  });

  strato.addEventListener("change", (evento) => {
    const figura = evento.target.closest(".blocco-forma");
    if (!figura) return;
    if (evento.target.classList.contains("campo-ordine")) {
      const modo = evento.target.value;
      evento.target.value = "";
      if (modo) spostaPiano(figura, modo);
      segnaModifica();
      return;
    }
    if (evento.target.classList.contains("campo-lati")) {
      const n = limita(evento.target.value, 5, 3, 24);
      figura.dataset.lati = String(n);
      figura.dataset.nodi = "";
      evento.target.value = String(n);
      applicaDisegno(figura);
      segnaModifica();
      return;
    }
    if (evento.target.classList.contains("campo-tratto")) {
      figura.dataset.tratto = TRATTI.includes(evento.target.value) ? evento.target.value : "continua";
      applicaDisegno(figura);
      segnaModifica();
      return;
    }
    if (!evento.target.classList.contains("campo-spessore")) return;
    figura.dataset.spessore = evento.target.value;
    applicaDisegno(figura);
    segnaModifica();
  });

  document.addEventListener("mousedown", (evento) => {
    if (!evento.target.closest("#pannello-forme, #btn-forme")) chiudiPannello();
    if (!evento.target.closest(".blocco-forma")) chiudiScelta();
  });
  const cornice = document.getElementById("cornice-foglio");
  cornice.addEventListener("mousedown", (evento) => {
    if (evento.button !== 0 || evento.target.closest(".blocco-forma")) return;
    const figura = formaDietroLibera(evento.clientX, evento.clientY);
    if (!figura) return;
    evento.preventDefault();
    evento.stopPropagation();
    iniziaSposta(evento, figura);
  }, true);
  cornice.addEventListener("contextmenu", (evento) => {
    if (evento.target.closest(".blocco-forma")) return;
    const figura = formaDietroLibera(evento.clientX, evento.clientY);
    if (!figura) return;
    evento.preventDefault();
    evento.stopPropagation();
    apriBarra(figura);
  }, true);
  document.addEventListener("keydown", (evento) => {
    if (evento.key === "Escape") {
      chiudiPannello();
      chiudiScelta();
    }
  });
  foglio.addEventListener("keydown", (evento) => {
    if (evento.target.closest(".forma-comandi")) return;
    chiudiScelta();
  });

  preparaForme();
}

export function preparaForme() {
  const strato = stratoForme();
  if (!strato || !foglio) return;
  const figure = [...foglio.querySelectorAll(".blocco-forma")];
  strato.replaceChildren();
  stratoDietro()?.replaceChildren();
  figure.forEach((figura, indice) => {
    sistemaForma(figura, indice);
    strato.append(figura);
  });
}

function sistemaForma(figura, indice) {
  if (!TIPI[figura.dataset.tipo]) figura.dataset.tipo = "rettangolo";
  figura.querySelector(".forma-comandi")?.remove();
  figura.prepend(creaComandi());
  if (!figura.querySelector(".cornice-forma")) figura.append(creaCornice());
  else {
    const cornice = figura.querySelector(".cornice-forma");
    assicuraPreseRidimensiona(cornice);
    assicuraPreseRuota(cornice);
  }
  figura.classList.remove("scelta", "barra-aperta", "barra-sotto", "trascinata");
  if (figura.dataset.x == null || figura.dataset.x === "") figura.dataset.x = String(24 + indice * 18);
  if (figura.dataset.y == null || figura.dataset.y === "") figura.dataset.y = String(24 + indice * 18);
  if (!figura.dataset.piano) figura.dataset.piano = String(indice + 1);
  if (figura.dataset.angolo == null || figura.dataset.angolo === "") figura.dataset.angolo = "0";
  applicaDisegno(figura);
  applicaPosto(figura);
  aggiornaComandi(figura);
}

function stratoForme() {
  return document.getElementById("strato-forme");
}

// Disegna la forma in un PNG. Word non conosce il disegno, quindi riceve un'immagine.
export function pngForma(figura) {
  const dati = leggiForma(figura);
  const svg = document.createElementNS(NS, "svg");
  disegna(svg, dati);
  const xml = new XMLSerializer().serializeToString(svg);
  const indirizzo = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(xml)}`;
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const scala = 2;
      const tela = document.createElement("canvas");
      tela.width = Math.max(1, Math.round(dati.larghezza * scala));
      tela.height = Math.max(1, Math.round(dati.altezza * scala));
      tela.getContext("2d").drawImage(img, 0, 0, tela.width, tela.height);
      tela.toBlob(async (blob) => {
        if (!blob) {
          reject(new Error("png"));
          return;
        }
        resolve(new Uint8Array(await blob.arrayBuffer()));
      }, "image/png");
    };
    img.onerror = () => reject(new Error("svg"));
    img.src = indirizzo;
  });
}

function apriPannello() {
  const pannello = document.getElementById("pannello-forme");
  const box = document.getElementById("btn-forme").getBoundingClientRect();
  pannello.hidden = false;
  const larghezza = pannello.offsetWidth || 180;
  const sinistra = Math.min(box.left, window.innerWidth - larghezza - 8);
  pannello.style.left = `${Math.max(8, sinistra)}px`;
  pannello.style.top = `${box.bottom + 4}px`;
  document.getElementById("btn-forme").setAttribute("aria-expanded", "true");
}

function chiudiPannello() {
  const pannello = document.getElementById("pannello-forme");
  if (!pannello || pannello.hidden) return;
  pannello.hidden = true;
  document.getElementById("btn-forme").setAttribute("aria-expanded", "false");
}

function inserisciForma(tipo) {
  const base = TIPI[tipo];
  const figura = document.createElement("figure");
  figura.className = "blocco-forma";
  figura.contentEditable = "false";
  figura.dataset.tipo = tipo;
  figura.dataset.bordo = BORDO;
  figura.dataset.riempimento = base.chiusa ? SFONDO : "nessuno";
  figura.dataset.spessore = "2";
  figura.dataset.larghezza = String(base.w);
  figura.dataset.altezza = String(base.h);
  const posto = postoIniziale();
  figura.dataset.x = String(posto.x);
  figura.dataset.y = String(posto.y);
  figura.dataset.piano = String(prossimoPiano());
  figura.dataset.angolo = "0";
  if (tipo === "poligono") figura.dataset.lati = "5";
  figura.append(creaComandi(), creaCornice());
  applicaDisegno(figura);
  applicaPosto(figura);
  aggiornaComandi(figura);
  stratoForme().append(figura);
  scegli(figura);
  figura.scrollIntoView({ block: "nearest", inline: "nearest" });
}

function creaComandi() {
  const barra = document.createElement("div");
  barra.className = "forma-comandi solo-editor";

  const elimina = document.createElement("button");
  elimina.type = "button";
  elimina.dataset.azione = "elimina-forma";
  elimina.textContent = "Elimina";

  const bordo = document.createElement("label");
  bordo.append(document.createTextNode("Bordo "));
  const coloreBordo = document.createElement("input");
  coloreBordo.type = "color";
  coloreBordo.className = "campo-bordo";
  coloreBordo.title = "Colore del bordo";
  bordo.append(coloreBordo);

  const sfondo = document.createElement("span");
  sfondo.className = "scelta-sfondo";
  const coloreSfondo = document.createElement("input");
  coloreSfondo.type = "color";
  coloreSfondo.className = "campo-sfondo";
  coloreSfondo.title = "Colore di riempimento";
  const etichettaColore = document.createElement("label");
  etichettaColore.append(document.createTextNode("Sfondo "), coloreSfondo);
  const levetta = document.createElement("input");
  levetta.type = "range";
  levetta.className = "campo-trasparenza";
  levetta.min = "0";
  levetta.max = "80";
  levetta.step = "10";
  levetta.value = "0";
  levetta.title = "Il colore resta. Più a destra, più si vede quello che c'è sotto";
  const etichettaVelo = document.createElement("label");
  etichettaVelo.append(document.createTextNode("Trasparenza "), levetta);
  sfondo.append(etichettaColore, etichettaVelo);

  const spessore = document.createElement("label");
  spessore.append(document.createTextNode("Spessore "));
  const tendina = document.createElement("select");
  tendina.className = "campo-spessore";
  tendina.title = "Spessore del bordo";
  ["1", "2", "3", "4", "6"].forEach((valore) => {
    const opzione = document.createElement("option");
    opzione.value = valore;
    opzione.textContent = valore;
    tendina.append(opzione);
  });
  spessore.append(tendina);

  const linea = document.createElement("label");
  linea.append(document.createTextNode("Linea "));
  const tratto = document.createElement("select");
  tratto.className = "campo-tratto";
  tratto.title = "Continua, trattini o punti. Stretti, medi e larghi cambiano lo spazio";
  TRATTI.forEach((valore) => {
    const opzione = document.createElement("option");
    opzione.value = valore;
    opzione.textContent = NOMI_TRATTO[valore];
    tratto.append(opzione);
  });
  linea.append(tratto);

  const gradi = document.createElement("label");
  gradi.append(document.createTextNode("Gradi "));
  const angolo = document.createElement("input");
  angolo.type = "number";
  angolo.className = "campo-angolo";
  angolo.title = "Rotazione in gradi. 0 è dritto, 90 è un quarto di giro";
  angolo.step = "1";
  angolo.value = "0";
  gradi.append(angolo);

  const lati = document.createElement("label");
  lati.className = "scelta-lati";
  lati.append(document.createTextNode("Lati "));
  const campoLati = document.createElement("input");
  campoLati.type = "number";
  campoLati.className = "campo-lati";
  campoLati.min = "3";
  campoLati.max = "24";
  campoLati.step = "1";
  campoLati.value = "5";
  campoLati.title = "Quanti vertici ha il poligono, da 3 a 24. Cambiandolo torna una forma regolare";
  lati.append(campoLati);

  const ordine = document.createElement("select");
  ordine.className = "campo-ordine";
  ordine.title = "Mette questa forma sopra o sotto le altre";
  [
    ["", "Ordine"],
    ["sopra", "Porta sopra"],
    ["sotto", "Porta sotto"],
    ["cima", "Sopra a tutto"],
    ["fondo", "Sotto a tutto"],
  ].forEach(([valore, testo]) => {
    const opzione = document.createElement("option");
    opzione.value = valore;
    opzione.textContent = testo;
    ordine.append(opzione);
  });

  barra.append(elimina, bordo, sfondo, spessore, linea, gradi, lati, ordine);
  return barra;
}

function creaCornice() {
  const cornice = document.createElement("div");
  cornice.className = "cornice-forma";
  const svg = document.createElementNS(NS, "svg");
  svg.setAttribute("aria-hidden", "true");
  cornice.append(svg);
  assicuraPreseRidimensiona(cornice);
  assicuraPreseRuota(cornice);
  return cornice;
}

function testoPresaRidimensiona(modo) {
  if (modo === "larghezza") return "Trascina per allungare. L'inizio resta fermo";
  if (modo === "larghezza-inizio") return "Trascina per allungare. La fine resta ferma";
  if (modo === "altezza") return "Trascina per l'altezza";
  return "Trascina per ingrandire";
}

function creaPresaRidimensiona(modo) {
  const presa = document.createElement("span");
  presa.className = `presa-forma presa-forma-${modo} solo-editor`;
  presa.dataset.ridimensionaForma = modo;
  presa.title = testoPresaRidimensiona(modo);
  return presa;
}

function assicuraPreseRidimensiona(cornice) {
  ["larghezza", "larghezza-inizio", "altezza", "entrambi"].forEach((modo) => {
    let presa = cornice.querySelector(`[data-ridimensiona-forma="${modo}"]`);
    if (!presa) {
      presa = creaPresaRidimensiona(modo);
      cornice.append(presa);
    }
    presa.title = testoPresaRidimensiona(modo);
  });
}

function creaPresaRuota(origine) {
  const ruota = document.createElement("span");
  ruota.className = `presa-ruota presa-ruota-${origine} solo-editor`;
  ruota.dataset.ruotaForma = "1";
  ruota.dataset.origineRuota = origine;
  ruota.title = testoPresaRuota(origine);
  return ruota;
}

function testoPresaRuota(origine) {
  if (origine === "inizio") return "Trascina: l'inizio gira e la fine resta ferma. Con Maiusc i gradi vanno di 15 in 15";
  if (origine === "fine") return "Trascina: la fine gira e l'inizio resta fermo. Con Maiusc i gradi vanno di 15 in 15";
  return "Trascina in tondo: la forma gira sul posto. Con Maiusc i gradi vanno di 15 in 15";
}

function assicuraPreseRuota(cornice) {
  cornice.querySelectorAll(".presa-ruota").forEach((presa) => {
    if (!presa.dataset.origineRuota) {
      presa.dataset.origineRuota = "alto";
      presa.classList.add("presa-ruota-alto");
    }
    presa.title = testoPresaRuota(presa.dataset.origineRuota);
  });
  ["alto", "inizio", "fine"].forEach((origine) => {
    if (cornice.querySelector(`[data-origine-ruota="${origine}"]`)) return;
    cornice.append(creaPresaRuota(origine));
  });
}

function leggiForma(figura) {
  const tipo = TIPI[figura.dataset.tipo] ? figura.dataset.tipo : "rettangolo";
  const base = TIPI[tipo];
  const massimo = tipo === "poligono" ? 1600 : 640;
  const larghezza = limita(figura.dataset.larghezza, base.w, 24, massimo);
  let altezza = limita(figura.dataset.altezza, base.h, tipo === "linea" || tipo === "freccia" ? 18 : 24, massimo);
  if (tipo === "cerchio") altezza = larghezza;
  const lati = tipo === "poligono" ? limita(figura.dataset.lati, 5, 3, 24) : 0;
  const nodi = tipo === "poligono" ? leggiNodi(figura, larghezza, altezza, lati) : [];
  return {
    tipo,
    chiusa: base.chiusa,
    larghezza,
    altezza,
    bordo: coloreValido(figura.dataset.bordo, BORDO),
    riempimento: base.chiusa
      ? coloreValido(figura.dataset.riempimento === "nessuno" ? "" : figura.dataset.riempimento, SFONDO)
      : "nessuno",
    trasparenza: base.chiusa ? limita(figura.dataset.trasparenza, figura.dataset.riempimento === "nessuno" ? 60 : 0, 0, 80) : 0,
    spessore: limita(figura.dataset.spessore, 2, 1, 6),
    x: Number(figura.dataset.x) || 0,
    y: Number(figura.dataset.y) || 0,
    piano: Number(figura.dataset.piano) || 1,
    angolo: angoloNormale(figura.dataset.angolo),
    lati,
    nodi,
    tratto: TRATTI.includes(figura.dataset.tratto) ? figura.dataset.tratto : "continua",
  };
}

function applicaDisegno(figura) {
  const dati = leggiForma(figura);
  figura.dataset.larghezza = String(dati.larghezza);
  figura.dataset.altezza = String(dati.altezza);
  if (dati.chiusa) {
    figura.dataset.riempimento = dati.riempimento;
    figura.dataset.trasparenza = String(dati.trasparenza);
  }
  if (dati.tipo === "poligono") {
    figura.dataset.lati = String(dati.lati);
    figura.dataset.nodi = scriviNodi(dati.nodi);
  }
  figura.dataset.tratto = dati.tratto;
  const cornice = figura.querySelector(".cornice-forma");
  if (!cornice) return;
  cornice.style.width = `${dati.larghezza}px`;
  cornice.style.height = `${dati.altezza}px`;
  const svg = cornice.querySelector("svg");
  if (svg) disegna(svg, dati);
  sistemaNodiVisibili(figura, dati);
  aggiornaEco(figura);
}

function applicaPosto(figura) {
  const x = Number(figura.dataset.x) || 0;
  const y = Number(figura.dataset.y) || 0;
  figura.style.left = `${x}px`;
  figura.style.top = `${y}px`;
  figura.style.zIndex = figura.dataset.piano || "1";
  figura.classList.toggle("dietro", figura.dataset.dietro === "1");
  figura.classList.toggle("barra-sotto", y < 72);
  applicaRotazione(figura);
}

function angoloNormale(valore) {
  const numero = Number(valore);
  if (!Number.isFinite(numero)) return 0;
  return Math.round(((numero % 360) + 360) % 360);
}

function applicaRotazione(figura) {
  const angolo = angoloNormale(figura.dataset.angolo);
  figura.dataset.angolo = String(angolo);
  const cornice = figura.querySelector(".cornice-forma");
  if (cornice) cornice.style.transform = angolo ? `rotate(${angolo}deg)` : "";
  aggiornaEco(figura);
  const campo = figura.querySelector(".campo-angolo");
  if (campo && document.activeElement !== campo) campo.value = String(angolo);
}

function aggiornaComandi(figura) {
  const dati = leggiForma(figura);
  const bordo = figura.querySelector(".campo-bordo");
  if (bordo) bordo.value = dati.bordo;
  const sfondo = figura.querySelector(".scelta-sfondo");
  if (sfondo) sfondo.hidden = !dati.chiusa;
  const colore = figura.querySelector(".campo-sfondo");
  if (colore && dati.riempimento !== "nessuno") colore.value = dati.riempimento;
  const velo = figura.querySelector(".campo-trasparenza");
  if (velo) velo.value = String(dati.trasparenza);
  const spessore = figura.querySelector(".campo-spessore");
  if (spessore) spessore.value = String(dati.spessore);
  const tratto = figura.querySelector(".campo-tratto");
  if (tratto) tratto.value = dati.tratto;
  const angolo = figura.querySelector(".campo-angolo");
  if (angolo) angolo.value = String(dati.angolo);
  const sceltaLati = figura.querySelector(".scelta-lati");
  if (sceltaLati) sceltaLati.hidden = dati.tipo !== "poligono";
  const lati = figura.querySelector(".campo-lati");
  if (lati && document.activeElement !== lati) lati.value = String(dati.lati || 5);
}

function scegli(figura) {
  document.querySelectorAll(".blocco-forma.scelta").forEach((altra) => {
    if (altra !== figura) altra.classList.remove("scelta", "barra-aperta");
  });
  figura.classList.add("scelta");
}

function apriBarra(figura) {
  scegli(figura);
  document.querySelectorAll(".blocco-forma.barra-aperta").forEach((altra) => {
    if (altra !== figura) altra.classList.remove("barra-aperta");
  });
  figura.classList.add("barra-aperta");
}

function chiudiScelta() {
  document.querySelectorAll(".blocco-forma.scelta, .blocco-forma.barra-aperta").forEach((figura) => {
    figura.classList.remove("scelta", "barra-aperta");
  });
}

function iniziaSposta(evento, figura) {
  if (evento.button !== 0) return;
  evento.preventDefault();
  scegli(figura);
  const startX = evento.clientX;
  const startY = evento.clientY;
  const zoom = zoomPagina() || 1;
  const origineX = Number(figura.dataset.x) || 0;
  const origineY = Number(figura.dataset.y) || 0;
  let mosso = false;

  function muovi(movimento) {
    const deltaX = (movimento.clientX - startX) / zoom;
    const deltaY = (movimento.clientY - startY) / zoom;
    if (!mosso && Math.hypot(deltaX, deltaY) < 3) return;
    mosso = true;
    figura.dataset.x = String(Math.round(origineX + deltaX));
    figura.dataset.y = String(Math.round(origineY + deltaY));
    applicaPosto(figura);
    figura.classList.add("trascinata");
  }

  function fine() {
    document.removeEventListener("mousemove", muovi);
    document.removeEventListener("mouseup", fine);
    figura.classList.remove("trascinata");
    if (mosso) segnaModifica();
  }

  document.addEventListener("mousemove", muovi);
  document.addEventListener("mouseup", fine);
}

function spostaPiano(figura, modo) {
  const tutte = [...document.querySelectorAll("#strato-forme .blocco-forma")];
  const dietro = tutte.filter((item) => item.dataset.dietro === "1").sort(perPiano);
  const davanti = tutte.filter((item) => item.dataset.dietro !== "1").sort(perPiano);
  const nelDietro = figura.dataset.dietro === "1";
  const lista = nelDietro ? dietro : davanti;
  const indice = lista.indexOf(figura);
  if (indice < 0) return;
  lista.splice(indice, 1);
  if (modo === "cima") {
    delete figura.dataset.dietro;
    davanti.push(figura);
  } else if (modo === "fondo") {
    figura.dataset.dietro = "1";
    dietro.unshift(figura);
  } else if (modo === "sopra" && nelDietro && indice >= dietro.length) {
    delete figura.dataset.dietro;
    davanti.unshift(figura);
  } else if (modo === "sopra") lista.splice(indice + 1, 0, figura);
  else if (!nelDietro && indice === 0) {
    figura.dataset.dietro = "1";
    dietro.push(figura);
  } else lista.splice(Math.max(0, indice - 1), 0, figura);
  sistemaPiani(dietro);
  sistemaPiani(davanti);
}

function perPiano(a, b) {
  return (Number(a.dataset.piano) || 0) - (Number(b.dataset.piano) || 0);
}

function sistemaPiani(lista) {
  lista.forEach((item, i) => {
    item.dataset.piano = String(i + 1);
    applicaPosto(item);
  });
}

function stratoDietro() {
  return document.getElementById("strato-dietro");
}

function idEco(figura) {
  if (!figura.dataset.eco) figura.dataset.eco = `f${Math.random().toString(36).slice(2, 8)}`;
  return figura.dataset.eco;
}

function togliEco(figura) {
  stratoDietro()?.querySelector(`[data-eco="${figura.dataset.eco}"]`)?.remove();
}

// Copia colorata dietro al testo: il testo e gli oggetti ci stanno sopra e bucano il colore.
function aggiornaEco(figura) {
  const strato = stratoDietro();
  if (!strato) return;
  if (figura.dataset.dietro !== "1") {
    togliEco(figura);
    return;
  }
  const codice = idEco(figura);
  let eco = strato.querySelector(`[data-eco="${codice}"]`);
  if (!eco) {
    eco = document.createElement("div");
    eco.className = "eco-forma";
    eco.dataset.eco = codice;
    strato.append(eco);
  }
  const cornice = figura.querySelector(".cornice-forma");
  const svg = cornice?.querySelector("svg");
  eco.style.left = figura.style.left;
  eco.style.top = figura.style.top;
  eco.style.zIndex = figura.dataset.piano || "1";
  eco.style.width = cornice?.style.width || "";
  eco.style.height = cornice?.style.height || "";
  eco.style.transform = cornice?.style.transform || "";
  if (svg) eco.replaceChildren(svg.cloneNode(true));
}

function formaDietroLibera(x, y) {
  const figure = [...document.querySelectorAll("#strato-forme .blocco-forma.dietro")].sort(
    (a, b) => (Number(b.dataset.piano) || 0) - (Number(a.dataset.piano) || 0),
  );
  const figura = figure.find((item) => puntoNellaForma(item, x, y));
  if (!figura || copreOggetto(x, y)) return null;
  return figura;
}

function puntoNellaForma(figura, x, y) {
  const cornice = figura.querySelector(".cornice-forma");
  if (!cornice) return false;
  const box = cornice.getBoundingClientRect();
  const zoom = zoomPagina() || 1;
  const metaW = (cornice.offsetWidth * zoom) / 2 + 8;
  const metaH = (cornice.offsetHeight * zoom) / 2 + 8;
  const angolo = ((Number(figura.dataset.angolo) || 0) * Math.PI) / 180;
  const dx = x - (box.left + box.width / 2);
  const dy = y - (box.top + box.height / 2);
  const localeX = dx * Math.cos(angolo) + dy * Math.sin(angolo);
  const localeY = -dx * Math.sin(angolo) + dy * Math.cos(angolo);
  return Math.abs(localeX) <= metaW && Math.abs(localeY) <= metaH;
}

// Tabella e foto coprono la forma: il clic resta su di loro. Il testo no, così la forma si può riprendere.
function copreOggetto(x, y) {
  const el = document.elementFromPoint(x, y);
  if (!el || el.closest(".blocco-forma")) return false;
  return Boolean(el.closest(".blocco-tabella, .blocco-immagine, td, th, table, img"));
}

function prossimoPiano() {
  const numeri = [...document.querySelectorAll(".blocco-forma")].map((item) => Number(item.dataset.piano) || 0);
  return Math.max(0, ...numeri) + 1;
}

function postoIniziale() {
  const strato = stratoForme();
  const zoom = zoomPagina() || 1;
  const box = strato.getBoundingClientRect();
  const selezione = window.getSelection();
  if (selezione?.rangeCount && foglio.contains(selezione.anchorNode)) {
    const rect = selezione.getRangeAt(0).getClientRects()[0];
    if (rect) {
      return {
        x: Math.round((rect.left - box.left) / zoom),
        y: Math.round((rect.top - box.top) / zoom),
      };
    }
  }
  const scrivania = document.getElementById("scrivania");
  const vista = scrivania.getBoundingClientRect();
  return {
    x: Math.round((vista.left + 36 - box.left) / zoom),
    y: Math.round((Math.max(vista.top, box.top) + 36 - box.top) / zoom),
  };
}

function centroForma(figura) {
  const strato = stratoForme();
  const zoom = zoomPagina() || 1;
  const box = strato.getBoundingClientRect();
  const dati = leggiForma(figura);
  return {
    x: box.left + (dati.x + dati.larghezza / 2) * zoom,
    y: box.top + (dati.y + dati.altezza / 2) * zoom,
  };
}

function puntoDaDati(dati, lato) {
  const rad = (dati.angolo * Math.PI) / 180;
  const scarto = lato * dati.larghezza / 2;
  return {
    x: dati.x + dati.larghezza / 2 + scarto * Math.cos(rad),
    y: dati.y + dati.altezza / 2 + scarto * Math.sin(rad),
  };
}

function puntoCarta(figura, lato) {
  return puntoDaDati(leggiForma(figura), lato);
}

function iniziaRuota(evento, presa) {
  if (evento.button !== 0) return;
  evento.preventDefault();
  const figura = presa.closest(".blocco-forma");
  if (document.activeElement?.classList?.contains("campo-angolo")) document.activeElement.blur();
  scegli(figura);
  const origine = presa.dataset.origineRuota || "alto";
  const latoPerno = origine === "fine" ? -1 : origine === "inizio" ? 1 : 0;
  const perno = latoPerno === 0 ? null : puntoCarta(figura, latoPerno);
  let mosso = false;

  function muovi(movimento) {
    if (latoPerno === 0) {
      const centro = centroForma(figura);
      const dx = movimento.clientX - centro.x;
      const dy = movimento.clientY - centro.y;
      if (Math.hypot(dx, dy) < 10) return;
      mosso = true;
      let gradi = (Math.atan2(dy, dx) * 180) / Math.PI + 90;
      if (movimento.shiftKey) gradi = Math.round(gradi / 15) * 15;
      figura.dataset.angolo = String(angoloNormale(gradi));
      applicaRotazione(figura);
      figura.classList.add("trascinata");
      return;
    }
    const strato = stratoForme();
    const zoom = zoomPagina() || 1;
    const box = strato.getBoundingClientRect();
    const px = box.left + perno.x * zoom;
    const py = box.top + perno.y * zoom;
    const dx = movimento.clientX - px;
    const dy = movimento.clientY - py;
    if (Math.hypot(dx, dy) < 10) return;
    mosso = true;
    let gradi = (Math.atan2(dy, dx) * 180) / Math.PI;
    if (latoPerno > 0) gradi += 180;
    if (movimento.shiftKey) gradi = Math.round(gradi / 15) * 15;
    gradi = angoloNormale(gradi);
    const dati = leggiForma(figura);
    const rad = (gradi * Math.PI) / 180;
    const meta = dati.larghezza / 2;
    const cx = perno.x - latoPerno * meta * Math.cos(rad);
    const cy = perno.y - latoPerno * meta * Math.sin(rad);
    figura.dataset.angolo = String(gradi);
    figura.dataset.x = String(Math.round(cx - meta));
    figura.dataset.y = String(Math.round(cy - dati.altezza / 2));
    applicaPosto(figura);
    figura.classList.add("trascinata");
  }

  function fine() {
    document.removeEventListener("mousemove", muovi);
    document.removeEventListener("mouseup", fine);
    figura.classList.remove("trascinata");
    if (mosso) segnaModifica();
  }

  document.addEventListener("mousemove", muovi);
  document.addEventListener("mouseup", fine);
}

function iniziaRidimensiona(evento, presa) {
  evento.preventDefault();
  const figura = presa.closest(".blocco-forma");
  const modo = presa.dataset.ridimensionaForma;
  const partenza = leggiForma(figura);
  const startX = evento.clientX;
  const startY = evento.clientY;
  const zoom = zoomPagina() || 1;
  const cursore = modo.startsWith("larghezza") ? "cursore-larghezza" : modo === "altezza" ? "cursore-altezza" : "cursore-immagine";
  const ancoraLato = modo === "larghezza" ? -1 : modo === "larghezza-inizio" ? 1 : 0;
  const ancora = ancoraLato === 0 ? null : puntoDaDati(partenza, ancoraLato);
  scegli(figura);

  function muovi(movimento) {
    let larghezza = partenza.larghezza;
    let altezza = partenza.altezza;
    const rad = (partenza.angolo * Math.PI) / 180;
    const dx = (movimento.clientX - startX) / zoom;
    const dy = (movimento.clientY - startY) / zoom;
    const localeX = dx * Math.cos(rad) + dy * Math.sin(rad);
    const localeY = -dx * Math.sin(rad) + dy * Math.cos(rad);
    if (modo === "larghezza-inizio") larghezza -= localeX;
    else if (modo !== "altezza") larghezza += localeX;
    if (modo !== "larghezza" && modo !== "larghezza-inizio") altezza += localeY;
    if (partenza.tipo === "cerchio") {
      const lato = modo === "altezza" ? altezza : modo.startsWith("larghezza") ? larghezza : Math.max(larghezza, altezza);
      larghezza = lato;
      altezza = lato;
    }
    const massimo = partenza.tipo === "poligono" ? 1600 : 640;
    const minimoAlto = partenza.tipo === "linea" || partenza.tipo === "freccia" ? 18 : 24;
    larghezza = limita(larghezza, partenza.larghezza, 24, massimo);
    altezza = limita(altezza, partenza.altezza, minimoAlto, massimo);
    if (partenza.tipo === "cerchio") altezza = larghezza;
    figura.dataset.larghezza = String(larghezza);
    figura.dataset.altezza = String(altezza);
    if (ancora) {
      const meta = larghezza / 2;
      const cx = ancora.x - ancoraLato * meta * Math.cos(rad);
      const cy = ancora.y - ancoraLato * meta * Math.sin(rad);
      figura.dataset.x = String(Math.round(cx - meta));
      figura.dataset.y = String(Math.round(cy - altezza / 2));
    }
    if (partenza.tipo === "poligono" && partenza.nodi.length) {
      const sx = larghezza / partenza.larghezza;
      const sy = altezza / partenza.altezza;
      figura.dataset.nodi = scriviNodi(partenza.nodi.map(([ox, oy]) => [ox * sx, oy * sy]));
    }
    applicaDisegno(figura);
    if (ancora) applicaPosto(figura);
  }

  function fine() {
    document.removeEventListener("mousemove", muovi);
    document.removeEventListener("mouseup", fine);
    document.body.classList.remove(cursore);
    segnaModifica();
  }

  document.body.classList.add(cursore);
  document.addEventListener("mousemove", muovi);
  document.addEventListener("mouseup", fine);
}

function disegna(svg, dati) {
  const { larghezza: w, altezza: h, bordo, riempimento, trasparenza, spessore: s, tipo, tratto: tipoTratto } = dati;
  const pad = s / 2 + 1;
  const pieno = riempimento === "nessuno" ? "none" : riempimento;
  svg.setAttribute("xmlns", NS);
  svg.setAttribute("width", String(w));
  svg.setAttribute("height", String(h));
  svg.setAttribute("viewBox", `0 0 ${w} ${h}`);
  svg.replaceChildren();

  if (tipo === "linea") {
    svg.append(tratto(pad, h / 2, w - pad, h / 2, bordo, s, tipoTratto));
    return;
  }
  if (tipo === "freccia") {
    const punta = Math.min(w / 3, Math.max(14, s * 5));
    const mezza = Math.max(6, punta * 0.42);
    svg.append(tratto(pad, h / 2, w - punta, h / 2, bordo, s, tipoTratto));
    const poly = document.createElementNS(NS, "polygon");
    poly.setAttribute("points", `${w - punta},${h / 2 - mezza} ${w - pad},${h / 2} ${w - punta},${h / 2 + mezza}`);
    poly.setAttribute("fill", bordo);
    svg.append(poly);
    return;
  }
  if (tipo === "poligono") {
    const poly = document.createElementNS(NS, "polygon");
    poly.setAttribute("points", dati.nodi.map(([ox, oy]) => `${w / 2 + ox},${h / 2 + oy}`).join(" "));
    poly.setAttribute("stroke-linejoin", "round");
    stileChiuso(poly, pieno, bordo, s, trasparenza, tipoTratto);
    svg.append(poly);
    return;
  }
  if (tipo === "cerchio" || tipo === "ellisse") {
    const ellisse = document.createElementNS(NS, "ellipse");
    ellisse.setAttribute("cx", String(w / 2));
    ellisse.setAttribute("cy", String(h / 2));
    ellisse.setAttribute("rx", String(Math.max(1, w / 2 - pad)));
    ellisse.setAttribute("ry", String(Math.max(1, h / 2 - pad)));
    stileChiuso(ellisse, pieno, bordo, s, trasparenza, tipoTratto);
    svg.append(ellisse);
    return;
  }
  const rect = document.createElementNS(NS, "rect");
  rect.setAttribute("x", String(pad));
  rect.setAttribute("y", String(pad));
  rect.setAttribute("width", String(Math.max(1, w - pad * 2)));
  rect.setAttribute("height", String(Math.max(1, h - pad * 2)));
  if (tipo === "arrotondato") rect.setAttribute("rx", String(Math.min(16, w / 6, h / 6)));
  stileChiuso(rect, pieno, bordo, s, trasparenza, tipoTratto);
  svg.append(rect);
}

function nodiRegolari(n, w, h) {
  const pad = 10;
  const raggiX = Math.max(8, w / 2 - pad);
  const raggiY = Math.max(8, h / 2 - pad);
  const nodi = [];
  for (let i = 0; i < n; i += 1) {
    const giro = -Math.PI / 2 + (i * 2 * Math.PI) / n;
    nodi.push([Math.cos(giro) * raggiX, Math.sin(giro) * raggiY]);
  }
  return nodi;
}

function leggiNodi(figura, w, h, n) {
  const letti = (figura.dataset.nodi || "").split(";").map((coppia) => {
    const [ox, oy] = coppia.split(",").map(Number);
    return Number.isFinite(ox) && Number.isFinite(oy) ? [ox, oy] : null;
  }).filter(Boolean);
  return letti.length === n ? letti : nodiRegolari(n, w, h);
}

function scriviNodi(nodi) {
  return nodi.map(([ox, oy]) => `${Math.round(ox * 10) / 10},${Math.round(oy * 10) / 10}`).join(";");
}

function sistemaNodiVisibili(figura, dati) {
  const cornice = figura.querySelector(".cornice-forma");
  if (!cornice) return;
  cornice.querySelectorAll(".nodo-forma").forEach((nodo) => nodo.remove());
  if (dati.tipo !== "poligono") return;
  dati.nodi.forEach(([ox, oy], indice) => {
    const nodo = document.createElement("span");
    nodo.className = "nodo-forma solo-editor";
    nodo.dataset.nodoForma = String(indice);
    nodo.title = "Trascina questo vertice dove vuoi";
    nodo.style.left = `${dati.larghezza / 2 + ox}px`;
    nodo.style.top = `${dati.altezza / 2 + oy}px`;
    cornice.append(nodo);
  });
}

function iniziaNodo(evento, nodo) {
  if (evento.button !== 0) return;
  evento.preventDefault();
  evento.stopPropagation();
  const figura = nodo.closest(".blocco-forma");
  const indice = Number(nodo.dataset.nodoForma);
  scegli(figura);

  function muovi(movimento) {
    const dati = leggiForma(figura);
    if (!dati.nodi[indice]) return;
    const centro = centroForma(figura);
    const zoom = zoomPagina() || 1;
    const dxs = (movimento.clientX - centro.x) / zoom;
    const dys = (movimento.clientY - centro.y) / zoom;
    const rad = (dati.angolo * Math.PI) / 180;
    const ox = dxs * Math.cos(rad) + dys * Math.sin(rad);
    const oy = -dxs * Math.sin(rad) + dys * Math.cos(rad);
    const nodi = dati.nodi.map((punto) => punto.slice());
    nodi[indice] = [ox, oy];
    const pad = dati.spessore / 2 + 10;
    let mezzoW = 16;
    let mezzoH = 16;
    nodi.forEach(([px, py]) => {
      mezzoW = Math.max(mezzoW, Math.abs(px) + pad);
      mezzoH = Math.max(mezzoH, Math.abs(py) + pad);
    });
    mezzoW = Math.min(800, mezzoW);
    mezzoH = Math.min(800, mezzoH);
    nodi[indice] = [
      Math.max(-mezzoW + pad, Math.min(mezzoW - pad, ox)),
      Math.max(-mezzoH + pad, Math.min(mezzoH - pad, oy)),
    ];
    const cx = dati.x + dati.larghezza / 2;
    const cy = dati.y + dati.altezza / 2;
    figura.dataset.x = String(Math.round(cx - mezzoW));
    figura.dataset.y = String(Math.round(cy - mezzoH));
    figura.dataset.larghezza = String(Math.round(mezzoW * 2));
    figura.dataset.altezza = String(Math.round(mezzoH * 2));
    figura.dataset.nodi = scriviNodi(nodi);
    applicaDisegno(figura);
    applicaPosto(figura);
    figura.classList.add("trascinata");
  }

  function fine() {
    document.removeEventListener("mousemove", muovi);
    document.removeEventListener("mouseup", fine);
    figura.classList.remove("trascinata");
    segnaModifica();
  }

  document.addEventListener("mousemove", muovi);
  document.addEventListener("mouseup", fine);
}

function tratto(x1, y1, x2, y2, bordo, spessore, tipoTratto) {
  const linea = document.createElementNS(NS, "line");
  linea.setAttribute("x1", String(x1));
  linea.setAttribute("y1", String(y1));
  linea.setAttribute("x2", String(x2));
  linea.setAttribute("y2", String(y2));
  linea.setAttribute("stroke", bordo);
  linea.setAttribute("stroke-width", String(spessore));
  linea.setAttribute("stroke-linecap", "round");
  segnaTratto(linea, spessore, tipoTratto);
  return linea;
}

function stileChiuso(nodo, pieno, bordo, spessore, trasparenza, tipoTratto) {
  nodo.setAttribute("fill", pieno);
  const opacita = 1 - (Number(trasparenza) || 0) / 100;
  if (opacita < 1) nodo.setAttribute("fill-opacity", String(opacita));
  nodo.setAttribute("stroke", bordo);
  nodo.setAttribute("stroke-width", String(spessore));
  segnaTratto(nodo, spessore, tipoTratto);
}

function segnaTratto(nodo, spessore, tipoTratto) {
  const serie = serieTratto(tipoTratto, spessore);
  if (!serie) return;
  nodo.setAttribute("stroke-dasharray", serie);
  nodo.setAttribute("stroke-linecap", "round");
}

function serieTratto(tipoTratto, spessore) {
  const t = Math.max(1, spessore);
  if (tipoTratto === "tratti-stretti") return `${t * 3} ${t * 1.6}`;
  if (tipoTratto === "tratti") return `${t * 6} ${t * 3}`;
  if (tipoTratto === "tratti-larghi") return `${t * 10} ${t * 5}`;
  if (tipoTratto === "punti-stretti") return `${t} ${t * 1.8}`;
  if (tipoTratto === "punti") return `${t} ${t * 3}`;
  if (tipoTratto === "punti-larghi") return `${t} ${t * 4.6}`;
  return "";
}

function limita(valore, base, minimo, massimo) {
  const numero = Number(valore);
  const usato = Number.isFinite(numero) ? numero : base;
  return Math.round(Math.min(massimo, Math.max(minimo, usato)));
}

function coloreValido(valore, base) {
  return /^#[0-9a-fA-F]{6}$/.test(valore || "") ? valore : base;
}

// Distanza dal bordo alto del foglio, in pixel della pagina (senza lo zoom).
function coordinataY(elemento) {
  const cornice = document.getElementById("cornice-foglio");
  const zoom = zoomPagina() || 1;
  return (elemento.getBoundingClientRect().top - cornice.getBoundingClientRect().top) / zoom;
}

// In quale pagina del foglio cade questa distanza, e quanto dista dal bordo alto di quella pagina.
function paginaDi(y) {
  const carte = [...document.querySelectorAll("#carte-pagina .carta-pagina")];
  if (!carte.length) return { indice: 0, y };
  let indice = 0;
  let inizio = 0;
  carte.forEach((carta, i) => {
    const top = parseFloat(carta.style.top) || 0;
    if (y >= top - 1) {
      indice = i;
      inizio = top;
    }
  });
  return { indice, y: y - inizio };
}

export function formeSulFoglio() {
  return [...document.querySelectorAll("#strato-forme .blocco-forma")].map((figura) => {
    const pagina = paginaDi(Number(figura.dataset.y) || 0);
    return {
      figura,
      x: Number(figura.dataset.x) || 0,
      y: pagina.y,
      pagina: pagina.indice,
      piano: Number(figura.dataset.piano) || 1,
      dietro: figura.dataset.dietro === "1",
    };
  });
}

// Segna ogni blocco della copia pulita con la pagina del foglio, così Word sa dove ancorare la forma.
export function segnaPagineEditor(vista) {
  const utili = [...foglio.children].filter((el) => !el.classList.contains("solo-editor"));
  const nodi = [...vista.children];
  if (utili.length !== nodi.length) return;
  nodi.forEach((nodo, indice) => {
    nodo.dataset.paginaEditor = String(paginaDi(coordinataY(utili[indice])).indice);
  });
}

// Mette le forme sopra le pagine dell'anteprima, nello stesso punto del foglio.
export function piazzaFormeInAnteprima(pila) {
  const pagine = [...pila.querySelectorAll(".pagina")];
  if (!pagine.length) return;
  for (const forma of formeSulFoglio()) {
    const pagina = pagine[forma.pagina] || pagine[pagine.length - 1];
    const wrap = document.createElement("figure");
    wrap.className = "forma-stampa";
    wrap.style.left = `${forma.x}px`;
    wrap.style.top = `${forma.y}px`;
    wrap.style.zIndex = forma.dietro ? "0" : String(10 + forma.piano);
    const cornice = document.createElement("div");
    cornice.className = "cornice-forma";
    const dati = leggiForma(forma.figura);
    cornice.style.width = `${dati.larghezza}px`;
    cornice.style.height = `${dati.altezza}px`;
    if (dati.angolo) cornice.style.transform = `rotate(${dati.angolo}deg)`;
    const svg = forma.figura.querySelector("svg");
    if (svg) cornice.append(svg.cloneNode(true));
    wrap.append(cornice);
    pagina.append(wrap);
  }
}
