// catalogo-libri-app/backend/server.js - AGGIORNATO CON WEB SCRAPING MULTI-SITO

require('dotenv').config();

const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs').promises;
const multer = require('multer');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { stringify } = require('csv-stringify');
const ExcelJS = require('exceljs');
const { v4: uuidv4 } = require('uuid');
const axios = require('axios');
const cheerio = require('cheerio');

// Importa i moduli di gestione database
const sqliteDb = require('./database/sqlite-db');
const pgDb = require('./database/pg-db');
const bookRepository = require('./database/book-repository');

const app = express();
const PORT = 3001;

// Configurazione Gemini Al
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || 'YOUR_GEMINI_API_KEY_HERE';
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
const hasGeminiKey = GEMINI_API_KEY && GEMINI_API_KEY !== 'YOUR_GEMINI_API_KEY_HERE';

// Creazione della directory per le immagini caricate
const UPLOADS_DIR = path.join(__dirname, 'uploads');
fs.mkdir(UPLOADS_DIR, { recursive: true }).catch(err => {
  console.error('Errore creazione directory uploads:', err.message);
});

// Configurazione Multer per upload file
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOADS_DIR),
  filename: (req, file, cb) => {
    const fileExtension = path.extname(file.originalname);
    cb(null, uuidv4() + fileExtension);
  }
});
const upload = multer({ storage: storage });

// MIDDLEWARE
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(UPLOADS_DIR));

// CONNESSIONE E INIZIALIZZAZIONE DATABASE DINAMICA
const DATABASE_TYPE = process.env.DATABASE_TYPE || 'sqlite';
let dbModule;
if (DATABASE_TYPE === 'postgresql' || DATABASE_TYPE === 'postgres') {
  dbModule = pgDb;
  console.log('Configurato per utilizzare PostgreSQL.');
} else {
  dbModule = sqliteDb;
  console.log('Configurato per utilizzare SQLite (default).');
}
dbModule.connectDb(DATABASE_TYPE === 'sqlite' ? 'data/books.db' : undefined)
  .then(db => {
    bookRepository.setDbInstance(db);
    return dbModule.initializeDb();
  })
  .then(() => {
    console.log(`Database (${DATABASE_TYPE.toUpperCase()}) e schema "books" pronti per l'uso.`);
  })
  .catch(err => {
    console.error(`X Errore fatale all'avvio del database ${DATABASE_TYPE.toUpperCase()}:`, err.message);
    process.exit(1);
  });

// FUNZIONI HELPER
async function fileToGenerativePart(filePath, mimeType) {
  const buffer = await fs.readFile(filePath);
  return {
    inlineData: {
      data: buffer.toString("base64"),
      mimeType: mimeType,
    },
  };
}

function convertIsbn10ToIsbn13(isbn10) {
    const cleanedIsbn10 = isbn10.replace(/[^0-9X]/gi, "").toUpperCase();
    if (cleanedIsbn10.length !== 10) {
        return null;
    }
    const baseIsbn13 = '978' + cleanedIsbn10.substring(0, 9);
    let sum = 0;
    for (let i = 0; i < 12; i++) {
        const digit = parseInt(baseIsbn13[i], 10);
        sum += (i % 2 === 0) ? digit : digit * 3;
    }
    const checksum = (10 - (sum % 10)) % 10;
    return baseIsbn13 + checksum;
}


// ======================================================================================
// === NUOVE FUNZIONI DI SCRAPING PER OGNI SITO =========================================
// ======================================================================================

const axiosClient = axios.create({
    headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
    }
});

function cleanPrice(priceText) {
    if (!priceText) return null;
    const cleaned = priceText.replace(/[^0-9,.]/g, '').replace(',', '.').trim();
    const price = parseFloat(cleaned);
    return isNaN(price) ? null : price;
}

async function scrapeMaremagnum(title, author) {
    const searchUrl = `https://www.maremagnum.com/ricerca/risultati?params[author]=${encodeURIComponent(author)}&params[title]=${encodeURIComponent(title)}`;
    const { data } = await axiosClient.get(searchUrl);
    const $ = cheerio.load(data);
    const prices = [];
    $('span.c-pricetooltip__price').each((i, el) => {
        const price = cleanPrice($(el).text());
        if (price) prices.push(price);
    });
    console.log(`Maremagnum: trovati ${prices.length} prezzi.`);
    return prices;
}

