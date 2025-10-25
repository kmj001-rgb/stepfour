// sidebar.js
let imageGroups = new Map();
let selectedImages = new Set();
let firstClickRescan = false;
let waitingForLoadRescan = false;
// Imposta lo stato iniziale della cache
let cacheEnabled = true;
// Recupera la lingua salvata da chrome.storage all'avvio
let currentLanguage = 'en';
let currentProgress = 0;
let currentCompletedFiles = 0;
let currentTotalFiles = 0;
let currentCompletedBatches = 0;
let currentTotalBatches = 0;
let html2canvasEnabled = false; // Inizializzato a false
let restartMessageTimeout = null;
let isExperimentalLoading = false;
let experimentalButton = null;
let isScanInProgress = false;
let scanInterruptedMessage = null;
let isPaused = false;
let currentTabId = null;
let deepScanEnabled = false; // Default state
let showSearchWithGoogleButton = true; // Default to true
let preserveOriginalName = false; // Default to false - Non preservare i nomi originali dei file

// Add translations for scan interrupted message
const scanInterruptedTranslations = {
    en: "Scan interrupted by user",
    it: "Scansione interrotta dall'utente",
    es: "Escaneo interrumpido por el usuario",
    fr: "Analyse interrompue par l'utilisateur",
    de: "Scan vom Benutzer unterbrochen"
};



document.addEventListener('DOMContentLoaded', () => {
    // Ottieni il tabId corrente dalla URL della sidepanel
    const urlParams = new URLSearchParams(window.location.search);
    currentTabId = parseInt(urlParams.get('tabId'));
    console.log('Sidepanel initialized for tab:', currentTabId);

    

    experimentalButton = document.getElementById('experimental-button');
     const loadingOverlay = document.getElementById('loading-overlay');
     loadingOverlay.style.display = 'none'; // Non mostrare l'overlay inizialmente
 
     setupEventListeners();

    // Add this new section to properly initialize deep scan state
    const deepScanToggle = document.getElementById('deep-scan-toggle');
    
    // Set initial state to false when element is found
    if (deepScanToggle) {
        deepScanToggle.checked = false;
        // Update storage to match UI state
        chrome.storage.local.set({ deepScanEnabled: false }, () => {
            console.log('Deep scan disabled on panel load');
        });
    }

    // Load search with Google setting
    chrome.storage.local.get('showSearchWithGoogleButton', (result) => {
        if (result.showSearchWithGoogleButton !== undefined) {
            showSearchWithGoogleButton = result.showSearchWithGoogleButton;
        }
        document.getElementById('search-with-google-toggle').checked = showSearchWithGoogleButton;
    });

    // Load preserve original name setting
    chrome.storage.local.get('preserveOriginalName', (result) => {
        if (result.preserveOriginalName !== undefined) {
            preserveOriginalName = result.preserveOriginalName;
        }
        document.getElementById('preserve-original-name-toggle').checked = preserveOriginalName;
    });
 });
 

// Dichiarazione delle variabili globali per la barra del progresso
const progressContainer = document.getElementById('progress-container');
const progressBar = document.getElementById('progress-bar');
const progressText = document.getElementById('progress-text');




// Recupera lo stato di html2canvas da chrome.storage all'avvio
chrome.storage.local.get('html2canvasEnabled', (result) => {
    if (result.html2canvasEnabled !== undefined) {
        html2canvasEnabled = result.html2canvasEnabled;
    }
    document.getElementById('html2canvas-toggle').checked = html2canvasEnabled;
});
// Listener per la checkbox di html2canvas
document.getElementById('html2canvas-toggle').addEventListener('change', (event) => {
    html2canvasEnabled = event.target.checked;
    // Salva lo stato di html2canvas in chrome.storage
    chrome.storage.local.set({ html2canvasEnabled: html2canvasEnabled }, () => {
        console.log(`html2canvas ${html2canvasEnabled ? 'attivato' : 'disattivato'}`);
    });

    // Mostra il messaggio
    const restartMessage = document.getElementById('restart-message');
    restartMessage.style.display = 'block';

    // Cancella il timeout precedente se esistente
    if (restartMessageTimeout) {
        clearTimeout(restartMessageTimeout);
    }

    // Imposta il timeout per nascondere il messaggio
    restartMessageTimeout = setTimeout(() => {
        restartMessage.style.display = 'none';
    }, 5000); // 5 secondi
});



// Recupera lo stato di deep scan da chrome.storage all'avvio
// chrome.storage.local.get('deepScanEnabled', (result) => {
//     if (result.deepScanEnabled !== undefined) {
//         deepScanEnabled = result.deepScanEnabled;
//     }
//     document.getElementById('deep-scan-toggle').checked = deepScanEnabled;
// });

// Listener per la checkbox di deep scan
document.getElementById('deep-scan-toggle').addEventListener('change', (event) => {
    const isEnabled = event.target.checked;
    deepScanEnabled = isEnabled;
    
    // Save state to storage
    chrome.storage.local.set({ deepScanEnabled: isEnabled }, () => {
        console.log(`Deep scan ${isEnabled ? 'enabled' : 'disabled'}`);
    });

    // Show restart message
    const restartMessage = document.getElementById('restart-message');
    restartMessage.style.display = 'block';

    // Clear previous timeout if exists
    if (restartMessageTimeout) {
        clearTimeout(restartMessageTimeout);
    }

    // Set new timeout to hide message
    restartMessageTimeout = setTimeout(() => {
        restartMessage.style.display = 'none';
    }, 5000);
});


chrome.storage.local.get('language', (result) => {
    if (result.language) {
        currentLanguage = result.language;
    }
    document.getElementById('language-select').value = currentLanguage;
    applyTranslations(currentLanguage);
    updateTooltips(currentLanguage);
});


document.getElementById('language-select').addEventListener('change', (event) => {
    currentLanguage = event.target.value;
    applyTranslations(currentLanguage);
    updateTooltips(currentLanguage);
    updateExtractButtonState(); // Aggiorna il tooltip del pulsante "Estrai"

    // Salva la lingua scelta in chrome.storage
    chrome.storage.local.set({ language: currentLanguage }, () => {
        console.log(`Lingua impostata su ${currentLanguage}`);
    });
});


document.getElementById('disable-download-limits').addEventListener('change', (event) => {
    const disableLimits = event.target.checked;

    if (disableLimits) {
        alert(translations[currentLanguage]["disable-limits-warning"]);
            document.body.classList.add('disable-limits');
    } else {
        document.body.classList.remove('disable-limits');
    }

    // Salva lo stato dell'impostazione in chrome.storage
    chrome.storage.local.set({ disableDownloadLimits: disableLimits }, () => {
        console.log(`Limiti di download ${disableLimits ? 'disabilitati' : 'abilitati'}`);
    });

    // Aggiorna lo stato dei pulsanti
    updateExtractButtonState();
});

// Recupera lo stato dell'impostazione all'avvio
chrome.storage.local.get('disableDownloadLimits', (result) => {
    if (result.disableDownloadLimits !== undefined) {
        document.getElementById('disable-download-limits').checked = result.disableDownloadLimits;
        if (result.disableDownloadLimits) {
            document.body.classList.add('disable-limits');
        }
    }
});


