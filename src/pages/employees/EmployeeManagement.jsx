import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Search, Loader2, AlertCircle, X, Check,
  Eye, EyeOff, Briefcase, Contact, UserPlus, Mail, MapPin, User, Lock,
  ChevronLeft, ChevronRight as ChevRight,
  CheckCircle2, AlertTriangle, XCircle, Upload,
} from 'lucide-react';

import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { Input, Select, FormField } from '../../components/ui/Input';
import { Notification } from '../../components/ui/Notification';
import { DatePicker } from '../../components/ui/DatePicker';
import { funcionarioApi, cargoApi, cadastroApi, usuarioApi, enumApi } from '../../services/api';
import iconWhatsapp from '../../assets/whatsapp.png';
import iconGmail    from '../../assets/gmail.png';
import imgUsuario   from '../../assets/avatar/usuario.png';
import imgMasculino from '../../assets/avatar/masculino.png';
import imgFeminino  from '../../assets/avatar/feminino.png';

import styles from './EmployeeManagement.module.css';
import { tr } from '../../i18n';

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

// Datas digitadas, sem calendário — mesmo campo da tela de Cadastro.
const maskDate = v => {
  const n = v.replace(/\D/g,'').slice(0,8);
  if (n.length <= 2) return n;
  if (n.length <= 4) return `${n.slice(0,2)}/${n.slice(2)}`;
  return `${n.slice(0,2)}/${n.slice(2,4)}/${n.slice(4)}`;
};
// "dd/mm/aaaa" → Date (00:00) ou null quando incompleta/inexistente/no futuro
const parseDateBR = v => {
  const m = (v ?? '').match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return null;
  const [dd, mm, yyyy] = [+m[1], +m[2], +m[3]];
  if (mm < 1 || mm > 12 || dd < 1 || yyyy < 1900) return null;
  const d = new Date(yyyy, mm - 1, dd);
  if (d.getDate() !== dd || d.getMonth() !== mm - 1) return null;
  const hoje = new Date(); hoje.setHours(0,0,0,0);
  if (d > hoje) return null;
  return d;
};
const fmtDateBR = d => (d instanceof Date && !isNaN(d) ? d.toLocaleDateString('pt-BR') : '');

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

// Pessoa vinda da API no formato do formulário (e de volta, via buildPessoaBody).
const pessoaFromApi = p => ({
  nome: p?.nome ?? '',
  dataNascimento: parseDateDMY(dateFromApi(p?.data_nascimento ?? p?.dataNascimento)),
  cpf: maskCPF(p?.cpf ?? ''),
  rg: p?.rg ?? '',
  email: p?.email ?? '',
  telefone: maskPhone(p?.telefone ?? ''),
  sexo: String(p?.sexo ?? ''),
  pais: p?.pais ?? 'Brasil',
  estado: p?.estado ?? '',
  municipio: p?.municipio ?? '',
  endereco: p?.endereco ?? '',
  complemento: p?.complemento ?? '',
  cep: maskCEP(p?.cep ?? ''),
  bairro: p?.bairro ?? '',
  numero: p?.numero ?? '',
  status: p?.status ?? 'ATIVO',
});

// ── Avatar ────────────────────────────────────────────────────
// Mesma foto por sexo da tela de Cadastro.
function AvatarCircle({ sexo, size = 40 }) {
  const img = Number(sexo) === 2 ? imgFeminino
    : Number(sexo) === 1 ? imgMasculino
    : imgUsuario;
  return (
    <img src={img} alt="" className={styles.avatar}
      width={size} height={size} draggable={false} />
  );
}