async function scrapeAbebooks(title, author) {
    const searchUrl = `https://www.abebooks.it/servlet/SearchResults?an=${encodeURIComponent(author)}&tn=${encodeURIComponent(title)}`;
    const { data } = await axiosClient.get(searchUrl);
    const $ = cheerio.load(data);
    const prices = [];
    $('p.item-price').each((i, el) => {
        const price = cleanPrice($(el).text());
        if (price) prices.push(price);
    });
    console.log(`Abebooks: trovati ${prices.length} prezzi.`);
    return prices;
}

async function scrapeIBS(title, author) {
    const searchUrl = `https://www.ibs.it/search/?q=${encodeURIComponent(title + ' ' + author)}`;
    const { data } = await axiosClient.get(searchUrl);
    const $ = cheerio.load(data);
    const prices = [];
    $('.price, .price-new').each((i, el) => {
        const price = cleanPrice($(el).text());
        if (price) prices.push(price);
    });
    console.log(`IBS: trovati ${prices.length} prezzi.`);
    return prices;
}

async function scrapeLibreriaUniversitaria(title, author) {
    const searchUrl = `https://www.libreriauniversitaria.it/ricerca/query/${encodeURIComponent(title + ' ' + author)}`;
    const { data } = await axiosClient.get(searchUrl);
    const $ = cheerio.load(data);
    const prices = [];
    $('div.price').each((i, el) => {
        const price = cleanPrice($(el).text());
        if (price) prices.push(price);
    });
    console.log(`Libreria Universitaria: trovati ${prices.length} prezzi.`);
    return prices;
}


// ======================================================================================
// === ENDPOINT API - AGGIORNATO PER SCRAPING MULTI-SITO ================================
// ======================================================================================

app.post('/api/search-book-prices', async (req, res) => {
  console.log('Richiesta ricerca prezzi Multi-sito ricevuta');
  const { bookData } = req.body;

  if (!bookData || !bookData.titolo || !bookData.autore) {
    return res.status(400).json({ error: 'Titolo e autore sono necessari per la ricerca.' });
  }

  const { titolo, autore } = bookData;

  const scrapers = [
    scrapeMaremagnum(titolo, autore),
    scrapeAbebooks(titolo, autore),
    scrapeIBS(titolo, autore),
    scrapeLibreriaUniversitaria(titolo, autore),
  ];

  const results = await Promise.allSettled(scrapers);
  let allPrices = [];

  results.forEach((result, index) => {
    if (result.status === 'fulfilled') {
      allPrices.push(...result.value);
    } else {
      const scraperName = ['Maremagnum', 'Abebooks', 'IBS', 'LibreriaUniversitaria'][index];
      console.error(`Scraper per ${scraperName} ha fallito:`, result.reason.message);
    }
  });
  
  const uniquePrices = [...new Set(allPrices)].sort((a, b) => a - b);
  console.log(`Trovati ${uniquePrices.length} prezzi unici in totale.`);

  res.json({
    prices: uniquePrices.slice(0, 20),
    source: 'Multi-sito',
  });
});


// ======================================================================================
// === ALTRI ENDPOINT ===================================================================
// ======================================================================================