const translations = {
    en: {
        // Static texts
        "images-found": "IMAGES FOUND:",
        "images-selected": "IMAGES SELECTED:",
        "select-all": "Select All",
        "deselect-all": "Deselect All",
        "reset": "Reset",
        "close-panel": "Close",
        "extract-selected": "Extract",
        "save-as-zip": "Save as Zip",
        "rescan": "Scan Page",
        "cache-enabled": "Cache enabled",
        "settings-button": "Settings",
        "language": "Language:",
        "width": "Width:",
        "height": "Height:",
        "experimental-button": "Load Full Gallery (Experimental)",
        "preview-gallery-scroll": "Hide Gallery Scroll",
        "restart-required": "(New setting will apply on next load)",
        "pause-download": "Pause",
        "stop-download": "Stop",
        "resume-download": "Resume",
        "extract-disabled-tooltip": "For more than 200 images,\nuse 'Save as Zip'\nto ensure a reliable download.",
        "save-as-zip-disabled-tooltip": "For more than 2000 images, \nthe download is not allowed due to performance reasons.",
        "disable-download-limits": "Disable download limits (experimental)",
        "disable-limits-warning": "Warning: Disabling download limits may cause performance issues or crashes. Use at your own risk.",
        "new-version-installed": "New version installed",
        "clean-scan": "Keep scanned images",
        "new-images-found": "New images found",
        "images": "IMAGES",
        "found": "FOUND",
        "selected": "SELECTED",
        "deep-scan-enabled": "Deep Scan",
        "search-with-google": "Search with Google",
        "search-with-google-enabled": "Show 'Search with Google' buttons",
        "preserve-original-name": "Preserve original filenames",


        // Dynamic texts
        "download-error": "Download error:",
        "retry-download": "Retry",
        "cancel-download": "Ignore file",
        "download-in-progress": "DOWNLOAD IN PROGRESS",
        "scan-in-progress": "SCAN IN PROGRESS",
        "thumbnail-alt": "Thumbnail",
        "no-images-found": "No images found",
        "confirm-zip-name": "Enter a base name for the ZIP file (default: images):",
        "confirm-individual-name": "Enter a base name for the files (default: image):",
        "no-images-selected": "No images selected!",
        "scan-interrupted": "Scan interrupted by user",
        "original": "ORIGINAL",
        "open-new-tab": "Open in new tab", 
    },
    it: {
        // Testi statici
        "images-found": "IMMAGINI TROVATE:",
        "images-selected": "IMMAGINI SELEZIONATE:",
        "select-all": "Seleziona Tutte",
        "deselect-all": "Deseleziona Tutte",
        "reset": "Reset",
        "close-panel": "Chiudi",
        "extract-selected": "Estrai",
        "save-as-zip": "Salva come Zip",
        "rescan": "Scansiona pagina",
        "cache-enabled": "Cache attiva",
        "settings-button": "Impostazioni",
        "language": "Lingua:",
        "width": "Larghezza:",
        "height": "Altezza:",
        "experimental-button": "Carica Galleria Completa (Sperimentale)",
        "preview-gallery-scroll": "Nascondi scroll galleria",
        "restart-required": "(La nuova impostazione sarà attiva al prossimo caricamento)",
        "pause-download": "Pausa",
        "stop-download": "Stop",
        "resume-download": "Riprendi",
        "extract-disabled-tooltip": "Per più di 200 immagini,\nusa 'Salva come Zip'\nper un download affidabile.",
        "save-as-zip-disabled-tooltip": "Per più di 2000 immagini, \nil download non è consentito per motivi di prestazioni.",
        "disable-download-limits": "Disabilita limiti di download (sperimentale)",
        "disable-limits-warning": "Attenzione: Disabilitare i limiti di download potrebbe causare problemi di prestazioni o crash. Usa a tuo rischio.",
        "new-version-installed": "Nuova versione installata",
        "clean-scan": "Conserva immagini scansionate",
        "new-images-found": "Trovate nuove immagini",
        "images": "IMMAGINI",
        "found": "TROVATE",
        "selected": "SELEZIONATE",
        "deep-scan-enabled": "Scansione Profonda",
        "search-with-google": "Cerca con Google",
        "search-with-google-enabled": "Mostra pulsante 'Cerca con Google'",
        "preserve-original-name": "Mantieni nomi file originali",


        // Testi dinamici
        "download-error": "Errore durante il download:",
        "download-in-progress": "DOWNLOAD IN CORSO",
        "scan-in-progress": "SCANSIONE IN CORSO",
        "thumbnail-alt": "Anteprima",
        "no-images-found": "Nessuna immagine trovata",
        "confirm-zip-name": "Inserisci un nome base per il file ZIP (default: images):",
        "confirm-individual-name": "Inserisci un nome base per i file (default: image):",
        "no-images-selected": "Nessuna immagine selezionata!",
        "scan-interrupted": "Scansione interrotta dall'utente",
        "original": "ORIGINALE",
        "open-new-tab": "Apri in nuova scheda",
    },
    es: {
        // Textos estáticos
        "images-found": "IMÁGENES ENCONTRADAS:",
        "images-selected": "IMÁGENES SELECCIONADAS:",
        "select-all": "Seleccionar Todas",
        "deselect-all": "Deseleccionar Todas",
        "reset": "Reiniciar",
        "close-panel": "Cerrar el panel",
        "extract-selected": "Extraer selección",
        "save-as-zip": "Guardar como archivo Zip",
        "rescan": "Escanear Página",
        "cache-enabled": "Caché activada",
        "settings-button": "Configuración",
        "language": "Idioma:",
        "width": "Ancho:",
        "height": "Altura:",
        "experimental-button": "Cargar Galería Completa (Experimental)",
        "preview-gallery-scroll": "Ocultar desplazamiento de la galería",
        "restart-required": "(La nueva configuración se aplicará en la próxima carga)",
        "pause-download": "Pausa",
        "stop-download": "Stop",
        "resume-download": "Reanudar",
        "extract-disabled-tooltip": "Para más de 200 imágenes,\nusa 'Guardar como Zip'\npara una descarga fiable.",
        "save-as-zip-disabled-tooltip": "Para más de 2000 imágenes, \nla descarga no está permitida por motivos de rendimiento.",
        "disable-download-limits": "Desactivar límites de descarga (experimental)",
        "disable-limits-warning": "Advertencia: Desactivar los límites de descarga puede causar problemas de rendimiento o fallos. Úsalo bajo tu propio riesgo.",
         "new-version-installed": "Nueva versión instalada",
        "clean-scan": "Mantener imágenes escaneadas",
        "new-images-found": "Nuevas imágenes encontradas",
        "images": "IMÁGENES",
        "found": "ENCONTRADAS",
        "selected": "SELECCIONADAS",
        "deep-scan-enabled": "Escaneo Profundo",
        "search-with-google": "Buscar con Google",
        "search-with-google-enabled": "Mostrar botones 'Buscar con Google'",
        "preserve-original-name": "Conservar nombres de archivo originales",


        // Textos dinámicos
        "download-error": "Error en la descarga:",
        "retry-download": "Reintentar",
        "cancel-download": "Ignorar archivo",
        "download-in-progress": "DESCARGANDO",
        "scan-in-progress": "ESCANEANDO",
        "thumbnail-alt": "Miniatura",
        "no-images-found": "No se encontraron imágenes",
        "confirm-zip-name": "Introduce un nombre base para el archivo ZIP (predeterminado: images):",
        "confirm-individual-name": "Introduce un nombre base para los archivos (predeterminado: image):",
        "no-images-selected": "¡No se han seleccionado imágenes!",
        "scan-interrupted": "Escaneo interrumpido por el usuario",
        "original": "ORIGINAL",
        "open-new-tab": "Abrir en una nueva pestaña",
    },
    fr: {
        // Textes statiques
        "images-found": "IMAGES TROUVÉES:",
        "images-selected": "IMAGES SÉLECTIONNÉES:",
        "select-all": "Tout sélectionner",
        "deselect-all": "Tout désélectionner",
        "reset": "Réinitialiser",
        "close-panel": "Fermer le panneau",
        "extract-selected": "Extraire la sélection",
        "save-as-zip": "Enregistrer sous forme de fichier Zip",
        "rescan": "Analyser la page",
        "cache-enabled": "Cache activée",
        "settings-button": "Paramètres",
        "language": "Langue:",
        "width": "Largeur:",
        "height": "Hauteur:",
        "experimental-button": "Charger Galerie Complète (Expérimental)",
        "preview-gallery-scroll": "Masquer le défilement de la galerie",
        "restart-required": "(Le nouveau réglage sera appliqué au prochain chargement)",
        "pause-download": "Pausa",
        "stop-download": "Stop",
        "resume-download": "Reprendre",
        "extract-disabled-tooltip": "Pour plus de 200 images,\nutilisez 'Enregistrer sous Zip'\npour un téléchargement fiable.",
        "save-as-zip-disabled-tooltip": "Pour plus de 2000 images, \nle téléchargement n'est pas autorisé pour des raisons de performance.",
        "disable-download-limits": "Désactiver les limites de téléchargement (expérimental)",
        "disable-limits-warning": "Attention : Désactiver les limites de téléchargement peut causer des problèmes de performance ou des plantages. Utilisez à vos risques et périls.",
         "new-version-installed": "Nouvelle version installée",
        "clean-scan": "Conserver les images numérisées",
        "new-images-found": "Nouvelles images trouvées",
        "images": "IMAGES",
        "found": "TROUVÉES",
        "selected": "SÉLECTIONNÉES",
        "deep-scan-enabled": "Scan Approfondi",
        "search-with-google": "Rechercher avec Google",
        "search-with-google-enabled": "Afficher les boutons 'Rechercher avec Google'",
        "preserve-original-name": "Conserver les noms de fichiers originaux",


        // Textes dynamiques
        "download-error": "Erreur de téléchargement:",
        "retry-download": "Réessayer",
        "cancel-download": "Ignorer le fichier",
        "download-in-progress": "TÉLÉCHARGEMENT EN COURS",
        "scan-in-progress": "ANALYSE EN COURS",
        "thumbnail-alt": "Vignette",
        "no-images-found": "Aucune image trouvée",
        "confirm-zip-name": "Entrez un nom de base pour le fichier ZIP (par défaut: images):",
        "confirm-individual-name": "Entrez un nom de base pour les fichiers (par défaut: image):",
        "no-images-selected": "Aucune image sélectionnée !",
        "scan-interrupted": "Analyse interrompue par l'utilisateur",
        "original": "ORIGINAL",
        "open-new-tab": "Ouvrir dans un nouvel onglet",
    },
    de: {
        // Statische Texte
        "images-found": "BILDER GEFUNDEN:",
        "images-selected": "BILDER AUSGEWÄHLT:",
        "select-all": "Alle auswählen",
        "deselect-all": "Alle abwählen",
        "reset": "Zurücksetzen",
        "close-panel": "Panel schließen",
        "extract-selected": "Auswahl extrahieren",
        "save-as-zip": "Als Zip-Datei speichern",
        "rescan": "Seite scannen",
        "cache-enabled": "Zwischenspeicher aktiviert",
        "settings-button": "Einstellungen",
        "language": "Sprache:",
        "width": "Breite:",
        "height": "Höhe:",
        "experimental-button": "Galerie Vollständig Laden (Experimentell)",
        "preview-gallery-scroll": "Galerie-Scrollen deaktivieren",
        "restart-required": "(Die neue Einstellung wird beim nächsten Laden angewendet)",
        "pause-download": "Pause",
        "stop-download": "Stop",
        "resume-download": "Fortsetzen",
        "extract-disabled-tooltip": "Für mehr als 200 Bilder,\nverwende 'Als Zip speichern'\nfür einen zuverlässigen Download.",
        "save-as-zip-disabled-tooltip": "Für mehr als 2000 Bilder, \nist der Download aus Leistungsgründen nicht erlaubt.",
        "disable-download-limits": "Galerie-Scrollen ausblenden",
        "disable-limits-warning": "Warnung: Das Deaktivieren der Download-Grenzen kann zu Leistungsproblemen oder Abstürzen führen. Nutzung auf eigene Gefahr.",
        "new-version-installed": "Neue Version installiert",
        "clean-scan": "Gescannte Bilder behalten",
        "new-images-found": "Neue Bilder gefunden",
        "images": "BILDER",
        "found": "GEFUNDEN",
        "selected": "AUSGEWÄHLT",
        "deep-scan-enabled": "Tiefen-Scan",
        "search-with-google": "Mit Google suchen",
        "search-with-google-enabled": "Schaltflächen 'Mit Google suchen' anzeigen",
        "preserve-original-name": "Originale Dateinamen beibehalten",


        // Dynamische Texte
        "download-error": "Download-Fehler:",
        "retry-download": "Erneut versuchen",
        "cancel-download": "Datei ignorieren",
        "download-in-progress": "DOWNLOAD IM GANGE",
        "scan-in-progress": "SCAN VORGANG",
        "thumbnail-alt": "Vorschaubild",
        "no-images-found": "Keine Bilder gefunden",
        "confirm-zip-name": "Geben Sie einen Basisnamen für die ZIP-Datei ein (Standard: images):",
        "confirm-individual-name": "Geben Sie einen Basisnamen für die Dateien ein (Standard: image):",
        "no-images-selected": "Keine Bilder ausgewählt!",
        "scan-interrupted": "Scan vom Benutzer unterbrochen",
        "original": "ORIGINAL",
        "open-new-tab": "In neuem Tab öffnen",
    }
};


