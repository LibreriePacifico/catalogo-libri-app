// catalogo-libri-app/backend/database/book-repository.js
// Questo modulo definisce le operazioni di accesso ai dati per i libri,
// ora compatibile sia con SQLite che con PostgreSQL, con gestione JSON migliorata.
let dbInstance;
let isPostgres = false; // Flag per determinare il tipo di database

/**
 * Imposta l'istanza del database da utilizzare per le operazioni del repository.
 * E determina se l'istanza è per PostgreSQL.
 * @param {object} db - L'istanza del database connesso (sqlite3.Database o pg.Pool).
 */
function setDbInstance(db) {
    dbInstance = db;
    isPostgres = (typeof dbInstance.query === 'function' && typeof dbInstance.run !== 'function');
    console.log(`Repository configurato per: ${isPostgres ? 'PostgreSQL' : 'SQLite'}`);
}

// ===============================================
// FUNZIONI WRAPPER ASINCRONE (AGNOSTICHE AL DB)
// ===============================================

async function runAsync(sql, params) {
    if (!dbInstance) {
        console.error('Errore: dbInstance non impostato in runAsync!');
        throw new Error('Database instance not set in runAsync.');
    }
    try {
        if (isPostgres) {
            const result = await dbInstance.query(sql, params);
            return { id: result.rows && result.rows[0] ? result.rows[0].id : undefined, changes: result.rowCount };
        } else {
            return new Promise((resolve, reject) => {
                dbInstance.run(sql, params, function (err) {
                    if (err) reject(err);
                    else resolve({ id: this.lastID, changes: this.changes });
                });
            });
        }
    } catch (err) {
        console.error('Errore runAsync:', err.message, 'SQL:', sql, 'Params:', params);
        throw err;
    }
}

async function allAsync(sql, params) {
    if (!dbInstance) {
        console.error('Errore: dbInstance non impostato in allAsync!');
        throw new Error('Database instance not set in allAsync.');
    }
    try {
        if (isPostgres) {
            const result = await dbInstance.query(sql, params);
            return result.rows;
        } else {
            return new Promise((resolve, reject) => {
                dbInstance.all(sql, params, (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows);
                });
            });
        }
    } catch (err) {
        console.error('Errore allAsync:', err.message, 'SQL:', sql, 'Params:', params);
        throw err;
    }
}

async function getAsync(sql, params) {
    if (!dbInstance) {
        console.error('Errore: dbInstance non impostato in getAsync!');
        throw new Error('Database instance not set in getAsync.');
    }
    try {
        if (isPostgres) {
            const result = await dbInstance.query(sql, params);
            return result.rows[0];
        } else {
            return new Promise((resolve, reject) => {
                dbInstance.get(sql, params, (err, row) => {
                    if (err) reject(err);
                    else resolve(row);
                });
            });
        }
    } catch (err) {
        console.error('Errore getAsync:', err.message, 'SQL:', sql, 'Params:', params);
        throw err;
    }
}

// ===============================================
// OPERAZIONI CRUD SUI LIBRI (AGNOSTICHE AL DB SOTTOSTANTE)
// ===============================================