// ── Ícone do filtro ───────────────────────────────────────────
// SVG próprio (não vem do lucide); herda a cor do botão via currentColor.
function FilterIcon({ size = 16 }) {
  return (
    <svg
      width={size} height={size} viewBox="0 0 487 511.954"
      fill="currentColor" fillRule="evenodd" clipRule="evenodd"
      shapeRendering="geometricPrecision"
      aria-hidden="true" focusable="false"
    >
      <path fillRule="nonzero" d="M0 52.894h146.098a70.42 70.42 0 0118.388-32.26C177.18 7.874 194.783 0 214.13 0c19.37 0 36.95 7.874 49.645 20.569s20.569 30.275 20.569 49.644c0 19.348-7.874 36.95-20.569 49.645-12.76 12.673-30.319 20.569-49.645 20.569-19.282 0-36.884-7.896-49.579-20.569-8.79-8.812-15.29-19.936-18.453-32.326H0V52.894zm392.096 201.698a35.528 35.528 0 00-10.404-25.172 35.526 35.526 0 00-25.172-10.404 35.562 35.562 0 00-25.171 10.404c-6.413 6.369-10.404 15.334-10.404 25.172 0 9.837 3.991 18.802 10.382 25.193 6.391 6.391 15.356 10.382 25.193 10.382 9.837 0 18.802-3.991 25.193-10.382a35.728 35.728 0 0010.383-25.193zm14.069-49.645a70.26 70.26 0 0118.409 32.326h62.405v34.637h-62.405a70.366 70.366 0 01-18.409 32.326c-12.761 12.673-30.319 20.569-49.645 20.569-19.282 0-36.884-7.896-49.579-20.569-12.738-12.76-20.634-30.362-20.634-49.644 0-19.326 7.896-36.885 20.569-49.58 12.694-12.76 30.297-20.634 49.644-20.634 19.369 0 36.95 7.874 49.645 20.569zM260.11 271.91H0v-34.637h260.11v34.637zM67.007 424.421a70.414 70.414 0 0118.388-32.26c12.694-12.76 30.297-20.634 49.644-20.634 19.369 0 36.95 7.874 49.645 20.569 12.694 12.694 20.569 30.275 20.569 49.644 0 19.347-7.875 36.95-20.569 49.645-12.76 12.672-30.319 20.569-49.645 20.569-19.282 0-36.884-7.897-49.579-20.569-8.79-8.813-15.29-19.937-18.453-32.326H0v-34.638h67.007zm42.839-7.852c-6.391 6.369-10.382 15.334-10.382 25.171s3.991 18.802 10.382 25.193c6.391 6.391 15.356 10.383 25.193 10.383 9.838 0 18.803-3.992 25.193-10.383a35.728 35.728 0 0010.383-25.193 35.525 35.525 0 00-35.576-35.576 35.654 35.654 0 00-25.193 10.405zm121.603 7.852h255.508v34.638H231.449v-34.638zM188.937 45.042c-6.391 6.369-10.382 15.334-10.382 25.171 0 9.838 3.991 18.802 10.382 25.193 6.391 6.391 15.356 10.383 25.193 10.383 9.838 0 18.802-3.992 25.193-10.383a35.725 35.725 0 0010.383-25.193 35.524 35.524 0 00-35.576-35.575 35.653 35.653 0 00-25.193 10.404zm121.603 7.852H487v34.638H310.54V52.894z" />
    </svg>
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
    <div role="status" aria-label={tr('Carregando funcionários')}>
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

// ── Campo de data com máscara ─────────────────────────────────
function DateMaskInput({ value, onChange, className = '' }) {
  const [text, setText] = useState(() => fmtDateBR(value));

  // Sincroniza quando o valor vem de fora (abrir a edição, limpar o formulário…)
  useEffect(() => {
    const fromValue = fmtDateBR(value);
    if (value ? fromValue !== text : parseDateBR(text)) setText(fromValue);
  }, [value]); // eslint-disable-line

  const handle = e => {
    const masked = maskDate(e.target.value);
    setText(masked);
    onChange(parseDateBR(masked));
  };

  const invalida = text.length === 10 && !parseDateBR(text);

  return (
    <>
      <Input
        value={text}
        onChange={handle}
        placeholder={tr('dd/mm/aaaa')}
        inputMode="numeric"
        maxLength={10}
        className={className}
      />
      {invalida && <span className={styles.cpfMsg} style={{ color:'#ef4444' }}>{tr('Data inválida')}</span>}
    </>
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
      <div className={styles.sectionDivider}><User size={12} /> {tr('Dados Pessoais')}</div>

      <div className={[styles.reqField, hasErr('nome') ? styles.reqFieldErr : ''].join(' ')}>
        <FormField label={tr('Nome completo *')}>
          <Input value={p.nome} onChange={e => set('nome', e.target.value)} placeholder={tr('Nome completo')} />
        </FormField>
      </div>

      <div className={styles.gridFix}>
        <div className={[styles.cpfBlock, hasErr('cpf') && !cpfStatus ? styles.reqFieldErr : ''].join(' ')}>
          <FormField label={tr('CPF *')}>
            <div className={styles.cpfWrap}>
              <Input
                value={p.cpf}
                onChange={e => handleCPF(e.target.value)}
                placeholder="000.000.000-00"
                className={cpfStatus === 'ok' ? styles.inputOk : cpfStatus === 'exists' ? styles.inputWarn : cpfStatus === 'invalid' ? styles.inputErr : hasErr('cpf') && !cpfStatus ? styles.inputErr : ''}
              />
              {cpfIcon && <span className={styles.cpfIcon}>{cpfIcon}</span>}
            </div>
          </FormField>
          {cpfStatus === 'invalid' && <span className={styles.cpfMsg} style={{ color:'#ef4444' }}>{tr('CPF inválido')}</span>}
          {cpfStatus === 'exists'  && <span className={styles.cpfMsg} style={{ color:'#f59e0b' }}>{tr('CPF já cadastrado')}</span>}
          {cpfStatus === 'ok'      && <span className={styles.cpfMsg} style={{ color:'#10b981' }}>{tr('CPF disponível')}</span>}
        </div>

        <div className={[styles.reqField, hasErr('dataNascimento') ? styles.reqFieldErr : ''].join(' ')}>
          <FormField label={tr('Data de Nascimento *')}>
            <DateMaskInput value={p.dataNascimento} onChange={d => set('dataNascimento', d)} />
          </FormField>
        </div>
        <FormField label={tr('Sexo')}>
          <Select value={p.sexo} onChange={e => set('sexo', e.target.value)}>
            <option value="">{tr('Selecione')}</option>
            <option value="1">{tr('Masculino')}</option>
            <option value="2">{tr('Feminino')}</option>
            <option value="3">{tr('Outro')}</option>
          </Select>
        </FormField>
        <div className={[styles.reqField, hasErr('telefone') ? styles.reqFieldErr : ''].join(' ')}>
          <FormField label={tr('Telefone *')}>
            <Input value={p.telefone} onChange={e => set('telefone', maskPhone(e.target.value))} placeholder="(00) 00000-0000" />
          </FormField>
        </div>
      </div>

      <div className={styles.rgEmailRow}>
        <FormField label="RG">
          <Input value={p.rg} onChange={e => set('rg', e.target.value)} placeholder="RG" />
        </FormField>
        <div className={[styles.reqField, hasErr('email') ? styles.reqFieldErr : ''].join(' ')}>
          <FormField label={tr('Email *')}>
            <Input type="email" value={p.email} onChange={e => set('email', e.target.value)} placeholder={tr('email@exemplo.com')} />
          </FormField>
        </div>
      </div>

      <div className={styles.sectionDivider}><MapPin size={12} /> {tr('Endereço')}</div>

      <div className={styles.addrRow1}>
        <div className={[styles.reqField, hasErr('cep') ? styles.reqFieldErr : ''].join(' ')}>
          <FormField label={tr('CEP *')}>
            <div className={styles.inputWithSpinner}>
              <Input value={p.cep} onChange={e => handleCEP(e.target.value)} placeholder="00000-000"
                className={hasErr('cep') ? styles.inputErr : ''} />
              {cepLoading && <Loader2 size={13} className={[styles.spinInline, styles.inputSpinner].join(' ')} />}
            </div>
          </FormField>
        </div>
        <FormField label={tr('Endereço')}>
          <Input value={p.endereco} onChange={e => set('endereco', e.target.value)} placeholder={tr('Rua / Av.')} />
        </FormField>
        <FormField label={tr('Número')}>
          <Input value={p.numero} onChange={e => set('numero', e.target.value)} placeholder="0" />
        </FormField>
      </div>
      <div className={styles.addrRow2}>
        <FormField label={tr('Bairro')}>
          <Input value={p.bairro} onChange={e => set('bairro', e.target.value)} />
        </FormField>
        <FormField label={tr('Município')}>
          <Input value={p.municipio} onChange={e => set('municipio', e.target.value)} />
        </FormField>
        <FormField label={tr('Estado')}>
          <Input value={p.estado} onChange={e => set('estado', e.target.value)} placeholder="UF" />
        </FormField>
      </div>
      <div className={styles.addrRow3}>
        <FormField label={tr('País')}>
          <Input value={p.pais} onChange={e => set('pais', e.target.value)} placeholder={tr('Brasil')} />
        </FormField>
        <FormField label={tr('Complemento')}>
          <Input value={p.complemento} onChange={e => set('complemento', e.target.value)} placeholder={tr('Apto, Bloco...')} />
        </FormField>
      </div>
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

  // filtro de cargo da lista
  const [cargoFiltro, setCargoFiltro] = useState(null);
  const [cargoMenu, setCargoMenu] = useState(false);
  const cargoMenuRef = useRef(null);

  // formulários no painel da direita
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [abaFicha, setAbaFicha] = useState('dados');
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

  const fetchData = useCallback(async (term = '', pg = 0, cargo = null) => {
    setLoading(true);
    try {
      const params = { size: 15, page: pg };
      if (term) params.termo = term;
      if (cargo) params.cargoId = cargo.id;

      const res = await funcionarioApi.listar(params);
      setItems(res?.content ?? []);
      setTotalPages(res?.totalPages ?? 0);
      setTotalElements(res?.totalElements ?? 0);
    } catch (e) {
      showNotif(tr('Erro ao carregar funcionários.'), 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    clearTimeout(searchDebounce.current);
    if (searchTerm.length >= 3) {
      searchDebounce.current = setTimeout(() => {
        setPage(0);
        fetchData(searchTerm, 0, cargoFiltro);
      }, 400);
    } else if (searchTerm.length === 0) {
      setPage(0);
      fetchData('', 0, cargoFiltro);
    }
    return () => clearTimeout(searchDebounce.current);
  }, [searchTerm, cargoFiltro, fetchData]);

  // fecha o menu de cargo ao clicar fora
  useEffect(() => {
    if (!cargoMenu) return;
    const onDown = e => { if (cargoMenuRef.current && !cargoMenuRef.current.contains(e.target)) setCargoMenu(false); };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [cargoMenu]);

  const changeCargoFiltro = cargo => setCargoFiltro(cargo);

  const goToPage = pg => { setPage(pg); fetchData(searchTerm, pg, cargoFiltro); };

  const formAtivo = showAddModal ? 'novo' : showEdit ? 'edit' : null;
  const isDemitido = detailItem?.pessoa?.status === 'DEMITIDO';

  const openAddEmployee = () => {
    setNewFunc(blankFuncionario());
    setShowErrors(false);
    setShowPassword(false);
    setShowConfirmPassword(false);
    setShowEdit(false);
    setShowAddModal(true);
  };

  const cancelAddEmployee = () => {
    setShowAddModal(false);
    setShowErrors(false);
  };

  const handleAddEmployee = () => {
    const p = newFunc.pessoa;
    if (!p.nome || !p.cpf || !p.dataNascimento || !p.telefone || !p.email || !p.cep) {
      setShowErrors(true);
      showNotif(tr('Preencha todos os campos obrigatórios (*).'), 'error');
      return;
    }
    if (!newFunc.cargoId) {
      showNotif(tr('Selecione um cargo.'), 'error');
      return;
    }
    if (!newFunc.dataAdmissao) {
      showNotif(tr('Defina a data de admissão.'), 'error');
      return;
    }
    if (newFunc.usuario.username && newFunc.usuario.senha !== newFunc.senhaConfirma) {
      showNotif(tr('As senhas não conferem.'), 'error');
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
        showNotif(tr('Erro ao criar pessoa: ID não retornado'), 'error');
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
      showNotif(tr('Funcionário cadastrado com sucesso!'));
      setShowAddModal(false);
      setNewFunc(blankFuncionario());
      setShowErrors(false);
      setShowPassword(false);
      setShowConfirmPassword(false);
      fetchData(searchTerm, page, cargoFiltro);
    } catch (e) {
      showNotif(e.message || tr('Erro ao cadastrar funcionário.'), 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const openDetail = async (item) => {
    setDetailItem(item);
    setShowAddModal(false);
    setShowEdit(false);
    setAbaFicha('dados');
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
      pessoa: pessoaFromApi(item.pessoa),
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
    // o formulário toma o lugar da ficha; ao salvar ou voltar, a ficha reaparece
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
      showNotif(tr('Funcionário atualizado!'));
      setShowEdit(false);
      fetchData(searchTerm, page, cargoFiltro);
      refreshDetail();
    } catch (e) {
      showNotif(e.message || tr('Erro ao atualizar.'), 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFireEmployee = async () => {
    if (!detailItem || !detailItem.usuario?.id) return;
    if (!window.confirm(tr('Tem certeza que deseja desligar este funcionário?'))) return;

    setFireLoading(true);
    try {
      await usuarioApi.bloquear(detailItem.usuario.id, true);
      const pessoaBody = { id: detailItem.pessoa.id, ...buildPessoaBody(pessoaFromApi(detailItem.pessoa)), status: 'DEMITIDO' };
      await cadastroApi.atualizarPessoa(pessoaBody);
      showNotif(tr('Funcionário demitido e usuário bloqueado!'));
      setDetailItem(null);
      fetchData(searchTerm, page, cargoFiltro);
    } catch (e) {
      showNotif(e.message || tr('Erro ao desligar funcionário.'), 'error');
    } finally {
      setFireLoading(false);
    }
  };

  const handleReativarEmployee = async () => {
    if (!detailItem || !detailItem.usuario?.id) return;
    if (!window.confirm(tr('Tem certeza que deseja reativar este funcionário?'))) return;

    setFireLoading(true);
    try {
      await usuarioApi.bloquear(detailItem.usuario.id, false);
      const pessoaBody = { id: detailItem.pessoa.id, ...buildPessoaBody(pessoaFromApi(detailItem.pessoa)), status: 'CONTRATADO' };
      await cadastroApi.atualizarPessoa(pessoaBody);
      showNotif(tr('Funcionário reativado com sucesso!'));
      setDetailItem(null);
      fetchData(searchTerm, page, cargoFiltro);
    } catch (e) {
      showNotif(e.message || tr('Erro ao reativar funcionário.'), 'error');
    } finally {
      setFireLoading(false);
    }
  };

  const handleEditCredentials = async () => {
    if (!detailItem?.usuario?.id) return;
    if (!credentialsForm.username.trim() || !credentialsForm.senha.trim()) {
      showNotif(tr('Preencha username e senha.'), 'error');
      return;
    }

    setCredLoading(true);
    try {
      await usuarioApi.atualizarCredenciais(detailItem.usuario.id, {
        username: credentialsForm.username.trim(),
        senha: credentialsForm.senha,
      });
      showNotif(tr('Credenciais atualizadas!'));
      setShowEditCredentials(false);
      setCredentialsForm({ username: '', senha: '' });
      refreshDetail();
    } catch (e) {
      showNotif(e.message || tr('Erro ao atualizar credenciais.'), 'error');
    } finally {
      setCredLoading(false);
    }
  };

  const handleEditHistory = async () => {
    if (!editHistoryItem) return;
    if (!historyForm.cargoId || !historyForm.salario) {
      showNotif(tr('Preencha cargo e salário.'), 'error');
      return;
    }

    setHistoryLoading(true);
    try {
      await funcionarioApi.atualizarHistorico(editHistoryItem.id, {
        cargoId: Number(historyForm.cargoId),
        funcionarioId: detailItem.id,
        salario: parseBRL(historyForm.salario),
      });
      showNotif(tr('Histórico atualizado!'));
      setShowEditHistory(false);
      setEditHistoryItem(null);
      // Reload history
      const res = await funcionarioApi.listarHistorico(detailItem.id);
      setHistorico(res?.content ?? res ?? []);
    } catch (e) {
      showNotif(e.message || tr('Erro ao atualizar histórico.'), 'error');
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
      showNotif(tr('Preencha valor, data de início e pagamento.'), 'error');
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
      showNotif(tr('Recebido adicionado!'));
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
      showNotif(e.message || tr('Erro ao adicionar recebido.'), 'error');
    } finally {
      setAddRecebidoLoading(false);
    }
  };

  const handleEditRecebido = async () => {
    if (!editRecebidoItem) return;
    if (!editRecebidoForm.valorRecebido || !editRecebidoForm.dataHoraInicio || !editRecebidoForm.dataHoraPagamento) {
      showNotif(tr('Preencha valor, data de início e pagamento.'), 'error');
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
      showNotif(tr('Recebido atualizado!'));
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
      showNotif(e.message || tr('Erro ao editar recebido.'), 'error');
    } finally {
      setEditRecebidoLoading(false);
    }
  };

  const handleDownloadArquivo = (filePath) => {
    if (!filePath) {
      showNotif(tr('Arquivo não disponível.'), 'error');
      return;
    }
    try {
      funcionarioApi.downloadArquivo(filePath);
    } catch (e) {
      showNotif(e.message || tr('Erro ao baixar arquivo.'), 'error');
    }
  };

  // ─────────────────────────────────────────────────────────────
  return (
    <div className={styles.page}>
      <div className={styles.container}>
        {/* Abaixo de 1024px, com uma ficha ou formulário aberto, ele toma a tela e a lista sai. */}
        <main className={[styles.split, (detailItem || formAtivo) ? styles.splitListHidden : ''].join(' ')}>

          {/* ══ LISTA ═══════════════════════════════════════════ */}
          <div className={styles.listCol}>
          <aside className={styles.listPanel}>
            <div className={styles.listTopoEscuro}>
            <div className={styles.listTopo}>
              <span className={styles.listTitulo}>{tr('Funcionários')}</span>
              {!formAtivo && (
                <Button variant="primary" className={[styles.btnSolid, styles.btnPrimary].join(' ')} onClick={openAddEmployee}>
                  {tr('Cadastrar')}
                </Button>
              )}
            </div>

            {/* Busca + filtro de cargo */}
            <div className={styles.searchRow}>
              <div className={[styles.searchWrap, styles.searchWrapFull, searchTerm ? styles.searchAtiva : ''].join(' ')}>
                <Search size={16} className={styles.searchIcon} />
                <Input
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  placeholder={tr('Buscar por nome, CPF, e-mail ou cargo...')}
                  className={styles.searchInput}
                  aria-label={tr('Buscar')}
                />
                {loading && searchTerm.length >= 3
                  ? <Loader2 size={14} className={[styles.spinInline, styles.searchSpinner].join(' ')} />
                  : searchTerm.length > 0 &&
                    <button className={styles.searchClear} onClick={() => setSearchTerm('')} aria-label={tr('Limpar busca')}>
                      <X size={14} />
                    </button>
                }
              </div>

              <div className={styles.filterWrap} ref={cargoMenuRef}>
                <button type="button"
                  className={[styles.filterBtn, cargoFiltro ? styles.filterBtnOn : ''].join(' ')}
                  onClick={() => setCargoMenu(v => !v)}
                  aria-haspopup="menu" aria-expanded={cargoMenu}
                  title={tr('Filtrar por cargo')}>
                  <FilterIcon size={18} />
                  {cargoFiltro && <span className={styles.filterDot} />}
                </button>

                {cargoMenu && (
                  <div className={styles.filterMenu} role="menu">
                    <span className={styles.filterMenuLabel}>{tr('Cargo')}</span>
                    {[{ id: null, descricao: tr('Todos') }, ...cargos].map(c => {
                      const on = (cargoFiltro?.id ?? null) === c.id;
                      return (
                        <button key={c.id ?? 'todos'} type="button" role="menuitem"
                          className={[styles.filterMenuItem, on ? styles.filterMenuItemOn : ''].join(' ')}
                          onClick={() => { changeCargoFiltro(c.id == null ? null : c); setCargoMenu(false); }}>
                          <span>{c.descricao}</span>
                          {on && <Check size={14} />}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* filtro de cargo aplicado, com o x que volta para "todos" */}
            {cargoFiltro && (
              <div className={styles.filtroChips}>
                <span className={styles.filtroChip}>
                  <span className={styles.filtroChipRot}>{tr('Cargo:')}</span> {cargoFiltro.descricao}
                  <button type="button" className={styles.filtroChipX}
                    onClick={() => changeCargoFiltro(null)}
                    title={tr('Remover filtro')} aria-label={tr('Remover filtro {{label}}', { label: cargoFiltro.descricao })}>
                    <X size={12} />
                  </button>
                </span>
              </div>
            )}

            </div>
            <div className={styles.listCorpo}>
            <div className={styles.listMeta}>
              <span>
                {loading
                  ? tr('Carregando...')
                  : tr('{{totalElements}} funcionário{{v1}}', { totalElements, v1: totalElements !== 1 ? 's' : '' })}
              </span>
            </div>

            <div className={styles.listScroll}>
              {loading ? (
                <SkeletonLista />
              ) : items.length === 0 ? (
                <div className={styles.empty}>
                  <AlertCircle size={24} opacity={0.3} />
                  <span>{tr('Nenhum resultado encontrado.')}</span>
                </div>
              ) : items.map(item => {
                const nome  = item.pessoa?.nome || '—';
                const ativo = detailItem?.id === item.id;
                return (
                  <button key={item.id} type="button"
                    className={[styles.listItem, ativo ? styles.listItemActive : ''].join(' ')}
                    onClick={() => openDetail(item)}>
                    <AvatarCircle sexo={item.pessoa?.sexo} size={40} />
                    <span className={styles.listItemBody}>
                      <span className={styles.listItemName}>
                        <span className={styles.nome}>{nome}</span>
                        {item.pessoa?.status === 'DEMITIDO' && <span className={styles.badgeBloqueado}>{tr('Demitido')}</span>}
                      </span>
                      <span className={styles.listItemLoc}>
                        <Briefcase size={12} /> {item.cargo?.descricao || tr('Sem cargo')}
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
                  aria-label={tr('Página anterior')}>
                  <ChevronLeft size={16} />
                </button>
                <span className={styles.pageCurrent}>{page + 1} {tr('de')} {totalPages}</span>
                <button className={styles.pageBtn} disabled={page >= totalPages - 1} onClick={() => goToPage(page + 1)}
                  aria-label={tr('Próxima página')}>
                  <ChevRight size={16} />
                </button>
              </div>
            )}
            </div>
          </aside>
          </div>

          {/* ══ DETALHE ═════════════════════════════════════════ */}
          {/* Os formulários ocupam o painel no lugar da ficha, como na tela de Cadastro. */}
          <div className={styles.detailCol}>

          {formAtivo === 'novo' ? (
            <div className={styles.detailPanel}>
              <section className={styles.dCard}>
                <h3 className={[styles.dCardHead, styles.formHead].join(' ')}>
                  <button type="button" className={styles.backBtn} onClick={cancelAddEmployee}
                    title={tr('Voltar para a lista')} aria-label={tr('Voltar para a lista')}>
                    <ChevronLeft size={17} />
                  </button>
                  <UserPlus size={16} />
                  <span className={styles.dCardTitle}>{tr('Novo Funcionário')}</span>
                  <div className={styles.dCardActions}>
                    <button type="button" className={styles.idClose} onClick={cancelAddEmployee}
                      title={tr('Cancelar')} aria-label={tr('Cancelar')}>
                      <X size={16} />
                    </button>
                  </div>
                </h3>
                <div className={styles.dCardBody}>
                  <div className={styles.formBody}>
                    <PessoaFormEmployee data={newFunc} onChange={setNewFunc} onFetchCEP={fetchCEP} onCheckCPF={checkCPF} showErrors={showErrors} />

                    <div className={styles.sectionDivider}><Briefcase size={12} /> {tr('Dados Profissionais')}</div>

                    <div className={styles.gridFix}>
                      <FormField label={tr('Data de Admissão *')}>
                        <DateMaskInput value={newFunc.dataAdmissao} onChange={d => setNewFunc(prev => ({ ...prev, dataAdmissao: d }))} />
                      </FormField>
                      <FormField label={tr('Cargo *')}>
                        <Select value={newFunc.cargoId} onChange={e => setNewFunc(prev => ({ ...prev, cargoId: e.target.value }))}>
                          <option value="">{tr('Selecione um cargo')}</option>
                          {cargos.map(c => <option key={c.id} value={c.id}>{c.descricao}</option>)}
                        </Select>
                      </FormField>
                      <FormField label={tr('Salário')}>
                        <div className={styles.currencyWrapper}>
                          <span className={styles.currencyPrefix}>{tr('R$')}</span>
                          <Input value={newFunc.salario} onChange={e => setNewFunc(prev => ({ ...prev, salario: maskBRL(e.target.value) }))} placeholder="" />
                        </div>
                      </FormField>
                    </div>

                    <div className={styles.sectionDivider}><Lock size={12} /> {tr('Acesso ao Sistema')}</div>

                    <div className={styles.gridFix}>
                      <FormField label={tr('Usuário para Acesso')}>
                        <Input value={newFunc.usuario.username} onChange={e => setNewFunc(prev => ({ ...prev, usuario: { ...prev.usuario, username: e.target.value } }))} placeholder="username" />
                      </FormField>
                      <div>
                        <label className={styles.fieldLabel}>{tr('Senha *')}</label>
                        <div className={styles.inputWithSpinner}>
                          <Input
                            type={showPassword ? 'text' : 'password'}
                            value={newFunc.usuario.senha}
                            onChange={e => setNewFunc(prev => ({ ...prev, usuario: { ...prev.usuario, senha: e.target.value } }))}
                            placeholder={tr('Digite a senha')}
                          />
                          <button type="button" onClick={() => setShowPassword(!showPassword)} className={styles.eyeBtn}>
                            {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                          </button>
                        </div>
                      </div>
                      <div>
                        <label className={styles.fieldLabel}>{tr('Confirmar Senha *')}</label>
                        <div className={styles.inputWithSpinner}>
                          <Input
                            type={showConfirmPassword ? 'text' : 'password'}
                            value={newFunc.senhaConfirma}
                            onChange={e => setNewFunc(prev => ({ ...prev, senhaConfirma: e.target.value }))}
                            placeholder={tr('Confirme a senha')}
                          />
                          <button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)} className={styles.eyeBtn}>
                            {showConfirmPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className={styles.formFoot}>
                    <Button className={styles.btnSolid} onClick={() => { setNewFunc(blankFuncionario()); setShowErrors(false); }}>{tr('Limpar')}</Button>
                    <Button variant="primary" className={[styles.btnSolid, styles.btnPrimary].join(' ')}
                      onClick={handleAddEmployee} disabled={isSubmitting}>
                      {isSubmitting ? <><Loader2 size={13} className={styles.spinInline} /> {tr('Salvando...')}</> : tr('Cadastrar')}
                    </Button>
                  </div>
                </div>
              </section>
            </div>

          ) : formAtivo === 'edit' ? (
            <div className={styles.detailPanel}>
              <section className={styles.dCard}>
                <h3 className={[styles.dCardHead, styles.formHead].join(' ')}>
                  <button type="button" className={styles.backBtn} onClick={() => setShowEdit(false)}
                    title={tr('Voltar')} aria-label={tr('Voltar')}>
                    <ChevronLeft size={17} />
                  </button>
                  <Contact size={16} />
                  <span className={styles.dCardTitle}>{tr('Editar Funcionário')}</span>
                  <div className={styles.dCardActions}>
                    <button type="button" className={styles.idClose} onClick={() => setShowEdit(false)}
                      title={tr('Cancelar')} aria-label={tr('Cancelar')}>
                      <X size={16} />
                    </button>
                  </div>
                </h3>
                <div className={styles.dCardBody}>
                  <div className={styles.formBody}>
                    <PessoaFormEmployee data={editFunc} onChange={setEditFunc} onFetchCEP={fetchCEP} onCheckCPF={checkCPF} />

                    <div className={styles.sectionDivider}><Briefcase size={12} /> {tr('Dados Profissionais')}</div>

                    <div className={styles.gridFix}>
                      <FormField label={tr('Data de Admissão *')}>
                        <DateMaskInput value={editFunc.dataAdmissao} onChange={d => setEditFunc(prev => ({ ...prev, dataAdmissao: d }))} />
                      </FormField>
                      <FormField label={tr('Cargo *')}>
                        <Select value={editFunc.cargoId} onChange={e => setEditFunc(prev => ({ ...prev, cargoId: e.target.value }))}>
                          <option value="">{tr('Selecione um cargo')}</option>
                          {cargos.map(c => <option key={c.id} value={c.id}>{c.descricao}</option>)}
                        </Select>
                      </FormField>
                      <FormField label={tr('Salário')}>
                        <div className={styles.currencyWrapper}>
                          <span className={styles.currencyPrefix}>{tr('R$')}</span>
                          <Input value={editFunc.salario} onChange={e => setEditFunc(prev => ({ ...prev, salario: maskBRL(e.target.value) }))} placeholder="" />
                        </div>
                      </FormField>
                    </div>

                    <div className={styles.sectionDivider}><Lock size={12} /> {tr('Acesso ao Sistema')}</div>

                    <div className={styles.gridFix}>
                      <FormField label={tr('Usuário para Acesso')}>
                        <Input value={editFunc.usuario.username} placeholder="username" readOnly />
                      </FormField>
                    </div>
                  </div>

                  <div className={styles.formFoot}>
                    <Button className={styles.btnSolid} onClick={() => setShowEdit(false)}>{tr('Cancelar')}</Button>
                    <Button variant="primary" className={[styles.btnSolid, styles.btnPrimary].join(' ')}
                      onClick={handleSaveEditEmployee} disabled={isSubmitting}>
                      {isSubmitting ? <><Loader2 size={13} className={styles.spinInline} /> {tr('Salvando...')}</> : tr('Salvar')}
                    </Button>
                  </div>
                </div>
              </section>
            </div>

          ) : !detailItem ? null : (
            <div className={styles.detailPanel}>

              {/* ── Ficha do funcionário: dados, acesso e histórico ── */}
              <section className={[styles.dCard, styles.fichaCard].join(' ')}>
                <h3 className={[styles.dCardHead, styles.fichaHead].join(' ')}>
                  {/* só aparece quando a ficha ocupa a tela e a lista está fora */}
                  <button type="button" className={styles.backBtn} onClick={closeDetail}
                    title={tr('Voltar para a lista')} aria-label={tr('Voltar para a lista')}>
                    <ChevronLeft size={17} />
                  </button>
                  <Contact size={16} />
                  <span className={styles.dCardTitle}>{tr('Ficha do funcionário')}</span>
                  <div className={styles.dCardActions}>
                    <span className={[styles.fichaStatus, isDemitido ? styles.fichaStatusBloq : ''].join(' ')}>
                      {isDemitido ? tr('Demitido') : tr('Ativo')}
                    </span>
                    <Button className={styles.btnSolid} onClick={openEditEmployee} disabled={isDemitido}>
                      {tr('Editar')}
                    </Button>
                    {isDemitido ? (
                      <Button variant="primary" className={[styles.btnSolid, styles.btnPrimary].join(' ')}
                        onClick={handleReativarEmployee} disabled={fireLoading}>
                        {tr('Reativar')}
                      </Button>
                    ) : (
                      <Button variant="danger" className={[styles.btnSolid, styles.btnDanger].join(' ')}
                        onClick={handleFireEmployee} disabled={fireLoading}>
                        {tr('Desligar')}
                      </Button>
                    )}
                    <button type="button" className={styles.idClose} onClick={closeDetail}
                      title={tr('Fechar ficha')} aria-label={tr('Fechar ficha')}>
                      <X size={16} />
                    </button>
                  </div>
                </h3>

                <div className={[styles.dCardBody, styles.fichaBody].join(' ')}>
                  <div className={styles.fichaTopo}>
                    <div className={styles.fichaId}>
                      <AvatarCircle sexo={detailItem.pessoa?.sexo} size={72} />
                      <div className={styles.idHeadMain}>
                        <h2 className={styles.fichaNome}>{detailItem.pessoa?.nome ?? '—'}</h2>
                        <p className={styles.fichaSub}>
                          <span>{detailItem.cargo?.descricao || tr('Sem cargo')}</span>
                          {detailItem.data_admissao && <>
                            <span aria-hidden="true">·</span>
                            <span>{tr('Admitido em {{data}}', { data: dateFromApi(detailItem.data_admissao) })}</span>
                          </>}
                        </p>
                        <p className={styles.fichaSub}>{tr('Salário atual:')} {fmtBRL(detailItem.salario)}</p>
                      </div>
                    </div>

                    <div className={styles.fichaTabs} role="tablist">
                      {[
                        ['dados', tr('Dados cadastrais')],
                        ['acesso', tr('Acesso ao sistema')],
                        ['historico', tr('Histórico de cargo e salário')],
                      ].map(([k, label]) => (
                        <button key={k} type="button" role="tab" aria-selected={abaFicha === k}
                          className={[styles.fichaTab, abaFicha === k ? styles.fichaTabAtiva : ''].join(' ')}
                          onClick={() => setAbaFicha(k)}>
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {abaFicha === 'acesso' ? (<>
                    <div className={styles.fieldGrid}>
                      <Field label={tr('Usuário')} value={detailItem.usuario?.username} />
                      <Field label={tr('Situação do acesso')} value={detailItem.usuario?.bloqueado ? tr('Bloqueado') : tr('Liberado')} />
                    </div>
                    <div className={styles.formFoot}>
                      <Button className={styles.btnSolid}
                        onClick={() => {
                          setCredentialsForm({ username: detailItem.usuario?.username ?? '', senha: '' });
                          setShowEditCredentials(true);
                        }}>
                        {tr('Atualizar credenciais')}
                      </Button>
                    </div>
                  </>) : abaFicha === 'historico' ? (
                    historicoLoading ? (
                      <div className={styles.empty}>
                        <Loader2 size={18} className={styles.spinInline} /> {tr('Carregando histórico...')}
                      </div>
                    ) : historico.length === 0 ? (
                      <p className={styles.blockEmpty}>{tr('Sem histórico de cargo e salário.')}</p>
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
                                    <span>{tr('Recebimentos')}</span>
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
                                        {tr('Novo')}
                                      </Button>
                                      <Button className={[styles.btnSolid, styles.btnSm].join(' ')}
                                        onClick={() => {
                                          setHistoryForm({
                                            cargoId: String(h.cargo?.id ?? ''),
                                            salario: maskBRL(String(Math.round(h.salario * 100))),
                                          });
                                          setShowEditHistory(true);
                                        }}>
                                        {tr('Editar')}
                                      </Button>
                                    </div>
                                  </div>

                                  {recebidosLoading ? (
                                    <div className={styles.empty} style={{ padding: '16px 10px' }}>
                                      <Loader2 size={16} className={styles.spinInline} /> {tr('Carregando...')}
                                    </div>
                                  ) : recebidos.length === 0 ? (
                                    <p className={styles.blockEmpty} style={{ paddingLeft: 8 }}>
                                      {tr('Sem registros de recebimento.')}
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
                                                {tr('Comprovante')}
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
                                              {tr('Editar')}
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
                    )
                  ) : (<>
                    <div className={styles.fieldGrid}>
                      <Field label="CPF" value={maskCPF(detailItem.pessoa?.cpf ?? '')} mono />
                      <Field label="RG" value={detailItem.pessoa?.rg} mono />
                      <Field label={tr('Data de nascimento')} value={dateFromApi(detailItem.pessoa?.data_nascimento)} />
                      <Field label={tr('Sexo')} value={
                        detailItem.pessoa?.sexo === 1 ? tr('Masculino')
                        : detailItem.pessoa?.sexo === 2 ? tr('Feminino')
                        : detailItem.pessoa?.sexo ? tr('Outro') : ''
                      } />
                      <Field label={tr('País')} value={detailItem.pessoa?.pais} />
                    </div>

                    <div className={styles.dadosGrupoSep}>
                      <div className={styles.dadosHead}><Mail size={16} /><span>{tr('Contato')}</span></div>
                      <div className={styles.fieldGrid}>
                        <Field label={tr('E-mail')} value={detailItem.pessoa?.email ? (
                          <ContatoBotao tipo="gmail" href={`mailto:${detailItem.pessoa.email}`} title={tr('Enviar e-mail')}>
                            {detailItem.pessoa.email}
                          </ContatoBotao>
                        ) : ''} />
                        <Field label={tr('Telefone')} value={detailItem.pessoa?.telefone ? (
                          <ContatoBotao tipo="whatsapp" href={`https://wa.me/55${unmask(detailItem.pessoa.telefone)}`} title={tr('WhatsApp')}>
                            {maskPhone(detailItem.pessoa.telefone)}
                          </ContatoBotao>
                        ) : ''} />
                      </div>
                    </div>

                    <div className={styles.dadosGrupoSep}>
                      <div className={styles.dadosHead}><MapPin size={16} /><span>{tr('Endereço')}</span></div>
                      <div className={styles.fieldGrid}>
                        <Field label={tr('Endereço')} value={[
                          [detailItem.pessoa?.endereco, detailItem.pessoa?.numero].filter(Boolean).join(', '),
                          detailItem.pessoa?.bairro,
                        ].filter(Boolean).join(' — ')} />
                        <Field label={tr('Cidade / UF')} value={[detailItem.pessoa?.municipio, detailItem.pessoa?.estado].filter(Boolean).join(' — ')} />
                        <Field label="CEP" value={maskCEP(detailItem.pessoa?.cep ?? '')} mono />
                      </div>
                    </div>
                  </>)}
                </div>
              </section>
            </div>
          )}
          </div>
        </main>
      </div>

      {/* ══ MODAL: EDITAR CREDENCIAIS ═════════════════════════ */}
      <Modal
        open={showEditCredentials}
        onClose={() => setShowEditCredentials(false)}
        size="sm"
        title={tr('Alterar Credenciais')}
        footer={
          <div className={styles.modalFooter}>
            <Button onClick={() => setShowEditCredentials(false)}>{tr('Cancelar')}</Button>
            <Button variant="primary" onClick={handleEditCredentials} disabled={credLoading}>
              {credLoading ? <><Loader2 size={13} className={styles.spinInline} /> {tr('Salvando...')}</> : tr('Salvar')}
            </Button>
          </div>
        }
      >
        <div className={styles.formBody}>
          <FormField label={tr('Username *')}>
            <Input
              value={credentialsForm.username}
              onChange={e => setCredentialsForm(prev => ({ ...prev, username: e.target.value }))}
              placeholder="novo.username"
            />
          </FormField>
          <FormField label={tr('Senha *')}>
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
        title={tr('Editar Histórico de Salário')}
        footer={
          <div className={styles.modalFooter}>
            <Button onClick={() => setShowEditHistory(false)}>{tr('Cancelar')}</Button>
            <Button variant="primary" onClick={handleEditHistory} disabled={historyLoading}>
              {historyLoading ? <><Loader2 size={13} className={styles.spinInline} /> {tr('Salvando...')}</> : tr('Salvar')}
            </Button>
          </div>
        }
      >
        <div className={styles.formBody}>
          <FormField label={tr('Cargo *')}>
            <Select value={historyForm.cargoId} onChange={e => setHistoryForm(prev => ({ ...prev, cargoId: e.target.value }))}>
              <option value="">{tr('Selecione um cargo')}</option>
              {cargos.map(c => <option key={c.id} value={String(c.id)}>{c.descricao}</option>)}
            </Select>
          </FormField>
          <FormField label={tr('Salário *')}>
            <div className={styles.currencyWrapper}>
              <span className={styles.currencyPrefix}>{tr('R$')}</span>
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
        title={tr('Novo Recebimento')}
        footer={
          <div className={styles.modalFooter}>
            <Button onClick={() => setShowAddRecebido(false)}>{tr('Cancelar')}</Button>
            <Button variant="primary" onClick={handleAddRecebido} disabled={addRecebidoLoading}>
              {addRecebidoLoading ? <><Loader2 size={13} className={styles.spinInline} /> {tr('Salvando...')}</> : tr('Salvar')}
            </Button>
          </div>
        }
      >
        <div className={styles.formBody}>
          <FormField label={tr('Valor Recebido *')}>
            <div className={styles.currencyWrapper}>
              <span className={styles.currencyPrefix}>{tr('R$')}</span>
              <Input
                value={addRecebidoForm.valorRecebido}
                onChange={e => setAddRecebidoForm(prev => ({ ...prev, valorRecebido: maskBRL(e.target.value) }))}
                placeholder=""
              />
            </div>
          </FormField>

          <div className={styles.grid2}>
            <FormField label={tr('Data/Hora Início *')}>
              <DatePicker
                mode="single"
                value={addRecebidoForm.dataHoraInicio}
                onChange={d => setAddRecebidoForm(prev => ({ ...prev, dataHoraInicio: d ?? null }))}
                placeholder={tr('dd/mm/aaaa')}
              />
            </FormField>
            <FormField label={tr('Data/Hora Fim')}>
              <DatePicker
                mode="single"
                value={addRecebidoForm.dataHoraFim}
                onChange={d => setAddRecebidoForm(prev => ({ ...prev, dataHoraFim: d ?? null }))}
                placeholder={tr('dd/mm/aaaa')}
              />
            </FormField>
          </div>

          <FormField label={tr('Data/Hora Pagamento *')}>
            <DatePicker
              mode="single"
              value={addRecebidoForm.dataHoraPagamento}
              onChange={d => setAddRecebidoForm(prev => ({ ...prev, dataHoraPagamento: d ?? null }))}
              placeholder={tr('dd/mm/aaaa')}
            />
          </FormField>

          <FormField label={tr('Tipo de Pagamento *')}>
            <Select value={addRecebidoForm.tipoPagamentoId} onChange={e => setAddRecebidoForm(prev => ({ ...prev, tipoPagamentoId: e.target.value }))}>
              <option value="">{tr('Selecione um tipo')}</option>
              {tipoPagamentos.map(t => <option key={t.id} value={String(t.id)}>{t.descricao}</option>)}
            </Select>
          </FormField>

          <FormField label={tr('Descrição')}>
            <Input
              value={addRecebidoForm.descricao}
              onChange={e => setAddRecebidoForm(prev => ({ ...prev, descricao: e.target.value?.toUpperCase() }))}
              placeholder={tr('ex: ADIANTAMENTO, BONUS...')}
            />
          </FormField>

          <FormField label={tr('Comprovante de pagamento')}>
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
                <><Upload size={14} /> {tr('Selecionar Arquivo')}</>
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
        title={tr('Editar Recebimento')}
        footer={
          <div className={styles.modalFooter}>
            <Button onClick={() => setShowEditRecebido(false)}>{tr('Cancelar')}</Button>
            <Button variant="primary" onClick={handleEditRecebido} disabled={editRecebidoLoading}>
              {editRecebidoLoading ? <><Loader2 size={13} className={styles.spinInline} /> {tr('Salvando...')}</> : tr('Salvar')}
            </Button>
          </div>
        }
      >
        <div className={styles.formBody}>
          <FormField label={tr('Valor Recebido *')}>
            <div className={styles.currencyWrapper}>
              <span className={styles.currencyPrefix}>{tr('R$')}</span>
              <Input
                value={editRecebidoForm.valorRecebido}
                onChange={e => setEditRecebidoForm(prev => ({ ...prev, valorRecebido: maskBRL(e.target.value) }))}
                placeholder=""
              />
            </div>
          </FormField>

          <div className={styles.grid2}>
            <FormField label={tr('Data/Hora Início *')}>
              <DatePicker
                mode="single"
                value={editRecebidoForm.dataHoraInicio}
                onChange={d => setEditRecebidoForm(prev => ({ ...prev, dataHoraInicio: d ?? null }))}
                placeholder={tr('dd/mm/aaaa')}
              />
            </FormField>
            <FormField label={tr('Data/Hora Fim')}>
              <DatePicker
                mode="single"
                value={editRecebidoForm.dataHoraFim}
                onChange={d => setEditRecebidoForm(prev => ({ ...prev, dataHoraFim: d ?? null }))}
                placeholder={tr('dd/mm/aaaa')}
              />
            </FormField>
          </div>

          <FormField label={tr('Data/Hora Pagamento *')}>
            <DatePicker
              mode="single"
              value={editRecebidoForm.dataHoraPagamento}
              onChange={d => setEditRecebidoForm(prev => ({ ...prev, dataHoraPagamento: d ?? null }))}
              placeholder={tr('dd/mm/aaaa')}
            />
          </FormField>

          <FormField label={tr('Tipo de Pagamento *')}>
            <Select value={editRecebidoForm.tipoPagamentoId} onChange={e => setEditRecebidoForm(prev => ({ ...prev, tipoPagamentoId: e.target.value }))}>
              <option value="">{tr('Selecione um tipo')}</option>
              {tipoPagamentos.map(t => <option key={t.id} value={String(t.id)}>{t.descricao}</option>)}
            </Select>
          </FormField>

          <FormField label={tr('Descrição')}>
            <Input
              value={editRecebidoForm.descricao}
              onChange={e => setEditRecebidoForm(prev => ({ ...prev, descricao: e.target.value?.toUpperCase() }))}
              placeholder={tr('ex: ADIANTAMENTO, BONUS...')}
            />
          </FormField>

          <FormField label={tr('Arquivo de Comprovante')}>
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
                <><Upload size={14} /> {tr('Selecionar Arquivo')}</>
              )}
            </Button>
          </FormField>
        </div>
      </Modal>

      <Notification notification={notification} />
    </div>
  );
}