const tooltips = {
    en: {
        "cache-tooltip": "CACHE ENABLED (default option)\nSpeeds up subsequent scans.\nMay show fewer variants.\n\nCACHE DISABLED\nAlways performs a full scan.\nSlower but more precise scan.",
       "gallery-preview-tooltip": "When selected, the gallery scroll is hidden.\nWhen unselected, the gallery scroll is visible.",
       "open-new-tab-tooltip": "Open in new tab \nOpens the selected image from the dropdown menu in a new tab.",
       "clean-scan-tooltip": "When \"keep scanned images\" is selected\nyou will keep found images between scans \non same or different pages inside this tab.\n ALSO: You can use this to add single images\nwhen you right click and extract a specific image.",
       "deep-scan-tooltip": "When enabled, all sites are scanned with simplified logic.\nFinds more image variants but might group fewer similar images together.",
       "preserve-original-name-tooltip": "When checked, files will be downloaded with their original filenames.\nWhen unchecked, you'll be asked to provide a base name for downloaded files.",
    },
    it: {
        "cache-tooltip": "CACHE ATTIVA (opzione di default)\nVelocizza scansioni successive.\nPotrebbe mostrare meno varianti.\n\nCACHE DISATTIVATA\nEsegue sempre una scansione completa.\nScansione più lenta ma più precisa.",
        "gallery-preview-tooltip": "Quando è selezionato, lo scroll della galleria è nascosto.\nQuando è disabilitato, lo scroll della galleria è visibile.",
        "open-new-tab-tooltip": "Apri in nuova scheda \nApre l'immagine selezionata nel menu a tendina in una nuova scheda.",
        "clean-scan-tooltip": "Quando \"conserva immagini scansionate\" è selezionato\nmanterrai le immagini trovate \ntra le scansioni su pagine uguali o diverse all'interno di questa scheda.\n INOLTRE: puoi anche usarlo per aggiungere singole immagini\nquando fai clic destro ed estrai un'immagine specifica.",
        "deep-scan-tooltip": "Quando attiva, tutti i siti vengono scansionati con logica semplificata.\nTrova più varianti di immagini ma potrebbe raggruppare meno immagini simili.",
        "preserve-original-name-tooltip": "Quando selezionato, i file verranno scaricati con i loro nomi originali.\nQuando non selezionato, ti verrà chiesto di fornire un nome base per i file scaricati.",
    },
     es: {
         "cache-tooltip": "CACHÉ ACTIVADA (opción predeterminada)\nAcelera escaneos posteriores.\nPodría mostrar menos variantes.\n\nCACHÉ DESACTIVADA\nSiempre realiza un escaneo completo.\nEscaneo más lento pero más preciso.",
          "gallery-preview-tooltip": "Cuando está seleccionado, el desplazamiento de la galería está oculto.\nCuando no está seleccionado, el desplazamiento de la galería es visible.",
          "open-new-tab-tooltip": "Abrir en una nueva pestaña \n Abre la imagen seleccionada en el menú desplegable en una nueva pestaña.", 
          "clean-scan-tooltip": "Cuando \"mantener imágenes escaneadas\" está seleccionado\nmantendrás las imágenes encontradas \nentre escaneos en páginas iguales o diferentes dentro de esta pestaña.\ntambién puedes usarlo para agregar imágenes individuales\ncuando haces clic derecho y extraes una imagen específica.",
          "deep-scan-tooltip": "Cuando está activado, todos los sitios se escanean con lógica simplificada.\nEncuentra más variantes de imágenes pero podría agrupar menos imágenes similares.",
          "preserve-original-name-tooltip": "Cuando está marcado, los archivos se descargarán con sus nombres originales.\nCuando no está marcado, se te pedirá que proporciones un nombre base para los archivos descargados.",
    },
     fr: {
         "cache-tooltip": "CACHE ACTIVÉE (option par défaut)\nAccélère les analyses ultérieures.\nPourrait afficher moins de variantes.\n\nCACHE DÉSACTIVÉE\nEffectue toujours une analyse complète.\nAnalyse plus lente mais plus précise.",
        "gallery-preview-tooltip": "Lorsque sélectionné, le défilement de la galerie est masqué.\nLorsque non sélectionné, le défilement de la galerie est visible.",
        "open-new-tab-tooltip": "Ouvrir dans un nouvel onglet \nOuvre l'image sélectionnée dans le menu déroulant dans un nouvel onglet",
        "clean-scan-tooltip": "Lorsque \"conserver les images numérisées\" est sélectionné\nvous conserverez les images trouvées \nentre les analyses sur les mêmes pages ou différentes dans cet onglet.\nvous pouvez également l'utiliser pour ajouter des images individuelles\nlorsque vous faites un clic droit et extrayez une image spécifique.",
        "deep-scan-tooltip": "Lorsqu'il est activé, tous les sites sont analysés avec une logique simplifiée.\nTrouve plus de variantes d'images mais peut regrouper moins d'images similaires.",
        "preserve-original-name-tooltip": "Lorsque cette option est cochée, les fichiers seront téléchargés avec leurs noms d'origine.\nLorsqu'elle n'est pas cochée, il vous sera demandé de fournir un nom de base pour les fichiers téléchargés.",
    },
     de: {
         "cache-tooltip": "CACHE AKTIVIERT (Standardoption)\nBeschleunigt nachfolgende Scans.\nKönnte weniger Varianten anzeigen.\n\nCACHE DEAKTIVIERT\nFührt immer einen vollständigen Scan durch.\nLangsamerer, aber präziserer Scan.",
         "gallery-preview-tooltip": "Wenn ausgewählt, ist das Scrollen der Galerie ausgeblendet.\nWenn nicht ausgewählt, ist das Scrollen der Galerie sichtbar.",
         "open-new-tab-tooltip": "In neuem Tab öffnen \n Öffnet das ausgewählte Bild aus dem Dropdown-Menü in einem neuen Tab.", 
         "clean-scan-tooltip": "Wenn \"Gescannte Bilder behalten\" ausgewählt ist\nbleiben die gefundenen Bilder zwischen den Scans \nauf gleichen oder verschiedenen Seiten in diesem Tab erhalten.\nSie können dies auch verwenden, um einzelne Bilder hinzuzufügen\nwenn Sie mit der rechten Maustaste klicken und ein bestimmtes Bild extrahieren.",
         "deep-scan-tooltip": "Wenn aktiviert, werden alle Websites mit vereinfachter Logik gescannt.\nFindet mehr Bildvarianten, gruppiert aber möglicherweise weniger ähnliche Bilder.",
         "preserve-original-name-tooltip": "Wenn aktiviert, werden Dateien mit ihren ursprünglichen Dateinamen heruntergeladen.\nWenn deaktiviert, werden Sie aufgefordert, einen Basisnamen für heruntergeladene Dateien anzugeben.",
     }
};



document.getElementById('settings-trigger').addEventListener('click', () => {
    const settingsContainer = document.getElementById('settings-container');
    if (settingsContainer.style.display === 'none' || settingsContainer.style.display === '') {
        settingsContainer.style.display = 'flex'; // Mostra le impostazioni
    } else {
        settingsContainer.style.display = 'none'; // Nasconde le impostazioni
    }
});


// Recupera lo stato della cache da chrome.storage all'avvio
chrome.storage.local.get('cacheEnabled', (result) => {
    if (result.cacheEnabled !== undefined) {
        cacheEnabled = result.cacheEnabled;
        document.getElementById('cache-toggle').checked = cacheEnabled;
    }
});

// Listener per la checkbox
document.getElementById('cache-toggle').addEventListener('change', (event) => {
    cacheEnabled = event.target.checked;
    // Salva lo stato della cache in chrome.storage
    chrome.storage.local.set({ cacheEnabled: cacheEnabled }, () => {
        console.log(`Cache ${cacheEnabled ? 'attivata' : 'disattivata'}`);
    });
      // Invia il nuovo valore a content.js
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs.length > 0) {
            chrome.tabs.sendMessage(currentTabId, {
                action: "updateCacheStatus",
                cacheEnabled: cacheEnabled
            });
        }
    });
});


document.addEventListener('DOMContentLoaded', () => {
    updateExtractButtonState(); // Imposta il tooltip corretto all'apertura del sidepanel
});

function applyTranslations(lang) {
    const elements = document.querySelectorAll('[data-i18n]');
    elements.forEach(element => {
        const key = element.getAttribute('data-i18n');
        if (translations[lang] && translations[lang][key]) {
            if (element.tagName === 'INPUT' && element.type === 'text') {
                // Handle inputs
                if (key === 'width' || key === 'height') {
                   //do nothing
                } else {
                    element.value = translations[lang][key];
                }
            } else if (element.tagName === 'SELECT') {
                 // Handle selects (if needed)
                 // Puoi aggiungere qui una logica specifica per i menu a tendina, se necessario
                 // Ad esempio, per le opzioni di un menu a tendina
                if (key === "language") {
                    const options = element.querySelectorAll('option');
                    options.forEach(option => {
                        if (option.value === lang) {
                            option.selected = true;
                         }
                    });
                }
             } else if (element.children.length > 0) {
                    element.childNodes.forEach(node => {
                        if (node.nodeType === Node.TEXT_NODE) {
                              node.textContent = translations[lang][key];
                         }
                     });
                 }  else {
                    element.textContent = translations[lang][key];
                }
            }
        });
       // Traduzione dinamica dei placeholder
        const progressTextElement = document.getElementById('progress-text');
         if (progressTextElement.innerHTML !== '') {
            if (progressTextElement.innerHTML.includes('SCANSIONE IN CORSO')) {
                updateScanProgress(currentProgress, currentCompletedBatches, currentTotalBatches)
            } else if (progressTextElement.innerHTML.includes('DOWNLOAD IN CORSO')) {
                updateProgress(currentProgress, currentCompletedFiles, currentTotalFiles)
           }
        }

        // Aggiorna il messaggio "Scansione interrotta dall'utente" se è visibile
        if (scanInterruptedMessage && scanInterruptedMessage.parentNode) {
            scanInterruptedMessage.textContent = translations[lang]["scan-interrupted"];
        }

         // Aggiungi qui la chiamata per adattare la larghezza dei pulsanti
    adjustButtonWidths();
    }

    function updateTooltips(lang) {
        const tooltipElements = document.querySelectorAll('[data-tooltip-key]');
        tooltipElements.forEach(element => {
            const tooltipKey = element.getAttribute('data-tooltip-key');
            if (tooltipKey === 'search-with-google') {
                // Usa direttamente la chiave dalle translations
                element.title = translations[lang]['search-with-google'] || 'Search with Google';
            } else if (tooltips[lang] && tooltips[lang][tooltipKey]) {
                element.title = tooltips[lang][tooltipKey];
            }
        });
    }

    function setupEventListeners() {
        document.getElementById('select-all').onclick = selectAll;
        document.getElementById('deselect-all').onclick = deselectAll;
        document.getElementById('reset').onclick = reset;
        document.getElementById('extract-selected').onclick = extractSelected;
        document.getElementById('save-as-zip').onclick = extractZIP;
        document.getElementById('close-panel').onclick = closePanel;
        document.getElementById('rescan').onclick = rescan;
        document.getElementById('pause-download').onclick = pauseDownload;
        document.getElementById('stop-download').onclick = stopDownload;
    }
    

    function pauseDownload() {
        const pauseButton = document.getElementById('pause-download');
         if (!isPaused) {
              chrome.runtime.sendMessage({ action: "pauseDownload" });
             pauseButton.style.backgroundColor = "#95a5a6";
             pauseButton.textContent = translations[currentLanguage]["resume-download"];
              isPaused = true;
         } else {
             chrome.runtime.sendMessage({ action: "resumeDownload" });
              pauseButton.style.backgroundColor = "#3498db";
               pauseButton.textContent =  translations[currentLanguage]["pause-download"];
            isPaused = false;
        }
         pauseButton.disabled = false; // Enable the button after resuming
    }
    
    function stopDownload() {
        chrome.runtime.sendMessage({ 
            action: "stopDownload",
            tabId: currentTabId  // Aggiungi l'ID della tab corrente
        });
        const pauseButton = document.getElementById('pause-download');
        pauseButton.disabled = true;
    
        // Ripristina lo stato per permettere un nuovo download
        isPaused = false;
        isStopped = true;
        toggleRescanButton(true); // Mostra il pulsante "Scansiona pagina"
        updateProgress(0, 0, 0); // Resetta la barra del progresso
    }
    

    function toggleRescanButton(visible) {
        const rescanButton = document.getElementById('rescan');
        if (rescanButton) {
            rescanButton.style.display = visible ? 'block' : 'none';
        }
    }   



    function updateExtractButtonState() {
        const extractButton = document.getElementById('extract-selected');
        const saveAsZipButton = document.getElementById('save-as-zip');
        const selectedCount = selectedImages.size;
        const disableLimits = document.getElementById('disable-download-limits').checked;
    
        // Se i limiti sono disabilitati, abilita entrambi i pulsanti
        if (disableLimits) {
            extractButton.disabled = false;
            extractButton.title = '';
            saveAsZipButton.disabled = false;
            saveAsZipButton.title = '';
            return;
        }
    
        // Altrimenti, applica i limiti
        if (selectedCount > 200) {
            extractButton.disabled = true;
            extractButton.title = translations[currentLanguage]["extract-disabled-tooltip"];
        } else {
            extractButton.disabled = false;
            extractButton.title = '';
        }
    
        if (selectedCount > 2000) {
            saveAsZipButton.disabled = true;
            saveAsZipButton.title = translations[currentLanguage]["save-as-zip-disabled-tooltip"];
        } else {
            saveAsZipButton.disabled = false;
            saveAsZipButton.title = '';
        }
    }
    
    function selectAll() {
        document.querySelectorAll('.image-container').forEach(container => {
            if (container.style.display !== 'none') {
                const checkbox = container.querySelector('input[type="checkbox"]');
                checkbox.checked = true;
                container.classList.add('selected');
                selectedImages.add(container.dataset.group);
            }
        });
        document.getElementById('selected-images').textContent = selectedImages.size;
        updateExtractButtonState(); // Aggiorna lo stato del pulsante "Estrai"
    }
    
    function deselectAll() {
        document.querySelectorAll('.image-container').forEach(container => {
            const checkbox = container.querySelector('input[type="checkbox"]');
            const originalCheckbox = container.querySelector('.original-checkbox');
            const select = container.querySelector('select');
    
            checkbox.checked = false;
            checkbox.disabled = false; // Riabilita il checkbox principale
            if (originalCheckbox) originalCheckbox.checked = false;
            if (select) select.disabled = false; // Riabilita il menu a tendina
    
            container.classList.remove('selected');
            selectedImages.delete(container.dataset.group);
        });
        document.getElementById('selected-images').textContent = '0';
        updateExtractButtonState(); // Aggiorna lo stato del pulsante "Estrai"
    }

    function reset() {
        selectedImages.clear();
    
        const widthSlider = document.getElementById('width-slider');
        const heightSlider = document.getElementById('height-slider');
    
        // Recupera i valori originali dal range degli slider
        const originalMinWidth = widthSlider.noUiSlider.options.range.min;
        const originalMaxWidth = widthSlider.noUiSlider.options.range.max;
        const originalMinHeight = heightSlider.noUiSlider.options.range.min;
        const originalMaxHeight = heightSlider.noUiSlider.options.range.max;
    
        // Resetta gli slider ai valori originali della scansione
        if (widthSlider.noUiSlider) {
            widthSlider.noUiSlider.updateOptions({
                start: [originalMinWidth, originalMaxWidth]
            });
        }
        if (heightSlider.noUiSlider) {
            heightSlider.noUiSlider.updateOptions({
                start: [originalMinHeight, originalMaxHeight]
            });
        }
    
        // Aggiorna i campi di input con i valori originali
        document.getElementById('width-value-min').value = originalMinWidth;
        document.getElementById('max-width-value').value = originalMaxWidth;
        document.getElementById('height-value-min').value = originalMinHeight;
        document.getElementById('max-height-value').value = originalMaxHeight;
    
        // Resetta le selezioni delle immagini
        document.querySelectorAll('.image-container').forEach(container => {
            container.style.display = 'block';
            const checkbox = container.querySelector('input[type="checkbox"]');
            const originalCheckbox = container.querySelector('.original-checkbox');
            const select = container.querySelector('select');
    
            checkbox.checked = false;
            checkbox.disabled = false;
            if (originalCheckbox) originalCheckbox.checked = false;
            if (select) select.disabled = false;
    
            container.classList.remove('selected');
        });
    
        document.getElementById('total-images').textContent = document.querySelectorAll('.image-container').length;
        document.getElementById('selected-images').textContent = '0';
        updateExtractButtonState();
    }