async function getAllBooks() {
    const rows = await allAsync("SELECT id, titolo, autore, editore, anno, isbn, prezzo, lingua, descrizione, categoria, sottocategoria1, sottocategoria2, imageUrls, timestamp, confidence, descrizioneAI, categoriesAI, condizioniLibro, additionalCopies FROM books ORDER BY timestamp DESC");
    
    return rows.map(row => {
        // Inizializza un nuovo oggetto con i campi in camelCase.
        // Prendi i dati dai nomi delle colonne sia minuscoli (PostgreSQL) che camelCase (SQLite/fallback).
        const book = {
            id: row.id,
            titolo: row.titolo,
            autore: row.autore,
            editore: row.editore || row.editore || null, 
            anno: row.anno || null,
            isbn: row.isbn || null,
            prezzo: row.prezzo || null,
            lingua: row.lingua || null,
            descrizione: row.descrizione || null,
            categoria: row.categoria || null,
            sottocategoria1: row.sottocategoria1 || row.sottocategoria1 || null, 
            sottocategoria2: row.sottocategoria2 || row.sottocategoria2 || null, 
            timestamp: row.timestamp || null,
            confidence: row.confidence || null,
            descrizioneAI: row.descrizioneai || row.descrizioneAI || null, // PostgreSQL: descrizioneai
            condizioniLibro: row.condizionilibro || row.condizioniLibro || null, // PostgreSQL: condizionilibro
        };

        // Gestione robusta del parsing/accesso a JSONB/TEXT per i campi array
        // Dobbiamo prendere i valori RAW dal row object, che saranno minuscoli per PG
        let imageUrls = [];
        try {
            const rawImageUrls = isPostgres ? row.imageurls : row.imageUrls; 
            imageUrls = (isPostgres && typeof rawImageUrls === 'object' && rawImageUrls !== null) 
                        ? rawImageUrls 
                        : (rawImageUrls ? JSON.parse(rawImageUrls) : []);
            imageUrls = Array.isArray(imageUrls) ? imageUrls.filter(url => typeof url === 'string' && url.trim().length > 0) : [];
        } catch (e) {
            console.warn(`Errore parsing imageUrls per libro ID ${row.id}:`, e.message, `Valore: "${isPostgres ? row.imageurls : row.imageUrls}"`);
            imageUrls = [];
        }

        let categoriesAI = [];
        try {
            const rawCategoriesAI = isPostgres ? row.categoriesai : row.categoriesAI; 
            categoriesAI = (isPostgres && typeof rawCategoriesAI === 'object' && rawCategoriesAI !== null) 
                           ? rawCategoriesAI 
                           : (rawCategoriesAI ? JSON.parse(rawCategoriesAI) : []);
            categoriesAI = Array.isArray(categoriesAI) ? categoriesAI.filter(cat => typeof cat === 'string' && cat.trim().length > 0) : [];
        } catch (e) {
            console.warn(`Errore parsing categoriesAI per libro ID ${row.id}:`, e.message, `Valore: "${isPostgres ? row.categoriesai : row.categoriesAI}"`);
            categoriesAI = [];
        }

        let additionalCopies = [];
        try {
            const rawAdditionalCopies = isPostgres ? row.additionalcopies : row.additionalCopies; 
            additionalCopies = (isPostgres && typeof rawAdditionalCopies === 'object' && rawAdditionalCopies !== null) 
                               ? rawAdditionalCopies 
                               : (rawAdditionalCopies ? JSON.parse(rawAdditionalCopies) : []);
            additionalCopies = Array.isArray(additionalCopies) ? additionalCopies.filter(copy => 
                typeof copy === 'object' && copy !== null && 
                ('anno' in copy || 'prezzo' in copy || 'condizioniLibro' in copy)
            ) : [];
        } catch (e) {
            console.warn(`Errore parsing additionalCopies per libro ID ${row.id}:`, e.message, `Valore: "${isPostgres ? row.additionalcopies : row.additionalCopies}"`);
            additionalCopies = [];
        }
        
        book.imageUrls = imageUrls;
        book.categoriesAI = categoriesAI;
        book.additionalCopies = additionalCopies;

        return book; // Restituisci l'oggetto libro con i campi camelCase corretti
    });
}

async function addBook(bookData) {
    const {
        titolo, autore, editore, anno, isbn, prezzo, lingua, descrizione, categoria,
        sottocategoria1, sottocategoria2,
        imageUrls, confidence, descrizioneAI, categoriesAI,
        condizioniLibro, additionalCopies
    } = bookData;

    // SERIALIZZAZIONE ESPLICITA A STRINGA JSON PER TUTTI I TIPI DI DB
    const imageUrlsParam = JSON.stringify(imageUrls || []);
    const categoriesAIParam = JSON.stringify(categoriesAI || []);
    const additionalCopiesParam = JSON.stringify(additionalCopies || []);

    const sql = `INSERT INTO books (titolo, autore, editore, anno, isbn, prezzo, lingua, descrizione, categoria, sottocategoria1, sottocategoria2, imageUrls, timestamp, confidence, descrizioneAI, categoriesAI, condizioniLibro, additionalCopies)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)${isPostgres ? ' RETURNING id' : ''}`;
    const params = [
        titolo, autore, editore, anno, isbn,
        prezzo != null ? parseFloat(prezzo) : null,
        lingua, descrizione, categoria,
        sottocategoria1, sottocategoria2,
        imageUrlsParam,
        new Date().toISOString(),
        confidence, descrizioneAI, categoriesAIParam,
        condizioniLibro,
        additionalCopiesParam
    ];

    if (params.length !== 18) {
        console.error("ERRORE CRITICO: Parametri INSERT mismatch. Previsti 18, trovati:", params.length);
        throw new Error("Errore interno: mismatch parametri DB per addBook.");
    }

    const result = await runAsync(sql, params);
    return { 
        id: isPostgres && result.id !== undefined ? result.id : result.id, 
        ...bookData, 
        timestamp: new Date().toISOString(),
        imageUrls: imageUrls || [], // I valori originali (non stringificati)
        categoriesAI: categoriesAI || [],
        additionalCopies: additionalCopies || []
    };
}

