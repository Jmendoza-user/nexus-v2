// ============================================================
// NEXUS — Vault (/m/vault) · segundo cerebro + RAG
// Cableado a backend real (/api/vault/*). Diseño CANÓNICO intacto.
// ============================================================
import { useState, useEffect, useRef, useMemo } from 'react';
import { IconBtn, ListRow, SearchBar, TopBar, ScreenHeader, EmptyState } from '../ui';
import { Icon } from '../lib/icons';
import { api } from '../lib/api';
import type { VaultTreeNode, VaultSearchResult, VaultRagResponse } from '../lib/api';
import type { Nav } from './types';

type Any = any;

// ── Helpers de derivación (tree → folders + recientes) ────────────────────────

interface FlatNote {
  path: string;
  title: string;
  folder: string;
  mtime: number;
}

function flattenNotes(tree: VaultTreeNode[], folder = ''): FlatNote[] {
  const out: FlatNote[] = [];
  for (const n of tree) {
    if (n.type === 'folder') out.push(...flattenNotes(n.children ?? [], n.name));
    else out.push({ path: n.path, title: n.name, folder: folder || 'Raíz', mtime: n.mtime ?? 0 });
  }
  return out;
}

function topFolders(tree: VaultTreeNode[]): { name: string; icon: string; count: number }[] {
  return tree
    .filter((n) => n.type === 'folder')
    .map((f) => ({
      name: f.name,
      icon: 'folder',
      count: flattenNotes(f.children ?? []).length,
    }))
    .filter((f) => f.count > 0)
    .sort((a, b) => b.count - a.count);
}

function fmtMtime(ms: number): string {
  if (!ms) return '';
  const d = new Date(ms);
  const now = Date.now();
  const days = Math.floor((now - ms) / 86_400_000);
  if (days <= 0) return 'hoy';
  if (days === 1) return 'ayer';
  if (days < 7) return `hace ${days} días`;
  return d.toLocaleDateString('es-CO', { day: 'numeric', month: 'short' });
}

// ── Note card (mosaico) ───────────────────────────────────────────────────────

function NoteCard({ n, onClick }: { n: FlatNote; onClick: () => void }) {
  return (
    <div className="card card-pad col gap2" style={{ cursor: 'pointer', breakInside: 'avoid', marginBottom: 12 }} onClick={onClick}>
      <div className="row gap2" style={{ alignItems: 'center' }}>
        <Icon name="file-text" size={15} color="var(--accent)" />
        <span className="t-base fw6" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{n.title}</span>
      </div>
      <div className="row between t-xs tter" style={{ marginTop: 2 }}>
        <span>{n.folder}</span>
        <span>{fmtMtime(n.mtime)}</span>
      </div>
    </div>
  );
}

