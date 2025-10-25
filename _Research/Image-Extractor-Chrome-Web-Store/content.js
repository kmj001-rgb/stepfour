console.log("Content script caricato in", window.location.href);
if (typeof window.imageExtractorInitialized === 'undefined') {
    window.imageExtractorInitialized = true;
// Imposta lo stato iniziale della cache
let maxAttempts = 10;           // Numero massimo iniziale di tentativi
let scrollDelay = 500;         // Ritardo iniziale per lo scroll
let loadDelay = 500;           // Ritardo iniziale per il caricamento delle immagini
let attemptHistory = [];       // Array per memorizzare i tentativi recenti
const historySize = 3;         // Numero di tentativi da considerare nella media mobile
const maxScrollDelay = 800;    // Valore massimo del ritardo di scrollo
const minScrollDelay = 200;    // Valore minimo del ritardo di scrollo
const maxLoadDelay = 800;      // Valore massimo del ritardo di caricamento
const minLoadDelay = 200;     // Valore minimo del ritardo di caricamento
let previousScrollAttempts = 0; // Memorizza i tentativi prima delle immagini caricate
let isFirstIteration = true;  // Flag per la prima iterazione
let firstIterationAttempts = 0; // Contatore per i tentativi della prima iterazione
let html2canvasEnabled = false;
let isPaused = false;
let isStopped = false;
let deepScanEnabled = false; // Default state


chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "checkContentScript") {
      sendResponse({ action: "contentScriptPresent" });
      return true;
    } else if (request.action === "updateDeepScanState") {
      deepScanEnabled = request.deepScanEnabled === true; // 👈 CORRETTO: request.deepScanEnabled
      console.log(`Deep scan updated to: ${deepScanEnabled}`);
      sendResponse({ success: true }); // 👈 Risposta con "success: true"
      return true; // 👈 return true;
    }
    
    return false; // o return true; se la tua funzione è asincrona (dipende dal resto del tuo codice)
});

// Retrieve deep scan state from chrome.storage at startup
chrome.storage.local.get('deepScanEnabled', (result) => {
    deepScanEnabled = result.deepScanEnabled === true; // Explicitly convert to boolean
    console.log(`Deep scan initialized as: ${deepScanEnabled}`);
});

// Listener to update deep scan state when it changes
chrome.storage.onChanged.addListener((changes, namespace) => {
    if (changes.deepScanEnabled) {
        deepScanEnabled = changes.deepScanEnabled.newValue === true; // Explicitly convert to boolean
        console.log(`Deep scan updated to: ${deepScanEnabled}`);
    }
});


cacheEnabled = true;  // INIZIALIZZAZIONE SENZA "let"

// Ascolta i messaggi dal sidebar
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "updateCacheStatus") {
        cacheEnabled = request.cacheEnabled;
        console.log(`Cache aggiornata: ${cacheEnabled ? 'attivata' : 'disattivata'}`);
    }
});


// chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
//     if (request.action === "checkContentScript") {
//         sendResponse({ action: "contentScriptPresent" });
//     }
// });



// Recupera lo stato di html2canvas da chrome.storage all'avvio
chrome.storage.local.get('html2canvasEnabled', (result) => {
    if (result.html2canvasEnabled !== undefined) {
         html2canvasEnabled = result.html2canvasEnabled;
     }
});


// Listener per aggiornare lo stato di html2canvas quando cambia
chrome.storage.onChanged.addListener((changes, namespace) => {
    if (changes.html2canvasEnabled) {
         html2canvasEnabled = changes.html2canvasEnabled.newValue;
        console.log(`html2canvas ${html2canvasEnabled ? 'attivata' : 'disattivata'}`);
    }
});




// Recupera lo stato della cache da chrome.storage all'avvio
chrome.storage.local.get('cacheEnabled', (result) => {
    if (result.cacheEnabled !== undefined) {
        cacheEnabled = result.cacheEnabled;
    }
});

// Listener per aggiornare lo stato della cache quando cambia
chrome.storage.onChanged.addListener((changes, namespace) => {
    if (changes.cacheEnabled) {
        cacheEnabled = changes.cacheEnabled.newValue;
        console.log(`Cache ${cacheEnabled ? 'attivata' : 'disattivata'}`);
    }
});

class ImageExtractor {
    constructor() {
        // Remove the chrome.tabs query
        this.tabId = null; // Will be set later
        this.processedUrls = new Set();
        this.imageGroups = new Map();
        this.selectedImages = new Set();
        this.minWidth = 0;
        this.minHeight = 0;
        this.resolutionCache = new Map();
        this.removalCases = [ //Rimuove dall'URL i valori elencati qui, se trovati, per trovare varianti dell'immagine
            /resizegd\/275x-\//, //raiplay
            /thumb_/,
            /thumbs/,
            /icons\//,
            /icon\//,
            /\?w=\d+&h=\d+/,
            /styles\/thumbnail\/public\//, //cinevisioni
            /_V1_.*(?=\.jpg)/, //<- REGEX AGGIUNTA IMDB
            /[-]?\d+x\d+/g,  // <-- NUOVA REGEX PER RIMOZIONE RISOLUZIONE
            /w400\//,  //paramount
            /w370-q80\//, //paramount
            /w400-q80\//,  //paramount
            /class=appthumb/, //comicartfans



        ];
        this.additionCases = [//sostituisce al pattern (se esiste), la sua variante, per trovare varianti dell'immagine
    {
        pattern: /\/gallery/,                //animeclick   
        variants: [                                   //animeclick   
          { original: "/gallery_original"}, //animeclick
        ]                                           //animeclick        
    },
    {
        pattern: /\/images\/serie/,                //animeclick 2  
        variants: [                                   //animeclick   2
          { original: "/images/Anime_big"}, //animeclick 2
        ]                                           //animeclick      2  
    },
    
    // Nuovo caso per arte.tv
    {
        pattern: /\d+x\d+/,  // Pattern che cattura qualsiasi risoluzione nel formato NUMxNUM
        variants: [
            { original: (match) => {
                // Verifica se siamo su arte.tv
                if (window.location.hostname.includes('arte.tv')) {
                    const targetResolutions = ['1280x720', '1920x1080', '3840x2160'];
                    const currentResolution = match;
                    
                    // Restituisci solo le risoluzioni che sono diverse da quella corrente
                    return targetResolutions.filter(resolution => resolution !== currentResolution);
                }
                return []; // Se non siamo su arte.tv, non generare varianti
            }}
        ]
    },
            
            //  {
            //     pattern: /\/specific\/path/,
            //     variants: [
            //       { original: "/specific/original" },
            //     ]
            //  }
            //        // ... altri casi
            
    
    {
        pattern: /s(166|332|718)/,  // Cerca uno qualsiasi dei tre valori
        variants: [
            { original: (match) => {
                const sizes = ['166', '332', '718'];
                const currentSize = match.replace('s', '');
                return sizes
                    .filter(size => size !== currentSize)
                    .map(size => match.replace(currentSize, size));
            }}
        ]
    }
];
            this.specialDomains = ["immobiliare.it", "arte.tv","www.anotherspecialsite.net"]; // scansione semplificata, non raggruppa le immagini uguali con url diversi"
        this.singleImageUrl = null; // Aggiunta variabile per l'URL della singola immagine
        this.urlToSelectorMap = {
            '/mediaindex/': 'section[data-testid="section-images"]',
            'csfd.cz,galerie': '.box.box-intabs',
            'csfd.sk,galeria': '.box.box-intabs'
        };
    }

    setTabId(id) {
        this.tabId = id;
    }

    async init() {
        if (typeof JSZip === 'undefined') {
            await new Promise((resolve, reject) => {
                const script = document.createElement('script');
                script.src = 'lib/jszip.min.js';
                script.onload = resolve;
                script.onerror = reject;
                document.head.appendChild(script);
            });
        }
    }

    normalizeUrl(url) {
        try {
            if (!url) return null;
            if (url.startsWith('data:')) return url;
            if (url.startsWith('//')) url = 'https:' + url;
            if (url.startsWith('/')) url = `${window.location.origin}${url}`;
            return new URL(url, window.location.href).href;
        } catch {
            return null;
        }
    }

    async getImageResolution(url) {
        if (this.resolutionCache.has(url)) {
            return this.resolutionCache.get(url);
        }
    
        return new Promise((resolve) => {
            const img = new Image();
            img.onload = () => {
                const resolution = { width: img.width, height: img.height };
                this.resolutionCache.set(url, resolution);
                resolve(resolution);
            };
            img.onerror = () => {
                this.resolutionCache.set(url, null);
                resolve(null);
            };
    
            // Se la cache è disattivata, aggiungi un parametro casuale
            img.src = cacheEnabled ? url : `${url}?v=${Date.now()}`;
        });
    }

