// Mostra la riga della formula solo quando è selezionata una cella di tabella.
// Il campo formula è attivo proprio quando c'è una cella selezionata: basta guardare quello.

export function avviaBarraFormula() {
  const formula = document.getElementById("formula");
  const aggiorna = () => {
    const visibile = !formula.disabled;
    mostra(visibile);
    if (!visibile) chiudiElenco();
  };
  new MutationObserver(aggiorna).observe(formula, { attributes: true, attributeFilter: ["disabled"] });
  aggiorna();
  avviaElencoFormule();
}

function avviaElencoFormule() {
  const formula = document.getElementById("formula");
  const bottone = document.getElementById("btn-formule");
  const pannello = document.getElementById("pannello-formule");
  const contenitore = bottone.closest(".elenco-formule");

  contenitore.addEventListener("mousedown", (evento) => evento.preventDefault());
  bottone.addEventListener("click", () => {
    if (pannello.hidden) apriElenco();
    else chiudiElenco();
  });
  pannello.addEventListener("click", (evento) => {
    const voce = evento.target.closest("[data-esempio]");
    if (!voce || formula.disabled) return;
    formula.value = voce.dataset.esempio;
    formula.focus();
    formula.select();
    document.dispatchEvent(new Event("salva-formula-cella"));
    chiudiElenco();
  });
  document.addEventListener("mousedown", (evento) => {
    if (pannello.hidden || contenitore.contains(evento.target)) return;
    chiudiElenco();
  });
  document.addEventListener("keydown", (evento) => {
    if (evento.key !== "Escape" || pannello.hidden) return;
    evento.preventDefault();
    evento.stopPropagation();
    chiudiElenco();
  }, true);
}

function apriElenco() {
  const bottone = document.getElementById("btn-formule");
  const pannello = document.getElementById("pannello-formule");
  pannello.hidden = false;
  bottone.setAttribute("aria-expanded", "true");
}

function chiudiElenco() {
  const bottone = document.getElementById("btn-formule");
  const pannello = document.getElementById("pannello-formule");
  if (!bottone || !pannello || pannello.hidden) return;
  pannello.hidden = true;
  bottone.setAttribute("aria-expanded", "false");
}

// Quando la riga compare o sparisce il foglio si sposterebbe in su o in giù:
// si corregge lo scorrimento, così la tabella resta ferma sotto il mouse.
function mostra(visibile) {
  const barra = document.getElementById("barra-formula");
  if (barra.classList.contains("nascosta") === !visibile) return;
  const scrivania = document.getElementById("scrivania");
  const prima = scrivania.getBoundingClientRect().top;
  barra.classList.toggle("nascosta", !visibile);
  scrivania.scrollTop += scrivania.getBoundingClientRect().top - prima;
}
