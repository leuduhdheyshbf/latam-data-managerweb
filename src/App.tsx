import { useMemo, useState } from "react";
import {
  Activity, ArrowDownAZ, ArrowUpAZ, BarChart3, Bell, Check, ChevronDown, ChevronRight,
  Columns3, Copy, Database, Download, Edit3, FileSpreadsheet, Filter, LayoutDashboard,
  MoreHorizontal, Plus, RefreshCw, Search, Settings, SlidersHorizontal, Trash2, Upload,
  Users, X
} from "lucide-react";

type Row = Record<string, string>;
type TableDef = {
  id: string;
  name: string;
  description?: string;
  columns: string[];
  rows: Row[];
  createdAt: number;
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
  const [modal, setModal] = useState<"table" | "source" | "columns" | "filter" | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [columns, setColumns] = useState("Nome, Status, Cargo");
  const [url, setUrl] = useState("");
  const [token, setToken] = useState("");
  const [testing, setTesting] = useState(false);
  const [toast, setToast] = useState("");
  const [density, setDensity] = useState<"normal" | "compact">("normal");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);\n  const [filterCol, setFilterCol] = useState("");\n  const [filterOp, setFilterOp] = useState<"contains" | "equals" | "starts">("contains");\n  const [filterValue, setFilterValue] = useState("");

  const persistTables = (v: TableDef[]) => { localStorage.setItem(TABLES_KEY, JSON.stringify(v)); setTables(v); };
  const persistSources = (v: Source[]) => { localStorage.setItem(SOURCES_KEY, JSON.stringify(v)); setSources(v); };
  const current = tables.find(t => t.id === active);
  const source = sources.find(s => s.id === active);

  function notify(message: string) {
    setToast(message);
    window.setTimeout(() => setToast(""), 2200);
  }

  function reset() {
    setName(""); setDescription(""); setColumns("Nome, Status, Cargo");
    setUrl(""); setToken(""); setTesting(false);
  }

  function createTable() {
    const cols = [...new Set(columns.split(",").map(x => x.trim()).filter(Boolean))];
    if (!name.trim() || !cols.length) return notify("Informe o nome e pelo menos uma coluna.");
    const t: TableDef = { id: uid(), name: name.trim(), description: description.trim(), columns: cols, rows: [], createdAt: Date.now() };
    persistTables([...tables, t]); setActive(t.id); setModal(null); reset(); notify("Tabela criada.");
  }

  function addRow(t = current) {
    if (!t) return;
    const row: Row = {};
    t.columns.forEach(c => row[c] = "");
    persistTables(tables.map(x => x.id === t.id ? { ...x, rows: [...x.rows, row] } : x));
    notify("Registro adicionado.");
  }

  function updateCell(rowIndex: number, col: string, value: string) {
    if (!current) return;
    const rows = current.rows.map((r, i) => i === rowIndex ? { ...r, [col]: value } : r);
    persistTables(tables.map(t => t.id === current.id ? { ...t, rows } : t));
  }

  function deleteRows() {
    if (!current || !selected.length) return;
    const set = new Set(selected);
    persistTables(tables.map(t => t.id === current.id ? { ...t, rows: t.rows.filter((_, i) => !set.has(i)) } : t));
    setSelected([]); notify(`${selected.length} registro(s) excluído(s).`);
  }

  function deleteTable(id: string) {
    const t = tables.find(x => x.id === id);
    if (!t || !confirm(`Excluir a tabela "${t.name}"?`)) return;
    persistTables(tables.filter(x => x.id !== id));
    setActive("dashboard"); notify("Tabela excluída.");
  }

  function addColumn() {
    if (!current) return;
    const col = prompt("Nome da nova coluna:");
    if (!col?.trim() || current.columns.includes(col.trim())) return;
    const c = col.trim();
    const rows = current.rows.map(r => ({ ...r, [c]: "" }));
    persistTables(tables.map(t => t.id === current.id ? { ...t, columns: [...t.columns, c], rows } : t));
    notify("Coluna adicionada.");
  }

  function removeColumn(col: string) {
    if (!current || current.columns.length <= 1 || !confirm(`Remover a coluna "${col}"?`)) return;
    const cols = current.columns.filter(c => c !== col);
    const rows = current.rows.map(r => { const n = { ...r }; delete n[col]; return n; });
    persistTables(tables.map(t => t.id === current.id ? { ...t, columns: cols, rows } : t));
    notify("Coluna removida.");
  }

  function duplicateTable() {
    if (!current) return;
    const copy: TableDef = { ...current, id: uid(), name: current.name + " (cópia)", rows: current.rows.map(r => ({ ...r })), createdAt: Date.now() };
    persistTables([...tables, copy]); setActive(copy.id); notify("Tabela duplicada.");
  }

  function exportCsv() {
    if (!current) return;
    const esc = (v: string) => `"${String(v ?? "").replaceAll('"', '""')}"`;
    const csv = [current.columns.map(esc).join(","), ...current.rows.map(r => current.columns.map(c => esc(r[c] || "")).join(","))].join("\n");
    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = current.name.replace(/[^a-z0-9_-]+/gi, "_") + ".csv"; a.click();
    URL.revokeObjectURL(a.href); notify("CSV exportado.");
  }

  function importDataFile() {
    const input=document.createElement("input");
    input.type="file";
    input.accept=".csv,.txt,text/csv,text/plain";
    input.onchange=async()=>{
      const file=input.files?.[0];
      if(!file||!current)return;
      try{
        const text=(await file.text()).replace(/^\ufeff/,"").replace(/\r\n/g,"\n").replace(/\r/g,"\n");
        const lines=text.split("\n").filter(line=>line.trim()!=="");
        if(!lines.length)return notify("O arquivo está vazio.");
        const candidates=[",",";","\\t","|"];
        const delimiter=candidates.sort((a,b)=>lines[0].split(b === "\\t" ? "\t" : b).length-lines[0].split(a === "\\t" ? "\t" : a).length)[0] === "\\t" ? "\t" : candidates[0];
        const parseLine=(line:string)=>{
          const values:string[]=[];let value="";let quoted=false;
          for(let i=0;i<line.length;i++){
            const ch=line[i];
            if(ch==='"'){
              if(quoted&&line[i+1]==='"'){value+='"';i++;}else quoted=!quoted;
            }else if(ch===delimiter&&!quoted){values.push(value.trim());value="";}
            else value+=ch;
          }
          values.push(value.trim());return values;
        };
        const fileColumns=parseLine(lines[0]).map((v,i)=>v||`Coluna ${i+1}`);
        const newColumns=[...current.columns,...fileColumns.filter(c=>!current.columns.includes(c))];
        const imported=lines.slice(1).map(line=>{
          const values=parseLine(line);const row:Row={};
          newColumns.forEach((column,index)=>row[column]=values[index]??"");
          return row;
        }).filter(row=>Object.values(row).some(Boolean));
        persistTables(tables.map(t=>t.id===current.id?{...t,columns:newColumns,rows:[...t.rows,...imported]}:t));
        notify(`${imported.length} registro(s) importado(s) de ${file.name}.`);
      }catch{notify("Não foi possível ler o arquivo.");}
    };
    input.click();
  }

  async function testSource() {
    if (!url.trim()) return notify("Informe a URL da fonte.");
    setTesting(true);
    try {
      const r = await fetch(API + "/api/source/test", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ url: url.trim(), token: token.trim() || undefined }) });
      const d = await r.json();
      notify(d.connected ? "Conexão funcionando." : "A fonte respondeu com erro.");
    } catch { notify("Não foi possível acessar o backend."); }
    finally { setTesting(false); }
  }

  async function connectSource() {
    if (!name.trim() || !url.trim()) return notify("Preencha nome e URL.");
    setTesting(true);
    try {
      const r = await fetch(API + "/api/source/test", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ url: url.trim(), token: token.trim() || undefined }) });
      const d = await r.json();
      if (!d.connected) return notify("Não foi possível conectar.");
      const s = { id: uid(), name: name.trim(), url: url.trim(), token: token.trim() || undefined, connected: true, status: "online" };
      persistSources([...sources, s]); setActive(s.id); setModal(null); reset(); notify("Fonte conectada.");
    } catch { notify("Falha na conexão."); } finally { setTesting(false); }
  }

  const filteredRows = useMemo(() => {
    if (!current) return [];
    const needle = query.toLowerCase().trim();
    let rows = current.rows.map((row, index) => ({ row, index })).filter(x => !needle || current.columns.some(c => (x.row[c] || "").toLowerCase().includes(needle)));\n    if (filterCol && filterValue.trim()) { const v = filterValue.toLowerCase(); rows = rows.filter(x => { const cell = (x.row[filterCol] || "").toLowerCase(); return filterOp === "equals" ? cell === v : filterOp === "starts" ? cell.startsWith(v) : cell.includes(v); }); }
    if (sort) rows.sort((a, b) => (a.row[sort.col] || "").localeCompare(b.row[sort.col] || "", "pt-BR", { numeric: true }) * (sort.dir === "asc" ? 1 : -1));
    return rows;
  }, [current, query, sort]);

  const pages = Math.max(1, Math.ceil(filteredRows.length / pageSize));
  const pageRows = filteredRows.slice((page - 1) * pageSize, page * pageSize);
  const totalRecords = tables.reduce((n, t) => n + t.rows.length, 0);

  function openTable(id: string) { setActive(id); setQuery(""); setPage(1); setSelected([]); setSort(null); }
  function toggleAll() { setSelected(selected.length === pageRows.length ? [] : pageRows.map(x => x.index)); }
  function toggleRow(i: number) { setSelected(selected.includes(i) ? selected.filter(x => x !== i) : [...selected, i]); }

  return <div className="app">
    <aside>
      <div className="brand"><span>✦</span><b>LATAM</b><small>DATA MANAGER</small></div>
      <button className={active === "dashboard" ? "sel" : ""} onClick={() => setActive("dashboard")}><LayoutDashboard/>Dashboard</button>
      <div className="label">WORKSPACE</div>
      {tables.map(t => <button className={active === t.id ? "sel" : ""} onClick={() => openTable(t.id)} key={t.id}><Table2Icon/><span className="nav-name">{t.name}</span><span className="count">{t.rows.length}</span></button>)}
      <button className="connect" onClick={() => { reset(); setModal("table"); }}><Plus/>Nova tabela</button>
      <div className="label source-label">CONEXÕES</div>
      {sources.map(s => <button className={active === s.id ? "sel" : ""} onClick={() => setActive(s.id)} key={s.id}><LinkIcon/><span className="nav-name">{s.name}</span><span className="status-dot"/></button>)}
      <button onClick={() => { reset(); setModal("source"); }}><Plus/>Conectar fonte</button>
      <div className="bottom"><button><Settings/>Configurações</button><button onClick={onLogout}>Sair</button></div>
    </aside>

    <main>
      <header>
        <div className="page-title"><div className="eyebrow"><Activity/> WORKSPACE</div><h1>{active === "dashboard" ? "Visão geral" : current?.name || source?.name || "Fonte"}</h1><p>{active === "dashboard" ? "Controle seus dados, tabelas e conexões em um só lugar." : current?.description || "Gerenciamento profissional de dados"}</p></div>
        <div className="actions">
          {current && <><button onClick={exportCsv}><Download/>Exportar</button><button className="primary" onClick={() => addRow()}><Plus/>Novo registro</button></>}
          {active === "dashboard" && <button className="primary" onClick={() => { reset(); setModal("table"); }}><Plus/>Nova tabela</button>}
        </div>
      </header>

      {active === "dashboard" ? <Dashboard tables={tables} sources={sources} totalRecords={totalRecords} onOpen={openTable} /> :
      current ? <section className="data-panel">
        <div className="table-head">
          <div><div className="table-title"><FileSpreadsheet/>{current.name}</div><small>{current.rows.length} registros · {current.columns.length} campos</small></div>
          <div className="head-tools"><button title="Duplicar" onClick={duplicateTable}><Copy/></button><button title="Atualizar"><RefreshCw/></button><button title="Mais"><MoreHorizontal/></button></div>
        </div>
        <div className="toolbar">
          <div className="search"><Search/><input value={query} onChange={e => { setQuery(e.target.value); setPage(1); }} placeholder="Pesquisar em todos os campos..." /></div>
          <div className="toolbar-actions">
            <button onClick={() => setDensity(density === "normal" ? "compact" : "normal")}><SlidersHorizontal/>{density === "normal" ? "Compacto" : "Confortável"}</button>
            <button onClick={importDataFile}><Upload/>Importar CSV/TXT</button>
            <button onClick={() => setModal("columns")}><Columns3/>Colunas</button>
            <button onClick={() => setModal("filter")}><Filter/>Filtro{filterCol && filterValue ? " • 1" : ""}</button>
          </div>
        </div>
        {selected.length > 0 && <div className="selectionbar"><b>{selected.length} selecionado(s)</b><button onClick={deleteRows}><Trash2/>Excluir</button><button onClick={() => setSelected([])}><X/>Limpar</button></div>}
        <div className="table-wrap">
          <table className={density === "compact" ? "compact" : ""}>
            <thead><tr><th className="check"><input type="checkbox" checked={pageRows.length > 0 && selected.length === pageRows.length} onChange={toggleAll}/></th>
              {current.columns.map(c => <th key={c}><button className="th-sort" onClick={() => setSort({ col: c, dir: sort?.col === c && sort.dir === "asc" ? "desc" : "asc" })}>{c}{sort?.col === c ? (sort.dir === "asc" ? <ArrowUpAZ/> : <ArrowDownAZ/>) : <ChevronDown/>}</button></th>)}<th className="actions-col">Ações</th></tr></thead>
            <tbody>{pageRows.map(({ row, index }) => <tr key={index} className={selected.includes(index) ? "selected-row" : ""}>
              <td className="check"><input type="checkbox" checked={selected.includes(index)} onChange={() => toggleRow(index)}/></td>
              {current.columns.map(c => <td key={c}><input value={row[c] || ""} onChange={e => updateCell(index, c, e.target.value)} /></td>)}
              <td><button className="row-action" onClick={() => { setSelected([index]); notify("Registro selecionado."); }}><Edit3/></button><button className="row-action danger-icon" onClick={() => { persistTables(tables.map(t => t.id === current.id ? { ...t, rows: t.rows.filter((_, i) => i !== index) } : t)); notify("Registro excluído."); }}><Trash2/></button></td>
            </tr>)}</tbody>
          </table>
          {!pageRows.length && <div className="empty"><Database/><h3>{query ? "Nenhum resultado" : "Sua tabela está vazia"}</h3><p>{query ? "Tente outra busca ou limpe o filtro." : "Comece adicionando seu primeiro registro."}</p><button className="primary" onClick={() => addRow()}><Plus/>Adicionar registro</button></div>}
        </div>
        <div className="pagination"><span>Mostrando {pageRows.length} de {filteredRows.length}</span><div><select value={pageSize} onChange={e => { setPageSize(Number(e.target.value)); setPage(1); }}><option value="10">10 / página</option><option value="25">25 / página</option><option value="50">50 / página</option><option value="100">100 / página</option></select><button disabled={page <= 1} onClick={() => setPage(page - 1)}>Anterior</button><b>{page} / {pages}</b><button disabled={page >= pages} onClick={() => setPage(page + 1)}>Próxima</button></div></div>
      </section> :
      source ? <section className="data-panel source-page"><div className="table-head"><div><div className="table-title"><LinkIcon/>{source.name}<span className="online">ONLINE</span></div><small>{source.url}</small></div><button className="primary" onClick={() => { reset(); setName(source.name); setUrl(source.url); setToken(source.token || ""); setModal("source"); }}><RefreshCw/>Reconectar</button></div><div className="source-card"><div><Check/>Fonte acessível</div><p>Conexão salva no workspace. O próximo passo é mapear esta fonte para tabelas e sincronizar seus dados.</p></div></section> : null}

      <footer>LATAM Data Manager <span>•</span> by Souza</footer>
    </main>

    {modal && <div className="overlay" onMouseDown={e => { if (e.target === e.currentTarget) setModal(null); }}><div className="modal">
      <div className="modalhead"><div><div className="eyebrow">CONFIGURAÇÃO</div><h2>{modal === "table" ? "Nova tabela" : modal === "columns" ? "Gerenciar colunas" : modal === "filter" ? "Filtro avançado" : "Conectar fonte"}</h2><p>{modal === "table" ? "Estruture seus dados do jeito que precisar." : modal === "columns" ? "Adicione ou remova campos desta tabela." : modal === "filter" ? "Crie uma regra para reduzir a lista de registros." : "Conecte uma API ou fonte externa ao workspace."}</p></div><button className="close" onClick={() => setModal(null)}><X/></button></div>
      {modal === "table" && <><label>Nome da tabela<input autoFocus value={name} onChange={e => setName(e.target.value)} placeholder="Ex.: Membros"/></label><label>Descrição <span>opcional</span><input value={description} onChange={e => setDescription(e.target.value)} placeholder="Para que esta tabela serve?"/></label><label>Colunas <span>separadas por vírgula</span><input value={columns} onChange={e => setColumns(e.target.value)} placeholder="Nome, ID, Status, Cargo"/></label><div className="modal-hint"><Columns3/> Você poderá adicionar ou remover colunas depois.</div></>}
      {modal === "filter" && current && <><label>Campo<select value={filterCol} onChange={e => setFilterCol(e.target.value)}><option value="">Selecione uma coluna</option>{current.columns.map(c => <option key={c} value={c}>{c}</option>)}</select></label><label>Condição<select value={filterOp} onChange={e => setFilterOp(e.target.value as typeof filterOp)}><option value="contains">Contém</option><option value="equals">É exatamente</option><option value="starts">Começa com</option></select></label><label>Valor<input autoFocus value={filterValue} onChange={e => { setFilterValue(e.target.value); setPage(1); }} placeholder="Digite o valor..." /></label><div className="modal-hint"><Filter/> Combine pesquisa e filtro para encontrar registros rapidamente.</div></>}\n      {modal === "columns" && current && <><div className="column-list">{current.columns.map(c => <div key={c}><span>{c}</span><button disabled={current.columns.length <= 1} onClick={() => removeColumn(c)}><Trash2/></button></div>)}</div><button className="primary full" onClick={addColumn}><Plus/>Adicionar coluna</button></>}
      {modal === "source" && <><label>Nome da conexão<input autoFocus value={name} onChange={e => setName(e.target.value)} placeholder="Ex.: Google Sheets"/></label><label>URL da fonte<input value={url} onChange={e => setUrl(e.target.value)} placeholder="https://..."/></label><label>API Key / Token <span>opcional</span><input type="password" value={token} onChange={e => setToken(e.target.value)} placeholder="Cole sua chave ou token"/></label><div className="modal-hint"><Database/> As credenciais ficam apenas neste navegador.</div></>}
      <div className="modalactions"><button onClick={() => setModal(null)}>Cancelar</button>{modal === "source" && <button onClick={testSource} disabled={testing}>{testing ? "Testando..." : "Testar conexão"}</button>}{modal === "filter" && <button className="primary" onClick={() => { setPage(1); setModal(null); }}>Aplicar filtro</button>}{modal !== "columns" && modal !== "filter" && <button className="primary" onClick={modal === "table" ? createTable : connectSource} disabled={testing}>{testing ? "Aguarde..." : modal === "table" ? "Criar tabela" : "Conectar"}</button>}</div>
    </div></div>}
    {toast && <div className="toast"><Check/>{toast}</div>}
  </div>;
}