    async findImageVariants() {
        const defaultSelectors = [
            'img[src]',
            'img[data-src]',
            'picture source[srcset]',
            'img[srcset]',
            '[style*="background-image"]',
            '[data-background]',
            '[data-bg]'
        ];

        if (this.singleImageUrl) {
            const normalizedSingleUrl = this.normalizeUrl(this.singleImageUrl);
            const clickedImgElement = Array.from(document.querySelectorAll('img')).find(img => this.normalizeUrl(img.src) === normalizedSingleUrl);

            if (clickedImgElement) {
                const pictureElement = clickedImgElement.closest('picture');
                if (pictureElement) {
                    const sourceElements = pictureElement.querySelectorAll('source[srcset]');
                    for (const sourceElement of sourceElements) {
                        await this.processElement(sourceElement);
                    }
                }
                await this.processElement(clickedImgElement);
            }

            const elements = document.querySelectorAll('*');
            for (const element of elements) {
                const style = window.getComputedStyle(element);
                const backgroundImage = style.backgroundImage;
                if (backgroundImage && backgroundImage !== 'none') {
                    const urls = backgroundImage.match(/url\(['"]?([^'"()]+)['"]?\)/g);
                    if (urls) {
                        for (const url of urls) {
                            const cleanUrl = url.replace(/url\(['"]?([^'"()]+)['"]?\)/, '$1');
                            if (cleanUrl === normalizedSingleUrl) {
                                await this.addImageVariant(cleanUrl);
                            }
                        }
                    }
                }
            }
        } else {
            let targetSelector = null;
            const currentURL = window.location.href.toLowerCase();

            for (const [pattern, selector] of Object.entries(this.urlToSelectorMap)) {
                if (pattern.includes(',')) {
                    // Pattern con array (es: 'csfd.cz,galerie')
                    const parts = pattern.split(',');
                    if (parts.every(part => currentURL.includes(part.toLowerCase()))) {
                        targetSelector = selector;
                        break;
                    }
                } else {
                    // Pattern semplice (es: '/mediaindex/')
                    if (currentURL.includes(pattern)) {
                        targetSelector = selector;
                        break;
                    }
                }
            }

            if (targetSelector) {
                const targetElement = document.querySelector(targetSelector);
                if (targetElement) {
                    const elements = targetElement.querySelectorAll(defaultSelectors.join(', '));
                    for (const element of elements) {
                        await this.processElement(element);
                    }
                    const backgroundElements = targetElement.querySelectorAll('*');
                    for (const element of backgroundElements) {
                        const style = window.getComputedStyle(element);
                        const backgroundImage = style.backgroundImage;
                        if (backgroundImage && backgroundImage !== 'none') {
                            const urls = backgroundImage.match(/url\(['"]?([^'"()]+)['"]?\)/g);
                            if (urls) {
                                for (const url of urls) {
                                    const cleanUrl = url.replace(/url\(['"]?([^'"()]+)['"]?\)/, '$1');
                                    await this.addImageVariant(cleanUrl);
                                }
                            }
                        }
                    }
                }
            } else {
                for (const selector of defaultSelectors) {
                    const elements = document.querySelectorAll(selector);
                    for (const element of elements) {
                        await this.processElement(element);
                    }
                }
                const elements = document.querySelectorAll('*');
                for (const element of elements) {
                    const style = window.getComputedStyle(element);
                    const backgroundImage = style.backgroundImage;
                    if (backgroundImage && backgroundImage !== 'none') {
                        const urls = backgroundImage.match(/url\(['"]?([^'"()]+)['"]?\)/g);
                        if (urls) {
                            for (const url of urls) {
                                const cleanUrl = url.replace(/url\(['"]?([^'"()]+)['"]?\)/, '$1');
                                await this.addImageVariant(cleanUrl);
                            }
                        }
                    }
                }
            }
        }
    }

    async processElement(element) {
        if (element.src) {
            await this.addImageVariant(element.src);
        }

        const dataAttributes = Array.from(element.attributes)
            .filter(attr => attr.name.startsWith('data-') && attr.value.match(/\.(jpg|jpeg|png|gif|webp)/i));
        for (const attr of dataAttributes) {
            await this.addImageVariant(attr.value);
        }

        if (element.srcset) {
            const srcSetUrls = element.srcset.split(',').map(src => src.trim().split(' ')[0]).filter(Boolean);
            for (const url of srcSetUrls) {
                await this.addImageVariant(url);
            }
        }
    }

    async addImageVariant(url) {
        console.log("addImageVariant called with URL:", url);
        url = this.normalizeUrl(url);
        if (!url || this.processedUrls.has(url)) return;
        
        const imdbPattern = /https:\/\/www\.imdb\.com\/title\/tt\d+\/mediaindex\/\d+(?:_\.jpg)?$/;
        if (imdbPattern.test(url)) {
            // ...existing code...
        }
        
        let modifiedUrls = [url]; // Array per conservare tutti gli url, parte dall'url originale

        // ** NUOVA LOGICA OTTIMIZZATA PER LE VARIANTI DI IMDB **
        if (url.includes('m.media-amazon.com/images/M/')) {
            const cleanUrl = url.replace(/\._V1_.*?\.(jpg|jpeg|png|webp)$/i, '.$1');
            
            // Aggiungi sempre l'URL pulito per assicurarti di avere l'originale
            if (!modifiedUrls.includes(cleanUrl)) {
                modifiedUrls.push(cleanUrl);
            }
            
            // Per ora aggiungiamo solo l'URL pulito, le varianti verranno generate dopo aver ottenuto le dimensioni
        }
        // ** FINE NUOVA LOGICA **
        
        for (const additionCase of this.additionCases) {
            const newUrls = [];
            // Codice esistente per additionCases
            if (additionCase.pattern.test(url)) {
            for (const variant of additionCase.variants) {
                if (typeof variant.original === 'function') {
                    // Trova il match del pattern
                    const match = url.match(additionCase.pattern)[0];
                    // Genera le varianti usando la funzione
                    const variants = variant.original(match);
                    // Aggiungi ogni variante all'array degli URL
                    variants.forEach(replacement => {
                        const newUrl = url.replace(additionCase.pattern, replacement);
                        if (newUrl !== url) {
                            console.log(`URL modificato in ${newUrl} (sostituzione dinamica)`);
                            modifiedUrls.push(newUrl);
                        }
                    });
                } else {
                    // Gestione esistente per le sostituzioni statiche
              const newUrl = url.replace(additionCase.pattern, variant.original);
              if (newUrl !== url) {
                console.log(`URL modificato in ${newUrl} (aggiunta originale)`);
                modifiedUrls.push(newUrl);
              }
            }
          }
          }
        }
        
        for (const modifiedUrl of modifiedUrls) {
          const groupKey = this.generateGroupKey(modifiedUrl);
          this.processedUrls.add(modifiedUrl);
          
          if (!this.imageGroups.has(groupKey)) {
              this.imageGroups.set(groupKey, []);
          }
          const existingUrls = this.imageGroups.get(groupKey).map(img => img.url);
          
          // Aggiungo l'immagine originale
          if (!existingUrls.includes(modifiedUrl)) {
              this.imageGroups.get(groupKey).push({url: modifiedUrl});
          }
          
          // Genera varianti per tutti i pattern in removalCases
          for (const pattern of this.removalCases) {
              // Crea una copia del pattern con flag g se non ce l'ha già
              const globalPattern = pattern.global ? 
                  pattern : 
                  new RegExp(pattern.source, pattern.flags + 'g');
              
              // Trova tutte le occorrenze del pattern nell'URL
              const matches = [...modifiedUrl.matchAll(globalPattern)];
              
              if (matches.length > 1) {
                  // Genera tutte le possibili combinazioni di rimozioni
                  const variants = this.generateVariantsForPattern(modifiedUrl, matches);
                  
                  for (const variantUrl of variants) {
                      if (!this.processedUrls.has(variantUrl) && !existingUrls.includes(variantUrl)) {
                          this.imageGroups.get(groupKey).push({ url: variantUrl });
                          this.processedUrls.add(variantUrl);
                      }
                  }
              } else if (matches.length === 1) {
                  // Gestione singola occorrenza (comportamento originale)
                  const removedUrl = modifiedUrl.replace(pattern, '');
                  if (!this.processedUrls.has(removedUrl) && !existingUrls.includes(removedUrl)) {
                      this.imageGroups.get(groupKey).push({ url: removedUrl });
                      this.processedUrls.add(removedUrl);
                  }
              }
          }
        }
    }
    
    // Nuovo metodo per generare tutte le varianti possibili
    generateVariantsForPattern(url, matches) {
        const variants = [];
        const matchCount = matches.length;
        
        // Genera 2^n possibili combinazioni (dove n è il numero di occorrenze)
        // Rappresentate come numeri binari da 1 a 2^n-1
        const totalCombinations = Math.pow(2, matchCount);
        
        for (let i = 1; i < totalCombinations; i++) {
            let tempUrl = url;
            let offset = 0;
            
            // Per ciascuna combinazione, determina quali match rimuovere
            for (let j = 0; j < matchCount; j++) {
                // Se il bit j-esimo è 1, rimuovi il match j-esimo
                if ((i >> j) & 1) {
                    const match = matches[j];
                    const matchIndex = match.index - offset;
                    const matchLength = match[0].length;
                    
                    tempUrl = tempUrl.substring(0, matchIndex) + 
                             tempUrl.substring(matchIndex + matchLength);
                    
                    // Aggiorna l'offset per tenere conto della rimozione
                    offset += matchLength;
                }
            }
            
            variants.push(tempUrl);
        }
        
        return [...new Set(variants)]; // Rimuovi eventuali duplicati
    }