function closePanel() {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if(tabs && tabs.length > 0){
        const tabId = currentTabId;
         // Invia un messaggio al background per disabilitare il sidepanel e resettare lo stato
         chrome.runtime.sendMessage({action: 'disableSidePanelAndReset', tabId: tabId});
      }
    });
}


function rescan() {
    const content = document.getElementById('content');
    const loadingOverlay = document.getElementById('loading-overlay');
    const rescanButton = document.getElementById('rescan');
    const progressContainer = document.getElementById('progress-container');
    const cleanScanToggle = document.getElementById('clean-scan-toggle');
    const deepScanToggle = document.getElementById('deep-scan-toggle'); // Ottieni riferimento alla checkbox Deep Scan
    const cleanScanEnabled = cleanScanToggle ? cleanScanToggle.checked : false;
    const isDeepScanEnabled = deepScanToggle.checked; // Leggi lo stato della checkbox Deep Scan

    if (isScanInProgress) {
        // Stop the scan
        isScanInProgress = false;
        // Invia il messaggio di stop includendo il tabId
        chrome.runtime.sendMessage({
            action: "stopScan",
            tabId: currentTabId
        });
        rescanButton.textContent = translations[currentLanguage]["rescan"];
        rescanButton.style.backgroundColor = '#A6D5E8';
        progressContainer.style.display = 'none';
        loadingOverlay.style.display = 'none';

        if (!scanInterruptedMessage) {
            scanInterruptedMessage = document.createElement('div');
            scanInterruptedMessage.style.textAlign = 'center';
            scanInterruptedMessage.style.color = '#e74c3c';
            scanInterruptedMessage.style.marginTop = '5px';
            scanInterruptedMessage.style.fontSize = '14px';
        }
        scanInterruptedMessage.textContent = translations[currentLanguage]["scan-interrupted"];
        rescanButton.parentNode.insertBefore(scanInterruptedMessage, rescanButton.nextSibling);
        return;
    }

    if (scanInterruptedMessage && scanInterruptedMessage.parentNode) {
        scanInterruptedMessage.remove();
    }

    // Start new scan
    isScanInProgress = true;
    firstClickRescan = true;
    waitingForLoadRescan = true;
    rescanButton.textContent = "STOP";
    rescanButton.style.backgroundColor = '#e74c3c';

    const noImagesMessage = document.getElementById('no-images-message');
    if (noImagesMessage) {
        noImagesMessage.remove();
    }

    // Notify background of new manual scan
    chrome.runtime.sendMessage({
        action: "manualScanTriggered",
        tabId: currentTabId,  // Aggiungi tabId
        deepScanEnabled: isDeepScanEnabled // Passa lo stato di Deep Scan al background
    });

    // Clear content only if clean scan is NOT enabled (opposite behavior)
    if (!cleanScanEnabled) {
        content.innerHTML = '';
        imageGroups.clear(); // Pulisci anche la Map delle immagini
        document.getElementById('total-images').textContent = '0';
        document.getElementById('selected-images').textContent = '0';
        selectedImages.clear();
    }

    loadingOverlay.style.display = 'flex';

    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        chrome.tabs.get(currentTabId, (updatedTab) => {
            if (updatedTab.status === "complete") {
                waitingForLoadRescan = false;
                
                // Invia messaggio a content.js per aggiornare deepScanEnabled PRIMA di avviare la scansione
                chrome.tabs.sendMessage(currentTabId, {
                    action: "updateDeepScanState",
                    deepScanEnabled: isDeepScanEnabled
                }, () => {
                    // Avvia la scansione SOLO dopo aver aggiornato lo stato di Deep Scan
                    startRescan(currentTabId); 
                });


            } else {
                console.log('Pagina non ancora caricata, attendo...');
            }
        });
    });
}


function startRescan(tabId) {
    // Show loading state
    document.getElementById('loading-overlay').style.display = 'block';
    
    // Get clean scan state
    const cleanScanEnabled = document.getElementById('clean-scan-toggle').checked;
    
    if (!cleanScanEnabled) {
        // Reset image arrays and UI if clean scan is not enabled
        imageGroups = new Map();
        selectedImages = new Set();
        document.getElementById('content').innerHTML = '';
        document.getElementById('total-images').textContent = '0';
        document.getElementById('selected-images').textContent = '0';
    }
    
    // Send message to start scanning
    chrome.tabs.sendMessage(tabId, {
        action: "getImages",
        tabId: tabId
    });
}


function startRescan(tabId){
    // Esegue una nuova scansione includendo il tabId
    chrome.tabs.sendMessage(tabId, { 
        action: "getImages",
        tabId: tabId // Aggiungi esplicitamente il tabId
    });
}

function showError(url, groupKey) {
    const errorContainer = document.getElementById('error-container');
    const errorPreview = document.getElementById('error-preview').querySelector('img');
    const variantSelector = document.getElementById('variant-selector');
    const translatedErrorText = translations[currentLanguage]["download-error"];
    errorContainer.querySelector('p').textContent = translatedErrorText;
    errorPreview.src = url;
    errorContainer.style.display = 'block';
    const container = document.querySelector(`.image-container[data-group="${groupKey}"]`);
    const select = container.querySelector('select');
    variantSelector.innerHTML = '';
    Array.from(select.options).forEach((option) => {
        const opt = document.createElement('option');
        opt.value = option.value;
        opt.textContent = option.text;
        if (option.value === url) opt.style.color = 'red';
        variantSelector.appendChild(opt);
    });
    errorContainer.scrollIntoView({ behavior: 'smooth', block: 'center' });
    const retryButton = document.getElementById('retry-download');
    const cancelButton = document.getElementById('cancel-download');
    retryButton.textContent = translations[currentLanguage]["retry-download"];
    cancelButton.textContent = translations[currentLanguage]["cancel-download"];

    retryButton.onclick = () => {
        const selectedUrl = variantSelector.value;
        errorContainer.style.display = 'none';
        chrome.runtime.sendMessage({ action: "retryDownload", url: selectedUrl, groupKey });
    };

    cancelButton.onclick = () => {
        errorContainer.style.display = 'none';
        chrome.runtime.sendMessage({ action: "ignoreFile", groupKey });
    };
}

function updateProgress(progress, completedFiles, totalFiles) {
    currentProgress = progress;
    currentCompletedFiles = completedFiles;
    currentTotalFiles = totalFiles;
    const translatedText = translations[currentLanguage]["download-in-progress"];
    progressContainer.style.display = 'block';
    progressBar.style.width = `${progress}%`;
    progressText.innerHTML = `
        <div style="text-align: center; font-weight: bold;">${translatedText}</div>
        <div style="text-align: center;">${completedFiles}/${totalFiles} --- ${progress}%</div>
    `;

    const downloadControls = document.getElementById('download-controls');
    const pauseButton = document.getElementById('pause-download');

    if (progress === 0) {
        pauseButton.textContent = translations[currentLanguage]["pause-download"];
        pauseButton.style.backgroundColor = "#3498db";
        pauseButton.disabled = false;
    }

    if (progress < 100) {
        downloadControls.style.display = 'flex';
        toggleRescanButton(false); // Nascondi il pulsante "Scansiona pagina" durante il download
    } else {
        downloadControls.style.display = 'none';
        toggleRescanButton(true); // Mostra il pulsante "Scansiona pagina" quando il download è completato
    }

    if (progress === 100) {
        setTimeout(() => {
            progressContainer.style.display = 'none';
        }, 1000);
    }
}


function getParallelDownloads(totalFiles) {
    if (totalFiles <= 5) return 1;
    if (totalFiles <= 10) return 2;
    if (totalFiles <= 20) return 4;
    if (totalFiles <= 50) return 6;
    if (totalFiles <= 100) return 8;
    if (totalFiles <= 200) return 10;
    if (totalFiles <= 500) return 15;
    return 20;
}

