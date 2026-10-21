// Calcola le formule delle tabelle, in stile Excel ma con poche funzioni.

const FUNZIONI = new Set(["SOMMA", "SUM", "MEDIA", "AVERAGE", "MIN", "MAX", "CONTA", "COUNT", "CALCOLA", "ARROTONDA", "ROUND", "SE", "IF"]);

export function lettereDaColonna(numero) {
  let colonna = "";
  let valore = numero;
  while (valore > 0) {
    const resto = (valore - 1) % 26;
    colonna = String.fromCharCode(65 + resto) + colonna;
    valore = Math.floor((valore - 1) / 26);
  }
  return colonna;
}

export function colonnaDaLettere(lettere) {
  let numero = 0;
  for (const carattere of lettere.toUpperCase()) {
    if (carattere < "A" || carattere > "Z") return null;
    numero = numero * 26 + (carattere.charCodeAt(0) - 64);
  }
  return numero || null;
}

export function analizzaIndirizzo(testo) {
  const trovato = String(testo ?? "")
    .trim()
    .toUpperCase()
    .match(/^([A-Z]+)(\d+)$/);
  if (!trovato) return null;
  const colonna = colonnaDaLettere(trovato[1]);
  const riga = Number(trovato[2]);
  if (!colonna || riga < 1) return null;
  return { colonna, riga, etichetta: trovato[1] + String(riga) };
}

export function parseNumero(testo) {
  const pulito = String(testo ?? "")
    .trim()
    .replace(/\s/g, "");
  if (!/^[-+]?\d+(?:[.,]\d+)?$/.test(pulito)) return null;
  const numero = Number(pulito.replace(",", "."));
  return Number.isFinite(numero) ? numero : null;
}

export function nomeRiservato(nome) {
  return FUNZIONI.has(String(nome || "").toUpperCase());
}

// Testo con soli numeri, + - * / e parentesi, e almeno un'operazione: per esempio (5.40+5.2)/2.
// Non si accettano lettere, così etichette come "Piano 2-3" restano testo.
function sembraEspressione(testo) {
  const pulito = senzaSpazi(testo);
  return /^[\d.,+\-*/()]+$/.test(pulito) && /\d[)]*[+\-*/][(+\-]*\d/.test(pulito);
}

function senzaSpazi(testo) {
  return String(testo ?? "").replace(/\s+/g, "");
}

// Evita errori come 1.005 → 1.00 dovuti a come il computer salva i decimali.
export function arrotonda(numero, cifre) {
  const segno = numero < 0 ? -1 : 1;
  const assoluto = Math.abs(numero);
  if (String(assoluto).includes("e")) return segno * (Math.round(assoluto * 10 ** cifre) / 10 ** cifre);
  return segno * Number(`${Math.round(Number(`${assoluto}e${cifre}`))}e-${cifre}`);
}

function formatta(numero) {
  const valore = numero === 0 ? 0 : numero;
  return valore.toLocaleString("it-IT", { maximumFractionDigits: 4 });
}

export function testoRisultato(risultato) {
  if (!risultato) return "";
  if (risultato.errore) return risultato.errore;
  if (risultato.daFormula && risultato.testo) return risultato.testo;
  if (risultato.daFormula && typeof risultato.numero === "number") return formatta(risultato.numero);
  return risultato.testo ?? "";
}

function tabellaDi(chiave) {
  return chiave.slice(0, chiave.lastIndexOf("."));
}

