// Tabelle con codice unico, formule e totali.

import { foglio, inserisciBlocco, ripristinaCursore, salvaCursore } from "./editor.js";
import { aggiornaRiferimenti } from "./riferimenti.js";
import { analizzaIndirizzo, calcolaTutte, lettereDaColonna, nomeRiservato, parseNumero, testoRisultato } from "./formule.js";
import { avvisa, chiedi, conferma } from "./finestre.js";
import { segnaModifica } from "./modifiche.js";
import { zoomPagina } from "./zoom-pagina.js";
import { aggiornaBordiTabella } from "./bordi-tabella.js";

let cellaAttiva = null;

export function avviaTabelle() {
  const formula = document.getElementById("formula");
  const totale = document.getElementById("btn-totale");

  let cursore = null;
  document.getElementById("btn-tabella").addEventListener("mousedown", () => {
    cursore = salvaCursore();
  });
  document.getElementById("btn-tabella").addEventListener("click", () => chiediTabella(cursore));

  foglio.addEventListener("mousedown", (evento) => {
    const tabellaCliccata = evento.target.closest(".blocco-tabella");
    if (tabellaCliccata && foglio.contains(tabellaCliccata)) scegliTabella(tabellaCliccata);
    const presaTabella = evento.target.closest("[data-ridimensiona-tabella]");
    if (presaTabella && foglio.contains(presaTabella)) {
      iniziaRidimensionaTabella(evento, presaTabella);
      return;
    }
    const gripColonna = evento.target.closest(".ridimensiona-colonna");
    if (gripColonna) {
      iniziaRidimensionaColonna(evento, gripColonna.closest("th"));
      return;
    }
    const gripRiga = evento.target.closest(".ridimensiona-riga");
    if (gripRiga) {
      iniziaRidimensionaRiga(evento, gripRiga.closest("tr"));
      return;
    }
    const spostaColonna = evento.target.closest(".testa-colonna .etichetta-asse");
    if (spostaColonna) {
      iniziaSpostaColonna(evento, spostaColonna.closest("th"));
      return;
    }
    const spostaRiga = evento.target.closest(".testa-riga .etichetta-asse");
    if (spostaRiga) {
      iniziaSpostaRiga(evento, spostaRiga.closest("tr"));
      return;
    }
    if (evento.target.closest("td[data-cella]")) return;
    if (!evento.target.closest(".blocco-tabella")) deselezionaCella();
  });

  document.addEventListener("selezione-celle", (evento) => {
    const { ancora, celle, fuoco } = evento.detail || {};
    if (!ancora || !celle?.length) return;
    impostaSelezione(ancora, celle, fuoco);
  });
  document.addEventListener("salva-formula-cella", () => {
    if (!cellaAttiva) return;
    scriviRaw(cellaAttiva, document.getElementById("formula").value);
  });

  foglio.addEventListener("click", (evento) => {
    const bottone = evento.target.closest(".blocco-tabella button[data-azione]");
    if (!bottone) return;
    const figura = bottone.closest(".blocco-tabella");
    const azione = bottone.dataset.azione;
    if (azione === "aggiungi-riga") aggiungiRiga(figura);
    if (azione === "aggiungi-colonna") aggiungiColonna(figura);
    if (azione === "togli-riga") togliRiga(figura);
    if (azione === "togli-colonna") togliColonna(figura);
    if (azione === "riga-totali") aggiungiRigaTotali(figura);
    if (azione === "elimina-tabella") eliminaTabella(figura);
    if (azione === "chiudi-barra") chiudiBarreTabella();
  });

  foglio.addEventListener("change", (evento) => {
    if (!evento.target.classList.contains("campo-id")) return;
    const figura = evento.target.closest(".blocco-tabella");
    if (!rinomina(figura, evento.target.value)) {
      evento.target.value = figura.dataset.id;
    }
  });

  foglio.addEventListener("input", (evento) => {
    if (evento.target.classList.contains("campo-titolo")) {
      evento.target.setAttribute("value", evento.target.value);
      segnaModifica();
    }
  });

  formula.addEventListener("keydown", (evento) => {
    if (!cellaAttiva) return;
    if (evento.key === "Enter") {
      evento.preventDefault();
      scriviRaw(cellaAttiva, formula.value);
      sposta(evento.shiftKey ? -1 : 1, 0);
    } else if (evento.key === "Tab") {
      evento.preventDefault();
      scriviRaw(cellaAttiva, formula.value);
      sposta(0, evento.shiftKey ? -1 : 1);
    } else if (evento.key === "Escape") {
      evento.preventDefault();
      formula.value = cellaAttiva.dataset.raw || "";
      formula.blur();
    }
  });

  formula.addEventListener("blur", () => {
    if (!cellaAttiva) return;
    scriviRaw(cellaAttiva, formula.value);
  });

  foglio.addEventListener("change", (evento) => {
    if (!evento.target.classList.contains("campo-bordi")) return;
    impostaBordiTabella(evento.target.closest(".blocco-tabella"), evento.target.value);
  });

  foglio.addEventListener("change", (evento) => {
    if (!evento.target.classList.contains("campo-posto")) return;
    impostaPostoTabella(evento.target.closest(".blocco-tabella"), evento.target.value);
  });

  foglio.addEventListener("contextmenu", (evento) => {
    const angolo = evento.target.closest(".angolo-tabella");
    if (!angolo || !foglio.contains(angolo)) return;
    evento.preventDefault();
    mostraBarraTabella(angolo.closest(".blocco-tabella"), angolo);
  });
  document.addEventListener("mousedown", (evento) => {
    if (evento.target.closest(".tabella-comandi")) return;
    chiudiBarreTabella();
    if (!evento.target.closest(".blocco-tabella")) togliSceltaTabelle();
  });
  document.addEventListener("keydown", (evento) => {
    if (evento.key !== "Escape") return;
    chiudiBarreTabella();
    togliSceltaTabelle();
  });

  totale.addEventListener("mousedown", (evento) => evento.preventDefault());
  totale.addEventListener("click", () => totaleColonnaDaCella(cellaAttiva));
}

export function totaleColonnaDaCella(td) {
  if (!td) return;
  const indirizzo = analizzaIndirizzo(td.dataset.cella);
  if (!indirizzo || indirizzo.riga < 2) {
    avvisa("Il totale somma le celle sopra: scegli una cella dalla seconda riga in giù.");
    return;
  }
  if (td !== cellaAttiva) impostaSelezione(td, [td], false);
  let testo = "";
  if (haTotaleColonna(td)) {
    delete td.dataset.totale;
  } else {
    const lettera = lettereDaColonna(indirizzo.colonna);
    testo = `=SOMMA(${lettera}1:${lettera}${indirizzo.riga - 1})`;
  }
  document.getElementById("formula").value = testo;
  scriviRaw(td, testo);
}

export function haTotaleColonna(td) {
  return Boolean(td) && sembraTotale(td);
}

export function ricalcolaTutte() {
  const grezze = {};
  document.querySelectorAll(".blocco-tabella").forEach((figura) => {
    const id = figura.dataset.id;
    figura.querySelectorAll("td[data-cella]").forEach((td) => {
      grezze[`${id}.${td.dataset.cella}`] = td.dataset.raw ?? "";
    });
  });
  const risultati = calcolaTutte(grezze);
  document.querySelectorAll(".blocco-tabella").forEach((figura) => {
    togliPulsantiRigaColonna(figura);
    assicuraCampoBordi(figura);
    assicuraPosizioneTabella(figura);
    assicuraBarraTabella(figura);
    assicuraCorniceTabella(figura);
    rigaTotaleDi(figura);
    assicuraManiglie(figura);
  });
  document.querySelectorAll(".blocco-tabella td[data-cella]").forEach((td) => {
    const id = td.closest(".blocco-tabella").dataset.id;
    applicaAspetto(td, risultati[`${id}.${td.dataset.cella}`]);
  });
  document.querySelectorAll(".blocco-tabella").forEach(aggiornaBordiTabella);
  aggiornaRiferimenti();
  document.dispatchEvent(new Event("tabelle-ricalcolate"));
}

function applicaAspetto(td, risultato) {
  const tipo = td.dataset.tipo || "auto";
  const errore = Boolean(risultato?.errore);
  td.classList.toggle("cella-errore", errore);
  td.classList.toggle("cella-formula", (td.dataset.raw || "").trim().startsWith("="));
  td.classList.remove("cella-euro");

  if (errore) {
    td.textContent = risultato.errore;
    td.classList.remove("cella-numero");
  } else if (tipo === "testo") {
    td.textContent = testoRisultato(risultato);
    td.classList.remove("cella-numero");
  } else if (tipo === "euro" || tipo === "numero") {
    const numero = numeroVisibile(risultato, td.dataset.raw);
    if (numero == null) {
      td.textContent = testoRisultato(risultato);
      td.classList.remove("cella-numero");
    } else {
      td.textContent = tipo === "euro" ? formattaEuro(numero, decimaliDi(td)) : formattaNumero(numero, decimaliDi(td));
      td.classList.add("cella-numero");
      if (tipo === "euro") td.classList.add("cella-euro");
    }
  } else {
    const decimali = decimaliDi(td);
    const arrotondato = decimali == null ? null : numeroVisibile(risultato, td.dataset.raw);
    td.textContent = arrotondato == null ? testoRisultato(risultato) : formattaNumero(arrotondato, decimali);
    const numero = !risultato?.errore && (risultato?.daFormula ? typeof risultato.numero === "number" && !risultato.testo : parseNumero(td.dataset.raw) != null);
    td.classList.toggle("cella-numero", Boolean(numero) && (td.dataset.raw || "").trim() !== "");
  }
  applicaBordoCella(td);
  applicaAllineamento(td);
  applicaStileTesto(td);
}

