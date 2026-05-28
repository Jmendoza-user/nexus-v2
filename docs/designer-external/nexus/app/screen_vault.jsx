// ============================================================
// NEXUS — Vault (/m/vault) · segundo cerebro + RAG
// ============================================================
function NoteCard({ n, onClick }) {
  return (
    <div className="card card-pad col gap2" style={{ cursor: 'pointer', breakInside: 'avoid', marginBottom: 12 }} onClick={onClick}>
      <div className="row gap2" style={{ alignItems: 'center' }}>
        <Icon name="file-text" size={15} color="var(--accent)" />
        <span className="t-base fw6" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{n.title}</span>
      </div>
      <p className="t-sm tsec" style={{ margin: 0, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden', lineHeight: 1.5 }}>{n.excerpt}</p>
      <div className="row gap1 wrap">
        {n.tags.map(t => <span key={t} className="t-xs tter mono">#{t}</span>)}
      </div>
      <div className="row between t-xs tter" style={{ marginTop: 2 }}>
        <span>{n.modified}</span>
        {n.backlinks > 0 && <span className="row gap1"><Icon name="link" size={12} />{n.backlinks}</span>}
      </div>
    </div>
  );
}

function VaultScreen({ nav }) {
  const [q, setQ] = React.useState('');
  const [showRag, setShowRag] = React.useState(false);
  const v = NX.vault;
  const filtered = v.notes.filter(n => !q || n.title.toLowerCase().includes(q.toLowerCase()) || n.excerpt.toLowerCase().includes(q.toLowerCase()));
  const asking = q.length > 8 || showRag;

  return (
    <div className="col" style={{ height: '100%' }}>
      <div className="topbar">
        <span className="t-base fw6">Vault</span>
        <IconBtn name="library" />
      </div>
      <div className="grow" style={{ overflowY: 'auto', padding: '0 16px 24px' }}>
        <ScreenHeader title="Vault" sub={`${v.notes.length} notas · ${v.folders.reduce((a, f) => a + f.count, 0)} en total`} />

        <div style={{ marginBottom: 14 }}>
          <SearchBar placeholder="Busca o pregúntale a tu vault…" value={q} onChange={setQ} onFocus={() => setShowRag(true)} />
        </div>

        {/* RAG answer */}
        {asking && (
          <div className="card card-pad col gap3 anim-up" style={{ marginBottom: 16, borderColor: 'var(--accent-soft-2)', background: 'linear-gradient(180deg, var(--accent-soft), transparent)' }}>
            <div className="row gap2 t-xs fw7 tacc" style={{ textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              <Icon name="sparkles" size={14} /> Respuesta del vault
            </div>
            <p className="t-sm" style={{ margin: 0, lineHeight: 1.6, textWrap: 'pretty' }}>{v.rag.answer}</p>
            <div className="col gap2">
              <span className="t-xs tter fw6">Citado de</span>
              {v.rag.citations.map(c => (
                <div key={c.note} className="row gap2 t-sm card" style={{ padding: '8px 10px', cursor: 'pointer' }} onClick={() => nav.push('note', v.notes.find(n => n.title === c.note))}>
                  <Icon name="quote" size={15} color="var(--accent)" />
                  <span className="fw5 grow">{c.note}</span>
                  <span className="t-xs tter">{c.folder}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* folders */}
        {!asking && (
          <div className="row gap2" style={{ overflowX: 'auto', marginBottom: 16, paddingBottom: 2 }}>
            {v.folders.map(f => (
              <div key={f.name} className="card" style={{ padding: '10px 14px', flexShrink: 0, cursor: 'pointer' }}>
                <div className="row gap2 t-sm fw6"><Icon name={f.icon} size={15} color="var(--text-secondary)" />{f.name}</div>
                <span className="t-xs tter">{f.count} notas</span>
              </div>
            ))}
          </div>
        )}

        <div className="t-xs tter fw6" style={{ textTransform: 'uppercase', letterSpacing: '0.06em', margin: '4px 4px 10px' }}>
          {q ? 'Resultados' : 'Recientes'}
        </div>
        {filtered.length ? (
          <div style={{ columnCount: 2, columnGap: 12 }}>
            {filtered.map(n => <NoteCard key={n.id} n={n} onClick={() => nav.push('note', n)} />)}
          </div>
        ) : (
          <EmptyState icon="book-open" title="Sin resultados" body="Prueba con otra búsqueda o crea una nota nueva." />
        )}
      </div>
    </div>
  );
}

// ---- Note editor (pushed) ----
function NoteScreen({ nav, data: n }) {
  if (!n) { nav.back(); return null; }
  const [mode, setMode] = React.useState('visual');
  return (
    <div className="col" style={{ height: '100%' }}>
      <TopBar left={<IconBtn name="arrow-left" onClick={() => nav.back()} />}
        title={n.folder}
        right={<><IconBtn name={mode === 'visual' ? 'square-pen' : 'eye'} onClick={() => setMode(m => m === 'visual' ? 'code' : 'visual')} /><IconBtn name="more-horizontal" /></>} />
      <div className="grow" style={{ overflowY: 'auto', padding: '8px 20px 24px' }}>
        <h1 className="t-2xl fw7" style={{ margin: '4px 0 6px' }}>{n.title}</h1>
        <div className="row gap2 wrap" style={{ marginBottom: 16 }}>
          {n.tags.map(t => <span key={t} className="chip" style={{ height: 24 }}>#{t}</span>)}
        </div>
        {mode === 'visual' ? (
          <div className="col gap3 t-base" style={{ lineHeight: 1.7, color: 'var(--text-secondary)' }}>
            <p style={{ margin: 0 }}>{n.excerpt}</p>
            <p style={{ margin: 0 }}>Este es el contenido enlazado de tu segundo cerebro. Las menciones a otras notas como <span className="tacc fw5">[[Arquitectura NEXUS V2]]</span> se convierten en backlinks navegables.</p>
            <ul style={{ margin: 0, paddingLeft: 18 }}>
              <li>Aislamiento lógico por usuario</li>
              <li>pgvector + HNSW para RAG</li>
              <li>Autocure con máximo 3 reintentos</li>
            </ul>
          </div>
        ) : (
          <pre className="mono t-sm" style={{ margin: 0, whiteSpace: 'pre-wrap', color: 'var(--text-secondary)', lineHeight: 1.7 }}>{`# ${n.title}\n\n${n.excerpt}\n\nMenciones: [[Arquitectura NEXUS V2]]\n\n- Aislamiento lógico por usuario\n- pgvector + HNSW para RAG\n- Autocure (máx 3 reintentos)`}</pre>
        )}
      </div>
      <div className="card" style={{ margin: '0 16px 16px', borderRadius: 'var(--r-lg)' }}>
        <div className="row gap2 card-pad t-xs fw6 tter" style={{ paddingBottom: 8, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          <Icon name="link" size={13} /> Backlinks · {n.backlinks}
        </div>
        <ListRow icon="file-text" title="Arquitectura NEXUS V2" sub="Conceptos" />
        <ListRow icon="file-text" title="Decisiones técnicas" sub="Conceptos" />
      </div>
    </div>
  );
}

Object.assign(window, { VaultScreen, NoteScreen });
