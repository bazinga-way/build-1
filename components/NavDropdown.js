import { useState, useRef, useEffect } from 'react';

export default function NavDropdown({ label, items }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  return (
    <div ref={ref} style={{ position: 'relative', display: 'inline-block' }}>
      <button onClick={() => setOpen(!open)}>{label} ▾</button>
      {open && (
        <div
          style={{
            position: 'absolute', top: '100%', right: 0, marginTop: 4,
            background: 'white', border: '1px solid #ddd', borderRadius: 8,
            boxShadow: '0 4px 12px rgba(0,0,0,0.08)', minWidth: 160, zIndex: 20,
            overflow: 'hidden',
          }}
        >
          {items.map((item) => (
            <button
              key={item.label}
              onClick={() => { setOpen(false); item.onClick(); }}
              style={{
                display: 'block', width: '100%', textAlign: 'left', padding: '10px 14px',
                border: 'none', background: 'white', fontSize: 13, cursor: 'pointer',
              }}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