function applicaAllineamento(td) {
  td.classList.remove("allinea-sinistra", "allinea-centro", "allinea-destra");
  if (td.dataset.allinea) td.classList.add(`allinea-${td.dataset.allinea}`);
}

const CHIAVI_STILE = ["sfondo", "colore", "font", "dimensione", "interlinea", "allinea", "grassetto", "corsivo", "sottolineato", "barrato"];

export function impostaStileCella(td, campo, valore) {
  if (!td || !CHIAVI_STILE.includes(campo)) return;
  if (valore) td.dataset[campo] = valore;
  else delete td.dataset[campo];
  applicaAllineamento(td);
  applicaStileTesto(td);
  segnaModifica();
}

export function impostaTipoCelle(celle, valore) {
  celle.forEach((td) => {
    if (!valore || valore === "auto") delete td.dataset.tipo;
    else td.dataset.tipo = valore;
  });
  ricalcolaTutte();
  segnaModifica();
}

export function impostaDecimaliCelle(celle, valore) {
  celle.forEach((td) => {
    if (valore === "" || valore == null) delete td.dataset.decimali;
    else td.dataset.decimali = valore;
  });
  ricalcolaTutte();
  segnaModifica();
}

export function impostaBordoCelle(celle, valore) {
  celle.forEach((td) => {
    if (!valore) delete td.dataset.bordo;
    else td.dataset.bordo = valore;
    applicaBordoCella(td);
  });
  new Set([...celle].map((td) => td.closest(".blocco-tabella"))).forEach(aggiornaBordiTabella);
  segnaModifica();
}

export function applicaFormatoAllaColonna() {
  applicaAllaColonna();
}

function applicaStileTesto(td) {
  td.style.backgroundColor = td.dataset.sfondo || "";
  td.style.color = td.dataset.colore || "";
  td.style.fontFamily = td.dataset.font || "";
  td.style.fontSize = td.dataset.dimensione ? `${td.dataset.dimensione}pt` : "";
  td.style.lineHeight = td.dataset.interlinea || "";
  td.style.fontWeight = td.dataset.grassetto ? "700" : "";
  td.style.fontStyle = td.dataset.corsivo ? "italic" : "";
  const tratti = [];
  if (td.dataset.sottolineato) tratti.push("underline");
  if (td.dataset.barrato) tratti.push("line-through");
  td.style.textDecoration = tratti.join(" ");
}

function copiaChiave(da, a, chiave) {
  if (da.dataset[chiave]) a.dataset[chiave] = da.dataset[chiave];
  else delete a.dataset[chiave];
}

function numeroVisibile(risultato, raw) {
  if (!risultato || risultato.errore) return null;
  if (typeof risultato.numero === "number" && risultato.testo === "") return risultato.numero;
  const testo = risultato.daFormula ? risultato.testo || "" : raw ?? "";
  return parseNumero(String(testo).trim());
}

function decimaliDi(td) {
  const valore = td.dataset.decimali;
  if (valore == null || valore === "") return null;
  const numero = Number(valore);
  return Number.isInteger(numero) && numero >= 0 && numero <= 6 ? numero : null;
}

function formattaEuro(numero, decimali) {
  const valore = numero === 0 ? 0 : numero;
  const cifre = decimali == null ? {} : { minimumFractionDigits: decimali, maximumFractionDigits: decimali };
  return valore.toLocaleString("it-IT", { style: "currency", currency: "EUR", ...cifre });
}

function formattaNumero(numero, decimali) {
  const valore = numero === 0 ? 0 : numero;
  if (decimali == null) return valore.toLocaleString("it-IT", { maximumFractionDigits: 2 });
  return valore.toLocaleString("it-IT", { minimumFractionDigits: decimali, maximumFractionDigits: decimali });
}

function applicaBordoCella(td) {
  td.classList.remove("bordo-tutti", "bordo-sotto", "bordo-nessuno");
  if (td.dataset.bordo) td.classList.add(`bordo-${td.dataset.bordo}`);
}

export function messaggioCodice(nuovo, ignora) {
  const codice = nuovo.trim();
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(codice)) {
    return "Il codice può contenere lettere, numeri e _. Deve iniziare con una lettera. Esempio: Tabella1.";
  }
  if (/^[A-Za-z]{1,3}\d+$/.test(codice)) return "Il codice non può essere una cella, per esempio A1 o B12. Usa un nome come Tabella1.";
  if (nomeRiservato(codice)) return "Questo nome è una formula (SOMMA, MEDIA, SE...). Scegline un altro.";
  const duplicato = [...document.querySelectorAll(".blocco-tabella")].some((tab) => tab !== ignora && tab.dataset.id.toLowerCase() === codice.toLowerCase());
  if (duplicato) return "Esiste già una tabella con questo codice.";
  return "";
}

function prossimoCodice() {
  const usati = new Set([...document.querySelectorAll(".blocco-tabella")].map((tab) => tab.dataset.id.toLowerCase()));
  let numero = 1;
  while (usati.has(`tabella${numero}`)) numero += 1;
  return `Tabella${numero}`;
}

async function chiediTabella(cursore) {
  const proposto = prossimoCodice();
  const dati = await chiedi({
    titolo: "Nuova tabella",
    testo: "Il codice serve per richiamare una cella nel testo, per esempio =Tabella1.C2.",
    conferma: "Inserisci",
    campi: [
      { nome: "codice", etichetta: "Codice unico", valore: proposto },
      { nome: "titolo", etichetta: "Titolo (facoltativo)", valore: "" },
      { nome: "righe", etichetta: "Righe", tipo: "number", valore: "4", min: "1", max: "40" },
      { nome: "colonne", etichetta: "Colonne", tipo: "number", valore: "3", min: "1", max: "12" },
    ],
    controlla(datiScritti) {
      const errore = messaggioCodice(datiScritti.codice, null);
      if (errore) return errore;
      const righe = Number(datiScritti.righe);
      const colonne = Number(datiScritti.colonne);
      if (!Number.isInteger(righe) || righe < 1 || righe > 40) return "Le righe devono essere un numero da 1 a 40.";
      if (!Number.isInteger(colonne) || colonne < 1 || colonne > 12) return "Le colonne devono essere un numero da 1 a 12.";
      return "";
    },
  });
  if (!dati) return;
  ripristinaCursore(cursore);
  const tabellaNuova = creaTabella(dati.codice.trim(), dati.titolo.trim(), Number(dati.righe), Number(dati.colonne));
  inserisciBlocco(tabellaNuova);
  scegliTabella(tabellaNuova);
  ricalcolaTutte();
  segnaModifica();
}

function creaTabella(codice, titolo, righe, colonne) {
  const figura = document.createElement("figure");
  figura.className = "blocco-tabella bordi-tutti";
  figura.contentEditable = "false";
  figura.dataset.id = codice;
  figura.dataset.bordi = "tutti";

  const comandi = document.createElement("div");
  comandi.className = "tabella-comandi solo-editor";
  comandi.append(
    etichettaInput("Codice", "campo-id", codice),
    etichettaInput("Titolo", "campo-titolo", titolo),
    etichettaBordi("tutti"),
    bottone("riga-totali", "Riga totali"),
    bottone("elimina-tabella", "Elimina"),
  );

  const table = document.createElement("table");
  const thead = document.createElement("thead");
  const testa = document.createElement("tr");
  const angolo = document.createElement("th");
  angolo.className = "solo-editor angolo-tabella";
  angolo.title = "Tasto destro: codice, titolo, bordi e posizione nel foglio";
  testa.append(angolo);
  for (let colonna = 1; colonna <= colonne; colonna += 1) {
    const th = document.createElement("th");
    th.className = "solo-editor";
    th.textContent = lettereDaColonna(colonna);
    testa.append(th);
  }
  thead.append(testa);

  const tbody = document.createElement("tbody");
  for (let riga = 1; riga <= righe; riga += 1) tbody.append(creaRiga(riga, colonne));
  table.append(thead, tbody);
  figura.append(comandi, table);
  return figura;
}

function etichettaInput(testo, classe, valore) {
  const label = document.createElement("label");
  label.append(document.createTextNode(`${testo} `));
  const input = document.createElement("input");
  input.className = classe;
  input.value = valore;
  input.setAttribute("value", valore);
  input.spellcheck = false;
  label.append(input);
  return label;
}

function etichettaBordi(valore) {
  const label = document.createElement("label");
  label.append(document.createTextNode("Bordi "));
  const select = document.createElement("select");
  select.className = "campo-bordi";
  [
    ["tutti", "Tutti"],
    ["cornice", "Solo cornice"],
    ["orizzontali", "Solo orizzontali"],
    ["nessuno", "Nessuno"],
  ].forEach(([chiave, testo]) => {
    const opzione = document.createElement("option");
    opzione.value = chiave;
    opzione.textContent = testo;
    if (chiave === valore) opzione.selected = true;
    select.append(opzione);
  });
  label.append(select);
  return label;
}

function assicuraCampoBordi(figura) {
  const valore = figura.dataset.bordi || "tutti";
  if (!figura.dataset.bordi) figura.dataset.bordi = valore;
  figura.classList.remove("bordi-tutti", "bordi-cornice", "bordi-orizzontali", "bordi-nessuno");
  figura.classList.add(`bordi-${valore}`);
  if (figura.querySelector(".campo-bordi")) return;
  const comandi = figura.querySelector(".tabella-comandi");
  if (comandi) comandi.append(etichettaBordi(valore));
}

