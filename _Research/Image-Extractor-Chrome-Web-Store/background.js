let currentImageUrl = null;
let firstClick = false; // Variabile per il primo clic
let waitingForLoad = false;
let singleImageScanLaunched = false;
let secondScanLaunched = false;
let isScanning = false;

const tabStates = {}; // Holds state per tabId: { [tabId]: { isScanning, waitingForLoad, singleImageScanLaunched, ... } }




// Nuova variabile per memorizzare il changelog
const changelogs = {
    // "1.3.0": {
    //     "en": "",
    //     "it": "",
    //     "es": "",
    //     "fr": "",
    //     "de": ""
    // },
    "1.4.0": {
        "en": "arte.tv finetuned: scan process can now detect a greater number of variants.",
        "it": "arte.tv ottimizzato: il processo di scansione rileva un numero maggiore di varianti.",
        "es": "arte.tv optimizado: el proceso de escaneo ahora puede detectar un mayor número de variantes.",
        "fr": "arte.tv optimisé : le processus de scan peut maintenant détecter un plus grand nombre de variantes.",
        "de": "arte.tv optimiert: Der Scanvorgang kann jetzt eine größere Anzahl von Varianten erkennen."
    },
    "1.3.9": {
        "en": "IMDb finetuned: scan now detects a greater number of variants.",
        "it": "IMDb ottimizzato: la scansione ora rileva un numero maggiore di varianti.",
        "es": "IMDb optimizado: el escaneo ahora detecta un mayor número de variantes.",
        "fr": "IMDb optimisé : le scan détecte maintenant un plus grand nombre de variantes.",
        "de": "IMDb optimiert: Der Scan erkennt jetzt eine größere Anzahl von Varianten."
    },
     "1.3.8": {
    "en": "Added an option to preserve the original filename when downloading single images. \n\nComicartfans site has been optimized to find original versions of images.",
    "it": "Aggiunta un'opzione per preservare il nome file originale quando si scaricano singole immagini. /n/nIl sito Comicartfans è stato ottimizzato per trovare le versioni originali delle immagini.",
    "es": "Se añadió una opción para preservar el nombre de archivo original al descargar imágenes individuales. /n/nEl sitio Comicartfans ha sido optimizado para encontrar versiones originales de las imágenes.",
    "fr": "Ajout d'une option pour préserver le nom de fichier original lors du téléchargement d'images individuelles. /n/nLe site Comicartfans a été optimisé pour trouver les versions originales des images.",
    "de": "Eine Option wurde hinzugefügt, um den originalen Dateinamen beim Herunterladen einzelner Bilder beizubehalten. /n/nDie Comicartfans-Website wurde optimiert, um Originalversionen der Bilder zu finden."
},
    "1.3.7": {
    "en": "Fixed progress bar display issue: download progress is now correctly shown only in the active tab and doesn't interfere with other tabs.\nImproved tab management for better multi-tab downloads experience.\nVarious performance optimizations for simultaneous downloads.",
    "it": "Risolto un problema con la barra del progresso dei download: adesso viene mostrato correttamente solo sulla tab attiva e non interferisce con altre tab.\nMigliorata la gestione delle schede per una migliore esperienza di download in più tab.\nVarie ottimizzazioni delle prestazioni per i download simultanei.",
    "es": "Solucionado un problema con la barra de progreso de descargas: ahora se muestra correctamente solo en la pestaña activa y no interfiere con otras pestañas.\nMejorada la gestión de pestañas para una mejor experiencia de descargas en múltiples pestañas.\nVarias optimizaciones de rendimiento para descargas simultáneas.",
    "fr": "Correction d'un problème avec la barre de progression des téléchargements: elle s'affiche désormais correctement uniquement dans l'onglet actif et n'interfère pas avec les autres onglets.\nAmélioration de la gestion des onglets pour une meilleure expérience de téléchargement multi-onglets.\nDiverses optimisations de performance pour les téléchargements simultanés.",
    "de": "Problem mit der Download-Fortschrittsanzeige behoben: Der Fortschritt wird jetzt korrekt nur auf dem aktiven Tab angezeigt und beeinträchtigt keine anderen Tabs.\nVerbesserte Tab-Verwaltung für ein besseres Download-Erlebnis mit mehreren Tabs.\nVerschiedene Leistungsoptimierungen für gleichzeitige Downloads."
},
    "1.3.6": {
    "en": "Search with Google now automatically finds exact matches",
    "it": "Cerca con Google ora trova automaticamente corrispondenze esatte",
    "es": "Buscar con Google ahora encuentra automáticamente coincidencias exactas",
    "fr": "Rechercher avec Google trouve désormais automatiquement des correspondances exactes",
    "de": "Suche mit Google findet jetzt automatisch exakte Übereinstimmungen"
},
"1.3.5": {
    "en": "Fixed STOP and PAUSE functions for downloads.\nWhen downloading single images, the original filename is now preserved without adding suffix.\nImages without extensions are now automatically saved as .jpg format.\nFixed an issue where original file extensions were not respected during direct downloads (now JPG files remain JPG instead of being converted to WebP).",
    "it": "Ripristinato il funzionamento dei pulsanti STOP e PAUSA per i download.\nNel download di immagini singole, il nome del file originale viene ora preservato senza aggiungere suffissi.\nLe immagini senza estensione vengono ora automaticamente salvate in formato .jpg.\nRisolto un problema per cui le estensioni originali dei file non venivano rispettate durante i download diretti (ora i file JPG rimangono JPG invece di essere convertiti in WebP).",
    "es": "Corregido el funcionamiento de los botones STOP y PAUSA para descargas.\nAl descargar imágenes individuales, el nombre original del archivo ahora se conserva sin añadir sufijos.\nLas imágenes sin extensión ahora se guardan automáticamente en formato .jpg.\nSolucionado un problema donde las extensiones de archivo originales no se respetaban durante las descargas directas (ahora los archivos JPG permanecen como JPG en lugar de convertirse a WebP).",
    "fr": "Correction des fonctions STOP et PAUSE pour les téléchargements.\nLors du téléchargement d'images individuelles, le nom de fichier original est maintenant conservé sans ajouter de suffixe.\nLes images sans extension sont désormais automatiquement enregistrées au format .jpg.\nRésolution d'un problème où les extensions de fichiers originales n'étaient pas respectées lors des téléchargements directs (maintenant les fichiers JPG restent en JPG au lieu d'être convertis en WebP).",
    "de": "Die Funktionen STOP und PAUSE für Downloads wurden repariert.\nBeim Herunterladen einzelner Bilder wird der ursprüngliche Dateiname jetzt ohne Zusätze beibehalten.\nBilder ohne Erweiterung werden jetzt automatisch im .jpg-Format gespeichert.\nEin Problem wurde behoben, bei dem die ursprünglichen Dateierweiterungen bei direkten Downloads nicht beibehalten wurden (jetzt bleiben JPG-Dateien JPG, anstatt in WebP umgewandelt zu werden)."
},
    "1.3.4": {
    "en": "Improved URL variant detection: Image Extractor now finds more original versions of images by generating all possible combinations when URLs contain repeated patterns.",
    "it": "Migliorata la rilevazione delle varianti URL: Image Extractor ora trova più versioni originali delle immagini generando tutte le possibili combinazioni quando gli URL contengono pattern ripetuti.",
    "es": "Detección mejorada de varianti de URL: Image Extractor ahora encuentra más versiones originales de immagini generando tutte le combinazioni possibili quando las URL contienen patrones repetidos.",
    "fr": "Détection améliorée des variantes d'URL : Image Extractor trouve maintenant plus de versions originales des images en générant toutes les combinaisons possibles lorsque les URL contiennent des motifs répétés.",
    "de": "Verbesserte URL-Variantenerkennung: Image Extractor findet jetzt mehr Originalversionen von Bildern, indem er alle möglichen Kombinationen generiert, wenn URLs wiederholte Muster enthalten."
},
        "1.3.3": {
        "en": "BUGFIX: In some rare cases, variants were not being associated with the individual thumbnail. Fixed.",
        "it": "BUGFIX: in alcune rare occasioni le varianti non venivano associate alla singola miniatura. Risolto.",
        "es": "BUGFIX: En algunas ocasiones raras, las variantes no se asociaban a la miniatura individual. Solucionado.",
        "fr": "BUGFIX: Dans de rares cas, les variantes n'étaient pas associées à la miniature individuelle. Corrigé.",
        "de": "BUGFIX: In einigen seltenen Fällen wurden die Varianten nicht der einzelnen Miniatur zugeordnet. Behoben."
    },
    "1.3.2": {
        "en": "Added a button to search all scanned images using Google. Added a setting to disable this button",
        "it": "È stato aggiunto un pulsante per cercare tutte le immagini scannerizzate con Google. È stata aggiunta un'impostazione per disabilitare questo pulsante",
        "es": "Se ha añadido un botón para buscar todas las imágenes escaneadas con Google. Se ha añadido una configuración para desactivar este botón",
        "fr": "Un bouton a été ajouté pour rechercher toutes les images scannées avec Google. Un paramètre a été ajouté pour désactiver ce bouton",
        "de": "Eine Schaltfläche wurde hinzugefügt, um alle gescannten Bilder mit Google zu suchen. Eine Einstellung wurde hinzugefügt, um diese Schaltfläche zu deaktivieren"
    },
"1.3.0": {
        "en": "New DEEP SCAN option near to SCAN PAGE: find more images when selected, but might group fewer similar images together. \nNew variant filter added: Image Extractor search in a smarter way original version of images. \nFixed a bug that always showed 0 as minimum value of first scan (in range sliders).",
        "it": "Nuova opzione Scansione Profonda vicino a Scansiona pagina: trova più immagini quando selezionata, ma potrebbe raggruppare meno immagini simili tra loro. \nNuovo filtro variante aggiunto: Image Extractor cerca in modo più intelligente la versione originale delle immagini. \nRisolto un bug che mostrava sempre 0 come valore minimo della prima scansione (nei selettori di intervallo).",
        "es": "Nueva opción Escaneo Profundo cerca de Escanear Página: encuentra más imágenes cuando se selecciona, pero podría agrupar menos imágenes similares entre sí. \nNuevo filtro de variante añadido: Image Extractor busca de manera más inteligente la versión original de las imágenes. \nCorregido un error que siempre mostraba 0 como valor mínimo en la primera exploración (en los controles deslizantes de rango).",
        "fr": "Nouvelle option Scan Profond près de Scanner la Page: trouve plus d'images lorsqu'elle est sélectionnée, mais pourrait regrouper moins d'images similaires entre elles. \nNouveau filtre variante ajouté : Image Extractor recherche de manière plus intelligente la version originale des images. \nCorrection d'un bug qui affichait toujours 0 comme valeur minimale lors du premier scan (dans les curseurs de plage).",
        "de": "Neue Option Tiefen-Scan in der Nähe von Seite Scannen: findet mehr Bilder, wenn ausgewählt, könnte aber weniger ähnliche Bilder zusammen gruppieren. \nNeuer Variantenfilter hinzugefügt: Image Extractor sucht auf intelligente Weise nach der Originalversion der Bilder. \nEin Fehler wurde behoben, bei dem immer 0 als Mindestwert beim ersten Scan angezeigt wurde (in den Bereichs-Schiebereglern)."
    },
       "1.2.0": {
        "en": "New scan-per-tab system: every tab can now individually scan and download images keeping other scan in other tabs. \nThe parallelized deepscan has been optmized to prevent sites from blocking too many simultaneous request. \nThe scan in CSFD site (both cz and sk) has been finetuned. Small fixes in Keep scanned images option. Layout enhancements. Other minor fixes.",
        "it": "Nuovo sistema di scansione per scheda: ogni scheda può ora scansionare e scaricare immagini individualmente, mantenendo altre scansioni in altre schede. \nLa scansione profonda parallelizzata è stata ottimizzata per evitare che i siti blocchino troppe richieste simultanee. \nLa scansione nel sito CSFD (sia cz che sk) è stata perfezionata. Piccole correzioni nell'opzione 'Conserva immagini scansionate'. Miglioramenti al layout. Altre piccole correzioni.",
        "es": "Nuevo sistema de escaneo por pestaña: cada pestaña ahora puede escanear y descargar imágenes de forma individual, manteniendo otros escaneos en otras pestañas. \nEl escaneo profundo paralelizado ha sido optimizado para evitar que los sitios bloqueen demasiadas solicitudes simultáneas. \nEl escaneo en el sitio CSFD (tanto cz como sk) ha sido ajustado. Mejoras en el diseño. Pequeñas correcciones en la opción 'Guardar imágenes escaneadas'. Otras correcciones menores.",
        "fr": "Nouveau système de scan par onglet : chaque onglet peut maintenant scanner et télécharger des images individuellement, tout en conservant d'autres scans dans d'autres onglets. \nLe deepscan parallélisé a été optimisé pour empêcher les sites de bloquer trop de demandes simultanées. \nLe scan sur le site CSFD (cz et sk) a été affiné. Améliorations de la mise en page. Petites corrections dans l'option 'Conserver les images scannées'. Autres corrections mineures.",
        "de": "Neues Scan-pro-Tab-System: Jeder Tab kann jetzt individuell scannen und Bilder herunterladen, während andere Scans in anderen Tabs fortgesetzt werden. \nDer parallelisierte Deepscan wurde optimiert, um zu verhindern, dass Websites zu viele gleichzeitige Anfragen blockieren. \nDer Scan auf der CSFD-Website (sowohl cz als auch sk) wurde verfeinert. Layout-Verbesserungen. Kleine Korrekturen bei der Option 'Gescannte Bilder behalten'. Weitere kleinere Korrekturen."
     },
    "1.1.0": {
        "en": "New option KEEP SCANNED IMAGES next to the SCAN button. When selected, the panel will temporarily retain the images found during subsequent scans on the same page. \nADDITIONALLY: you can use this option to add individual images. When you right-click and extract a specific image, select the button KEEP SCANNED IMAGES and extract a single image to add it. In this way, you can add them and download them all together \n\nNEW HEADER MENU GRAPHICS: Settings menu is in the header LOGO ",
        "it": "Nuova opzione CONSERVA IMMAGINI SCANSIONATE di fianco al pulsante SCANSIONA. Quando viene selezionato, il pannello manterrà temporaneamente le immagini trovate durante le le successive scansioni nella stessa pagina. \nINOLTRE: puoi usare quest'opzione per aggiungere singole immagini. Quando fai clic destro ed estrai un'immagine specifica, seleziona il pulsante CONSERVA IMMAGINI SCANSIONATE ed estrai un'immagine singola per aggiungerla. In questo modo puoi aggiungerle e scaricarle tutte insieme \n\nNUOVA GRAFICA DEL MENU HEADER: Il menu delle impostazioni è nel LOGO dell'header",
        "es": "Nueva opción GUARDAR IMÁGENES ESCANEADAS junto al botón ESCANEAR. Cuando está seleccionado, el panel retendrá temporalmente las imágenes encontradas durante los siguientes escaneos en la misma página. \nADEMÁS: puedes usar esta opción para agregar imágenes individuales. Cuando hagas clic derecho y extraigas una imagen específica, selecciona el botón GUARDAR IMÁGENES ESCANEADAS y extrae una imagen individual para agregarla. De esta manera, puedes agregarlas y descargarlas todas juntas \n\nNUEVOS GRÁFICOS DEL MENÚ DE ENCABEZADO: El menú de configuración está en el LOGO del encabezado",
        "fr": "Nouvelle option CONSERVER LES IMAGES SCANNÉES à côté du bouton SCANNER. Lorsqu'elle est sélectionnée, le panneau conservera temporairement les images trouvées lors des analyses suivantes sur la même page. \nDE PLUS: vous pouvez utiliser cette option pour ajouter des images individuelles. Lorsque vous faites un clic droit et extrayez une image spécifique, sélectionnez le bouton CONSERVER LES IMAGES SCANNÉES et extrayez une image individuelle pour l'ajouter. De cette façon, vous pouvez les ajouter et les télécharger toutes ensemble \n\nNOUVEAUX GRAPHIQUES DU MENU EN-TÊTE: Le menu des paramètres est dans le LOGO de l'en-tête",
        "de": "Neue Option GESCANNTE BILDER BEHALTEN neben der SCHALTFLÄCHE SCANNEN. Wenn ausgewählt, behält das Panel vorübergehend die Bilder, die bei nachfolgenden Scans auf derselben Seite gefunden wurden. \nZUSÄTZLICH: Sie können diese Option verwenden, um einzelne Bilder hinzuzufügen. Wenn Sie mit der rechten Maustaste klicken und ein bestimmtes Bild extrahieren, wählen Sie die Schaltfläche GESCANNTE BILDER BEHALTEN und extrahieren Sie ein einzelnes Bild, um es hinzuzufügen. Auf diese Weise können Sie sie hinzufügen und alle zusammen herunterladen \n\nNEUE HEADER-MENÜ-GRAFIKEN: Das Einstellungsmenü befindet sich im HEADER-LOGO"
     },
     "1.0.8": {
        "en": "JustWatch finetuned: you can find variants for posters inside justwatch site",
        "it": "JustWatch ottimizzato: Puoi trovare varianti per i poster all'interno del sito di JustWatch",
        "es": "JustWatch ajustado: Puedes encontrar variantes para los pósters dentro del sitio de JustWatch",
        "fr": "JustWatch affiné: Vous pouvez trouver des variantes pour les affiches sur le site de JustWatch",
        "de": "JustWatch optimiert: Du kannst Varianten für Poster innerhalb der JustWatch-Website finden"
     },
    "1.0.7": {
        "en": "animeclick finetuned / Bug fixed: rarely, during scans of more than 2000 images, the side panel was not populated, and the scan was not completed ",
        "it": "animeclick ottimizzato / bug risolto: raramente, durante scansioni di oltre 2000 immagini, il sidepanel non veniva popolato e la scansione non veniva conclusa",
        "es": "animeclick ajustado / Error corregido: rara vez, durante escaneos de más de 2000 imágenes, el panel lateral no se poblaba y el escaneo no se completaba",
        "fr": "animeclick affiné / rarement, lors de scans de plus de 2000 images, le panneau latéral ne se remplissait pas et le scan ne se terminait pas",
        "de": "animeclick optimiert / Selten wurde während Scans von mehr als 2000 Bildern das Seitenpanel nicht gefüllt und der Scan nicht abgeschlossen"
     },
    "1.0.6": {
        "en": "various fixes and improvements under the hood",
        "it": "varie correzioni e miglioramenti sotto il cofano",
        "es": "varias correcciones y mejoras internas",
        "fr": "diverses corrections et améliorations en interne",
        "de": "verschiedene Korrekturen und interne Verbesserungen"
     },
    "1.0.5": {
        "en": "IMDB finetuned \nminor bugfixes (thumbnail now always shows the smaller image)",
        "it": "IMDB ottimizzato \ncorrezioni minori (le anteprime ora mostrano sempre l'immagine più piccola)",
        "es": "IMDB ajustado \ncorrecciones menores (las miniaturas ahora siempre muestran la imagen más pequeña)",
        "fr": "IMDB affiné \ncorrections mineures (les miniatures affichent toujours la plus petite image)",
        "de": "IMDB optimiert \nKleinere Fehlerbehebungen (Miniaturansichten zeigen jetzt immer das kleinere Bild)"
    },
    "1.0.4": {
        "en": "minor bugfixes",
        "it": "correzioni minori",
        "es": "correcciones menores",
        "fr": "corrections mineures",
        "de": "kleinere Fehlerbehebungen"
    },
     "1.0.3": {
        "en": "Added immobiliare to optimized sites \nAddition of a botton on every thumbnail to open images in a new tab, based on the selected option in the menu \nminor bugfixes",
        "it": "Aggiunto immobiliare ai siti ottimizzati \nAggiunto un bottone su ogni anteprima per aprire le immagini in una nuova scheda, in base all'opzione selezionata nel menu \ncorrezioni minori",
        "es": "Añadido immobiliare a los sitios optimizados \nAdición de un botón en cada miniatura para abrir imágenes en una nueva pestaña, basado en la opción seleccionada en el menú \ncorrecciones menores",
        "fr": "Ajout de immobiliare aux sites optimisés \nAjout d'un bouton sur chaque miniature pour ouvrir les images dans un nouvel onglet, basé sur l'option sélectionnée dans le menu \ncorrections mineures",
        "de": "Immobiliare zu optimierten Seiten hinzugefügt \nHinzufügen einer Schaltfläche auf jeder Miniaturansicht, um Bilder in einem neuen Tab zu öffnen, basierend auf der im Menü ausgewählten Option \nKleinere Fehlerbehebungen"
    },
    "1.0.2": {
        "en": "Added Animeclick to optimized sites \nminor bugfixes",
        "it": "Aggiunto Animeclick ai siti ottimizzati \ncorrezioni minori",
        "es": "Añadido Animeclick a los sitios optimizados \ncorrecciones menores",
        "fr": "Ajout d'Animeclick aux sites optimisés \ncorrections mineures",
        "de": "Animeclick zu optimierten Seiten hinzugefügt \nKleinere Fehlerbehebungen"
    },
    "1.0.1": {
        "en": "minor bugfixes",
        "it": "correzioni minori",
        "es": "correcciones menores",
        "fr": "corrections mineures",
        "de": "kleinere Fehlerbehebungen"
        
    }
};