    generateGroupKey(url) {
        const currentURL = window.location.href; // URL della pagina corrente
        // Check if we're in a special domain OR deep scan is enabled
        const isSimplifiedScan = this.specialDomains.some(specialDomain => currentURL.includes(specialDomain)) || deepScanEnabled;
    
        if (isSimplifiedScan) {
            // **MODALITÀ SEMPLIFICATA (per domini "speciali" o deep scan attiva): APPLICA FILTRI, ADDITION CASES E POI NORMALIZZA**
            let modifiedUrl = url;
    
            // **1. APPLICA removalCases (COME PRIMA)**
            for (const pattern of this.removalCases) {
                if (pattern.test(modifiedUrl)) {
                    modifiedUrl = modifiedUrl.replace(pattern, '');
                }
            }
    
            // **2. APPLICA additionCases (NOVITÀ!)**
            for (const additionCase of this.additionCases) {
                if (additionCase.pattern.test(modifiedUrl)) {
                    for (const variant of additionCase.variants) {
                        if (typeof variant.original === 'function') {
                            // (Gestione sostituzioni dinamiche - INVARIATA)
                            const match = modifiedUrl.match(additionCase.pattern)[0];
                            const variants = variant.original(match);
                            variants.forEach(replacement => {});
                        } else {
                            // (Gestione sostituzioni statiche - INVARIATA)
                            const newUrl = modifiedUrl.replace(additionCase.pattern, variant.original);
                            if (newUrl !== modifiedUrl) {}
                        }
                    }
                }
            }
    
            // **NORMALIZZA L'URL MODIFICATO (dopo i filtri)**
            return this.normalizeUrl(modifiedUrl);
        } else {
            // **MODALITÀ ORIGINALE (per la maggior parte dei siti): Usa la logica complessa originale**
            try {
                const urlObj = new URL(url);
                const domain = urlObj.hostname;
    
                if (domain.endsWith('csfd.sk') || domain.endsWith('csfd.cz')) {
                    // Gestione specifica per csfd.sk e csfd.cz (LOGICA ORIGINALE)
                    const path = urlObj.pathname;
                    const fileName = path.split('/').pop();
                    const baseFileName = fileName.replace(/[-_]\d+x\d+|-\d+|\d+x\d+|[-_](large|small|medium|thumb)/g, '');
    
                     const variantUrl = this.imageGroups.get(baseFileName.split('.')[0])?.find(v => v.url.includes('cache/resized/w'))?.url;
                     const originalUrl = variantUrl ? variantUrl.replace(/\/cache\/resized\/w\d+\//, '/') : url.replace(/\/cache\/resized\/w\d+\//, '/');
    
                    return originalUrl;
                } else if (url.includes('m.media-amazon.com/images/M/')) {
                    // ** NUOVA GESTIONE SPECIFICA PER IMDB **
                    // Rimuovi solo i parametri di ridimensionamento per ottenere l'URL di base come chiave.
                    return url.replace(/\._V1_.*?\.(jpg|jpeg|png|webp)$/i, '.$1');
                } else {
                    // Gestione generica per altri siti (LOGICA ORIGINALE)
                    let modifiedUrl = url;
                    // Utilizza 'this.removalCases' qui
                     for (const pattern of this.removalCases) {
                        if (pattern.test(modifiedUrl)) {
                            modifiedUrl = modifiedUrl.replace(pattern, '');
                        }
                    }
    
                    const path = new URL(modifiedUrl).pathname;
                    const fileName = path.split('/').pop();
                    // REGEX MODIFICATA - AGGIUNTA |-\d{4}-
                    const baseFileName = fileName.replace(/[-_]\d+x\d+|-\d+|\d+x\d+|[-_](large|small|medium|thumb)|-\d{4}-/g, '');
                    const groupKey = baseFileName.split('.')[0]; // <--- MODIFICA PRECEDENTE: return baseFileName;
                    console.log("Chiave di Gruppo:", groupKey, "per URL:", modifiedUrl || url); // **[NUOVA RIGA DI LOG - IMPORTANTE PER DEBUG]**
                    return groupKey;
                }
            } catch {
                return url;
            }
        }
    }

// content.js

async extractImages() {
    await this.init();
    chrome.runtime.sendMessage({ 
      action: "updateScanProgress", 
      progress: 0, 
      completedBatches: 0, 
      totalBatches: 0,
      tabId: this.tabId
    });
    
    // Trova varianti e processa le immagini
    await this.findImageVariants();
    this.imageGroups = await this.processImagesInParallel(this.imageGroups);
  
    // Calcolo min/max
    const widths = [];
    const heights = [];
  
    // Estrae tutte le dimensioni trovate
    this.imageGroups.forEach((variants) => {
      variants.forEach((variant) => {
        if (variant.width && variant.height) {
          widths.push(variant.width);
          heights.push(variant.height);
        }
      });
    });
  
    const minWidth = widths.length ? Math.min(...widths) : 0;
    const maxWidth = widths.length ? Math.max(...widths) : 10000;
    const minHeight = heights.length ? Math.min(...heights) : 0;
    const maxHeight = heights.length ? Math.max(...heights) : 10000;
  
    // (1) Invia un messaggio specifico con i valori calcolati
    chrome.runtime.sendMessage({
      action: "updateDimensionRange",
      minWidth,
      maxWidth,
      minHeight,
      maxHeight,
      tabId: this.tabId
    });
  
    // (2) Invia le immagini al sidepanel (come già fai di norma)
    const serializedGroups = {};
    this.imageGroups.forEach((value, key) => { serializedGroups[key] = value; });
    chrome.runtime.sendMessage({
      action: "setImages",
      imageGroups: serializedGroups,
      tabId: this.tabId
    });
  
    return this.imageGroups;
  }
  


  async processImagesInParallel(imageGroups) {
    const groupKeys = Array.from(imageGroups.keys());
    let processedImageCount = 0; // Mantenuto, ma non più usato per la progress bar
    const stopSignal$ = new rxjs.Subject();
    const allPromises = groupKeys.flatMap(groupKey => {
        const variants = imageGroups.get(groupKey);
        return variants.map(variant => ({ groupKey, variant }));
    });

    const numImages = allPromises.length;
    let concurrencyLimit;

    if (numImages <= 100) {
        concurrencyLimit = 2;
    } else if (numImages <= 500) {
        concurrencyLimit = 5;
    } else if (numImages <= 1500) {
        concurrencyLimit = 10;
    } else if (numImages <= 3000) {
        concurrencyLimit = 20;
    } else if (numImages <= 6000) {
        concurrencyLimit = 50;
    } else {
        concurrencyLimit = 100;
    }

    const batches = [];
    for (let i = 0; i < allPromises.length; i += concurrencyLimit) {
        batches.push(allPromises.slice(i, i + concurrencyLimit));
    }

    const numBatches = batches.length; // Numero totale di batch
    let completedBatchCount = 0; // Contatore batch completati (per il log e la progress bar)
    const batchTimings = [];
    const startTime = performance.now();

    // Calcola il numero di immagini per ogni batch (escluso l'ultimo)
    const batchSize = concurrencyLimit;
    // Calcola il numero di batch "standard" e il numero di immagini dell'ultimo batch
    const numStandardBatches = Math.floor(allPromises.length / batchSize);
    const lastBatchSize = allPromises.length % batchSize;

    let logMessage = `Avviati ${numStandardBatches} batch di ${batchSize} immagini`;
    if (lastBatchSize > 0) {
        logMessage += ` e un ulteriore batch di ${lastBatchSize} immagini.`;
    } else {
        logMessage += `.`;
    }

    console.log(logMessage);



    const source$ = rxjs.from(batches).pipe(
        rxjs.mergeMap((batch, index) => rxjs.from(batch).pipe(
            rxjs.mergeMap(({ groupKey, variant }) => rxjs.from(this.getImageResolution(variant.url)).pipe(
                rxjs.map(resolution => ({ ...variant, ...(resolution || {}) })),
            ), concurrencyLimit),
            rxjs.tap(variant => {
                processedImageCount++; // Ancora utile per statistiche finali
                // Rimossa la progress bar basata sulle immagini
            }),
            rxjs.toArray(),
            rxjs.tap(processedBatch => {
                // Calcola e invia l'avanzamento basato sui batch
                completedBatchCount++;
                const batchProgress = Math.round((completedBatchCount / numBatches) * 100);

                chrome.runtime.sendMessage({
                    action: "updateScanProgress",
                    progress: batchProgress,
                    completedImages: processedImageCount, // Invia comunque il conteggio delle immagini
                    totalImages: numImages,
                    tabId: this.tabId
                });

                // Logging del batch (in tempo reale)
                const batchEndTime = performance.now();
                const batchDuration = (batchEndTime - startTime) / 1000;
                const batchId = index + 1;
                batchTimings.push({ index: batchId, duration: batchDuration });
                const id = String(batchId).padStart(2, '0');
                console.log(`Batch ${completedBatchCount}/${numBatches} (id ${id}) completato in ${batchDuration.toFixed(2)} secondi.`); // Modifica qui
            })
        ), concurrencyLimit),
        rxjs.takeUntil(stopSignal$)
    );


    return new Promise((resolve, reject) => {
        source$.subscribe({
            next: (processedBatch) => {
                processedBatch.forEach(variant => {
                    const groupKey = this.generateGroupKey(variant.url);
                    const variants = imageGroups.get(groupKey);
                    if (variants) {
                        const variantIndex = variants.findIndex(v => v.url === variant.url);
                        if (variantIndex !== -1) {
                            variants[variantIndex] = variant;
                        }
                    }
                });
            },
            complete: async () => {
             groupKeys.forEach(groupKey => {
                 const variants = imageGroups.get(groupKey);
                   if (variants) {
                     const filteredVariants = this.filterAndExcludeVariants(variants, groupKey);
                      imageGroups.set(groupKey, filteredVariants);
                    }
               });

               const endTime = performance.now();
                const totalDuration = (endTime - startTime) / 1000;


                let finalImageCount = 0;
                let uniqueImageCount = 0;

                  imageGroups.forEach(variants => {
                     finalImageCount += variants.length;
                         uniqueImageCount += variants.length > 0 ? 1 : 0
                 });


                 console.log(`Immagini elaborate: ${processedImageCount} / Immagini trovate (comprese varianti): ${finalImageCount} / Immagini uniche: ${uniqueImageCount}`);
                 console.log(`Creati ${batches.length} batch.`);
                 console.log(`Tempo totale: ${totalDuration.toFixed(2)} secondi`);


                // Manda l'ultimo aggiornamento per far scomparire la barra del progresso (non necessario, già fatto nel tap)
                // chrome.runtime.sendMessage({
                //     action: "updateScanProgress",
                //     progress: 100,
                //    completedImages: numImages, //Invia il conteggio finale delle immagini
                //     totalImages: numImages,
                // });
                resolve(imageGroups);
            },
            error: (err) => {
                console.error(`Errore durante il flusso RxJS:`, err);
                reject(err);
            }
        });

        chrome.runtime.onMessage.addListener(function listener(request, sender, sendResponse) {
            if (request.action === "stopScan") {
                stopSignal$.next();
                chrome.runtime.onMessage.removeListener(listener);
            }
        });
    });
}

    filterAndExcludeVariants(variants, groupKey) {
        let exclusionReasons = [];
        let filteredVariants = [];
    
        // ** NUOVA LOGICA DI FILTRAGGIO OTTIMIZZATA PER IMDB **
        if (groupKey.includes('m.media-amazon.com/images/M/')) {
            // Trova l'immagine originale (senza _V1_) e la sua larghezza
            const originalVariant = variants.find(v => !v.url.includes('._V1_') && v.width && v.height);
            if (originalVariant) {
                const originalWidth = originalVariant.width;
                const originalHeight = originalVariant.height;
                const aspectRatio = originalWidth / originalHeight;
                
                console.log(`IMDb original: ${originalWidth}x${originalHeight}, aspect ratio: ${aspectRatio.toFixed(2)}`);
                
                // Aggiungi le varianti calcolate direttamente senza verificarle
                const imdbResolutions = [480, 576, 720, 1000, 1280, 1600, 1920, 2560, 3200, 3840];
                const cleanUrl = originalVariant.url;
                
                for (const width of imdbResolutions) {
                    if (width < originalWidth) {
                        const height = Math.round(width / aspectRatio);
                        const variantSuffix = `._V1_QL75_UX${width}_`;
                        const newVariantUrl = cleanUrl.replace(/(\.(jpg|jpeg|png|webp))$/i, `${variantSuffix}$1`);
                        
                        // Aggiungi la variante calcolata direttamente
                        const calculatedVariant = {
                            url: newVariantUrl,
                            width: width,
                            height: height
                        };
                        
                        // Verifica se non esiste già
                        if (!variants.find(v => v.url === newVariantUrl)) {
                            variants.push(calculatedVariant);
                        }
                    }
                }
                
                console.log(`IMDb variants added: ${variants.length - 1} calculated variants`);
            }
        }
        // ** FINE NUOVA LOGICA **

        // Controlla se ci sono più varianti nel gruppo
        const hasMultipleVariants = variants.length > 1;
    
        variants.forEach(variant => {
            exclusionReasons = [];
    
            // Applica il filtro 100x100 solo se è l'unica immagine nel gruppo
            if (!hasMultipleVariants) {
                if (variant.width && variant.height) {
                    if (variant.width < 100 || variant.height < 100) {
                        exclusionReasons.push('Risoluzione inferiore a 100px.');
                    }
                } else {
                    exclusionReasons.push('Impossibile ottenere la risoluzione.');
                }
            }
    
            // Filtri generali (es. formato file, favicon, ecc.)
            if (variant.url.match(/\.(svg|ico)$/i)) {
                exclusionReasons.push('Formato file escluso (SVG/ICO).');
            }
            if (variant.url.includes('favicon') || variant.url.includes('stripe') || variant.url.startsWith('data:image/')) {
                exclusionReasons.push('Immagine esclusa (favicon, stripe, o base64 embed).');
            }
            if (variant.url.includes('blank') || variant.url.includes('placeholder') || variant.url.includes('empty')) {
                exclusionReasons.push('Immagine esclusa (blank, placeholder o empty).');
            }
    
            if (exclusionReasons.length === 0) {
                filteredVariants.push(variant);
            } else {
                console.log(`Immagine esclusa (${variant.url}): ${exclusionReasons.join(' ')}`);
            }
        });
    
        filteredVariants = [...new Map(
            filteredVariants
                
                .map(img => [(img.width || 0) + 'x' + (img.height || 0), img])
        ).values()];
    
        return filteredVariants;
    }




    async downloadSelectedImages(selectedUrls, zipName = "images", preserveOriginalName = false) {
        const zip = new JSZip();
        const totalFiles = selectedUrls.length;
        let completedFiles = 0;
        let errorCount = 0;
    
        console.log(`[ZIP Download] Avvio download di ${totalFiles} file`);
    
        const parallelDownloads = (() => {
            console.log(`[ZIP Download] Calcolo download paralleli per ${totalFiles} file...`);
            if (totalFiles <= 100) {
                console.log('[ZIP Download] ≤100 file: 1 download parallelo');
                return 1;
            } else if (totalFiles <= 500) {
                console.log('[ZIP Download] ≤500 file: 5 download paralleli');
                return 5;
            } else if (totalFiles <= 1500) {
                console.log('[ZIP Download] ≤1500 file: 10 download paralleli');
                return 10;
            } else if (totalFiles <= 3000) {
                console.log('[ZIP Download] ≤3000 file: 20 download paralleli');
                return 20;
            } else if (totalFiles <= 6000) {
                console.log('[ZIP Download] ≤6000 file: 50 download paralleli');
                return 50;
            } else {
                console.log('[ZIP Download] >6000 file: 100 download paralleli');
                return 100;
            }
        })();
    
        const batches = [];
        for (let i = 0; i < selectedUrls.length; i += parallelDownloads) {
            batches.push(selectedUrls.slice(i, i + parallelDownloads));
        }
        console.log(`[ZIP Download] Creati ${batches.length} batch, ${parallelDownloads} download per batch`);
    
         // Inizializza la progress bar
         chrome.runtime.sendMessage({
            action: "updateProgress",
            progress: 0,
            completedFiles: 0,
            totalFiles,
            tabId: this.tabId
        });
    
        let stopSignal$ = new rxjs.Subject();
        let pauseSignal$ = new rxjs.Subject();
        let resumeSignal$ = new rxjs.Subject();
    
        let paused = false;
    
        const errorSubject$ = new rxjs.Subject();
    
        const handleImageError = (url, error) => {
            errorCount++;
            // Invia un messaggio al sidebar per mostrare il menu di errore
            chrome.runtime.sendMessage({ action: "downloadError", url, groupKey: this.generateGroupKey(url), error: error.message || error, tabId: this.tabId });
            // Restituisci un Observable che attende la decisione dell'utente
            return new rxjs.Observable(subscriber => {
                const listener = (request) => {
                    if (request.groupKey === this.generateGroupKey(url)) {
                        if (request.action === "retryDownload") {
                            console.log("Riprovo il download dell'immagine:", request.url);
                            subscriber.next(request.url); // Emetti l'URL per riprovare
                            subscriber.complete();
                        } else if (request.action === "ignoreFile") {
                            console.log("Ignoro l'immagine:", url);
                            subscriber.complete(); // Completa senza emettere nulla per ignorare
                        }
                        chrome.runtime.onMessage.removeListener(listener);
                    }
                };
                chrome.runtime.onMessage.addListener(listener);
            });
        };
    
        const source$ = rxjs.from(batches).pipe(
            rxjs.mergeMap((batch) => rxjs.from(batch).pipe(
                rxjs.mergeMap((url) => rxjs.iif(
                    () => paused,
                    resumeSignal$.pipe(
                        rxjs.take(1),
                        rxjs.mergeMap(() => this.fetchImage(url).pipe(
                            rxjs.catchError(error => handleImageError(url, error))
                        ))
                    ),
                    this.fetchImage(url).pipe(
                        rxjs.catchError(error => handleImageError(url, error))
                    )
                ), parallelDownloads),
                rxjs.tap(({ blob, url }) => {
                    completedFiles++;
                    let fileName;
                
                    if (preserveOriginalName) {
                        // Estrai il nome originale dall'URL
                        try {
                            const urlObj = new URL(url);
                            const pathParts = urlObj.pathname.split('/');
                            let originalFilename = pathParts[pathParts.length - 1];
                            
                            // Rimuovi eventuali parametri dall'URL
                            originalFilename = originalFilename.split('?')[0].split('#')[0];
                            
                            // Se il nome del file non ha un'estensione valida, aggiungi .jpg
                            if (!originalFilename.match(/\.(jpg|jpeg|png|gif|webp|bmp|svg|tiff)$/i)) {
                                originalFilename += '.jpg';
                            }
                            
                            fileName = originalFilename;
                        } catch (e) {
                            // Fallback se non riesci a estrarre il nome file
                            fileName = `${zipName}_${completedFiles}.jpg`;
                        }
                    } else {
                        // Usa il nome fornito con numerazione sequenziale
                        fileName = `${zipName}_${completedFiles}.jpg`;
                    }
                
                    zip.file(fileName, blob);
                
                    const progress = Math.round((completedFiles / totalFiles) * 100);
                    console.log(`[ZIP Download] Completato ${completedFiles}/${totalFiles} (${progress}%)`);
                    chrome.runtime.sendMessage({
                        action: "updateProgress",
                        progress,
                        completedFiles,
                        totalFiles,
                        tabId: this.tabId
                    });
                }),
                
                // Non è più necessario catchError qui perché viene gestito all'interno di mergeMap
            ), parallelDownloads),
            rxjs.takeUntil(stopSignal$),
        );
    
        source$.subscribe({
            complete: async () => {
                if (errorCount > 0) {
                    console.warn(`[ZIP Download] Completato con ${errorCount} errori.`);
                } else {
                    console.log(`[ZIP Download] Tutti i batch completati, generazione ZIP...`);
                }
        
                // Genera il file ZIP e avvia il download
                const zipContent = await zip.generateAsync({
                    type: 'blob',
                    compression: "STORE",
                });
        
                const a = document.createElement('a');
                a.href = URL.createObjectURL(zipContent);
                a.download = `${zipName}.zip`;
                a.click();
                URL.revokeObjectURL(a.href);
        
                // Invia l'aggiornamento del progresso al 100%
                chrome.runtime.sendMessage({
                    action: "updateProgress",
                    progress: 100,
                    completedFiles,
                    totalFiles,
                    tabId: this.tabId
                });
        
                // Ripristina lo stato dopo il completamento del download
                isPaused = false;
                isStopped = false;
               // toggleRescanButton(true); // Mostra il pulsante "Scansiona pagina"
              //  updateProgress(0, 0, 0); // Resetta la barra del progresso
        
                console.log("Download completato con successo. Stato ripristinato.");
            },
            error: (err) => {
                console.error(`Errore durante il flusso RxJS:`, err);
        
                // Ripristina lo stato anche in caso di errore
                isPaused = false;
                isStopped = false;
              //  toggleRescanButton(true); // Mostra il pulsante "Scansiona pagina"
              //  updateProgress(0, 0, 0); // Resetta la barra del progresso
        
                console.log("Download interrotto a causa di un errore. Stato ripristinato.");
            }
        });
    
        chrome.runtime.onMessage.addListener(function listener(request, sender, sendResponse) {
            if (request.action === "stopDownload") {
                stopSignal$.next();
                chrome.runtime.onMessage.removeListener(listener);
            } else if (request.action === "pauseDownload") {
                paused = true;
                pauseSignal$.next();
            } else if (request.action === "resumeDownload") {
                paused = false;
                resumeSignal$.next();
            } 
            // Non serve più gestire qui retryDownload e ignoreFile perché se ne occupa handleImageError
        });
    }


     fetchImage(url) {
        let fetchUrl = url;
        let headers = {
            'Referer': window.location.href,
            'User-Agent': navigator.userAgent
        };
    
        if (!cacheEnabled) {
            fetchUrl = `${url}?v=${Date.now()}`;
            headers['Cache-Control'] = 'no-cache';
            headers['Pragma'] = 'no-cache';
        }
    
         // Restituisci un Observable
    return rxjs.defer(() => {
        // Simula un errore casuale con una probabilità del 20%
    //     if (Math.random() < 0.2) {  // <-- COMMENTA QUESTA RIGA
      //       console.warn(`Simulazione errore nel fetch dell'immagine ${fetchUrl}`);
        //     return rxjs.throwError(() => new Error("Errore simulato"));
       //     } // <-- E QUESTA RIGA

        return rxjs.from(
                new Promise((resolve, reject) => {
                    chrome.runtime.sendMessage(
                        {
                            action: 'fetchImage',
                            url: fetchUrl,
                            referrer: window.location.href,
                            headers: headers,
                            tabId: this.tabId
                        },
                        response => {
                            if (response && response.data) {
                                resolve(fetch(response.data));
                            } else {
                                reject(new Error(response?.error || 'Errore nel fetch dell\'immagine.'));
                            }
                        }
                    );
                })
            ).pipe(
                rxjs.mergeMap(response => rxjs.from(response.blob())),
                rxjs.map(blob => ({ blob, url }))
            );
        });
    }


    getParallelDownloads(totalFiles) {
        if (totalFiles <= 5) return 1;
        if (totalFiles <= 10) return 2;
        if (totalFiles <= 20) return 4;
        if (totalFiles <= 50) return 6;
        if (totalFiles <= 100) return 8;
        if (totalFiles <= 200) return 10;
        if (totalFiles <= 500) return 15;
        return 20; // per più di 500 file
    }
    


// Modifica il metodo getFileExtension per gestire meglio i casi senza estensione
getFileExtension(url) {
    try {
        const urlObj = new URL(url);
        const pathname = urlObj.pathname;
        
        // Cerca un'estensione nel pathname
        const extension = pathname.match(/\.(jpg|jpeg|png|gif|webp|bmp|svg|tiff)$/i);
        if (extension) {
            return extension[0];
        }
        
        // Se non c'è un'estensione nel pathname, controlla l'intestazione Content-Type
        // Questa parte verrà gestita durante il download
        return '.jpg'; // Default a .jpg se non trova estensione
    } catch (e) {
        return '.jpg'; // Default a .jpg in caso di errore
    }
}

// Modifica la parte relativa alla preparazione del file nel downloadImagesIndividually
async downloadImagesIndividually(selectedUrls, baseName, preserveOriginalName = false) {
    return new Promise(async (resolve, reject) => {
        // Verifica subito se il download è già stato interrotto
        if (isStopped) {
            console.log("Download già interrotto all'avvio");
            chrome.runtime.sendMessage({ 
                action: "downloadStopped", 
                tabId: this.tabId 
            });
            resetGUI(this.tabId);
            resolve();
            return;
        }

        const totalFiles = selectedUrls.length;
        const parallelDownloads = this.getParallelDownloads(totalFiles);
        let completedFiles = 0;
        
        // RIMOSSO IL RESET degli stati
        // isPaused = false;
        // isStopped = false;

        // Invia messaggio per inizializzare la progress bar
        chrome.runtime.sendMessage({
            action: "updateProgress",
            progress: 0,
            completedFiles: 0,
            totalFiles,
            tabId: this.tabId
        });

        // Dividi gli URL in gruppi per il download parallelo
        const chunks = [];
        for (let i = 0; i < selectedUrls.length; i += parallelDownloads) {
            chunks.push(selectedUrls.slice(i, i + parallelDownloads));
        }

        for (let chunkIndex = 0; chunkIndex < chunks.length; chunkIndex++) {
            // Verifica isStopped all'inizio di ogni chunk
            if (isStopped) {
                console.log("Download interrotto dall'utente (inizio chunk)");
                chrome.runtime.sendMessage({ 
                    action: "downloadStopped",
                    tabId: this.tabId 
                });
                resetGUI(this.tabId);
                resolve();
                return;
            }

            // Gestione della pausa all'inizio di ogni chunk
            while (isPaused && !isStopped) {
                console.log("Download in pausa (inizio chunk)...");
                await new Promise(r => setTimeout(r, 500));
                
                // Controlla se durante la pausa è stato richiesto lo stop
                if (isStopped) {
                    console.log("Download interrotto durante la pausa (inizio chunk)");
                    chrome.runtime.sendMessage({ 
                        action: "downloadStopped",
                        tabId: this.tabId 
                    });
                    resetGUI(this.tabId);
                    resolve();
                    return;
                }
            }

            let chunk = chunks[chunkIndex];

            while (chunk.length > 0) {
                try {
                    // Controlla se il download è stato fermato
                    if (isStopped) {
                        console.log("Download interrotto dall'utente (durante elaborazione chunk)");
                        chrome.runtime.sendMessage({ 
                            action: "downloadStopped", 
                            tabId: this.tabId 
                        });
                        resetGUI(this.tabId);
                        resolve();
                        return;
                    }

                    // Controlla se il download è in pausa
                    if (isPaused) {
                        console.log("Download in pausa...");
                        while (isPaused && !isStopped) {
                            await new Promise(r => setTimeout(r, 500));
                            
                            // Controlla se durante la pausa è stato richiesto lo stop
                            if (isStopped) {
                                console.log("Download interrotto durante la pausa (elaborazione chunk)");
                                chrome.runtime.sendMessage({ 
                                    action: "downloadStopped", 
                                    tabId: this.tabId 
                                });
                                resetGUI(this.tabId);
                                resolve();
                                return;
                            }
                        }
                        console.log("Download ripreso.");
                    }

                    // Prepara tutti i file del chunk corrente
                    const chunkFiles = await Promise.all(chunk.map(async (url, index) => {
                        // Verifica ancora prima di ogni operazione di fetch
                        if (isStopped) return null;
                        
                        // Gestione pausa durante il fetch
                        if (isPaused) {
                            while (isPaused && !isStopped) {
                                await new Promise(r => setTimeout(r, 500));
                            }
                            if (isStopped) return null;
                        }
                        
                        try {
                            const response = await this.fetchAndPrepareDownload(url);
                            
                            // Determina l'estensione dal content-type o dal percorso
                            let extension;
                            if (response.contentType) {
                                const contentTypeToExtension = {
                                    'image/jpeg': '.jpg',
                                    'image/png': '.png',
                                    'image/gif': '.gif',
                                    'image/webp': '.webp',
                                    'image/bmp': '.bmp',
                                    'image/svg+xml': '.svg',
                                    'image/tiff': '.tiff'
                                };
                                extension = contentTypeToExtension[response.contentType] || '.jpg';
                            } else {
                                try {
                                    const urlObj = new URL(url);
                                    const pathname = urlObj.pathname;
                                    const extensionMatch = pathname.match(/\.(jpg|jpeg|png|gif|webp|bmp|svg|tiff)$/i);
                                    extension = extensionMatch ? `.${extensionMatch[1].toLowerCase()}` : '.jpg';
                                } catch (e) {
                                    extension = '.jpg';
                                }
                            }
                            
                            // Determina il nome del file
                            let filename;
                            
                            if (preserveOriginalName) {
                                // Estrai il nome originale dall'URL
                                try {
                                    const urlObj = new URL(url);
                                    const pathParts = urlObj.pathname.split('/');
                                    const originalFilename = pathParts[pathParts.length - 1];
                                    
                                    // Se il nome originale ha già un'estensione valida, usalo, altrimenti aggiungi l'estensione
                                    if (originalFilename.match(/\.(jpg|jpeg|png|gif|webp|bmp|svg|tiff)$/i)) {
                                        filename = originalFilename;
                                    } else {
                                        filename = originalFilename + extension;
                                    }
                                    
                                    // Rimuovi eventuali parametri dall'URL che potrebbero essere parte del nome file
                                    filename = filename.split('?')[0].split('#')[0];
                                } catch (e) {
                                    // Se non riesci a estrarre il nome originale, usa un nome generico
                                    filename = `image_${completedFiles + index + 1}${extension}`;
                                }
                            } else {
                                // Se c'è un solo file, non aggiungere il suffisso numerico
                                filename = totalFiles === 1 
                                    ? `${baseName}${extension}` 
                                    : `${baseName}_${completedFiles + index + 1}${extension}`;
                            }

                            return {
                                url: response.data,
                                filename: filename
                            };
                        } catch (error) {
                            console.error(`Errore nella preparazione del file ${url}:`, error);
                            throw { error, url }; // Rilancia l'errore con l'URL del file problematico
                        }
                    }));

                    // Controlla ancora se il download è stato interrotto durante la preparazione
                    if (isStopped) {
                        console.log("Download interrotto durante la preparazione dei file");
                        chrome.runtime.sendMessage({ 
                            action: "downloadStopped", 
                            tabId: this.tabId 
                        });
                        resetGUI(this.tabId);
                        resolve();
                        return;
                    }

                    // Filtra file nulli (causati da stop durante preparazione) e file falliti
                    const validFiles = chunkFiles.filter(file => file !== null);
                    
                    if (validFiles.length > 0) {
                        // PRIMA DI INVIARE I FILES PER IL DOWNLOAD, CONTROLLA ANCORA
                        if (isStopped) {
                            console.log("Download interrotto prima dell'invio dei file");
                            chrome.runtime.sendMessage({ 
                                action: "downloadStopped", 
                                tabId: this.tabId 
                            });
                            resetGUI(this.tabId);
                            resolve();
                            return;
                        }

                        chrome.runtime.sendMessage({
                            action: "downloadChunk",
                            files: validFiles,
                            tabId: this.tabId
                        });

                        completedFiles += validFiles.length;

                        // Aggiorna la progress bar
                        const progress = Math.round((completedFiles / totalFiles) * 100);
                        chrome.runtime.sendMessage({
                            action: "updateProgress",
                            progress,
                            completedFiles,
                            totalFiles,
                            tabId: this.tabId
                        });
                    }

                    break; // Esci dal ciclo while se non ci sono errori
                } catch (error) {
                    console.error(`Errore nel chunk:`, error);
    
                    // Identifica il file problematico
                    const problematicUrl = error.url;
    
                    // Rimuovi il file problematico dal chunk corrente
                    chunk = chunk.filter(url => url !== problematicUrl);
    
                    // Gestisci il file problematico separatamente
                    const userAction = await new Promise((resolve) => {
                        const listener = (request) => {
                            if (request.groupKey === this.generateGroupKey(problematicUrl)) {
                                if (request.action === "retryDownload") {
                                    chrome.runtime.onMessage.removeListener(listener);
                                    resolve("retry");
                                } else if (request.action === "ignoreFile") {
                                    chrome.runtime.onMessage.removeListener(listener);
                                    resolve("ignore");
                                }
                            }
                            
                            // Controlla anche per stop o pausa durante la gestione errori
                            if (request.action === "stopDownload") {
                                isStopped = true;
                                chrome.runtime.onMessage.removeListener(listener);
                                resolve("stop");
                            } else if (request.action === "pauseDownload") {
                                isPaused = true;
                            } else if (request.action === "resumeDownload") {
                                isPaused = false;
                            }
                        };
                        
                        chrome.runtime.onMessage.addListener(listener);
    
                        // Invia un messaggio di errore al runtime per mostrare il menu Retry/Ignore
                        console.log("Invio messaggio di errore al runtime:", problematicUrl);
                        chrome.runtime.sendMessage({
                            action: "downloadError",
                            url: problematicUrl,
                            groupKey: this.generateGroupKey(problematicUrl),
                            tabId: this.tabId
                        });
                    });
    
                    if (userAction === "retry") {
                        console.log("Riprovo il download del file problematico:", problematicUrl);
                        chunk.push(problematicUrl); // Aggiungi il file problematico in coda per un nuovo tentativo
                    } else if (userAction === "ignore") {
                        console.log("Ignoro il file problematico:", problematicUrl);
                        completedFiles++; // Considera il file problematico come completato (ignorato)
                    } else if (userAction === "stop") {
                        console.log("Download interrotto durante la gestione errori");
                        chrome.runtime.sendMessage({ 
                            action: "downloadStopped", 
                            tabId: this.tabId 
                        });
                        resetGUI(this.tabId);
                        resolve();
                        return;
                    }
                }
            }
        }

        // Controlla una ultima volta prima di completare
        if (isStopped) {
            console.log("Download interrotto prima del completamento finale");
            chrome.runtime.sendMessage({ 
                action: "downloadStopped", 
                tabId: this.tabId 
            });
            resetGUI(this.tabId);
            resolve(); 
            return;
        }
    
        chrome.runtime.sendMessage({
            action: "updateProgress",
            progress: 100,
            completedFiles: completedFiles,
            totalFiles,
            tabId: this.tabId
        });
    
        resolve(); // Risolvi la Promise per indicare che il download è completato
    });
}
    async fetchAndPrepareDownload(url) {
        // Simula un errore con una probabilità del 20%
  //      if (Math.random() < 0.2) {
  //          console.log("Errore simulato generato per:", url);
//            throw new Error("Errore simulato durante la preparazione del download.");
  //  }
    
        return new Promise((resolve, reject) => {
            chrome.runtime.sendMessage(
                { action: 'fetchAndPrepare', url, referrer: window.location.href, tabId: this.tabId },
                response => {
                    if (response && response.data) {
                        resolve(response);
                    } else {
                        reject(new Error(response?.error || 'Errore nel fetch dell\'immagine.'));
                    }
                }
            );
        });
    }

    async handleDownloadError(url){
        chrome.runtime.sendMessage({ action: "downloadError", url, groupKey: this.generateGroupKey(url), tabId: this.tabId });

        const userAction = await new Promise((resolve) => {
            const listener = (request) => {
                if (request.groupKey === this.generateGroupKey(url)) {
                    if (request.action === "retryDownload") {
                        chrome.runtime.onMessage.removeListener(listener);
                        resolve(true);
                    } else if (request.action === "ignoreFile") {
                        chrome.runtime.onMessage.removeListener(listener);
                        resolve(false);
                    }
                }
            };
            chrome.runtime.onMessage.addListener(listener);
        });

        return userAction;
    }
}
function resetGUI(tabId) {
    // Invia un messaggio per ripristinare la GUI
    chrome.runtime.sendMessage({
        action: "resetGUI",
        tabId: tabId
    });

    // Ripristina lo stato dell'estensione
    isPaused = false;
    isStopped = false;
}


function calculateAverageAttempts() {
    if (attemptHistory.length === 0) return maxAttempts; // Se non ci sono dati, restituisci il valore massimo
    const sum = attemptHistory.reduce((a, b) => a + b, 0);
    return sum / attemptHistory.length;
}


function adjustDelays() {
    const averageAttempts = calculateAverageAttempts();
    console.log("Average attempts:", averageAttempts);

     // Calcola la proporzione della media rispetto al range [1, maxAttempts]
    const normalizedAverage = Math.min(Math.max(averageAttempts, 1), maxAttempts);
    const ratio = (normalizedAverage - 1) / (maxAttempts - 1);

    // Adatta scrollDelay e loadDelay in modo proporzionale (INVERTITO)
     scrollDelay = Math.round(minScrollDelay + (maxScrollDelay - minScrollDelay) * ratio);
     loadDelay = Math.round(minLoadDelay + (maxLoadDelay - minLoadDelay) * ratio);

     console.log(`Adattamento dei delay: nuovo scrollDelay = ${scrollDelay} e nuovo loadDelay = ${loadDelay}`);
}


// Utility functions
const utils = {
    extractUrlFromStyle(style) {
        const matches = style.match(/url\(['"]?([^'"()]+)['"]?\)/);
        return matches ? matches[1] : null;
    },

    getComputedBackgroundImage(element) {
        const style = window.getComputedStyle(element);
        return style.backgroundImage !== 'none' ? style.backgroundImage : null;
    },
     findImageElement(element) {
        // Se l'elemento è un'immagine (<img>), restituiscilo
        if (element.tagName === 'IMG') {
            return element;
        }
         // Se l'elemento è un <picture>, cerca l'immagine al suo interno
        if (element.tagName === 'PICTURE') {
            const imgElement = element.querySelector('img');
            if (imgElement) {
                return imgElement;
            }
        }
        // Se l'elemento è un <source>, cerca l'immagine nello srcset
        if (element.tagName === 'SOURCE') {
            const srcSetUrls = element.srcset.split(',').map(src => src.trim().split(' ')[0]);
            if (srcSetUrls.length > 0) {
                return { src: srcSetUrls[0] }; // Simula un elemento immagine con l'URL
            }
        }
        // Se l'elemento ha un'immagine di sfondo, restituiscila
        const bgImage = window.getComputedStyle(element).backgroundImage;
        if (bgImage && bgImage !== 'none') {
            const url = bgImage.match(/url\(['"]?([^'"]+)['"]?\)/);
            if (url && url[1]) {
                return { src: url[1] }; // Simula un elemento immagine con l'URL
            }
        }
        // Se l'elemento ha un figlio <img>, restituiscilo
        const imgChild = element.querySelector('img');
        if (imgChild) {
            return imgChild;
        }
        // Se l'elemento ha un figlio <picture>, cerca l'immagine al suo interno
        const pictureChild = element.querySelector('picture');
        if (pictureChild) {
            return utils.findImageElement(pictureChild);
        }
        // Se non è stato trovato nulla, restituisci null
        return null;
    },
    isImageElement(element) {
         if (!element) return false;
        const tagName = element.tagName?.toLowerCase();
        const backgroundImage = element.style?.backgroundImage;
        return tagName === 'img' || tagName === 'picture' || tagName === 'source' || (backgroundImage && backgroundImage !== 'none');
    }
};

// Funzione per gestire il clic destro
function handleRightClick(event) {
    // Verifica se il contesto dell'estensione è ancora valido
    if (!chrome.runtime?.id) {
        console.log("Extension context invalidated. Cleaning up and re-adding listener.");

        // 1. Rimuovi il listener non valido
        document.removeEventListener('contextmenu', handleRightClick);

        // 2. Rivalida il contesto e aggiungi nuovamente il listener
        if (chrome.runtime?.id) {
            console.log("Re-adding handleRightClick event listener.");
            document.addEventListener('contextmenu', handleRightClick);
        } else {
            console.log("Extension context is still invalid. Cannot re-add listener.");
            return;
        }

        // 3. Esegui il codice del clic corrente
        // (opzionale: puoi decidere se eseguire il clic corrente o ignorarlo)
        console.log("Executing right-click logic after cleanup.");
    }

    // Verifica se l'URL della pagina è valido
    if (!isValidUrl(window.location.href)) {
        chrome.runtime.sendMessage({
            action: 'updateContextMenu',
            imageUrl: null,
            isImage: false
        });
        return;
    }

    // CODICE ORIGINALE (non modificato)
    // Ottieni l'elemento cliccato
    let targetElement = event.target;
    let imageElement = null;
    let isImage = false;

    // Escludi l'elemento specifico per ID
    if (targetElement.id === "ipc-wrap-background-id") {
        chrome.runtime.sendMessage({
            action: 'updateContextMenu',
            imageUrl: null,
            isImage: false
        });
        return;
    }

    // Verifica se l'elemento cliccato o un suo genitore è un'immagine
    let currentElement = targetElement;
    while (currentElement) {
        if (utils.isImageElement(currentElement)) {
            imageElement = utils.findImageElement(currentElement);
            isImage = true;
            break;
        }
        currentElement = currentElement.parentElement;
    }

    if (isImage && imageElement && imageElement.src) {
        console.log("Immagine trovata:", imageElement.src);
        // Invia un messaggio al background script per aggiornare il menu contestuale
        chrome.runtime.sendMessage({
            action: 'updateContextMenu',
            imageUrl: imageElement.src,
            isImage: true
        });
    } else {
        chrome.runtime.sendMessage({
            action: 'updateContextMenu',
            imageUrl: null,
            isImage: false
        });
    }
}





// Funzione per verificare se l'URL è valido
function isValidUrl(url) {
    return url && (url.startsWith('http://') || url.startsWith('https://'));
}

// Aggiungi il listener per il clic destro su tutta la pagina
document.addEventListener('contextmenu', handleRightClick);

// IN content.js (Listener alla fine del file)

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "extractImages") {
        const extractor = new ImageExtractor();
        // Ottieni tabId dal sender o dalla richiesta
        const tabId = sender.tab?.id || request.tabId; // Determina il tabId
        if (!tabId) {
            console.error("Impossibile determinare tabId per extractImages");
            return; // Non procedere senza tabId
        }
        extractor.setTabId(tabId); // Imposta il tabId

        if (request.singleImageUrl) {
            extractor.singleImageUrl = request.singleImageUrl;
            extractor.extractImages().then(imageGroups => {
                const serializedGroups = {};
                imageGroups.forEach((value, key) => {
                    serializedGroups[key] = value;
                });
                // Invia la risposta al background (che inoltrerà alla sidebar corretta)
                chrome.runtime.sendMessage({
                    action: "setImages",
                    imageGroups: serializedGroups,
                    tabId: extractor.tabId // Includi il tabId per il routing
                });
            });
        } else {
            // Questa logica sembra ridondante con getImages, valuta se rimuoverla
             chrome.runtime.sendMessage({ action: "getImages", tabId: tabId });
        }
    } else if (request.action === "getImages") {
        const extractor = new ImageExtractor();
         const tabId = sender.tab?.id || request.tabId; // Determina il tabId
         if (!tabId) {
             console.error("Impossibile determinare tabId per getImages");
             return;
         }
        extractor.setTabId(tabId); // Imposta il tabId
        extractor.extractImages().then(imageGroups => {
            const serializedGroups = {};
            imageGroups.forEach((value, key) => {
                serializedGroups[key] = value;
            });
             // Invia la risposta al background
            chrome.runtime.sendMessage({
                action: "setImages",
                imageGroups: serializedGroups,
                tabId: extractor.tabId // Includi il tabId
            });
        });
    } else if (request.action === "downloadImages") { // <-- AZIONE DOWNLOAD ZIP
        const extractor = new ImageExtractor();
        const tabId = sender.tab?.id || request.tabId; // Determina il tabId
        if (!tabId) {
            console.error("Impossibile determinare tabId per downloadImages");
            return;
        }
        // --- MODIFICA: AGGIUNTA QUESTA RIGA ---
        extractor.setTabId(tabId);
        // --- FINE MODIFICA ---
        
        // Passa l'opzione preserveOriginalName al metodo downloadSelectedImages
        extractor.downloadSelectedImages(request.urls, request.zipName || "images", request.preserveOriginalName);

    } else if (request.action === "downloadImagesIndividually") { // <-- AZIONE DOWNLOAD INDIVIDUALE
        const extractor = new ImageExtractor();
        const tabId = sender.tab?.id || request.tabId; // Determina il tabId
        if (!tabId) {
            console.error("Impossibile determinare tabId per downloadImagesIndividually");
            return;
        }
        // --- MODIFICA: AGGIUNTA QUESTA RIGA ---
        extractor.setTabId(tabId);
        // --- FINE MODIFICA ---
        
        // Passa l'opzione preserveOriginalName al metodo downloadImagesIndividually
        extractor.downloadImagesIndividually(request.urls, request.baseName, request.preserveOriginalName);

    } else if (request.action === "toggleRescanButton") {
        // Questa parte sembra più logica per sidebar.js, ma se serve qui ok
        const rescanButton = document.getElementById('rescan'); // Cerca nel DOM del content script? Strano.
        if (rescanButton) {
            rescanButton.style.display = request.visible ? 'block' : 'none';
        }
    }
    // Aggiungi qui gli altri else if esistenti (pause/resume/stop download)
    else if (request.action === "pauseDownload") {
        console.log("Ricevuta richiesta di pausa download in content.js");
        isPaused = true; // Usa la variabile globale isPaused definita in content.js
        sendResponse({ status: "paused" });
        return true;
    } else if (request.action === "resumeDownload") {
        console.log("Ricevuta richiesta di ripresa download in content.js");
        isPaused = false; // Usa la variabile globale isPaused
        sendResponse({ status: "resumed" });
         // Potrebbe essere necessario notificare anche il flusso RxJS se usi segnali
         // resumeSignal$.next(); // Se usi RxJS per la pausa/ripresa
        return true;
    } else if (request.action === "stopDownload") {
        console.log("Ricevuta richiesta di interruzione download in content.js");
        isStopped = true; // Usa la variabile globale isStopped
        isPaused = false; // Assicurati che non rimanga in pausa
         // Potrebbe essere necessario notificare anche il flusso RxJS
         // stopSignal$.next(); // Se usi RxJS per fermare
        sendResponse({ status: "stopped" });
        return true; // Indica che la risposta potrebbe essere asincrona (anche se qui non lo è)
    }
    // Assicurati che ci sia un return false o return true; appropriato alla fine se necessario
     // return false; // Se non gestisci la risposta in modo asincrono in nessun caso sopra
     // return true; // Se alcuni rami (come pause/resume/stop) POTREBBERO essere asincroni
});

