// catalogo-libri-app/frontend/src/App.js - VERSIONE FINALE CON TAILWIND CSS

import React, { useState, useEffect, useRef, useCallback } from 'react';
import PhotoUploadAI from './PhotoUploadAI';

function App() {
  // Stati principali
  const [allBooks, setAllBooks] = useState([]);
  const [filteredBooks, setFilteredBooks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Stati per ricerca e filtri
  const [searchTerm, setSearchTerm] = useState("");
  const [sortBy, setSortBy] = useState('timestamp');
  const [sortOrder, setSortOrder] = useState('desc');
  const [yearFilter, setYearFilter] = useState("");
  const [priceMin, setPriceMin] = useState("");
  const [priceMax, setPriceMax] = useState("");
  const [editorFilter, setEditorFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState("");
  const [showFilters, setShowFilters] = useState(false);

  // Stati per Export/Import
  const [showExportImport, setShowExportImport] = useState(false);
  const [stats, setStats] = useState(null);
  const [backups, setBackups] = useState([]);
  const [importStatus, setImportStatus] = useState(null);
  const [importing, setImporting] = useState(false);
  const importFileRef = useRef(null);
  const [exportFormat, setExportFormat] = useState('json');

  // Stati per modale modifica libro
  const [showEditModal, setShowEditModal] = useState(false);
  const [editedBook, setEditedBook] = useState(null);
  const [saving, setSaving] = useState(false);

  // Costanti
  const API_BASE_URL = 'http://localhost:3001';

  // Stili Comuni con Tailwind (per input)
  const inputClasses = "w-full p-2 border border-gray-300 rounded-md text-base box-border mb-2.5";
  const labelClasses = "block mb-1.5 font-bold text-gray-700";
  
  const fetchAllData = useCallback(() => {
    const fetchBooks = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`${API_BASE_URL}/api/books`);
        if (!response.ok) throw new Error('Errore durante il recupero dei libri.');
        const data = await response.json();
        setAllBooks(data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    const fetchStats = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/stats`);
        if (!response.ok) throw new Error('Errore recupero statistiche.');
        const data = await response.json();
        setStats(data);
      } catch (err) {
        console.error('Errore fetch stats:', err.message);
      }
    };

    const fetchBackups = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/backups`);
        if (!response.ok) throw new Error('Errore recupero backup.');
        const data = await response.json();
        setBackups(data);
      } catch (err) {
        console.error('Errore fetch backups:', err.message);
      }
    };

    fetchBooks();
    fetchStats();
    fetchBackups();
  }, [API_BASE_URL]);

  useEffect(() => {
    fetchAllData();
  }, [fetchAllData]);

  useEffect(() => {
    let tempBooks = [...allBooks];
    if (searchTerm) {
        const lowerCaseSearchTerm = searchTerm.toLowerCase();
        tempBooks = tempBooks.filter(book =>
            (book.titolo && book.titolo.toLowerCase().includes(lowerCaseSearchTerm)) ||
            (book.autore && book.autore.toLowerCase().includes(lowerCaseSearchTerm)) ||
            (book.isbn && book.isbn.toLowerCase().includes(lowerCaseSearchTerm)) ||
            (book.editore && book.editore.toLowerCase().includes(lowerCaseSearchTerm)) ||
            (book.descrizione && book.descrizione.toLowerCase().includes(lowerCaseSearchTerm)) ||
            (book.descrizioneAl && book.descrizioneAl.toLowerCase().includes(lowerCaseSearchTerm)) ||
            (book.condizioniLibro && book.condizioniLibro.toLowerCase().includes(lowerCaseSearchTerm)) ||
            (book.additionalCopies && book.additionalCopies.some(copy =>
                (copy.anno && String(copy.anno).toLowerCase().includes(lowerCaseSearchTerm)) ||
                (copy.prezzo && String(copy.prezzo).toLowerCase().includes(lowerCaseSearchTerm)) ||
                (copy.condizioniLibro && copy.condizioniLibro.toLowerCase().includes(lowerCaseSearchTerm))
            ))
        );
    }
    if (yearFilter) tempBooks = tempBooks.filter(book => book.anno === yearFilter);
    if (priceMin) tempBooks = tempBooks.filter(book => book.prezzo >= parseFloat(priceMin));
    if (priceMax) tempBooks = tempBooks.filter(book => book.prezzo <= parseFloat(priceMax));
    if (editorFilter) {
        const lowerCaseEditorFilter = editorFilter.toLowerCase();
        tempBooks = tempBooks.filter(book => book.editore && book.editore.toLowerCase().includes(lowerCaseEditorFilter));
    }
    if (categoryFilter) {
        const lowerCaseCategoryFilter = categoryFilter.toLowerCase();
        tempBooks = tempBooks.filter(book =>
            (book.categoria && book.categoria.toLowerCase().includes(lowerCaseCategoryFilter)) ||
            (book.sottocategoria1 && book.sottocategoria1.toLowerCase().includes(lowerCaseCategoryFilter)) ||
            (book.sottocategoria2 && book.sottocategoria2.toLowerCase().includes(lowerCaseCategoryFilter))
        );
    }
    tempBooks.sort((a, b) => {
        let valA, valB;
        switch (sortBy) {
            case 'titolo': valA = a.titolo?.toLowerCase() || ''; valB = b.titolo?.toLowerCase() || ''; break;
            case 'autore': valA = a.autore?.toLowerCase() || ''; valB = b.autore?.toLowerCase() || ''; break;
            case 'anno': valA = parseInt(a.anno || 0); valB = parseInt(b.anno || 0); break;
            case 'prezzo': valA = parseFloat(a.prezzo || 0); valB = parseFloat(b.prezzo || 0); break;
            case 'confidence': valA = parseFloat(a.confidence || 0); valB = parseFloat(b.confidence || 0); break;
            default: valA = new Date(a.timestamp); valB = new Date(b.timestamp); break;
        }
        if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
        if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
        return 0;
    });
    setFilteredBooks(tempBooks);
  }, [allBooks, searchTerm, sortBy, sortOrder, yearFilter, priceMin, priceMax, editorFilter, categoryFilter]);

  const handleEditBook = (book) => {
    setEditedBook({ ...book, additionalCopies: book.additionalCopies || [] });
    setShowEditModal(true);
  };

  const handleModalChange = (e) => {
    const { name, value } = e.target;
    setEditedBook(prev => ({ ...prev, [name]: value }));
  };

  const handleAddCopyModal = () => {
    setEditedBook(prev => ({
      ...prev,
      additionalCopies: [...(prev.additionalCopies || []), { anno: "", prezzo: "", condizioniLibro: "" }]
    }));
  };

  const handleRemoveCopyModal = (indexToRemove) => {
    setEditedBook(prev => ({
      ...prev,
      additionalCopies: prev.additionalCopies.filter((_, index) => index !== indexToRemove)
    }));
  };

  const handleCopyChangeModal = (index, field, value) => {
    setEditedBook(prev => {
      const newCopies = [...(prev.additionalCopies || [])];
      newCopies[index] = { ...newCopies[index], [field]: value };
      return { ...prev, additionalCopies: newCopies };
    });
  };

  const handleSaveEditedBook = async () => {
    if (!editedBook.titolo || !editedBook.autore) {
      setError('Titolo e Autore sono campi obbligatori.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE_URL}/api/books/${editedBook.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editedBook),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Errore durante l\'aggiornamento del libro.');
      }
      fetchAllData();
      setShowEditModal(false);
      setEditedBook(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteBook = async (id) => {
      if (!window.confirm('Sei sicuro di voler eliminare questo libro?')) return;
      setError(null);
      try {
          const response = await fetch(`${API_BASE_URL}/api/books/${id}`, { method: 'DELETE' });
          if (!response.ok) {
              const errorData = await response.json();
              throw new Error(errorData.error || 'Errore durante l\'eliminazione del libro.');
          }
          fetchAllData();
      } catch (err) {
          setError(err.message);
      }
  };

  const handleExport = async () => {
      setError(null);
      const endpoint = `${API_BASE_URL}/api/export-${exportFormat}`;
      try {
          const response = await fetch(endpoint);
          if (!response.ok) {
              const errorData = await response.json();
              throw new Error(errorData.error || `Errore durante l'esportazione in ${exportFormat.toUpperCase()}.`);
          }
          if (exportFormat === 'json') {
              const data = await response.json();
              alert(data.message);
              fetchAllData();
          } else {
              const blob = await response.blob();
              const url = window.URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              const contentDisposition = response.headers.get('Content-Disposition');
              const filenameMatch = contentDisposition && contentDisposition.match(/filename="([^"]+)"/);
              a.download = filenameMatch ? filenameMatch[1] : `catalogo_libri.${exportFormat}`;
              document.body.appendChild(a);
              a.click();
              a.remove();
              window.URL.revokeObjectURL(url);
              alert(`Dati esportati in ${exportFormat.toUpperCase()} con successo!`);
          }
      } catch (err) {
          setError(err.message);
      }
  };

  const handleImport = async (e) => {
      const file = e.target.files[0];
      if (!file) return;

      const formData = new FormData();
      formData.append('file', file);
      setImporting(true);
      setImportStatus(null);
      setError(null);
      try {
          const response = await fetch(`${API_BASE_URL}/api/import`, { method: 'POST', body: formData });
          if (!response.ok) {
              const errorData = await response.json();
              throw new Error(errorData.error || 'Errore durante l\'importazione dei dati.');
          }
          const data = await response.json();
          setImportStatus(data.message);
          fetchAllData();
      } catch (err) {
          setError(err.message);
          setImportStatus(null);
      } finally {
          setImporting(false);
          if (importFileRef.current) importFileRef.current.value = '';
      }
  };
  
  const handleDownloadBackup = (filename) => {
      window.open(`${API_BASE_URL}/api/backups/${filename}`, '_blank');
  };

  const handleRestoreBackup = async (filename) => {
      if (!window.confirm(`Sei sicuro di voler ripristinare il backup "${filename}"? TUTTI i dati attuali nel catalogo verranno SOSTITUITI.`)) return;
      setError(null);
      try {
          const response = await fetch(`${API_BASE_URL}/api/backups/${filename}/restore`, { method: 'POST' });
          if (!response.ok) {
              const errorData = await response.json();
              throw new Error(errorData.error || `Errore durante il ripristino del backup "${filename}".`);
          }
          const data = await response.json();
          alert(data.message);
          fetchAllData();
      } catch (err) {
          setError(err.message);
      }
  };

  const handleDeleteBackup = async (filename) => {
      if (!window.confirm(`Sei sicuro di voler eliminare il backup "${filename}"?`)) return;
      setError(null);
      try {
          const response = await fetch(`${API_BASE_URL}/api/backups/${filename}`, { method: 'DELETE' });
          if (!response.ok) {
              const errorData = await response.json();
              throw new Error(errorData.error || `Errore durante l'eliminazione del backup "${filename}".`);
          }
          const data = await response.json();
          alert(data.message);
          fetchAllData();
      } catch (err) {
          setError(err.message);
      }
  };

  const allUniqueCategoriesForFilter = Array.from(new Set(allBooks.flatMap(book => [book.categoria, book.sottocategoria1, book.sottocategoria2]).filter(Boolean))).sort();

  return (
    <div className="font-sans max-w-7xl mx-auto my-5 p-5 bg-gray-50">
      <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-200">
        <h1 className="text-center text-3xl font-bold text-slate-800 mb-8">Gestione Catalogo Libri</h1>
        {error && (
          <div className="bg-red-100 text-red-700 p-3 rounded-lg mb-6 border border-red-300 relative">
            <strong>Errore:</strong> {error}
            <button onClick={() => setError(null)} className="absolute top-2 right-3 bg-transparent border-none text-xl cursor-pointer text-red-700">&times;</button>
          </div>
        )}
        
        <PhotoUploadAI onBookSaved={fetchAllData} API_BASE_URL={API_BASE_URL} setError={setError} />
        
        <hr className="my-10 border-0 border-t border-dashed border-gray-300" />
        
        <div className="mb-7 bg-slate-100 p-5 rounded-lg border border-gray-200">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-slate-800 text-xl font-bold m-0">Ricerca e Filtri</h2>
            <button onClick={() => setShowFilters(!showFilters)} className="py-2 px-4 bg-slate-500 text-white border-none rounded-md cursor-pointer text-sm hover:bg-slate-600 transition-colors">
              {showFilters ? 'Nascondi Filtri' : 'Mostra Filtri'}
            </button>
          </div>
          <input type="text" placeholder="Cerca per titolo, autore, ISBN, editore, descrizione, condizioni..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full p-2.5 rounded-md border border-gray-300 text-base mb-4"/>
          {showFilters && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className={labelClasses}>Ordina per:</label>
                <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} className={`${inputClasses} mb-0`}>
                  <option value="timestamp">Data Aggiunta</option>
                  <option value="titolo">Titolo</option>
                  <option value="autore">Autore</option>
                  <option value="anno">Anno</option>
                  <option value="prezzo">Prezzo</option>
                  <option value="confidence">Confidenza Al</option>
                </select>
              </div>
              <div>
                <label className={labelClasses}>Ordine:</label>
                <select value={sortOrder} onChange={(e) => setSortOrder(e.target.value)} className={`${inputClasses} mb-0`}>
                  <option value="desc">Decrescente</option>
                  <option value="asc">Crescente</option>
                </select>
              </div>
              <div>
                <label className={labelClasses}>Filtra per Anno:</label>
                <input type="text" placeholder="E.g. 2023" value={yearFilter} onChange={(e) => setYearFilter(e.target.value)} className={`${inputClasses} mb-0`} />
              </div>
              <div>
                <label className={labelClasses}>Filtra per Editore:</label>
                <input type="text" placeholder="E.g. Mondadori" value={editorFilter} onChange={(e) => setEditorFilter(e.target.value)} className={`${inputClasses} mb-0`}/>
              </div>
              <div>
                <label className={labelClasses}>Prezzo Min:</label>
                <input type="number" placeholder="Min" value={priceMin} onChange={(e) => setPriceMin(e.target.value)} step="0.01" className={`${inputClasses} mb-0`} />
              </div>
              <div>
                <label className={labelClasses}>Prezzo Max:</label>
                <input type="number" placeholder="Max" value={priceMax} onChange={(e) => setPriceMax(e.target.value)} step="0.01" className={`${inputClasses} mb-0`} />
              </div>
              <div className="lg:col-span-2">
                <label className={labelClasses}>Filtra per Categoria:</label>
                <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} className={`${inputClasses} mb-0`}>
                  <option value="">Tutte le Categorie</option>
                  {allUniqueCategoriesForFilter.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                </select>
              </div>
            </div>
          )}
        </div>

        <h2 className="text-center text-2xl font-bold text-slate-800 mb-5">La Tua Libreria ({filteredBooks.length} libri)</h2>
        {loading ? <p className="text-center text-lg text-gray-500">Caricamento libri...</p> : filteredBooks.length === 0 ? <p className="text-center text-lg text-gray-500">Nessun libro trovato.</p> : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse mt-5 min-w-[1200px]">
              <thead>
                <tr className="bg-gray-100 border-b-2 border-gray-300">
                    {['Immagine', 'Titolo', 'Autore', 'Editore', 'Anno', 'Prezzo', 'Condizioni', 'Copie', 'Confidenza AI', 'Azioni'].map(header => (
                        <th key={header} className="p-3 text-left font-bold text-gray-600 whitespace-nowrap">{header}</th>
                    ))}
                </tr>
              </thead>
              <tbody>
                {filteredBooks.map(book => (
                  <tr key={book.id} className="border-b border-gray-200 hover:bg-gray-50">
                    <td className="p-2.5 align-top">
                      {book.imageUrls && book.imageUrls.length > 0 && <img src={`${API_BASE_URL}${book.imageUrls[0]}`} alt={book.titolo} className="w-16 h-auto rounded shadow" />}
                    </td>
                    <td className="p-2.5 align-top font-semibold">{book.titolo}</td>
                    <td className="p-2.5 align-top">{book.autore}</td>
                    <td className="p-2.5 align-top">{book.editore || 'N/D'}</td>
                    <td className="p-2.5 align-top text-center">{book.anno || 'N/D'}</td>
                    <td className="p-2.5 align-top whitespace-nowrap">{book.prezzo !== null ? `€ ${parseFloat(book.prezzo).toFixed(2).replace('.', ',')}` : 'N/D'}</td>
                    <td className="p-2.5 align-top" title={book.condizioniLibro || 'N/D'}>{book.condizioniLibro ? (book.condizioniLibro.length > 20 ? `${book.condizioniLibro.substring(0, 17)}...` : book.condizioniLibro) : 'N/D'}</td>
                    <td className="p-2.5 align-top text-center">{1 + (book.additionalCopies ? book.additionalCopies.length : 0)}</td>
                    <td className="p-2.5 align-top text-center">{book.confidence !== null ? `${book.confidence}%` : 'N/D'}</td>
                    <td className="p-2.5 align-top w-32">
                      <button onClick={() => handleEditBook(book)} className="py-1 px-2.5 bg-blue-500 text-white rounded-md cursor-pointer mr-1.5 text-sm hover:bg-blue-600">Modifica</button>
                      <button onClick={() => handleDeleteBook(book.id)} className="py-1 px-2.5 bg-red-500 text-white rounded-md cursor-pointer text-sm hover:bg-red-600">Elimina</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <hr className="my-10 border-0 border-t border-dashed border-gray-300" />

        <div className="mb-7 bg-green-50 p-5 rounded-lg border border-green-200">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-slate-800 text-xl font-bold m-0">Strumenti Dati</h2>
            <button onClick={() => setShowExportImport(!showExportImport)} className="py-2 px-4 bg-green-600 text-white border-none rounded-md cursor-pointer text-sm hover:bg-green-700 transition-colors">
              {showExportImport ? 'Nascondi Strumenti' : 'Mostra Strumenti'}
            </button>
          </div>
          {showExportImport && (
            <>
              <div className="mb-5 p-4 border border-dashed border-gray-300 rounded-lg bg-slate-100">
                <h3 className="mt-0 font-bold text-gray-700">Statistiche Catalogo:</h3>
                {stats ? (
                  <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-2.5 text-sm">
                    <div><strong>Libri totali:</strong> {stats.totalBooks}</div>
                    <div><strong>Autori unici:</strong> {stats.uniqueAuthors}</div>
                    <div><strong>Valore totale:</strong> € {stats.totalValue ? parseFloat(stats.totalValue).toFixed(2).replace('.', ',') : '0,00'}</div>
                    <div><strong>Ultimo aggiornamento:</strong> {stats.lastUpdated ? new Date(stats.lastUpdated).toLocaleString() : 'N/D'}</div>
                    <div><strong>Dimensione DB:</strong> {stats.dbSizeMB ? `${stats.dbSizeMB.toFixed(2)} MB` : 'N/D'}</div>
                  </div>
                ) : <p>Caricamento statistiche...</p>}
              </div>
              
              <div className="flex flex-col md:flex-row gap-5 mb-5">
                <div className="flex-1 p-4 border border-blue-200 rounded-lg bg-blue-50">
                  <h3 className="mt-0 font-bold text-gray-700">Esporta Catalogo</h3>
                  <p className="text-sm text-gray-600">Salva i dati del catalogo nel formato scelto.</p>
                  <div className="mb-2.5">
                      <label className="mr-2.5 font-bold text-gray-600">Formato:</label>
                      <select value={exportFormat} onChange={(e) => setExportFormat(e.target.value)} className="p-2 rounded-md border border-gray-300 bg-white">
                          <option value="json">JSON (con backup)</option>
                          <option value="csv">CSV</option>
                          <option value="xlsx">Excel (XLSX)</option>
                      </select>
                  </div>
                  <button onClick={handleExport} className="w-full py-2 px-4 bg-blue-500 hover:bg-blue-600 text-white rounded-md">Esporta in {exportFormat.toUpperCase()}</button>
                </div>

                <div className="flex-1 p-4 border border-orange-200 rounded-lg bg-orange-50">
                  <h3 className="mt-0 font-bold text-gray-700">Importa Catalogo</h3>
                  <p className="text-sm text-gray-600">Carica un file JSON per sovrascrivere il catalogo.</p>
                  <input type="file" accept=".json" ref={importFileRef} onChange={handleImport} className="w-full p-1.5 border border-gray-300 rounded-md mb-2.5 text-sm file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:bg-gray-200 hover:file:bg-gray-300"/>
                  {importStatus && <p className="mt-2.5 text-green-700 font-bold text-sm">{importStatus}</p>}
                </div>
              </div>

              <div className="p-4 border border-dashed border-purple-200 rounded-lg bg-purple-50">
                <h3 className="mt-0 font-bold text-gray-700">Gestione Backup JSON</h3>
                {backups && backups.length > 0 ? (
                  <ul className="list-none p-0">
                    {backups.map(filename => (
                      <li key={filename} className="flex justify-between items-center py-2 border-b border-dotted border-gray-300 last:border-b-0">
                        <span className="text-sm font-mono">{filename.replace('backup_catalogo_', '').replace('.json', '').replace(/-/g, '/').replace('T', ' ').substring(0, 19)}</span>
                        <div className="flex gap-2">
                          <button onClick={() => handleDownloadBackup(filename)} className="py-1 px-2 bg-green-500 text-white rounded text-xs hover:bg-green-600">Scarica</button>
                          <button onClick={() => handleRestoreBackup(filename)} className="py-1 px-2 bg-purple-600 text-white rounded text-xs hover:bg-purple-700">Ripristina</button>
                          <button onClick={() => handleDeleteBackup(filename)} className="py-1 px-2 bg-red-500 text-white rounded text-xs hover:bg-red-600">Elimina</button>
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : <p className="text-gray-600 text-sm">Nessun backup JSON trovato.</p>}
              </div>
            </>
          )}
        </div>

        {showEditModal && editedBook && (
          <div className="fixed inset-0 bg-black bg-opacity-60 flex justify-center items-center z-50 p-4">
            <div className="bg-white p-6 md:p-8 rounded-lg shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto relative">
              <button onClick={() => setShowEditModal(false)} className="absolute top-3 right-4 bg-transparent border-none text-3xl cursor-pointer text-gray-500 hover:text-gray-800">&times;</button>
              <h2 className="text-center text-2xl font-bold text-slate-800 mb-6">Modifica Libro</h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div><label className={labelClasses}>Titolo:</label><input type="text" name="titolo" value={editedBook.titolo || ""} onChange={handleModalChange} className={inputClasses} /></div>
                <div><label className={labelClasses}>Autore:</label><input type="text" name="autore" value={editedBook.autore || ""} onChange={handleModalChange} className={inputClasses} /></div>
                <div><label className={labelClasses}>Editore:</label><input type="text" name="editore" value={editedBook.editore || ""} onChange={handleModalChange} className={inputClasses} /></div>
                <div><label className={labelClasses}>Anno:</label><input type="text" name="anno" value={editedBook.anno || ""} onChange={handleModalChange} className={inputClasses} /></div>
                <div><label className={labelClasses}>ISBN:</label><input type="text" name="isbn" value={editedBook.isbn || ""} onChange={handleModalChange} className={inputClasses} /></div>
                <div><label className={labelClasses}>Prezzo (€):</label><input type="number" name="prezzo" value={editedBook.prezzo !== null ? editedBook.prezzo : ""} onChange={handleModalChange} step="0.01" className={inputClasses} /></div>
                <div><label className={labelClasses}>Lingua:</label><input type="text" name="lingua" value={editedBook.lingua || ''} onChange={handleModalChange} className={inputClasses} /></div>
                <div><label className={labelClasses}>Categoria:</label><input type="text" name="categoria" value={editedBook.categoria || ''} onChange={handleModalChange} className={inputClasses} /></div>
                <div><label className={labelClasses}>Sottocategoria 1:</label><input type="text" name="sottocategoria1" value={editedBook.sottocategoria1 || ""} onChange={handleModalChange} className={inputClasses} /></div>
                <div><label className={labelClasses}>Sottocategoria 2:</label><input type="text" name="sottocategoria2" value={editedBook.sottocategoria2 || ""} onChange={handleModalChange} className={inputClasses} /></div>
              </div>

              <div className="mt-4"><label className={labelClasses}>Condizioni Libro:</label><textarea name="condizioniLibro" value={editedBook.condizioniLibro || ""} onChange={handleModalChange} rows="3" className={`${inputClasses} resize-y`} placeholder="Descrizione delle condizioni del libro..."></textarea></div>
              <div className="mt-4"><label className={labelClasses}>Descrizione:</label><textarea name="descrizione" value={editedBook.descrizione || ""} onChange={handleModalChange} rows="4" className={`${inputClasses} resize-y`}></textarea></div>
              
              <div className="mt-8 pt-6 border-t border-dashed border-green-300">
                <h4 className="text-slate-800 text-lg font-bold mb-4">Copie Aggiuntive ({editedBook.additionalCopies.length})</h4>
                {editedBook.additionalCopies.map((copy, index) => (
                  <div key={index} className="border border-green-200 rounded-lg p-4 mb-4 bg-green-50 relative">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4">
                      <div><label className={labelClasses}>Anno Copia:</label><input type="text" value={copy.anno || ''} onChange={(e) => handleCopyChangeModal(index, 'anno', e.target.value)} className={inputClasses} placeholder="Anno" /></div>
                      <div><label className={labelClasses}>Prezzo Copia (€):</label><input type="number" value={copy.prezzo || ''} onChange={(e) => handleCopyChangeModal(index, 'prezzo', e.target.value)} step="0.01" className={inputClasses} placeholder="Prezzo" /></div>
                      <div className="col-span-1 md:col-span-2"><label className={labelClasses}>Condizioni Copia:</label><textarea value={copy.condizioniLibro || ''} onChange={(e) => handleCopyChangeModal(index, 'condizioniLibro', e.target.value)} rows="2" className={`${inputClasses} resize-y mb-0`} placeholder="Condizioni specifiche..."></textarea></div>
                    </div>
                    <button onClick={() => handleRemoveCopyModal(index)} className="absolute top-2 right-2 py-1 px-2.5 bg-red-500 text-white rounded-md text-xs hover:bg-red-600">Rimuovi</button>
                  </div>
                ))}
                <button onClick={handleAddCopyModal} className="block mx-auto mt-4 py-2 px-4 bg-blue-500 text-white rounded-md hover:bg-blue-600">+ Aggiungi Copia</button>
              </div>
              
              <div className="mt-6 text-center">
                <button onClick={handleSaveEditedBook} disabled={saving || !editedBook.titolo || !editedBook.autore} className="py-3 px-6 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 font-bold">
                  {saving ? 'Salvando...' : 'Salva Modifiche'}
                </button>
              </div>

              <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200 text-sm text-blue-800">
                <div className="font-bold mb-2">Informazioni Aggiuntive</div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1">
                  <div><strong>ID:</strong> {editedBook.id}</div>
                  <div><strong>Aggiunto il:</strong> {editedBook.timestamp ? new Date(editedBook.timestamp).toLocaleString() : 'N/D'}</div>
                  <div><strong>Confidenza AI:</strong> {editedBook.confidence !== null ? `${editedBook.confidence}%` : 'N/D'}</div>
                  <div><strong>Immagini:</strong> {(editedBook.imageUrls || []).length}</div>
                  <div className="sm:col-span-2"><strong>Descrizione AI (Originale):</strong> {editedBook.descrizioneAl || 'N/D'}</div>
                  <div className="sm:col-span-2"><strong>Categorie AI (Originali):</strong> {editedBook.categoriesAl && editedBook.categoriesAl.length > 0 ? editedBook.categoriesAl.join(', ') : 'N/D'}</div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;