function etichettaPosto(valore) {
  const label = document.createElement("label");
  label.append(document.createTextNode("Nel foglio "));
  const select = document.createElement("select");
  select.className = "campo-posto";
  select.title = "Sinistra, centro o destra della pagina. Serve dopo aver rimpicciolito la tabella.";
  [
    ["sinistra", "Sinistra"],
    ["centro", "Centro"],
    ["destra", "Destra"],
  ].forEach(([chiave, testo]) => {
    const opzione = document.createElement("option");
    opzione.value = chiave;
    opzione.textContent = testo;
    if (chiave === valore) opzione.selected = true;
    select.append(opzione);
  });
  label.append(select);
  return label;
}

function assicuraPosizioneTabella(figura) {
  const valore = ["sinistra", "centro", "destra"].includes(figura.dataset.posto) ? figura.dataset.posto : "sinistra";
  if (!figura.querySelector(".campo-posto")) {
    figura.querySelector(".tabella-comandi")?.append(etichettaPosto(valore));
  }
  const select = figura.querySelector(".campo-posto");
  if (select) select.value = valore;
  applicaPostoTabella(figura);
}

function impostaPostoTabella(figura, valore) {
  if (!figura) return;
  const scelto = ["sinistra", "centro", "destra"].includes(valore) ? valore : "sinistra";
  if (scelto === "sinistra") delete figura.dataset.posto;
  else figura.dataset.posto = scelto;
  const select = figura.querySelector(".campo-posto");
  if (select) select.value = scelto;
  applicaPostoTabella(figura);
  segnaModifica();
}

function applicaPostoTabella(figura) {
  const posto = figura.dataset.posto || "sinistra";
  const misura = figura.querySelector(".misura-tabella");
  const cornice = figura.querySelector(".cornice-tabella");
  for (const el of [misura, cornice]) {
    if (!el) continue;
    el.classList.remove("posto-centro", "posto-destra");
  }
  if (!misura || posto === "sinistra") return;
  misura.classList.add(posto === "centro" ? "posto-centro" : "posto-destra");
}

function impostaBordiTabella(figura, valore) {
  if (!figura) return;
  const scelto = ["tutti", "cornice", "orizzontali", "nessuno"].includes(valore) ? valore : "tutti";
  figura.dataset.bordi = scelto;
  // Come in Word: la scelta per tutta la tabella cancella quelle fatte prima sulle singole celle.
  figura.querySelectorAll("td[data-bordo]").forEach((td) => {
    delete td.dataset.bordo;
    applicaBordoCella(td);
  });
  figura.classList.remove("bordi-tutti", "bordi-cornice", "bordi-orizzontali", "bordi-nessuno");
  figura.classList.add(`bordi-${scelto}`);
  const select = figura.querySelector(".campo-bordi");
  if (select) {
    select.value = scelto;
    [...select.options].forEach((opzione) => opzione.toggleAttribute("selected", opzione.value === scelto));
  }
  aggiornaBordiTabella(figura);
  segnaModifica();
}

function applicaAllaColonna() {
  if (!cellaAttiva) return;
  const indirizzo = analizzaIndirizzo(cellaAttiva.dataset.cella);
  const figura = cellaAttiva.closest(".blocco-tabella");
  if (!indirizzo || !figura) return;
  figura.querySelectorAll("tbody td[data-cella]").forEach((td) => {
    const altra = analizzaIndirizzo(td.dataset.cella);
    if (!altra || altra.colonna !== indirizzo.colonna) return;
    copiaChiave(cellaAttiva, td, "tipo");
    copiaChiave(cellaAttiva, td, "decimali");
    copiaChiave(cellaAttiva, td, "bordo");
    CHIAVI_STILE.forEach((chiave) => copiaChiave(cellaAttiva, td, chiave));
  });
  ricalcolaTutte();
  segnaModifica();
}

function bottone(azione, testo) {
  const button = document.createElement("button");
  button.type = "button";
  button.dataset.azione = azione;
  button.textContent = testo;
  return button;
}

function creaRiga(numero, colonne) {
  const tr = document.createElement("tr");
  const th = document.createElement("th");
  th.className = "solo-editor";
  th.textContent = String(numero);
  tr.append(th);
  for (let colonna = 1; colonna <= colonne; colonna += 1) tr.append(creaCella(lettereDaColonna(colonna) + numero));
  return tr;
}

function creaCella(indirizzo) {
  const td = document.createElement("td");
  td.dataset.cella = indirizzo;
  td.dataset.raw = "";
  return td;
}

function cellaUtile(figura, cella) {
  if (cella && figura.contains(cella)) return cella;
  if (cellaAttiva && figura.contains(cellaAttiva)) return cellaAttiva;
  return null;
}

function aggiungiRiga(figura, cella) {
  const righe = [...figura.querySelectorAll("tbody tr")];
  if (righe.length >= 40) {
    avvisa("Una tabella può avere al massimo 40 righe.");
    return;
  }
  const totale = rigaTotaleDi(figura);
  const limite = totale ? righe.indexOf(totale) : righe.length;
  let indice = limite;
  const riferimento = cellaUtile(figura, cella);
  if (riferimento) {
    const corrente = riferimento.closest("tr");
    const pos = righe.indexOf(corrente);
    if (corrente !== totale && pos >= 0) indice = Math.min(pos + 1, limite);
  }
  const dalla = indice + 1;
  if (unioneAttraversata(figura, dalla)) {
    avvisa("Qui la nuova riga taglierebbe una cella unita. Separala prima, oppure inserisci la riga sopra o sotto quel blocco.");
    return;
  }
  spostaRighe(figura, (riga) => (riga >= dalla ? riga + 1 : riga));
  const colonne = figura.querySelectorAll("thead th").length - 1;
  const nuova = creaRiga(dalla, colonne);
  const tbody = figura.querySelector("tbody");
  const dopo = tbody.querySelectorAll("tr")[indice];
  if (dopo) tbody.insertBefore(nuova, dopo);
  else tbody.append(nuova);
  rinumeraIntestazioni(figura);
  aggiornaIntervalloTotali(figura);
  ricalcolaTutte();
  if (cellaAttiva && figura.contains(cellaAttiva)) {
    document.getElementById("formula").value = cellaAttiva.dataset.raw || "";
    aggiornaEtichetta();
  }
  segnaModifica();
}

function aggiungiColonna(figura, cella) {
  const colonne = figura.querySelectorAll("thead th").length - 1;
  if (colonne >= 12) {
    avvisa("Una tabella può avere al massimo 12 colonne.");
    return;
  }
  const riferimento = cellaUtile(figura, cella);
  const dopo = riferimento ? (estensioneCella(riferimento)?.c2 || colonne) : colonne;
  if (unioneAttraversataColonna(figura, dopo)) {
    avvisa("Qui la nuova colonna taglierebbe una cella unita. Separala prima.");
    return;
  }
  spostaColonne(figura, (colonna) => (colonna > dopo ? colonna + 1 : colonna));
  const lettera = lettereDaColonna(dopo + 1);
  const th = document.createElement("th");
  th.className = "solo-editor";
  th.textContent = lettera;
  figura.querySelector("thead tr").children[dopo].after(th);
  figura.querySelectorAll("tbody tr").forEach((tr) => {
    inserisciCellaNellaColonna(tr, dopo + 1, creaCella(lettera + indiceRiga(tr)));
  });
  const gruppo = figura.querySelector("colgroup");
  const colDopo = gruppo?.children[dopo];
  if (colDopo) colDopo.after(document.createElement("col"));
  aggiornaIntervalloTotali(figura);
  ricalcolaTutte();
  aggiornaFormulaAttiva(figura);
  segnaModifica();
}

function inserisciCellaNellaColonna(tr, colonna, td) {
  for (const cella of tr.querySelectorAll(":scope > td")) {
    const ind = analizzaIndirizzo(cella.dataset.cella);
    if (ind && ind.colonna >= colonna) {
      cella.before(td);
      return;
    }
  }
  tr.append(td);
}

function togliRiga(figura, cella) {
  const righe = [...figura.querySelectorAll("tbody tr")];
  const totale = rigaTotaleDi(figura);
  const dati = righe.filter((riga) => riga !== totale);
  if (dati.length <= 1) {
    avvisa(totale
      ? "Sopra i totali deve restare almeno una riga. Per togliere i totali, apri Riga totali e non scegliere nessuna colonna."
      : "La tabella deve avere almeno una riga.");
    return;
  }
  let vittima = dati[dati.length - 1];
  const riferimento = cellaUtile(figura, cella);
  if (riferimento) {
    const corrente = riferimento.closest("tr");
    if (corrente === totale) {
      avvisa("La riga dei totali resta in fondo. Per toglierla, apri Riga totali e non scegliere nessuna colonna.");
      return;
    }
    if (corrente) vittima = corrente;
  }
  const numero = righe.indexOf(vittima) + 1;
  if (rigaDentroUnione(figura, numero)) {
    avvisa("Questa riga fa parte di una cella unita. Separala prima di toglierla.");
    return;
  }
  if (cellaAttiva && vittima.contains(cellaAttiva)) deselezionaCella();
  vittima.remove();
  togliParcheggioRiga(figura, numero);
  spostaRighe(figura, (riga) => {
    if (riga === numero) return null;
    if (riga > numero) return riga - 1;
    return riga;
  });
  rinumeraIntestazioni(figura);
  aggiornaIntervalloTotali(figura);
  ricalcolaTutte();
  segnaModifica();
}