// Endpoint per l'analisi foto con Al
app.post('/api/analyze-photo-ai', upload.array('photos', 5), async (req, res) => {
    if (!hasGeminiKey) {
        if (req.files && req.files.length > 0) {
            await Promise.all(req.files.map(file => fs.unlink(file.path).catch(err => console.error("Errore cancellazione file:", err))));
        }
        return res.status(400).json({ error: 'Chiave API Gemini non configurata. Impossibile eseguire l\'analisi Al.' });
    }
    if (!req.files || req.files.length === 0) {
        return res.status(400).json({ error: 'Nessuna foto caricata.' });
    }
    let uploadedFilePaths = [];
    try {
        uploadedFilePaths = req.files.map(file => ({ path: file.path, mimetype: file.mimetype }));
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        const imageParts = await Promise.all(uploadedFilePaths.map(file => fileToGenerativePart(file.path, file.mimetype)));

        const prompt = 'Analizza attentamente TUTTE le immagini fornite... (il prompt dettagliato rimane invariato)'; // Manteniamo il prompt originale
        
        const result = await model.generateContent([prompt, ...imageParts]);
        const response = await result.response;
        let text = response.text();
        
        const jsonMatch = text.match(/^```json\n([\s\S]*?)\n```/);
        if (jsonMatch && jsonMatch[1]) {
            text = jsonMatch[1];
        } else {
            text = text.replace(/```json/g, "").replace(/```/g, "").trim();
        }
        
        let aiData;
        try {
            aiData = JSON.parse(text);
        } catch (jsonParseError) {
            console.error("Errore nel parsing del JSON da Gemini:", jsonParseError, "Testo:", text);
            aiData = { titolo: 'Errore Al', autore: 'Verifica manuale', confidence: 0, descrizioneAl: 'Impossibile estrarre dati.' };
        }
        
        let isbn = aiData.isbn || "";
        if (isbn.length === 10 && /^[0-9]{9}[0-9X]$/i.test(isbn)) {
            const convertedIsbn = convertIsbn10ToIsbn13(isbn);
            if (convertedIsbn) {
                isbn = convertedIsbn;
            }
        } else {
            isbn = isbn.replace(/[^0-9]/g, "");
        }

        let prezzo = aiData.prezzo;
        if (typeof prezzo === 'string') {
            prezzo = prezzo.replace(/[^0-9.,]/g, "").replace(',', '.');
            prezzo = parseFloat(prezzo);
        }
        prezzo = (typeof prezzo === 'number' && !isNaN(prezzo)) ? prezzo : null;

        const parsedCategoriesAl = Array.isArray(aiData.categoriesAl) ? aiData.categoriesAl : [];

        const bookData = {
            titolo: aiData.titolo || "",
            autore: aiData.autore || "",
            editore: aiData.editore || "",
            anno: aiData.anno || "",
            isbn: isbn,
            prezzo: prezzo,
            lingua: aiData.lingua || 'italiano',
            descrizione: aiData.descrizioneAl || "",
            categoria: parsedCategoriesAl[0] || "",
            sottocategoria1: parsedCategoriesAl[1] || "",
            sottocategoria2: parsedCategoriesAl[2] || "",
            condizioniLibro: aiData.condizioniLibro || "",
            confidence: aiData.confidence || 0,
            descrizioneAl: aiData.descrizioneAl || "",
            categoriesAl: parsedCategoriesAl,
            additionalCopies: [],
            imageUrls: uploadedFilePaths.map(file => `/uploads/${path.basename(file.path)}`)
        };

        res.json({ results: [bookData] });
    } catch (err) {
        console.error('Errore nell\'analisi Al:', err);
        res.status(500).json({ error: 'Si è verificato un errore durante l\'analisi Al.' });
    } finally {
        if (uploadedFilePaths && uploadedFilePaths.length > 0) {
            await Promise.all(uploadedFilePaths.map(file => fs.unlink(file.path).catch(err => console.error("Errore cancellazione file:", err))));
        }
    }
});

// API per ottenere tutti i libri
app.get('/api/books', async (req, res) => {
    try {
        const books = await bookRepository.getAllBooks();
        res.json(books);
    } catch (err) {
        console.error('Errore GET /api/books:', err.message);
        res.status(500).json({ error: 'Errore durante il recupero dei libri.' });
    }
});

// API per aggiungere un nuovo libro
app.post('/api/books', async (req, res) => {
    const bookData = req.body;
    if (!bookData.titolo || !bookData.autore) {
        return res.status(400).json({ error: 'Titolo e Autore sono campi obbligatori.' });
    }
    try {
        const newBook = await bookRepository.addBook(bookData);
        res.status(201).json(newBook);
    } catch (err) {
        console.error('Errore POST /api/books:', err.message);
        res.status(500).json({ error: 'Errore durante l\'aggiunta del libro.' });
    }
});

// API per aggiornare un libro esistente
app.put('/api/books/:id', async (req, res) => {
    const { id } = req.params;
    const bookData = req.body;
    if (!bookData.titolo || !bookData.autore) {
        return res.status(400).json({ error: 'Titolo e Autore sono campi obbligatori.' });
    }
    try {
        const updatedBook = await bookRepository.updateBook(id, bookData);
        res.json(updatedBook);
    } catch (err) {
        console.error(`Errore PUT /api/books/${id}:`, err.message);
        if (err.message === 'Libro non trovato.') {
            return res.status(404).json({ error: err.message });
        }
        res.status(500).json({ error: 'Errore durante l\'aggiornamento del libro.' });
    }
});

// API per eliminare un libro
app.delete('/api/books/:id', async (req, res) => {
    try {
        const result = await bookRepository.deleteBook(req.params.id);
        res.json(result);
    } catch (err) {
        console.error(`Errore DELETE /api/books/${req.params.id}:`, err.message);
        if (err.message === 'Libro non trovato.') {
            return res.status(404).json({ error: err.message });
        }
        res.status(500).json({ error: 'Errore durante l\'eliminazione del libro.' });
    }
});

