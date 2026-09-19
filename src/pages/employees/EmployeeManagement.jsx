import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Search, Loader2, AlertCircle, Calendar, X,
  Eye, EyeOff, Lock, Building,
  Users, ChevronLeft, ChevronRight as ChevRight,
  CreditCard, CheckCircle2, AlertTriangle, XCircle, Upload,
} from 'lucide-react';

import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { Input, Select, FormField } from '../../components/ui/Input';
import { Notification } from '../../components/ui/Notification';
import { DatePicker } from '../../components/ui/DatePicker';
import { funcionarioApi, cargoApi, cadastroApi, usuarioApi, enumApi } from '../../services/api';
import iconWhatsapp from '../../assets/whatsapp.png';
import iconGmail    from '../../assets/gmail.png';

import styles from './EmployeeManagement.module.css';

// ── Máscaras ──────────────────────────────────────────────────
const maskCPF = v =>
  v.replace(/\D/g,'').slice(0,11)
   .replace(/(\d{3})(\d)/,'$1.$2')
   .replace(/(\d{3})(\d)/,'$1.$2')
   .replace(/(\d{3})(\d{1,2})$/,'$1-$2');

const maskPhone = v => {
  const n = v.replace(/\D/g,'').slice(0,11);
  if (n.length > 10) return n.replace(/(\d{2})(\d{5})(\d{0,4})/,'($1) $2-$3');
  return n.replace(/(\d{2})(\d{4})(\d{0,4})/,'($1) $2-$3');
};

const maskCEP = v => v.replace(/\D/g,'').slice(0,8).replace(/(\d{5})(\d{1,3})$/,'$1-$2');
const maskBRL = v => {
  const digits = String(v ?? '').replace(/\D/g, '');
  if (!digits) return '';
  const num = parseInt(digits, 10) / 100;
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(num);
};
const parseBRL = v => {
  const s = String(v ?? '').replace(/[R$\s.]/g, '').replace(',', '.');
  return parseFloat(s) || 0;
};
const fmtBRL = v => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v ?? 0);

const unmask = v => (v ?? '').replace(/\D/g,'');

const parseDateDMY = str => {
  if (!str) return null;
  const [d, m, y] = str.split('/');
  if (!d || !m || !y) return null;
  return new Date(Number(y), Number(m) - 1, Number(d));
};

const formatDateDMY = d => {
  if (!d) return '';
  if (d instanceof Date) {
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    return `${dd}/${mm}/${d.getFullYear()}`;
  }
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(d)) return d;
  return '';
};

// ── Avatar helpers ────────────────────────────────────────────
// Círculo sólido com as iniciais em branco, no ciclo de cores das faixas do
// calendário. A cor vem da posição na lista, como na tela de Cadastro.
const AVATAR_TONES = ['avTeal', 'avAmber', 'avCoral', 'avIndigo', 'avSky', 'avEmerald'];
const avatarTone = (i) => styles[AVATAR_TONES[((i % AVATAR_TONES.length) + AVATAR_TONES.length) % AVATAR_TONES.length]];

const getInitials = (name) => {
  if (!name) return '?';
  const words = (name ?? '').trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '?';
  if (words.length === 1) return words[0][0].toUpperCase();
  return (words[0][0] + words[words.length - 1][0]).toUpperCase();
};

// ── Validação CPF ─────────────────────────────────────────────
const validarCPF = cpf => {
  const n = cpf.replace(/\D/g,'');
  if (n.length !== 11 || /^(\d)\1{10}$/.test(n)) return false;
  let s = 0;
  for (let i = 0; i < 9; i++) s += parseInt(n[i]) * (10 - i);
  let r = (s * 10) % 11; if (r === 10 || r === 11) r = 0;
  if (r !== parseInt(n[9])) return false;
  s = 0;
  for (let i = 0; i < 10; i++) s += parseInt(n[i]) * (11 - i);
  r = (s * 10) % 11; if (r === 10 || r === 11) r = 0;
  return r === parseInt(n[10]);
};

// ── Blank forms ───────────────────────────────────────────────
const blankPessoa = () => ({
  nome:'', dataNascimento: null, cpf:'', rg:'', email:'',
  telefone:'', sexo:'', pais:'Brasil', estado:'', municipio:'',
  endereco:'', complemento:'', cep:'', bairro:'', numero:'',
  status:'ATIVO',
});

const blankFuncionario = () => ({
  pessoa: blankPessoa(),
  dataAdmissao: null,
  salario: '',
  cargoId: '',
  usuario: { username: '', senha: '' },
  showPassword: false,
  showConfirmPassword: false,
  senhaConfirma: '',
});

// Teto da busca única que alimenta os totais do painel geral.
const TETO_STATS = 300;

const dateFromApi = d => {
  if (!d) return '';
  if (d.includes('/')) return d; // already formatted
  const p = d.split('-');
  return `${(p[2]??'').padStart(2,'0')}/${(p[1]??'').padStart(2,'0')}/${p[0]??''}`;
};

// ── Status Badge ──────────────────────────────────────────────
function StatusBadge({ status }) {
  const cls = status === 'ATIVO'    ? styles.badgeAtivo
            : status === 'DEMITIDO' ? styles.badgeDemitido
            : styles.badgeDefault;
  return <span className={cls}>{status ?? '—'}</span>;
}

// ── Avatar Circle ─────────────────────────────────────────────
function AvatarCircle({ name, size = 40, tone = 0 }) {
  return (
    <span
      className={[styles.avatar, avatarTone(tone)].join(' ')}
      style={{ width: size, height: size, fontSize: size >= 56 ? 16 : 12 }}
    >
      {getInitials(name)}
    </span>
  );
}

// ── Campo rótulo/valor do painel de detalhe ───────────────────
function Field({ label, value, mono = false }) {
  return (
    <div>
      <p className={styles.fLabel}>{label}</p>
      <p className={[styles.fVal, mono ? styles.fMono : ''].join(' ')}>{value || '—'}</p>
    </div>
  );
}

// ── Atalhos de contato — o campo inteiro é o clique ───────────
function ContatoBotao({ tipo, href, title, children }) {
  return (
    <a href={href} title={title} className={styles.contatoBtn}
      {...(tipo === 'whatsapp' ? { target: '_blank', rel: 'noreferrer' } : {})}>
      <img src={tipo === 'whatsapp' ? iconWhatsapp : iconGmail} alt="" className={styles.quickIcon} />
      <span className={styles.contatoTexto}>{children}</span>
    </a>
  );
}

// ── Esqueletos de carregamento ────────────────────────────────
const sk = (...extra) => [styles.sk, ...extra].join(' ');

function SkeletonLista({ linhas = 7 }) {
  return (
    <div role="status" aria-label="Carregando funcionários">
      {Array.from({ length: linhas }, (_, i) => (
        <div key={i} className={styles.listItem} aria-hidden="true">
          <span className={sk(styles.skAvatar)} />
          <span className={styles.listItemBody}>
            <span className={sk(styles.skName)} style={{ width: `${62 + ((i * 13) % 26)}%` }} />
            <span className={sk(styles.skSub)} />
          </span>
        </div>
      ))}
    </div>
  );
}

function SkeletonPainel() {
  return (
    <div className={styles.statGrid} role="status" aria-label="Carregando totais">
      {Array.from({ length: 4 }, (_, i) => (
        <div key={i} className={styles.statCard} aria-hidden="true">
          <span className={sk(styles.skLabel)} />
          <span className={sk(styles.skNumero)} />
        </div>
      ))}
    </div>
  );
}