function togliColonna(figura, cella) {
  const teste = [...figura.querySelectorAll("thead th")];
  if (teste.length <= 2) {
    avvisa("La tabella deve avere almeno una colonna.");
    return;
  }
  const riferimento = cellaUtile(figura, cella);
  const numero = riferimento ? (estensioneCella(riferimento)?.c1 || teste.length - 1) : teste.length - 1;
  if (colonnaDentroUnione(figura, numero)) {
    avvisa("Questa colonna fa parte di una cella unita. Separala prima di toglierla.");
    return;
  }
  if (cellaAttiva && figura.contains(cellaAttiva) && estensioneCella(cellaAttiva)?.c1 === numero) deselezionaCella();
  spostaColonne(figura, (colonna) => {
    if (colonna === numero) return null;
    if (colonna > numero) return colonna - 1;
    return colonna;
  });
  teste[numero]?.remove();
  figura.querySelectorAll("colgroup col")[numero]?.remove();
  aggiornaIntervalloTotali(figura);
  ricalcolaTutte();
  aggiornaFormulaAttiva(figura);
  segnaModifica();
}

export function aggiungiRigaDaCella(td) {
  const figura = td?.closest(".blocco-tabella");
  if (figura) aggiungiRiga(figura, td);
}

export function togliRigaDaCella(td) {
  const figura = td?.closest(".blocco-tabella");
  if (figura) togliRiga(figura, td);
}

export function aggiungiColonnaDaCella(td) {
  const figura = td?.closest(".blocco-tabella");
  if (figura) aggiungiColonna(figura, td);
}

export function togliColonnaDaCella(td) {
  const figura = td?.closest(".blocco-tabella");
  if (figura) togliColonna(figura, td);
}

async function aggiungiRigaTotali(figura) {
  const totale = rigaTotaleDi(figura);
  const colonne = figura.querySelectorAll("thead th").length - 1;
  const opzioni = [];
  for (let colonna = 1; colonna <= colonne; colonna += 1) {
    const lettera = lettereDaColonna(colonna);
    const gia = Boolean(totale?.querySelector(`td[data-totale][data-cella="${lettera}${indiceRiga(totale)}"]`));
    opzioni.push({
      valore: String(colonna),
      testo: `Colonna ${lettera}`,
      scelto: totale ? gia : colonnaHaNumeri(figura, colonna),
    });
  }
  const dati = await chiedi({
    titolo: "Riga totali",
    testo: "Scegli solo le colonne da sommare. Il totale resta nell’ultima riga. Se non scegli nulla, la riga dei totali viene tolta.",
    conferma: "Applica",
    campi: [{ nome: "colonne", tipo: "caselle", etichetta: "Colonne", opzioni }],
  });
  if (!dati) return;
  const scelte = new Set(dati.colonne.map((valore) => Number(valore)));
  applicaScelteTotali(figura, scelte);
}

function applicaScelteTotali(figura, scelte) {
  let riga = rigaTotaleDi(figura);
  if (!scelte.size) {
    if (!riga) return;
    if (cellaAttiva && riga.contains(cellaAttiva)) deselezionaCella();
    togliParcheggioRiga(figura, indiceRiga(riga));
    riga.remove();
    rinumeraIntestazioni(figura);
    ricalcolaTutte();
    segnaModifica();
    return;
  }
  if (!riga) {
    const esistenti = figura.querySelectorAll("tbody tr").length;
    if (esistenti >= 40) {
      avvisa("Una tabella può avere al massimo 40 righe.");
      return;
    }
    const colonne = figura.querySelectorAll("thead th").length - 1;
    riga = creaRiga(esistenti + 1, colonne);
    riga.dataset.totale = "1";
    figura.querySelector("tbody").append(riga);
  }
  riga.dataset.totale = "1";
  const numero = indiceRiga(riga);
  let etichettaMessa = false;
  [...riga.querySelectorAll("td")].forEach((td, indice) => {
    const colonna = estensioneCella(td)?.c1 || indice + 1;
    if (scelte.has(colonna)) {
      const lettera = lettereDaColonna(colonna);
      td.dataset.totale = "1";
      td.dataset.raw = `=SOMMA(${lettera}1:${lettera}${numero - 1})`;
      copiaStileDallaColonna(figura, td, colonna, numero - 1);
      return;
    }
    const eraTotale = td.dataset.totale === "1";
    delete td.dataset.totale;
    if (eraTotale) {
      delete td.dataset.tipo;
      delete td.dataset.decimali;
      CHIAVI_STILE.forEach((chiave) => delete td.dataset[chiave]);
      td.dataset.raw = etichettaMessa ? "" : "Totale";
      etichettaMessa = true;
      return;
    }
    if (!etichettaMessa && !(td.dataset.raw || "").trim()) {
      td.dataset.raw = "Totale";
      etichettaMessa = true;
    }
  });
  ricalcolaTutte();
  segnaModifica();
}

function rigaTotaleDi(figura) {
  const segnata = figura.querySelector("tbody tr[data-totale]");
  if (segnata) return segnata;
  const righe = [...figura.querySelectorAll("tbody tr")];
  const ultima = righe[righe.length - 1];
  if (!ultima) return null;
  const celle = [...ultima.querySelectorAll("td")].filter(sembraTotale);
  if (!celle.length) return null;
  ultima.dataset.totale = "1";
  celle.forEach((td) => {
    td.dataset.totale = "1";
  });
  return ultima;
}

function sembraTotale(td) {
  const ind = analizzaIndirizzo(td.dataset.cella);
  if (!ind) return false;
  const lettera = lettereDaColonna(ind.colonna);
  const raw = (td.dataset.raw || "").replace(/\s/g, "");
  return new RegExp(`^=SOMMA\\(${lettera}\\d+:${lettera}\\d+\\)$`, "i").test(raw);
}

function colonnaHaNumeri(figura, colonna) {
  return [...figura.querySelectorAll("tbody td")].some((td) => {
    const ind = analizzaIndirizzo(td.dataset.cella);
    if (!ind || ind.colonna !== colonna || td.closest("tr")?.dataset.totale) return false;
    const raw = (td.dataset.raw || "").trim();
    return raw.startsWith("=") || parseNumero(raw) != null;
  });
}

function copiaStileDallaColonna(figura, td, colonna, finoRiga) {
  const lettera = lettereDaColonna(colonna);
  let tipo = "";
  let allinea = "";
  let misto = false;
  for (let riga = 1; riga <= finoRiga; riga += 1) {
    const sopra = figura.querySelector(`td[data-cella="${lettera}${riga}"]`);
    if (sopra?.dataset.tipo === "euro") tipo = "euro";
    else if (!tipo && sopra?.dataset.tipo === "numero") tipo = "numero";
    const scelto = sopra?.dataset.allinea || "";
    if (!scelto) continue;
    if (!allinea) allinea = scelto;
    else if (allinea !== scelto) misto = true;
  }
  if (tipo) td.dataset.tipo = tipo;
  else delete td.dataset.tipo;
  if (allinea && !misto) td.dataset.allinea = allinea;
  else delete td.dataset.allinea;
  ["decimali", "sfondo", "colore", "font", "dimensione", "interlinea", "grassetto", "corsivo", "sottolineato", "barrato"].forEach((chiave) => {
    const condiviso = stileCondiviso(figura, colonna, finoRiga, chiave);
    if (condiviso) td.dataset[chiave] = condiviso;
    else delete td.dataset[chiave];
  });
}

function stileCondiviso(figura, colonna, finoRiga, chiave) {
  let valore = null;
  const lettera = lettereDaColonna(colonna);
  for (let riga = 1; riga <= finoRiga; riga += 1) {
    const sopra = figura.querySelector(`td[data-cella="${lettera}${riga}"]`);
    const attuale = sopra?.dataset[chiave] || "";
    if (valore == null) valore = attuale;
    else if (valore !== attuale) return "";
  }
  return valore || "";
}

function aggiornaIntervalloTotali(figura) {
  const riga = figura.querySelector("tbody tr[data-totale]");
  if (!riga) return;
  const numero = indiceRiga(riga);
  riga.querySelectorAll("td[data-totale]").forEach((td) => {
    const ind = analizzaIndirizzo(td.dataset.cella);
    if (!ind || numero < 2) return;
    const lettera = lettereDaColonna(ind.colonna);
    td.dataset.raw = `=SOMMA(${lettera}1:${lettera}${numero - 1})`;
  });
}

function indiceRiga(tr) {
  return [...tr.parentElement.children].indexOf(tr) + 1;
}

function rinumeraIntestazioni(figura) {
  figura.querySelectorAll("tbody tr").forEach((tr, indice) => {
    const th = tr.querySelector("th");
    if (!th) return;
    const etichetta = th.querySelector(".etichetta-asse");
    if (etichetta) etichetta.textContent = String(indice + 1);
    else th.textContent = String(indice + 1);
  });
}

function spostaRighe(figura, mappa) {
  const id = figura.dataset.id;
  document.querySelectorAll(".blocco-tabella td[data-raw]").forEach((td) => {
    const raw = td.dataset.raw || "";
    if (!raw.trim().startsWith("=")) return;
    td.dataset.raw = sostituisciIndirizzi(raw, id, td.closest(".blocco-tabella") === figura, mappa);
  });
  document.querySelectorAll(".riferimento").forEach((span) => {
    if (span.dataset.tabella !== id) return;
    const ind = analizzaIndirizzo(span.dataset.cella);
    if (!ind) return;
    const nuova = mappa(ind.riga);
    span.dataset.cella = nuova == null ? "ZZ99" : lettereDaColonna(ind.colonna) + nuova;
  });
  const celle = [...figura.querySelectorAll("tbody td[data-cella], .parcheggio-celle td[data-cella]")]
    .map((td) => ({ td, ind: analizzaIndirizzo(td.dataset.cella) }))
    .filter((voce) => voce.ind && mappa(voce.ind.riga) !== voce.ind.riga);
  const versoIlBasso = celle.some((voce) => mappa(voce.ind.riga) > voce.ind.riga);
  celle.sort((a, b) => (versoIlBasso ? b.ind.riga - a.ind.riga : a.ind.riga - b.ind.riga));
  celle.forEach(({ td, ind }) => {
    const nuova = mappa(ind.riga);
    if (nuova == null) return;
    td.dataset.cella = lettereDaColonna(ind.colonna) + nuova;
  });
}