async function checkAndShowChangelog(tabId, currentVersion) {
    const storedVersion = await new Promise((resolve) => {
        chrome.storage.local.get('checkversion', (result) => {
            resolve(result.checkversion);
        });
    });

    if (storedVersion === undefined) {
        // Prima installazione, scrivi la versione e non mostrare il changelog
        chrome.storage.local.set({ checkversion: currentVersion }, () => {
            console.log(`checkversion initialized to ${currentVersion}`);
        });
        return; // Esce senza mostrare il changelog
    }

    if (storedVersion !== currentVersion) {
        const versionKeys = Object.keys(changelogs).sort(); // Ordina le versioni in modo ascendente
        const currentVersionIndex = versionKeys.indexOf(currentVersion);
        const lastThreeChangelogs = [];
       
        if (currentVersionIndex !== -1) {
            for (let i = Math.max(0, currentVersionIndex - 2); i <= currentVersionIndex; i++) {
                const version = versionKeys[i];
                 if (changelogs[version]) {
                     lastThreeChangelogs.push({ version, log: changelogs[version] });
                   }
            }
        }

        if (lastThreeChangelogs.length > 0) {
            chrome.runtime.sendMessage({
                action: "showChangelogOverlay",
                changelogs: lastThreeChangelogs,
                currentVersion,
            });
        }

        // Aggiorna la versione in storage
        chrome.storage.local.set({ checkversion: currentVersion }, () => {
            console.log(`checkversion updated to ${currentVersion}`);
        });
    }

}








