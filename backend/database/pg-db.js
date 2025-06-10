// catalogo-libri-app/backend/database/pg-db.js
// Questo modulo gestirà la connessione e l'inizializzazione del database PostgreSQL.
// NOTA: Dovrai configurare le tue credenziali di PostgreSQL nel file .env
// e definire la logica di creazione delle tabelle per PostgreSQL.

const { Pool } = require('pg');

let pool;

async function connectDb() {
    // Le credenziali dovrebbero venire da variabili d'ambiente (.env)
    pool = new Pool({
        user: process.env.PG_USER || 'your_pg_user',
        host: process.env.PG_HOST || 'localhost',
        database: process.env.PG_DATABASE || 'books_db',
        password: process.env.PG_PASSWORD || 'your_pg_password',
        port: process.env.PG_PORT || 5432,
    });

    pool.on('error', (err) => {
        console.error('Errore inatteso sul client PostgreSQL:', err);
        process.exit(1); // Termina il processo in caso di errore grave del pool
    });

    try {
        await pool.query('SELECT NOW()'); // Test della connessione
        console.log('Connesso al database PostgreSQL.');
    } catch (err) {
        console.error('Errore connessione a PostgreSQL:', err.message);
        throw err;
    }
    return pool;
}

async function initializeDb() {
    if (!pool) {
        throw new Error('PostgreSQL Pool non connesso. Chiamare connectDb prima di initializeDb.');
    }

    // --- Logica di creazione e aggiornamento dello schema per PostgreSQL ---
    // Questa parte è CRUCIALE per la migrazione. Dovrai definire lo schema
    // di PostgreSQL qui, usando tipi come JSONB per i tuoi campi JSON.
    // Esempio:
    const createTableQuery = `
        CREATE TABLE IF NOT EXISTS books (
            id SERIAL PRIMARY KEY,
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
            -- In PostgreSQL, puoi usare JSONB per i dati strutturati
            imageUrls JSONB, 
            timestamp TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
            confidence REAL,
            descrizioneAI TEXT,
            categoriesAI JSONB, -- Anche qui JSONB
            condizioniLibro TEXT,
            additionalCopies JSONB -- E qui
        );
    `;
    try {
        await pool.query(createTableQuery);
        console.log('Tabella "books" (PostgreSQL) pronta.');

        // Logica per ALTER TABLE se necessario (per aggiungere colonne esistenti)
        // A differenza di SQLite, PostgreSQL ha un supporto più robusto per ALTER TABLE
        // ma per nuove installazioni, CREATE TABLE è sufficiente se lo schema è completo.
        // Per aggiornamenti successivi, useresti "migrations" con uno strumento come `node-pg-migrate`.

        // Esempio di aggiunta di una colonna se non esiste (manuale, per dimostrazione)
        // const addColumnQuery = 'ALTER TABLE books ADD COLUMN IF NOT EXISTS newColumn TEXT;';
        // await pool.query(addColumnQuery);
        // console.log('Colonna newColumn aggiunta (se mancante).');

        // Quando farai la migrazione, ti serviranno credenziali reali in .env per PG
        // PG_USER=tuo_utente
        // PG_HOST=tuo_host_db
        // PG_DATABASE=tuo_db_name
        // PG_PASSWORD=tua_password
        // PG_PORT=5432
    } catch (err) {
        console.error('Errore inizializzazione schema PostgreSQL:', err.message);
        throw err;
    }
}

function getDbInstance() {
    if (!pool) {
        throw new Error('PostgreSQL Pool non connesso. Chiamare connectDb prima.');
    }
    return pool;
}

module.exports = {
    connectDb,
    initializeDb,
    getDbInstance
};