export function calcolaTutte(grezze) {
  const cache = new Map();
  const visita = new Set();

  function esiste(chiave) {
    return Object.prototype.hasOwnProperty.call(grezze, chiave);
  }

  function risolvi(chiave) {
    if (cache.has(chiave)) return cache.get(chiave);
    if (!esiste(chiave)) return { errore: "#RIF!", testo: "#RIF!", daFormula: false };
    if (visita.has(chiave)) return { errore: "#CICLO!", testo: "#CICLO!", daFormula: true };

    visita.add(chiave);
    const risultato = interpreta(grezze[chiave], tabellaDi(chiave));
    visita.delete(chiave);
    cache.set(chiave, risultato);
    return risultato;
  }

  function interpreta(raw, tabellaCorrente) {
    const testo = String(raw ?? "").trim();
    if (!testo.startsWith("=")) return { daFormula: false, testo };

    const corpo = testo.slice(1).trim();
    const soloCella = corpo.replace(/\s+/g, "").match(/^([A-Za-z_][A-Za-z0-9_]*\.)?([A-Za-z]+\d+)$/);
    if (soloCella) {
      const tabella = soloCella[1] ? soloCella[1].slice(0, -1) : tabellaCorrente;
      const indirizzo = analizzaIndirizzo(soloCella[2]);
      if (indirizzo) {
        const chiave = `${tabella}.${indirizzo.etichetta}`;
        if (!esiste(chiave)) return { daFormula: true, errore: "#RIF!", testo: "#RIF!" };
        const cella = risolvi(chiave);
        if (cella.errore) return { daFormula: true, errore: cella.errore, testo: cella.errore };
        if (cella.daFormula && typeof cella.numero === "number" && !cella.testo) {
          return { daFormula: true, numero: cella.numero, testo: "" };
        }
        if (!cella.daFormula && sembraEspressione(cella.testo)) {
          try {
            return { daFormula: true, numero: valuta(senzaSpazi(cella.testo), tabella), testo: "" };
          } catch (errore) {
            const messaggio = errore.message || "#ERRORE!";
            return { daFormula: true, errore: messaggio, testo: messaggio };
          }
        }
        return { daFormula: true, testo: cella.testo || "", numero: parseNumero(cella.testo) };
      }
    }

    try {
      const valore = valuta(corpo, tabellaCorrente);
      if (typeof valore === "string") return { daFormula: true, testo: valore };
      return { daFormula: true, numero: valore, testo: "" };
    } catch (errore) {
      const messaggio = errore.message || "#ERRORE!";
      return { daFormula: true, errore: messaggio, testo: messaggio };
    }
  }

  function valuta(sorgente, tabellaCorrente) {
    let indice = 0;
    const fine = () => indice >= sorgente.length;
    const guarda = () => sorgente[indice];

    function saltaSpazi() {
      while (!fine() && /\s/.test(guarda())) indice += 1;
    }

    function leggiIdent() {
      const inizio = indice;
      while (!fine() && /[A-Za-z0-9_]/.test(sorgente[indice])) indice += 1;
      return sorgente.slice(inizio, indice);
    }

    function comeNumero(valore) {
      if (typeof valore === "number") {
        if (!Number.isFinite(valore)) throw new Error("#NUM!");
        return valore;
      }
      if (typeof valore === "string") {
        const numero = parseNumero(valore);
        if (numero != null) return numero;
      }
      throw new Error("#VALORE!");
    }

    function confronto() {
      const sinistra = espressione();
      saltaSpazi();
      const operatore = leggiOperatoreConfronto();
      if (!operatore) return sinistra;
      const destra = espressione();
      return confronta(sinistra, destra, operatore) ? 1 : 0;
    }

    function leggiOperatoreConfronto() {
      const carattere = guarda();
      const successivo = sorgente[indice + 1];
      if (carattere === "<" && (successivo === ">" || successivo === "=")) {
        indice += 2;
        return carattere + successivo;
      }
      if (carattere === ">" && successivo === "=") {
        indice += 2;
        return ">=";
      }
      if (carattere === ">" || carattere === "<" || carattere === "=") {
        indice += 1;
        return carattere;
      }
      return null;
    }

    function espressione() {
      let sinistra = termine();
      while (true) {
        saltaSpazi();
        if (fine() || (guarda() !== "+" && guarda() !== "-")) break;
        const operatore = guarda();
        indice += 1;
        const destra = comeNumero(termine());
        const base = comeNumero(sinistra);
        sinistra = operatore === "+" ? base + destra : base - destra;
      }
      return sinistra;
    }

    function termine() {
      let sinistra = fattore();
      while (true) {
        saltaSpazi();
        if (fine() || (guarda() !== "*" && guarda() !== "/")) break;
        const operatore = guarda();
        indice += 1;
        const destra = comeNumero(fattore());
        const base = comeNumero(sinistra);
        if (operatore === "/" && destra === 0) throw new Error("#DIV/0!");
        sinistra = operatore === "*" ? base * destra : base / destra;
      }
      return sinistra;
    }

    function fattore() {
      saltaSpazi();
      if (fine()) throw new Error("#ERRORE!");
      if (guarda() === "+") {
        indice += 1;
        return comeNumero(fattore());
      }
      if (guarda() === "-") {
        indice += 1;
        return -comeNumero(fattore());
      }
      if (guarda() === "(") {
        indice += 1;
        const valore = confronto();
        saltaSpazi();
        if (guarda() !== ")") throw new Error("#ERRORE!");
        indice += 1;
        return valore;
      }
      if (guarda() === '"') return leggiTesto();
      if (/[0-9]/.test(guarda())) return leggiNumero();
      if (/[A-Za-z_]/.test(guarda())) {
        const inizio = indice;
        const ident = leggiIdent();
        saltaSpazi();
        const nome = ident.toUpperCase();
        if ((nome === "SE" || nome === "IF") && guarda() === "(") return leggiSe();
        if (nome === "CALCOLA" && guarda() === "(") {
          indice += 1;
          const riferimento = leggiRiferimento(true);
          saltaSpazi();
          if (guarda() !== ")") throw new Error("#ERRORE!");
          indice += 1;
          return calcolaTestoDi(riferimento);
        }
        if (!fine() && guarda() === "(") {
          indice += 1;
          const numeri = [];
          saltaSpazi();
          if (guarda() !== ")") {
            while (true) {
              numeri.push(...leggiArgomento());
              saltaSpazi();
              if (guarda() === "," || guarda() === ";") {
                indice += 1;
                continue;
              }
              break;
            }
          }
          saltaSpazi();
          if (guarda() !== ")") throw new Error("#ERRORE!");
          indice += 1;
          return chiama(ident, numeri);
        }
        indice = inizio;
        return valoreDiRiferimento(leggiRiferimento(true));
      }
      throw new Error("#ERRORE!");
    }

    function leggiSe() {
      indice += 1;
      const condizione = confronto();
      saltaSpazi();
      if (guarda() !== ";" && guarda() !== ",") throw new Error("#ERRORE!");
      indice += 1;
      const seVero = ritagliaArgomento();
      saltaSpazi();
      let seFalso = "0";
      if (guarda() === ";" || guarda() === ",") {
        indice += 1;
        seFalso = ritagliaArgomento();
      }
      saltaSpazi();
      if (guarda() !== ")") throw new Error("#ERRORE!");
      indice += 1;
      const scelto = eVero(condizione) ? seVero : seFalso;
      if (!String(scelto).trim()) return 0;
      return valuta(scelto, tabellaCorrente);
    }

    function eVero(valore) {
      if (typeof valore === "number") return valore !== 0;
      if (valore == null || valore === "") return false;
      const numero = parseNumero(valore);
      if (numero == null) throw new Error("#VALORE!");
      return numero !== 0;
    }

    function ritagliaArgomento() {
      saltaSpazi();
      const inizio = indice;
      let profondita = 0;
      let nelTesto = false;
      while (!fine()) {
        const carattere = guarda();
        if (nelTesto) {
          if (carattere === '"') {
            if (sorgente[indice + 1] === '"') {
              indice += 2;
              continue;
            }
            nelTesto = false;
          }
          indice += 1;
          continue;
        }
        if (carattere === '"') {
          nelTesto = true;
          indice += 1;
          continue;
        }
        if (carattere === "(") {
          profondita += 1;
          indice += 1;
          continue;
        }
        if (carattere === ")") {
          if (profondita === 0) break;
          profondita -= 1;
          indice += 1;
          continue;
        }
        if ((carattere === ";" || carattere === ",") && profondita === 0) break;
        indice += 1;
      }
      return sorgente.slice(inizio, indice).trim();
    }

    function leggiTesto() {
      indice += 1;
      let testo = "";
      while (!fine()) {
        if (guarda() === '"') {
          if (sorgente[indice + 1] === '"') {
            testo += '"';
            indice += 2;
            continue;
          }
          indice += 1;
          return testo;
        }
        testo += guarda();
        indice += 1;
      }
      throw new Error("#ERRORE!");
    }

    function leggiNumero() {
      const trovato = sorgente.slice(indice).match(/^\d+(?:[.,]\d+)?/);
      if (!trovato) throw new Error("#ERRORE!");
      indice += trovato[0].length;
      return Number(trovato[0].replace(",", "."));
    }

    function leggiRiferimento(obbligatorio) {
      saltaSpazi();
      const inizio = indice;
      if (fine() || !/[A-Za-z_]/.test(guarda())) {
        if (obbligatorio) throw new Error("#NOME?");
        return null;
      }
      const ident = leggiIdent();
      saltaSpazi();
      if (!fine() && guarda() === ".") {
        const tabella = ident;
        indice += 1;
        saltaSpazi();
        if (fine() || !/[A-Za-z]/.test(guarda())) {
          indice = inizio;
          if (obbligatorio) throw new Error("#NOME?");
          return null;
        }
        const cella = leggiIdent();
        const indirizzo = analizzaIndirizzo(cella);
        if (!indirizzo) {
          indice = inizio;
          if (obbligatorio) throw new Error("#NOME?");
          return null;
        }
        return { tabella, esplicita: true, ...indirizzo };
      }
      const indirizzo = analizzaIndirizzo(ident);
      if (!indirizzo) {
        indice = inizio;
        if (obbligatorio) throw new Error("#NOME?");
        return null;
      }
      return { tabella: tabellaCorrente, esplicita: false, ...indirizzo };
    }

    function leggiArgomento() {
      saltaSpazi();
      const inizio = indice;
      const partenza = leggiRiferimento(false);
      saltaSpazi();
      if (partenza && !fine() && guarda() === ":") {
        indice += 1;
        const arrivo = leggiRiferimento(false);
        if (!arrivo) throw new Error("#RIF!");
        if (!arrivo.esplicita) arrivo.tabella = partenza.tabella;
        if (partenza.tabella !== arrivo.tabella) throw new Error("#RIF!");
        return numeriIntervallo(partenza, arrivo);
      }
      indice = inizio;
      return [confronto()];
    }

    function numeriIntervallo(partenza, arrivo) {
      const colonnaMin = Math.min(partenza.colonna, arrivo.colonna);
      const colonnaMax = Math.max(partenza.colonna, arrivo.colonna);
      const rigaMin = Math.min(partenza.riga, arrivo.riga);
      const rigaMax = Math.max(partenza.riga, arrivo.riga);
      if ((colonnaMax - colonnaMin + 1) * (rigaMax - rigaMin + 1) > 5000) throw new Error("#RIF!");

      const numeri = [];
      for (let riga = rigaMin; riga <= rigaMax; riga += 1) {
        for (let colonna = colonnaMin; colonna <= colonnaMax; colonna += 1) {
          const etichetta = lettereDaColonna(colonna) + riga;
          const chiave = `${partenza.tabella}.${etichetta}`;
          if (!esiste(chiave)) continue;
          const cella = risolvi(chiave);
          if (cella.errore) throw new Error(cella.errore);
          const numero = numeroSeUtile(cella, partenza.tabella);
          if (numero != null) numeri.push(numero);
        }
      }
      return numeri;
    }

    function valoreDiRiferimento(riferimento) {
      const chiave = `${riferimento.tabella}.${riferimento.etichetta}`;
      if (!esiste(chiave)) throw new Error("#RIF!");
      const cella = risolvi(chiave);
      if (cella.errore) throw new Error(cella.errore);
      if (cella.daFormula && typeof cella.numero === "number" && !cella.testo) return cella.numero;
      if (cella.daFormula && cella.testo) {
        const numero = parseNumero(cella.testo);
        if (numero != null) return typeof cella.numero === "number" ? cella.numero : numero;
        return cella.testo;
      }
      if (cella.daFormula && typeof cella.numero === "number") return cella.numero;
      if (!cella.testo) return 0;
      const numero = parseNumero(cella.testo);
      if (numero != null) return numero;
      if (sembraEspressione(cella.testo)) return valuta(senzaSpazi(cella.testo), riferimento.tabella);
      return cella.testo;
    }

    function calcolaTestoDi(riferimento) {
      const chiave = `${riferimento.tabella}.${riferimento.etichetta}`;
      if (!esiste(chiave)) throw new Error("#RIF!");
      const cella = risolvi(chiave);
      if (cella.errore) throw new Error(cella.errore);
      if (cella.daFormula && typeof cella.numero === "number" && !cella.testo) return cella.numero;
      const testo = String(cella.testo || "").replace(/\s+/g, "");
      if (!testo) return 0;
      return valuta(testo, riferimento.tabella);
    }

    function numeroSeUtile(cella, tabella) {
      if (cella.daFormula && typeof cella.numero === "number") return cella.numero;
      if (!cella.testo) return null;
      const numero = parseNumero(cella.testo);
      if (numero != null || cella.daFormula || !sembraEspressione(cella.testo)) return numero;
      return valuta(senzaSpazi(cella.testo), tabella);
    }

    function testoPuro(valore) {
      if (typeof valore !== "string" || valore === "") return false;
      return parseNumero(valore) == null;
    }

    function comeTesto(valore) {
      if (valore == null) return "";
      return String(valore);
    }

    function comeNumeroConfronto(valore) {
      if (typeof valore === "number") return valore;
      if (valore == null || valore === "") return 0;
      const numero = parseNumero(valore);
      if (numero == null) throw new Error("#VALORE!");
      return numero;
    }

    function confronta(sinistra, destra, operatore) {
      const sinistraTesto = testoPuro(sinistra);
      const destraTesto = testoPuro(destra);
      let ordine = 0;
      if (sinistraTesto && destraTesto) {
        ordine = comeTesto(sinistra).localeCompare(comeTesto(destra), "it", { sensitivity: "accent" });
      } else if (sinistraTesto) {
        ordine = 1;
      } else if (destraTesto) {
        ordine = -1;
      } else {
        const a = comeNumeroConfronto(sinistra);
        const b = comeNumeroConfronto(destra);
        ordine = a === b ? 0 : a < b ? -1 : 1;
      }
      if (operatore === "=") return ordine === 0;
      if (operatore === "<>") return ordine !== 0;
      if (operatore === ">") return ordine > 0;
      if (operatore === "<") return ordine < 0;
      if (operatore === ">=") return ordine >= 0;
      if (operatore === "<=") return ordine <= 0;
      throw new Error("#ERRORE!");
    }

    function chiama(nome, valori) {
      const numeri = valori.map((valore) => comeNumero(valore));
      const funzione = nome.toUpperCase();
      if (funzione === "SOMMA" || funzione === "SUM") return numeri.reduce((a, b) => a + b, 0);
      if (funzione === "MEDIA" || funzione === "AVERAGE") {
        if (!numeri.length) throw new Error("#DIV/0!");
        return numeri.reduce((a, b) => a + b, 0) / numeri.length;
      }
      if (funzione === "MIN") {
        if (!numeri.length) throw new Error("#VALORE!");
        return Math.min(...numeri);
      }
      if (funzione === "MAX") {
        if (!numeri.length) throw new Error("#VALORE!");
        return Math.max(...numeri);
      }
      if (funzione === "CONTA" || funzione === "COUNT") return numeri.length;
      if (funzione === "ARROTONDA" || funzione === "ROUND") {
        if (numeri.length < 1 || numeri.length > 2) throw new Error("#VALORE!");
        const cifre = numeri.length === 2 ? numeri[1] : 0;
        if (!Number.isInteger(cifre) || cifre < 0 || cifre > 10) throw new Error("#VALORE!");
        return arrotonda(numeri[0], cifre);
      }
      throw new Error("#NOME?");
    }

    const valore = confronto();
    saltaSpazi();
    if (!fine()) throw new Error("#ERRORE!");
    if (typeof valore === "string") return valore;
    if (typeof valore !== "number" || !Number.isFinite(valore)) throw new Error("#NUM!");
    return valore;
  }

  const risultati = {};
  for (const chiave of Object.keys(grezze)) risultati[chiave] = risolvi(chiave);
  return risultati;
}