function getTabState(tabId) {
    if (!tabStates[tabId]) {
        tabStates[tabId] = {
            isScanning: false,
            waitingForLoad: false,
            firstClick: false,
            singleImageScanLaunched: false,
            secondScanLaunched: false,
            currentImageUrl: null,
             timeoutId: null
        };
    }
     if (tabStates[tabId].timeoutId) {
       clearTimeout(tabStates[tabId].timeoutId);
    }

    // Imposta un nuovo timer di 10 minuti
    tabStates[tabId].timeoutId = setTimeout(() => {
       console.log(`Removing tab id ${tabId} due to inactivity.`);
        delete tabStates[tabId];
      }, 10 * 60 * 1000); // 10 minuti
    return tabStates[tabId];
}

//Inietta content.js se la tab non è stata ricaricata quando l'estensione è stata installata o ricaricata (solo sulla tab su cui avviene il clic)
// chrome.contextMenus.onClicked.addListener((info, tab) => {
//     if (info.menuItemId === 'extractImages') {
//         chrome.sidePanel.setOptions({ enabled: true, path: "sidebar.html" });
//         chrome.sidePanel.open({ windowId: tab.windowId });

//          // Verifica se il content script è già presente
//         chrome.tabs.sendMessage(tab.id, { action: "checkContentScript" }, (response) => {
//             if (chrome.runtime.lastError || !response || response.action !== "contentScriptPresent") {
//                 // Se non c'è risposta o c'è errore, inietta il content script
//                 chrome.scripting.executeScript({
//                     target: { tabId: tab.id },
//                     files: ["lib/jszip.min.js", "lib/html2canvas.min.js", "lib/rxjs.umd.min.js", "content.js"]
                 
