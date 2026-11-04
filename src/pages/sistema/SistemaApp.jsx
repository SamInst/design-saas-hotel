import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  LayoutDashboard, Hotel, Receipt, Layers, UserCircle, Network, ScrollText, LogOut, Plus, Search,
  Loader2, X, Check, AlertCircle, RefreshCw, ShieldCheck, Eye, EyeOff, Trash2, Power,
} from 'lucide-react';
import { sistemaApi } from '../../services/api';
import { DatePicker } from '../../components/ui/DatePicker';
import { useTheme } from '../../hooks/useTheme';
import styles from './SistemaApp.module.css';

const SECOES = [
  { id: 'geral', label: 'Visão geral', icon: LayoutDashboard },
  { id: 'hoteis', label: 'Hotéis', icon: Hotel },
  { id: 'faturas', label: 'Mensalidades', icon: Receipt },
  { id: 'planos', label: 'Planos', icon: Layers },
  { id: 'proprietarios', label: 'Proprietários', icon: UserCircle },
  { id: 'redes', label: 'Redes', icon: Network },
  { id: 'auditoria', label: 'Auditoria', icon: ScrollText },
];

const RECURSOS = [
  { id: 'STONE', label: 'Maquininha Stone' },
  { id: 'AUTO_CADASTRO', label: 'Auto-cadastro do hóspede' },
  { id: 'CONFIRMACAO_PRESENCA', label: 'Confirmação de presença' },
  { id: 'MULTI_HOTEL', label: 'Troca entre hotéis da rede' },
  { id: 'RELATORIO_REDE', label: 'Relatório consolidado da rede' },
];

const STATUS_ASSINATURA = ['TRIAL', 'ATIVA', 'INADIMPLENTE', 'SUSPENSA', 'CANCELADA'];
const ROTULO_STATUS = {
  TRIAL: 'Teste', ATIVA: 'Ativa', INADIMPLENTE: 'Inadimplente', SUSPENSA: 'Suspensa', CANCELADA: 'Cancelada',
  ABERTA: 'Aberta', PAGA: 'Paga', ATRASADA: 'Atrasada',
};
const FORMAS = ['PIX', 'Boleto', 'Cartão de crédito', 'Transferência', 'Dinheiro'];

const brl = (v) => Number(v ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const data = (v) => {
  if (!v) return '—';
  const d = new Date(String(v).length === 10 ? `${v}T00:00:00` : v);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('pt-BR');
};
const dataHora = (v) => {
  if (!v) return '—';
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
};
const mesAtual = () => new Date().toISOString().slice(0, 7);
const soDigitos = (s) => String(s ?? '').replace(/\D/g, '');
const fmtCnpj = (s) => {
  const d = soDigitos(s);
  return d.length === 14 ? d.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5') : s || '—';
};
const slug = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
  .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);

function Selo({ status }) {
  return <span className={[styles.selo, styles[`selo_${status}`]].join(' ')}>{ROTULO_STATUS[status] ?? status ?? '—'}</span>;
}

function Carregando() {
  return <div className={styles.carregando}><Loader2 size={20} className={styles.gira} /> Carregando…</div>;
}

function Erro({ msg, onTentar }) {
  if (!msg) return null;
  return (
    <div className={styles.erro} role="alert">
      <AlertCircle size={16} /> <span>{msg}</span>
      {onTentar && <button type="button" className={styles.linkBtn} onClick={onTentar}>Tentar de novo</button>}
    </div>
  );
}

function useCarga(fn, deps) {
  const [estado, setEstado] = useState({ dados: null, carregando: true, erro: '' });
  const carregar = useCallback(async () => {
    setEstado((e) => ({ ...e, carregando: true, erro: '' }));
    try {
      const dados = await fn();
      setEstado({ dados, carregando: false, erro: '' });
    } catch (err) {
      setEstado((e) => ({ ...e, carregando: false, erro: err.message }));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  useEffect(() => { carregar(); }, [carregar]);
  return { ...estado, recarregar: carregar };
}

function Gaveta({ titulo, sub, onFechar, children, rodape }) {
  useEffect(() => {
    const tecla = (e) => { if (e.key === 'Escape') onFechar(); };
    document.addEventListener('keydown', tecla);
    return () => document.removeEventListener('keydown', tecla);
  }, [onFechar]);
  return (
    <>
      <div className={styles.veu} onClick={onFechar} aria-hidden="true" />
      <aside className={styles.gaveta} role="dialog" aria-label={typeof titulo === 'string' ? titulo : undefined}>
        <header className={styles.gavetaTopo}>
          <div>
            <h2>{titulo}</h2>
            {sub && <p>{sub}</p>}
          </div>
          <button type="button" className={styles.iconeBtn} onClick={onFechar} aria-label="Fechar"><X size={18} /></button>
        </header>
        <div className={styles.gavetaCorpo}>{children}</div>
        {rodape && <footer className={styles.gavetaRodape}>{rodape}</footer>}
      </aside>
    </>
  );
}

function Decisao({ texto, rotulo = 'Confirmar', perigo, onConfirmar, children }) {
  const [aberto, setAberto] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!aberto) return undefined;
    const fora = (e) => { if (ref.current && !ref.current.contains(e.target)) setAberto(false); };
    document.addEventListener('mousedown', fora);
    return () => document.removeEventListener('mousedown', fora);
  }, [aberto]);
  const confirmar = async () => {
    setOcupado(true);
    try { await onConfirmar(); setAberto(false); } finally { setOcupado(false); }
  };
  return (
    <span className={styles.decisao} ref={ref}>
      {children(() => setAberto((v) => !v))}
      {aberto && (
        <span className={styles.balao} role="alertdialog">
          <span>{texto}</span>
          <span className={styles.balaoAcoes}>
            <button type="button" className={styles.btnGhost} onClick={() => setAberto(false)}>Voltar</button>
            <button type="button" className={perigo ? styles.btnPerigo : styles.btnPrimario} onClick={confirmar} disabled={ocupado}>
              {ocupado ? <Loader2 size={14} className={styles.gira} /> : rotulo}
            </button>
          </span>
        </span>
      )}
    </span>
  );
}

function Campo({ label, children, largura, dica, bloco }) {
  const Tag = bloco ? 'div' : 'label';
  return (
    <Tag className={styles.campo} style={largura ? { gridColumn: `span ${largura}` } : undefined}>
      <span className={styles.campoRotulo}>{label}</span>
      {children}
      {dica && <small className={styles.campoDica}>{dica}</small>}
    </Tag>
  );
}