// Nota: Ho rimosso il listener duplicato per pause/resume/stop che avevi sotto,
// la logica è stata integrata nel listener principale sopra.
// Listener per i messaggi dal sidebar
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "startExperimentalFunction") {
        // Avvia la funzione sperimentale
        autoScroll();
    }else if (request.action === "experimentalFunctionEnded") {
        isExperimentalLoading = false;
        experimentalButton.disabled = false;
    }
  });

async function autoScroll() {
    console.log("Caricamento della libreria html2canvas...");

    // Aggiungi il CSS per il loader all'head
    const styleLoader = document.createElement('style');
    styleLoader.textContent = `
        .loader {
            border: 4px solid #f3f3f3;
            border-top: 4px solid #3498db;
            border-radius: 50%;
            width: 30px;
            height: 30px;
            animation: spin 1s linear infinite;
        }
        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }
    `;
    document.head.appendChild(styleLoader);

    console.log("Preparazione della copia statica...");

    // Blocca lo scroll (rimosso document.body.style.overflow = 'hidden';)
      let clone, overlay, stopButton;

       // Crea lo style per nascondere la scrollbar
    const styleScrollbar = document.createElement('style');
    styleScrollbar.textContent = `
       ::-webkit-scrollbar {
            width: 0px;
             height: 0px;
        }
        ::-webkit-scrollbar-thumb {
             background: transparent;
        }
       `;
    document.head.appendChild(styleScrollbar);


    // Crea la copia statica della pagina con overlay SE html2canvasEnabled è true
    if (html2canvasEnabled) {
         ({ clone, overlay, stopButton } = await createStaticClone());
         console.log("Copia statica creata. Inizio dello scroll...");
    } else {
        // Crea un overlay senza l'immagine statica e il pulsante
        ({ overlay, stopButton } = await createSimpleOverlay());
        console.log("Avvio dello scroll senza copia statica...");
    }


    let previousImageCount = document.images.length; // Conta le immagini iniziali
    let scrollAttempts = 0;
    let scrollInterval; // Definisci la variabile scrollInterval

    // Funzione per interrompere lo scroll
    const stopScroll = (removeOverlay = true) => {
        clearInterval(scrollInterval); // Ferma l'intervallo di scroll

        // Mostra il messaggio "CLOSING..."
        overlay.innerHTML = '<span style="font-size: 24px; color: #000;">CLOSING...</span>';

        // Rimuovi la copia statica e l'overlay con un ritardo
          setTimeout(() => {
              if(html2canvasEnabled){
                  removeStaticClone(clone, overlay);
              }
            if (removeOverlay && overlay && overlay.parentNode) {
                overlay.parentNode.removeChild(overlay);
            }
           // Rimuovi l'overlay
           if (styleScrollbar && styleScrollbar.parentNode) {
                 styleScrollbar.parentNode.removeChild(styleScrollbar);
             }
             if (styleLoader && styleLoader.parentNode) {
                styleLoader.parentNode.removeChild(styleLoader);
             }
            document.body.style.overflow = ''; // Riabilita lo scroll
            console.log("Scroll interrotto dall'utente e overlay rimosso con ritardo");

              // Invia un messaggio al sidebar per indicare la fine dello scroll
            chrome.runtime.sendMessage({ action: "experimentalFunctionEnded" });

        }, 1000); // 1 secondo di ritardo

        window.scrollTo({ top: 0, behavior: 'smooth' }); // Torna all'inizio della pagina
    }
    
    
    // Aggiungi l'event listener al pulsante Stop
    stopButton.addEventListener('click', () => stopScroll(true)); // Passa true per rimuovere l'overlay
    

    scrollInterval = setInterval(() => {
         // Scorri la pagina fino in fondo
         window.scrollTo(0, document.body.scrollHeight);
  
         // Aspetta un po' per permettere il caricamento delle nuove immagini
         setTimeout(() => {
            const newImageCount = document.images.length;
            const controlMaxAttempts = Math.floor(maxAttempts / 2)
  
  
            if (isFirstIteration) {
                 // Logica per la prima iterazione
                firstIterationAttempts++;
                console.log(`Prima iterazione: ${firstIterationAttempts}/${controlMaxAttempts} tentativi.`);
  
                 if(newImageCount === previousImageCount && firstIterationAttempts <= controlMaxAttempts) {
                     //continua la prima iterazione
                 } else if (newImageCount > previousImageCount || firstIterationAttempts <= controlMaxAttempts) {
                   // Fine della prima iterazione
                    if(newImageCount > previousImageCount) {
                        previousScrollAttempts = firstIterationAttempts;
                        previousImageCount = newImageCount;
                       console.log("Nuove immagini caricate durante la prima iterazione");
                    }
                    
                    isFirstIteration = false;
                     firstIterationAttempts = 0;
                     scrollAttempts = 0;
                      console.log("Prima iterazione completata. Avvio iterazioni normali.");
  
                    if(newImageCount > previousImageCount) {
                        adjustDelays();
                    }
  
  
                   } else if (firstIterationAttempts > controlMaxAttempts && newImageCount === previousImageCount) {
                        // Prima iterazione fallita, avvia la seconda iterazione
                          console.log("Prima iterazione fallita, avvio seconda iterazione normale.");
                          isFirstIteration = false;
                          previousImageCount = newImageCount; // imposta immagini attuali
                          firstIterationAttempts = 0; // resetta il contatore
                          scrollAttempts = 0; // resetta il contatore standard
  
                     }
  
  
           } else {
                // Logica per le iterazioni normali
                    if (newImageCount === previousImageCount) {
                     scrollAttempts++;
                    console.log(`Nessuna nuova immagine caricata. Tentativo ${scrollAttempts}/${maxAttempts}.`);
                    } else {
                     if(previousScrollAttempts !== 0) {
                         attemptHistory.push(previousScrollAttempts);
                         if (attemptHistory.length > historySize) {
                            attemptHistory.shift();
                            }
                     }
                     adjustDelays();
                     previousImageCount = newImageCount;
                        previousScrollAttempts = scrollAttempts;
                     scrollAttempts = 0;
                      console.log("New images loaded, reset attempts counter");
  
                    }
          }
  
             // Se abbiamo raggiunto il numero massimo di tentativi, fermati
             if ((!isFirstIteration && scrollAttempts >= maxAttempts) || (isFirstIteration && firstIterationAttempts > controlMaxAttempts && newImageCount === previousImageCount)) {
                clearInterval(scrollInterval);
                   console.log("Nessuna nuova immagine caricata. Fine dello scroll.");

                // Torna all'inizio della pagina
                   window.scrollTo({ top: 0, behavior: 'smooth' });

                // Aspetta che lo scroll verso l'alto sia completato prima di rimuovere l'immagine statica
                setTimeout(() => {
                    stopScroll(true); // Passa true per rimuovere l'overlay

               }, 1000); // 1 secondo di attesa per lo scroll verso l'alto
             }
        }, loadDelay);
   }, scrollDelay);
}