// ── Formulário de Pessoa ────────────────────────────────────
function PessoaFormEmployee({ data, onChange, onFetchCEP, onCheckCPF, showErrors = false }) {
  const [cepLoading, setCepLoading] = useState(false);
  const [cpfStatus,  setCpfStatus]  = useState(null);

  const set = (field, val) => onChange(prev => ({ ...prev, pessoa: { ...prev.pessoa, [field]: val } }));
  const hasErr = field => showErrors && !data.pessoa[field];

  const handleCPF = async v => {
    const masked = maskCPF(v);
    set('cpf', masked);
    const raw = unmask(masked);
    if (raw.length < 11) { setCpfStatus(null); return; }
    if (!validarCPF(raw)) { setCpfStatus('invalid'); return; }
    setCpfStatus('loading');
    const exists = await onCheckCPF(raw);
    setCpfStatus(exists ? 'exists' : 'ok');
  };

  const handleCEP = async v => {
    const masked = maskCEP(v);
    set('cep', masked);
    if (unmask(masked).length === 8) {
      setCepLoading(true);
      try {
        await onFetchCEP(masked, (updater) => {
          onChange(prev => ({
            ...prev,
            pessoa: typeof updater === 'function' ? updater(prev.pessoa) : updater
          }));
        });
      } finally { setCepLoading(false); }
    }
  };

  const cpfIcon = cpfStatus === 'loading' ? <Loader2 size={14} className={styles.spinInline} />
                : cpfStatus === 'ok'      ? <CheckCircle2 size={14} className={styles.iconOk} />
                : cpfStatus === 'exists'  ? <AlertTriangle size={14} className={styles.iconWarn} />
                : cpfStatus === 'invalid' ? <XCircle size={14} className={styles.iconErr} />
                : null;

  const p = data.pessoa;

  return (
    <div className={styles.formBody}>
      <div className={styles.sectionLabel}>Dados Pessoais</div>
      {/* CPF | Nome | Data Nascimento */}
      <div className={styles.cpfRow}>
        <div className={styles.cpfBlock}>
          <label className={[styles.cpfLabel, hasErr('cpf') && !cpfStatus ? styles.labelErr : ''].join(' ')}>
            CPF *
          </label>
          <div className={styles.cpfWrap}>
            <Input
              value={p.cpf}
              onChange={e => handleCPF(e.target.value)}
              placeholder="000.000.000-00"
              className={cpfStatus === 'ok' ? styles.inputOk : cpfStatus === 'exists' ? styles.inputWarn : cpfStatus === 'invalid' ? styles.inputErr : hasErr('cpf') && !cpfStatus ? styles.inputErr : ''}
            />
            {cpfIcon && <span className={styles.cpfIcon}>{cpfIcon}</span>}
          </div>
          {cpfStatus === 'invalid' && <span className={styles.cpfMsg} style={{ color:'#ef4444' }}>CPF inválido</span>}
          {cpfStatus === 'exists'  && <span className={styles.cpfMsg} style={{ color:'#f59e0b' }}>CPF já cadastrado</span>}
          {cpfStatus === 'ok'      && <span className={styles.cpfMsg} style={{ color:'#10b981' }}>CPF disponível</span>}
        </div>

        <div className={[styles.reqField, hasErr('nome') ? styles.reqFieldErr : ''].join(' ')}>
          <FormField label="Nome completo *">
            <Input value={p.nome} onChange={e => set('nome', e.target.value)} placeholder="Nome completo" />
          </FormField>
        </div>

        <div className={[styles.reqField, hasErr('dataNascimento') ? styles.reqFieldErr : ''].join(' ')}>
          <FormField label="Data de Nascimento *">
            <DatePicker
              mode="single"
              value={p.dataNascimento}
              onChange={d => set('dataNascimento', d ?? null)}
              maxDate={new Date()}
              placeholder="dd/mm/aaaa"
              error={hasErr('dataNascimento')}
            />
          </FormField>
        </div>
      </div>

      <div className={styles.grid3}>
        <FormField label="RG">
          <Input value={p.rg} onChange={e => set('rg', e.target.value)} placeholder="RG" />
        </FormField>
        <FormField label="Sexo">
          <Select value={p.sexo} onChange={e => set('sexo', e.target.value)}>
            <option value="">Selecione</option>
            <option value="1">Masculino</option>
            <option value="2">Feminino</option>
            <option value="3">Outro</option>
          </Select>
        </FormField>
        <div className={[styles.reqField, hasErr('telefone') ? styles.reqFieldErr : ''].join(' ')}>
          <FormField label="Telefone *">
            <Input value={p.telefone} onChange={e => set('telefone', maskPhone(e.target.value))} placeholder="(00) 00000-0000" />
          </FormField>
        </div>
      </div>

      <div className={[styles.reqField, hasErr('email') ? styles.reqFieldErr : ''].join(' ')}>
        <FormField label="Email *">
          <Input type="email" value={p.email} onChange={e => set('email', e.target.value)} placeholder="email@exemplo.com" />
        </FormField>
      </div>

      <div className={styles.sectionLabel}>Endereço</div>

      <div className={styles.grid3}>
        <div className={[styles.reqField, hasErr('cep') ? styles.reqFieldErr : ''].join(' ')}>
          <label className={[styles.fieldLabel, hasErr('cep') ? styles.labelErr : ''].join(' ')}>CEP *</label>
          <div className={styles.inputWithSpinner}>
            <Input value={p.cep} onChange={e => handleCEP(e.target.value)} placeholder="00000-000"
              className={hasErr('cep') ? styles.inputErr : ''} />
            {cepLoading && <Loader2 size={13} className={[styles.spinInline, styles.inputSpinner].join(' ')} />}
          </div>
        </div>
        <FormField label="País">
          <Input value={p.pais} onChange={e => set('pais', e.target.value)} placeholder="Brasil" />
        </FormField>
        <FormField label="Estado">
          <Input value={p.estado} onChange={e => set('estado', e.target.value)} placeholder="UF" />
        </FormField>
      </div>
      <div className={styles.grid2}>
        <FormField label="Município">
          <Input value={p.municipio} onChange={e => set('municipio', e.target.value)} />
        </FormField>
        <FormField label="Bairro">
          <Input value={p.bairro} onChange={e => set('bairro', e.target.value)} />
        </FormField>
      </div>
      <div className={styles.grid3}>
        <div className={styles.spanTwo}>
          <FormField label="Endereço">
            <Input value={p.endereco} onChange={e => set('endereco', e.target.value)} placeholder="Rua / Av." />
          </FormField>
        </div>
        <FormField label="Número">
          <Input value={p.numero} onChange={e => set('numero', e.target.value)} placeholder="0" />
        </FormField>
      </div>
      <FormField label="Complemento">
        <Input value={p.complemento} onChange={e => set('complemento', e.target.value)} placeholder="Apto, Bloco..." />
      </FormField>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────
export default function EmployeeManagement() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [notification, setNotification] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [totalElements, setTotalElements] = useState(0);

  const [searchTerm, setSearchTerm] = useState('');
  const searchDebounce = useRef(null);

  // modais
  const [showAddModal, setShowAddModal] = useState(false);
  const [detailTone, setDetailTone] = useState(0);

  // painel geral, exibido enquanto nenhum funcionário está selecionado
  const [stats, setStats] = useState(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [showEdit, setShowEdit] = useState(false);
  const [detailItem, setDetailItem] = useState(null);
  const [cargos, setCargos] = useState([]);

  // forms
  const [newFunc, setNewFunc] = useState(blankFuncionario());
  const [editFunc, setEditFunc] = useState(blankFuncionario());
  const [showErrors, setShowErrors] = useState(false);

  // password visibility
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // histórico de cargo/salário da ficha
  const [historico, setHistorico] = useState([]);
  const [historicoLoading, setHistoricoLoading] = useState(false);

  // edit credentials modal
  const [showEditCredentials, setShowEditCredentials] = useState(false);
  const [credentialsForm, setCredentialsForm] = useState({ username: '', senha: '' });
  const [credLoading, setCredLoading] = useState(false);

  // fire employee modal
  const [showFireEmployee, setShowFireEmployee] = useState(false);
  const [fireLoading, setFireLoading] = useState(false);

  // edit history modal
  const [showEditHistory, setShowEditHistory] = useState(false);
  const [editHistoryItem, setEditHistoryItem] = useState(null);
  const [historyForm, setHistoryForm] = useState({ cargoId: '', salario: '' });
  const [historyLoading, setHistoryLoading] = useState(false);

  // recebidos (salary payments history)
  const [recebidos, setRecebidos] = useState([]);
  const [recebidosLoading, setRecebidosLoading] = useState(false);
  const [showAddRecebido, setShowAddRecebido] = useState(false);
  const [addRecebidoForm, setAddRecebidoForm] = useState({
    historicoFuncionarioId: '',
    valorRecebido: '',
    dataHoraInicio: null,
    dataHoraFim: null,
    dataHoraPagamento: null,
    tipoPagamentoId: '1',
    descricao: '',
  });
  const [addRecebidoLoading, setAddRecebidoLoading] = useState(false);
  const [recebidoFile, setRecebidoFile] = useState(null);
  const fileInputRef = useRef(null);
  const [tipoPagamentos, setTipoPagamentos] = useState([]);

  // edit recebido
  const [showEditRecebido, setShowEditRecebido] = useState(false);
  const [editRecebidoItem, setEditRecebidoItem] = useState(null);
  const [editRecebidoForm, setEditRecebidoForm] = useState({
    historicoFuncionarioId: '',
    valorRecebido: '',
    dataHoraInicio: null,
    dataHoraFim: null,
    dataHoraPagamento: null,
    tipoPagamentoId: '1',
    descricao: '',
  });
  const [editRecebidoFile, setEditRecebidoFile] = useState(null);
  const editFileInputRef = useRef(null);
  const [editRecebidoLoading, setEditRecebidoLoading] = useState(false);

  const showNotif = (msg, type = 'success') => {
    setNotification({ message: msg, type });
    setTimeout(() => setNotification(null), 3200);
  };

  // Fetch cargos and tipoPagamentos on mount
  useEffect(() => {
    const fetch = async () => {
      try {
        const res = await cargoApi.listar({ page: 0, size: 100 });
        setCargos(res?.content ?? []);

        const tipos = await enumApi.tipoPagamento();
        setTipoPagamentos(tipos ?? []);
      } catch (e) {
        console.error('Erro ao carregar cargos/tipos:', e);
      }
    };
    fetch();
  }, []);

  const fetchCEP = async (cep, setter) => {
    const raw = unmask(cep);
    if (raw.length !== 8) return;
    try {
      const d = await cadastroApi.buscarCEP(raw);
      setter(prev => ({
        ...prev,
        endereco:  d.endereco  || prev.endereco,
        bairro:    d.bairro    || prev.bairro,
        pais:      d.pais?.descricao      || prev.pais,
        estado:    d.estado?.descricao    || prev.estado,
        municipio: d.municipio?.descricao || prev.municipio,
      }));
    } catch (e) {
      console.error('Erro ao buscar CEP:', e);
    }
  };

  const checkCPF = async raw => {
    try {
      const res = await cadastroApi.listarPessoas({ termo: raw, size: 1 });
      return (res?.content ?? []).length > 0;
    } catch { return false; }
  };

  const buildPessoaBody = (p) => ({
    nome:            (p.nome ?? '').trim(),
    data_nascimento: formatDateDMY(p.dataNascimento),
    cpf:             unmask(p.cpf),
    rg:              (p.rg ?? '').trim(),
    email:           (p.email ?? '').trim(),
    telefone:        p.telefone ?? '',
    pais:            p.pais || 'Brasil',
    estado:          p.estado ?? '',
    municipio:       p.municipio ?? '',
    endereco:        p.endereco ?? '',
    complemento:     p.complemento ?? '',
    cep:             p.cep ?? '',
    bairro:          p.bairro ?? '',
    sexo:            Number(p.sexo) || 1,
    numero:          p.numero ?? '',
    status:          p.status ?? 'ATIVO',
  });

  // Totais do painel geral. O /funcionario não tem contagem por status, então
  // busca a lista inteira uma vez e conta aqui. Acima do teto a soma sairia
  // errada (viria só a primeira página), e aí só o total é mostrado.
  const fetchStats = useCallback(async () => {
    setStatsLoading(true);
    try {
      const res = await funcionarioApi.listar({ size: TETO_STATS, page: 0 });
      const total = res?.totalElements ?? 0;
      const lista = res?.content ?? [];
      const completo = total <= TETO_STATS;
      setStats({
        total,
        completo,
        ativos:    completo ? lista.filter(f => f.pessoa?.status !== 'DEMITIDO').length : null,
        demitidos: completo ? lista.filter(f => f.pessoa?.status === 'DEMITIDO').length : null,
      });
    } catch {
      setStats(null);
    } finally {
      setStatsLoading(false);
    }
  }, []);

  useEffect(() => { fetchStats(); }, [fetchStats]);

  const fetchData = useCallback(async (term = '', pg = 0) => {
    setLoading(true);
    try {
      const params = { size: 15, page: pg };
      if (term) params.termo = term;

      const res = await funcionarioApi.listar(params);
      setItems(res?.content ?? []);
      setTotalPages(res?.totalPages ?? 0);
      setTotalElements(res?.totalElements ?? 0);
    } catch (e) {
      showNotif('Erro ao carregar funcionários.', 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    clearTimeout(searchDebounce.current);
    if (searchTerm.length >= 3) {
      searchDebounce.current = setTimeout(() => {
        setPage(0);
        fetchData(searchTerm, 0);
      }, 400);
    } else if (searchTerm.length === 0) {
      fetchData('', 0);
    }
    return () => clearTimeout(searchDebounce.current);
  }, [searchTerm, fetchData]);

  const goToPage = pg => { setPage(pg); fetchData(searchTerm, pg); };

  const handleAddEmployee = () => {
    const p = newFunc.pessoa;
    if (!p.nome || !p.cpf || !p.dataNascimento || !p.telefone || !p.email || !p.cep) {
      setShowErrors(true);
      showNotif('Preencha todos os campos obrigatórios (*).', 'error');
      return;
    }
    if (!newFunc.cargoId) {
      showNotif('Selecione um cargo.', 'error');
      return;
    }
    if (!newFunc.dataAdmissao) {
      showNotif('Defina a data de admissão.', 'error');
      return;
    }
    if (newFunc.usuario.username && newFunc.usuario.senha !== newFunc.senhaConfirma) {
      showNotif('As senhas não conferem.', 'error');
      return;
    }
    doSaveEmployee();
  };

  const doSaveEmployee = async () => {
    setIsSubmitting(true);
    try {
      // 1. Create pessoa first
      const pessoaBody = buildPessoaBody(newFunc.pessoa);
      const pessoaRes = await cadastroApi.criarPessoa({ pessoas: [pessoaBody], empresasIds: [] });
      const pessoaId = pessoaRes?.pessoaId ?? pessoaRes?.[0]?.id ?? pessoaRes?.id;

      if (!pessoaId) {
        showNotif('Erro ao criar pessoa: ID não retornado', 'error');
        return;
      }

      // 2. Create funcionário with pessoaId
      const admissao = newFunc.dataAdmissao instanceof Date
        ? newFunc.dataAdmissao.toISOString().split('T')[0]
        : newFunc.dataAdmissao;
      const funBody = {
        pessoa:        { id: pessoaId },
        data_admissao: admissao,
        cargo:         { id: Number(newFunc.cargoId) },
        salario:       parseBRL(newFunc.salario),
        ...(newFunc.usuario.username.trim() ? {
          usuario: { username: newFunc.usuario.username.trim(), senha: newFunc.usuario.senha },
        } : {}),
      };

      await funcionarioApi.criar(funBody);
      showNotif('Funcionário cadastrado com sucesso!');
      setShowAddModal(false);
      setNewFunc(blankFuncionario());
      setShowErrors(false);
      setShowPassword(false);
      setShowConfirmPassword(false);
      fetchData(searchTerm, page);
      fetchStats();
    } catch (e) {
      showNotif(e.message || 'Erro ao cadastrar funcionário.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // `tone` mantém o avatar da ficha na mesma cor do item da lista.
  const openDetail = async (item, tone = 0) => {
    setDetailItem(item);
    setDetailTone(tone);
    setEditHistoryItem(null);
    setRecebidos([]);

    // Fetch salary history
    setHistoricoLoading(true);
    try {
      const res = await funcionarioApi.listarHistorico(item.id);
      setHistorico(res?.content ?? res ?? []);
    } catch (e) {
      console.error('Erro ao carregar histórico:', e);
      setHistorico([]);
    } finally {
      setHistoricoLoading(false);
    }
  };

  // A ficha agora fica aberta depois de salvar (antes o modal fechava), então
  // precisa reler o registro — senão continuaria mostrando os valores antigos.
  const refreshDetail = async () => {
    if (!detailItem?.id) return;
    try {
      const atualizado = await funcionarioApi.buscarPorId(detailItem.id);
      if (atualizado) setDetailItem(atualizado);
    } catch { /* mantém o que está na tela */ }
  };

  const closeDetail = () => {
    setDetailItem(null);
    setHistorico([]);
    setEditHistoryItem(null);
    setRecebidos([]);
  };

  const openEditEmployee = () => {
    if (!detailItem) return;
    const item = detailItem;
    setEditFunc({
      pessoa: {
        nome: item.pessoa?.nome ?? '',
        dataNascimento: parseDateDMY(item.pessoa?.data_nascimento ?? item.pessoa?.dataNascimento),
        cpf: maskCPF(item.pessoa?.cpf ?? ''),
        rg: item.pessoa?.rg ?? '',
        email: item.pessoa?.email ?? '',
        telefone: maskPhone(item.pessoa?.telefone ?? ''),
        sexo: String(item.pessoa?.sexo ?? ''),
        pais: item.pessoa?.pais ?? 'Brasil',
        estado: item.pessoa?.estado ?? '',
        municipio: item.pessoa?.municipio ?? '',
        endereco: item.pessoa?.endereco ?? '',
        complemento: item.pessoa?.complemento ?? '',
        cep: maskCEP(item.pessoa?.cep ?? ''),
        bairro: item.pessoa?.bairro ?? '',
        numero: item.pessoa?.numero ?? '',
        status: item.pessoa?.status ?? 'ATIVO',
      },
      dataAdmissao: parseDateDMY(item.data_admissao ?? item.dataAdmissao),
      salario: maskBRL(String(Math.round(item.salario * 100))),
      cargoId: String(item.cargo?.id ?? ''),
      usuario: {
        username: item.usuario?.username ?? '',
        senha: '',
      },
      senhaConfirma: '',
      showPassword: false,
      showConfirmPassword: false,
    });
    // a ficha continua aberta; o modal de edição sobe por cima
    setShowEdit(true);
  };

  const handleSaveEditEmployee = async () => {
    if (!detailItem) return;
    setIsSubmitting(true);
    try {
      // Update pessoa
      await cadastroApi.atualizarPessoa({ id: detailItem.pessoa.id, ...buildPessoaBody(editFunc.pessoa) });

      // Update funcionário
      const admissao = editFunc.dataAdmissao instanceof Date
        ? editFunc.dataAdmissao.toISOString().split('T')[0]
        : editFunc.dataAdmissao;
      const funBody = {
        id:            detailItem.id,
        data_admissao: admissao,
        cargo:         { id: Number(editFunc.cargoId) },
        salario:       parseBRL(editFunc.salario),
      };
      await funcionarioApi.atualizar(funBody);
      showNotif('Funcionário atualizado!');
      setShowEdit(false);
      fetchData(searchTerm, page);
      fetchStats();
      refreshDetail();
    } catch (e) {
      showNotif(e.message || 'Erro ao atualizar.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFireEmployee = async () => {
    if (!detailItem || !detailItem.usuario?.id) return;
    if (!window.confirm('Tem certeza que deseja desligar este funcionário?')) return;

    setFireLoading(true);
    try {
      await usuarioApi.bloquear(detailItem.usuario.id, true);
      const pessoaBody = { id: detailItem.pessoa.id, ...buildPessoaBody(detailItem.pessoa), status: 'DEMITIDO' };
      await cadastroApi.atualizarPessoa(pessoaBody);
      showNotif('Funcionário demitido e usuário bloqueado!');
      setDetailItem(null);
      fetchData(searchTerm, page);
      fetchStats();
    } catch (e) {
      showNotif(e.message || 'Erro ao desligar funcionário.', 'error');
    } finally {
      setFireLoading(false);
    }
  };

  const handleReativarEmployee = async () => {
    if (!detailItem || !detailItem.usuario?.id) return;
    if (!window.confirm('Tem certeza que deseja reativar este funcionário?')) return;

    setFireLoading(true);
    try {
      await usuarioApi.bloquear(detailItem.usuario.id, false);
      const pessoaBody = { id: detailItem.pessoa.id, ...buildPessoaBody(detailItem.pessoa), status: 'CONTRATADO' };
      await cadastroApi.atualizarPessoa(pessoaBody);
      showNotif('Funcionário reativado com sucesso!');
      setDetailItem(null);
      fetchData(searchTerm, page);
      fetchStats();
    } catch (e) {
      showNotif(e.message || 'Erro ao reativar funcionário.', 'error');
    } finally {
      setFireLoading(false);
    }
  };

  const handleEditCredentials = async () => {
    if (!detailItem?.usuario?.id) return;
    if (!credentialsForm.username.trim() || !credentialsForm.senha.trim()) {
      showNotif('Preencha username e senha.', 'error');
      return;
    }

    setCredLoading(true);
    try {
      await usuarioApi.atualizarCredenciais(detailItem.usuario.id, {
        username: credentialsForm.username.trim(),
        senha: credentialsForm.senha,
      });
      showNotif('Credenciais atualizadas!');
      setShowEditCredentials(false);
      setCredentialsForm({ username: '', senha: '' });
      refreshDetail();
    } catch (e) {
      showNotif(e.message || 'Erro ao atualizar credenciais.', 'error');
    } finally {
      setCredLoading(false);
    }
  };

  const handleEditHistory = async () => {
    if (!editHistoryItem) return;
    if (!historyForm.cargoId || !historyForm.salario) {
      showNotif('Preencha cargo e salário.', 'error');
      return;
    }

    setHistoryLoading(true);
    try {
      await funcionarioApi.atualizarHistorico(editHistoryItem.id, {
        cargoId: Number(historyForm.cargoId),
        funcionarioId: detailItem.id,
        salario: parseBRL(historyForm.salario),
      });
      showNotif('Histórico atualizado!');
      setShowEditHistory(false);
      setEditHistoryItem(null);
      // Reload history
      const res = await funcionarioApi.listarHistorico(detailItem.id);
      setHistorico(res?.content ?? res ?? []);
    } catch (e) {
      showNotif(e.message || 'Erro ao atualizar histórico.', 'error');
    } finally {
      setHistoryLoading(false);
    }
  };

  const loadRecebidos = async (historicoId) => {
    setRecebidosLoading(true);
    try {
      const res = await funcionarioApi.listarRecebidos(historicoId);
      setRecebidos(res ?? []);
    } catch (e) {
      console.error('Erro ao carregar recebidos:', e);
      setRecebidos([]);
    } finally {
      setRecebidosLoading(false);
    }
  };

  const handleAddRecebido = async () => {
    if (!editHistoryItem) return;
    if (!addRecebidoForm.valorRecebido || !addRecebidoForm.dataHoraInicio || !addRecebidoForm.dataHoraPagamento) {
      showNotif('Preencha valor, data de início e pagamento.', 'error');
      return;
    }

    setAddRecebidoLoading(true);
    try {
      const recebidoData = {
        historicoFuncionarioId: editHistoryItem.id,
        valorRecebido: parseBRL(addRecebidoForm.valorRecebido),
        dataHoraInicio: addRecebidoForm.dataHoraInicio instanceof Date
          ? addRecebidoForm.dataHoraInicio.toISOString()
          : addRecebidoForm.dataHoraInicio,
        dataHoraFim: addRecebidoForm.dataHoraFim instanceof Date
          ? addRecebidoForm.dataHoraFim.toISOString()
          : addRecebidoForm.dataHoraFim,
        dataHoraPagamento: addRecebidoForm.dataHoraPagamento instanceof Date
          ? addRecebidoForm.dataHoraPagamento.toISOString()
          : addRecebidoForm.dataHoraPagamento,
        tipoPagamentoId: Number(addRecebidoForm.tipoPagamentoId),
        descricao: addRecebidoForm.descricao || null,
      };

      await funcionarioApi.criarRecebido(recebidoData, recebidoFile);
      showNotif('Recebido adicionado!');
      setShowAddRecebido(false);
      setAddRecebidoForm({
        historicoFuncionarioId: '',
        valorRecebido: '',
        dataHoraInicio: null,
        dataHoraFim: null,
        dataHoraPagamento: null,
        tipoPagamentoId: '1',
        descricao: '',
      });
      setRecebidoFile(null);
      await loadRecebidos(editHistoryItem.id);
    } catch (e) {
      showNotif(e.message || 'Erro ao adicionar recebido.', 'error');
    } finally {
      setAddRecebidoLoading(false);
    }
  };

  const handleEditRecebido = async () => {
    if (!editRecebidoItem) return;
    if (!editRecebidoForm.valorRecebido || !editRecebidoForm.dataHoraInicio || !editRecebidoForm.dataHoraPagamento) {
      showNotif('Preencha valor, data de início e pagamento.', 'error');
      return;
    }

    setEditRecebidoLoading(true);
    try {
      const recebidoData = {
        historicoFuncionarioId: editRecebidoItem.historicoFuncionario?.id,
        valorRecebido: parseBRL(editRecebidoForm.valorRecebido),
        dataHoraInicio: editRecebidoForm.dataHoraInicio instanceof Date
          ? editRecebidoForm.dataHoraInicio.toISOString()
          : editRecebidoForm.dataHoraInicio,
        dataHoraFim: editRecebidoForm.dataHoraFim instanceof Date
          ? editRecebidoForm.dataHoraFim.toISOString()
          : editRecebidoForm.dataHoraFim,
        dataHoraPagamento: editRecebidoForm.dataHoraPagamento instanceof Date
          ? editRecebidoForm.dataHoraPagamento.toISOString()
          : editRecebidoForm.dataHoraPagamento,
        tipoPagamentoId: Number(editRecebidoForm.tipoPagamentoId),
        descricao: editRecebidoForm.descricao || null,
      };

      await funcionarioApi.atualizarRecebido(editRecebidoItem.id, recebidoData, editRecebidoFile);
      showNotif('Recebido atualizado!');
      setShowEditRecebido(false);
      setEditRecebidoItem(null);
      setEditRecebidoForm({
        historicoFuncionarioId: '',
        valorRecebido: '',
        dataHoraInicio: null,
        dataHoraFim: null,
        dataHoraPagamento: null,
        tipoPagamentoId: '1',
        descricao: '',
      });
      setEditRecebidoFile(null);
      await loadRecebidos(editHistoryItem.id);
    } catch (e) {
      showNotif(e.message || 'Erro ao editar recebido.', 'error');
    } finally {
      setEditRecebidoLoading(false);
    }
  };

  const handleDownloadArquivo = (filePath) => {
    if (!filePath) {
      showNotif('Arquivo não disponível.', 'error');
      return;
    }
    try {
      funcionarioApi.downloadArquivo(filePath);
    } catch (e) {
      showNotif(e.message || 'Erro ao baixar arquivo.', 'error');
    }
  };

  // ─────────────────────────────────────────────────────────────
  return (
    <div className={styles.page}>
      <div className={styles.container}>
        {/* Abaixo de 1024px, com uma ficha aberta, ela toma a tela e a lista sai. */}
        <main className={[styles.split, detailItem ? styles.splitListHidden : ''].join(' ')}>

          {/* ══ LISTA ═══════════════════════════════════════════ */}
          <aside className={styles.listPanel}>
            <div className={[styles.searchWrap, styles.searchWrapFull].join(' ')}>
              <Search size={16} className={styles.searchIcon} />
              <Input
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                placeholder="Buscar por nome, CPF, e-mail ou cargo..."
                className={styles.searchInput}
                aria-label="Buscar"
              />
              {loading && searchTerm.length >= 3
                ? <Loader2 size={14} className={[styles.spinInline, styles.searchSpinner].join(' ')} />
                : searchTerm.length > 0 &&
                  <button className={styles.searchClear} onClick={() => setSearchTerm('')} aria-label="Limpar busca">
                    <X size={14} />
                  </button>
              }
            </div>

            <div className={styles.listMeta}>
              <span>
                {loading
                  ? 'Carregando...'
                  : `${totalElements} funcionário${totalElements !== 1 ? 's' : ''}`}
              </span>
            </div>

            <div className={styles.listScroll}>
              {loading ? (
                <SkeletonLista />
              ) : items.length === 0 ? (
                <div className={styles.empty}>
                  <AlertCircle size={24} opacity={0.3} />
                  <span>Nenhum resultado encontrado.</span>
                </div>
              ) : items.map((item, i) => {
                const nome  = item.pessoa?.nome || '—';
                const ativo = detailItem?.id === item.id;
                return (
                  <button key={item.id} type="button"
                    className={[styles.listItem, ativo ? styles.listItemActive : ''].join(' ')}
                    onClick={() => openDetail(item, i)}>
                    <AvatarCircle name={nome} size={40} tone={i} />
                    <span className={styles.listItemBody}>
                      <span className={styles.listItemName}>
                        <span className={styles.nome}>{nome}</span>
                        {item.pessoa?.status === 'DEMITIDO' && <span className={styles.badgeDemitido}>Demitido</span>}
                      </span>
                      <span className={styles.listItemLoc}>
                        <Building size={12} /> {item.cargo?.descricao || 'Sem cargo'}
                      </span>
                    </span>
                    <ChevRight size={16} className={styles.listChevron} />
                  </button>
                );
              })}
            </div>

            {totalPages > 1 && (
              <div className={styles.pagination}>
                <button className={styles.pageBtn} disabled={page === 0} onClick={() => goToPage(page - 1)}
                  aria-label="Página anterior">
                  <ChevronLeft size={16} />
                </button>
                <span className={styles.pageCurrent}>{page + 1} de {totalPages}</span>
                <button className={styles.pageBtn} disabled={page >= totalPages - 1} onClick={() => goToPage(page + 1)}
                  aria-label="Próxima página">
                  <ChevRight size={16} />
                </button>
              </div>
            )}
          </aside>

          {/* ══ DETALHE ═════════════════════════════════════════ */}
          {!detailItem ? (
            /* ── Painel geral (nenhum funcionário selecionado) ── */
            <div className={styles.detailPanel}>
              <section className={styles.dCard}>
                <h3 className={styles.dCardHead}>
                  <Users size={16} />
                  <span className={styles.dCardTitle}>Visão geral da equipe</span>
                  <div className={styles.dCardActions}>
                    <Button variant="primary" className={[styles.btnSolid, styles.btnPrimary].join(' ')}
                      onClick={() => {
                        setNewFunc(blankFuncionario());
                        setShowErrors(false);
                        setShowPassword(false);
                        setShowConfirmPassword(false);
                        setShowAddModal(true);
                      }}>
                      Adicionar funcionário
                    </Button>
                  </div>
                </h3>

                <div className={styles.dCardBody}>
                  {statsLoading ? (
                    <SkeletonPainel />
                  ) : !stats ? (
                    <div className={styles.empty}>
                      <AlertCircle size={24} opacity={0.3} />
                      <span>Não foi possível carregar os totais.</span>
                    </div>
                  ) : (
                    <div className={styles.statGrid}>
                      <div className={styles.statCard}>
                        <p className={styles.statLabel}>Funcionários</p>
                        <p className={styles.statVal}>{stats.total}</p>
                      </div>
                      <div className={styles.statCard}>
                        <p className={styles.statLabel}>Ativos</p>
                        <p className={[styles.statVal, styles.statValGreen].join(' ')}>
                          {stats.completo ? stats.ativos : '—'}
                        </p>
                      </div>
                      <div className={styles.statCard}>
                        <p className={styles.statLabel}>Demitidos</p>
                        <p className={[styles.statVal, styles.statValRed].join(' ')}>
                          {stats.completo ? stats.demitidos : '—'}
                        </p>
                      </div>
                      <div className={styles.statCard}>
                        <p className={styles.statLabel}>Cargos</p>
                        <p className={styles.statVal}>{cargos.length}</p>
                      </div>
                    </div>
                  )}
                </div>
              </section>

              <div className={styles.detailHint}>
                Escolha um funcionário na lista ao lado para ver a ficha completa.
              </div>
            </div>
          ) : (
            /* ── Ficha do funcionário ── */
            <div className={styles.detailPanel}>

              {/* ── Dados do funcionário ── */}
              <section className={styles.dCard}>
                <h3 className={styles.dCardHead}>
                  {/* só aparece quando a ficha ocupa a tela e a lista está fora */}
                  <button type="button" className={styles.backBtn} onClick={closeDetail}
                    title="Voltar para a lista" aria-label="Voltar para a lista">
                    <ChevronLeft size={17} />
                  </button>
                  <CreditCard size={16} />
                  <span className={styles.dCardTitle}>Dados do funcionário</span>
                  <div className={styles.dCardActions}>
                    <Button className={styles.btnSolid} onClick={openEditEmployee}>
                      Editar
                    </Button>
                    {detailItem.pessoa?.status === 'DEMITIDO' ? (
                      <Button variant="primary" className={[styles.btnSolid, styles.btnPrimary].join(' ')}
                        onClick={handleReativarEmployee} disabled={fireLoading}>
                        Reativar
                      </Button>
                    ) : (
                      <Button variant="danger" className={[styles.btnSolid, styles.btnDanger].join(' ')}
                        onClick={handleFireEmployee} disabled={fireLoading}>
                        Desligar
                      </Button>
                    )}
                    <button type="button" className={styles.idClose} onClick={closeDetail}
                      title="Fechar ficha" aria-label="Fechar ficha">
                      <X size={16} />
                    </button>
                  </div>
                </h3>

                <div className={styles.dCardBody}>
                  <div className={styles.idHead}>
                    <AvatarCircle name={detailItem.pessoa?.nome} size={56} tone={detailTone} />
                    <div className={styles.idHeadMain}>
                      <div className={styles.idName}>
                        <h2 style={{ margin: 0, font: 'inherit' }}>{detailItem.pessoa?.nome ?? '—'}</h2>
                        <StatusBadge status={detailItem.pessoa?.status} />
                      </div>
                      <p className={styles.idSub}>
                        {detailItem.cargo?.descricao || 'Sem cargo'}
                        {detailItem.data_admissao && ` · admitido em ${dateFromApi(detailItem.data_admissao)}`}
                      </p>
                      <p className={styles.idSub}>Salário atual: {fmtBRL(detailItem.salario)}</p>
                    </div>
                  </div>

                  <div className={styles.fieldGrid}>
                    <Field label="CPF" value={maskCPF(detailItem.pessoa?.cpf ?? '')} mono />
                    <Field label="Data de nascimento" value={dateFromApi(detailItem.pessoa?.data_nascimento)} />
                    <Field label="E-mail" value={detailItem.pessoa?.email ? (
                      <ContatoBotao tipo="gmail" href={`mailto:${detailItem.pessoa.email}`} title="Enviar e-mail">
                        {detailItem.pessoa.email}
                      </ContatoBotao>
                    ) : ''} />
                    <Field label="Telefone" value={detailItem.pessoa?.telefone ? (
                      <ContatoBotao tipo="whatsapp" href={`https://wa.me/55${unmask(detailItem.pessoa.telefone)}`} title="WhatsApp">
                        {maskPhone(detailItem.pessoa.telefone)}
                      </ContatoBotao>
                    ) : ''} />
                    <Field label="Endereço" value={[
                      [detailItem.pessoa?.endereco, detailItem.pessoa?.numero].filter(Boolean).join(', '),
                      detailItem.pessoa?.bairro,
                    ].filter(Boolean).join(' — ')} />
                    <Field label="Cidade / UF" value={[detailItem.pessoa?.municipio, detailItem.pessoa?.estado].filter(Boolean).join(' — ')} />
                    <Field label="RG" value={detailItem.pessoa?.rg} mono />
                    <Field label="Sexo" value={
                      detailItem.pessoa?.sexo === 1 ? 'Masculino'
                      : detailItem.pessoa?.sexo === 2 ? 'Feminino'
                      : detailItem.pessoa?.sexo ? 'Outro' : ''
                    } />
                    <Field label="CEP" value={maskCEP(detailItem.pessoa?.cep ?? '')} mono />
                    <Field label="País" value={detailItem.pessoa?.pais} />
                  </div>

                  {/* ── Acesso ao sistema ── */}
                  <div className={styles.subBlock}>
                    <div className={styles.blockHead}>
                      <Lock size={15} />
                      <span>Acesso ao sistema</span>
                      <Button className={[styles.btnSolid, styles.btnSm].join(' ')}
                        onClick={() => {
                          setCredentialsForm({ username: detailItem.usuario?.username ?? '', senha: '' });
                          setShowEditCredentials(true);
                        }}>
                        Atualizar credenciais
                      </Button>
                    </div>
                    <div className={styles.fieldGrid}>
                      <Field label="Usuário" value={detailItem.usuario?.username} />
                      <Field label="Situação do acesso" value={detailItem.usuario?.bloqueado ? 'Bloqueado' : 'Liberado'} />
                    </div>
                  </div>
                </div>
              </section>

              {/* ── Histórico do funcionário ── */}
              <section className={styles.dCard}>
                <h3 className={styles.dCardHead}>
                  <Calendar size={16} />
                  <span className={styles.dCardTitle}>Histórico do funcionário</span>
                </h3>

                <div className={styles.dCardBody}>
                  {historicoLoading ? (
                    <div className={styles.empty}>
                      <Loader2 size={18} className={styles.spinInline} /> Carregando histórico...
                    </div>
                  ) : historico.length === 0 ? (
                    <p className={styles.blockEmpty}>Sem histórico de cargo e salário.</p>
                  ) : (
                    <div className={styles.histList}>
                      {historico.map((h) => {
                        const aberto = editHistoryItem?.id === h.id;
                        return (
                          <div key={h.id} className={styles.histItem}>
                            <button type="button" className={styles.histToggle}
                              aria-expanded={aberto}
                              onClick={() => {
                                if (aberto) { setEditHistoryItem(null); setRecebidos([]); return; }
                                setEditHistoryItem(h);
                                setHistoryForm({
                                  cargoId: String(h.cargo?.id ?? ''),
                                  salario: maskBRL(String(Math.round(h.salario * 100))),
                                });
                                loadRecebidos(h.id);
                              }}>
                              <span>
                                <span className={styles.histCargo}>{h.cargo?.descricao || '—'}</span>
                                <span className={styles.histSalario}>{fmtBRL(h.salario)}</span>
                              </span>
                              <ChevRight size={16}
                                className={[styles.histChevron, aberto ? styles.histChevronOpen : ''].join(' ')} />
                            </button>

                            {aberto && (
                              <div className={styles.histPanel}>
                                <div className={styles.histPanelHead}>
                                  <span>Recebimentos</span>
                                  <div className={styles.histPanelActions}>
                                    <Button className={[styles.btnSolid, styles.btnSm].join(' ')}
                                      onClick={() => {
                                        setAddRecebidoForm({
                                          historicoFuncionarioId: h.id,
                                          valorRecebido: '',
                                          dataHoraInicio: null,
                                          dataHoraFim: null,
                                          dataHoraPagamento: null,
                                          tipoPagamentoId: '1',
                                          descricao: '',
                                        });
                                        setRecebidoFile(null);
                                        setShowAddRecebido(true);
                                      }}>
                                      Novo
                                    </Button>
                                    <Button className={[styles.btnSolid, styles.btnSm].join(' ')}
                                      onClick={() => {
                                        setHistoryForm({
                                          cargoId: String(h.cargo?.id ?? ''),
                                          salario: maskBRL(String(Math.round(h.salario * 100))),
                                        });
                                        setShowEditHistory(true);
                                      }}>
                                      Editar
                                    </Button>
                                  </div>
                                </div>

                                {recebidosLoading ? (
                                  <div className={styles.empty} style={{ padding: '16px 10px' }}>
                                    <Loader2 size={16} className={styles.spinInline} /> Carregando...
                                  </div>
                                ) : recebidos.length === 0 ? (
                                  <p className={styles.blockEmpty} style={{ paddingLeft: 8 }}>
                                    Sem registros de recebimento.
                                  </p>
                                ) : (
                                  <div className={styles.recebList}>
                                    {recebidos.map((r) => (
                                      <div key={r.id} className={styles.recebRow}>
                                        <div style={{ minWidth: 0 }}>
                                          <div className={styles.recebVal}>{fmtBRL(r.valorRecebido)}</div>
                                          <div className={styles.recebMeta}>
                                            {r.tipoPagamento?.descricao} · {dateFromApi(r.dataHoraPagamento)}
                                            {r.descricao && ` · ${r.descricao.toUpperCase()}`}
                                          </div>
                                        </div>
                                        <div className={styles.recebActions}>
                                          {r.pathArquivoComprovante && (
                                            <Button className={[styles.btnSolid, styles.btnSm].join(' ')}
                                              onClick={() => handleDownloadArquivo(r.pathArquivoComprovante)}>
                                              Comprovante
                                            </Button>
                                          )}
                                          <Button className={[styles.btnSolid, styles.btnSm].join(' ')}
                                            onClick={() => {
                                              setEditRecebidoItem(r);
                                              setEditRecebidoForm({
                                                historicoFuncionarioId: r.historicoFuncionario?.id ?? '',
                                                valorRecebido: maskBRL(String(Math.round(r.valorRecebido * 100))),
                                                dataHoraInicio: r.dataHoraInicio ? new Date(r.dataHoraInicio) : null,
                                                dataHoraFim: r.dataHoraFim ? new Date(r.dataHoraFim) : null,
                                                dataHoraPagamento: r.dataHoraPagamento ? new Date(r.dataHoraPagamento) : null,
                                                tipoPagamentoId: String(r.tipoPagamento?.id ?? '1'),
                                                descricao: r.descricao ?? '',
                                              });
                                              setEditRecebidoFile(null);
                                              setShowEditRecebido(true);
                                            }}>
                                            Editar
                                          </Button>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </section>
            </div>
          )}
        </main>
      </div>


      {/* ══ MODAL: EDITAR FUNCIONÁRIO ═════════════════════════ */}
      <Modal
        open={showEdit}
        onClose={() => setShowEdit(false)}
        size="lg"
        title="Editar Funcionário"
        footer={
          <div className={styles.modalFooter}>
            <Button onClick={() => setShowEdit(false)} className={styles.full}>Cancelar</Button>
            <Button variant="primary" onClick={handleSaveEditEmployee} disabled={isSubmitting} className={styles.full}>
              {isSubmitting ? <><Loader2 size={13} className={styles.spinInline} /> Salvando...</> : 'Salvar'}
            </Button>
          </div>
        }>
        <div className={styles.formBody}>
          <PessoaFormEmployee data={editFunc} onChange={setEditFunc} onFetchCEP={fetchCEP} onCheckCPF={checkCPF} />

          <div className={styles.sectionLabel}>Dados Profissionais</div>

          <div className={styles.grid2}>
            <FormField label="Data de Admissão *">
              <DatePicker
                mode="single"
                value={editFunc.dataAdmissao}
                onChange={d => setEditFunc(prev => ({ ...prev, dataAdmissao: d ?? null }))}
                placeholder="dd/mm/aaaa"
              />
            </FormField>
            <FormField label="Cargo *">
              <Select value={editFunc.cargoId} onChange={e => setEditFunc(prev => ({ ...prev, cargoId: e.target.value }))}>
                <option value="">Selecione um cargo</option>
                {cargos.map(c => <option key={c.id} value={c.id}>{c.descricao}</option>)}
              </Select>
            </FormField>
          </div>

          <FormField label="Salário">
            <div className={styles.currencyWrapper}>
              <span className={styles.currencyPrefix}>R$</span>
              <Input value={editFunc.salario} onChange={e => setEditFunc(prev => ({ ...prev, salario: maskBRL(e.target.value) }))} placeholder="" />
            </div>
          </FormField>

          <div className={styles.sectionLabel}>Acesso ao Sistema</div>

          <div className={styles.grid2}>
            <FormField label="Usuário para Acesso">
              <Input value={editFunc.usuario.username} onChange={e => setEditFunc(prev => ({ ...prev, usuario: { ...prev.usuario, username: e.target.value } }))} placeholder="username" readOnly />
            </FormField>
          </div>
        </div>
      </Modal>

      {/* ══ MODAL: ADICIONAR FUNCIONÁRIO ══════════════════════ */}
      <Modal
        open={showAddModal}
        onClose={() => { setShowAddModal(false); setShowErrors(false); }}
        size="lg"
        title="Novo Funcionário"
        footer={
          <div className={styles.modalFooter}>
            <Button onClick={() => { setShowAddModal(false); setShowErrors(false); }}>Cancelar</Button>
            <Button variant="primary" onClick={handleAddEmployee} disabled={isSubmitting}>
              {isSubmitting ? <><Loader2 size={13} className={styles.spinInline} /> Salvando...</> : 'Cadastrar'}
            </Button>
          </div>
        }>
        <div className={styles.formBody}>
          <PessoaFormEmployee data={newFunc} onChange={setNewFunc} onFetchCEP={fetchCEP} onCheckCPF={checkCPF} showErrors={showErrors} />

          <div className={styles.sectionLabel}>Dados Profissionais</div>

          <div className={styles.grid2}>
            <FormField label="Data de Admissão *">
              <DatePicker
                mode="single"
                value={newFunc.dataAdmissao}
                onChange={d => setNewFunc(prev => ({ ...prev, dataAdmissao: d ?? null }))}
                placeholder="dd/mm/aaaa"
              />
            </FormField>
            <FormField label="Cargo *">
              <Select value={newFunc.cargoId} onChange={e => setNewFunc(prev => ({ ...prev, cargoId: e.target.value }))}>
                <option value="">Selecione um cargo</option>
                {cargos.map(c => <option key={c.id} value={c.id}>{c.descricao}</option>)}
              </Select>
            </FormField>
          </div>

          <FormField label="Salário">
            <div className={styles.currencyWrapper}>
              <span className={styles.currencyPrefix}>R$</span>
              <Input value={newFunc.salario} onChange={e => setNewFunc(prev => ({ ...prev, salario: maskBRL(e.target.value) }))} placeholder="" />
            </div>
          </FormField>

          <div className={styles.sectionLabel}>Acesso ao Sistema</div>

          <FormField label="Usuário para Acesso">
            <Input value={newFunc.usuario.username} onChange={e => setNewFunc(prev => ({ ...prev, usuario: { ...prev.usuario, username: e.target.value } }))} placeholder="username" />
          </FormField>

          <div className={styles.grid2}>
            <div>
              <label className={styles.fieldLabel}>Senha *</label>
              <div className={styles.inputWithSpinner}>
                <Input
                  type={showPassword ? 'text' : 'password'}
                  value={newFunc.usuario.senha}
                  onChange={e => setNewFunc(prev => ({ ...prev, usuario: { ...prev.usuario, senha: e.target.value } }))}
                  placeholder="Digite a senha"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className={styles.eyeBtn}
                >
                  {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </div>
            <div>
              <label className={styles.fieldLabel}>Confirmar Senha *</label>
              <div className={styles.inputWithSpinner}>
                <Input
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={newFunc.senhaConfirma}
                  onChange={e => setNewFunc(prev => ({ ...prev, senhaConfirma: e.target.value }))}
                  placeholder="Confirme a senha"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className={styles.eyeBtn}
                >
                  {showConfirmPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </div>
          </div>
        </div>
      </Modal>

      {/* ══ MODAL: EDITAR CREDENCIAIS ═════════════════════════ */}
      <Modal
        open={showEditCredentials}
        onClose={() => setShowEditCredentials(false)}
        size="sm"
        title="Alterar Credenciais"
        footer={
          <div className={styles.modalFooter}>
            <Button onClick={() => setShowEditCredentials(false)}>Cancelar</Button>
            <Button variant="primary" onClick={handleEditCredentials} disabled={credLoading}>
              {credLoading ? <><Loader2 size={13} className={styles.spinInline} /> Salvando...</> : 'Salvar'}
            </Button>
          </div>
        }
      >
        <div className={styles.formBody}>
          <FormField label="Username *">
            <Input
              value={credentialsForm.username}
              onChange={e => setCredentialsForm(prev => ({ ...prev, username: e.target.value }))}
              placeholder="novo.username"
            />
          </FormField>
          <FormField label="Senha *">
            <Input
              type="password"
              value={credentialsForm.senha}
              onChange={e => setCredentialsForm(prev => ({ ...prev, senha: e.target.value }))}
              placeholder="••••••••"
            />
          </FormField>
        </div>
      </Modal>

      {/* ══ MODAL: EDITAR HISTÓRICO ═══════════════════════════ */}
      <Modal
        open={showEditHistory}
        onClose={() => setShowEditHistory(false)}
        size="sm"
        title="Editar Histórico de Salário"
        footer={
          <div className={styles.modalFooter}>
            <Button onClick={() => setShowEditHistory(false)}>Cancelar</Button>
            <Button variant="primary" onClick={handleEditHistory} disabled={historyLoading}>
              {historyLoading ? <><Loader2 size={13} className={styles.spinInline} /> Salvando...</> : 'Salvar'}
            </Button>
          </div>
        }
      >
        <div className={styles.formBody}>
          <FormField label="Cargo *">
            <Select value={historyForm.cargoId} onChange={e => setHistoryForm(prev => ({ ...prev, cargoId: e.target.value }))}>
              <option value="">Selecione um cargo</option>
              {cargos.map(c => <option key={c.id} value={String(c.id)}>{c.descricao}</option>)}
            </Select>
          </FormField>
          <FormField label="Salário *">
            <div className={styles.currencyWrapper}>
              <span className={styles.currencyPrefix}>R$</span>
              <Input
                value={historyForm.salario}
                onChange={e => setHistoryForm(prev => ({ ...prev, salario: maskBRL(e.target.value) }))}
                placeholder=""
              />
            </div>
          </FormField>
        </div>
      </Modal>

      {/* ══ MODAL: ADICIONAR RECEBIDO ═════════════════════════ */}
      <Modal
        open={showAddRecebido}
        onClose={() => setShowAddRecebido(false)}
        size="md"
        title="Novo Recebimento"
        footer={
          <div className={styles.modalFooter}>
            <Button onClick={() => setShowAddRecebido(false)}>Cancelar</Button>
            <Button variant="primary" onClick={handleAddRecebido} disabled={addRecebidoLoading}>
              {addRecebidoLoading ? <><Loader2 size={13} className={styles.spinInline} /> Salvando...</> : 'Salvar'}
            </Button>
          </div>
        }
      >
        <div className={styles.formBody}>
          <FormField label="Valor Recebido *">
            <div className={styles.currencyWrapper}>
              <span className={styles.currencyPrefix}>R$</span>
              <Input
                value={addRecebidoForm.valorRecebido}
                onChange={e => setAddRecebidoForm(prev => ({ ...prev, valorRecebido: maskBRL(e.target.value) }))}
                placeholder=""
              />
            </div>
          </FormField>

          <div className={styles.grid2}>
            <FormField label="Data/Hora Início *">
              <DatePicker
                mode="single"
                value={addRecebidoForm.dataHoraInicio}
                onChange={d => setAddRecebidoForm(prev => ({ ...prev, dataHoraInicio: d ?? null }))}
                placeholder="dd/mm/aaaa"
              />
            </FormField>
            <FormField label="Data/Hora Fim">
              <DatePicker
                mode="single"
                value={addRecebidoForm.dataHoraFim}
                onChange={d => setAddRecebidoForm(prev => ({ ...prev, dataHoraFim: d ?? null }))}
                placeholder="dd/mm/aaaa"
              />
            </FormField>
          </div>

          <FormField label="Data/Hora Pagamento *">
            <DatePicker
              mode="single"
              value={addRecebidoForm.dataHoraPagamento}
              onChange={d => setAddRecebidoForm(prev => ({ ...prev, dataHoraPagamento: d ?? null }))}
              placeholder="dd/mm/aaaa"
            />
          </FormField>

          <FormField label="Tipo de Pagamento *">
            <Select value={addRecebidoForm.tipoPagamentoId} onChange={e => setAddRecebidoForm(prev => ({ ...prev, tipoPagamentoId: e.target.value }))}>
              <option value="">Selecione um tipo</option>
              {tipoPagamentos.map(t => <option key={t.id} value={String(t.id)}>{t.descricao}</option>)}
            </Select>
          </FormField>

          <FormField label="Descrição">
            <Input
              value={addRecebidoForm.descricao}
              onChange={e => setAddRecebidoForm(prev => ({ ...prev, descricao: e.target.value?.toUpperCase() }))}
              placeholder="ex: ADIANTAMENTO, BONUS..."
            />
          </FormField>

          <FormField label="Comprovante de pagamento">
            <input
              ref={fileInputRef}
              type="file"
              style={{ display: 'none' }}
              onChange={e => setRecebidoFile(e.target.files?.[0] || null)}
              accept=".pdf,.jpg,.jpeg,.png"
            />
            <Button
              onClick={() => fileInputRef.current?.click()}
              style={{ width: '100%', justifyContent: 'flex-start', gap: '6px' }}>
              {recebidoFile ? (
                <><CheckCircle2 size={14} /> {recebidoFile.name}</>
              ) : (
                <><Upload size={14} /> Selecionar Arquivo</>
              )}
            </Button>
          </FormField>
        </div>
      </Modal>

      {/* ══ MODAL: EDITAR RECEBIDO ════════════════════════════*/}
      <Modal
        open={showEditRecebido}
        onClose={() => setShowEditRecebido(false)}
        size="md"
        title="Editar Recebimento"
        footer={
          <div className={styles.modalFooter}>
            <Button onClick={() => setShowEditRecebido(false)}>Cancelar</Button>
            <Button variant="primary" onClick={handleEditRecebido} disabled={editRecebidoLoading}>
              {editRecebidoLoading ? <><Loader2 size={13} className={styles.spinInline} /> Salvando...</> : 'Salvar'}
            </Button>
          </div>
        }
      >
        <div className={styles.formBody}>
          <FormField label="Valor Recebido *">
            <div className={styles.currencyWrapper}>
              <span className={styles.currencyPrefix}>R$</span>
              <Input
                value={editRecebidoForm.valorRecebido}
                onChange={e => setEditRecebidoForm(prev => ({ ...prev, valorRecebido: maskBRL(e.target.value) }))}
                placeholder=""
              />
            </div>
          </FormField>

          <div className={styles.grid2}>
            <FormField label="Data/Hora Início *">
              <DatePicker
                mode="single"
                value={editRecebidoForm.dataHoraInicio}
                onChange={d => setEditRecebidoForm(prev => ({ ...prev, dataHoraInicio: d ?? null }))}
                placeholder="dd/mm/aaaa"
              />
            </FormField>
            <FormField label="Data/Hora Fim">
              <DatePicker
                mode="single"
                value={editRecebidoForm.dataHoraFim}
                onChange={d => setEditRecebidoForm(prev => ({ ...prev, dataHoraFim: d ?? null }))}
                placeholder="dd/mm/aaaa"
              />
            </FormField>
          </div>

          <FormField label="Data/Hora Pagamento *">
            <DatePicker
              mode="single"
              value={editRecebidoForm.dataHoraPagamento}
              onChange={d => setEditRecebidoForm(prev => ({ ...prev, dataHoraPagamento: d ?? null }))}
              placeholder="dd/mm/aaaa"
            />
          </FormField>

          <FormField label="Tipo de Pagamento *">
            <Select value={editRecebidoForm.tipoPagamentoId} onChange={e => setEditRecebidoForm(prev => ({ ...prev, tipoPagamentoId: e.target.value }))}>
              <option value="">Selecione um tipo</option>
              {tipoPagamentos.map(t => <option key={t.id} value={String(t.id)}>{t.descricao}</option>)}
            </Select>
          </FormField>

          <FormField label="Descrição">
            <Input
              value={editRecebidoForm.descricao}
              onChange={e => setEditRecebidoForm(prev => ({ ...prev, descricao: e.target.value?.toUpperCase() }))}
              placeholder="ex: ADIANTAMENTO, BONUS..."
            />
          </FormField>

          <FormField label="Arquivo de Comprovante">
            <input
              ref={editFileInputRef}
              type="file"
              style={{ display: 'none' }}
              onChange={e => setEditRecebidoFile(e.target.files?.[0] || null)}
              accept=".pdf,.jpg,.jpeg,.png"
            />
            <Button
              onClick={() => editFileInputRef.current?.click()}
              style={{ width: '100%', justifyContent: 'flex-start', gap: '6px' }}>
              {editRecebidoFile ? (
                <><CheckCircle2 size={14} /> {editRecebidoFile.name}</>
              ) : (
                <><Upload size={14} /> Selecionar Arquivo</>
              )}
            </Button>
          </FormField>
        </div>
      </Modal>

      <Notification notification={notification} />
    </div>
  );
}