function Table2Icon() { return <Database/>; }
function LinkIcon() { return <span className="link-icon">↗</span>; }

function Dashboard({ tables, sources, totalRecords, onOpen }: { tables: TableDef[]; sources: Source[]; totalRecords: number; onOpen: (id: string) => void }) {
  return <section className="dashboard">
    <div className="metric-grid">
      <Metric icon={<Table2Icon/>} value={tables.length} label="Tabelas" />
      <Metric icon={<Database/>} value={sources.length} label="Conexões" />
      <Metric icon={<Users/>} value={totalRecords} label="Registros" />
      <Metric icon={<BarChart3/>} value={tables.length ? Math.round(totalRecords / tables.length) : 0} label="Média por tabela" />
    </div>
    <div className="dashboard-grid">
      <div className="dash-panel"><div className="panel-title"><div><h3>Suas tabelas</h3><span>Estruturas e volume de dados</span></div><button><MoreHorizontal/></button></div>
        {!tables.length ? <div className="dash-empty"><Database/><p>Nenhuma tabela criada ainda.</p></div> : <div className="table-list">{tables.map(t => <button key={t.id} onClick={() => onOpen(t.id)}><span className="table-icon"><FileSpreadsheet/></span><span><b>{t.name}</b><small>{t.columns.length} campos · {t.rows.length} registros</small></span><ChevronRight/></button>)}</div>}
      </div>
      <div className="dash-panel"><div className="panel-title"><div><h3>Atividade</h3><span>Resumo do workspace</span></div><Activity/></div><div className="activity"><div><span className="activity-dot"/><p><b>{tables.length}</b> tabelas disponíveis<small>Workspace atual</small></p></div><div><span className="activity-dot"/><p><b>{totalRecords}</b> registros armazenados<small>Dados locais</small></p></div><div><span className="activity-dot"/><p><b>{sources.length}</b> conexões configuradas<small>Fontes externas</small></p></div></div></div>
    </div>
  </section>;
}
function Metric({ icon, value, label }: { icon: React.ReactNode; value: number; label: string }) {
  return <div className="metric"><span>{icon}</span><div><b>{value}</b><small>{label}</small></div><Activity/></div>;
}
export default App;