//                 });
//             } 
            
//         });
//     }
// });

// Funzione per verificare se l'URL è valido
function isValidUrl(url) {
    return url && (url.startsWith('http://') || url.startsWith('https://'));
}
// Funzione per iniettare il content script in una tab specifica
async function injectContentScript(tabId) {
    try {
      // 1. Controlla se il content script è già presente
      await chrome.tabs.sendMessage(tabId, { 
        action: "checkContentScript" 
      });
      console.log(`Content script già presente nella tab ${tabId}`);
         getTabState(tabId); // Avvia il timer all'iniezione
      return;
    } catch (error) {
      // 2. Ignora solo l'errore specifico "Receiving end does not exist"
      if (!error.message.includes("Receiving end does not exist")) {
        console.warn("Errore durante il controllo:", error);
      }
    }
  
    // 3. Inietta il content script solo se necessario
    try {
      await chrome.scripting.executeScript({
        target: { tabId },
        files: ["lib/jszip.min.js", "lib/html2canvas.min.js", "lib/rxjs.umd.min.js", "content.js"]
      });
      console.log(`✅ Content script iniettato con successo nella tab ${tabId}`);
     getTabState(tabId); // Avvia il timer all'iniezione
    } catch (injectionError) {
      console.warn("❌ Errore durante l'iniezione:", injectionError);
    }
  }