const mascaraCpf = (v) => soDigitos(v).slice(0, 11).replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d{1,2})$/, '$1-$2');
const mascaraCep = (v) => soDigitos(v).slice(0, 8).replace(/(\d{5})(\d{1,3})$/, '$1-$2');
const mascaraTelefone = (v) => {
  const d = soDigitos(v).slice(0, 11);
  if (d.length <= 2) return d.length ? `(${d}` : '';
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
};
const isoParaData = (iso) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso ?? '');
  return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null;
};
const dataParaIso = (d) => (d ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` : '');

function SistemaLogin({ onEntrar }) {
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [ver, setVer] = useState(false);
  const [erro, setErro] = useState('');
  const [carregando, setCarregando] = useState(false);

  const enviar = async (e) => {
    e.preventDefault();
    if (!email.trim() || !senha) { setErro('Informe e-mail e senha'); return; }
    setErro('');
    setCarregando(true);
    try {
      const r = await sistemaApi.login(email.trim(), senha);
      onEntrar(r);
    } catch (err) {
      setErro(err.status === 429 ? 'Muitas tentativas. Aguarde um minuto.' : err.message);
    } finally {
      setCarregando(false);
    }
  };

  return (
    <div className={styles.loginPagina}>
      <form className={styles.loginCaixa} onSubmit={enviar} noValidate>
        <span className={styles.loginIcone}><ShieldCheck size={22} /></span>
        <h1>Administração do sistema</h1>
        <p>Acesso restrito à gestão de hotéis, planos e mensalidades.</p>
        <Campo label="E-mail">
          <input type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} autoFocus />
        </Campo>
        <Campo label="Senha">
          <span className={styles.senha}>
            <input type={ver ? 'text' : 'password'} autoComplete="current-password" value={senha} onChange={(e) => setSenha(e.target.value)} />
            <button type="button" className={styles.iconeBtn} onClick={() => setVer((v) => !v)} aria-label={ver ? 'Ocultar senha' : 'Mostrar senha'}>
              {ver ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </span>
        </Campo>
        <Erro msg={erro} />
        <button type="submit" className={styles.btnPrimario} disabled={carregando}>
          {carregando ? <Loader2 size={16} className={styles.gira} /> : 'Entrar'}
        </button>
      </form>
    </div>
  );
}

function VisaoGeral({ irPara }) {
  const { dados, carregando, erro, recarregar } = useCarga(() => sistemaApi.dashboard(), []);
  if (carregando && !dados) return <Carregando />;
  if (erro && !dados) return <Erro msg={erro} onTentar={recarregar} />;
  const d = dados;
  const cards = [
    { rotulo: 'Receita recorrente (MRR)', valor: brl(d.mrr), sub: 'assinaturas ativas, mensalizado' },
    { rotulo: 'Recebido no mês', valor: brl(d.recebido_mes) },
    { rotulo: 'Em aberto', valor: brl(d.em_aberto) },
    { rotulo: 'Atrasado', valor: brl(d.atrasado), sub: `${d.faturas_atrasadas} fatura(s)`, alerta: Number(d.atrasado) > 0, acao: () => irPara('faturas') },
    { rotulo: 'Hotéis ativos', valor: d.hoteis_ativos, sub: `${d.hoteis_inativos} inativo(s) · ${d.redes} rede(s)`, acao: () => irPara('hoteis') },
    { rotulo: 'Em teste', valor: d.em_trial },
    { rotulo: 'Inadimplentes', valor: d.inadimplentes, alerta: d.inadimplentes > 0 },
  ];
  const maxMes = Math.max(1, ...d.receita_mensal.map((m) => Number(m.recebido)));
  return (
    <div className={styles.secao}>
      <div className={styles.cards}>
        {cards.map((c) => (
          <button type="button" key={c.rotulo} className={[styles.card, c.alerta ? styles.cardAlerta : ''].join(' ')}
            onClick={c.acao} disabled={!c.acao}>
            <span className={styles.cardRotulo}>{c.rotulo}</span>
            <b className={styles.cardValor}>{c.valor}</b>
            {c.sub && <small>{c.sub}</small>}
          </button>
        ))}
      </div>
      <div className={styles.duasColunas}>
        <section className={styles.painel}>
          <h3>Assinaturas por plano</h3>
          <table className={styles.tabela}>
            <thead><tr><th>Plano</th><th className={styles.num}>Hotéis</th><th className={styles.num}>Receita/mês</th></tr></thead>
            <tbody>
              {d.por_plano.map((p) => (
                <tr key={p.id}><td>{p.nome}</td><td className={styles.num}>{p.hoteis}</td><td className={styles.num}>{brl(p.receita)}</td></tr>
              ))}
            </tbody>
          </table>
        </section>
        <section className={styles.painel}>
          <h3>Recebido nos últimos 12 meses</h3>
          <ul className={styles.meses}>
            {d.receita_mensal.map((m) => (
              <li key={m.mes}>
                <span>{m.mes.slice(5)}/{m.mes.slice(2, 4)}</span>
                <span className={styles.mesTrilho}><span style={{ width: `${(Number(m.recebido) / maxMes) * 100}%` }} /></span>
                <b>{brl(m.recebido)}</b>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}

const HOTEL_VAZIO = {
  codigo: '', nome: '', razaoSocial: '', cnpj: '', inscricaoEstadual: '', inscricaoMunicipal: '', cadastur: '',
  naturezaJuridica: '', porte: '', optanteSimples: null, cnae: '', dataAbertura: '', situacaoCadastral: '',
  email: '', telefone: '', whatsapp: '', site: '', cep: '', endereco: '', numero: '', complemento: '', bairro: '',
  municipio: '', estado: '', pais: 'Brasil', checkinPadrao: '12:00', checkoutPadrao: '12:00', redeId: '',
  planoId: '', ciclo: 'MENSAL', valor: '', diaVencimento: 10,
};

const doBanco = (h) => ({
  ...HOTEL_VAZIO,
  codigo: h.codigo ?? '', nome: h.nome ?? '', razaoSocial: h.razao_social ?? '', cnpj: h.cnpj ?? '',
  inscricaoEstadual: h.inscricao_estadual ?? '', inscricaoMunicipal: h.inscricao_municipal ?? '', cadastur: h.cadastur ?? '',
  naturezaJuridica: h.natureza_juridica ?? '', porte: h.porte ?? '', optanteSimples: h.optante_simples, cnae: h.cnae ?? '',
  dataAbertura: h.data_abertura ?? '', situacaoCadastral: h.situacao_cadastral ?? '', email: h.email ?? '',
  telefone: h.telefone ?? '', whatsapp: h.whatsapp ?? '', site: h.site ?? '', cep: h.cep ?? '', endereco: h.endereco ?? '',
  numero: h.numero ?? '', complemento: h.complemento ?? '', bairro: h.bairro ?? '', municipio: h.municipio ?? '',
  estado: h.estado ?? '', pais: h.pais ?? 'Brasil', checkinPadrao: (h.checkin_padrao ?? '12:00').slice(0, 5),
  checkoutPadrao: (h.checkout_padrao ?? '12:00').slice(0, 5), redeId: h.fk_rede ?? '',
});

const paraApi = (f) => ({
  ...f,
  redeId: f.redeId === '' ? null : Number(f.redeId),
  planoId: f.planoId === '' ? null : Number(f.planoId),
  valor: f.valor === '' ? null : Number(f.valor),
  diaVencimento: Number(f.diaVencimento) || 10,
  dataAbertura: f.dataAbertura || null,
});

function HotelForm({ form, setForm, novo, redes, planos }) {
  const [buscando, setBuscando] = useState(false);
  const [erroCnpj, setErroCnpj] = useState('');
  const set = (k) => (e) => {
    const v = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    setForm((f) => ({ ...f, [k]: v, ...(k === 'nome' && novo && !f.codigoEditado ? { codigo: slug(v) } : {}) }));
  };
  const buscarCnpj = async () => {
    setErroCnpj('');
    setBuscando(true);
    try {
      const r = await sistemaApi.cnpj(form.cnpj);
      setForm((f) => {
        const nome = f.nome || r.nome || r.razaoSocial || '';
        return {
          ...f, ...Object.fromEntries(Object.entries(r).filter(([, v]) => v !== null && v !== undefined && v !== '')),
          nome, codigo: f.codigo || slug(nome), complemento: (r.complemento ?? f.complemento ?? '').replace(/;\s*$/, ''),
        };
      });
    } catch (err) {
      setErroCnpj(err.message);
    } finally {
      setBuscando(false);
    }
  };
  const planoSel = planos.find((p) => String(p.id) === String(form.planoId));
  return (
    <div className={styles.form}>
      <h4 className={styles.formTitulo}>Identificação</h4>
      <div className={styles.grade}>
        <Campo label="CNPJ" largura={2}>
          <span className={styles.comBotao}>
            <input value={form.cnpj} onChange={set('cnpj')} inputMode="numeric" placeholder="00.000.000/0000-00" />
            <button type="button" className={styles.btnSecundario} onClick={buscarCnpj} disabled={buscando || soDigitos(form.cnpj).length !== 14}>
              {buscando ? <Loader2 size={14} className={styles.gira} /> : <Search size={14} />} Buscar
            </button>
          </span>
        </Campo>
        <Campo label="Nome do hotel" largura={2}><input value={form.nome} onChange={set('nome')} /></Campo>
        <Campo label="Código de acesso" largura={2} dica="Identifica o hotel no auto-cadastro (?hotel=código)">
          <input value={form.codigo} onChange={(e) => setForm((f) => ({ ...f, codigo: slug(e.target.value), codigoEditado: true }))} />
        </Campo>
        <Campo label="Razão social" largura={4}><input value={form.razaoSocial} onChange={set('razaoSocial')} /></Campo>
        <Campo label="Natureza jurídica" largura={2}><input value={form.naturezaJuridica} onChange={set('naturezaJuridica')} /></Campo>
        <Campo label="Porte" largura={2}><input value={form.porte} onChange={set('porte')} /></Campo>
        <Campo label="Atividade (CNAE)" largura={2}><input value={form.cnae} onChange={set('cnae')} /></Campo>
        <Campo label="Abertura"><input type="date" value={form.dataAbertura ?? ''} onChange={set('dataAbertura')} /></Campo>
        <Campo label="Situação"><input value={form.situacaoCadastral} onChange={set('situacaoCadastral')} /></Campo>
        <Campo label="Inscrição estadual" largura={2}><input value={form.inscricaoEstadual} onChange={set('inscricaoEstadual')} /></Campo>
        <Campo label="Inscrição municipal" largura={2}><input value={form.inscricaoMunicipal} onChange={set('inscricaoMunicipal')} /></Campo>
        <Campo label="Cadastur" largura={2}><input value={form.cadastur} onChange={set('cadastur')} /></Campo>
        <label className={styles.check} style={{ gridColumn: 'span 2' }}>
          <input type="checkbox" checked={!!form.optanteSimples} onChange={set('optanteSimples')} /> Optante pelo Simples
        </label>
        <Campo label="Rede / franquia" largura={4}>
          <select value={form.redeId ?? ''} onChange={set('redeId')}>
            <option value="">Hotel independente</option>
            {redes.map((r) => <option key={r.id} value={r.id}>{r.nome}</option>)}
          </select>
        </Campo>
      </div>
      {erroCnpj && <Erro msg={erroCnpj} />}

      <h4 className={styles.formTitulo}>Contato</h4>
      <div className={styles.grade}>
        <Campo label="E-mail" largura={3}><input type="email" value={form.email} onChange={set('email')} /></Campo>
        <Campo label="Site" largura={3}><input value={form.site} onChange={set('site')} /></Campo>
        <Campo label="Telefone" largura={3}><input value={form.telefone} onChange={set('telefone')} /></Campo>
        <Campo label="WhatsApp" largura={3}><input value={form.whatsapp} onChange={set('whatsapp')} /></Campo>
      </div>

      <h4 className={styles.formTitulo}>Endereço</h4>
      <div className={styles.grade}>
        <Campo label="CEP" largura={2}><input value={form.cep} onChange={set('cep')} inputMode="numeric" /></Campo>
        <Campo label="Logradouro" largura={3}><input value={form.endereco} onChange={set('endereco')} /></Campo>
        <Campo label="Número"><input value={form.numero} onChange={set('numero')} /></Campo>
        <Campo label="Complemento" largura={2}><input value={form.complemento} onChange={set('complemento')} /></Campo>
        <Campo label="Bairro" largura={2}><input value={form.bairro} onChange={set('bairro')} /></Campo>
        <Campo label="Cidade" largura={2}><input value={form.municipio} onChange={set('municipio')} /></Campo>
        <Campo label="UF"><input value={form.estado} maxLength={2} onChange={set('estado')} /></Campo>
        <Campo label="País"><input value={form.pais} onChange={set('pais')} /></Campo>
        <Campo label="Check-in padrão" largura={2}><input type="time" value={form.checkinPadrao} onChange={set('checkinPadrao')} /></Campo>
        <Campo label="Check-out padrão" largura={2}><input type="time" value={form.checkoutPadrao} onChange={set('checkoutPadrao')} /></Campo>
      </div>

      {novo && (
        <>
          <h4 className={styles.formTitulo}>Plano</h4>
          <div className={styles.grade}>
            <Campo label="Plano" largura={2}>
              <select value={form.planoId} onChange={set('planoId')}>
                <option value="">Escolha…</option>
                {planos.filter((p) => p.ativo).map((p) => <option key={p.id} value={p.id}>{p.nome} · {brl(p.preco_mensal)}/mês</option>)}
              </select>
            </Campo>
            <Campo label="Ciclo">
              <select value={form.ciclo} onChange={set('ciclo')}><option value="MENSAL">Mensal</option><option value="ANUAL">Anual</option></select>
            </Campo>
            <Campo label="Valor" dica={planoSel ? `Tabela: ${brl(form.ciclo === 'ANUAL' ? planoSel.preco_anual ?? planoSel.preco_mensal : planoSel.preco_mensal)}` : undefined}>
              <input type="number" min="0" step="0.01" value={form.valor} onChange={set('valor')} placeholder="Tabela" />
            </Campo>
            <Campo label="Vencimento (dia)" largura={2}>
              <input type="number" min="1" max="28" value={form.diaVencimento} onChange={set('diaVencimento')} />
            </Campo>
          </div>
          <p className={styles.nota}>O hotel começa em período de teste. Mude para “Ativa” quando a primeira mensalidade for paga.</p>
        </>
      )}
    </div>
  );
}

function NovoHotel({ redes, planos, onFechar, onSalvo }) {
  const [form, setForm] = useState(HOTEL_VAZIO);
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);
  const salvar = async () => {
    setErro('');
    setSalvando(true);
    try {
      const h = await sistemaApi.criarHotel(paraApi(form));
      onSalvo(h);
    } catch (err) {
      setErro(err.message);
    } finally {
      setSalvando(false);
    }
  };
  return (
    <Gaveta titulo="Novo hotel" sub="Preencha pelo CNPJ e escolha o plano" onFechar={onFechar}
      rodape={<>
        <Erro msg={erro} />
        <button type="button" className={styles.btnGhost} onClick={onFechar}>Cancelar</button>
        <button type="button" className={styles.btnPrimario} onClick={salvar} disabled={salvando}>
          {salvando ? <Loader2 size={14} className={styles.gira} /> : <Check size={14} />} Cadastrar hotel
        </button>
      </>}>
      <HotelForm form={form} setForm={setForm} novo redes={redes} planos={planos} />
    </Gaveta>
  );
}

function DetalheHotel({ id, redes, planos, onFechar, onMudou }) {
  const { dados, carregando, erro, recarregar } = useCarga(() => sistemaApi.hotel(id), [id]);
  const [form, setForm] = useState(null);
  const [aba, setAba] = useState('assinatura');
  const [msg, setMsg] = useState({ erro: '', ok: '' });
  const [salvando, setSalvando] = useState(false);
  const [nova, setNova] = useState({ planoId: '', ciclo: 'MENSAL', valor: '', diaVencimento: 10, status: 'ATIVA', observacao: '' });

  useEffect(() => { if (dados) setForm(doBanco(dados)); }, [dados]);

  const executar = async (fn, ok) => {
    setMsg({ erro: '', ok: '' });
    try {
      await fn();
      setMsg({ erro: '', ok });
      await recarregar();
      onMudou();
    } catch (err) {
      setMsg({ erro: err.message, ok: '' });
    }
  };

  const salvarDados = async () => {
    setSalvando(true);
    await executar(() => sistemaApi.atualizarHotel(id, paraApi(form)), 'Dados salvos');
    setSalvando(false);
  };

  if (!dados || !form) {
    return <Gaveta titulo="Hotel" onFechar={onFechar}>{carregando ? <Carregando /> : <Erro msg={erro} onTentar={recarregar} />}</Gaveta>;
  }
  const vigente = dados.assinaturas.find((a) => a.status !== 'CANCELADA');
  const planoNovo = planos.find((p) => String(p.id) === String(nova.planoId));

  return (
    <Gaveta titulo={dados.nome} sub={`${fmtCnpj(dados.cnpj)} · ${dados.municipio ?? '—'}/${dados.estado ?? '—'}`} onFechar={onFechar}
      rodape={aba === 'dados' ? <>
        <Erro msg={msg.erro} />
        {msg.ok && <span className={styles.ok}><Check size={14} /> {msg.ok}</span>}
        <button type="button" className={styles.btnPrimario} onClick={salvarDados} disabled={salvando}>
          {salvando ? <Loader2 size={14} className={styles.gira} /> : <Check size={14} />} Salvar dados
        </button>
      </> : (msg.erro || msg.ok) ? <>
        <Erro msg={msg.erro} />
        {msg.ok && <span className={styles.ok}><Check size={14} /> {msg.ok}</span>}
      </> : null}>
      <div className={styles.abas} role="tablist">
        {[['assinatura', 'Assinatura'], ['dados', 'Dados do hotel'], ['proprietarios', 'Proprietários']].map(([k, l]) => (
          <button key={k} type="button" role="tab" aria-selected={aba === k} className={aba === k ? styles.abaAtiva : ''} onClick={() => setAba(k)}>{l}</button>
        ))}
      </div>

      {aba === 'dados' && <HotelForm form={form} setForm={setForm} redes={redes} planos={planos} />}

      {aba === 'assinatura' && (
        <div className={styles.form}>
          <div className={styles.resumo}>
            <div><small>Plano atual</small><b>{vigente?.plano_nome ?? 'Sem plano'}</b></div>
            <div><small>Status</small>{vigente ? <Selo status={vigente.status} /> : '—'}</div>
            <div><small>Valor</small><b>{vigente ? `${brl(vigente.valor)} / ${vigente.ciclo === 'ANUAL' ? 'ano' : 'mês'}` : '—'}</b></div>
            <div><small>Vencimento</small><b>{vigente ? `dia ${vigente.dia_vencimento}` : '—'}</b></div>
          </div>

          {vigente && (
            <>
              <h4 className={styles.formTitulo}>Mudar status</h4>
              <div className={styles.linhaBotoes}>
                {STATUS_ASSINATURA.filter((s) => s !== vigente.status).map((s) => (
                  <Decisao key={s} texto={`Mudar a assinatura para “${ROTULO_STATUS[s]}”?${s === 'SUSPENSA' || s === 'CANCELADA' ? ' O hotel perde o acesso ao sistema.' : ''}`}
                    perigo={s === 'SUSPENSA' || s === 'CANCELADA'}
                    onConfirmar={() => executar(() => sistemaApi.statusAssinatura(vigente.id, s), 'Status atualizado')}>
                    {(abrir) => <button type="button" className={styles.btnSecundario} onClick={abrir}>{ROTULO_STATUS[s]}</button>}
                  </Decisao>
                ))}
              </div>
            </>
          )}

          <h4 className={styles.formTitulo}>{vigente ? 'Trocar de plano' : 'Nova assinatura'}</h4>
          <div className={styles.grade}>
            <Campo label="Plano" largura={2}>
              <select value={nova.planoId} onChange={(e) => setNova({ ...nova, planoId: e.target.value })}>
                <option value="">Escolha…</option>
                {planos.filter((p) => p.ativo).map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
              </select>
            </Campo>
            <Campo label="Ciclo">
              <select value={nova.ciclo} onChange={(e) => setNova({ ...nova, ciclo: e.target.value })}>
                <option value="MENSAL">Mensal</option><option value="ANUAL">Anual</option>
              </select>
            </Campo>
            <Campo label="Status">
              <select value={nova.status} onChange={(e) => setNova({ ...nova, status: e.target.value })}>
                {STATUS_ASSINATURA.filter((s) => s !== 'CANCELADA').map((s) => <option key={s} value={s}>{ROTULO_STATUS[s]}</option>)}
              </select>
            </Campo>
            <Campo label="Valor" dica={planoNovo ? `Tabela: ${brl(nova.ciclo === 'ANUAL' ? planoNovo.preco_anual ?? planoNovo.preco_mensal : planoNovo.preco_mensal)}` : undefined}>
              <input type="number" min="0" step="0.01" value={nova.valor} placeholder="Tabela" onChange={(e) => setNova({ ...nova, valor: e.target.value })} />
            </Campo>
            <Campo label="Vencimento (dia)">
              <input type="number" min="1" max="28" value={nova.diaVencimento} onChange={(e) => setNova({ ...nova, diaVencimento: e.target.value })} />
            </Campo>
            <Campo label="Observação" largura={6}>
              <input value={nova.observacao} onChange={(e) => setNova({ ...nova, observacao: e.target.value })} />
            </Campo>
          </div>
          <div className={styles.linhaBotoes}>
            <Decisao texto={vigente ? 'A assinatura atual será encerrada e a nova começa hoje.' : 'Criar a assinatura?'}
              onConfirmar={() => executar(() => sistemaApi.novaAssinatura(id, {
                ...nova, planoId: Number(nova.planoId), valor: nova.valor === '' ? null : Number(nova.valor),
                diaVencimento: Number(nova.diaVencimento) || 10,
              }), 'Assinatura atualizada')}>
              {(abrir) => <button type="button" className={styles.btnPrimario} onClick={abrir} disabled={!nova.planoId}>Aplicar</button>}
            </Decisao>
          </div>

          <h4 className={styles.formTitulo}>Histórico</h4>
          <table className={styles.tabela}>
            <thead><tr><th>Plano</th><th>Status</th><th className={styles.num}>Valor</th><th>Início</th><th>Fim</th></tr></thead>
            <tbody>
              {dados.assinaturas.map((a) => (
                <tr key={a.id}><td>{a.plano_nome}</td><td><Selo status={a.status} /></td><td className={styles.num}>{brl(a.valor)}</td><td>{data(a.inicio)}</td><td>{data(a.fim)}</td></tr>
              ))}
            </tbody>
          </table>

          <h4 className={styles.formTitulo}>Acesso do hotel</h4>
          <Decisao texto={dados.ativo ? 'Desativar o hotel? Ninguém dele consegue entrar até reativar.' : 'Reativar o hotel?'}
            perigo={dados.ativo}
            onConfirmar={() => executar(() => sistemaApi.ativarHotel(id, !dados.ativo), dados.ativo ? 'Hotel desativado' : 'Hotel reativado')}>
            {(abrir) => (
              <button type="button" className={dados.ativo ? styles.btnPerigoGhost : styles.btnSecundario} onClick={abrir}>
                <Power size={14} /> {dados.ativo ? 'Desativar hotel' : 'Reativar hotel'}
              </button>
            )}
          </Decisao>
        </div>
      )}

      {aba === 'proprietarios' && (
        <div className={styles.form}>
          {dados.proprietarios.length === 0 ? (
            <p className={styles.vazio}>Nenhum proprietário vinculado. Vincule pela seção Proprietários.</p>
          ) : (
            <ul className={styles.listaSimples}>
              {dados.proprietarios.map((p) => (
                <li key={p.id}><b>{p.nome}</b><span>{p.email ?? '—'}</span>{p.principal && <span className={styles.selo}>Principal</span>}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </Gaveta>
  );
}

function Hoteis() {
  const lista = useCarga(() => sistemaApi.hoteis(), []);
  const aux = useCarga(() => Promise.all([sistemaApi.redes(), sistemaApi.planos()]), []);
  const [busca, setBusca] = useState('');
  const [novo, setNovo] = useState(false);
  const [aberto, setAberto] = useState(null);
  const [redes, planos] = aux.dados ?? [[], []];
  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return (lista.dados ?? []).filter((h) => !q || [h.nome, h.codigo, h.cnpj, h.municipio, h.rede_nome].some((v) => String(v ?? '').toLowerCase().includes(q)));
  }, [lista.dados, busca]);

  return (
    <div className={styles.secao}>
      <div className={styles.barra}>
        <span className={styles.busca}><Search size={15} /><input placeholder="Buscar hotel, código, CNPJ, cidade…" value={busca} onChange={(e) => setBusca(e.target.value)} /></span>
        <button type="button" className={styles.btnPrimario} onClick={() => setNovo(true)}><Plus size={15} /> Novo hotel</button>
      </div>
      {lista.carregando && !lista.dados ? <Carregando /> : <Erro msg={lista.erro} onTentar={lista.recarregar} />}
      {lista.dados && (
        <div className={styles.tabelaWrap}>
          <table className={styles.tabela}>
            <thead>
              <tr><th>Hotel</th><th>Rede</th><th>Plano</th><th>Assinatura</th><th className={styles.num}>Mensalidade</th><th className={styles.num}>Quartos</th><th className={styles.num}>Usuários</th><th>Situação</th></tr>
            </thead>
            <tbody>
              {filtrados.map((h) => (
                <tr key={h.id} className={styles.clicavel} onClick={() => setAberto(h.id)} tabIndex={0}
                  onKeyDown={(e) => { if (e.key === 'Enter') setAberto(h.id); }}>
                  <td><b>{h.nome}</b><small className={styles.sub}>{h.codigo} · {h.municipio ?? '—'}/{h.estado ?? '—'}</small></td>
                  <td>{h.rede_nome ?? '—'}</td>
                  <td>{h.plano_nome ?? '—'}</td>
                  <td>{h.assinatura_status ? <Selo status={h.assinatura_status} /> : '—'}{h.faturas_atrasadas > 0 && <small className={styles.alertaTxt}>{h.faturas_atrasadas} atrasada(s)</small>}</td>
                  <td className={styles.num}>{h.valor != null ? brl(h.valor) : '—'}</td>
                  <td className={styles.num}>{h.quartos}</td>
                  <td className={styles.num}>{h.usuarios}</td>
                  <td>{h.ativo ? <span className={styles.selo_ATIVA + ' ' + styles.selo}>Ativo</span> : <span className={styles.selo_CANCELADA + ' ' + styles.selo}>Inativo</span>}</td>
                </tr>
              ))}
              {filtrados.length === 0 && <tr><td colSpan={8} className={styles.vazio}>Nenhum hotel encontrado.</td></tr>}
            </tbody>
          </table>
        </div>
      )}
      {novo && <NovoHotel redes={redes} planos={planos} onFechar={() => setNovo(false)} onSalvo={(h) => { setNovo(false); lista.recarregar(); setAberto(h.id); }} />}
      {aberto && <DetalheHotel id={aberto} redes={redes} planos={planos} onFechar={() => setAberto(null)} onMudou={lista.recarregar} />}
    </div>
  );
}

function Faturas() {
  const [filtro, setFiltro] = useState({ status: '', competencia: '' });
  const lista = useCarga(() => sistemaApi.faturas(filtro), [filtro.status, filtro.competencia]);
  const [gerarMes, setGerarMes] = useState(mesAtual());
  const [msg, setMsg] = useState({ erro: '', ok: '' });
  const [pagando, setPagando] = useState(null);
  const [forma, setForma] = useState('PIX');

  const executar = async (fn, ok) => {
    setMsg({ erro: '', ok: '' });
    try { const r = await fn(); setMsg({ erro: '', ok: typeof ok === 'function' ? ok(r) : ok }); await lista.recarregar(); }
    catch (err) { setMsg({ erro: err.message, ok: '' }); }
  };

  const total = (lista.dados ?? []).reduce((s, f) => s + Number(f.valor) - Number(f.desconto), 0);

  return (
    <div className={styles.secao}>
      <div className={styles.barra}>
        <select value={filtro.status} onChange={(e) => setFiltro({ ...filtro, status: e.target.value })} aria-label="Status">
          <option value="">Todos os status</option>
          {['ABERTA', 'ATRASADA', 'PAGA', 'CANCELADA'].map((s) => <option key={s} value={s}>{ROTULO_STATUS[s]}</option>)}
        </select>
        <input type="month" value={filtro.competencia} onChange={(e) => setFiltro({ ...filtro, competencia: e.target.value })} aria-label="Competência" />
        <span className={styles.espaco} />
        <input type="month" value={gerarMes} onChange={(e) => setGerarMes(e.target.value)} aria-label="Mês para gerar" />
        <Decisao texto={`Gerar as mensalidades de ${gerarMes.slice(5)}/${gerarMes.slice(0, 4)} para todos os hotéis ativos? Faturas já existentes não são duplicadas.`}
          onConfirmar={() => executar(() => sistemaApi.gerarFaturas(gerarMes), (r) => `${r.criadas} fatura(s) gerada(s)`)}>
          {(abrir) => <button type="button" className={styles.btnPrimario} onClick={abrir}><RefreshCw size={14} /> Gerar mensalidades</button>}
        </Decisao>
      </div>
      <Erro msg={msg.erro} />
      {msg.ok && <p className={styles.ok}><Check size={14} /> {msg.ok}</p>}
      {lista.carregando && !lista.dados ? <Carregando /> : <Erro msg={lista.erro} onTentar={lista.recarregar} />}
      {lista.dados && (
        <div className={styles.tabelaWrap}>
          <table className={styles.tabela}>
            <thead><tr><th>Hotel</th><th>Competência</th><th>Vencimento</th><th className={styles.num}>Valor</th><th>Status</th><th>Pagamento</th><th /></tr></thead>
            <tbody>
              {lista.dados.map((f) => (
                <tr key={f.id}>
                  <td><b>{f.hotel_nome}</b><small className={styles.sub}>{f.plano_nome}</small></td>
                  <td>{String(f.competencia).slice(5, 7)}/{String(f.competencia).slice(0, 4)}</td>
                  <td>{data(f.vencimento)}</td>
                  <td className={styles.num}>{brl(Number(f.valor) - Number(f.desconto))}</td>
                  <td><Selo status={f.status} /></td>
                  <td>{f.pago_em ? <>{dataHora(f.pago_em)}<small className={styles.sub}>{f.forma_pagamento ?? ''}</small></> : '—'}</td>
                  <td className={styles.acoes}>
                    {(f.status === 'ABERTA' || f.status === 'ATRASADA') && (
                      <>
                        <Decisao texto={<span className={styles.balaoForm}>Dar baixa como paga via
                          <select value={forma} onChange={(e) => setForma(e.target.value)}>{FORMAS.map((x) => <option key={x}>{x}</option>)}</select></span>}
                          rotulo="Baixar"
                          onConfirmar={() => { setPagando(f.id); return executar(() => sistemaApi.pagarFatura(f.id, { formaPagamento: forma }), 'Pagamento registrado').finally(() => setPagando(null)); }}>
                          {(abrir) => <button type="button" className={styles.btnSecundario} onClick={abrir} disabled={pagando === f.id}>Pagar</button>}
                        </Decisao>
                        <Decisao texto="Cancelar esta fatura?" perigo rotulo="Cancelar fatura"
                          onConfirmar={() => executar(() => sistemaApi.cancelarFatura(f.id), 'Fatura cancelada')}>
                          {(abrir) => <button type="button" className={styles.iconeBtn} onClick={abrir} aria-label="Cancelar fatura"><X size={15} /></button>}
                        </Decisao>
                      </>
                    )}
                  </td>
                </tr>
              ))}
              {lista.dados.length === 0 && <tr><td colSpan={7} className={styles.vazio}>Nenhuma fatura.</td></tr>}
            </tbody>
            {lista.dados.length > 0 && <tfoot><tr><td colSpan={3}>Total listado</td><td className={styles.num}>{brl(total)}</td><td colSpan={3} /></tr></tfoot>}
          </table>
        </div>
      )}
    </div>
  );
}

function PlanoCard({ plano, telas, onSalvo }) {
  const [f, setF] = useState(() => ({
    nome: plano.nome, descricao: plano.descricao ?? '', precoMensal: plano.preco_mensal, precoAnual: plano.preco_anual ?? '',
    maxQuartos: plano.max_quartos ?? '', maxUsuarios: plano.max_usuarios ?? '', ativo: plano.ativo,
    telas: new Set(plano.telas.map(Number)), recursos: new Set(plano.recursos),
  }));
  const [msg, setMsg] = useState({ erro: '', ok: '' });
  const [salvando, setSalvando] = useState(false);
  const alterna = (k, v) => setF((x) => { const s = new Set(x[k]); if (s.has(v)) s.delete(v); else s.add(v); return { ...x, [k]: s }; });
  const num = (v) => (v === '' || v === null ? null : Number(v));
  const salvar = async () => {
    setSalvando(true);
    setMsg({ erro: '', ok: '' });
    try {
      await sistemaApi.atualizarPlano(plano.id, {
        nome: f.nome, descricao: f.descricao, precoMensal: num(f.precoMensal), precoAnual: num(f.precoAnual),
        maxQuartos: num(f.maxQuartos), maxUsuarios: num(f.maxUsuarios), ativo: f.ativo,
        telas: [...f.telas], recursos: [...f.recursos],
      });
      setMsg({ erro: '', ok: 'Plano salvo' });
      onSalvo();
    } catch (err) {
      setMsg({ erro: err.message, ok: '' });
    } finally {
      setSalvando(false);
    }
  };
  return (
    <section className={styles.planoCard}>
      <header>
        <input className={styles.planoNome} value={f.nome} onChange={(e) => setF({ ...f, nome: e.target.value })} aria-label="Nome do plano" />
        <span className={styles.sub}>{plano.codigo}</span>
        <label className={styles.check}><input type="checkbox" checked={f.ativo} onChange={(e) => setF({ ...f, ativo: e.target.checked })} /> Ativo</label>
      </header>
      <textarea rows={2} value={f.descricao} onChange={(e) => setF({ ...f, descricao: e.target.value })} aria-label="Descrição" />
      <div className={styles.grade}>
        <Campo label="Mensal (R$)" largura={3}><input type="number" min="0" step="0.01" value={f.precoMensal} onChange={(e) => setF({ ...f, precoMensal: e.target.value })} /></Campo>
        <Campo label="Anual (R$)" largura={3}><input type="number" min="0" step="0.01" value={f.precoAnual} onChange={(e) => setF({ ...f, precoAnual: e.target.value })} /></Campo>
        <Campo label="Máx. quartos" largura={3} dica="vazio = sem limite"><input type="number" min="1" value={f.maxQuartos} onChange={(e) => setF({ ...f, maxQuartos: e.target.value })} /></Campo>
        <Campo label="Máx. usuários" largura={3} dica="vazio = sem limite"><input type="number" min="1" value={f.maxUsuarios} onChange={(e) => setF({ ...f, maxUsuarios: e.target.value })} /></Campo>
      </div>
      <h4 className={styles.formTitulo}>Telas liberadas</h4>
      <div className={styles.checks}>
        {telas.map((t) => (
          <label key={t.id} className={styles.check} title={t.descricao}>
            <input type="checkbox" checked={f.telas.has(Number(t.id))} onChange={() => alterna('telas', Number(t.id))} /> {t.nome}
          </label>
        ))}
      </div>
      <h4 className={styles.formTitulo}>Recursos</h4>
      <div className={styles.checks}>
        {RECURSOS.map((r) => (
          <label key={r.id} className={styles.check}><input type="checkbox" checked={f.recursos.has(r.id)} onChange={() => alterna('recursos', r.id)} /> {r.label}</label>
        ))}
      </div>
      <footer>
        <Erro msg={msg.erro} />
        {msg.ok && <span className={styles.ok}><Check size={14} /> {msg.ok}</span>}
        <button type="button" className={styles.btnPrimario} onClick={salvar} disabled={salvando}>
          {salvando ? <Loader2 size={14} className={styles.gira} /> : <Check size={14} />} Salvar
        </button>
      </footer>
    </section>
  );
}

function Planos() {
  const { dados, carregando, erro, recarregar } = useCarga(() => Promise.all([sistemaApi.planos(), sistemaApi.telas()]), []);
  if (carregando && !dados) return <Carregando />;
  if (erro && !dados) return <Erro msg={erro} onTentar={recarregar} />;
  const [planos, telas] = dados;
  return (
    <div className={styles.secao}>
      <p className={styles.nota}>Mudanças valem para todos os hotéis do plano em até um minuto. O valor cobrado de cada hotel fica na assinatura dele.</p>
      <div className={styles.planos}>
        {planos.map((p) => <PlanoCard key={p.id} plano={p} telas={telas} onSalvo={recarregar} />)}
      </div>
    </div>
  );
}

const PROP_VAZIO = {
  nome: '', cpf: '', rg: '', dataNascimento: '', sexo: '', email: '', telefone: '', profissao: '', cep: '', endereco: '',
  numero: '', complemento: '', bairro: '', municipio: '', estado: '', pais: 'Brasil', ativo: true, username: '', senha: '',
};

const propDoBanco = (p) => ({
  ...PROP_VAZIO, nome: p.nome ?? '', cpf: mascaraCpf(p.cpf), rg: p.rg ?? '', dataNascimento: p.data_nascimento ?? '',
  sexo: p.sexo ?? '', email: p.email ?? '', telefone: mascaraTelefone(p.telefone), profissao: p.profissao ?? '', cep: mascaraCep(p.cep),
  endereco: p.endereco ?? '', numero: p.numero ?? '', complemento: p.complemento ?? '', bairro: p.bairro ?? '',
  municipio: p.municipio ?? '', estado: p.estado ?? '', pais: p.pais ?? 'Brasil', ativo: p.ativo, username: p.username ?? '',
});

function ProprietarioGaveta({ id, hoteis, onFechar, onMudou }) {
  const [form, setForm] = useState(PROP_VAZIO);
  const [vinculos, setVinculos] = useState([]);
  const [carregando, setCarregando] = useState(!!id);
  const [atualId, setAtualId] = useState(id);
  const [msg, setMsg] = useState({ erro: '', ok: '' });
  const [salvando, setSalvando] = useState(false);
  const [vinc, setVinc] = useState({ hotelId: '', principal: false });
  const [verSenha, setVerSenha] = useState(false);
  const [buscandoCep, setBuscandoCep] = useState(false);

  const aplicar = (p) => { setForm(propDoBanco(p)); setVinculos(p.hoteis ?? []); setAtualId(p.id); };

  useEffect(() => {
    if (!id) return;
    sistemaApi.proprietario(id).then(aplicar).catch((err) => setMsg({ erro: err.message, ok: '' })).finally(() => setCarregando(false));
  }, [id]);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));

  const alterarCep = async (e) => {
    const cep = mascaraCep(e.target.value);
    setForm((f) => ({ ...f, cep }));
    if (soDigitos(cep).length !== 8) return;
    setBuscandoCep(true);
    try {
      const d = await sistemaApi.cep(cep);
      setForm((f) => ({
        ...f,
        endereco: d.endereco || f.endereco, bairro: d.bairro || f.bairro,
        municipio: d.municipio || f.municipio, estado: d.estado || f.estado, pais: d.pais || f.pais,
      }));
    } catch (err) {
      setMsg({ erro: err.message, ok: '' });
    } finally {
      setBuscandoCep(false);
    }
  };

  const salvar = async () => {
    setSalvando(true);
    setMsg({ erro: '', ok: '' });
    const body = { ...form, cpf: soDigitos(form.cpf), telefone: soDigitos(form.telefone), cep: soDigitos(form.cep), sexo: form.sexo === '' ? null : Number(form.sexo), dataNascimento: form.dataNascimento || null, senha: form.senha || null, username: form.username || null };
    try {
      const p = atualId ? await sistemaApi.atualizarProprietario(atualId, body) : await sistemaApi.criarProprietario(body);
      aplicar(p);
      setForm((f) => ({ ...f, senha: '' }));
      setMsg({ erro: '', ok: 'Proprietário salvo' });
      onMudou();
    } catch (err) {
      setMsg({ erro: err.message, ok: '' });
    } finally {
      setSalvando(false);
    }
  };

  const vincular = async () => {
    setMsg({ erro: '', ok: '' });
    try {
      const p = await sistemaApi.vincular(atualId, { hotelId: Number(vinc.hotelId), principal: vinc.principal });
      aplicar(p);
      setVinc({ hotelId: '', principal: false });
      setMsg({ erro: '', ok: 'Hotel vinculado' });
      onMudou();
    } catch (err) {
      setMsg({ erro: err.message, ok: '' });
    }
  };

  const desvincular = async (hotelId) => {
    try {
      const p = await sistemaApi.desvincular(atualId, hotelId);
      aplicar(p);
      onMudou();
    } catch (err) {
      setMsg({ erro: err.message, ok: '' });
    }
  };

  const disponiveis = hoteis.filter((h) => !vinculos.some((v) => v.id === h.id));

  return (
    <Gaveta titulo={atualId ? form.nome || 'Proprietário' : 'Novo proprietário'} sub="Dados pessoais, acesso e hotéis" onFechar={onFechar}
      rodape={<>
        <Erro msg={msg.erro} />
        {msg.ok && <span className={styles.ok}><Check size={14} /> {msg.ok}</span>}
        <button type="button" className={styles.btnPrimario} onClick={salvar} disabled={salvando || carregando}>
          {salvando ? <Loader2 size={14} className={styles.gira} /> : <Check size={14} />} Salvar
        </button>
      </>}>
      {carregando ? <Carregando /> : (
        <div className={styles.form}>
          <h4 className={styles.formTitulo}>Dados pessoais</h4>
          <div className={styles.grade}>
            <Campo label="Nome completo" largura={4}><input value={form.nome} onChange={set('nome')} placeholder="Nome completo" /></Campo>
            <Campo label="Nascimento" largura={2} bloco>
              <DatePicker mode="single" value={isoParaData(form.dataNascimento)} maxDate={new Date()} placeholder="dd/mm/aaaa"
                onChange={(d) => setForm((f) => ({ ...f, dataNascimento: dataParaIso(d) }))} />
            </Campo>
            <Campo label="CPF" largura={2}><input value={form.cpf} onChange={(e) => setForm((f) => ({ ...f, cpf: mascaraCpf(e.target.value) }))} inputMode="numeric" placeholder="000.000.000-00" /></Campo>
            <Campo label="RG" largura={2}><input value={form.rg} onChange={set('rg')} placeholder="RG" /></Campo>
            <Campo label="Sexo" largura={2}>
              <select value={form.sexo} onChange={set('sexo')}><option value="">—</option><option value="1">Masculino</option><option value="2">Feminino</option><option value="0">Outro</option></select>
            </Campo>
            <Campo label="E-mail" largura={3}><input type="email" value={form.email} onChange={set('email')} placeholder="email@exemplo.com" /></Campo>
            <Campo label="Telefone" largura={3}><input value={form.telefone} onChange={(e) => setForm((f) => ({ ...f, telefone: mascaraTelefone(e.target.value) }))} inputMode="tel" placeholder="(00) 00000-0000" /></Campo>
            <Campo label="Profissão" largura={6}><input value={form.profissao} onChange={set('profissao')} /></Campo>
            <Campo label="CEP" largura={2}>
              <span className={styles.comSpinner}>
                <input value={form.cep} onChange={alterarCep} inputMode="numeric" placeholder="00000-000" />
                {buscandoCep && <Loader2 size={14} className={styles.gira} />}
              </span>
            </Campo>
            <Campo label="Endereço" largura={3}><input value={form.endereco} onChange={set('endereco')} placeholder="Rua / Av." /></Campo>
            <Campo label="Número"><input value={form.numero} onChange={set('numero')} placeholder="0" /></Campo>
            <Campo label="Complemento" largura={2}><input value={form.complemento} onChange={set('complemento')} /></Campo>
            <Campo label="Bairro" largura={2}><input value={form.bairro} onChange={set('bairro')} /></Campo>
            <Campo label="Cidade" largura={2}><input value={form.municipio} onChange={set('municipio')} /></Campo>
            <Campo label="UF"><input value={form.estado} maxLength={2} onChange={(e) => setForm((f) => ({ ...f, estado: e.target.value.toUpperCase() }))} placeholder="UF" /></Campo>
            <Campo label="País"><input value={form.pais} onChange={set('pais')} /></Campo>
            {atualId && <label className={styles.check} style={{ gridColumn: 'span 4' }}><input type="checkbox" checked={!!form.ativo} onChange={set('ativo')} /> Ativo</label>}
          </div>

          <h4 className={styles.formTitulo}>Acesso ao sistema</h4>
          <div className={styles.grade}>
            <Campo label="Usuário" largura={3}><input value={form.username} autoComplete="off" onChange={set('username')} /></Campo>
            <Campo label={atualId && form.username ? 'Nova senha' : 'Senha'} largura={3} dica="Mínimo 8 caracteres, com letras e números">
              <span className={styles.senha}>
                <input type={verSenha ? 'text' : 'password'} value={form.senha} autoComplete="new-password" onChange={set('senha')}
                  placeholder={atualId ? 'Deixe vazio para manter' : ''} />
                <button type="button" className={styles.iconeBtn} onClick={() => setVerSenha((v) => !v)} aria-label={verSenha ? 'Ocultar senha' : 'Mostrar senha'}>
                  {verSenha ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </span>
            </Campo>
          </div>

          <h4 className={styles.formTitulo}>Hotéis</h4>
          {!atualId ? <p className={styles.nota}>Salve o proprietário para vincular hotéis.</p> : (
            <>
              {vinculos.length === 0 ? <p className={styles.vazio}>Nenhum hotel vinculado.</p> : (
                <ul className={styles.listaSimples}>
                  {vinculos.map((v) => (
                    <li key={v.id}>
                      <b>{v.nome}</b>{v.principal && <span className={styles.selo}>Principal</span>}
                      <span className={styles.espaco} />
                      <Decisao texto={`Remover o acesso a ${v.nome}?`} perigo rotulo="Remover" onConfirmar={() => desvincular(v.id)}>
                        {(abrir) => <button type="button" className={styles.iconeBtn} onClick={abrir} aria-label={`Remover ${v.nome}`}><Trash2 size={15} /></button>}
                      </Decisao>
                    </li>
                  ))}
                </ul>
              )}
              <div className={styles.barra}>
                <select value={vinc.hotelId} onChange={(e) => setVinc({ ...vinc, hotelId: e.target.value })} aria-label="Hotel">
                  <option value="">Escolha um hotel…</option>
                  {disponiveis.map((h) => <option key={h.id} value={h.id}>{h.nome}{h.rede_nome ? ` · ${h.rede_nome}` : ''}</option>)}
                </select>
                <label className={styles.check}><input type="checkbox" checked={vinc.principal} onChange={(e) => setVinc({ ...vinc, principal: e.target.checked })} /> Principal (abre ao entrar)</label>
                <button type="button" className={styles.btnSecundario} onClick={vincular} disabled={!vinc.hotelId}><Plus size={14} /> Vincular</button>
              </div>
              <p className={styles.nota}>Ao vincular, o proprietário entra no hotel como administrador, limitado ao plano do hotel. CPF e nascimento são obrigatórios para vincular.</p>
            </>
          )}
        </div>
      )}
    </Gaveta>
  );
}

function Proprietarios() {
  const lista = useCarga(() => Promise.all([sistemaApi.proprietarios(), sistemaApi.hoteis()]), []);
  const [aberto, setAberto] = useState(null);
  const [props, hoteis] = lista.dados ?? [[], []];
  return (
    <div className={styles.secao}>
      <div className={styles.barra}>
        <span className={styles.espaco} />
        <button type="button" className={styles.btnPrimario} onClick={() => setAberto('novo')}><Plus size={15} /> Novo proprietário</button>
      </div>
      {lista.carregando && !lista.dados ? <Carregando /> : <Erro msg={lista.erro} onTentar={lista.recarregar} />}
      {lista.dados && (
        <div className={styles.tabelaWrap}>
          <table className={styles.tabela}>
            <thead><tr><th>Nome</th><th>Usuário</th><th>Contato</th><th>Hotéis</th><th>Situação</th></tr></thead>
            <tbody>
              {props.map((p) => {
                const hs = (() => { try { return JSON.parse(p.hoteis); } catch { return []; } })();
                return (
                  <tr key={p.id} className={styles.clicavel} onClick={() => setAberto(p.id)} tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter') setAberto(p.id); }}>
                    <td><b>{p.nome}</b><small className={styles.sub}>{p.cpf ? `CPF ${p.cpf}` : 'sem CPF'}</small></td>
                    <td>{p.username ?? <span className={styles.sub}>sem acesso</span>}</td>
                    <td>{p.email ?? '—'}<small className={styles.sub}>{p.telefone ?? ''}</small></td>
                    <td>{hs.length ? hs.map((h) => h.nome).join(', ') : '—'}</td>
                    <td>{p.ativo ? <span className={[styles.selo, styles.selo_ATIVA].join(' ')}>Ativo</span> : <span className={[styles.selo, styles.selo_CANCELADA].join(' ')}>Inativo</span>}</td>
                  </tr>
                );
              })}
              {props.length === 0 && <tr><td colSpan={5} className={styles.vazio}>Nenhum proprietário cadastrado.</td></tr>}
            </tbody>
          </table>
        </div>
      )}
      {aberto && <ProprietarioGaveta id={aberto === 'novo' ? null : aberto} hoteis={hoteis} onFechar={() => setAberto(null)} onMudou={lista.recarregar} />}
    </div>
  );
}

function Redes() {
  const lista = useCarga(() => sistemaApi.redes(), []);
  const [edicao, setEdicao] = useState(null);
  const [msg, setMsg] = useState('');
  const salvar = async () => {
    setMsg('');
    try {
      if (edicao.id) await sistemaApi.atualizarRede(edicao.id, edicao);
      else await sistemaApi.criarRede(edicao);
      setEdicao(null);
      lista.recarregar();
    } catch (err) {
      setMsg(err.message);
    }
  };
  return (
    <div className={styles.secao}>
      <div className={styles.barra}>
        <p className={styles.nota}>Hotéis da mesma rede compartilham o cadastro de hóspedes e veículos.</p>
        <span className={styles.espaco} />
        <button type="button" className={styles.btnPrimario} onClick={() => setEdicao({ nome: '', cnpj: '', ativo: true })}><Plus size={15} /> Nova rede</button>
      </div>
      {edicao && (
        <div className={styles.painel}>
          <div className={styles.grade}>
            <Campo label="Nome da rede" largura={3}><input value={edicao.nome} onChange={(e) => setEdicao({ ...edicao, nome: e.target.value })} autoFocus /></Campo>
            <Campo label="CNPJ da franqueadora" largura={2}><input value={edicao.cnpj ?? ''} onChange={(e) => setEdicao({ ...edicao, cnpj: e.target.value })} /></Campo>
            <label className={styles.check}><input type="checkbox" checked={!!edicao.ativo} onChange={(e) => setEdicao({ ...edicao, ativo: e.target.checked })} /> Ativa</label>
          </div>
          <Erro msg={msg} />
          <div className={styles.linhaBotoes}>
            <button type="button" className={styles.btnGhost} onClick={() => setEdicao(null)}>Cancelar</button>
            <button type="button" className={styles.btnPrimario} onClick={salvar}><Check size={14} /> Salvar</button>
          </div>
        </div>
      )}
      {lista.carregando && !lista.dados ? <Carregando /> : <Erro msg={lista.erro} onTentar={lista.recarregar} />}
      {lista.dados && (
        <div className={styles.tabelaWrap}>
          <table className={styles.tabela}>
            <thead><tr><th>Rede</th><th>CNPJ</th><th className={styles.num}>Hotéis</th><th>Situação</th></tr></thead>
            <tbody>
              {lista.dados.map((r) => (
                <tr key={r.id} className={styles.clicavel} onClick={() => setEdicao({ id: r.id, nome: r.nome, cnpj: r.cnpj ?? '', ativo: r.ativo })}>
                  <td><b>{r.nome}</b></td><td>{fmtCnpj(r.cnpj)}</td><td className={styles.num}>{r.hoteis}</td>
                  <td>{r.ativo ? <span className={[styles.selo, styles.selo_ATIVA].join(' ')}>Ativa</span> : <span className={[styles.selo, styles.selo_CANCELADA].join(' ')}>Inativa</span>}</td>
                </tr>
              ))}
              {lista.dados.length === 0 && <tr><td colSpan={4} className={styles.vazio}>Nenhuma rede cadastrada.</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Auditoria() {
  const lista = useCarga(() => sistemaApi.auditoria(200), []);
  return (
    <div className={styles.secao}>
      {lista.carregando && !lista.dados ? <Carregando /> : <Erro msg={lista.erro} onTentar={lista.recarregar} />}
      {lista.dados && (
        <div className={styles.tabelaWrap}>
          <table className={styles.tabela}>
            <thead><tr><th>Quando</th><th>Quem</th><th>Ação</th><th>Alvo</th><th>IP</th></tr></thead>
            <tbody>
              {lista.dados.map((a) => (
                <tr key={a.id} title={a.detalhes ?? ''}>
                  <td>{dataHora(a.criado_em)}</td><td>{a.admin_nome ?? '—'}</td>
                  <td><span className={[styles.selo, a.acao.includes('FALHOU') || a.acao.includes('BLOQUEADO') ? styles.selo_ATRASADA : ''].join(' ')}>{a.acao}</span></td>
                  <td>{a.alvo ?? '—'}</td><td className={styles.mono}>{a.ip ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default function SistemaApp() {
  useTheme();
  const [admin, setAdmin] = useState(null);
  const [verificando, setVerificando] = useState(sistemaApi.autenticado());
  const [secao, setSecao] = useState(() => { try { return sessionStorage.getItem('sistema:secao') || 'geral'; } catch { return 'geral'; } });

  useEffect(() => { document.title = 'Administração do sistema'; }, []);
  useEffect(() => { try { sessionStorage.setItem('sistema:secao', secao); } catch { /* sem storage */ } }, [secao]);
  useEffect(() => {
    if (!sistemaApi.autenticado()) return;
    sistemaApi.eu().then(setAdmin).catch(() => sistemaApi.logout()).finally(() => setVerificando(false));
  }, []);
  useEffect(() => {
    const sair = () => setAdmin(null);
    window.addEventListener('sistema:unauthorized', sair);
    return () => window.removeEventListener('sistema:unauthorized', sair);
  }, []);

  if (verificando) return <Carregando />;
  if (!admin) return <SistemaLogin onEntrar={(r) => setAdmin({ nome: r.nome, email: r.email })} />;

  const Atual = { geral: VisaoGeral, hoteis: Hoteis, faturas: Faturas, planos: Planos, proprietarios: Proprietarios, redes: Redes, auditoria: Auditoria }[secao] ?? VisaoGeral;
  const rotulo = SECOES.find((s) => s.id === secao)?.label;

  return (
    <div className={styles.casca}>
      <nav className={styles.menu} aria-label="Administração">
        <div className={styles.menuTopo}><ShieldCheck size={18} /><span>Administração</span></div>
        <ul>
          {SECOES.map(({ id, label, icon: Icon }) => (
            <li key={id}>
              <button type="button" className={secao === id ? styles.menuAtivo : ''} onClick={() => setSecao(id)} aria-current={secao === id ? 'page' : undefined}>
                <Icon size={16} /> <span>{label}</span>
              </button>
            </li>
          ))}
        </ul>
        <div className={styles.menuConta}>
          <span><b>{admin.nome}</b><small>{admin.email}</small></span>
          <button type="button" className={styles.iconeBtn} onClick={() => { sistemaApi.logout(); setAdmin(null); }} aria-label="Sair" title="Sair"><LogOut size={16} /></button>
        </div>
      </nav>
      <main className={styles.conteudo}>
        <h1 className={styles.titulo}>{rotulo}</h1>
        <Atual irPara={setSecao} />
      </main>
    </div>
  );
}
