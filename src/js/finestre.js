// Finestre semplici per chiedere dati all'utente.

export function chiedi({ titolo, testo = "", campi = [], conferma = "Ok", controlla = null }) {
  return new Promise((resolve) => {
    const sfondo = document.createElement("div");
    sfondo.className = "finestra-sfondo";
    const form = document.createElement("form");
    form.className = "finestra";

    const h2 = document.createElement("h2");
    h2.textContent = titolo;
    form.append(h2);

    if (testo) {
      const p = document.createElement("p");
      p.textContent = testo;
      form.append(p);
    }

    for (const campo of campi) {
      const etichetta = document.createElement(campo.tipo === "caselle" ? "div" : "label");
      etichetta.className = "campo";
      etichetta.textContent = campo.etichetta;
      if (campo.tipo === "caselle") {
        const gruppo = document.createElement("div");
        gruppo.className = "caselle";
        for (const opzione of campo.opzioni) {
          const voce = document.createElement("label");
          const box = document.createElement("input");
          box.type = "checkbox";
          box.name = campo.nome;
          box.value = opzione.valore;
          box.checked = Boolean(opzione.scelto);
          voce.append(box, document.createTextNode(` ${opzione.testo}`));
          gruppo.append(voce);
        }
        etichetta.append(gruppo);
        form.append(etichetta);
        continue;
      }
      let controllo;
      if (campo.tipo === "select") {
        controllo = document.createElement("select");
        for (const opzione of campo.opzioni) {
          const voce = document.createElement("option");
          voce.value = opzione.valore;
          voce.textContent = opzione.testo;
          controllo.append(voce);
        }
      } else if (campo.tipo === "area") {
        controllo = document.createElement("textarea");
        controllo.rows = 4;
      } else {
        controllo = document.createElement("input");
        controllo.type = campo.tipo || "text";
      }
      controllo.name = campo.nome;
      controllo.value = campo.valore ?? "";
      if (campo.min != null) controllo.min = campo.min;
      if (campo.max != null) controllo.max = campo.max;
      etichetta.append(controllo);
      form.append(etichetta);
    }

    const errore = document.createElement("div");
    errore.className = "errore-finestra";
    form.append(errore);

    const azioni = document.createElement("div");
    azioni.className = "finestra-azioni";
    const annulla = document.createElement("button");
    annulla.type = "button";
    annulla.textContent = "Annulla";
    const ok = document.createElement("button");
    ok.type = "submit";
    ok.className = "primario";
    ok.textContent = conferma;
    azioni.append(annulla, ok);
    form.append(azioni);
    sfondo.append(form);
    document.body.append(sfondo);

      const primo = form.querySelector("input, select, textarea");
    if (primo) primo.focus();

    function chiudi(valore) {
      sfondo.remove();
      resolve(valore);
    }

    annulla.addEventListener("click", () => chiudi(null));
    sfondo.addEventListener("mousedown", (evento) => {
      if (evento.target === sfondo) chiudi(null);
    });
    form.addEventListener("keydown", (evento) => {
      if (evento.key === "Escape") {
        evento.preventDefault();
        chiudi(null);
      }
    });
    form.addEventListener("submit", (evento) => {
      evento.preventDefault();
      const dati = {};
      for (const campo of campi) {
        if (campo.tipo === "caselle") {
          dati[campo.nome] = [...form.querySelectorAll(`input[name="${campo.nome}"]:checked`)].map((el) => el.value);
        } else {
          dati[campo.nome] = form.elements[campo.nome].value;
        }
      }
      if (controlla) {
        const messaggio = controlla(dati);
        if (messaggio) {
          errore.textContent = messaggio;
          return;
        }
      }
      chiudi(campi.length ? dati : true);
    });
  });
}

export function avvisa(testo) {
  return chiedi({ titolo: "Attenzione", testo, conferma: "Ho capito" });
}

export function conferma(testo) {
  return chiedi({ titolo: "Conferma", testo, conferma: "Sì" });
}