function removeStaticClone(clone, overlay) {
    if (clone && clone.parentNode) {
        clone.parentNode.removeChild(clone);
    }
}


function createSimpleOverlay() {
    return new Promise((resolve) => {
        // Crea un overlay
        const overlay = document.createElement('div');
        overlay.style.position = 'fixed';
        overlay.style.top = '0';
        overlay.style.left = '0';
        overlay.style.width = '100%';
        overlay.style.height = '100%';
        overlay.style.backgroundColor = 'rgba(255, 255, 255, 0.8)';
        overlay.style.zIndex = '10000';
        overlay.style.display = 'flex';
        overlay.style.flexDirection = 'column'; // Per mettere il bottone sotto il loader
        overlay.style.justifyContent = 'center';
        overlay.style.alignItems = 'center';

        // Crea il loader
         const loader = document.createElement('div');
         loader.classList.add('loader');
         overlay.appendChild(loader);

        // Crea il pulsante Stop
        const stopButton = document.createElement('button');
        stopButton.textContent = 'Stop';
        stopButton.style.padding = '15px 30px';
        stopButton.style.fontSize = '20px';  // Pulsante più grande
        stopButton.style.cursor = 'pointer';
        stopButton.style.marginTop = '30px'; // Aumentato spazio dal loader
        stopButton.style.backgroundColor = '#f44336'; // Colore rosso per il pulsante stop
        stopButton.style.color = 'white';
        stopButton.style.border = 'none';
        stopButton.style.borderRadius = '4px';
        stopButton.style.pointerEvents = 'auto'; // Aggiungi questa linea per il pulsante
        overlay.appendChild(stopButton);

        document.body.appendChild(overlay);

        resolve({overlay, stopButton});
    });
}