// Listener per quando una tab diventa attiva
chrome.tabs.onActivated.addListener((activeInfo) => {
    const tabId = activeInfo.tabId;
    chrome.tabs.get(tabId, (tab) => {
        if (tab && isValidUrl(tab.url)) {
            injectContentScript(tabId);
        }
    });
});

// Listener per quando una finestra riceve il focus
chrome.windows.onFocusChanged.addListener((windowId) => {
    if (windowId !== chrome.windows.WINDOW_ID_NONE) {
        chrome.tabs.query({ active: true, windowId: windowId }, (tabs) => {
            if (tabs.length > 0) {
                const tabId = tabs[0].id;
                if (isValidUrl(tabs[0].url)) {
                    injectContentScript(tabId);
                }
            }
        });
    }
});





//Inietta content.js se su tutte le TAB all'installazione dell'estensione o quando l'estensione viene ricaricata
// chrome.runtime.onInstalled.addListener(() => {
//    chrome.tabs.query({}, (tabs) => {
//      for (const tab of tabs) {
//        chrome.scripting.executeScript({
//          target: { tabId: tab.id },
//           files: ["lib/jszip.min.js", "lib/html2canvas.min.js", "lib/rxjs.umd.min.js", "content.js"]
//        });
//      }
//    });
//  });
// Crea il menu contestuale
chrome.contextMenus.create({
    id: 'extractImages',
    title: 'Extract Image(s)',
    contexts: ['all']
}, () => {
     if (chrome.runtime.lastError) {
        console.warn("Menu contestuale già esistente. Lo rimuovo e lo ricreo.");
           chrome.contextMenus.remove('extractImages', () => {
                chrome.contextMenus.create({
                    id: 'extractImages',
                    title: 'Extract Image(s)',
                    contexts: ['all']
                 });
           });
    }
});




