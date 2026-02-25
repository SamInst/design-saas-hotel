import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Search, Plus, Loader2, AlertCircle, Calendar, Edit2, X,
  Phone, Mail, Trash2, Eye, EyeOff, Lock, Building,
  Users, ChevronLeft, ChevronRight as ChevRight,
  CreditCard, MapPin, CheckCircle2, AlertTriangle, XCircle,
} from 'lucide-react';

import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { Input, Select, FormField } from '../../components/ui/Input';
import { Notification } from '../../components/ui/Notification';
import { DatePicker } from '../../components/ui/DatePicker';
import { funcionarioApi, cargoApi, cadastroApi, usuarioApi } from '../../services/api';

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
const maskSalary = v => {
  const n = v.replace(/\D/g,'');
  if (!n) return '';
  const inteiros = n.slice(0, -2) || '0';
  const decimais = (n.slice(-2) || '00').padStart(2, '0');
  return `${inteiros.replace(/\B(?=(\d{3})+(?!\d))/g, '.')},${decimais}`;
};
const unmaskSalary = v => v.replace(/\D/g,'').padStart(3, '0');

const unmask = v => (v ?? '').replace(/\D/g,'');
const up = v => (v ?? '').toUpperCase().trim();
const cleanSalary = v => {
  const n = unmaskSalary(v);
  const inteiros = n.slice(0, -2);
  const decimais = n.slice(-2);
  return parseInt(inteiros) + parseInt(decimais) / 100;
};

// ── Avatar helpers ────────────────────────────────────────────
const AVATAR_COLORS = [
  { bg: 'rgba(124,58,237,.18)',  fg: '#7c3aed' },
  { bg: 'rgba(14,165,233,.18)',  fg: '#0ea5e9' },
  { bg: 'rgba(16,185,129,.18)',  fg: '#10b981' },
  { bg: 'rgba(249,115,22,.18)',  fg: '#f97316' },
  { bg: 'rgba(236,72,153,.18)',  fg: '#ec4899' },
  { bg: 'rgba(245,158,11,.18)',  fg: '#f59e0b' },
  { bg: 'rgba(99,102,241,.18)',  fg: '#6366f1' },
  { bg: 'rgba(20,184,166,.18)',  fg: '#14b8a6' },
];

const avatarColor = (name) => {
  const idx = ((name ?? '').charCodeAt(0) || 0) % AVATAR_COLORS.length;
  return AVATAR_COLORS[idx];
};

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

const dateFromApi = d => {
  if (!d) return '';
  if (d.includes('/')) return d; // already formatted
  const p = d.split('-');
  return `${(p[2]??'').padStart(2,'0')}/${(p[1]??'').padStart(2,'0')}/${p[0]??''}`;
};

// ── Status Badge ──────────────────────────────────────────────
function StatusBadge({ status }) {
  const cls = status === 'ATIVO'     ? styles.badgeAtivo
            : status === 'CONTRATADO' ? styles.badgeContratado
            : styles.badgeDefault;
  return <span className={cls}>{status ?? '—'}</span>;
}

// ── Avatar Circle ─────────────────────────────────────────────
function AvatarCircle({ name, size = 40, className = '' }) {
  const { bg, fg } = avatarColor(name);
  return (
    <div
      className={[styles.avatar, className].join(' ')}
      style={{ width: size, height: size, fontSize: size * 0.36, background: bg, color: fg }}
    >
      {getInitials(name)}
    </div>
  );
}

// ── Section & KV helpers ──────────────────────────────────────
function Section({ title, children }) {
  return (
    <div className={styles.section}>
      <div className={styles.sectionLabel}>{title}</div>
      <div className={styles.kvList}>{children}</div>
    </div>
  );
}

