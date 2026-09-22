import { useMemo, useState } from "react";
import {
  Activity, ArrowDownAZ, ArrowUpAZ, BarChart3, Check, ChevronDown, ChevronRight,
  Columns3, Copy, Database, Download, Edit3, Eye, FileSpreadsheet, Filter,
  LayoutDashboard, List, MoreHorizontal, Plus, RefreshCw, Search, Settings,
  SlidersHorizontal, Trash2, Upload, Users, X, Kanban, PanelRight, Table2,
  CalendarDays, Layers3
} from "lucide-react";

type Row = Record<string, string>;
type ViewMode = "grid" | "list" | "kanban";
type TableDef = {
  id: string; name: string; description?: string; columns: string[];
  rows: Row[]; createdAt: number; views?: { id: string; name: string; mode: ViewMode }[];
};
type Source = { id: string; name: string; url: string; token?: string; connected?: boolean; status?: string };

const API = "https://latam-data-manager-api.nyxaria.workers.dev";
const TABLES_KEY = "latam-tables";
const SOURCES_KEY = "latam-sources";
const uid = () => crypto.randomUUID();

const load = <T,>(key: string, fallback: T): T => {
  try { return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback)); } catch { return fallback; }
};

function App({ onLogout }: { onLogout: () => void }) {
  const [tables, setTables] = useState<TableDef[]>(() => load(TABLES_KEY, []));
  const [sources, setSources] = useState<Source[]>(() => load(SOURCES_KEY, []));
  const [active, setActive] = useState("dashboard");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<{ col: string; dir: "asc" | "desc" } | null>(null);
  const [selected, setSelected] = useState<number[]>([]);
  const [view, setView] = useState<ViewMode>("grid");
  const [density, setDensity] = useState<"normal" | "compact">("normal");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [filter, setFilter] = useState({ col: "", op: "contains", value: "" });
  const [modal, setModal] = useState<"table" | "source" | "columns" | "filter" | "import" | null>(null);
  const [drawer, setDrawer] = useState<number | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [columns, setColumns] = useState("Nome, Status, Cargo");
  const [url, setUrl] = useState("");
  const [token, setToken] = useState("");
  const [testing, setTesting] = useState(false);
  const [toast, setToast] = useState("");
  const [importPreview, setImportPreview] = useState<{ columns: string[]; rows: Row[]; file: string } | null>(null);

  const persistTables = (v: TableDef[]) => { localStorage.setItem(TABLES_KEY, JSON.stringify(v)); setTables(v); };
  const persistSources = (v: Source[]) => { localStorage.setItem(SOURCES_KEY, JSON.stringify(v)); setSources(v); };
  const current = tables.find(t => t.id === active);
  const source = sources.find(s => s.id === active);

  function notify(message: string) {
    setToast(message);
    window.setTimeout(() => setToast(""), 2400);
  }
  function reset() {
    setName(""); setDescription(""); setColumns("Nome, Status, Cargo");
    setUrl(""); setToken(""); setTesting(false); setImportPreview(null);
  }
  function openTable(id: string) {
    setActive(id); setQuery(""); setPage(1); setSelected([]); setSort(null); setDrawer(null);
  }

  function createTable() {
    const cols = [...new Set(columns.split(",").map(x => x.trim()).filter(Boolean))];
    if (!name.trim() || !cols.length) return notify("Informe o nome e pelo menos uma coluna.");
    const t: TableDef = {
      id: uid(), name: name.trim(), description: description.trim(), columns: cols,
      rows: [], createdAt: Date.now(),
      views: [{ id: uid(), name: "Todos os registros", mode: "grid" }]
    };
    persistTables([...tables, t]); setActive(t.id); setModal(null); reset(); notify("Tabela criada.");
  }

  function addRow(t = current) {
    if (!t) return;
    const row: Row = {}; t.columns.forEach(c => row[c] = "");
    const next = t.rows.length;
    persistTables(tables.map(x => x.id === t.id ? { ...x, rows: [...x.rows, row] } : x));
    setDrawer(next); notify("Registro criado.");
  }

  function updateRow(index: number, values: Row) {
    if (!current) return;
    const rows = current.rows.map((r, i) => i === index ? { ...r, ...values } : r);
    persistTables(tables.map(t => t.id === current.id ? { ...t, rows } : t));
  }

  function deleteRows() {
    if (!current || !selected.length) return;
    const set = new Set(selected);
    persistTables(tables.map(t => t.id === current.id ? { ...t, rows: t.rows.filter((_, i) => !set.has(i)) } : t));
    setSelected([]); setDrawer(null); notify(`${selected.length} registro(s) excluído(s).`);
  }

  function deleteRow(index: number) {
    if (!current) return;
    persistTables(tables.map(t => t.id === current.id ? { ...t, rows: t.rows.filter((_, i) => i !== index) } : t));
    setDrawer(null); notify("Registro excluído.");
  }

  function deleteTable(id: string) {
    const t = tables.find(x => x.id === id);
    if (!t || !confirm(`Excluir a tabela "${t.name}"? Esta ação não pode ser desfeita.`)) return;
    persistTables(tables.filter(x => x.id !== id)); setActive("dashboard"); notify("Tabela excluída.");
  }

  function addColumn() {
    if (!current) return;
    const col = prompt("Nome da nova coluna:");
    if (!col?.trim() || current.columns.includes(col.trim())) return;
    const c = col.trim();
    persistTables(tables.map(t => t.id === current.id
      ? { ...t, columns: [...t.columns, c], rows: t.rows.map(r => ({ ...r, [c]: "" })) } : t));
    notify("Campo adicionado.");
  }

  function removeColumn(col: string) {
    if (!current || current.columns.length <= 1 || !confirm(`Remover "${col}" e todos os valores deste campo?`)) return;
    const rows = current.rows.map(r => { const n = { ...r }; delete n[col]; return n; });
    persistTables(tables.map(t => t.id === current.id ? { ...t, columns: t.columns.filter(c => c !== col), rows } : t));
    notify("Campo removido.");
  }

  function duplicateTable() {
    if (!current) return;
    const copy: TableDef = { ...current, id: uid(), name: current.name + " — cópia", rows: current.rows.map(r => ({ ...r })), createdAt: Date.now() };
    persistTables([...tables, copy]); setActive(copy.id); notify("Tabela duplicada.");
  }

  function exportCsv() {
    if (!current) return;
    const esc = (v: string) => `"${String(v ?? "").replaceAll('"', '""')}"`;
    const csv = [current.columns.map(esc).join(","), ...current.rows.map(r => current.columns.map(c => esc(r[c] || "")).join(","))].join("\n");
    const blob = new Blob(["\\ufeff" + csv], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob);
    a.download = current.name.replace(/[^a-z0-9_-]+/gi, "_") + ".csv"; a.click(); URL.revokeObjectURL(a.href);
    notify("CSV exportado.");
  }

  async function prepareImport(file: File) {
    if (!current) return;
    try {
      const text = (await file.text()).replace(/^\\ufeff/, "").replace(/\\r\\n/g, "\n").replace(/\\r/g, "\n");
      const lines = text.split("\n").filter(line => line.trim() !== "");
      if (!lines.length) return notify("O arquivo está vazio.");
      const delimiter = [",", ";", "\\t", "|"].map(d => d === "\\t" ? "\t" : d)
        .sort((a, b) => lines[0].split(b).length - lines[0].split(a).length)[0];
      const parse = (line: string) => {
        const out: string[] = []; let value = ""; let quoted = false;
        for (let i = 0; i < line.length; i++) {
          const ch = line[i];
          if (ch === '"') { if (quoted && line[i + 1] === '"') { value += '"'; i++; } else quoted = !quoted; }
          else if (ch === delimiter && !quoted) { out.push(value.trim()); value = ""; } else value += ch;
        }
        out.push(value.trim()); return out;
      };
      const fileColumns = parse(lines[0]).map((v, i) => v || `Coluna ${i + 1}`);
      const rows = lines.slice(1).map(line => {
        const values = parse(line); const row: Row = {};
        fileColumns.forEach((c, i) => row[c] = values[i] ?? ""); return row;
      }).filter(r => Object.values(r).some(Boolean));
      setImportPreview({ columns: fileColumns, rows, file: file.name });
      setModal("import");
    } catch { notify("Não foi possível ler o arquivo."); }
  }

  function chooseImport() {
    const input = document.createElement("input"); input.type = "file";
    input.accept = ".csv,.txt,text/csv,text/plain";
    input.onchange = () => { const f = input.files?.[0]; if (f) void prepareImport(f); };
    input.click();
  }

  function applyImport() {
    if (!current || !importPreview) return;
    const cols = [...current.columns, ...importPreview.columns.filter(c => !current.columns.includes(c))];
    const rows = importPreview.rows.map(r => { const n: Row = {}; cols.forEach(c => n[c] = r[c] ?? ""); return n; });
    persistTables(tables.map(t => t.id === current.id ? { ...t, columns: cols, rows: [...t.rows, ...rows] } : t));
    setModal(null); setImportPreview(null); notify(`${rows.length} registros importados.`);
  }

  async function connectSource() {
    if (!name.trim() || !url.trim()) return notify("Preencha nome e URL.");
    setTesting(true);
    try {
      const r = await fetch(API + "/api/source/test", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ url: url.trim(), token: token.trim() || undefined })
      });
      const d = await r.json();
      if (!d.connected) return notify("A fonte não respondeu corretamente.");
      const s = { id: uid(), name: name.trim(), url: url.trim(), token: token.trim() || undefined, connected: true, status: "online" };
      persistSources([...sources, s]); setActive(s.id); setModal(null); reset(); notify("Fonte conectada.");
    } catch { notify("Falha ao acessar a fonte."); } finally { setTesting(false); }
  }

  const filteredRows = useMemo(() => {
    if (!current) return [];
    const needle = query.toLowerCase().trim();
    let rows = current.rows.map((row, index) => ({ row, index }))
      .filter(x => !needle || current.columns.some(c => (x.row[c] || "").toLowerCase().includes(needle)));
    if (filter.col && filter.value.trim()) {
      const v = filter.value.toLowerCase();
      rows = rows.filter(x => {
        const cell = (x.row[filter.col] || "").toLowerCase();
        return filter.op === "equals" ? cell === v : filter.op === "starts" ? cell.startsWith(v) : cell.includes(v);
      });
    }
    if (sort) rows.sort((a, b) => (a.row[sort.col] || "").localeCompare(b.row[sort.col] || "", "pt-BR", { numeric: true }) * (sort.dir === "asc" ? 1 : -1));
    return rows;
  }, [current, query, filter, sort]);

  const pages = Math.max(1, Math.ceil(filteredRows.length / pageSize));
  const pageRows = filteredRows.slice((page - 1) * pageSize, page * pageSize);
  const totalRecords = tables.reduce((n, t) => n + t.rows.length, 0);
  const activeRow = current && drawer !== null ? current.rows[drawer] : null;

  function toggleAll() {
    const ids = pageRows.map(x => x.index);
    setSelected(selected.length === ids.length ? [] : ids);
  }

  return <div className="app">
    <aside className="sidebar">
      <div className="brand"><div className="brand-mark">✦</div><div><b>LATAM</b><small>DATA MANAGER</small></div></div>
      <nav>
        <button className={active === "dashboard" ? "sel" : ""} onClick={() => setActive("dashboard")}><LayoutDashboard/>Visão geral</button>
        <div className="label">TABELAS <span>{tables.length}</span></div>
        {tables.map(t => <button className={active === t.id ? "sel" : ""} onClick={() => openTable(t.id)} key={t.id}><Table2/><span className="nav-name">{t.name}</span><em>{t.rows.length}</em></button>)}
        <button className="add-nav" onClick={() => { reset(); setModal("table"); }}><Plus/>Nova tabela</button>
        <div className="label">CONEXÕES <span>{sources.length}</span></div>
        {sources.map(s => <button className={active === s.id ? "sel" : ""} onClick={() => setActive(s.id)} key={s.id}><Layers3/><span className="nav-name">{s.name}</span><i className="status-dot"/></button>)}
        <button onClick={() => { reset(); setModal("source"); }}><Plus/>Conectar fonte</button>
      </nav>
      <div className="sidebar-bottom"><button><Settings/>Configurações</button><button onClick={onLogout}><X/>Sair</button></div>
    </aside>

    <main>
      <header className="topbar">
        <div className="breadcrumb"><span>Workspace</span><ChevronRight/><b>{active === "dashboard" ? "Visão geral" : current?.name || source?.name || "Fonte"}</b></div>
        <div className="top-actions">{current && <button className="icon-btn" title="Atualizar"><RefreshCw/></button>}<button className="avatar">S</button></div>
      </header>

      <div className="content">
        <div className="page-heading">
          <div><div className="eyebrow"><Activity/> WORKSPACE</div><h1>{active === "dashboard" ? "Seu workspace" : current?.name || source?.name || "Fonte"}</h1><p>{active === "dashboard" ? "Tudo o que você precisa para organizar, consultar e administrar seus dados." : current?.description || "Gerenciamento profissional de dados."}</p></div>
          <div className="heading-actions">
            {current && <><button onClick={duplicateTable}><Copy/>Duplicar</button><button onClick={exportCsv}><Download/>Exportar</button><button className="primary" onClick={() => addRow()}><Plus/>Novo registro</button></>}
            {active === "dashboard" && <button className="primary" onClick={() => { reset(); setModal("table"); }}><Plus/>Nova tabela</button>}
          </div>
        </div>

        {active === "dashboard" ? <Dashboard tables={tables} sources={sources} totalRecords={totalRecords} onOpen={openTable}/> :
        current ? <section className="data-panel">
          <div className="table-head">
            <div className="table-identity"><div className="table-icon"><FileSpreadsheet/></div><div><h2>{current.name}</h2><span>{current.rows.length} registros · {current.columns.length} campos</span></div></div>
            <div className="view-switcher">
              <button className={view === "grid" ? "active" : ""} onClick={() => setView("grid")}><Table2/>Grid</button>
              <button className={view === "list" ? "active" : ""} onClick={() => setView("list")}><List/>Lista</button>
              <button className={view === "kanban" ? "active" : ""} onClick={() => setView("kanban")}><Kanban/>Kanban</button>
            </div>
          </div>
          <div className="toolbar">
            <div className="search"><Search/><input value={query} onChange={e => { setQuery(e.target.value); setPage(1); }} placeholder="Pesquisar registros..." />{query && <button onClick={() => setQuery("")}><X/></button>}</div>
            <div className="toolbar-actions">
              <button className={filter.col && filter.value ? "active-tool" : ""} onClick={() => setModal("filter")}><Filter/>Filtro{filter.col && filter.value ? " 1" : ""}</button>
              <button onClick={() => setDensity(density === "normal" ? "compact" : "normal")}><SlidersHorizontal/>{density === "normal" ? "Compacto" : "Confortável"}</button>
              <button onClick={() => setModal("columns")}><Columns3/>Campos</button>
              <button onClick={chooseImport}><Upload/>Importar</button>
              <button className="more-btn"><MoreHorizontal/></button>
            </div>
          </div>
          {selected.length > 0 && <div className="selectionbar"><b>{selected.length} selecionado(s)</b><button onClick={deleteRows}><Trash2/>Excluir</button><button onClick={() => setSelected([])}><X/>Limpar</button></div>}

          {view === "kanban" ? <KanbanView current={current} rows={filteredRows} onOpen={setDrawer}/> :
          <div className={`table-wrap ${view === "list" ? "list-view" : ""}`}>
            <table className={density === "compact" ? "compact" : ""}><thead><tr><th className="check"><input type="checkbox" checked={pageRows.length > 0 && selected.length === pageRows.length} onChange={toggleAll}/></th>{current.columns.map(c => <th key={c}><button className="th-sort" onClick={() => setSort({ col: c, dir: sort?.col === c && sort.dir === "asc" ? "desc" : "asc" })}>{c}{sort?.col === c ? (sort.dir === "asc" ? <ArrowUpAZ/> : <ArrowDownAZ/>) : <ChevronDown/>}</button></th>)}<th>Ações</th></tr></thead>
              <tbody>{pageRows.map(({ row, index }) => <tr key={index} className={selected.includes(index) ? "selected-row" : ""} onDoubleClick={() => setDrawer(index)}>
                <td className="check"><input type="checkbox" checked={selected.includes(index)} onChange={() => setSelected(selected.includes(index) ? selected.filter(x => x !== index) : [...selected, index])}/></td>
                {current.columns.map(c => <td key={c}><button className="cell-value" onClick={() => setDrawer(index)}>{row[c] || <span className="muted">—</span>}</button></td>)}
                <td><button className="row-action" onClick={() => setDrawer(index)}><Edit3/></button><button className="row-action danger-icon" onClick={() => deleteRow(index)}><Trash2/></button></td>
              </tr>)}</tbody></table>
            {!pageRows.length && <EmptyState hasQuery={!!query || !!filter.value} onAdd={() => addRow()}/>}
          </div>}
          <div className="pagination"><span>{filteredRows.length ? `${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, filteredRows.length)} de ${filteredRows.length}` : "0 registros"}</span><div><select value={pageSize} onChange={e => { setPageSize(Number(e.target.value)); setPage(1); }}><option value="10">10 / página</option><option value="25">25 / página</option><option value="50">50 / página</option><option value="100">100 / página</option></select><button disabled={page <= 1} onClick={() => setPage(page - 1)}>Anterior</button><b>{page} / {pages}</b><button disabled={page >= pages} onClick={() => setPage(page + 1)}>Próxima</button></div></div>
        </section> :
        source ? <SourcePage source={source} onReconnect={() => { setName(source.name); setUrl(source.url); setToken(source.token || ""); setModal("source"); }}/> : null}
      </div>
      <footer>LATAM Data Manager <span>•</span> by Souza</footer>
    </main>

    {activeRow && current && <RecordDrawer row={activeRow} index={drawer!} columns={current.columns} onClose={() => setDrawer(null)} onSave={v => { updateRow(drawer!, v); notify("Registro salvo."); }} onDelete={() => deleteRow(drawer!)}/>}
    {modal && <Modal type={modal} current={current} name={name} setName={setName} description={description} setDescription={setDescription} columns={columns} setColumns={setColumns} url={url} setUrl={setUrl} token={token} setToken={setToken} filter={filter} setFilter={setFilter} importPreview={importPreview} testing={testing} onClose={() => setModal(null)} onCreate={createTable} onConnect={connectSource} onAddColumn={addColumn} onRemoveColumn={removeColumn} onApplyFilter={() => { setPage(1); setModal(null); }} onApplyImport={applyImport}/>}
    {toast && <div className="toast"><Check/>{toast}</div>}
  </div>;
}