// In sidebar.js
async function extractZIP() {
    const selectedUrls = Array.from(selectedImages).map(groupKey => {
        const container = document.querySelector(`.image-container[data-group="${groupKey}"]`);
        const originalCheckbox = container.querySelector('.original-checkbox');
        if (originalCheckbox && originalCheckbox.checked) {
            const originalUrlText = container.querySelector('.original-url');
            return originalUrlText.textContent;
        } else {
            const select = container.querySelector('select');
            return select ? select.value : null;
        }
    }).filter(url => url !== null);

    if (selectedUrls.length > 0) {
        let baseName = "images";
        
        // Only prompt for name if preserveOriginalName is disabled
        if (!preserveOriginalName) {
            baseName = prompt(translations[currentLanguage]["confirm-zip-name"], "images");
            if (baseName === null) {
                return;
            }
            if (!baseName || baseName.trim() === "") {
                baseName = "images";
            }
        }

        // Invia il comando di download al content script
        chrome.tabs.sendMessage(currentTabId, {
            action: "downloadImages",
            urls: selectedUrls,
            zipName: baseName,
            tabId: currentTabId, // Aggiungi tabId qui per sicurezza, anche se il content.js lo sa
            preserveOriginalName: preserveOriginalName // Pass the setting to content script
        });

        // Inizializza la barra del progresso locale
        updateProgress(0, 0, selectedUrls.length);
        toggleRescanButton(false);

        // NON AGGIUNGERE ALTRI LISTENER QUI! Il listener principale filtrato gestirà gli aggiornamenti.

    } else {
        alert(translations[currentLanguage]["no-images-selected"]);
    }
}


async function extractSelected() {
    const selectedUrls = Array.from(selectedImages).map(groupKey => {
        const container = document.querySelector(`.image-container[data-group="${groupKey}"]`);
        const originalCheckbox = container.querySelector('.original-checkbox');
        if (originalCheckbox && originalCheckbox.checked) {
            const originalUrlText = container.querySelector('.original-url');
            return originalUrlText.textContent;
        } else {
            const select = container.querySelector('select');
            return select ? select.value : null;
        }
    }).filter(url => url !== null);

    if (selectedUrls.length === 0) {
        alert(translations[currentLanguage]["no-images-selected"]);
        return;
    }

    let baseName = "image";
    
    // Only prompt for name if preserveOriginalName is disabled
    if (!preserveOriginalName) {
        baseName = prompt(translations[currentLanguage]["confirm-individual-name"], "image");
        if (baseName === null) {
            return;
        }
        if (!baseName || baseName.trim() === "") {
            baseName = "image";
        }
    }

     // Invia il comando di download al content script
    chrome.tabs.sendMessage(currentTabId, {
        action: "downloadImagesIndividually",
        urls: selectedUrls,
        baseName: baseName,
        tabId: currentTabId, // Aggiungi tabId qui per sicurezza
        preserveOriginalName: preserveOriginalName // Pass the setting to content script
    });

    // Inizializza la barra del progresso locale
    updateProgress(0, 0, selectedUrls.length);
    toggleRescanButton(false); // Nascondi rescan durante il download

     // NON AGGIUNGERE ALTRI LISTENER QUI! Il listener principale filtrato gestirà gli aggiornamenti.
}

function downloadImage(url, filename) {
    fetch(url, {
        headers: {
            'Referer': window.location.href,
            'User-Agent': navigator.userAgent
        },
        credentials: 'include',
        mode: 'cors'
    })
    .then(response => response.blob())
    .then(blob => {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = filename;
        a.click();
        URL.revokeObjectURL(a.href);
    });
}


// IN sidebar.js (CODICE CORRETTO DA USARE)

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    // --- MODIFICA CHIAVE: AGGIUNTO QUESTO BLOCCO ---
    // Ignora i messaggi che hanno un tabId diverso da quello di questa sidebar.
    // Questo previene l'interferenza tra le diverse istanze del pannello laterale.
    if (request.tabId && request.tabId !== currentTabId) {
        // Opzionale: Log per debug per vedere i messaggi ignorati
        // console.log(`Sidebar ${currentTabId}: Ignorato messaggio per tab ${request.tabId} (Azione: ${request.action})`);
        return; // Esce dalla funzione, ignorando il messaggio
    }
    // --- FINE MODIFICA CHIAVE ---

    // Ora il resto della logica viene eseguito SOLO se il messaggio è
    // per questa specifica tab (request.tabId === currentTabId)
    // O se il messaggio non ha un tabId (messaggio globale, come showChangelogOverlay)

    if (request.action === "setImages") {
        const newImageGroups = new Map(Object.entries(request.imageGroups));
        const cleanScanToggle = document.getElementById('clean-scan-toggle');
        // NOTA: cleanScanEnabled qui è locale, assicurati sia definito correttamente o usa la variabile globale
        const cleanScanEnabled = cleanScanToggle ? cleanScanToggle.checked : true; // Usa la variabile globale 'cacheEnabled' o definisci qui

        const previousFound = parseInt(document.getElementById('total-images').textContent) || 0;

        if (!cleanScanEnabled) {
            imageGroups = newImageGroups; // Sovrascrivi se clean scan è disabilitato
        } else {
            // Merge delle immagini se clean scan è abilitato
            const existingEntries = Array.from(imageGroups.entries());
            const newEntries = Array.from(newImageGroups.entries());
            imageGroups = new Map([...newEntries, ...existingEntries]); // Nuove immagini hanno priorità (sovrascrivono)
        }

        displayImages(); // Mostra le immagini (aggiornate o unite)

        if (cleanScanEnabled) {
            const currentFound = parseInt(document.getElementById('total-images').textContent);
            const newImagesCount = currentFound - previousFound;
            if (newImagesCount > 0 && sender.tab) { // Mostra messaggio solo se ci sono nuove immagini e proviene da una tab
                 const message = translations[currentLanguage]["new-images-found"]
                 // Potresti voler rendere il messaggio più specifico, es: .replace("{count}", newImagesCount);
                 showTemporaryMessage(translations[currentLanguage]["new-images-found"]);
            }
        }

        // Richiedi range dimensioni DOPO aver processato le immagini
        chrome.runtime.sendMessage({
            action: "getDimensionRanges",
            tabId: currentTabId // Usa currentTabId per la richiesta
        });

    } else if (request.action === "startLoading") {
        isScanInProgress = true;
        const rescanButton = document.getElementById('rescan');
        if(rescanButton){ // Aggiunto controllo null check
            rescanButton.textContent = "STOP";
            rescanButton.style.backgroundColor = '#e74c3c';
        }
        document.getElementById('loading-overlay').style.display = 'flex';
        progressContainer.style.display = 'block'; // Usa la variabile globale progressContainer
        const noImagesMessage = document.getElementById('no-images-message');
        if (noImagesMessage) {
            noImagesMessage.remove();
        }
        if (scanInterruptedMessage && scanInterruptedMessage.parentNode) { // Usa la variabile globale scanInterruptedMessage
            scanInterruptedMessage.remove();
        }

    } else if (request.action === "clearSidebar") {
        const cleanScanToggle = document.getElementById('clean-scan-toggle');
        const cleanScanEnabled = cleanScanToggle ? cleanScanToggle.checked : true; // Usa la variabile globale 'cacheEnabled' o definisci qui
        const content = document.getElementById('content');
        const loadingOverlay = document.getElementById('loading-overlay');

        // Pulisce solo se 'Keep scanned' NON è selezionato
        if (!cleanScanEnabled) {
             content.innerHTML = '';
             imageGroups.clear(); // Pulisci anche la Map
             document.getElementById('total-images').textContent = '0';
             document.getElementById('selected-images').textContent = '0';
             selectedImages.clear(); // Pulisci anche le selezioni
        }

        loadingOverlay.style.display = 'flex';
        const noImagesMessage = document.getElementById('no-images-message');
        if (noImagesMessage) {
            noImagesMessage.remove();
        }

    } else if (request.action === "updateScanProgress") {
        // Il controllo tabId è già stato fatto all'inizio
        updateScanProgress(request.progress, request.completedBatches, request.totalBatches);

    } else if (request.action === "updateDimensionRange") {
        // Il controllo tabId è già stato fatto all'inizio
        const widthSlider = document.getElementById('width-slider');
        const heightSlider = document.getElementById('height-slider');
        if (widthSlider?.noUiSlider) { // Controlla se lo slider esiste ed è inizializzato
             widthSlider.noUiSlider.updateOptions({
                range: { min: request.minWidth || 0, max: request.maxWidth || 10000 },
                start: [request.minWidth || 0, request.maxWidth || 10000]
            });
            document.getElementById('width-value-min').value = request.minWidth || 0;
            document.getElementById('max-width-value').value = request.maxWidth || 10000;
        }
        if (heightSlider?.noUiSlider) { // Controlla se lo slider esiste ed è inizializzato
             heightSlider.noUiSlider.updateOptions({
                 range: { min: request.minHeight || 0, max: request.maxHeight || 10000 },
                 start: [request.minHeight || 0, request.maxHeight || 10000]
             });
            document.getElementById('height-value-min').value = request.minHeight || 0;
            document.getElementById('max-height-value').value = request.maxHeight || 10000;
        }

    } else if (request.action === "updateProgress") {
        // Il controllo tabId è già stato fatto all'inizio
        updateProgress(request.progress, request.completedFiles, request.totalFiles);

    } else if (request.action === "downloadError") {
        // Il controllo tabId è già stato fatto all'inizio
        showError(request.url, request.groupKey);

    } else if (request.action === "experimentalFunctionEnded") {
        isExperimentalLoading = false;
        if (experimentalButton) { // Usa la variabile globale experimentalButton
            experimentalButton.disabled = false;
        }

    } else if (request.action === "resetGUI") {
        // Il controllo tabId è già stato fatto all'inizio
        const downloadControls = document.getElementById('download-controls');
        if (downloadControls) downloadControls.style.display = 'none';
        const progressContainer = document.getElementById('progress-container'); // Assicurati sia definita globalmente
        if (progressContainer) progressContainer.style.display = 'none';
        const rescanButton = document.getElementById('rescan');
        if (rescanButton) rescanButton.style.display = 'block'; // Usa 'block' o 'inline-block' a seconda del tuo layout

    } else if (request.action === "downloadStopped") {
        // Il controllo tabId è già stato fatto all'inizio
        isPaused = false;
        isStopped = true;
        toggleRescanButton(true);
        updateProgress(0, 0, 0);
        const progressContainer = document.getElementById('progress-container'); // Assicurati sia definita globalmente
        if(progressContainer) progressContainer.style.display = 'none';
        const downloadControls = document.getElementById('download-controls');
        if(downloadControls) downloadControls.style.display = 'none';

    // Questo messaggio è globale e non ha tabId, quindi viene processato correttamente
}
  
});