async function updateBook(id, bookData) {
    const {
        titolo, autore, editore, anno, isbn, prezzo, lingua, descrizione, categoria,
        sottocategoria1, sottocategoria2,
        imageUrls, confidence, descrizioneAI, categoriesAI,
        condizioniLibro, additionalCopies
    } = bookData;

    const imageUrlsParam = JSON.stringify(imageUrls || []);
    const categoriesAIParam = JSON.stringify(categoriesAI || []);
    const additionalCopiesParam = JSON.stringify(additionalCopies || []);

    const sql = `UPDATE books SET
                    titolo = $1,
                    autore = $2,
                    editore = $3,
                    anno = $4,
                    isbn = $5,
                    prezzo = $6,
                    lingua = $7,
                    descrizione = $8,
                    categoria = $9,
                    sottocategoria1 = $10,
                    sottocategoria2 = $11,
                    imageUrls = $12,
                    confidence = $13,
                    descrizioneAI = $14,
                    categoriesAI = $15,
                    condizioniLibro = $16,
                    additionalCopies = $17
                 WHERE id = $18`;
    const params = [
        titolo, autore, editore, anno, isbn,
        prezzo != null ? parseFloat(prezzo) : null,
        lingua, descrizione, categoria,
        sottocategoria1, sottocategoria2,
        imageUrlsParam,
        confidence, descrizioneAI, categoriesAIParam,
        condizioniLibro,
        additionalCopiesParam,
        parseInt(id)
    ];
    const result = await runAsync(sql, params);
    if (result.changes === 0) {
        throw new Error('Libro non trovato.');
    }
    return { 
        message: 'Libro aggiornato con successo.', 
        ...bookData, 
        id: parseInt(id),
        imageUrls: imageUrls || [],
        categoriesAI: categoriesAI || [],
        additionalCopies: additionalCopies || []
    };
}

async function deleteBook(id) {
    const result = await runAsync('DELETE FROM books WHERE id = $1', [parseInt(id)]);
    if (result.changes === 0) {
        throw new Error('Libro non trovato.');
    }
    return { message: 'Libro eliminato con successo.' };
}

// ===============================================
// OPERAZIONI SPECIFICHE PER IMPORT/EXPORT E STATISTICHE
// ===============================================

