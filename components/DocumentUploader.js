import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

export default function DocumentUploader({ recordTable, recordId }) {
  const [docs, setDocs] = useState([]);
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [docType, setDocType] = useState('');
  const [expiryDate, setExpiryDate] = useState('');

  useEffect(() => {
    loadDocs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recordId]);

  async function loadDocs() {
    const { data } = await supabase
      .from('documents')
      .select('*')
      .eq('record_table', recordTable)
      .eq('record_id', recordId)
      .order('created_at', { ascending: false });
    setDocs(data || []);
  }

  async function handleFiles(files) {
    if (!files || files.length === 0) return;
    if (!docType.trim()) {
      alert('Please enter a document type (e.g. Insurance, License) before uploading.');
      return;
    }

    const file = files[0];
    setUploading(true);

    const path = `${recordTable}/${recordId}/${Date.now()}_${file.name}`;
    const { error: uploadError } = await supabase.storage.from('documents').upload(path, file);

    if (uploadError) {
      alert('Upload failed: ' + uploadError.message);
      setUploading(false);
      return;
    }

    const { data: urlData } = supabase.storage.from('documents').getPublicUrl(path);
    const { data: { session } } = await supabase.auth.getSession();

    const { error: insertError } = await supabase.from('documents').insert({
      record_table: recordTable,
      record_id: recordId,
      doc_type: docType.trim(),
      file_url: urlData.publicUrl,
      expiry_date: expiryDate || null,
      uploaded_by: session?.user?.id || null,
    });

    setUploading(false);

    if (insertError) {
      alert('Could not save document record: ' + insertError.message);
      return;
    }

    setDocType('');
    setExpiryDate('');
    loadDocs();
  }

  function expiryStatus(expiry_date) {
    if (!expiry_date) return null;
    const days = Math.ceil((new Date(expiry_date) - new Date()) / (1000 * 60 * 60 * 24));
    if (days < 0) return { label: 'expired', className: 'pill-danger' };
    if (days <= 30) return { label: `${days} days left`, className: 'pill-warning' };
    return { label: 'valid', className: 'pill-success' };
  }

  const inputId = `file-input-${recordTable}-${recordId}`;

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
        <input
          type="text"
          placeholder="Document type (e.g. Insurance)"
          value={docType}
          onChange={(e) => setDocType(e.target.value)}
          style={{ flex: 1, minWidth: 160 }}
        />
        <input
          type="date"
          value={expiryDate}
          onChange={(e) => setExpiryDate(e.target.value)}
        />
      </div>

      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => { e.preventDefault(); setDragOver(false); handleFiles(e.dataTransfer.files); }}
        onClick={() => document.getElementById(inputId).click()}
        style={{
          border: `1px dashed ${dragOver ? '#1a56db' : '#ccc'}`,
          borderRadius: 8,
          padding: 16,
          textAlign: 'center',
          cursor: 'pointer',
          background: dragOver ? '#f0f5ff' : 'transparent',
          marginBottom: 12,
        }}
      >
        <p style={{ margin: 0, fontSize: 13, color: '#666' }}>
          {uploading ? 'Uploading…' : 'Drag a document here, or tap to choose a file'}
        </p>
        <input
          id={inputId}
          type="file"
          style={{ display: 'none' }}
          onChange={(e) => handleFiles(e.target.files)}
        />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {docs.length === 0 && <p style={{ fontSize: 13, color: '#999' }}>No documents yet.</p>}
        {docs.map((doc) => {
          const st = expiryStatus(doc.expiry_date);
          return (
            <div
              key={doc.id}
              style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                fontSize: 13, background: '#f7f7f8', padding: '8px 10px', borderRadius: 6,
              }}
            >
              <a href={doc.file_url} target="_blank" rel="noreferrer">{doc.doc_type}</a>
              {st && <span className={`pill ${st.className}`}>{st.label}</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