// Gestione dei messaggi dal content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'updateContextMenu') {
        // Salva l'URL della nuova immagine cliccata
        currentImageUrl = request.imageUrl;
    }else if (request.action === "toggleRescanButton") {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            chrome.tabs.sendMessage(tabs[0].id, { action: "toggleRescanButton", visible: request.visible });
        });
    }

});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "downloadError") {
        console.log("Errore ricevuto dal content script:", request.url);

        // Inoltra il messaggio di errore al sidepanel
        chrome.runtime.sendMessage({
            action: "downloadError",
            url: request.url,
            groupKey: request.groupKey
        });
    }
});


function resetRescanFlags() {
    singleImageScanLaunched = false;
    secondScanLaunched = false;
}


function startScan(tab, imageUrl) {
    const state = getTabState(tab.id);
    state.isScanning = true;

    chrome.runtime.sendMessage({ 
        action: "startLoading",
        tabId: tab.id
    });

    // Controlla se stiamo avviando una scansione dal menu contestuale
    const isContextMenuScan = state.firstClick;

    if (isContextMenuScan) {
        // Se è una scansione dal menu contestuale, controlla lo stato del checkbox
        chrome.runtime.sendMessage({ 
            action: "getKeepScannedStatus", 
            tabId: tab.id 
        }, response => {
            if (response && response.keepScanned === false) {
                // Pulisci il sidepanel solo se keep scanned è deselezionato
                chrome.runtime.sendMessage({ 
                    action: "clearSidebar",
                    tabId: tab.id  
                });
            }

            // Procedi con la scansione
            if (imageUrl) {
                state.singleImageScanLaunched = true;
                chrome.tabs.sendMessage(tab.id, {
                    action: "extractImages",
                    singleImageUrl: imageUrl,
                    tabId: tab.id
                });
            } else {
                chrome.tabs.sendMessage(tab.id, { 
                    action: "getImages",
                    tabId: tab.id
                });
            }
        });
    } else {
        // Se non è una scansione dal menu contestuale, procedi normalmente
        if (imageUrl) {
            state.singleImageScanLaunched = true;
            chrome.tabs.sendMessage(tab.id, {
                action: "extractImages",
                singleImageUrl: imageUrl,
                tabId: tab.id
            });
        } else {
            chrome.tabs.sendMessage(tab.id, { 
                action: "getImages",
                tabId: tab.id
            });
        }
    }

    // Esegui checkAndShowChangelog ALL'AVVIO DELLA SCANSIONE
    const manifest = chrome.runtime.getManifest();
    checkAndShowChangelog(tab.id, manifest.version);

    state.currentImageUrl = null;
}




chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    // Assicurati di avere sempre un tabId valido
    const tabId = sender.tab?.id || request.tabId;
    
    if (!tabId) {
        console.warn('Missing tabId in message:', request);
        return;
    }

    if (request.action === "manualScanTriggered") {
        const state = getTabState(tabId);
        resetRescanFlags();
        state.isScanning = true;  // Imposta lo stato di scanning per questa tab
    } else if (request.action === "stopScan") {
        const state = getTabState(tabId);
        state.isScanning = false;
        chrome.tabs.sendMessage(tabId, {
            action: 'stopScan',
            tabId: tabId
        });
    } else if (request.action === "stopDownload") {
        const tabId = request.tabId || sender.tab?.id;
        if (tabId) {
            if (tabStates[tabId]) {
                tabStates[tabId].isStopped = true;
            }
            console.log(`Download fermato nella tab ${tabId}.`);
            resetGUI(tabId); // Ripristina la GUI solo per la tab specifica
        }
    }
});