// Mantieni QUESTO listener SEPARATO per le azioni che richiedono una RISPOSTA SINCRONA
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    // Questo listener gestisce SOLO le richieste che necessitano una risposta diretta
    if (request.action === "getKeepScannedStatus") {
        // Anche se non filtriamo esplicitamente tabId qui, la risposta
        // tornerà automaticamente al background.js che ha inviato la richiesta
        // per uno specifico tabId, quindi l'isolamento è mantenuto dal chiamante.
        const cleanScanToggle = document.getElementById('clean-scan-toggle');
        const cleanScanEnabled = cleanScanToggle ? cleanScanToggle.checked : true; // Usa la variabile globale 'cacheEnabled' o definisci qui
        sendResponse({ keepScanned: cleanScanEnabled });
        return true; // Necessario per la risposta asincrona
    }
    // NON aggiungere qui la logica per updateProgress, setImages, ecc.
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "getKeepScannedStatus") {
        const cleanScanToggle = document.getElementById('clean-scan-toggle');
        const cleanScanEnabled = cleanScanToggle ? cleanScanToggle.checked : true;
        sendResponse({ keepScanned: cleanScanEnabled });
        return true; // Importante per le risposte asincrone
    }
});
function updateScanProgress(progress, completedBatches, totalBatches) {
    if (!isScanInProgress) return;

    currentProgress = progress;
    currentCompletedBatches = completedBatches;
    currentTotalBatches = totalBatches;

    const translatedText = translations[currentLanguage]["scan-in-progress"];

    progressContainer.style.display = 'block';
    progressBar.style.width = `${progress}%`;
    progressText.innerHTML = `
        <div style="text-align: center; font-weight: bold;">${translatedText}</div>
        <div style="text-align: center;">${progress}%</div>
    `;

    if (progress === 100) {
        setTimeout(() => {
            progressContainer.style.display = 'none';
            // Reset scan button appearance
            const rescanButton = document.getElementById('rescan');
            rescanButton.textContent = translations[currentLanguage]["rescan"];
            rescanButton.style.backgroundColor = '#A6D5E8';
            isScanInProgress = false;
        }, 1000);
    }
}


function adjustGridLayout() {
    const content = document.getElementById('content');
    const visibleImages = Array.from(content.children).filter(child => child.style.display !== 'none');
    const visibleCount = visibleImages.length;

    if (visibleCount >= 3) {
        content.style.gridTemplateColumns = 'repeat(3, 1fr)';
    } else if (visibleCount === 2) {
        content.style.gridTemplateColumns = 'repeat(2, calc(50% - 2.5%))'; // Riduci del 5% complessivo, distribuito tra 2 colonne
    } else if (visibleCount === 1) {
        content.style.gridTemplateColumns = 'calc(100% - 5%)'; // Riduci del 5% per l'unica colonna
    } else {
        content.style.gridTemplateColumns = '';
    }

    // Applica margini laterali uniformi alle immagini
    visibleImages.forEach(image => {
        if (visibleCount <= 3) {
            image.style.width = '100%';
            image.style.height = 'auto';
            image.style.marginLeft = 'auto';
            image.style.marginRight = 'auto';
            image.style.boxSizing = 'border-box'; // Considera i padding e i bordi
        } else {
            image.style.removeProperty('width');
            image.style.removeProperty('height');
            image.style.removeProperty('marginLeft');
            image.style.removeProperty('marginRight');
        }
    });

    // Evita lo scroll orizzontale
    content.style.overflowX = 'hidden'; 
}




async function displayImages() {
    const content = document.getElementById('content');
    const loadingOverlay = document.getElementById('loading-overlay');

    content.innerHTML = '';

    if (imageGroups.size > 0) {
        loadingOverlay.style.display = 'none';
    } else {
        loadingOverlay.style.display = 'flex';
    }

    let maxWidth = 0;
    let maxHeight = 0;

    for (const [groupKey, variants] of imageGroups) {
        if (variants.length === 0) continue;

        const validVariants = variants.filter(variant => variant.width && variant.height);
        if (validVariants.length === 0) continue;

        // Trova la variante con la risoluzione più alta
        const highestResVariant = validVariants.reduce((best, current) => {
            const bestRes = best.width * best.height;
            const currentRes = current.width * current.height;
            return currentRes > bestRes ? current : best;
        }, validVariants[0]);

        // Trova la miniatura (immagine più piccola) per il thumbnail
        const thumbnail = validVariants.reduce((smallest, current) => {
            const smallestRes = smallest.width * smallest.height;
            const currentRes = current.width * current.height;
            return currentRes < smallestRes ? current : smallest;
        }, validVariants[0]);

        if (highestResVariant.width > maxWidth) maxWidth = highestResVariant.width;
        if (highestResVariant.height > maxHeight) maxHeight = highestResVariant.height;

        const container = document.createElement('div');
        container.className = 'image-container';
        container.dataset.group = groupKey;
        container.dataset.width = highestResVariant.width;
        container.dataset.height = highestResVariant.height;

        const setThumbnailImage = (imageUrl) => {
            container.innerHTML = `
                <img src="${imageUrl}" alt="Thumbnail">
                <input type="checkbox" data-group="${groupKey}" style="position: absolute; top: 5px; left: 5px;">
                <select data-group="${groupKey}" style="margin-top: 5px;">
                    ${validVariants
                        .sort((a, b) => (b.width * b.height) - (a.width * a.height))
                        .map(variant => `
                            <option value="${variant.url}" ${variant.url === highestResVariant.url ? 'selected' : ''}>
                                ${variant.width}x${variant.height}
                            </option>
                        `).join('')}
                </select>
            `;
            setupImageInteraction(container, groupKey);
            addOriginalCheckbox(container, groupKey, validVariants);
        };

        // Tentativo di caricare la miniatura
        const img = new Image();
        img.onload = () => {
            setThumbnailImage(thumbnail.url);
            updateTooltips(currentLanguage);
        };
        img.onerror = () => {
            fetchImageAsBlob(thumbnail.url)
                .then(dataUrl => {
                    setThumbnailImage(dataUrl);
                    updateTooltips(currentLanguage);
                })
                .catch(error => console.error('Errore nel caricamento del fallback:', error));
        };
        img.src = thumbnail.url;

        content.appendChild(container);
    }
    adjustGridLayout();

    // Se maxWidth o maxHeight sono ancora 0, imposta valori di default
    if (maxWidth === 0 || maxHeight === 0) {
        console.warn('Impossibile calcolare maxWidth o maxHeight. Uso valori di default.');
        maxWidth = 10000; // Valore di default per maxWidth
        maxHeight = 10000; // Valore di default per maxHeight
    }

    console.log('Dimensioni calcolate:', { maxWidth, maxHeight });

    // Inizializza i range slider con i valori corretti
    initSliders(maxWidth, maxHeight);

    // Aggiorna il conteggio delle immagini
    document.getElementById('total-images').textContent = document.querySelectorAll('.image-container').length;
}

