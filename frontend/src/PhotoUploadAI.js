// catalogo-libri-app/frontend/src/PhotoUploadAI.js - VERSIONE FINALE CON TAILWIND CSS

import React, { useState, useRef, useCallback } from 'react';

function PhotoUploadAI({ onBookSaved, API_BASE_URL, setError }) {
  const [isDragging, setIsDragging] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResults, setAnalysisResults] = useState(null);
  const [editingBook, setEditingBook] = useState(null);
  const [saving, setSaving] = useState(false);
  const [analysisProgress, setAnalysisProgress] = useState(0);
  const [priceAnalysis, setPriceAnalysis] = useState(null);
  const [isSearchingPrice, setIsSearchingPrice] = useState(false);

  const fileInputRef = useRef(null);

  const inputClasses = "w-full p-2 border border-gray-400 rounded-md text-base box-border mb-2.5 bg-white";
  const labelClasses = "block mb-1.5 font-bold text-gray-700 text-sm";

  const processFiles = useCallback((files) => {
    if ((uploadedFiles.length + files.length) > 5) {
      setError('Massimo 5 foto per volta.');
      return;
    }
    const imageFiles = Array.from(files).filter(file => file.type.startsWith('image/'));
    const fileObjects = imageFiles.map(file => ({
      file,
      preview: URL.createObjectURL(file),
      name: file.name
    }));
    setUploadedFiles(prev => [...prev, ...fileObjects].slice(0, 5));
    setError(null);
  }, [uploadedFiles.length, setError]);

  const handleDragOver = useCallback((e) => { e.preventDefault(); setIsDragging(true); }, []);
  const handleDragLeave = useCallback(() => setIsDragging(false), []);
  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setIsDragging(false);
    processFiles(e.dataTransfer.files);
  }, [processFiles]);

  const handleFileSelect = useCallback((e) => {
    processFiles(e.target.files);
    e.target.value = null;
  }, [processFiles]);
  
  const handleRemoveFile = (indexToRemove) => {
      setUploadedFiles(prev => prev.filter((_, index) => index !== indexToRemove));
  };
  
  const handleAnalyzePhotos = async () => {
    if (uploadedFiles.length === 0) {
      setError('Seleziona almeno una foto da analizzare.');
      return;
    }
    setIsAnalyzing(true);
    setAnalysisProgress(0);
    setError(null);
    setAnalysisResults(null);
    setEditingBook(null);
    setPriceAnalysis(null);

    const formData = new FormData();
    uploadedFiles.forEach(f => formData.append('photos', f.file, f.name));

    const progressInterval = setInterval(() => {
        setAnalysisProgress(prev => Math.min(prev + 10, 90));
    }, 200);

    try {
        const response = await fetch(`${API_BASE_URL}/api/analyze-photo-ai`, { method: 'POST', body: formData });
        clearInterval(progressInterval);
        setAnalysisProgress(100);
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Errore durante l\'analisi delle foto.');
        }
        const data = await response.json();
        if (data.results && data.results.length > 0) {
            const aiBookData = data.results[0];
            setAnalysisResults(aiBookData);
            setEditingBook({ id: null, ...aiBookData, additionalCopies: [] });
        } else {
            throw new Error('Nessun risultato di analisi ottenuto dall\'AI.');
        }
    } catch (err) {
        clearInterval(progressInterval);
        setError(err.message);
    } finally {
        setIsAnalyzing(false);
    }
  };

  const handleCancel = () => {
    setUploadedFiles([]);
    setIsAnalyzing(false);
    setAnalysisResults(null);
    setEditingBook(null);
    setSaving(false);
    setAnalysisProgress(0);
    setPriceAnalysis(null);
    setIsSearchingPrice(false);
    setError(null);
  };
  
  const handleSaveBook = async () => {
    if (!editingBook || !editingBook.titolo || !editingBook.autore) {
      setError('Titolo e Autore sono campi obbligatori.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE_URL}/api/books`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingBook),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Errore durante il salvataggio del libro.');
      }
      const data = await response.json();
      alert(`Libro "${data.titolo}" salvato con successo!`);
      handleCancel();
      onBookSaved();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleEstimatePrice = async () => {
      if (!editingBook) return;
      setIsSearchingPrice(true);
      setPriceAnalysis(null);
      try {
          const response = await fetch(`${API_BASE_URL}/api/search-book-prices`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                  queries: [
                      editingBook.isbn ? `${editingBook.isbn} prezzo libro usato` : '',
                      editingBook.titolo && editingBook.autore ? `"${editingBook.titolo}" "${editingBook.autore}" prezzo libro` : ''
                  ].filter(Boolean),
                  bookData: editingBook,
              })
          });
          if (!response.ok) throw new Error('Ricerca online fallita');
          const data = await response.json();
          
          let algorithmicPrice = 8;
          if(editingBook.anno) {
              const age = new Date().getFullYear() - parseInt(editingBook.anno);
              if (age >= 30) algorithmicPrice += 4; else if (age >= 10) algorithmicPrice += 2;
          }

          const onlinePrices = data.prices || [];
          const analysis = { algorithmicPrice, onlinePrices, hasOnlineData: onlinePrices.length > 0 };

          if (analysis.hasOnlineData) {
              const avgPrice = onlinePrices.reduce((a, b) => a + b, 0) / onlinePrices.length;
              analysis.avgPrice = Math.round(avgPrice * 2) / 2;
              analysis.recommendedPrice = Math.round((avgPrice * 0.9) * 2) / 2;
              analysis.confidence = Math.min(90, 60 + onlinePrices.length * 5);
              analysis.dataSource = 'Online + Algoritmo';
          } else {
              analysis.recommendedPrice = algorithmicPrice;
              analysis.confidence = 65;
              analysis.dataSource = 'Solo Algoritmo';
          }
          setPriceAnalysis(analysis);
      } catch (error) {
          console.error('Errore nella valutazione prezzo:', error);
          setError('Errore durante la ricerca dei prezzi.');
      } finally {
          setIsSearchingPrice(false);
      }
  };

  const getPriceFactors = useCallback(() => {
    if (!editingBook) return [];
    const factors = [];
    if (editingBook.anno) {
        const age = new Date().getFullYear() - parseInt(editingBook.anno);
        if (age >= 30) factors.push(`Libro vintage (${age} anni)`);
    }
    const prestigious = ['mondadori', 'einaudi', 'bompiani', 'rizzoli', 'longanesi', 'feltrinelli', 'adelphi'];
    if (editingBook.editore && prestigious.some(p => editingBook.editore.toLowerCase().includes(p))) {
        factors.push(`Editore prestigioso`);
    }
    if (editingBook.condizioniLibro) {
        const conditions = editingBook.condizioniLibro.toLowerCase();
        if (conditions.includes('ottime') || conditions.includes('perfette')) factors.push('Ottime condizioni');
        else if (conditions.includes('buone')) factors.push('Buone condizioni');
    }
    return factors;
  }, [editingBook]);
  
  return (
    <div className="mb-10 bg-sky-50 p-5 rounded-lg shadow-md border border-sky-200">
      <h2 className="text-center text-xl font-bold text-slate-800 mb-6">+ Carica Nuovi Libri con AI</h2>
      
      {!editingBook && (
        <>
            <div onClick={() => fileInputRef.current.click()} onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop} className={`border-2 border-dashed rounded-lg p-8 text-center transition-all duration-300 ease-in-out mb-5 cursor-pointer ${isDragging ? 'border-blue-500 bg-blue-100' : 'border-sky-400 bg-sky-100 hover:bg-sky-200'}`}>
                <p className="text-gray-600">Trascina le foto qui, oppure clicca per selezionare (Max 5)</p>
                <input type="file" accept="image/*" multiple ref={fileInputRef} onChange={handleFileSelect} className="hidden" />
            </div>

            {uploadedFiles.length > 0 && (
                <div className="mb-5">
                    <div className="flex flex-wrap justify-center gap-3">
                        {uploadedFiles.map((file, index) => (
                            <div key={index} className="relative w-24 h-24 border border-gray-300 rounded-md overflow-hidden bg-gray-100 flex items-center justify-center">
                                <img src={file.preview} alt={file.name} className="max-w-full max-h-full object-contain" />
                                <button onClick={() => handleRemoveFile(index)} className="absolute top-1 right-1 bg-red-600 bg-opacity-80 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold leading-none hover:bg-red-700 transition-colors">&times;</button>
                            </div>
                        ))}
                    </div>
                    <div className="text-center mt-5">
                        <button onClick={handleAnalyzePhotos} disabled={isAnalyzing} className="py-2 px-5 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 disabled:bg-blue-300 disabled:cursor-wait transition-colors">
                            {isAnalyzing ? `Analizzando... (${analysisProgress}%)` : 'Analizza Foto con AI'}
                        </button>
                    </div>
                </div>
            )}
        </>
      )}
      
      {editingBook && (
        <div className="mt-4 p-4 md:p-6 border border-teal-300 rounded-lg bg-teal-50">
          <h3 className="text-center text-xl font-bold text-slate-800 mb-5">Dati Analizzati (modifica se necessario)</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div><label className={labelClasses}>Titolo:</label><input type="text" value={editingBook.titolo || ''} onChange={(e) => setEditingBook({ ...editingBook, titolo: e.target.value })} className={inputClasses} /></div>
            <div><label className={labelClasses}>Autore:</label><input type="text" value={editingBook.autore || ''} onChange={(e) => setEditingBook({ ...editingBook, autore: e.target.value })} className={inputClasses} /></div>
            <div><label className={labelClasses}>Editore:</label><input type="text" value={editingBook.editore || ''} onChange={(e) => setEditingBook({ ...editingBook, editore: e.target.value })} className={inputClasses} /></div>
            <div><label className={labelClasses}>Anno:</label><input type="text" value={editingBook.anno || ''} onChange={(e) => setEditingBook({ ...editingBook, anno: e.target.value })} className={inputClasses} /></div>
            <div><label className={labelClasses}>ISBN:</label><input type="text" value={editingBook.isbn || ''} onChange={(e) => setEditingBook({ ...editingBook, isbn: e.target.value })} className={inputClasses} /></div>
            <div>
              <label className={labelClasses}>Prezzo (€):</label>
              <input type="number" value={editingBook.prezzo || ''} onChange={(e) => setEditingBook({ ...editingBook, prezzo: e.target.value })} step="0.01" className={inputClasses} />
              <button onClick={handleEstimatePrice} disabled={isSearchingPrice} className="w-full mt-1 py-2 px-4 bg-orange-500 text-white rounded-md font-bold hover:bg-orange-600 disabled:bg-orange-300 text-sm">
                {isSearchingPrice ? 'Ricerca in corso...' : 'Analizza Prezzo di Mercato'}
              </button>
            </div>
             <div className="md:col-span-2"><label className={labelClasses}>Condizioni Libro (da AI):</label><textarea value={editingBook.condizioniLibro || ''} onChange={(e) => setEditingBook({ ...editingBook, condizioniLibro: e.target.value })} rows="3" className={`${inputClasses} resize-y`}></textarea></div>
             <div className="md:col-span-2"><label className={labelClasses}>Descrizione (da AI):</label><textarea value={editingBook.descrizione || ''} onChange={(e) => setEditingBook({ ...editingBook, descrizione: e.target.value })} rows="4" className={`${inputClasses} resize-y`}></textarea></div>
          </div>
          
          {priceAnalysis && (
            <div className="mt-4 p-4 bg-green-100 border-2 border-green-500 rounded-lg">
                <h4 className="text-center font-bold text-green-800">Analisi Prezzo Completa</h4>
                <div className="text-center text-sm text-gray-600 mb-3">{priceAnalysis.dataSource} &bull; Confidenza: {priceAnalysis.confidence}%</div>
                <div className="text-center p-3 bg-green-200 border-2 border-green-600 rounded-md mb-3">
                    <div className="text-lg font-bold text-green-900">🎯 Prezzo Raccomandato: €{priceAnalysis.recommendedPrice}</div>
                </div>
                {getPriceFactors().length > 0 && <div className="text-sm"><strong>Fattori:</strong> {getPriceFactors().join(', ')}</div>}
                <button onClick={() => setEditingBook(prev => ({ ...prev, prezzo: priceAnalysis.recommendedPrice }))} className="w-full mt-2 py-2 px-4 bg-green-600 text-white rounded-md font-bold hover:bg-green-700">✅ Applica Raccomandato</button>
            </div>
          )}
          
          <div className="flex justify-center gap-4 mt-8">
            <button onClick={handleSaveBook} disabled={saving || !editingBook.titolo || !editingBook.autore} className="py-3 px-6 bg-green-600 text-white rounded-lg font-bold hover:bg-green-700 disabled:bg-gray-400">
              {saving ? 'Salvando...' : 'Salva nel Catalogo'}
            </button>
            <button onClick={handleCancel} className="py-3 px-6 bg-red-500 text-white rounded-lg font-bold hover:bg-red-600">
              Annulla
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default PhotoUploadAI;