// Funzione per trovare il contenitore di scorrimento principale
async function findScrollableContainer() {
    // Selettori comuni di contenitori di scroll
    const scrollSelectors = [
        'div[style*="overflow: auto"]',
         'div[style*="overflow-y: auto"]',
        'div[style*="overflow: scroll"]',
        'div[style*="overflow-y: scroll"]',
         'section[style*="overflow: auto"]',
         'section[style*="overflow-y: auto"]',
        'section[style*="overflow: scroll"]',
        'section[style*="overflow-y: scroll"]',
         'main[style*="overflow: auto"]',
          'main[style*="overflow-y: auto"]',
        'main[style*="overflow: scroll"]',
         'main[style*="overflow-y: scroll"]',
        'article[style*="overflow: auto"]',
         'article[style*="overflow-y: auto"]',
        'article[style*="overflow: scroll"]',
         'article[style*="overflow-y: scroll"]',
         'aside[style*="overflow: auto"]',
          'aside[style*="overflow-y: auto"]',
        'aside[style*="overflow: scroll"]',
        'aside[style*="overflow-y: scroll"]',
         'ul[style*="overflow: auto"]',
          'ul[style*="overflow-y: auto"]',
        'ul[style*="overflow: scroll"]',
         'ul[style*="overflow-y: scroll"]',
         'ol[style*="overflow: auto"]',
          'ol[style*="overflow-y: auto"]',
        'ol[style*="overflow: scroll"]',
         'ol[style*="overflow-y: scroll"]',
        'div[class*="scroll"]',
         'section[class*="scroll"]',
        'main[class*="scroll"]',
          'article[class*="scroll"]',
          'aside[class*="scroll"]',
           'ul[class*="scroll"]',
          'ol[class*="scroll"]',
        'div[id*="scroll"]',
         'section[id*="scroll"]',
        'main[id*="scroll"]',
          'article[id*="scroll"]',
        'aside[id*="scroll"]',
          'ul[id*="scroll"]',
           'ol[id*="scroll"]'
    ];

    for (const selector of scrollSelectors) {
         const element = document.querySelector(selector);
        if (element && element.scrollHeight > element.clientHeight) {
            return element;
        }
    }
    return null; // Nessun contenitore di scroll trovato
}