function VaultScreen({ nav }: { nav: Nav }) {
  const [q, setQ] = useState('');
  const [tree, setTree] = useState<VaultTreeNode[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  const [searchRes, setSearchRes] = useState<VaultSearchResult[] | null>(null);
  const [rag, setRag] = useState<VaultRagResponse | null>(null);
  const [ragLoading, setRagLoading] = useState(false);
  const debounce = useRef<number | null>(null);

  // Carga inicial del árbol.
  useEffect(() => {
    let alive = true;
    api.vaultTree()
      .then((r) => { if (alive) { setTree(r.tree); setTotal(r.totalNotes); } })
      .catch(() => { if (alive) nav.toast('No se pudo cargar el vault.', 'alert-triangle', 'danger'); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [nav]);

  const allNotes = useMemo(() => flattenNotes(tree).sort((a, b) => b.mtime - a.mtime), [tree]);
  const folders = useMemo(() => topFolders(tree), [tree]);

  const asking = q.trim().length > 0;

  // Búsqueda + RAG con debounce al teclear.
  useEffect(() => {
    if (debounce.current) window.clearTimeout(debounce.current);
    const query = q.trim();
    if (query.length < 2) { setSearchRes(null); setRag(null); return; }
    debounce.current = window.setTimeout(async () => {
      try {
        const s = await api.vaultSearch(query);
        setSearchRes(s.results);
      } catch { setSearchRes([]); }
      // RAG solo para preguntas (con verbo o longitud razonable).
      if (query.length >= 8) {
        setRagLoading(true);
        try { setRag(await api.vaultRag(query)); }
        catch { setRag(null); }
        finally { setRagLoading(false); }
      } else { setRag(null); }
    }, 450);
    return () => { if (debounce.current) window.clearTimeout(debounce.current); };
  }, [q]);

  const recent = allNotes.slice(0, 30);
  const searchNotes: FlatNote[] = (searchRes ?? []).map((r) => {
    const folder = r.path.includes('/') ? r.path.split('/').slice(0, -1).join('/') : 'Raíz';
    return { path: r.path, title: r.title, folder, mtime: 0 };
  });
  const shown = asking ? searchNotes : recent;

  return (
    <div className="col" style={{ height: '100%' }}>
      <div className="topbar">
        <span className="t-base fw6">Vault</span>
        <IconBtn name="library" onClick={() => nav.toast('Reindexando tu vault…', 'refresh-cw')} />
      </div>
      <div className="grow" style={{ overflowY: 'auto', padding: '0 16px 24px' }}>
        <ScreenHeader title="Vault" sub={`${total} ${total === 1 ? 'nota' : 'notas'} · segundo cerebro`} />

        <div style={{ marginBottom: 14 }}>
          <SearchBar placeholder="Busca o pregúntale a tu vault…" value={q} onChange={setQ} />
        </div>

        {/* RAG answer */}
        {asking && (ragLoading || rag) && (
          <div className="card card-pad col gap3 anim-up" style={{ marginBottom: 16, borderColor: 'var(--accent-soft-2)', background: 'linear-gradient(180deg, var(--accent-soft), transparent)' }}>
            <div className="row gap2 t-xs fw7 tacc" style={{ textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              <Icon name="sparkles" size={14} /> Respuesta del vault
            </div>
            {ragLoading ? (
              <p className="t-sm tsec" style={{ margin: 0 }}>Pensando con tus notas…</p>
            ) : rag ? (
              <>
                <p className="t-sm" style={{ margin: 0, lineHeight: 1.6, textWrap: 'pretty' }}>{rag.answer}</p>
                {rag.citations.length > 0 && (
                  <div className="col gap2">
                    <span className="t-xs tter fw6">Citado de</span>
                    {rag.citations.map((c) => (
                      <div key={c.notePath} className="row gap2 t-sm card" style={{ padding: '8px 10px', cursor: 'pointer' }} onClick={() => nav.push('note', { path: c.notePath })}>
                        <Icon name="quote" size={15} color="var(--accent)" />
                        <span className="fw5 grow">{c.title}</span>
                        <span className="t-xs tter">{c.notePath.includes('/') ? c.notePath.split('/')[0] : 'Raíz'}</span>
                      </div>
                    ))}
                  </div>
                )}
              </>
            ) : null}
          </div>
        )}

        {/* folders */}
        {!asking && folders.length > 0 && (
          <div className="row gap2" style={{ overflowX: 'auto', marginBottom: 16, paddingBottom: 2 }}>
            {folders.map((f) => (
              <div key={f.name} className="card" style={{ padding: '10px 14px', flexShrink: 0, cursor: 'pointer' }}>
                <div className="row gap2 t-sm fw6"><Icon name={f.icon} size={15} color="var(--text-secondary)" />{f.name}</div>
                <span className="t-xs tter">{f.count} notas</span>
              </div>
            ))}
          </div>
        )}

        <div className="t-xs tter fw6" style={{ textTransform: 'uppercase', letterSpacing: '0.06em', margin: '4px 4px 10px' }}>
          {asking ? 'Resultados' : 'Recientes'}
        </div>
        {loading ? (
          <EmptyState icon="book-open" title="Cargando vault…" body="Un momento." />
        ) : shown.length ? (
          <div style={{ columnCount: 2, columnGap: 12 }}>
            {shown.map((n) => <NoteCard key={n.path} n={n} onClick={() => nav.push('note', { path: n.path })} />)}
          </div>
        ) : (
          <EmptyState icon="book-open" title={asking ? 'Sin resultados' : 'Vault vacío'} body="Prueba con otra búsqueda o crea una nota nueva." />
        )}
      </div>
    </div>
  );
}

// ---- Note editor (pushed) ----
function NoteScreen({ nav, data }: { nav: Nav; data: Any }) {
  const notePath: string | undefined = data?.path;
  const [mode, setMode] = useState<'visual' | 'code'>('visual');
  const [loading, setLoading] = useState(true);
  const [note, setNote] = useState<Awaited<ReturnType<typeof api.vaultNote>> | null>(null);
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (!notePath) { nav.back(); return; }
    let alive = true;
    api.vaultNote(notePath)
      .then((n) => { if (alive) { setNote(n); setDraft(n.content); } })
      .catch(() => { if (alive) { nav.toast('No se pudo abrir la nota.', 'alert-triangle', 'danger'); nav.back(); } })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [notePath, nav]);

  async function save() {
    if (!notePath || !dirty) return;
    setSaving(true);
    try {
      await api.vaultSaveNote(notePath, draft);
      setDirty(false);
      nav.toast('Nota guardada.', 'check-circle', 'success');
      setNote((prev) => prev ? { ...prev, content: draft } : prev);
    } catch {
      nav.toast('No se pudo guardar.', 'alert-triangle', 'danger');
    } finally {
      setSaving(false);
    }
  }

  if (loading || !note) {
    return (
      <div className="col" style={{ height: '100%' }}>
        <TopBar left={<IconBtn name="arrow-left" onClick={() => nav.back()} />} title="Nota" right={null} />
        <div className="grow" style={{ overflowY: 'auto', padding: '8px 20px 24px' }}>
          <EmptyState icon="file-text" title="Abriendo nota…" body="Un momento." />
        </div>
      </div>
    );
  }

  const folder = note.path.includes('/') ? note.path.split('/').slice(0, -1).join('/') : 'Vault';
  const tags = Array.isArray(note.frontmatter.tags) ? (note.frontmatter.tags as string[]) : [];

  return (
    <div className="col" style={{ height: '100%' }}>
      <TopBar left={<IconBtn name="arrow-left" onClick={() => nav.back()} />}
        title={folder}
        right={<>
          {mode === 'code' && dirty && <IconBtn name="check" onClick={save} />}
          <IconBtn name={mode === 'visual' ? 'square-pen' : 'eye'} onClick={() => setMode((m) => m === 'visual' ? 'code' : 'visual')} />
          <IconBtn name="more-horizontal" />
        </>} />
      <div className="grow" style={{ overflowY: 'auto', padding: '8px 20px 24px' }}>
        <h1 className="t-2xl fw7" style={{ margin: '4px 0 6px' }}>{note.title}</h1>
        {tags.length > 0 && (
          <div className="row gap2 wrap" style={{ marginBottom: 16 }}>
            {tags.map((t) => <span key={t} className="chip" style={{ height: 24 }}>#{t}</span>)}
          </div>
        )}
        {mode === 'visual' ? (
          <pre className="t-base" style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontFamily: 'inherit', lineHeight: 1.7, color: 'var(--text-secondary)' }}>{note.body || note.content}</pre>
        ) : (
          <textarea
            className="mono t-sm"
            value={draft}
            onChange={(e) => { setDraft(e.target.value); setDirty(true); }}
            spellCheck={false}
            style={{
              width: '100%', minHeight: '50vh', margin: 0, padding: 0, border: 'none', outline: 'none',
              resize: 'vertical', background: 'transparent', color: 'var(--text-secondary)',
              whiteSpace: 'pre-wrap', lineHeight: 1.7,
            }}
          />
        )}
        {saving && <span className="t-xs tter">Guardando…</span>}
      </div>
      {note.backlinks.length > 0 && (
        <div className="card" style={{ margin: '0 16px 16px', borderRadius: 'var(--r-lg)' }}>
          <div className="row gap2 card-pad t-xs fw6 tter" style={{ paddingBottom: 8, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            <Icon name="link" size={13} /> Backlinks · {note.backlinks.length}
          </div>
          {note.backlinks.slice(0, 8).map((bl) => (
            <ListRow
              key={bl}
              icon="file-text"
              title={bl.split('/').pop()!.replace(/\.md$/i, '')}
              sub={bl.includes('/') ? bl.split('/').slice(0, -1).join('/') : 'Vault'}
              onClick={() => nav.push('note', { path: bl })}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export { VaultScreen, NoteScreen };