// Gestione del clic sul menu contestuale
chrome.contextMenus.onClicked.addListener((info, tab) => {
    if (info.menuItemId === 'extractImages' && tab && isValidUrl(tab.url)) {
        const state = getTabState(tab.id);
        // Reset flags before a new manual scan
        state.isScanning = false;
        state.singleImageScanLaunched = false;
        state.secondScanLaunched = false;
        state.firstClick = true;
        state.currentImageUrl = null;

        // Remember the clicked image
        if (currentImageUrl) {
            state.currentImageUrl = currentImageUrl;
        }

        // Create a specific sidepanel for this tab
        chrome.sidePanel.setOptions({ 
            tabId: tab.id, 
            path: `sidebar.html?tabId=${tab.id}`  // Aggiungi tabId come parametro
        });
        chrome.sidePanel.open({ tabId: tab.id });

        state.waitingForLoad = true;
        state.hasSidePanel = true; // Track sidepanel state

        // Verifica se la pagina è completamente caricata
        setTimeout(() => {
            chrome.tabs.get(tab.id, (updatedTab) => {
                if (updatedTab.status === "complete") {
                    // La pagina è caricata, avvia la scansione
                    state.waitingForLoad = false;
                    startScan(tab, state.currentImageUrl);
                } else {
                    // La pagina non è ancora caricata, attendo
                    console.log('Pagina non ancora caricata, attendo...');
                }
            });
        }, 250); // Ritardo di 250ms prima di chiudere il pannello
    }
});


// Listener per chrome.tabs.onUpdated
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    const state = getTabState(tabId);
    if (changeInfo.status === 'complete' && state.firstClick && state.waitingForLoad) {
        // Se il primo click è avvenuto, la pagina è carica e stavamo attendendo, procedi
        console.log('Pagina completamente caricata, ora scansiono.');
        state.waitingForLoad = false; // Resetta waitingForLoad
         chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
             if (isValidUrl(tabs[0].url) && tabs[0].id === tabId) {
                startScan(tabs[0], state.currentImageUrl);
                state.firstClick = false;
            }
        });
       
    }
});

// Gestione di altri messaggi (come prima)
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    const tabId = sender.tab?.id || request.tabId;
    
    if (!tabId) {
        console.warn('Missing tabId in message:', request);
        return;
    }

    if (request.action === "fetchImage") {
        fetch(request.url, {
            headers: {
                'Referer': request.referrer,
                'User-Agent': navigator.userAgent,
                'Cache-Control': 'no-cache', // Disabilita la cache
                'Pragma': 'no-cache' // Disabilita la cache (per compatibilità)
            },
            credentials: 'include',
            mode: 'cors'
        })
            .then(response => response.blob())
            .then(blob => {
                const reader = new FileReader();
                reader.onloadend = () => sendResponse({ data: reader.result });
                reader.readAsDataURL(blob);
            })
            .catch(error => sendResponse({ error: error.message }));
        return true;
    }
    else if (request.action === "retryDownload" || request.action === "ignoreFile") {
        // Inoltra il messaggio al content script
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            chrome.tabs.sendMessage(tabs[0].id, request);
        });
    } else if (request.action === 'fetchAndPrepare') {
        // Estrai l'estensione dall'URL prima del fetch
        const urlObj = new URL(request.url);
        const pathname = urlObj.pathname;
        const extensionMatch = pathname.match(/\.(jpg|jpeg|png|gif|webp|bmp|svg|tiff)$/i);
        const originalExtension = extensionMatch ? extensionMatch[1].toLowerCase() : null;
        
        fetch(request.url, {
            headers: {
                'Referer': request.referrer || ''
            }
        })
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            return response.blob().then(originalBlob => {
                // Determina il MIME type corretto basato sull'estensione
                let mimeType = originalBlob.type;
                
                if (originalExtension) {
                    const mimeMap = {
                        'jpg': 'image/jpeg',
                        'jpeg': 'image/jpeg',
                        'png': 'image/png',
                        'gif': 'image/gif',
                        'webp': 'image/webp',
                        'bmp': 'image/bmp',
                        'svg': 'image/svg+xml',
                        'tiff': 'image/tiff'
                    };
                    
                    if (mimeMap[originalExtension]) {
                        // Se c'è un'estensione nell'URL, usa quel MIME type
                        mimeType = mimeMap[originalExtension];
                    }
                }
                
                // Crea un nuovo blob con il MIME type corretto
                const newBlob = new Blob([originalBlob], { type: mimeType });
                
                const reader = new FileReader();
                reader.onloadend = () => {
                    console.log(`Downloading file: using ${originalExtension || 'header'} extension, MIME type: ${mimeType}`);
                    sendResponse({
                        data: reader.result,
                        contentType: mimeType,
                        originalExtension: originalExtension
                    });
                };
                reader.readAsDataURL(newBlob);
            });
        })
        .catch(error => {
            console.error("Error fetching image:", error);
            sendResponse({ error: error.toString() });
        });
        
        return true; // Indica che la risposta sarà asincrona
    } else if (request.action === "downloadChunk") {
        // Nuovo handler per gestire il download di chunk di file in parallelo
        const files = request.files;
        const downloads = files.map(file => {
            return new Promise((resolve, reject) => {
                chrome.downloads.download({
                    url: file.url,
                    filename: file.filename,
                    conflictAction: 'uniquify',
                    saveAs: false
                }, (downloadId) => {
                    if (chrome.runtime.lastError) {
                        console.error("Errore nel download:", chrome.runtime.lastError.message);
                        reject(chrome.runtime.lastError);
                    } else {
                        resolve(downloadId);
                    }
                });
            });
        });

        // Esegue tutti i download del chunk in parallelo
        Promise.allSettled(downloads).then(results => {
            results.forEach((result, index) => {
                if (result.status === 'rejected') {
                    console.error(`Download fallito per ${files[index].filename}:`, result.reason);
                }
            });
        });
    }  else if (request.action === "downloadPreparedFiles") {
        const files = request.files;

        for (const file of files) {
            chrome.downloads.download({
                url: file.url,
                filename: file.filename,
                conflictAction: 'uniquify',
                saveAs: false
            }, (downloadId) => {
                if (chrome.runtime.lastError) {
                    console.error("Errore nel download:", chrome.runtime.lastError.message);
                }
            });
        }
    } else if (request.action === "setImages" && tabId) {
        const state = getTabState(tabId);
        if (!state.isScanning) return;
    
        // Send message with tabId
        chrome.runtime.sendMessage({
            action: "setImages",
            imageGroups: request.imageGroups,
            tabId: tabId
        });
    
        let totalImages = 0;
        for (let groupKey in request.imageGroups) {
            totalImages += request.imageGroups[groupKey].length;
        }
    
        if (state.singleImageScanLaunched && !state.secondScanLaunched && totalImages === 0) {
            state.secondScanLaunched = true;
            state.singleImageScanLaunched = false;
    
            chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                if (state.isScanning) { // Only start second scan if not stopped
                    startScan(tabs[0], null);
                }
            });
        }
    } else if (request.action === 'disableSidePanelAndReset') {
        const tabId = request.tabId;
        if (tabId) {
           // Disabilita/riabilita il sidepanel
           chrome.sidePanel.setOptions({ tabId: tabId, enabled: false });
           chrome.tabs.sendMessage(tabId, { action: 'removeStaticClone' });
           chrome.sidePanel.setOptions({ tabId: tabId, enabled: true });
           
           
        }
   }