async function importBooks(booksToImport) {
    if (isPostgres) {
        const client = await dbInstance.connect();
        try {
            await client.query('BEGIN');
            await client.query("DELETE FROM books");
            console.log('Tabella "books" (PostgreSQL) svuotata per importazione.');

            for (const book of booksToImport) {
                const imageUrlsParam = JSON.stringify(book.imageUrls || []);
                const categoriesAIParam = JSON.stringify(book.categoriesAI || []);
                const additionalCopiesParam = JSON.stringify(book.additionalCopies || []);

                const sql = `INSERT INTO books (titolo, autore, editore, anno, isbn, prezzo, lingua, descrizione, categoria, sottocategoria1, sottocategoria2, imageUrls, timestamp, confidence, descrizioneAI, categoriesAI, condizioniLibro, additionalCopies)
                             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)`;
                const params = [
                    book.titolo, book.autore, book.editore, book.anno, book.isbn,
                    book.prezzo != null ? parseFloat(book.prezzo) : null,
                    book.lingua, book.descrizione,
                    book.categoria, book.sottocategoria1, book.sottocategoria2,
                    imageUrlsParam,
                    book.timestamp || new Date().toISOString(),
                    book.confidence || 0,
                    book.descrizioneAI || '',
                    categoriesAIParam,
                    book.condizioniLibro || '',
                    additionalCopiesParam
                ];
                await client.query(sql, params);
            }
            await client.query('COMMIT');
            console.log(`Importazione completata in PostgreSQL. ${booksToImport.length} libri importati.`);
            return { message: `Importazione completata. ${booksToImport.length} libri importati.` };
        } catch (err) {
            await client.query('ROLLBACK');
            console.error('Errore importazione PostgreSQL con transazione:', err.message);
            throw err;
        } finally {
            client.release();
        }
    } else {
        return new Promise((resolve, reject) => {
            dbInstance.serialize(() => { 
                dbInstance.run("BEGIN TRANSACTION;", (err) => {
                    if (err) {
                        console.error('Errore BEGIN TRANSACTION per import (SQLite):', err.message);
                        return reject(err);
                    }
                });

                dbInstance.run("DELETE FROM books", (err) => {
                    if (err) {
                        console.error('Errore DELETE FROM books per import (SQLite):', err.message);
                        dbInstance.run("ROLLBACK;");
                        return reject(err);
                    }

                    const stmt = dbInstance.prepare(`
                        INSERT INTO books (titolo, autore, editore, anno, isbn, prezzo, lingua, descrizione, categoria, sottocategoria1, sottocategoria2, imageUrls, timestamp, confidence, descrizioneAI, categoriesAI, condizioniLibro, additionalCopies)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    `);
                    booksToImport.forEach(book => {
                        const imageUrlsJSON = JSON.stringify(book.imageUrls || []);
                        const categoriesAIJSON = JSON.stringify(book.categoriesAI || []);
                        const additionalCopiesJSON = JSON.stringify(book.additionalCopies || []);

                        const params = [
                            book.titolo, book.autore, book.editore, book.anno, book.isbn,
                            book.prezzo != null ? parseFloat(book.prezzo) : null,
                            book.lingua, book.descrizione,
                            book.categoria, book.sottocategoria1, book.sottocategoria2,
                            imageUrlsJSON,
                            book.timestamp || new Date().toISOString(),
                            book.confidence || 0,
                            book.descrizioneAI || '',
                            categoriesAIJSON,
                            book.condizioniLibro || '',
                            additionalCopiesJSON
                        ];
                        if (params.length !== 18) {
                            console.error("ERRORE CRITICO: Parametri INSERT per import mismatch (SQLite). Previsti 18, trovati:", params.length, "Libro:", book.titolo);
                            dbInstance.run("ROLLBACK;");
                            return reject(new Error("Errore interno: mismatch parametri DB per importBooks (SQLite)."));
                        }
                        stmt.run(...params);
                    });
                    stmt.finalize();

                    dbInstance.run("COMMIT;", (err) => {
                        if (err) {
                            console.error('Errore COMMIT per import (SQLite):', err.message);
                            return reject(err);
                        }
                        resolve({ message: `Importazione completata. ${booksToImport.length} libri importati.` });
                    });
                });
            });
        });
    }
}

// Operazioni per Statistiche
async function getTotalBooks() {
    if (isPostgres) {
        const row = await getAsync("SELECT COUNT(*) as count FROM books");
        return parseInt(row.count);
    } else {
        const row = await getAsync("SELECT COUNT(*) as totalBooks FROM books");
        return row.totalBooks;
    }
}

async function getLastUpdated() {
    if (isPostgres) {
        const row = await getAsync("SELECT MAX(timestamp) as max FROM books");
        return row.max;
    } else {
        const row = await getAsync("SELECT MAX(timestamp) as lastUpdated FROM books");
        return row.lastUpdated;
    }
}

async function getUniqueAuthors() {
    if (isPostgres) {
        const authors = await allAsync("SELECT DISTINCT autore FROM books WHERE autore IS NOT NULL");
        return authors.length;
    } else {
        const authors = await allAsync("SELECT DISTINCT autore FROM books WHERE autore IS NOT NULL");
        return authors.length;
    }
}

async function getTotalCatalogValue() {
    if (isPostgres) {
        const row = await getAsync("SELECT SUM(prezzo) as sum FROM books WHERE prezzo IS NOT NULL");
        return parseFloat(row.sum) || 0;
    } else {
        const row = await getAsync("SELECT SUM(prezzo) as totalValue FROM books WHERE prezzo IS NOT NULL");
        return row.totalValue || 0;
    }
}


module.exports = {
    setDbInstance,
    getAllBooks,
    addBook,
    updateBook,
    deleteBook,
    importBooks,
    getTotalBooks,
    getLastUpdated,
    getUniqueAuthors,
    getTotalCatalogValue
};