function Dashboard({ tables, sources, totalRecords, onOpen }: { tables: TableDef[]; sources: Source[]; totalRecords: number; onOpen: (id: string) => void }) {
  const largest = [...tables].sort((a,b) => b.rows.length-a.rows.length).slice(0,5);
  return <section className="dashboard">
    <div className="metric-grid"><Metric icon={<Table2/>} value={tables.length} label="Tabelas"/><Metric icon={<Database/>} value={sources.length} label="Conexões"/><Metric icon={<Users/>} value={totalRecords} label="Registros"/><Metric icon={<BarChart3/>} value={tables.length ? Math.round(totalRecords/tables.length) : 0} label="Média por tabela"/></div>
    <div className="dashboard-grid">
      <div className="dash-panel hero-panel"><div className="panel-title"><div><h3>Seu workspace</h3><span>Visão rápida da estrutura de dados</span></div><LayoutDashboard/></div><div className="bars">{largest.length ? largest.map(t => <button key={t.id} onClick={() => onOpen(t.id)}><span><b>{t.name}</b><small>{t.rows.length} registros</small></span><div><i style={{ width: `${Math.max(4, Math.min(100, totalRecords ? t.rows.length/Math.max(1,totalRecords)*100*2.5 : 4))}%` }}/></div></button>) : <EmptyState onAdd={() => {}} hasQuery={false}/>}</div></div>
      <div className="dash-panel"><div className="panel-title"><div><h3>Atividade</h3><span>Estado atual do workspace</span></div><Activity/></div><div className="activity-list"><ActivityItem value={tables.length} label="tabelas disponíveis" hint="Estrutura local"/><ActivityItem value={totalRecords} label="registros armazenados" hint="Dados locais"/><ActivityItem value={sources.length} label="conexões configuradas" hint="Fontes externas"/></div></div>
    </div>
    <div className="dash-panel quick-panel"><div className="panel-title"><div><h3>Acesso rápido</h3><span>Entre direto onde precisa</span></div><Plus/></div><div className="quick-grid">{tables.slice(0,6).map(t => <button key={t.id} onClick={() => onOpen(t.id)}><FileSpreadsheet/><span><b>{t.name}</b><small>{t.columns.length} campos</small></span><ChevronRight/></button>)}{!tables.length && <p className="muted-text">Crie sua primeira tabela para começar.</p>}</div></div>
  </section>;
}
function Metric({ icon, value, label }: { icon: React.ReactNode; value: number; label: string }) { return <div className="metric"><span>{icon}</span><div><b>{value}</b><small>{label}</small></div><Activity/></div>; }
function ActivityItem({value,label,hint}:{value:number;label:string;hint:string}) { return <div><span className="activity-dot"/><p><b>{value}</b> {label}<small>{hint}</small></p></div>; }

