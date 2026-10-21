use tauri::AppHandle;
use tauri_plugin_dialog::DialogExt;

// Apre la finestra di Windows e salva i byte nel percorso scelto.
#[tauri::command]
fn salva_file(
    app: AppHandle,
    nome: String,
    nome_filtro: String,
    estensione: String,
    byte: Vec<u8>,
) -> Result<bool, String> {
    let scelto = app
        .dialog()
        .file()
        .set_title("Salva")
        .set_file_name(&nome)
        .add_filter(&nome_filtro, &[estensione.as_str()])
        .blocking_save_file();

    let Some(percorso) = scelto else {
        return Ok(false);
    };

    let path = percorso
        .into_path()
        .map_err(|_| "Percorso non valido".to_string())?;

    if let Some(cartella) = path.parent() {
        std::fs::create_dir_all(cartella)
            .map_err(|errore| format!("Non riesco a creare la cartella: {errore}"))?;
    }

    std::fs::write(&path, byte)
        .map_err(|errore| format!("Non riesco a salvare il file: {errore}"))?;
    Ok(true)
}

// Apre la finestra di Windows e legge un file di testo.
// Il primo filtro mostra .lrd e, se c'è, anche l'estensione vecchia .relazione.
#[tauri::command]
fn apri_file(
    app: AppHandle,
    nome_filtro: String,
    estensioni: Vec<String>,
) -> Result<Option<String>, String> {
    let mut dialogo = app.dialog().file().set_title("Apri");
    let filtri: Vec<&str> = estensioni.iter().map(String::as_str).collect();
    if filtri.len() > 1 {
        let nome = estensioni
            .iter()
            .map(|estensione| format!("*.{estensione}"))
            .collect::<Vec<_>>()
            .join("; ");
        dialogo = dialogo.add_filter(nome, &filtri);
    }
    for estensione in &estensioni {
        dialogo = dialogo.add_filter(format!("*.{estensione}"), &[estensione.as_str()]);
    }
    if estensioni.is_empty() {
        dialogo = dialogo.add_filter(nome_filtro, &["*"]);
    }
    let scelto = dialogo.blocking_pick_file();

    let Some(percorso) = scelto else {
        return Ok(None);
    };

    let path = percorso
        .into_path()
        .map_err(|_| "Percorso non valido".to_string())?;

    let testo = std::fs::read_to_string(&path)
        .map_err(|errore| format!("Non riesco a leggere il file: {errore}"))?;
    Ok(Some(testo))
}

// Legge i font installati sul computer e restituisce i nomi delle famiglie, in ordine e senza doppioni.
// È async così Tauri la esegue fuori dalla finestra: leggere tanti font richiede un attimo.
#[tauri::command]
async fn elenco_font() -> Vec<String> {
    let mut database = fontdb::Database::new();
    database.load_system_fonts();
    let mut nomi: Vec<String> = database
        .faces()
        .filter_map(|faccia| {
            faccia
                .families
                .first()
                .map(|(nome, _)| nome.trim().to_string())
        })
        .filter(|nome| !nome.is_empty() && !nome.starts_with('@'))
        .collect();
    nomi.sort_by_key(|nome| nome.to_lowercase());
    nomi.dedup_by(|a, b| a.eq_ignore_ascii_case(b));
    nomi
}

// Apre un collegamento nel browser o nel programma di posta predefinito.
// Accetta solo indirizzi web e di posta, così non si possono avviare programmi.
#[tauri::command]
fn apri_collegamento(indirizzo: String) -> Result<(), String> {
    let minuscolo = indirizzo.to_lowercase();
    let permesso = ["http://", "https://", "mailto:"]
        .iter()
        .any(|inizio| minuscolo.starts_with(inizio));
    if !permesso {
        return Err("Si possono aprire solo indirizzi web o e-mail.".to_string());
    }

    #[cfg(target_os = "windows")]
    let risultato = std::process::Command::new("rundll32")
        .args(["url.dll,FileProtocolHandler", &indirizzo])
        .spawn();
    #[cfg(target_os = "macos")]
    let risultato = std::process::Command::new("open").arg(&indirizzo).spawn();
    #[cfg(all(unix, not(target_os = "macos")))]
    let risultato = std::process::Command::new("xdg-open")
        .arg(&indirizzo)
        .spawn();

    risultato
        .map(|_| ())
        .map_err(|errore| format!("Non riesco ad aprire il collegamento: {errore}"))
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            salva_file,
            apri_file,
            elenco_font,
            apri_collegamento
        ])
        .run(tauri::generate_context!())
        .expect("errore durante l'avvio di Lord");
}