function spostaColonne(figura, mappa) {
  const id = figura.dataset.id;
  document.querySelectorAll(".blocco-tabella td[data-raw]").forEach((td) => {
    const raw = td.dataset.raw || "";
    if (!raw.trim().startsWith("=")) return;
    td.dataset.raw = sostituisciColonne(raw, id, td.closest(".blocco-tabella") === figura, mappa);
  });
  document.querySelectorAll(".riferimento").forEach((span) => {
    if (span.dataset.tabella !== id) return;
    const ind = analizzaIndirizzo(span.dataset.cella);
    if (!ind) return;
    const nuova = mappa(ind.colonna);
    span.dataset.cella = nuova == null ? "ZZ99" : lettereDaColonna(nuova) + ind.riga;
  });
  const celle = [...figura.querySelectorAll("tbody td[data-cella], .parcheggio-celle td[data-cella]")]
    .map((td) => ({ td, ind: analizzaIndirizzo(td.dataset.cella) }))
    .filter((voce) => voce.ind && mappa(voce.ind.colonna) !== voce.ind.colonna);
  const versoDestra = celle.some((voce) => {
    const nuova = mappa(voce.ind.colonna);
    return nuova != null && nuova > voce.ind.colonna;
  });
  celle.sort((a, b) => (versoDestra ? b.ind.colonna - a.ind.colonna : a.ind.colonna - b.ind.colonna));
  celle.forEach(({ td, ind }) => {
    const nuova = mappa(ind.colonna);
    if (nuova == null) {
      td.remove();
      return;
    }
    td.dataset.cella = lettereDaColonna(nuova) + ind.riga;
  });
  figura.querySelectorAll(".parcheggio-celle").forEach((box) => {
    if (!box.children.length) box.remove();
  });
}

function togliPulsantiRigaColonna(figura) {
  figura.querySelectorAll(
    "button[data-azione='aggiungi-riga'], button[data-azione='togli-riga'], button[data-azione='aggiungi-colonna'], button[data-azione='togli-colonna']",
  ).forEach((pulsante) => pulsante.remove());
}

function assicuraCorniceTabella(figura) {
  let cornice = figura.querySelector(".cornice-tabella");
  const table = figura.querySelector(":scope > table") || cornice?.querySelector("table");
  if (!table && !cornice) return;
  if (!cornice) {
    cornice = document.createElement("div");
    cornice.className = "cornice-tabella";
    table.before(cornice);
    cornice.append(table);
  }
  const misura = assicuraMisuraTabella(figura, cornice);
  cornice.querySelectorAll("[data-ridimensiona-tabella]").forEach((presa) => presa.remove());
  mettiPresaTabella(misura, "larghezza", "presa-tabella-larghezza", "Trascina per la larghezza di tutta la tabella");
  mettiPresaTabella(misura, "altezza", "presa-tabella-altezza", "Trascina per l’altezza di tutta la tabella");
  mettiPresaTabella(misura, "entrambi", "presa-tabella-angolo", "Trascina l’angolo: tutta la tabella, lettere comprese, diventa più piccola o più grande");
  applicaScalaTabella(figura, parseFloat(figura.dataset.scala) || 1);
  if (!figura.dataset.scala) applicaLarghezzaTabella(figura, parseFloat(figura.dataset.larghezza) || 100);
}

function assicuraMisuraTabella(figura, cornice) {
  let misura = figura.querySelector(":scope > .misura-tabella");
  if (!misura) {
    misura = document.createElement("div");
    misura.className = "misura-tabella";
    cornice.before(misura);
    misura.append(cornice);
  }
  return misura;
}

function mettiPresaTabella(cornice, tipo, classe, titolo) {
  let presa = cornice.querySelector(`[data-ridimensiona-tabella="${tipo}"]`);
  if (!presa) {
    presa = document.createElement("span");
    presa.className = `presa-tabella ${classe} solo-editor`;
    presa.dataset.ridimensionaTabella = tipo;
    cornice.append(presa);
  }
  presa.title = titolo;
}

function applicaScalaTabella(figura, scala, naturale) {
  const cornice = figura.querySelector(".cornice-tabella");
  const misura = cornice ? assicuraMisuraTabella(figura, cornice) : null;
  if (!cornice || !misura) return;
  cornice.style.zoom = "";
  const valore = Math.round(Math.min(1.5, Math.max(0.4, scala)) * 100) / 100;
  if (valore >= 0.99 && valore <= 1.01) {
    delete figura.dataset.scala;
    cornice.style.transform = "";
    cornice.style.transformOrigin = "";
    cornice.style.width = "";
    cornice.style.maxWidth = "";
    misura.style.width = "";
    misura.style.height = "";
    applicaLarghezzaTabella(figura, parseFloat(figura.dataset.larghezza) || 100);
    applicaPostoTabella(figura);
    return;
  }
  let larghezza = naturale?.w;
  let altezza = naturale?.h;
  if (!larghezza || !altezza) {
    const transform = cornice.style.transform;
    cornice.style.transform = "none";
    larghezza = cornice.offsetWidth;
    altezza = cornice.offsetHeight;
    cornice.style.transform = transform;
  }
  figura.dataset.scala = String(valore);
  cornice.style.maxWidth = "none";
  cornice.style.width = `${Math.round(larghezza)}px`;
  cornice.style.transformOrigin = "top left";
  cornice.style.transform = `scale(${valore})`;
  misura.style.width = `${Math.round(larghezza * valore)}px`;
  misura.style.height = `${Math.round(altezza * valore)}px`;
  applicaPostoTabella(figura);
}

function applicaLarghezzaTabella(figura, percento) {
  const cornice = figura.querySelector(".cornice-tabella");
  const misura = cornice ? assicuraMisuraTabella(figura, cornice) : null;
  if (!cornice || !misura) return;
  if (figura.dataset.scala) {
    applicaPostoTabella(figura);
    return;
  }
  const valore = Math.min(100, Math.max(20, percento));
  cornice.style.width = "";
  cornice.style.maxWidth = "";
  if (valore >= 99.5) {
    delete figura.dataset.larghezza;
    misura.style.width = "";
  } else {
    figura.dataset.larghezza = String(Math.round(valore));
    misura.style.width = `${Math.round(valore)}%`;
  }
  applicaPostoTabella(figura);
}