// Modifica la funzione per creare una copia statica della pagina/elemento
function createStaticClone() {
    return new Promise((resolve) => {
       // Forza il caricamento delle immagini in lazy loading
       document.querySelectorAll('img[loading="lazy"]').forEach(img => {
           img.loading = 'eager'; // Forza il caricamento immediato
       });

       // Aspetta che tutte le immagini siano caricate
       Promise.all(Array.from(document.images).map(img => {
           if (img.complete) return Promise.resolve();
           return new Promise((resolve) => {
               img.onload = img.onerror = resolve;
           });
       })).then(() => {
            // Ottieni le dimensioni della finestra visibile
            const width = window.innerWidth;
            const height = document.body.scrollHeight; // usa l'altezza completa del body!

           // Cattura l'istantanea della pagina
            html2canvas(document.body, {
                scale: 0.5, // Abbassa ulteriormente la risoluzione
                useCORS: true,
                allowTaint: false,
                logging: false, // Disabilita i log per le performance
                backgroundColor: '#FFFFFF',
                width: width,
                height: height,
                windowWidth: width,
                windowHeight: height,
                scrollY: window.scrollY, // Aggiungi scrollY
                scrollX: window.scrollX, // Aggiungi scrollX
            }).then(canvas => {
                const clone = new Image();
                clone.src = canvas.toDataURL();
                clone.style.position = 'fixed';
                clone.style.top = '0';
                clone.style.left = '0';
                clone.style.width = '100%';
                clone.style.height = 'auto';
                clone.style.zIndex = '9999';
                clone.style.pointerEvents = 'none';
                document.body.appendChild(clone);

                // Crea un overlay
                 const overlay = document.createElement('div');
               overlay.style.position = 'fixed';
               overlay.style.top = '0';
               overlay.style.left = '0';
               overlay.style.width = '100%';
               overlay.style.height = '100%';
               overlay.style.backgroundColor = 'rgba(255, 255, 255, 0.8)';
               overlay.style.zIndex = '10000';
               overlay.style.display = 'flex';
               overlay.style.flexDirection = 'column'; // Per mettere il bottone sotto il loader
               overlay.style.justifyContent = 'center';
               overlay.style.alignItems = 'center';

                // Crea il loader
               const loader = document.createElement('div');
               loader.classList.add('loader');
               overlay.appendChild(loader);

                // Crea il pulsante Stop
                const stopButton = document.createElement('button');
               stopButton.textContent = 'Stop';
               stopButton.style.padding = '15px 30px';
               stopButton.style.fontSize = '20px';  // Pulsante più grande
               stopButton.style.cursor = 'pointer';
               stopButton.style.marginTop = '30px'; // Aumentato spazio dal loader
               stopButton.style.backgroundColor = '#f44336'; // Colore rosso per il pulsante stop
                stopButton.style.color = 'white';
                stopButton.style.border = 'none';
               stopButton.style.borderRadius = '4px';
                stopButton.style.pointerEvents = 'auto'; // Aggiungi questa linea per il pulsante
                overlay.appendChild(stopButton);

               document.body.appendChild(overlay);

                resolve({ clone, overlay, stopButton });
           });
       });
   });
}}