function KV({ label, value }) {
  return (
    <div className={styles.kvRow}>
      <span className={styles.kvLabel}>{label}</span>
      <span className={styles.kvVal}>{value || '—'}</span>
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

      <div className={styles.formDivider} />

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
  const [showDetail, setShowDetail] = useState(false);
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

  // detail modal tabs and history
  const [detailTab, setDetailTab] = useState('cadastro');
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

  const showNotif = (msg, type = 'success') => {
    setNotification({ message: msg, type });
    setTimeout(() => setNotification(null), 3200);
  };

  // Fetch cargos on mount
  useEffect(() => {
    const fetchCargos = async () => {
      try {
        const res = await cargoApi.listar();
        setCargos(res?.content ?? []);
      } catch (e) {
        console.error('Erro ao carregar cargos:', e);
      }
    };
    fetchCargos();
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
    nome:           up(p.nome),
    dataNascimento: p.dataNascimento instanceof Date
      ? p.dataNascimento.toISOString().split('T')[0] : (p.dataNascimento ?? ''),
    cpf:            unmask(p.cpf),
    rg:             up(p.rg),
    email:          (p.email ?? '').trim(),
    telefone:       unmask(p.telefone),
    pais:           up(p.pais) || 'BRASIL',
    estado:         up(p.estado),
    municipio:      up(p.municipio),
    endereco:       up(p.endereco),
    complemento:    up(p.complemento),
    cep:            unmask(p.cep),
    bairro:         up(p.bairro),
    sexo:           Number(p.sexo) || 1,
    numero:         up(p.numero),
    status:         p.status ?? 'ATIVO',
  });

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

  useEffect(() => { fetchData('', 0); }, [fetchData]);

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
    if (!newFunc.usuario.username || !newFunc.usuario.senha || !newFunc.senhaConfirma) {
      showNotif('Defina username e senha para o acesso.', 'error');
      return;
    }
    if (newFunc.usuario.senha !== newFunc.senhaConfirma) {
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
      const funBody = {
        pessoaId,
        dataAdmissao: newFunc.dataAdmissao instanceof Date
          ? newFunc.dataAdmissao.toISOString().split('T')[0]
          : newFunc.dataAdmissao,
        salario: cleanSalary(newFunc.salario),
        cargoId: Number(newFunc.cargoId),
        usuario: {
          username: newFunc.usuario.username.trim(),
          senha: newFunc.usuario.senha,
        },
      };

      await funcionarioApi.criar(funBody);
      showNotif('Funcionário cadastrado com sucesso!');
      setShowAddModal(false);
      setNewFunc(blankFuncionario());
      setShowErrors(false);
      setShowPassword(false);
      setShowConfirmPassword(false);
      fetchData(searchTerm, page);
    } catch (e) {
      showNotif(e.message || 'Erro ao cadastrar funcionário.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const openDetail = async item => {
    setDetailItem(item);
    setDetailTab('cadastro');
    setShowDetail(true);

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

  const openEditEmployee = () => {
    if (!detailItem) return;
    const item = detailItem;
    setEditFunc({
      pessoa: {
        nome: item.pessoa?.nome ?? '',
        dataNascimento: item.pessoa?.dataNascimento ? new Date(item.pessoa.dataNascimento + 'T12:00:00') : null,
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
      dataAdmissao: item.dataAdmissao ? new Date(item.dataAdmissao + 'T12:00:00') : null,
      salario: maskSalary(String(Math.round(item.salario * 100))),
      cargoId: String(item.cargo?.id ?? ''),
      usuario: {
        username: item.usuario?.username ?? '',
        senha: '',
      },
      senhaConfirma: '',
      showPassword: false,
      showConfirmPassword: false,
    });
    setShowDetail(false);
    setShowEdit(true);
  };

  const handleSaveEditEmployee = async () => {
    if (!detailItem) return;
    setIsSubmitting(true);
    try {
      // Update pessoa
      await cadastroApi.atualizarPessoa(detailItem.pessoa.id, buildPessoaBody(editFunc.pessoa));

      // Update funcionário
      const funBody = {
        cargoId: Number(editFunc.cargoId),
        dataAdmissao: editFunc.dataAdmissao instanceof Date
          ? editFunc.dataAdmissao.toISOString().split('T')[0]
          : editFunc.dataAdmissao,
        salario: cleanSalary(editFunc.salario),
      };
      await funcionarioApi.atualizar(detailItem.id, funBody);
      showNotif('Funcionário atualizado!');
      setShowEdit(false);
      fetchData(searchTerm, page);
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
      // Bloquear usuário
      await usuarioApi.bloquear(detailItem.usuario.id, true);

      // Atualizar status do funcionário para DEMITIDO
      const pessoaBody = buildPessoaBody(detailItem.pessoa);
      pessoaBody.status = 'DEMITIDO';
      await cadastroApi.atualizarPessoa(detailItem.pessoa.id, pessoaBody);

      showNotif('Funcionário demitido e usuário bloqueado!');
      setShowDetail(false);
      fetchData(searchTerm, page);
    } catch (e) {
      showNotif(e.message || 'Erro ao desligar funcionário.', 'error');
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
        salario: cleanSalary(historyForm.salario),
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

  // ── Modal footers ──────────────────────────────────────────
  const detailFooter = detailItem ? (
    <div className={styles.detailFooterActions}>
      <Button onClick={() => {
        setCredentialsForm({ username: detailItem.usuario?.username ?? '', senha: '' });
        setShowEditCredentials(true);
      }}>
        <Lock size={13} /> Credenciais
      </Button>
      <Button onClick={openEditEmployee}>
        <Edit2 size={13} /> Editar
      </Button>
      <Button variant="danger" onClick={handleFireEmployee} disabled={fireLoading}>
        <Trash2 size={13} /> Desligar
      </Button>
    </div>
  ) : null;

  // ─────────────────────────────────────────────────────────────
  return (
    <div className={styles.page}>
      <div className={styles.container}>

        <div className={styles.card}>
          {/* Header */}
          <div className={styles.tableHeader}>
            <div>
              <h2 className={styles.h2}>Funcionários</h2>
              <p className={styles.subtitle}>Gestão de equipe e acesso</p>
            </div>
            <div className={styles.tableTools}>
              <div className={styles.searchWrap}>
                <Search size={13} className={styles.searchIcon} />
                <Input
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  placeholder="Nome, CPF, email, cargo..."
                  className={styles.searchInput}
                />
                {loading && searchTerm.length >= 3 &&
                  <Loader2 size={13} className={[styles.spinInline, styles.searchSpinner].join(' ')} />}
              </div>
              <Button variant="primary" onClick={() => {
                setNewFunc(blankFuncionario());
                setShowErrors(false);
                setShowPassword(false);
                setShowConfirmPassword(false);
                setShowAddModal(true);
              }}>
                <Plus size={14} /> Adicionar
              </Button>
            </div>
          </div>

          {/* Table */}
          <div className={styles.tableWrap}>
            {loading ? (
              <div className={styles.empty}><Loader2 size={20} className={styles.spin} /> Carregando...</div>
            ) : items.length === 0 ? (
              <div className={styles.empty}><AlertCircle size={26} opacity={0.3} /><span>Nenhum resultado encontrado.</span></div>
            ) : (
              <table className={styles.table}>
                <thead><tr>
                  <th style={{ width: 44 }}></th>
                  <th>Nome</th>
                  <th style={{ width: 140 }}>Cargo</th>
                  <th style={{ width: 140 }}>Data Admissão</th>
                  <th style={{ width: 100 }}>Status</th>
                </tr></thead>
                <tbody>
                  {items.map(item => {
                    const name = item.pessoa?.nome || '—';
                    const { bg, fg } = avatarColor(name);
                    return (
                      <tr key={item.id} className={styles.row} onClick={() => openDetail(item)}>
                        <td>
                          <div className={styles.listAvatar} style={{ background: bg, color: fg }}>
                            {getInitials(name)}
                          </div>
                        </td>
                        <td>
                          <div className={styles.nome}>{name}</div>
                          <div className={styles.sub}>{item.usuario?.username || '—'}</div>
                        </td>
                        <td className={styles.nome}>{item.cargo?.cargo || '—'}</td>
                        <td className={styles.mono}>{dateFromApi(item.dataAdmissao ?? '')}</td>
                        <td><StatusBadge status={item.pessoa?.status} /></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className={styles.pagination}>
              <button className={styles.pageBtn} disabled={page === 0} onClick={() => goToPage(page - 1)}>
                <ChevronLeft size={14} />
              </button>
              {Array.from({ length: totalPages }, (_, i) => (
                <button key={i}
                  className={[styles.pageBtn, page === i ? styles.pageBtnActive : ''].join(' ')}
                  onClick={() => goToPage(i)}>{i + 1}</button>
              ))}
              <button className={styles.pageBtn} disabled={page >= totalPages - 1} onClick={() => goToPage(page + 1)}>
                <ChevRight size={14} />
              </button>
              <span className={styles.pageInfo}>{totalElements} registro{totalElements !== 1 ? 's' : ''}</span>
            </div>
          )}
        </div>
      </div>

      {/* ══ MODAL: DETALHE FUNCIONÁRIO ════════════════════════ */}
      {detailItem && (
        <Modal
          open={showDetail}
          onClose={() => setShowDetail(false)}
          size="xl"
          title={
            <div className={styles.modalTitleBlock}>
              <AvatarCircle name={detailItem.pessoa?.nome} size={42} />
              <div>
                <div className={styles.modalTitleName}>{detailItem.pessoa?.nome ?? '—'}</div>
                <div className={styles.modalTitleMeta}>
                  <span className={styles.detailId}>#{detailItem.id}</span>
                  <StatusBadge status={detailItem.pessoa?.status} />
                </div>
              </div>
            </div>
          }
          footer={detailFooter}
        >
          {/* Tabs */}
          <div className={styles.tabs}>
            {[['cadastro', 'Cadastro'], ['historico', 'Histórico de Salário']].map(([id, label]) => (
              <button key={id}
                className={[styles.tab, detailTab === id ? styles.tabActive : ''].join(' ')}
                onClick={() => setDetailTab(id)}>
                {label}
              </button>
            ))}
          </div>

          {/* Tab: Cadastro */}
          {detailTab === 'cadastro' && (
            <div className={styles.detailGrid}>
              <Section title="Dados Pessoais">
                <KV label="CPF" value={maskCPF(detailItem.pessoa?.cpf ?? '')} />
                <KV label="RG" value={detailItem.pessoa?.rg} />
                <KV label="Nasc." value={dateFromApi(detailItem.pessoa?.dataNascimento)} />
                <KV label="Sexo" value={detailItem.pessoa?.sexo === 1 ? 'Masculino' : detailItem.pessoa?.sexo === 2 ? 'Feminino' : 'Outro'} />
                <KV label="Telefone" value={
                  <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                    <span>{maskPhone(detailItem.pessoa?.telefone ?? '') || '—'}</span>
                    {detailItem.pessoa?.telefone && (
                      <a href={`https://wa.me/55${unmask(detailItem.pessoa.telefone)}`} target="_blank"
                        rel="noreferrer" className={styles.quickBtn} title="WhatsApp" onClick={e => e.stopPropagation()}>
                        <Phone size={11} />
                      </a>
                    )}
                  </div>
                } />
                <KV label="Email" value={
                  <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                    <span>{detailItem.pessoa?.email || '—'}</span>
                    {detailItem.pessoa?.email && (
                      <a href={`mailto:${detailItem.pessoa.email}`} target="_blank" rel="noreferrer"
                        className={styles.quickBtn} title="Enviar e-mail" onClick={e => e.stopPropagation()}>
                        <Mail size={11} />
                      </a>
                    )}
                  </div>
                } />
              </Section>
              <Section title="Endereço">
                <KV label="CEP" value={maskCEP(detailItem.pessoa?.cep ?? '')} />
                <KV label="Endereço" value={`${detailItem.pessoa?.endereco ?? ''}${detailItem.pessoa?.numero ? ', ' + detailItem.pessoa.numero : ''}`} />
                <KV label="Bairro" value={detailItem.pessoa?.bairro} />
                <KV label="Cidade" value={[detailItem.pessoa?.municipio, detailItem.pessoa?.estado].filter(Boolean).join(' - ')} />
                <KV label="País" value={detailItem.pessoa?.pais} />
              </Section>
              <Section title="Profissional">
                <KV label="Cargo" value={detailItem.cargo?.cargo} />
                <KV label="Data Admissão" value={dateFromApi(detailItem.dataAdmissao ?? '')} />
                <KV label="Salário" value={`R$ ${maskSalary(String(Math.round(detailItem.salario * 100)))}`} />
                <KV label="Usuário" value={detailItem.usuario?.username} />
                <KV label="Status Acesso" value={detailItem.usuario?.bloqueado ? 'Bloqueado' : 'Ativo'} />
              </Section>
            </div>
          )}

          {/* Tab: Histórico */}
          {detailTab === 'historico' && (
            <div className={styles.tabBody}>
              {historicoLoading ? (
                <div className={styles.empty}><Loader2 size={20} className={styles.spin} /> Carregando histórico...</div>
              ) : historico.length === 0 ? (
                <div className={styles.empty}><AlertCircle size={26} opacity={0.3} /><span>Sem histórico de salário.</span></div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {historico.map((h) => (
                    <div key={h.id} className={styles.historyCard} style={{
                      border: '1px solid var(--border)',
                      padding: 12,
                      borderRadius: 8,
                      cursor: 'pointer',
                      transition: 'background .12s'
                    }} onMouseEnter={e => e.currentTarget.style.background = 'rgba(124,58,237,.04)'}
                       onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                       onClick={() => {
                         setEditHistoryItem(h);
                         setHistoryForm({
                           cargoId: String(h.cargo?.id ?? ''),
                           salario: maskSalary(String(Math.round(h.salario * 100)))
                         });
                         setShowEditHistory(true);
                       }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <div className={styles.nome}>{h.cargo?.descricao}</div>
                          <div className={styles.sub}>R$ {maskSalary(String(Math.round(h.salario * 100)))}</div>
                        </div>
                        <Edit2 size={14} className={styles.iconMuted} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </Modal>
      )}

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

          <div className={styles.formDivider} />

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
                {cargos.map(c => <option key={c.id} value={c.id}>{c.cargo}</option>)}
              </Select>
            </FormField>
          </div>

          <FormField label="Salário">
            <Input value={editFunc.salario} onChange={e => setEditFunc(prev => ({ ...prev, salario: maskSalary(e.target.value) }))} placeholder="0,00" />
          </FormField>

          <div className={styles.formDivider} />

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

          <div className={styles.formDivider} />

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
                {cargos.map(c => <option key={c.id} value={c.id}>{c.cargo}</option>)}
              </Select>
            </FormField>
          </div>

          <FormField label="Salário">
            <Input value={newFunc.salario} onChange={e => setNewFunc(prev => ({ ...prev, salario: maskSalary(e.target.value) }))} placeholder="0,00" />
          </FormField>

          <div className={styles.formDivider} />

          <FormField label="Usuário para Acesso *">
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
            <Input
              value={historyForm.salario}
              onChange={e => setHistoryForm(prev => ({ ...prev, salario: maskSalary(e.target.value) }))}
              placeholder="0,00"
            />
          </FormField>
        </div>
      </Modal>

      <Notification notification={notification} />
    </div>
  );
}