function KanbanView({ current, rows, onOpen }: { current: TableDef; rows: {row: Row; index:number}[]; onOpen:(i:number)=>void }) {
  const statusCol = current.columns.find(c => /status|situa|estado/i.test(c)) || current.columns[1] || current.columns[0];
  const values = [...new Set(rows.map(x => x.row[statusCol] || "Sem status"))].slice(0,8);
  if (!values.length) values.push("Sem status");
  return <div className="kanban">{values.map(status => <div className="kanban-col" key={status}><div className="kanban-head"><span>{status}</span><em>{rows.filter(x => (x.row[statusCol] || "Sem status") === status).length}</em></div>{rows.filter(x => (x.row[statusCol] || "Sem status") === status).map(x => <button className="kanban-card" key={x.index} onClick={() => onOpen(x.index)}><b>{x.row[current.columns[0]] || "Sem título"}</b><span>{current.columns.slice(1,3).map(c => x.row[c]).filter(Boolean).join(" · ") || "Sem detalhes"}</span><small>Registro #{x.index + 1}</small></button>)}</div>)}</div>;
}
function EmptyState({hasQuery,onAdd}:{hasQuery:boolean;onAdd:()=>void}) { return <div className="empty"><Database/><h3>{hasQuery ? "Nenhum resultado" : "Sua tabela está vazia"}</h3><p>{hasQuery ? "Tente mudar a busca ou remover o filtro." : "Adicione o primeiro registro e comece a organizar seus dados."}</p>{!hasQuery && <button className="primary" onClick={onAdd}><Plus/>Adicionar registro</button>}</div>; }

function RecordDrawer({row,index,columns,onClose,onSave,onDelete}:{row:Row;index:number;columns:string[];onClose:()=>void;onSave:(v:Row)=>void;onDelete:()=>void}) {
  const [draft,setDraft]=useState<Row>({...row});
  return <div className="drawer-overlay" onMouseDown={e=>{if(e.target===e.currentTarget)onClose()}}><aside className="record-drawer"><div className="drawer-head"><div><span>REGISTRO #{index+1}</span><h2>Detalhes</h2></div><button onClick={onClose}><X/></button></div><div className="drawer-body">{columns.map(c=><label key={c}>{c}<input value={draft[c]||""} onChange={e=>setDraft({...draft,[c]:e.target.value})}/></label>)}</div><div className="drawer-foot"><button className="danger-outline" onClick={onDelete}><Trash2/>Excluir</button><button onClick={onClose}>Cancelar</button><button className="primary" onClick={()=>onSave(draft)}><Check/>Salvar alterações</button></div></aside></div>;
}

function SourcePage({source,onReconnect}:{source:Source;onReconnect:()=>void}) {
  return <section className="data-panel source-page"><div className="table-head"><div className="table-identity"><div className="table-icon"><Layers3/></div><div><h2>{source.name}</h2><span>{source.url}</span></div></div><button className="primary" onClick={onReconnect}><RefreshCw/>Reconectar</button></div><div className="source-status"><div className="online-dot"/><div><b>Conexão ativa</b><p>Esta fonte está salva no workspace. O próximo passo é mapear seus dados para uma tabela.</p></div></div></section>;
}

type ModalProps = { type: string; current?:TableDef; name:string;setName:(v:string)=>void;description:string;setDescription:(v:string)=>void;columns:string;setColumns:(v:string)=>void;url:string;setUrl:(v:string)=>void;token:string;setToken:(v:string)=>void;filter:{col:string;op:string;value:string};setFilter:(v:{col:string;op:string;value:string})=>void;importPreview:{columns:string[];rows:Row[];file:string}|null;testing:boolean;onClose:()=>void;onCreate:()=>void;onConnect:()=>void;onAddColumn:()=>void;onRemoveColumn:(c:string)=>void;onApplyFilter:()=>void;onApplyImport:()=>void};
function Modal(p:ModalProps) {
  const title = p.type==="table"?"Nova tabela":p.type==="columns"?"Campos da tabela":p.type==="filter"?"Filtrar registros":p.type==="import"?"Revisar importação":"Conectar fonte";
  return <div className="overlay" onMouseDown={e=>{if(e.target===e.currentTarget)p.onClose()}}><div className="modal">
    <div className="modalhead"><div><span className="eyebrow">CONFIGURAÇÃO</span><h2>{title}</h2><p>{p.type==="import"?"Confira as colunas e registros antes de importar.":p.type==="filter"?"Use uma regra simples para encontrar exatamente o que procura.":"Configure esta parte do workspace sem sair da página."}</p></div><button className="close" onClick={p.onClose}><X/></button></div>
    {p.type==="table"&&<><label>Nome<input autoFocus value={p.name} onChange={e=>p.setName(e.target.value)} placeholder="Ex.: Membros"/></label><label>Descrição <small>opcional</small><input value={p.description} onChange={e=>p.setDescription(e.target.value)} placeholder="O que esta tabela organiza?"/></label><label>Campos <small>separados por vírgula</small><input value={p.columns} onChange={e=>p.setColumns(e.target.value)} placeholder="Nome, Status, Cargo"/></label></>}
    {p.type==="columns"&&p.current&&<><div className="field-list">{p.current.columns.map(c=><div key={c}><span><Columns3/>{c}</span><button disabled={p.current!.columns.length<=1} onClick={()=>p.onRemoveColumn(c)}><Trash2/></button></div>)}</div><button className="secondary full" onClick={p.onAddColumn}><Plus/>Adicionar campo</button></>}
    {p.type==="filter"&&p.current&&<><label>Campo<select value={p.filter.col} onChange={e=>p.setFilter({...p.filter,col:e.target.value})}><option value="">Selecione</option>{p.current.columns.map(c=><option key={c}>{c}</option>)}</select></label><label>Condição<select value={p.filter.op} onChange={e=>p.setFilter({...p.filter,op:e.target.value})}><option value="contains">Contém</option><option value="equals">É exatamente</option><option value="starts">Começa com</option></select></label><label>Valor<input autoFocus value={p.filter.value} onChange={e=>p.setFilter({...p.filter,value:e.target.value})} placeholder="Digite o valor"/></label></>}
    {p.type==="import"&&p.importPreview&&<><div className="import-summary"><b>{p.importPreview.file}</b><span>{p.importPreview.rows.length} registros · {p.importPreview.columns.length} campos detectados</span></div><div className="preview-wrap"><table><thead><tr>{p.importPreview.columns.slice(0,6).map(c=><th key={c}>{c}</th>)}</tr></thead><tbody>{p.importPreview.rows.slice(0,5).map((r,i)=><tr key={i}>{p.importPreview!.columns.slice(0,6).map(c=><td key={c}>{r[c]}</td>)}</tr>)}</tbody></table></div><p className="hint">Prévia dos primeiros 5 registros. Os demais também serão importados.</p></>}
    {p.type==="source"&&<><label>Nome da conexão<input autoFocus value={p.name} onChange={e=>p.setName(e.target.value)} placeholder="Ex.: Google Sheets"/></label><label>URL<input value={p.url} onChange={e=>p.setUrl(e.target.value)} placeholder="https://..."/></label><label>API Key / Token <small>opcional</small><input type="password" value={p.token} onChange={e=>p.setToken(e.target.value)} placeholder="Chave de acesso"/></label></>}
    <div className="modalactions"><button onClick={p.onClose}>Cancelar</button>{p.type==="table"&&<button className="primary" onClick={p.onCreate}>Criar tabela</button>}{p.type==="source"&&<button className="primary" onClick={p.onConnect} disabled={p.testing}>{p.testing?"Testando...":"Conectar"}</button>}{p.type==="filter"&&<button className="primary" onClick={p.onApplyFilter}>Aplicar filtro</button>}{p.type==="import"&&<button className="primary" onClick={p.onApplyImport}>Importar registros</button>}</div>
  </div></div>;
}
export default App;