function iniziaRidimensionaTabella(evento, presa) {
  evento.preventDefault();
  evento.stopPropagation();
  const figura = presa.closest(".blocco-tabella");
  const cornice = figura?.querySelector(".cornice-tabella");
  if (!figura || !cornice) return;
  const modo = presa.dataset.ridimensionaTabella;
  const startX = evento.clientX;
  const startY = evento.clientY;
  const spazio = figura.clientWidth || 1;
  const zoom = zoomPagina();
  const schermo = cornice.getBoundingClientRect();
  const box = { width: schermo.width / zoom, height: schermo.height / zoom };
  const scalaIniziale = parseFloat(figura.dataset.scala) || 1;
  const righe = [...figura.querySelectorAll("tbody tr")];
  const altezze = righe.map((tr) => tr.getBoundingClientRect().height / zoom);
  const totale = altezze.reduce((somma, altezza) => somma + altezza, 0) || 1;
  const cursore = modo === "larghezza" ? "cursore-larghezza" : modo === "altezza" ? "cursore-altezza" : "cursore-immagine";

  function muovi(movimento) {
    const dx = (movimento.clientX - startX) / zoom;
    const dy = (movimento.clientY - startY) / zoom;
    if (modo === "entrambi") {
      const rapportoX = (box.width + dx) / Math.max(box.width, 1);
      const rapportoY = (box.height + dy) / Math.max(box.height, 1);
      const fattore = Math.hypot(rapportoX, rapportoY) / Math.SQRT2;
      applicaScalaTabella(figura, scalaIniziale * fattore, {
        w: box.width / scalaIniziale,
        h: box.height / scalaIniziale,
      });
      return;
    }
    if (modo !== "altezza") applicaLarghezzaTabella(figura, ((box.width + dx) / spazio) * 100);
    if (modo !== "larghezza") applicaAltezzaRighe(righe, altezze, totale + dy, totale);
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

function applicaAltezzaRighe(righe, altezze, nuovoTotale, totale) {
  const fattore = Math.max(righe.length * 22, nuovoTotale) / totale;
  righe.forEach((tr, indice) => {
    const px = Math.max(22, Math.round(altezze[indice] * fattore));
    tr.style.height = `${px}px`;
    tr.dataset.altezza = `${px}px`;
  });
}

function assicuraBarraTabella(figura) {
  const comandi = figura.querySelector(".tabella-comandi");
  if (!comandi) return;
  if (!comandi.querySelector(".tabella-comandi-titolo")) {
    const titolo = document.createElement("p");
    titolo.className = "tabella-comandi-titolo";
    titolo.textContent = "Tabella";
    comandi.prepend(titolo);
  }
  if (!comandi.querySelector("[data-azione='chiudi-barra']")) comandi.append(bottone("chiudi-barra", "Chiudi"));
  [
    ".tabella-comandi-titolo",
    "label:has(.campo-id)",
    "label:has(.campo-titolo)",
    "label:has(.campo-bordi)",
    "label:has(.campo-posto)",
    "[data-azione='riga-totali']",
    "[data-azione='elimina-tabella']",
    "[data-azione='chiudi-barra']",
  ].forEach((selettore) => {
    const nodo = comandi.querySelector(selettore);
    if (nodo) comandi.append(nodo);
  });
}

function scegliTabella(figura) {
  document.querySelectorAll(".blocco-tabella.scelta").forEach((altra) => {
    if (altra !== figura) altra.classList.remove("scelta");
  });
  figura.classList.add("scelta");
}

function togliSceltaTabelle() {
  document.querySelectorAll(".blocco-tabella.scelta").forEach((figura) => figura.classList.remove("scelta"));
}

function mostraBarraTabella(figura, angolo) {
  if (!figura) return;
  chiudiBarreTabella();
  const barra = figura.querySelector(".tabella-comandi");
  if (!barra) return;
  barra.classList.add("aperta");
  const zoom = zoomPagina();
  const fig = figura.getBoundingClientRect();
  const box = angolo.getBoundingClientRect();
  barra.style.left = `${Math.max(0, Math.round((box.left - fig.left) / zoom))}px`;
  barra.style.top = `${Math.round((box.bottom - fig.top) / zoom + 6)}px`;
  const aperta = barra.getBoundingClientRect();
  if (aperta.bottom > window.innerHeight - 8) {
    barra.style.top = `${Math.max(0, Math.round((box.top - fig.top - aperta.height) / zoom - 6))}px`;
  }
}

function chiudiBarreTabella() {
  document.querySelectorAll(".tabella-comandi.aperta").forEach((barra) => barra.classList.remove("aperta"));
}

function assicuraAngolo(figura) {
  const angolo = figura.querySelector("thead th");
  if (!angolo) return;
  angolo.classList.add("angolo-tabella", "solo-editor");
  angolo.title = "Tasto destro: codice, titolo, bordi e posizione nel foglio";
}

function assicuraManiglie(figura) {
  assicuraAngolo(figura);
  const teste = [...figura.querySelectorAll("thead th")];
  teste.forEach((th, indice) => {
    if (indice === 0) return;
    mettiManiglia(th, lettereDaColonna(indice), "colonna");
  });
  figura.querySelectorAll("tbody tr").forEach((tr, indice) => {
    const th = tr.querySelector("th");
    if (!th) return;
    mettiManiglia(th, String(indice + 1), "riga");
    if (tr.dataset.altezza) tr.style.height = tr.dataset.altezza;
    const etichetta = th.querySelector(".etichetta-asse");
    if (tr.dataset.totale && etichetta) {
      etichetta.title = "Clicca per scegliere la riga dei totali. Resta sempre in fondo.";
    }
  });
  assicuraColgroup(figura);
}

function mettiManiglia(th, testo, tipo) {
  let etichetta = th.querySelector(":scope > .etichetta-asse");
  if (!etichetta) {
    th.replaceChildren();
    etichetta = document.createElement("span");
    etichetta.className = "etichetta-asse";
    const grip = document.createElement("span");
    grip.className = tipo === "colonna" ? "ridimensiona-colonna" : "ridimensiona-riga";
    grip.title = tipo === "colonna"
      ? "Trascina per stringere o allargare la colonna"
      : "Trascina per stringere o allargare la riga";
    etichetta.title = tipo === "colonna"
      ? "Clicca per scegliere la colonna. Trascina per spostarla."
      : "Clicca per scegliere la riga. Trascina per spostarla.";
    th.append(etichetta, grip);
    th.classList.add(tipo === "colonna" ? "testa-colonna" : "testa-riga");
  }
  etichetta.textContent = testo;
}

function assicuraColgroup(figura) {
  const table = figura.querySelector("table");
  const teste = [...figura.querySelectorAll("thead th")];
  let gruppo = table.querySelector("colgroup");
  if (!gruppo) {
    gruppo = document.createElement("colgroup");
    table.prepend(gruppo);
  }
  while (gruppo.children.length < teste.length) gruppo.append(document.createElement("col"));
  while (gruppo.children.length > teste.length) gruppo.lastElementChild.remove();
  const cols = [...gruppo.children];
  cols[0].className = "solo-editor";
  cols[0].style.width = "8%";
  const dati = teste.slice(1);
  const misurate = dati.filter((th) => th.dataset.larghezza);
  if (misurate.length && misurate.length < dati.length) {
    const usate = misurate.reduce((somma, th) => somma + parseFloat(th.dataset.larghezza), 0);
    const quota = Math.max(8, (100 - usate) / (dati.length - misurate.length));
    dati.forEach((th) => {
      if (!th.dataset.larghezza) th.dataset.larghezza = quota.toFixed(2);
    });
    const totale = dati.reduce((somma, th) => somma + parseFloat(th.dataset.larghezza), 0) || 1;
    dati.forEach((th) => {
      th.dataset.larghezza = ((parseFloat(th.dataset.larghezza) / totale) * 100).toFixed(2);
    });
  }
  dati.forEach((th, indice) => {
    const col = cols[indice + 1];
    if (th.dataset.larghezza) col.style.width = `${((100 - 8) * parseFloat(th.dataset.larghezza)) / 100}%`;
  });
}

function iniziaRidimensionaColonna(evento, th) {
  evento.preventDefault();
  if (th.dataset.nascosta === "1") return;
  const figura = th.closest(".blocco-tabella");
  const indice = [...th.parentElement.children].indexOf(th);
  const col = figura.querySelectorAll("colgroup col")[indice];
  if (!col) return;
  bloccaInPixel(figura);
  const zoom = zoomPagina();
  const partenza = evento.clientX;
  const larghezza = col.getBoundingClientRect().width / zoom;
  document.body.classList.add("cursore-colonna");
  function muovi(e) {
    col.style.width = `${Math.max(36, larghezza + (e.clientX - partenza) / zoom)}px`;
  }
  function fine() {
    document.removeEventListener("mousemove", muovi);
    document.removeEventListener("mouseup", fine);
    document.body.classList.remove("cursore-colonna");
    salvaLarghezze(figura);
    segnaModifica();
  }
  document.addEventListener("mousemove", muovi);
  document.addEventListener("mouseup", fine);
}

function iniziaRidimensionaRiga(evento, tr) {
  evento.preventDefault();
  if (tr.dataset.nascosta === "1") return;
  const zoom = zoomPagina();
  const partenza = evento.clientY;
  const altezza = tr.getBoundingClientRect().height / zoom;
  document.body.classList.add("cursore-riga");
  function muovi(e) {
    const nuova = Math.max(22, altezza + (e.clientY - partenza) / zoom);
    tr.style.height = `${Math.round(nuova)}px`;
  }
  function fine() {
    document.removeEventListener("mousemove", muovi);
    document.removeEventListener("mouseup", fine);
    document.body.classList.remove("cursore-riga");
    delete tr.dataset.mm;
    tr.dataset.altezza = tr.style.height;
    segnaModifica();
  }
  document.addEventListener("mousemove", muovi);
  document.addEventListener("mouseup", fine);
}

export function impostaLarghezzaColonna(figura, th, millimetri) {
  const teste = [...figura.querySelectorAll("thead th")].slice(1);
  if (!teste.includes(th)) return;
  const zoom = zoomPagina();
  const tabella = figura.querySelector("table").getBoundingClientRect().width / zoom;
  // Le colonne dei dati occupano il 92% della tabella: l'angolo con i numeri prende l'8%.
  const area = Math.max(80, tabella * 0.92);
  const pixel = Math.max(36, millimetri * (96 / 25.4));
  const richiesto = (pixel / area) * 100;

  teste.forEach((testa) => {
    if (!testa.dataset.larghezza) testa.dataset.larghezza = (100 / teste.length).toFixed(2);
  });
  const altri = teste.filter((testa) => testa !== th);
  const nascosti = altri.filter((testa) => testa.dataset.nascosta === "1");
  const visibili = altri.filter((testa) => testa.dataset.nascosta !== "1");
  const riservato = nascosti.reduce((totale, testa) => totale + (parseFloat(testa.dataset.larghezza) || 0), 0);
  const limite = Math.max(5, 100 - riservato - visibili.length * 5);
  const percento = Math.min(limite, Math.max(5, richiesto));
  const spazio = Math.max(5, 100 - percento - riservato);
  const usata = visibili.reduce((totale, testa) => totale + (parseFloat(testa.dataset.larghezza) || 0), 0) || 1;
  th.dataset.larghezza = percento.toFixed(4);
  // Se la colonna ci sta, ricordiamo il numero scritto. Altrimenti la tabella è troppo stretta e mostriamo la misura vera.
  th.dataset.mm = Math.abs(percento - richiesto) < 0.001
    ? String(millimetri)
    : String(Math.round(((percento / 100) * area * 25.4) / 96 * 10) / 10);
  visibili.forEach((testa) => {
    testa.dataset.larghezza = ((parseFloat(testa.dataset.larghezza) / usata) * spazio).toFixed(4);
    delete testa.dataset.mm;
  });
  segnaModifica();
  document.dispatchEvent(new Event("tabelle-ricalcolate"));
}

export function impostaAltezzaRiga(tr, millimetri) {
  const pixel = Math.max(22, millimetri * (96 / 25.4));
  tr.dataset.mm = String(millimetri);
  tr.dataset.altezza = `${pixel}px`;
  if (tr.dataset.nascosta !== "1") tr.style.height = tr.dataset.altezza;
  segnaModifica();
  document.dispatchEvent(new Event("tabelle-ricalcolate"));
}

function bloccaInPixel(figura) {
  const zoom = zoomPagina();
  [...figura.querySelectorAll("colgroup col")].forEach((col) => {
    col.style.width = `${Math.max(20, Math.round(col.getBoundingClientRect().width / zoom))}px`;
  });
}

function salvaLarghezze(figura) {
  const cols = [...figura.querySelectorAll("colgroup col")].slice(1);
  const teste = [...figura.querySelectorAll("thead th")].slice(1);
  const visibile = (indice) => teste[indice]?.dataset.nascosta !== "1";
  const sommaVisibile = cols.reduce((totale, col, indice) => (visibile(indice) ? totale + col.getBoundingClientRect().width : totale), 0) || 1;
  const riservato = teste.reduce((totale, th, indice) => (!visibile(indice) ? totale + (parseFloat(th.dataset.larghezza) || 0) : totale), 0);
  const spazio = Math.max(5, 100 - riservato);
  cols.forEach((col, indice) => {
    if (!visibile(indice)) {
      col.style.width = "22px";
      return;
    }
    const percento = (col.getBoundingClientRect().width / sommaVisibile) * spazio;
    if (teste[indice]) {
      teste[indice].dataset.larghezza = percento.toFixed(2);
      delete teste[indice].dataset.mm;
    }
    col.style.width = `${((100 - 8) * percento) / 100}%`;
  });
  const angolo = figura.querySelector("colgroup col");
  if (angolo) angolo.style.width = "8%";
}

function iniziaSpostaColonna(evento, th) {
  evento.preventDefault();
  const figura = th.closest(".blocco-tabella");
  const origine = [...th.parentElement.children].indexOf(th);
  const partenza = evento.clientX;
  let destinazione = origine;
  let mosso = false;
  document.body.classList.add("cursore-sposta");
  function muovi(e) {
    if (Math.abs(e.clientX - partenza) < 4) return;
    mosso = true;
    destinazione = indiceInserimento(figura, "colonna", e.clientX);
    segnaBersaglio(figura, "colonna", destinazione);
  }
  function fine() {
    document.removeEventListener("mousemove", muovi);
    document.removeEventListener("mouseup", fine);
    document.body.classList.remove("cursore-sposta");
    pulisciBersaglio(figura);
    if (mosso) spostaColonnaGrafica(figura, origine, destinazione);
    else document.dispatchEvent(new CustomEvent("scegli-asse", { detail: { tipo: "colonna", testa: th } }));
  }
  document.addEventListener("mousemove", muovi);
  document.addEventListener("mouseup", fine);
}

function iniziaSpostaRiga(evento, tr) {
  evento.preventDefault();
  const figura = tr.closest(".blocco-tabella");
  const origine = indiceRiga(tr);
  const partenza = evento.clientY;
  let destinazione = origine;
  let mosso = false;
  document.body.classList.add("cursore-sposta");
  function muovi(e) {
    if (tr.dataset.totale) return;
    if (Math.abs(e.clientY - partenza) < 4) return;
    mosso = true;
    destinazione = indiceInserimento(figura, "riga", e.clientY);
    segnaBersaglio(figura, "riga", destinazione);
  }
  function fine() {
    document.removeEventListener("mousemove", muovi);
    document.removeEventListener("mouseup", fine);
    document.body.classList.remove("cursore-sposta");
    pulisciBersaglio(figura);
    if (mosso && !tr.dataset.totale) spostaRigaGrafica(figura, origine, destinazione);
    else if (!mosso) document.dispatchEvent(new CustomEvent("scegli-asse", { detail: { tipo: "riga", riga: tr } }));
  }
  document.addEventListener("mousemove", muovi);
  document.addEventListener("mouseup", fine);
}

function indiceInserimento(figura, tipo, punto) {
  if (tipo === "colonna") {
    const teste = [...figura.querySelectorAll("thead th")].slice(1);
    for (let indice = 0; indice < teste.length; indice += 1) {
      const rettangolo = teste[indice].getBoundingClientRect();
      if (punto < rettangolo.left + rettangolo.width / 2) return indice + 1;
    }
    return teste.length + 1;
  }
  const righe = [...figura.querySelectorAll("tbody tr")].filter((riga) => !riga.dataset.totale);
  for (let indice = 0; indice < righe.length; indice += 1) {
    const rettangolo = righe[indice].getBoundingClientRect();
    if (punto < rettangolo.top + rettangolo.height / 2) return indice + 1;
  }
  return righe.length + 1;
}

function segnaBersaglio(figura, tipo, destinazione) {
  pulisciBersaglio(figura);
  if (tipo === "colonna") {
    const th = figura.querySelectorAll("thead th")[destinazione];
    (th || figura.querySelector("thead th:last-child"))?.classList.add("bersaglio");
    return;
  }
  const righe = [...figura.querySelectorAll("tbody tr")].filter((riga) => !riga.dataset.totale);
  (righe[destinazione - 1] || righe[righe.length - 1])?.classList.add("bersaglio");
}

function pulisciBersaglio(figura) {
  figura.querySelectorAll(".bersaglio").forEach((el) => el.classList.remove("bersaglio"));
}

function ordineDopoSpostamento(da, a, quanti) {
  if (a === da || a === da + 1) return null;
  const ordine = Array.from({ length: quanti }, (_, indice) => indice + 1);
  const [preso] = ordine.splice(da - 1, 1);
  ordine.splice(a > da ? a - 2 : a - 1, 0, preso);
  return ordine;
}

function spostaColonnaGrafica(figura, da, a) {
  if (haCelleUnite(figura)) {
    avvisa("Per spostare le colonne, prima separa le celle unite.");
    return;
  }
  const quanti = figura.querySelectorAll("thead th").length - 1;
  const ordine = ordineDopoSpostamento(da, a, quanti);
  if (!ordine) return;
  const verso = {};
  ordine.forEach((vecchio, indice) => {
    verso[vecchio] = indice + 1;
  });
  applicaPermutazione(figura, (colonna, riga) => ({ colonna: verso[colonna] || colonna, riga }));
  const testa = figura.querySelector("thead tr");
  const ths = [...testa.children];
  testa.append(ths[0], ...ordine.map((numero) => ths[numero]));
  figura.querySelectorAll("tbody tr").forEach((tr) => {
    const celle = [...tr.children];
    tr.append(celle[0], ...ordine.map((numero) => celle[numero]));
  });
  const cols = [...figura.querySelectorAll("colgroup col")];
  if (cols.length === ths.length) cols[0].parentElement.append(cols[0], ...ordine.map((numero) => cols[numero]));
  rietichettaDaPosizione(figura);
  aggiornaIntervalloTotali(figura);
  ricalcolaTutte();
  aggiornaFormulaAttiva(figura);
  segnaModifica();
}

function spostaRigaGrafica(figura, da, a) {
  if (haCelleUnite(figura)) {
    avvisa("Per spostare le righe, prima separa le celle unite.");
    return;
  }
  const righe = [...figura.querySelectorAll("tbody tr")];
  const totale = figura.querySelector("tbody tr[data-totale]");
  const dati = righe.filter((riga) => riga !== totale);
  if (da < 1 || da > dati.length) return;
  const ordineDati = ordineDopoSpostamento(da, a, dati.length);
  if (!ordineDati) return;
  const ordine = totale ? [...ordineDati, righe.length] : ordineDati;
  const verso = {};
  ordine.forEach((vecchio, indice) => {
    verso[vecchio] = indice + 1;
  });
  applicaPermutazione(figura, (colonna, riga) => ({ colonna, riga: verso[riga] || riga }));
  const tbody = figura.querySelector("tbody");
  tbody.append(...ordine.map((numero) => righe[numero - 1]));
  rietichettaDaPosizione(figura);
  aggiornaIntervalloTotali(figura);
  ricalcolaTutte();
  aggiornaFormulaAttiva(figura);
  segnaModifica();
}

function rietichettaDaPosizione(figura) {
  [...figura.querySelectorAll("thead th")].slice(1).forEach((th, indice) => {
    const etichetta = th.querySelector(".etichetta-asse");
    if (etichetta) etichetta.textContent = lettereDaColonna(indice + 1);
  });
  figura.querySelectorAll("tbody tr").forEach((tr, indiceRiga) => {
    const etichetta = tr.querySelector("th .etichetta-asse");
    if (etichetta) etichetta.textContent = String(indiceRiga + 1);
    [...tr.querySelectorAll("td")].forEach((td, indiceColonna) => {
      td.dataset.cella = lettereDaColonna(indiceColonna + 1) + (indiceRiga + 1);
    });
  });
}

function aggiornaFormulaAttiva(figura) {
  if (!cellaAttiva || !figura.contains(cellaAttiva)) return;
  document.getElementById("formula").value = cellaAttiva.dataset.raw || "";
  aggiornaEtichetta();
}

function applicaPermutazione(figura, mappa) {
  const id = figura.dataset.id;
  document.querySelectorAll(".blocco-tabella td[data-raw]").forEach((td) => {
    const raw = td.dataset.raw || "";
    if (!raw.trim().startsWith("=")) return;
    td.dataset.raw = sostituisciGriglia(raw, id, td.closest(".blocco-tabella") === figura, mappa);
  });
  document.querySelectorAll(".riferimento").forEach((span) => {
    if (span.dataset.tabella !== id) return;
    const ind = analizzaIndirizzo(span.dataset.cella);
    if (!ind) return;
    const nuovo = mappa(ind.colonna, ind.riga);
    span.dataset.cella = lettereDaColonna(nuovo.colonna) + nuovo.riga;
  });
}

function sostituisciGriglia(testo, id, nellaStessa, mappa) {
  return testo.replace(/(^|[^A-Za-z0-9_])(?:([A-Za-z_][A-Za-z0-9_]*)\.)?([A-Za-z]{1,3})(\d+)/g, (tutto, prima, nome, lettere, numeri) => {
    if (nome) {
      if (nome.toLowerCase() !== id.toLowerCase()) return tutto;
    } else if (!nellaStessa) return tutto;
    const ind = analizzaIndirizzo(`${lettere}${numeri}`);
    if (!ind) return tutto;
    const nuovo = mappa(ind.colonna, ind.riga);
    if (!nuovo || (nuovo.colonna === ind.colonna && nuovo.riga === ind.riga)) return tutto;
    const etichetta = lettereDaColonna(nuovo.colonna) + nuovo.riga;
    return nome ? `${prima}${nome}.${etichetta}` : `${prima}${etichetta}`;
  });
}

function sostituisciIndirizzi(testo, id, nellaStessa, mappa) {
  return testo.replace(/(^|[^A-Za-z0-9_])(?:([A-Za-z_][A-Za-z0-9_]*)\.)?([A-Za-z]{1,3})(\d+)/g, (tutto, prima, nome, lettere, numeri) => {
    if (nome) {
      if (nome.toLowerCase() !== id.toLowerCase()) return tutto;
    } else if (!nellaStessa) return tutto;
    const riga = Number(numeri);
    const nuova = mappa(riga);
    if (nuova == null) return nome ? `${prima}${nome}.ZZ99` : `${prima}ZZ99`;
    if (nuova === riga) return tutto;
    return nome ? `${prima}${nome}.${lettere}${nuova}` : `${prima}${lettere}${nuova}`;
  });
}

function sostituisciColonne(testo, id, nellaStessa, mappa) {
  return testo.replace(/(^|[^A-Za-z0-9_])(?:([A-Za-z_][A-Za-z0-9_]*)\.)?([A-Za-z]{1,3})(\d+)/g, (tutto, prima, nome, lettere, numeri) => {
    if (nome) {
      if (nome.toLowerCase() !== id.toLowerCase()) return tutto;
    } else if (!nellaStessa) return tutto;
    const ind = analizzaIndirizzo(`${lettere}${numeri}`);
    if (!ind) return tutto;
    const nuova = mappa(ind.colonna);
    if (nuova == null) return nome ? `${prima}${nome}.ZZ99` : `${prima}ZZ99`;
    if (nuova === ind.colonna) return tutto;
    const etichetta = lettereDaColonna(nuova) + numeri;
    return nome ? `${prima}${nome}.${etichetta}` : `${prima}${etichetta}`;
  });
}

export async function eliminaTabella(figura) {
  const si = await conferma(`Eliminare ${figura.dataset.id}? I collegamenti nel testo mostreranno #RIF!.`);
  if (!si) return false;
  rimuoviTabella(figura);
  ricalcolaTutte();
  segnaModifica();
  return true;
}

// Toglie la tabella senza chiedere: chi la chiama ha già avuto la conferma.
export function rimuoviTabella(figura) {
  if (cellaAttiva && figura.contains(cellaAttiva)) deselezionaCella();
  figura.remove();
}

function rinomina(figura, nuovo) {
  const vecchio = figura.dataset.id;
  const codice = nuovo.trim();
  if (codice === vecchio) return true;
  const errore = messaggioCodice(codice, figura);
  if (errore) {
    avvisa(errore);
    return false;
  }
  figura.dataset.id = codice;
  const campo = figura.querySelector(".campo-id");
  campo.value = codice;
  campo.setAttribute("value", codice);
  document.querySelectorAll(".riferimento").forEach((span) => {
    if (span.dataset.tabella === vecchio) span.dataset.tabella = codice;
  });
  const modello = new RegExp(`(^|[^A-Za-z0-9_])${vecchio}\\.`, "g");
  document.querySelectorAll(".blocco-tabella td[data-raw]").forEach((td) => {
    if (!td.dataset.raw.includes(`${vecchio}.`)) return;
    td.dataset.raw = td.dataset.raw.replace(modello, `$1${codice}.`);
  });
  if (cellaAttiva && figura.contains(cellaAttiva)) aggiornaEtichetta();
  ricalcolaTutte();
  segnaModifica();
  return true;
}

function selezionaCella(td) {
  const giaSolo = cellaAttiva === td && document.querySelectorAll(".blocco-tabella td.selezionata").length === 1;
  if (giaSolo) {
    document.getElementById("formula").focus();
    return;
  }
  impostaSelezione(td, [td], true);
}

function impostaSelezione(ancora, celle, fuoco) {
  const formula = document.getElementById("formula");
  const stessa = cellaAttiva === ancora;
  if (cellaAttiva && !stessa) scriviRaw(cellaAttiva, formula.value);
  document.querySelectorAll(".blocco-tabella").forEach((tab) => tab.classList.remove("tabella-attiva"));
  document.querySelectorAll(".blocco-tabella td.selezionata").forEach((td) => td.classList.remove("selezionata"));
  document.querySelectorAll(".cella-ancora").forEach((td) => td.classList.remove("cella-ancora"));
  cellaAttiva = ancora;
  celle.forEach((td) => td.classList.add("selezionata"));
  ancora.classList.add("cella-ancora", "selezionata");
  ancora.closest(".blocco-tabella")?.classList.add("tabella-attiva");
  formula.disabled = false;
  if (!stessa) formula.value = ancora.dataset.raw || "";
  aggiornaEtichetta();
  if (fuoco) {
    formula.focus();
    formula.select();
  }
}

function estensioneCella(td) {
  const ind = analizzaIndirizzo(td?.dataset?.cella);
  if (!ind) return null;
  return {
    r1: ind.riga,
    c1: ind.colonna,
    r2: ind.riga + Math.max(1, td.rowSpan || 1) - 1,
    c2: ind.colonna + Math.max(1, td.colSpan || 1) - 1,
  };
}

function haCelleUnite(figura) {
  return [...figura.querySelectorAll("tbody td")].some((td) => (td.colSpan || 1) > 1 || (td.rowSpan || 1) > 1);
}

function unioneAttraversata(figura, dalla) {
  return [...figura.querySelectorAll("tbody td")].some((td) => {
    const est = estensioneCella(td);
    return est && est.r1 < dalla && est.r2 >= dalla;
  });
}

function unioneAttraversataColonna(figura, dopo) {
  return [...figura.querySelectorAll("tbody td")].some((td) => {
    const est = estensioneCella(td);
    return est && est.c1 <= dopo && est.c2 > dopo;
  });
}

function rigaDentroUnione(figura, numero) {
  return [...figura.querySelectorAll("tbody td")].some((td) => {
    const est = estensioneCella(td);
    return est && est.r2 > est.r1 && est.r1 <= numero && est.r2 >= numero;
  });
}

function colonnaDentroUnione(figura, numero) {
  return [...figura.querySelectorAll("tbody td")].some((td) => {
    const est = estensioneCella(td);
    if (!est || est.c2 < numero || est.c1 > numero) return false;
    return est.c1 < numero || est.r2 > est.r1 || est.c2 > est.c1;
  });
}

function togliParcheggioRiga(figura, numero) {
  figura.querySelectorAll(".parcheggio-celle td[data-cella]").forEach((td) => {
    const ind = analizzaIndirizzo(td.dataset.cella);
    if (ind?.riga === numero) td.remove();
  });
  figura.querySelectorAll(".parcheggio-celle").forEach((box) => {
    if (!box.children.length) box.remove();
  });
}

function deselezionaCella() {
  if (cellaAttiva) scriviRaw(cellaAttiva, document.getElementById("formula").value);
  cellaAttiva?.classList.remove("selezionata", "cella-ancora");
  document.querySelectorAll(".blocco-tabella td.selezionata, .cella-ancora").forEach((td) => td.classList.remove("selezionata", "cella-ancora"));
  document.querySelectorAll(".tabella-attiva").forEach((tab) => tab.classList.remove("tabella-attiva"));
  cellaAttiva = null;
  const formula = document.getElementById("formula");
  formula.value = "";
  formula.disabled = true;
  document.getElementById("btn-totale").disabled = true;
  document.getElementById("btn-unisci").disabled = true;
  document.getElementById("btn-separa").disabled = true;
  document.getElementById("etichetta-cella").textContent = "Nessuna cella selezionata";
}

function aggiornaEtichetta() {
  if (!cellaAttiva) return;
  const indirizzo = analizzaIndirizzo(cellaAttiva.dataset.cella);
  document.getElementById("btn-totale").disabled = !indirizzo || indirizzo.riga < 2;
  const figura = cellaAttiva.closest(".blocco-tabella");
  const celle = [...figura.querySelectorAll("td.selezionata")];
  const id = figura.dataset.id;
  let testo = `${id}.${cellaAttiva.dataset.cella}`;
  if (celle.length > 1) {
    const estese = celle.map(estensioneCella).filter(Boolean);
    const r1 = Math.min(...estese.map((est) => est.r1));
    const r2 = Math.max(...estese.map((est) => est.r2));
    const c1 = Math.min(...estese.map((est) => est.c1));
    const c2 = Math.max(...estese.map((est) => est.c2));
    testo = `${id}.${lettereDaColonna(c1)}${r1}:${lettereDaColonna(c2)}${r2}`;
  }
  document.getElementById("etichetta-cella").textContent = testo;
  document.getElementById("btn-unisci").disabled = celle.length < 2;
  document.getElementById("btn-separa").disabled = !celle.some((td) => (td.colSpan || 1) > 1 || (td.rowSpan || 1) > 1);
}

function scriviRaw(td, valore) {
  const nuovo = valore ?? "";
  if ((td.dataset.raw ?? "") === nuovo) return;
  td.dataset.raw = nuovo;
  ricalcolaTutte();
  segnaModifica();
}

function sposta(deltaRiga, deltaColonna) {
  if (!cellaAttiva) return;
  const indirizzo = analizzaIndirizzo(cellaAttiva.dataset.cella);
  const figura = cellaAttiva.closest(".blocco-tabella");
  if (!indirizzo || !figura) return;
  const colonna = indirizzo.colonna + deltaColonna;
  const riga = indirizzo.riga + deltaRiga;
  const td = [...figura.querySelectorAll("tbody td[data-cella]")].find((cella) => {
    const est = estensioneCella(cella);
    return est && colonna >= est.c1 && colonna <= est.c2 && riga >= est.r1 && riga <= est.r2;
  });
  if (td) selezionaCella(td);
}