// Funzione per scaricare l'immagine come blob e convertirla in data URL
async function fetchImageAsBlob(url) {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Errore HTTP: ${response.status}`);
    const blob = await response.blob();
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
}
function setupImageInteraction(container, groupKey) {
    const imgElement = container.querySelector('img');
    const checkbox = container.querySelector('input[type="checkbox"]');
    const originalCheckbox = container.querySelector('.original-checkbox');

    // Gestione del click sull'immagine
    imgElement.onclick = () => {
        checkbox.checked = !checkbox.checked;
        updateSelection(checkbox, groupKey, originalCheckbox);
    };

    // Gestione del click sul checkbox
    checkbox.onclick = (event) => {
        event.stopPropagation(); // Impedisce la propagazione dell'evento al contenitore
        updateSelection(checkbox, groupKey, originalCheckbox);
    };

    // Funzione per aggiornare la selezione
    function updateSelection(checkbox, groupKey, originalCheckbox) {
        if (checkbox.checked) {
            selectedImages.add(groupKey);
            container.classList.add('selected');
            if (originalCheckbox) originalCheckbox.checked = false;
        } else {
            selectedImages.delete(groupKey);
            container.classList.remove('selected');
            if (originalCheckbox) originalCheckbox.checked = false;
        }
        document.getElementById('selected-images').textContent = selectedImages.size;
        updateExtractButtonState(); // Aggiorna lo stato del pulsante "Estrai"

        if (originalCheckbox) {
            const select = container.querySelector('select');
            select.disabled = originalCheckbox.checked;
        }
    }
    
    // Trova l'URL migliore da passare al pulsante della lente d'ingrandimento
    // Seleziona la variante attualmente selezionata nel dropdown
    const selectElement = container.querySelector('select');
    const bestImageUrl = selectElement ? selectElement.value : imgElement.src;
    
    // Aggiungiamo il pulsante lente d'ingrandimento
    createMagnifyButton(container, bestImageUrl);
}

 // Funzione per aggiungere il pulsante "apri in nuova scheda"
 function createOpenNewTabButton(container, originalCheckbox, originalUrl) {
    const openNewTabButton = document.createElement('button');
    openNewTabButton.innerHTML = '⧉'; // Icona Unicode (quadrato con freccia)
    openNewTabButton.className = 'open-new-tab-button';
    openNewTabButton.setAttribute('data-tooltip-key', 'open-new-tab-tooltip');
    openNewTabButton.style.cssText = `
      position: absolute; /* Sovrapponi all'immagine */
      top: 5px;         /* Angolo in alto */
      right: 5px;       /* Angolo a destra */
      padding: 4px 7px;
      cursor: pointer;
      border-radius: 3px;
      border: 1px solid #ccc;
      background-color: #f9f9f9;
      font-size: 0.9em;
      opacity: 0.8;      /* Leggermente trasparente di default */
      transition: opacity 0.2s ease-in-out; /* Transizione per l'effetto hover */
    `;

    // Aggiungi il tooltip iniziale
    updateTooltips(currentLanguage); // Aggiorna il tooltip con la lingua corrente

    openNewTabButton.addEventListener('mouseenter', () => {
      openNewTabButton.style.opacity = '1';
    });

    openNewTabButton.addEventListener('mouseleave', () => {
        openNewTabButton.style.opacity = '0.8';
    });

    openNewTabButton.addEventListener('click', () => {
        let urlToOpen = null;
        if (originalCheckbox && originalCheckbox.checked) {
           urlToOpen = originalUrl;
        }

        if (!urlToOpen) {
            const selectElement = container.querySelector('select');
            urlToOpen = selectElement.value;
        }
        window.open(urlToOpen, '_blank');
    });

    container.appendChild(openNewTabButton);
}

function addOriginalCheckbox(container, groupKey, variants) {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const url = new URL(tabs[0].url);
        let originalUrl = null;
        let originalCheckbox = null;

        if (url.hostname.endsWith('immobiliare.it')) { // LOGICA PER immobiliare.it (CHECKBOX + LABEL)
            const selectElement = container.querySelector('select');
            const selectedVariantUrl = selectElement.value;
            const thumbnailUrl = container.querySelector('img').src;
            const thumbnailUrlObj = new URL(thumbnailUrl);
            originalUrl = thumbnailUrlObj.href.replace(thumbnailUrlObj.pathname.split('/').pop(), 'xxl.jpg');

            originalCheckbox = document.createElement('input');
            originalCheckbox.type = 'checkbox';
            originalCheckbox.className = 'original-checkbox';
            originalCheckbox.style.cssText = 'margin-top: 5px; display: block;';
            originalCheckbox.id = `original-${groupKey}`;

            const originalLabel = document.createElement('label');
            originalLabel.htmlFor = `original-${groupKey}`;
            originalLabel.textContent = translations[currentLanguage]["original"];
            originalLabel.setAttribute('data-i18n', 'original');
            originalLabel.style.cssText = 'margin-left: 5px; font-size: 12px;';

            const originalUrlText = document.createElement('span');
            originalUrlText.className = 'original-url';
            originalUrlText.textContent = originalUrl;
            originalUrlText.style.cssText = 'display: none;';

            const originalCheckboxContainer = document.createElement('div');
            originalCheckboxContainer.style.cssText = 'display: flex; align-items: center; justify-content: center;';
            originalCheckboxContainer.appendChild(originalCheckbox);
            originalCheckboxContainer.appendChild(originalLabel);
            originalCheckboxContainer.appendChild(originalUrlText);
            container.appendChild(originalCheckboxContainer);

            originalCheckbox.addEventListener('change', () => {
                const mainCheckbox = container.querySelector('input[type="checkbox"]');
                const select = container.querySelector('select');

                mainCheckbox.disabled = originalCheckbox.checked;
                select.disabled = originalCheckbox.checked;

                if (originalCheckbox.checked) {
                    selectedImages.add(groupKey);
                    container.classList.add('selected');
                } else {
                    selectedImages.delete(groupKey);
                    container.classList.remove('selected');
                }
                document.getElementById('selected-images').textContent = selectedImages.size;
            });

        } else if (url.hostname.endsWith('csfd.sk') || url.hostname.endsWith('csfd.cz')) { // LOGICA PER csfd.sk e csfd.cz (CHECKBOX + LABEL)
            const variantUrl = variants.find(v => v.url.includes('cache/resized/w'))?.url;
            originalUrl = variantUrl ? variantUrl.replace(/\/cache\/resized\/w\d+\//, '/') : '';

            originalCheckbox = document.createElement('input');
            originalCheckbox.type = 'checkbox';
            originalCheckbox.className = 'original-checkbox';
            originalCheckbox.style.cssText = 'margin-top: 5px; display: block;';
            originalCheckbox.id = `original-${groupKey}`;

            const originalLabel = document.createElement('label');
            originalLabel.htmlFor = `original-${groupKey}`;
            originalLabel.textContent = translations[currentLanguage]["original"];
            originalLabel.setAttribute('data-i18n', 'original');
            originalLabel.style.cssText = 'margin-left: 5px; font-size: 12px;';

            const originalUrlText = document.createElement('span');
            originalUrlText.className = 'original-url';
            originalUrlText.textContent = originalUrl;
            originalUrlText.style.cssText = 'display: none;';

            const originalCheckboxContainer = document.createElement('div');
            originalCheckboxContainer.style.cssText = 'display: flex; align-items: center; justify-content: center;';
            originalCheckboxContainer.appendChild(originalCheckbox);
            originalCheckboxContainer.appendChild(originalLabel);
            originalCheckboxContainer.appendChild(originalUrlText);
            container.appendChild(originalCheckboxContainer);

            originalCheckbox.addEventListener('change', () => {
                const mainCheckbox = container.querySelector('input[type="checkbox"]');
                const select = container.querySelector('select');

                mainCheckbox.disabled = originalCheckbox.checked;
                select.disabled = originalCheckbox.checked;

                if (originalCheckbox.checked) {
                    selectedImages.add(groupKey);
                    container.classList.add('selected');
                } else {
                    selectedImages.delete(groupKey);
                    container.classList.remove('selected');
                }
                document.getElementById('selected-images').textContent = selectedImages.size;
            });
        }

        // Crea e aggiungi il pulsante "Apri in nuova scheda"
        createOpenNewTabButton(container, originalCheckbox, originalUrl);
        updateTooltips(currentLanguage); // Aggiorna i tooltip dopo aver creato il pulsante
    });
}



function initSliders(maxWidth, maxHeight) {
    const widthSlider = document.getElementById('width-slider');
    const heightSlider = document.getElementById('height-slider');

    // Recupera i valori correnti o usa 0 come fallback
    const initialMinWidth = parseInt(document.getElementById('width-value-min').value) || 0;
    const initialMinHeight = parseInt(document.getElementById('height-value-min').value) || 0;

    // Verifica che i valori massimi siano validi
    if (typeof maxWidth !== 'number' || isNaN(maxWidth) || typeof maxHeight !== 'number' || isNaN(maxHeight)) {
        console.error('maxWidth o maxHeight non sono numeri validi. Uso valori di default.');
        maxWidth = Math.max(1000, initialMinWidth + 100); // Assicura che sia maggiore del minimo
        maxHeight = Math.max(1000, initialMinHeight + 100);
    }

    // Assicura che i valori massimi siano sempre maggiori dei minimi
    const validMaxWidth = Math.max(maxWidth, initialMinWidth + 100);
    const validMaxHeight = Math.max(maxHeight, initialMinHeight + 100);

    // Inizializza il noUiSlider per la larghezza
    if (widthSlider && !widthSlider.noUiSlider) {
        noUiSlider.create(widthSlider, {
            start: [initialMinWidth, validMaxWidth],
            connect: true,
            range: {
                'min': initialMinWidth,
                'max': validMaxWidth
            },
            step: 10,
            tooltips: [false, false],
            format: {
                to: function(value) {
                    return Math.round(value);
                },
                from: function(value) {
                    return parseInt(value);
                }
            }
        });

        widthSlider.noUiSlider.on('update', updateWidthFilter);
    }

    // Inizializza il noUiSlider per l'altezza
    if (heightSlider && !heightSlider.noUiSlider) {
        noUiSlider.create(heightSlider, {
            start: [initialMinHeight, validMaxHeight],
            connect: true,
            range: {
                'min': initialMinHeight,
                'max': validMaxHeight
            },
            step: 10,
            tooltips: [false, false],
            format: {
                to: function(value) {
                    return Math.round(value);
                },
                from: function(value) {
                    return parseInt(value);
                }
            }
        });

        heightSlider.noUiSlider.on('update', updateHeightFilter);
    }
}

function updateWidthFilter(values, handle) {
    const minWidth = Math.round(parseInt(values[0]));
    const maxWidth = Math.round(parseInt(values[1]));

    document.getElementById('width-value-min').value = minWidth;
    document.getElementById('max-width-value').value = maxWidth;
    updateImageVisibility();
}

function updateHeightFilter(values, handle) {
    const minHeight = Math.round(parseInt(values[0]));
    const maxHeight = Math.round(parseInt(values[1]));

    document.getElementById('height-value-min').value = minHeight;
    document.getElementById('max-height-value').value = maxHeight;
    updateImageVisibility();
}

function updateImageVisibility() {
    const minWidth = parseInt(document.getElementById('width-value-min').value);
    const maxWidth = parseInt(document.getElementById('max-width-value').value);
    const minHeight = parseInt(document.getElementById('height-value-min').value);
    const maxHeight = parseInt(document.getElementById('max-height-value').value);

    const content = document.getElementById('content');
    let visibleCount = 0;

    document.querySelectorAll('.image-container').forEach(container => {
        const select = container.querySelector('select');
        const checkbox = container.querySelector('input[type="checkbox"]');
        const groupKey = container.dataset.group;

        let bestOption = null;
        let shouldHide = true;

        if (select) {
            const options = Array.from(select.options);
            options.forEach(option => {
                const [width, height] = option.text.split('x').map(Number);

                if (width >= minWidth && width <= maxWidth && height >= minHeight && height <= maxHeight) {
                    option.style.display = '';
                    shouldHide = false;

                    if (!bestOption || (width * height > bestOption.width * bestOption.height)) {
                        bestOption = { width, height, value: option.value };
                    }
                } else {
                    option.style.display = 'none';
                }
            });

            if (!checkbox.checked && bestOption) {
                select.value = bestOption.value;
            }
        }

        container.style.display = shouldHide ? 'none' : 'block';
        if (!shouldHide) {
            visibleCount++;
        }
    });

    // Aggiorna l'attributo per il layout in base al numero di immagini visibili
    content.setAttribute('data-visible-count', visibleCount.toString());

    document.getElementById('total-images').textContent = visibleCount;
    adjustGridLayout();
}

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status === 'complete' && firstClickRescan && waitingForLoadRescan) {
        // Se il primo click è avvenuto, la pagina è carica e stavamo attendendo, procedi
        console.log('Pagina completamente caricata, ora scansiono con rescan.');
         waitingForLoadRescan = false; // Resetta waitingForLoad
            startRescan(tabId);
            firstClickRescan = false;

       
    }
});
// Codice esistente...

// Aggiungi qui il codice per adattare la larghezza dei pulsanti
function adjustButtonWidths() {
    const buttonRows = document.querySelectorAll('.button-row');
    buttonRows.forEach(row => {
        const buttons = row.querySelectorAll('.button-row-item');
        let maxWidth = 0;

        // Trova la larghezza massima tra i pulsanti della riga
        buttons.forEach(button => {
            button.style.width = 'auto'; // Resetta la larghezza per calcolare la larghezza effettiva
            if (button.offsetWidth > maxWidth) {
                maxWidth = button.offsetWidth;
            }
        });

        // Applica la larghezza massima a tutti i pulsanti della riga
        buttons.forEach(button => {
            button.style.width = `${maxWidth}px`;
        });
    });
}

// Esegui la funzione quando la lingua cambia
document.getElementById('language-select').addEventListener('change', adjustButtonWidths);

// Esegui la funzione al caricamento della pagina
window.addEventListener('load', adjustButtonWidths);


// Aggiungi l'event listener per il pulsante Experimental
document.getElementById('experimental-button').addEventListener('click', () => {
    if (isExperimentalLoading) return; // Impedisce l'avvio se è già in corso

     experimentalButton.disabled = true;
     isExperimentalLoading = true;

    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      // Invia un messaggio al content script per avviare la funzione sperimentale
      chrome.tabs.sendMessage(currentTabId, { action: "startExperimentalFunction" });
    });
  });

document.getElementById('closeBtn')?.addEventListener('click', () => {
    chrome.runtime.sendMessage({ action: "closePanel" });
});
chrome.runtime.onMessage.addListener(async (request, sender, sendResponse) => {
    if (request.action === "showChangelogOverlay") { 
            console.log("Changelog ricevuto:", request.changelogs);
            showChangelogOverlay(request.changelogs, request.currentVersion);
    }
});

async function showChangelogOverlay(changelogs, currentVersion) {
    const overlay = document.createElement('div');
    overlay.style.position = 'absolute';
    overlay.style.top = '0';
    overlay.style.left = '0';
    overlay.style.width = '100%';
    overlay.style.height = '100%';
    overlay.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
    overlay.style.zIndex = '1000';
    overlay.style.display = 'flex';
    overlay.style.justifyContent = 'center';
    overlay.style.alignItems = 'center';
    overlay.style.fontFamily = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif';

    const changelogContainer = document.createElement('div');
    changelogContainer.style.backgroundColor = '#fff';
    changelogContainer.style.padding = '20px';
    changelogContainer.style.borderRadius = '5px';
    changelogContainer.style.maxWidth = '90%';
     changelogContainer.style.maxHeight = '90%';
    changelogContainer.style.overflowY = 'auto';
    changelogContainer.style.textAlign = 'left';
    changelogContainer.style.color = '#333';

  const titleElement = document.createElement('h2');
       titleElement.style.textAlign = 'center';
       titleElement.textContent = translations[currentLanguage]["new-version-installed"] + ` (${currentVersion})`;
        changelogContainer.appendChild(titleElement);

    // Mostra i changelog in ordine inverso
     for (let i = changelogs.length - 1; i >= 0; i--) {
        const entry = changelogs[i];
         const versionElement = document.createElement('h3');
        versionElement.textContent = `Versione ${entry.version}`;
        versionElement.style.textAlign = 'center';
        const changelogTextElement = document.createElement('p');
        changelogTextElement.style.whiteSpace = 'pre-line';
        changelogTextElement.style.fontSize = '1em';
        
         const log = entry.log[currentLanguage] || entry.log["en"] || ""; // Default to English if language not found
         changelogTextElement.textContent = log;


        changelogContainer.appendChild(versionElement);
        changelogContainer.appendChild(changelogTextElement);
   };
    
    if (changelogs.length > 3) {
        const moreText = document.createElement('p');
         moreText.textContent = '...';
        moreText.style.textAlign = 'center';
          moreText.style.fontSize = '1.2em';
         changelogContainer.appendChild(moreText);
     }


   const closeButton = document.createElement('button');
    closeButton.textContent = translations[currentLanguage]["close-panel"];
    closeButton.style.display = 'block';
    closeButton.style.marginTop = '10px';
    closeButton.style.margin = '0 auto';
    closeButton.style.padding = '8px 16px';
    closeButton.style.fontSize = '14px';
    closeButton.style.border = '2px solid';
    closeButton.style.borderRadius = '4px';
    closeButton.style.cursor = 'pointer';
    closeButton.style.backgroundColor = 'white';
    closeButton.style.color = '#333333';
    closeButton.style.fontFamily = 'Arial, sans-serif';
    closeButton.style.webkitFontSmoothing = 'antialiased';
    closeButton.style.mozOsxFontSmoothing = 'grayscale';
    closeButton.style.alignSelf = 'center';
    closeButton.style.borderColor = '#3498db';

    changelogContainer.appendChild(closeButton);
    overlay.appendChild(changelogContainer);

    const bodyElement = document.querySelector('body');
    bodyElement.appendChild(overlay);


    closeButton.onclick = () => {
        bodyElement.removeChild(overlay);
    };

    // Click fuori dal modal lo chiude
    overlay.onclick = (event) => {
         if (event.target === overlay) {
                bodyElement.removeChild(overlay);
            }
    };
}

function showTemporaryMessage(message) {
    const messageOverlay = document.createElement('div');
    messageOverlay.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background-color: #2c3e50;
        color: white;
        padding: 15px 25px;
        border-radius: 8px;
        font-size: 16px;
        font-weight: 500;
        z-index: 1000;
        box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        animation: fadeInOut 2.5s ease-in-out forwards;
        text-align: center;
        min-width: 200px;
    `;

    const style = document.createElement('style');
    style.textContent = `
        @keyframes fadeInOut {
            0% { opacity: 0; transform: translate(-50%, -40%); }
             15% { opacity: 1; transform: translate(-50%, -50%); }
             85% { opacity: 1; transform: translate(-50%, -50%); }
            100% { opacity: 0; transform: translate(-50%, -60%); }
        }
    `;
    document.head.appendChild(style);

    messageOverlay.textContent = message;
    document.body.appendChild(messageOverlay);

    setTimeout(() => {
        messageOverlay.remove();
        style.remove();
    }, 2500);
}
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "updateDimensionRange") {
        // Aggiorna i valori minimi degli input
        document.getElementById('width-value-min').value = request.minWidth;
        document.getElementById('height-value-min').value = request.minHeight;
    }
});
// Funzione per creare il pulsante cerca con
// Funzione per creare il pulsante cerca con
function createMagnifyButton(container, imageUrl) {
    // Only create the button if the setting is enabled
    if (!showSearchWithGoogleButton) {
        return; // Exit early if the setting is disabled
    }
    const magnifyButton = document.createElement('div');
    magnifyButton.className = 'search-with-google-button';
    magnifyButton.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="11" cy="11" r="8"></circle>
            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
            <line x1="11" y1="8" x2="11" y2="14"></line>
            <line x1="8" y1="11" x2="14" y2="11"></line>
        </svg>
    `;
    
    // Usa search-with-google come chiave nel data-tooltip-key
    magnifyButton.setAttribute('data-tooltip-key', 'search-with-google');
    
    // Imposta il tooltip iniziale con la lingua corrente
    magnifyButton.title = translations[currentLanguage]['search-with-google'];
    
    // Aggiungiamo l'event listener per cercare l'immagine
    magnifyButton.addEventListener('click', (e) => {
        e.stopPropagation(); // Previene la propagazione del click al contenitore
        SearchWithGoogle(imageUrl);
    });
    
    // Aggiungi anche l'effetto hover come per il pulsante "open in new tab"
    magnifyButton.addEventListener('mouseenter', () => {
        magnifyButton.style.opacity = '1';
    });

    magnifyButton.addEventListener('mouseleave', () => {
        magnifyButton.style.opacity = '0.8';
    });
    
    container.appendChild(magnifyButton);
}
// Funzione che cerca l'immagine su Google Lens
// Funzione che cerca l'immagine su Google Lens
function SearchWithGoogle(imageUrl) {
    // URL di base per la ricerca con Google Lens
    const googleLensUrl = `https://lens.google.com/uploadbyurl?url=${encodeURIComponent(imageUrl)}`;
    
    // Apri una nuova scheda con Google Lens
    chrome.tabs.create({ url: googleLensUrl }, (tab) => {
        // Attendiamo che la pagina si carichi completamente
        chrome.tabs.onUpdated.addListener(function listener(tabId, changeInfo, updatedTab) {
            // Verifica se l'aggiornamento è per la scheda che abbiamo aperto e se è stato completato
            if (tabId === tab.id && changeInfo.status === 'complete' && 
                updatedTab.url.includes('google.com/search')) {
                
                // Rimuoviamo il listener per evitare che venga chiamato più volte
                chrome.tabs.onUpdated.removeListener(listener);
                
                // Iniettiamo uno script per cliccare sul pulsante "Corrispondenze esatte"
                chrome.scripting.executeScript({
                    target: { tabId: tab.id },
                    function: clickExactMatchButton
                });
            }
        });
    });
}

