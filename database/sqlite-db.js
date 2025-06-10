// catalogo-libri-app/backend/database/sqlite-db.js
// Questo modulo gestisce la connessione e l'inizializzazione del database SQLite.
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs').promises;

let db; // Variabile per l'istanza del database SQLite

/**
 * Stabilisce la connessione al database SQLite.
 * @param {string} dbPathRelative - Percorso relativo del file del database dalla directory backend.
 * @returns {Promise<sqlite3.Database>} Una Promise che si risolve con l'istanza del database.
 */
async function connectDb(dbPathRelative) {
    // Percorso completo al file del database (rispetto alla root del progetto backend)
    const absoluteDbPath = path.join(__dirname, '..', dbPathRelative); 

    return new Promise((resolve, reject) => {
        db = new sqlite3.Database(absoluteDbPath, (err) => {
            if (err) {
                console.error('Errore connessione database:', err.message);
                reject(err);
            } else {
                console.log('Connesso al database SQLite:', absoluteDbPath);
                resolve(db);
            }
        });
    });
}

/**
 * Inizializza lo schema del database (crea la tabella 'books' se non esiste e la aggiorna).
 * @returns {Promise<void>} Una Promise che si risolve quando lo schema è pronto.
 */
async function initializeDb() {
    if (!db) {
        throw new Error('Database non connesso. Chiamare connectDb prima di initializeDb.');
    }

    return new Promise((resolve, reject) => {
        db.run(`
            CREATE TABLE IF NOT EXISTS books (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                titolo TEXT NOT NULL,
                autore TEXT NOT NULL,
                editore TEXT,
                anno TEXT,
                isbn TEXT,
                prezzo REAL,
                lingua TEXT,
                descrizione TEXT,
                categoria TEXT,
                sottocategoria1 TEXT,
                sottocategoria2 TEXT,
                imageUrls TEXT,
                timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
                confidence REAL,
                descrizioneAI TEXT,
                categoriesAI TEXT,
                condizioniLibro TEXT,
                additionalCopies TEXT
            )
        `, (createErr) => {
            if (createErr) {
                console.error('Errore creazione tabella:', createErr.message);
                reject(createErr); // Rigetta la Promise in caso di errore critico
            } else {
                console.log('Tabella "books" pronta.');
                // Aggiornamento dello schema per tabelle esistenti (aggiunta di nuove colonne)
                db.all("PRAGMA table_info(books)", (err, columns) => {
                    if (err) {
                        console.error('Errore nel recupero info tabella (PRAGMA table_info):', err.message);
                        reject(err);
                        return;
                    }
                    if (!columns || !Array.isArray(columns)) {
                        console.warn('PRAGMA table_info non ha restituito colonne valide. Skippo l\'aggiornamento dello schema.');
                        resolve();
                        return;
                    }
                    const columnNames = columns.map(col => col.name);
                    const alterTableQueries = [];

                    // Definisci le colonne richieste e i loro tipi per l'ALTER TABLE
                    const requiredColumns = [
                        { name: 'confidence', type: 'REAL' }, 
                        { name: 'descrizioneAI', type: 'TEXT' }, 
                        { name: 'categoriesAI', type: 'TEXT' }, 
                        { name: 'sottocategoria1', type: 'TEXT' },
                        { name: 'sottocategoria2', type: 'TEXT' }, 
                        { name: 'condizioniLibro', type: 'TEXT' }, 
                        { name: 'additionalCopies', type: 'TEXT' }
                    ];

                    requiredColumns.forEach(col => {
                        if (!columnNames.includes(col.name)) {
                            alterTableQueries.push(`ALTER TABLE books ADD COLUMN ${col.name} ${col.type}`);
                        }
                    });

                    if (alterTableQueries.length > 0) {
                        console.log('Aggiornamento schema database...');
                        let queriesCompleted = 0;
                        alterTableQueries.forEach(query => {
                            db.run(query, (alterErr) => {
                                if (alterErr) {
                                    console.error(`Errore ALTER TABLE (${query}):`, alterErr.message);
                                    // Non rigettare immediatamente, proviamo a completare tutte le query ALTER
                                } else {
                                    console.log(`Schema aggiornato: ${query}`);
                                }
                                queriesCompleted++;
                                if (queriesCompleted === alterTableQueries.length) {
                                    resolve(); // Risolve la Promise solo dopo che tutte le ALTER sono state tentate
                                }
                            });
                        });
                    } else {
                        console.log('Schema "books" già aggiornato, nessuna modifica necessaria.');
                        resolve(); // Risolve immediatamente se non ci sono ALTER
                    }
                });
            }
        });
    });
}

/**
 * Restituisce l'istanza del database connesso.
 * @returns {sqlite3.Database} L'istanza del database.
 * @throws {Error} Se il database non è stato ancora connesso.
 */
function getDbInstance() {
    if (!db) {
        throw new Error('Database non connesso. Chiamare connectDb prima.');
    }
    return db;
}

module.exports = {
    connectDb,
    initializeDb,
    getDbInstance
};