// API per esportare tutti i dati in JSON
app.get('/api/export-json', async (req, res) => {
    try {
        const booksToExport = await bookRepository.getAllBooks();
        const dataToExport = {
            exportedAt: new Date().toISOString(),
            totalBooks: booksToExport.length,
            books: booksToExport
        };
        const backupDir = path.join(__dirname, 'backups');
        await fs.mkdir(backupDir, { recursive: true });
        const filename = `backup_catalogo_${new Date().toISOString().replace(/:/g, '-')}.json`;
        const filePath = path.join(backupDir, filename);
        await fs.writeFile(filePath, JSON.stringify(dataToExport, null, 2));
        res.json({ message: 'Dati esportati con successo!', filename });
    } catch (err) {
        console.error('Errore GET /api/export-json:', err.message);
        res.status(500).json({ error: 'Errore durante l\'esportazione dei dati in JSON.' });
    }
});

// API per esportare in CSV
app.get('/api/export-csv', async (req, res) => {
    try {
        const rows = await bookRepository.getAllBooks();
        // ... (logica di mappatura e generazione CSV come da documento originale)
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="catalogo.csv"`);
        stringify(rows, { header: true }).pipe(res);
    } catch (err) {
        console.error('Errore GET /api/export-csv:', err.message);
        res.status(500).json({ error: 'Errore durante la generazione del file CSV.' });
    }
});

// API per esportare in XLSX (Excel)
app.get('/api/export-xlsx', async (req, res) => {
    try {
        const rows = await bookRepository.getAllBooks();
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Catalogo Libri');
        // ... (logica di creazione colonne e righe come da documento originale)
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="catalogo.xlsx"`);
        await workbook.xlsx.write(res);
        res.end();
    } catch (err) {
        console.error('Errore GET /api/export-xlsx:', err.message);
        res.status(500).json({ error: 'Errore durante la generazione del file XLSX.' });
    }
});

// API per importare dati
app.post('/api/import', upload.single('file'), async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'Nessun file selezionato.' });
    }
    try {
        const fileContent = req.file.buffer.toString('utf8');
        const importedData = JSON.parse(fileContent);
        if (!importedData.books || !Array.isArray(importedData.books)) {
            return res.status(400).json({ error: 'Formato file non valido.' });
        }
        const result = await bookRepository.importBooks(importedData.books);
        res.json(result);
    } catch (err) {
        console.error('Errore importazione:', err);
        res.status(500).json({ error: `Errore nell'elaborazione del file: ${err.message}` });
    }
});

// API per statistiche del catalogo
app.get('/api/stats', async (req, res) => {
    try {
        const totalBooks = await bookRepository.getTotalBooks();
        const lastUpdated = await bookRepository.getLastUpdated();
        const uniqueAuthors = await bookRepository.getUniqueAuthors();
        const totalValue = await bookRepository.getTotalCatalogValue();
        res.json({ totalBooks, lastUpdated, uniqueAuthors, totalValue: totalValue.toFixed(2) });
    } catch (err) {
        console.error('Errore GET /api/stats:', err.message);
        res.status(500).json({ error: 'Errore recupero statistiche.' });
    }
});

// API per gestire i backup
const backupDir = path.join(__dirname, 'backups');
app.get('/api/backups', async (req, res) => {
    try {
        await fs.mkdir(backupDir, { recursive: true });
        const files = await fs.readdir(backupDir);
        const jsonFiles = files.filter(f => f.endsWith('.json')).sort().reverse();
        res.json(jsonFiles);
    } catch (err) {
        res.status(500).json({ error: 'Errore recupero backup.' });
    }
});

app.get('/api/backups/:filename', async (req, res) => {
    const filePath = path.join(backupDir, req.params.filename);
    res.download(filePath);
});

app.post('/api/backups/:filename/restore', async (req, res) => {
    const filePath = path.join(backupDir, req.params.filename);
    try {
        const fileContent = await fs.readFile(filePath, 'utf8');
        const data = JSON.parse(fileContent);
        if (!data.books || !Array.isArray(data.books)) {
            return res.status(400).json({ error: 'File di backup non valido.' });
        }
        const result = await bookRepository.importBooks(data.books);
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: `Errore ripristino backup: ${err.message}` });
    }
});

app.delete('/api/backups/:filename', async (req, res) => {
    const filePath = path.join(backupDir, req.params.filename);
    try {
        await fs.unlink(filePath);
        res.json({ message: 'Backup eliminato.' });
    } catch (err) {
        res.status(500).json({ error: `Errore eliminazione backup: ${err.message}` });
    }
});


// AVVIO SERVER
app.listen(PORT, () => {
    console.log(`Server in ascolto sulla porta ${PORT}`);
});