// Funzione che verrà iniettata nella pagina di Google per cliccare sul pulsante "Corrispondenze esatte"
function clickExactMatchButton() {
    console.log("Attivazione del rilevamento del quinto elemento di navigazione...");
    
    // Definisce una funzione che cerca e interagisce con il quinto elemento
    function findAndClickFifthElement() {
        try {
            // Cerca tutti i possibili elementi di navigazione
            const navigationElements = Array.from(document.querySelectorAll(
                '[role="tab"], .hdtb-mitem, [role="navigation"] a, .MUFPAc a, ' + 
                '[data-hveid] a, .NZmxZe, .VknLRd, [jsname="tab"], [role="listitem"] a'
            ));
            
            console.log(`Elementi di navigazione trovati: ${navigationElements.length}`);
            
            // Se abbiamo trovato almeno 5 elementi
            if (navigationElements.length >= 5) {
                // Prendi il quinto elemento (indice 4)
                const fifthElement = navigationElements[4];
                console.log(`Quinto elemento: "${fifthElement.textContent.trim()}"`);
                
                // Naviga direttamente all'URL dell'elemento
                if (fifthElement.href) {
                    console.log(`Navigando all'URL: ${fifthElement.href}`);
                    window.location.href = fifthElement.href;
                    return true;
                } else {
                    // Se non ha un href, prova a cliccare l'elemento
                    console.log("L'elemento non ha un href, tento di cliccare");
                    fifthElement.click();
                    return true;
                }
            }
            
            // // Piano B: cerca di individuare il contenitore principale
            // const topNavigationBar = document.querySelector('.MUFPAc, [role="navigation"], .hdtb-msel');
            // if (topNavigationBar) {
            //     const parentDiv = topNavigationBar.closest('div');
            //     if (parentDiv) {
            //         const allTabsInTopBar = parentDiv.querySelectorAll('a, [role="tab"]');
                    
            //         if (allTabsInTopBar.length >= 5) {
            //             const fifthTab = allTabsInTopBar[4];
            //             console.log(`Piano B - Quinto tab: "${fifthTab.textContent.trim()}"`);
                        
            //             if (fifthTab.href) {
            //                 window.location.href = fifthTab.href;
            //                 return true;
            //             } else {
            //                 fifthTab.click();
            //                 return true;
            //             }
            //         }
            //     }
            // }
            
            // Non abbiamo trovato l'elemento, ritorna false per continuare a cercare
            return false;
        } catch (error) {
            console.error("Errore durante la ricerca del quinto elemento:", error);
            return false;
        }
    }
    
    // Prima verifica immediata - esegui immediatamente senza timeout
    if (findAndClickFifthElement()) {
        return;
    }
    
    // Configura un observer per rilevare le modifiche al DOM
    const observer = new MutationObserver(() => {
        if (findAndClickFifthElement()) {
            observer.disconnect();
        }
    });
    
    // Inizia a osservare le modifiche al DOM immediatamente
    observer.observe(document.body, {
        childList: true,
        subtree: true
    });
    
    // Come fallback, imposta un polling con un numero massimo di tentativi
    let attempts = 0;
    const maxAttempts = 20;  // 20 tentativi
    const interval = 300;    // 300ms tra ogni tentativo
    
    const pollForElements = () => {
        attempts++;
        
        if (findAndClickFifthElement()) {
            observer.disconnect();
            return;
        }
        
        if (attempts < maxAttempts) {
            setTimeout(pollForElements, interval);
        } else {
            console.log("Raggiunto il numero massimo di tentativi. Impossibile trovare il quinto elemento.");
            observer.disconnect();
        }
    };
    
    // Inizia immediatamente il polling invece di usare setTimeout
    pollForElements();
}

// Add this after other toggle event listeners
document.getElementById('search-with-google-toggle').addEventListener('change', (event) => {
    showSearchWithGoogleButton = event.target.checked;
    // Save to storage
    chrome.storage.local.set({ showSearchWithGoogleButton: showSearchWithGoogleButton }, () => {
        console.log(`Search with Google buttons ${showSearchWithGoogleButton ? 'enabled' : 'disabled'}`);
    });
});

// Add this after other toggle event listeners
document.getElementById('preserve-original-name-toggle').addEventListener('change', (event) => {
    preserveOriginalName = event.target.checked;
    // Save to storage
    chrome.storage.local.set({ preserveOriginalName: preserveOriginalName }, () => {
        console.log(`Preserve original filenames ${preserveOriginalName ? 'enabled' : 'disabled'}`);
    });
});

// Aggiungi questo listener se non esiste già
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "resetGUI" && request.tabId === currentTabId) {
        // Ripristina la GUI
        isPaused = false;
        isStopped = false;
        toggleRescanButton(true); // Mostra il pulsante "Scansiona pagina"
        updateProgress(0, 0, 0); // Resetta la barra del progresso
        
        // Nascondi la barra di progresso e i controlli di download
        document.getElementById('progress-container').style.display = 'none';
        document.getElementById('download-controls').style.display = 'none';
    }
});