else if (request.action === 'pauseDownload') {
        // Inoltra il messaggio al content script
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            chrome.tabs.sendMessage(tabs[0].id, request);
        });
     } else if (request.action === 'stopDownload') {
         // Inoltra il messaggio al content script
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            chrome.tabs.sendMessage(tabs[0].id, request);
         });
     } else if (request.action === 'resumeDownload') {
        // Forward the message to the content script
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            chrome.tabs.sendMessage(tabs[0].id, request);
        });
    }else if (request.action === 'retryDownload' || request.action === 'ignoreFile') {
        // Inoltra il messaggio al content script
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            chrome.tabs.sendMessage(tabs[0].id, request);
        });
    }
    
 });
 

// Gestione dei messaggi dal sidepanel
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "pauseDownload" || request.action === "resumeDownload" || request.action === "stopDownload") {
        // Inoltra il messaggio alla tab specificata nel messaggio
        if (request.tabId) {
            sendMessageToTab(request.tabId, request);
        } else {
            // Fallback al vecchio comportamento per retrocompatibilità
            chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                if (tabs && tabs.length > 0) {
                    chrome.tabs.sendMessage(tabs[0].id, request);
                }
            });
        }
    }
    return false;
});

// Listener per la chiusura del sidepanel
chrome.runtime.onSuspend.addListener(() => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs && tabs.length > 0) {
            chrome.tabs.sendMessage(tabs[0].id, { action: 'removeStaticClone' });
        }
    });
});

// **Modifica: Listener per la chiusura delle tab (`chrome.tabs.onRemoved`)**
// Rimuove gli ID delle tab chiuse da `tabStates`.
chrome.tabs.onRemoved.addListener((tabId, removeInfo) => {
    console.log(`Tab with id ${tabId} was closed. Cleaning up tab state.`);
    const state = tabStates[tabId];
    if (state && state.hasSidePanel) {
        // Cleanup sidepanel resources
        delete tabStates[tabId];
    }
    // Reset deep scan state when tab is closed
    chrome.storage.local.set({ deepScanEnabled: false }, () => {
        console.log('Deep scan state reset on tab close');
    });
});

chrome.sidePanel.onRemoved?.addListener((details) => {
    // If present, we can handle panel removal for that tab
    if (details.tabId) {
        // Possibly clear or reset tabStates[details.tabId] here
    }
});

function sendMessageToTab(tabId, message) {
    chrome.tabs.get(tabId, (tab) => {
        if (chrome.runtime.lastError || !tab) {
            console.warn(`Tab with id ${tabId} not found or error occurred.`);
            return;
        }
        chrome.tabs.sendMessage(tabId, message);
    });
}


function resetGUI(tabId) {
    // Invia un messaggio per ripristinare la GUI specificando il tabId
    chrome.runtime.sendMessage({
        action: "resetGUI",
        tabId: tabId
    });

    // Ripristina lo stato dell'estensione solo per questa tab specifica
    if (tabStates[tabId]) {
        tabStates[tabId].isPaused = false;
        tabStates[tabId].isStopped = false;
    }
}

// **Modifica: Inizializza `tabStates` per le tab esistenti all'avvio**
// Recupera le tab aperte e chiama `getTabState` per ciascuna (con url valido)
chrome.runtime.onStartup.addListener(() => {
    chrome.tabs.query({}, (tabs) => {
        tabs.forEach((tab) => {
            if (isValidUrl(tab.url)) {
              getTabState(tab.id);
            }
         });
    });
    // Reset deep scan state on startup
    chrome.storage.local.set({ deepScanEnabled: false }, () => {
        console.log('Deep scan state reset on startup');
    });
});
