import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Search, Plus, User, Building2, Car,
  Loader2, AlertCircle, Calendar, Shield, UserCheck, UserX,
  Users, ChevronRight, Trash2, CheckCircle2, XCircle,
  AlertTriangle, Camera, ChevronLeft, ChevronRight as ChevRight,
  Edit2, X, Phone, Mail,
} from 'lucide-react';

import { Button }                   from '../../components/ui/Button';
import { Modal }                    from '../../components/ui/Modal';
import { Input, Select, FormField } from '../../components/ui/Input';
import { Notification }             from '../../components/ui/Notification';
import { DatePicker }               from '../../components/ui/DatePicker';
import { cadastroApi }              from '../../services/api';

import styles from './RegistersPage.module.css';

// ── Máscaras ──────────────────────────────────────────────────
const maskCPF = v =>
  v.replace(/\D/g,'').slice(0,11)
   .replace(/(\d{3})(\d)/,'$1.$2')
   .replace(/(\d{3})(\d)/,'$1.$2')
   .replace(/(\d{3})(\d{1,2})$/,'$1-$2');

const maskCNPJ = v =>
  v.replace(/\D/g,'').slice(0,14)
   .replace(/(\d{2})(\d)/,'$1.$2')
   .replace(/(\d{3})(\d)/,'$1.$2')
   .replace(/(\d{3})(\d)/,'$1/$2')
   .replace(/(\d{4})(\d{1,2})$/,'$1-$2');

const maskPhone = v => {
  const n = v.replace(/\D/g,'').slice(0,11);
  if (n.length > 10) return n.replace(/(\d{2})(\d{5})(\d{0,4})/,'($1) $2-$3');
  return n.replace(/(\d{2})(\d{4})(\d{0,4})/,'($1) $2-$3');
};

const maskCEP   = v => v.replace(/\D/g,'').slice(0,8).replace(/(\d{5})(\d{1,3})$/,'$1-$2');
const maskPlaca = v => v.replace(/[^A-Za-z0-9]/g,'').slice(0,7).toUpperCase();
const unmask    = v => (v ?? '').replace(/\D/g,'');

const up         = v => (v ?? '').toUpperCase().trim();
const cleanPlaca = v => (v ?? '').replace(/[^A-Za-z0-9]/g,'').toUpperCase();

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

// ── Smart search ──────────────────────────────────────────────
const buildSearchParams = raw => {
  const c = raw.replace(/[\s.,\-\/]/g,'').toUpperCase();
  if (!c) return {};
  if (/^[A-Z]{3}\d{4}$/.test(c) || /^[A-Z]{3}\d[A-Z]\d{2}$/.test(c)) return { placaVeiculo: c };
  if (/^\d+$/.test(c)) {
    if (c.length === 11) return { cpf: c };
    if (c.length === 14) return { cnpj: c };
    return { termo: c };
  }
  return { termo: c };
};

const buildPessoaBody = (p, overrides = {}) => ({
  nome:               up(p.nome),
  dataNascimento:     p.dataNascimento instanceof Date
    ? p.dataNascimento.toISOString().split('T')[0] : (p.dataNascimento ?? ''),
  cpf:                unmask(p.cpf),
  rg:                 up(p.rg),
  email:              (p.email ?? '').trim(),
  telefone:           unmask(p.telefone),
  pais:               up(p.pais) || 'BRASIL',
  estado:             up(p.estado),
  municipio:          up(p.municipio),
  endereco:           up(p.endereco),
  complemento:        up(p.complemento),
  cep:                unmask(p.cep),
  bairro:             up(p.bairro),
  sexo:               Number(p.sexo) || 1,
  numero:             up(p.numero),
  status:             p.status ?? 'ATIVO',
  titularId:          p.titularId ?? null,
  empresasVinculadas: (p.empresasVinculadas ?? []).map(e => ({ id: e.id })),
  veiculos:           (p.veiculos ?? []).map(v => ({
    modelo: up(v.modelo ?? ''), marca: up(v.marca ?? ''),
    ano: Number(v.ano) || 0,
    placa: cleanPlaca(v.placa),
    cor: up(v.cor ?? ''),
  })),
  ...overrides,
});

const dateFromApi = d => {
  if (!d) return '';
  const p = d.split('-');
  return `${(p[2]??'').padStart(2,'0')}/${(p[1]??'').padStart(2,'0')}/${p[0]??''}`;
};

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

const SEXO_OPTS = [
  { value: '',  label: 'Selecione' },
  { value: '1', label: 'Masculino' },
  { value: '2', label: 'Feminino'  },
  { value: '3', label: 'Outro'     },
];

const blankVeiculo = () => ({ modelo:'', marca:'', ano:'', placa:'', cor:'' });
const blankPessoa  = () => ({
  nome:'', dataNascimento: null, cpf:'', rg:'', email:'',
  telefone:'', sexo:'', pais:'Brasil', estado:'', municipio:'',
  endereco:'', complemento:'', cep:'', bairro:'', numero:'',
  veiculos:[], status:'ATIVO', titularId: null, empresasVinculadas: [],
});
const blankEmpresa = () => ({
  cnpj:'', razaoSocial:'', nomeFantasia:'', telefone:'', email:'',
  cep:'', endereco:'', bairro:'', complemento:'', numero:'',
  pais:'Brasil', estado:'', municipio:'', tipoEmpresa: 'CLIENTE',
});

// ── Utilitários visuais ───────────────────────────────────────
function StatusBadge({ status }) {
  const cls = status === 'ATIVO'     ? styles.badgeAtivo
            : status === 'BLOQUEADO' ? styles.badgeBloqueado
            : status === 'HOSPEDADO' ? styles.badgeHospedado
            : styles.badgeDefault;
  return <span className={cls}>{status ?? '—'}</span>;
}

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

// ── Formulário de pessoa ──────────────────────────────────────
function PessoaForm({ data, onChange, onFetchCEP, onCheckCPF, showErrors = false }) {
  const [cepLoading, setCepLoading] = useState(false);
  const [cpfStatus,  setCpfStatus]  = useState(null);

  const set      = (field, val) => onChange(prev => ({ ...prev, [field]: val }));
  const hasErr   = field => showErrors && !data[field];

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
      try { await onFetchCEP(masked, onChange); }
      finally { setCepLoading(false); }
    }
  };

  const addVeiculo    = () => onChange(p => ({ ...p, veiculos: [...p.veiculos, blankVeiculo()] }));
  const removeVeiculo = i  => onChange(p => ({ ...p, veiculos: p.veiculos.filter((_,j) => j !== i) }));
  const setVeiculo    = (i, field, val) =>
    onChange(p => ({ ...p, veiculos: p.veiculos.map((v,j) => j === i ? { ...v, [field]: val } : v) }));

  const cpfIcon = cpfStatus === 'loading' ? <Loader2 size={14} className={styles.spinInline} />
                : cpfStatus === 'ok'      ? <CheckCircle2 size={14} className={styles.iconOk} />
                : cpfStatus === 'exists'  ? <AlertTriangle size={14} className={styles.iconWarn} />
                : cpfStatus === 'invalid' ? <XCircle size={14} className={styles.iconErr} />
                : null;

  const cpfInputCls = [
    styles.cpfInput,
    cpfStatus === 'ok'     ? styles.inputOk   : '',
    cpfStatus === 'exists' ? styles.inputWarn  : '',
    cpfStatus === 'invalid'  ? styles.inputErr : '',
    hasErr('cpf') && !cpfStatus ? styles.inputErr : '',
  ].join(' ').trim();

  return (
    <div className={styles.formBody}>

      {/* Foto isolada no topo */}
      <div className={styles.photoTop}>
        <div className={styles.photoBig}>
          <Camera size={28} className={styles.photoIconBig} />
          <div className={styles.photoUploadBtn}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="12" height="12">
              <polyline points="16 16 12 12 8 16"/>
              <line x1="12" y1="12" x2="12" y2="21"/>
              <path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3"/>
            </svg>
          </div>
        </div>
        <span className={styles.photoBadgeTop}>Em breve</span>
      </div>

      {/* CPF | Nome | Data Nascimento */}
      <div className={styles.cpfRow}>
        <div className={styles.cpfBlock}>
          <label className={[styles.cpfLabel, hasErr('cpf') && !cpfStatus ? styles.labelErr : ''].join(' ')}>
            CPF *
          </label>
          <div className={styles.cpfWrap}>
            <Input
              value={data.cpf}
              onChange={e => handleCPF(e.target.value)}
              placeholder="000.000.000-00"
              className={cpfInputCls}
            />
            {cpfIcon && <span className={styles.cpfIcon}>{cpfIcon}</span>}
          </div>
          {cpfStatus === 'invalid' && <span className={styles.cpfMsg} style={{ color:'#ef4444' }}>CPF inválido</span>}
          {cpfStatus === 'exists'  && <span className={styles.cpfMsg} style={{ color:'#f59e0b' }}>CPF já cadastrado</span>}
          {cpfStatus === 'ok'      && <span className={styles.cpfMsg} style={{ color:'#10b981' }}>CPF disponível</span>}
        </div>

        <div className={[styles.reqField, hasErr('nome') ? styles.reqFieldErr : ''].join(' ')}>
          <FormField label="Nome completo *">
            <Input value={data.nome} onChange={e => set('nome', e.target.value)} placeholder="Nome completo" />
          </FormField>
        </div>

        <div className={[styles.reqField, hasErr('dataNascimento') ? styles.reqFieldErr : ''].join(' ')}>
          <FormField label="Data de Nascimento *">
            <DatePicker
              mode="single"
              value={data.dataNascimento}
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
          <Input value={data.rg} onChange={e => set('rg', e.target.value)} placeholder="RG" />
        </FormField>
        <FormField label="Sexo">
          <Select value={data.sexo} onChange={e => set('sexo', e.target.value)}>
            {SEXO_OPTS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </Select>
        </FormField>
        <div className={[styles.reqField, hasErr('telefone') ? styles.reqFieldErr : ''].join(' ')}>
          <FormField label="Telefone *">
            <Input value={data.telefone} onChange={e => set('telefone', maskPhone(e.target.value))} placeholder="(00) 00000-0000" />
          </FormField>
        </div>
      </div>

      <div className={[styles.reqField, hasErr('email') ? styles.reqFieldErr : ''].join(' ')}>
        <FormField label="Email *">
          <Input type="email" value={data.email} onChange={e => set('email', e.target.value)} placeholder="email@exemplo.com" />
        </FormField>
      </div>

      <div className={styles.formDivider} />

      <div className={styles.grid3}>
        <div className={[styles.reqField, hasErr('cep') ? styles.reqFieldErr : ''].join(' ')}>
          <label className={[styles.fieldLabel, hasErr('cep') ? styles.labelErr : ''].join(' ')}>CEP *</label>
          <div className={styles.inputWithSpinner}>
            <Input value={data.cep} onChange={e => handleCEP(e.target.value)} placeholder="00000-000"
              className={hasErr('cep') ? styles.inputErr : ''} />
            {cepLoading && <Loader2 size={13} className={[styles.spinInline, styles.inputSpinner].join(' ')} />}
          </div>
        </div>
        <FormField label="País">
          <Input value={data.pais} onChange={e => set('pais', e.target.value)} placeholder="Brasil" />
        </FormField>
        <FormField label="Estado">
          <Input value={data.estado} onChange={e => set('estado', e.target.value)} placeholder="UF" />
        </FormField>
      </div>
      <div className={styles.grid2}>
        <FormField label="Município">
          <Input value={data.municipio} onChange={e => set('municipio', e.target.value)} />
        </FormField>
        <FormField label="Bairro">
          <Input value={data.bairro} onChange={e => set('bairro', e.target.value)} />
        </FormField>
      </div>
      <div className={styles.grid3}>
        <div className={styles.spanTwo}>
          <FormField label="Endereço">
            <Input value={data.endereco} onChange={e => set('endereco', e.target.value)} placeholder="Rua / Av." />
          </FormField>
        </div>
        <FormField label="Número">
          <Input value={data.numero} onChange={e => set('numero', e.target.value)} placeholder="0" />
        </FormField>
      </div>
      <FormField label="Complemento">
        <Input value={data.complemento} onChange={e => set('complemento', e.target.value)} placeholder="Apto, Bloco..." />
      </FormField>

      <div className={styles.formDivider} />

      <div className={styles.subHead}>
        <span className={styles.subHeadTitle}><Car size={13} /> Veículos</span>
        <Button onClick={addVeiculo}><Plus size={12} /> Veículo</Button>
      </div>
      {data.veiculos.map((v, i) => (
        <div key={i} className={styles.subFormBlock}>
          <div className={styles.subFormTitle}>
            <span>Veículo {i + 1}</span>
            <button className={styles.btnRemove} onClick={() => removeVeiculo(i)}><X size={12} /></button>
          </div>
          <div className={styles.grid3}>
            <FormField label="Modelo">
              <Input value={v.modelo} onChange={e => setVeiculo(i,'modelo',e.target.value)} placeholder="Ex: Civic" />
            </FormField>
            <FormField label="Marca">
              <Input value={v.marca} onChange={e => setVeiculo(i,'marca',e.target.value)} placeholder="Ex: Honda" />
            </FormField>
            <FormField label="Ano">
              <Input type="number" value={v.ano} onChange={e => setVeiculo(i,'ano',e.target.value)} placeholder="2024" />
            </FormField>
          </div>
          <div className={styles.grid2}>
            <FormField label="Placa">
              <Input value={v.placa} onChange={e => setVeiculo(i,'placa',maskPlaca(e.target.value))} placeholder="AAA0A00" />
            </FormField>
            <FormField label="Cor">
              <Input value={v.cor} onChange={e => setVeiculo(i,'cor',e.target.value)} placeholder="Preto" />
            </FormField>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Formulário de empresa ─────────────────────────────────────
function EmpresaForm({ data, onChange, onFetchCNPJ, onFetchCEP, editMode = false }) {
  const [cnpjLoading, setCnpjLoading] = useState(false);
  const [cepLoading,  setCepLoading]  = useState(false);
  const [cnpjExists,  setCnpjExists]  = useState(false);

  const set = (field, val) => onChange(prev => ({ ...prev, [field]: val }));

  const handleCNPJ = async v => {
    const masked = maskCNPJ(v);
    set('cnpj', masked);
    setCnpjExists(false);
    const raw = unmask(masked);
    if (raw.length === 14) {
      setCnpjLoading(true);
      try {
        await onFetchCNPJ(masked);
        if (!editMode) {
          // Use termo= for searching registered CNPJs
          const check = await cadastroApi.listarEmpresas({ termo: raw, size: 1 });
          if ((check?.content ?? []).length > 0) setCnpjExists(true);
        }
      } finally { setCnpjLoading(false); }
    }
  };

  const handleCEP = async v => {
    const masked = maskCEP(v);
    set('cep', masked);
    if (unmask(masked).length === 8) {
      setCepLoading(true);
      try { await onFetchCEP(masked, onChange); }
      finally { setCepLoading(false); }
    }
  };

  return (
    <div className={styles.formBody}>
      <div className={styles.grid2}>
        <div>
          <label className={styles.fieldLabel}>CNPJ *</label>
          <div className={styles.inputWithSpinner}>
            <Input value={data.cnpj} onChange={e => handleCNPJ(e.target.value)} placeholder="00.000.000/0000-00"
              className={cnpjExists ? styles.inputErr : ''} />
            {cnpjLoading && <Loader2 size={13} className={[styles.spinInline, styles.inputSpinner].join(' ')} />}
          </div>
          {cnpjExists && (
            <span className={styles.cpfMsg} style={{ color:'#ef4444' }}>
              CNPJ já cadastrado no sistema!
            </span>
          )}
        </div>
        <FormField label="Razão Social *">
          <Input value={data.razaoSocial} onChange={e => set('razaoSocial', e.target.value)} />
        </FormField>
      </div>
      <div className={styles.grid2}>
        <FormField label="Nome Fantasia">
          <Input value={data.nomeFantasia} onChange={e => set('nomeFantasia', e.target.value)} />
        </FormField>
        <FormField label="Telefone">
          <Input value={data.telefone} onChange={e => set('telefone', maskPhone(e.target.value))} placeholder="(00) 00000-0000" />
        </FormField>
      </div>
      <FormField label="Email">
        <Input type="email" value={data.email} onChange={e => set('email', e.target.value)} placeholder="contato@empresa.com" />
      </FormField>

      <div className={styles.formDivider} />

      <div className={styles.grid3}>
        <div>
          <label className={styles.fieldLabel}>CEP</label>
          <div className={styles.inputWithSpinner}>
            <Input value={data.cep} onChange={e => handleCEP(e.target.value)} placeholder="00000-000" />
            {cepLoading && <Loader2 size={13} className={[styles.spinInline, styles.inputSpinner].join(' ')} />}
          </div>
        </div>
        <FormField label="País"><Input value={data.pais} onChange={e => set('pais', e.target.value)} /></FormField>
        <FormField label="Estado"><Input value={data.estado} onChange={e => set('estado', e.target.value)} /></FormField>
      </div>
      <div className={styles.grid2}>
        <FormField label="Município"><Input value={data.municipio} onChange={e => set('municipio', e.target.value)} /></FormField>
        <FormField label="Bairro"><Input value={data.bairro} onChange={e => set('bairro', e.target.value)} /></FormField>
      </div>
      <div className={styles.grid3}>
        <div className={styles.spanTwo}>
          <FormField label="Endereço"><Input value={data.endereco} onChange={e => set('endereco', e.target.value)} placeholder="Rua / Av." /></FormField>
        </div>
        <FormField label="Número"><Input value={data.numero} onChange={e => set('numero', e.target.value)} placeholder="0" /></FormField>
      </div>
      <FormField label="Complemento">
        <Input value={data.complemento} onChange={e => set('complemento', e.target.value)} placeholder="Sala, Bloco..." />
      </FormField>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
export default function RegistersPage() {
  const [items,          setItems]          = useState([]);
  const [loading,        setLoading]        = useState(false);
  const [notification,   setNotification]   = useState(null);
  const [isSubmitting,   setIsSubmitting]   = useState(false);
  const [page,           setPage]           = useState(0);
  const [totalPages,     setTotalPages]     = useState(0);
  const [totalElements,  setTotalElements]  = useState(0);

  const [searchTerm, setSearchTerm] = useState('');
  const [filterMode, setFilterMode] = useState('todos');
  const searchDebounce = useRef(null);

  // modais
  const [showAddPessoa,  setShowAddPessoa]  = useState(false);
  const [showAddEmpresa, setShowAddEmpresa] = useState(false);
  const [showDetail,     setShowDetail]     = useState(false);
  const [showEdit,       setShowEdit]       = useState(false);
  const [showDependentDetail, setShowDependentDetail] = useState(false);
  const [showLinkedPessoaDetail, setShowLinkedPessoaDetail] = useState(false);
  const [detailItem,     setDetailItem]     = useState(null);
  const [detailType,     setDetailType]     = useState('pessoa');
  const [detailTab,      setDetailTab]      = useState('cadastro');
  const [editMode,       setEditMode]       = useState(false);
  const [linkedPessoaBackRef, setLinkedPessoaBackRef] = useState(null);

  // forms
  const [titular,     setTitular]     = useState(blankPessoa());
  const [dependentes, setDependentes] = useState([]);
  const [editPessoa,  setEditPessoa]  = useState(blankPessoa());
  const [empresa,     setEmpresa]     = useState(blankEmpresa());

  // validação + confirmação no cadastro de hóspede
  const [showErrors,  setShowErrors]  = useState(false);
  const [confirmStep, setConfirmStep] = useState(false);

  // link empresa no cadastro de hóspede
  const [linkSearch,  setLinkSearch]  = useState('');
  const [linkResults, setLinkResults] = useState([]);
  const [linkLoading, setLinkLoading] = useState(false);
  const [linkEmpresa, setLinkEmpresa] = useState(null);
  const linkDebounce = useRef(null);

  // vinculados (detalhe empresa)
  const [vinculSearch,  setVinculSearch]  = useState('');
  const [vinculResults, setVinculResults] = useState([]);
  const [vinculLoading, setVinculLoading] = useState(false);
  const vinculDebounce = useRef(null);

  const showNotif = (msg, type = 'success') => {
    setNotification({ message: msg, type });
    setTimeout(() => setNotification(null), 3200);
  };

  const fetchCEP = async (cep, setter) => {
    const raw = unmask(cep);
    if (raw.length !== 8) return;
    const d = await cadastroApi.buscarCEP(raw);
    setter(prev => ({
      ...prev,
      endereco:  d.endereco  || prev.endereco,
      bairro:    d.bairro    || prev.bairro,
      pais:      d.pais?.descricao      || prev.pais,
      estado:    d.estado?.descricao    || prev.estado,
      municipio: d.municipio?.descricao || prev.municipio,
    }));
  };

  const fetchCNPJ = async (cnpj) => {
    const raw = unmask(cnpj);
    if (raw.length !== 14) return;
    const d = await cadastroApi.buscarCNPJ(raw);
    setEmpresa(prev => ({
      ...prev,
      razaoSocial:  d.razaoSocial  || prev.razaoSocial,
      nomeFantasia: d.nomeFantasia || prev.nomeFantasia,
      telefone:     d.telefone     || prev.telefone,
      email:        d.email        || prev.email,
      cep:          d.endereco?.cep ? maskCEP(d.endereco.cep) : prev.cep,
      endereco:     d.endereco?.endereco     || prev.endereco,
      bairro:       d.endereco?.bairro       || prev.bairro,
      complemento:  d.endereco?.complemento  || prev.complemento,
      pais:         d.endereco?.pais?.descricao      || prev.pais,
      estado:       d.endereco?.estado?.descricao    || prev.estado,
      municipio:    d.endereco?.municipio?.descricao || prev.municipio,
    }));
  };

  const checkCPF = async raw => {
    try {
      const res = await cadastroApi.listarPessoas({ termo: raw, size: 1 });
      return (res?.content ?? []).length > 0;
    } catch { return false; }
  };

  const fetchData = useCallback(async (term = '', mode = 'todos', pg = 0) => {
    setLoading(true);
    try {
      const sp   = buildSearchParams(term);
      const base = { size: 15, page: pg };

      let res;
      if (mode === 'empresas' || sp.cnpj) {
        const params = { ...base };
        if (sp.cnpj)       params.cnpj  = sp.cnpj;
        else if (sp.termo) params.termo = sp.termo;
        res = await cadastroApi.listarEmpresas(params);
        setItems((res?.content ?? []).map(e => ({ ...e, _type: 'empresa' })));
      } else {
        const params = { ...base, ...sp };
        if (mode === 'bloqueados') params.status = 'BLOQUEADO';
        if (mode === 'hospedados') params.status = 'HOSPEDADO';
        res = await cadastroApi.listarPessoas(params);
        setItems((res?.content ?? []).map(p => ({ ...p, _type: 'pessoa' })));
      }
      setTotalPages(res?.totalPages ?? 0);
      setTotalElements(res?.totalElements ?? 0);
    } catch {
      showNotif('Erro ao carregar cadastros.', 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData('', 'todos', 0); }, [fetchData]);

  useEffect(() => {
    clearTimeout(searchDebounce.current);
    if (searchTerm.length >= 3) {
      searchDebounce.current = setTimeout(() => {
        setPage(0); fetchData(searchTerm, filterMode, 0);
      }, 400);
    } else if (searchTerm.length === 0) {
      fetchData('', filterMode, 0);
    }
    return () => clearTimeout(searchDebounce.current);
  }, [searchTerm]); // eslint-disable-line

  useEffect(() => {
    clearTimeout(linkDebounce.current);
    if (linkSearch.length >= 3) {
      linkDebounce.current = setTimeout(async () => {
        setLinkLoading(true);
        try {
          const res = await cadastroApi.listarEmpresas({ termo: linkSearch, size: 8 });
          setLinkResults(res?.content ?? []);
        } catch {} finally { setLinkLoading(false); }
      }, 400);
    } else { setLinkResults([]); }
    return () => clearTimeout(linkDebounce.current);
  }, [linkSearch]);

  // Auto-search vinculados
  useEffect(() => {
    clearTimeout(vinculDebounce.current);
    if (vinculSearch.length >= 2) {
      vinculDebounce.current = setTimeout(async () => {
        setVinculLoading(true);
        try {
          const res = await cadastroApi.listarPessoas({ termo: vinculSearch, size: 20 });
          setVinculResults(res?.content ?? []);
        } catch {} finally { setVinculLoading(false); }
      }, 300);
    } else { setVinculResults([]); }
    return () => clearTimeout(vinculDebounce.current);
  }, [vinculSearch]);

  const changeFilter = mode => { setFilterMode(mode); setPage(0); fetchData(searchTerm, mode, 0); };
  const goToPage     = pg   => { setPage(pg); fetchData(searchTerm, filterMode, pg); };

  const handleAddPessoa = () => {
    if (!titular.nome || !titular.cpf || !titular.dataNascimento ||
        !titular.telefone || !titular.email || !titular.cep) {
      setShowErrors(true);
      showNotif('Preencha todos os campos obrigatórios (*).', 'error');
      return;
    }
    // Validar dependentes
    for (let i = 0; i < dependentes.length; i++) {
      const dep = dependentes[i];
      if (!dep.nome || !dep.cpf || !dep.dataNascimento || !dep.telefone || !dep.email || !dep.cep) {
        showNotif(`Preencha todos os campos obrigatórios do dependente ${i + 1}.`, 'error');
        return;
      }
    }
    setShowErrors(false);
    setConfirmStep(true);
  };

  const doSavePessoa = async () => {
    setIsSubmitting(true);
    try {
      await cadastroApi.criarPessoa({
        pessoas: [
          buildPessoaBody(titular, { titularId: null }),
          ...dependentes.map(d => buildPessoaBody(d, { titularId: null })),
        ],
        empresasIds: linkEmpresa ? [linkEmpresa.id] : [],
      });
      showNotif('Hóspede(s) cadastrado(s) com sucesso!');
      setShowAddPessoa(false);
      setConfirmStep(false); setShowErrors(false);
      setTitular(blankPessoa()); setDependentes([]);
      setLinkEmpresa(null); setLinkSearch(''); setLinkResults([]);
      fetchData(searchTerm, filterMode, page);
    } catch (e) { showNotif(e.message || 'Erro ao cadastrar.', 'error'); }
    finally { setIsSubmitting(false); }
  };

  const handleSaveEmpresa = async () => {
    if (!empresa.razaoSocial || !empresa.cnpj) {
      showNotif('Preencha CNPJ e Razão Social.', 'error'); return;
    }
    setIsSubmitting(true);
    try {
      const cnpjRaw = unmask(empresa.cnpj);
      const body = {
        cnpj:          cnpjRaw,
        razao_social:  up(empresa.razaoSocial),
        nome_fantasia: up(empresa.nomeFantasia),
        tipo_empresa:  empresa.tipoEmpresa || 'CLIENTE',
        telefone:      unmask(empresa.telefone),
        email:         (empresa.email ?? '').trim(),
        cep:           unmask(empresa.cep),
        endereco:      up(empresa.endereco),
        bairro:        up(empresa.bairro),
        complemento:   up(empresa.complemento),
        numero:        up(empresa.numero),
        pais:          up(empresa.pais) || 'BRASIL',
        estado:        up(empresa.estado),
        municipio:     up(empresa.municipio),
      };
      if (editMode && detailItem?.id) {
        await cadastroApi.atualizarEmpresa(detailItem.id, body);
        showNotif('Empresa atualizada!');
      } else {
        // Use termo= endpoint for checking duplicates
        const check = await cadastroApi.listarEmpresas({ termo: cnpjRaw, size: 1 });
        if ((check?.content ?? []).length > 0) {
          showNotif('CNPJ já cadastrado!', 'error');
          setIsSubmitting(false); return;
        }
        await cadastroApi.criarEmpresa(body);
        showNotif('Empresa cadastrada com sucesso!');
      }
      setShowAddEmpresa(false); setEmpresa(blankEmpresa()); setEditMode(false);
      fetchData(searchTerm, filterMode, page);
    } catch (e) { showNotif(e.message || 'Erro ao salvar empresa.', 'error'); }
    finally { setIsSubmitting(false); }
  };

  const openEditPessoa = p => {
    if (p.status === 'BLOQUEADO') return;
    setEditPessoa({
      nome:               p.nome ?? '',
      dataNascimento:     p.dataNascimento ? new Date(p.dataNascimento + 'T12:00:00') : null,
      cpf:                maskCPF(p.cpf ?? ''),
      rg:                 p.rg ?? '',
      email:              p.email ?? '',
      telefone:           maskPhone(p.telefone ?? ''),
      sexo:               String(p.sexo ?? ''),
      pais:               p.pais ?? 'Brasil',
      estado:             p.estado ?? '',
      municipio:          p.municipio ?? '',
      endereco:           p.endereco ?? '',
      complemento:        p.complemento ?? '',
      cep:                maskCEP(p.cep ?? ''),
      bairro:             p.bairro ?? '',
      numero:             p.numero ?? '',
      status:             p.status ?? 'ATIVO',
      titularId:          p.titularId ?? null,
      empresasVinculadas: p.empresasVinculadas ?? [],
      veiculos:           (p.veiculos ?? []).map(v => ({
        modelo: v.modelo ?? '', marca: v.marca ?? '',
        ano: String(v.ano ?? ''), placa: v.placa ?? '', cor: v.cor ?? '',
      })),
    });
    setShowDetail(false); setShowEdit(true);
  };

  const handleSaveEditPessoa = async () => {
    setIsSubmitting(true);
    try {
      await cadastroApi.atualizarPessoa(detailItem.id, buildPessoaBody(editPessoa));
      showNotif('Pessoa atualizada!');
      setShowEdit(false);
      fetchData(searchTerm, filterMode, page);
    } catch (e) { showNotif(e.message || 'Erro ao editar.', 'error'); }
    finally { setIsSubmitting(false); }
  };

  const handleToggleStatus = async () => {
    const novoStatus = detailItem.status === 'BLOQUEADO' ? 'ATIVO' : 'BLOQUEADO';
    setIsSubmitting(true);
    try {
      await cadastroApi.atualizarPessoa(detailItem.id, buildPessoaBody(detailItem, { status: novoStatus }));
      showNotif(`Status alterado para ${novoStatus}!`);
      setDetailItem(prev => ({ ...prev, status: novoStatus }));
      fetchData(searchTerm, filterMode, page);
    } catch (e) { showNotif(e.message || 'Erro ao alterar status.', 'error'); }
    finally { setIsSubmitting(false); }
  };

  const openDetail = item => {
    setDetailItem(item);
    setDetailType(item._type === 'empresa' ? 'empresa' : 'pessoa');
    // Default tab per type
    setDetailTab(item._type === 'empresa' ? 'informacoes' : 'cadastro');
    setVinculSearch(''); setVinculResults([]);
    setShowDetail(true);
  };

  const handleVincular = async pessoaId => {
    try {
      const vinculadoIds = (detailItem?.pessoasVinculadas ?? detailItem?.pessoas ?? []).map(p => p.id);
      if (vinculadoIds.includes(pessoaId)) {
        showNotif('Esta pessoa já está vinculada!', 'error');
        return;
      }
      // PUT to /empresas/:id/pessoa?pessoaId=X&vinculo=true
      await fetch(`${window.location.origin}/api/empresas/${detailItem.id}/pessoa?pessoaId=${pessoaId}&vinculo=true`, { method: 'PUT' });
      showNotif('Pessoa vinculada!');
      const updated = await cadastroApi.buscarEmpresaPorId(detailItem.id);
      setDetailItem({ ...updated, _type: 'empresa' });
      setVinculSearch('');
      setVinculResults([]);
    } catch (e) { showNotif(e.message || 'Erro ao vincular.', 'error'); }
  };

  const handleDesvincular = async pessoaId => {
    if (!window.confirm('Tem certeza que deseja desvincular esta pessoa?')) return;
    try {
      await fetch(`${window.location.origin}/api/empresas/${detailItem.id}/pessoa?pessoaId=${pessoaId}&vinculo=false`, { method: 'PUT' });
      showNotif('Pessoa desvinculada!');
      const updated = await cadastroApi.buscarEmpresaPorId(detailItem.id);
      setDetailItem({ ...updated, _type: 'empresa' });
    } catch (e) { showNotif(e.message || 'Erro ao desvincular.', 'error'); }
  };

  const viewLinkedPessoa = p => {
    setLinkedPessoaBackRef(detailItem);
    setDetailItem(p);
    setDetailType('pessoa');
    setDetailTab('cadastro');
  };

  const openEditEmpresa = () => {
    if (detailItem?.status === 'BLOQUEADO') return;
    const e = detailItem;
    setEmpresa({
      cnpj: maskCNPJ(e.cnpj ?? ''),
      razaoSocial: e.razaoSocial ?? e.razao_social ?? '',
      nomeFantasia: e.nomeFantasia ?? e.nome_fantasia ?? '',
      telefone: e.telefone ?? '',
      email: e.email ?? '',
      cep: maskCEP(e.cep ?? ''),
      endereco: e.endereco ?? '', bairro: e.bairro ?? '',
      complemento: e.complemento ?? '', numero: e.numero ?? '',
      pais: e.pais ?? 'Brasil', estado: e.estado ?? '', municipio: e.municipio ?? '',
      tipoEmpresa: e.tipoEmpresa ?? e.tipo_empresa ?? 'CLIENTE',
    });
    setEditMode(true); setShowDetail(false); setShowAddEmpresa(true);
  };

  const filterTabs = [
    { id: 'todos',      label: 'Todos',      Icon: Users     },
    { id: 'hospedados', label: 'Hospedados', Icon: UserCheck },
    { id: 'bloqueados', label: 'Bloqueados', Icon: UserX     },
    { id: 'empresas',   label: 'Empresas',   Icon: Building2 },
  ];

  const totalPessoas   = 1 + dependentes.length;
  const vinculadosList = detailItem?.pessoasVinculadas ?? detailItem?.pessoas ?? [];

  const nomeListing = item =>
    item._type === 'empresa'
      ? (item.razaoSocial || item.razao_social || item.nomeFantasia || '—')
      : (item.nome || '—');

  const empresaNome = e =>
    e?.razaoSocial || e?.razao_social || e?.nomeFantasia || e?.nome_fantasia || e?.nome || '—';

  const isBloqueado = detailItem?.status === 'BLOQUEADO';

  // ── Modal title helpers ───────────────────────────────────
  const pessoaTitleJSX = detailItem && detailType === 'pessoa' ? (
    <div className={styles.modalTitleBlock}>
      <AvatarCircle name={detailItem.nome} size={42} />
      <div>
        <div className={styles.modalTitleName}>{detailItem.nome ?? '—'}</div>
        <div className={styles.modalTitleMeta}>
          <span className={styles.detailId}>#{detailItem.id}</span>
          <StatusBadge status={detailItem.status} />
          {detailItem.titularNome && <span className={styles.depTag}>Dep. de {detailItem.titularNome}</span>}
        </div>
      </div>
    </div>
  ) : null;

  const empresaTitleJSX = detailItem && detailType === 'empresa' ? (
    <div className={styles.modalTitleBlock}>
      <AvatarCircle name={detailItem.razaoSocial ?? detailItem.razao_social} size={42} />
      <div>
        <div className={styles.modalTitleName}>
          {detailItem.razaoSocial ?? detailItem.razao_social ?? '—'}
        </div>
        <div className={styles.modalTitleMeta}>
          <span className={styles.detailId}>#{detailItem.id}</span>
          <StatusBadge status={detailItem.status} />
          {(detailItem.nomeFantasia ?? detailItem.nome_fantasia) && (
            <span className={styles.depTag}>
              {detailItem.nomeFantasia ?? detailItem.nome_fantasia}
            </span>
          )}
        </div>
      </div>
    </div>
  ) : null;

  // ── Detail modal footers ──────────────────────────────────
  const pessoaDetailFooter = detailItem && detailType === 'pessoa' ? (
    <div className={styles.detailFooterActions}>
      {linkedPessoaBackRef && (
        <Button onClick={() => {
          setDetailItem(linkedPessoaBackRef);
          setDetailType(linkedPessoaBackRef._type === 'empresa' ? 'empresa' : 'pessoa');
          setLinkedPessoaBackRef(null);
          setDetailTab(linkedPessoaBackRef._type === 'empresa' ? 'vinculados' : 'dependentes');
        }}>
          <ChevronLeft size={13} /> Voltar para {linkedPessoaBackRef._type === 'empresa' ? 'Empresa' : 'Titular'}
        </Button>
      )}
      {isBloqueado && (
        <span className={styles.blockedNotice}><Shield size={13} /> Bloqueado — edição desativada</span>
      )}
      <Button onClick={() => openEditPessoa(detailItem)} disabled={isBloqueado}>
        <Edit2 size={13} /> Editar
      </Button>
      <Button variant={isBloqueado ? 'primary' : 'danger'} onClick={handleToggleStatus} disabled={isSubmitting}>
        {isBloqueado ? <><UserCheck size={13} /> Desbloquear</> : <><Shield size={13} /> Bloquear</>}
      </Button>
    </div>
  ) : null;

  const empresaDetailFooter = detailItem && detailType === 'empresa' ? (
    <div className={styles.detailFooterActions}>
      {isBloqueado && (
        <span className={styles.blockedNotice}><Shield size={13} /> Bloqueada — edição desativada</span>
      )}
      <Button onClick={openEditEmpresa} disabled={isBloqueado}>
        <Edit2 size={13} /> Editar
      </Button>
      <Button variant={isBloqueado ? 'primary' : 'danger'}>
        {isBloqueado ? <><UserCheck size={13} /> Desbloquear</> : <><Shield size={13} /> Bloquear</>}
      </Button>
    </div>
  ) : null;

  // ─────────────────────────────────────────────────────────
  return (
    <div className={styles.page}>
      <div className={styles.container}>

        <div className={styles.card}>
          {/* Header do card */}
          <div className={styles.tableHeader}>
            <div>
              <h2 className={styles.h2}>Cadastro</h2>
              <p className={styles.subtitle}>Hóspedes, empresas e veículos cadastrados</p>
            </div>
            <div className={styles.tableTools}>
              <div className={styles.searchWrap}>
                <Search size={13} className={styles.searchIcon} />
                <Input
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  placeholder="Nome, CPF, CNPJ, placa..."
                  className={styles.searchInput}
                />
                {loading && searchTerm.length >= 3 &&
                  <Loader2 size={13} className={[styles.spinInline, styles.searchSpinner].join(' ')} />}
              </div>
              <Button onClick={() => { setEmpresa(blankEmpresa()); setEditMode(false); setShowAddEmpresa(true); }}>
                <Building2 size={14} /> Empresa
              </Button>
              <Button variant="primary" onClick={() => {
                setTitular(blankPessoa()); setDependentes([]);
                setLinkEmpresa(null); setLinkSearch(''); setLinkResults([]);
                setShowErrors(false); setConfirmStep(false);
                setShowAddPessoa(true);
              }}>
                <Plus size={14} /> Hóspede
              </Button>
            </div>
          </div>

          {/* Filtros */}
          <div className={styles.filterRow}>
            {filterTabs.map(({ id, label, Icon }) => (
              <button key={id}
                className={[styles.filterTab, filterMode === id ? styles.filterTabActive : ''].join(' ')}
                onClick={() => changeFilter(id)}>
                <Icon size={12} /> {label}
              </button>
            ))}
          </div>

          {/* Tabela */}
          <div className={styles.tableWrap}>
            {loading ? (
              <div className={styles.empty}><Loader2 size={20} className={styles.spin} /> Carregando...</div>
            ) : items.length === 0 ? (
              <div className={styles.empty}><AlertCircle size={26} opacity={0.3} /><span>Nenhum resultado encontrado.</span></div>
            ) : (
              <table className={styles.table}>
                <thead><tr>
                  <th style={{ width: 44 }}></th>
                  <th>Nome / Razão Social</th>
                  <th style={{ width: 148 }}>CPF / CNPJ</th>
                  <th style={{ width: 148 }}>Telefone</th>
                  <th style={{ width: 100 }}>Status</th>
                </tr></thead>
                <tbody>
                  {items.map(item => {
                    const name = nomeListing(item);
                    const { bg, fg } = avatarColor(name);
                    return (
                      <tr key={`${item._type}-${item.id}`} className={styles.row} onClick={() => openDetail(item)}>
                        <td>
                          <div className={styles.listAvatar} style={{ background: bg, color: fg }}>
                            {getInitials(name)}
                          </div>
                        </td>
                        <td>
                          <div className={styles.nome}>{name}</div>
                          {item._type === 'pessoa' && item.titularNome && (
                            <div className={styles.sub}>Dep. de {item.titularNome}</div>
                          )}
                          {item._type === 'empresa' && (item.nomeFantasia || item.nome_fantasia) &&
                            (item.nomeFantasia || item.nome_fantasia) !== (item.razaoSocial || item.razao_social) && (
                            <div className={styles.sub}>{item.nomeFantasia ?? item.nome_fantasia}</div>
                          )}
                          {item._type === 'pessoa' && (item.veiculos ?? [])[0] && (
                            <div className={styles.sub} style={{ display:'flex', alignItems:'center', gap:3 }}>
                              <Car size={10} />
                              {item.veiculos[0].placa}
                              {[item.veiculos[0].modelo, item.veiculos[0].marca].filter(Boolean).join(' ') &&
                                ` · ${[item.veiculos[0].modelo, item.veiculos[0].marca].filter(Boolean).join(' ')}`}
                            </div>
                          )}
                          {item._type === 'pessoa' && (item.empresasVinculadas ?? [])[0] && (
                            <div className={styles.sub} style={{ display:'flex', alignItems:'center', gap:3 }}>
                              <Building2 size={10} /> {empresaNome(item.empresasVinculadas[0])}
                            </div>
                          )}
                        </td>
                        <td className={styles.mono}>
                          {item._type === 'empresa' ? maskCNPJ(item.cnpj ?? '') : maskCPF(item.cpf ?? '')}
                        </td>
                        <td className={styles.mono}>{item.telefone ? maskPhone(item.telefone) : '—'}</td>
                        <td><StatusBadge status={item.status} /></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          {/* Paginação */}
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

      {/* ══ MODAL: DETALHE PESSOA ══════════════════════════════ */}
      {detailItem && detailType === 'pessoa' && (
        <Modal
          open={showDetail}
          onClose={() => setShowDetail(false)}
          size="xl"
          title={pessoaTitleJSX}
          footer={pessoaDetailFooter}
        >
          <div className={styles.tabs}>
            {[
              ['cadastro',    'Cadastro'],
              ['veiculo',     'Veículo'],
              ['empresa',     'Empresa'],
              ['historico',   'Histórico de Hospedagens'],
              ['dependentes', 'Dependentes'],
            ].map(([id, label]) => (
              <button key={id} className={[styles.tab, detailTab === id ? styles.tabActive : ''].join(' ')}
                onClick={() => setDetailTab(id)}>{label}</button>
            ))}
          </div>

          <div className={styles.tabBody}>
            {detailTab === 'cadastro' && (
              <div className={styles.detailGrid}>
                <Section title="Dados Pessoais">
                  <KV label="CPF"  value={maskCPF(detailItem.cpf ?? '')} />
                  <KV label="RG"   value={detailItem.rg} />
                  <KV label="Nasc." value={dateFromApi(detailItem.dataNascimento)} />
                  <KV label="Sexo" value={detailItem.sexo === 1 ? 'Masculino' : detailItem.sexo === 2 ? 'Feminino' : 'Outro'} />
                  <KV label="Telefone" value={
                    <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                      <span>{maskPhone(detailItem.telefone ?? '') || '—'}</span>
                      {detailItem.telefone && (
                        <a href={`https://wa.me/55${unmask(detailItem.telefone)}`} target="_blank"
                          rel="noreferrer" className={styles.quickBtn} title="WhatsApp" onClick={e => e.stopPropagation()}>
                          <Phone size={11} />
                        </a>
                      )}
                    </div>
                  } />
                  <KV label="Email" value={
                    <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                      <span>{detailItem.email || '—'}</span>
                      {detailItem.email && (
                        <a href={`mailto:${detailItem.email}`} target="_blank" rel="noreferrer"
                          className={styles.quickBtn} title="Enviar e-mail" onClick={e => e.stopPropagation()}>
                          <Mail size={11} />
                        </a>
                      )}
                    </div>
                  } />
                </Section>
                <Section title="Endereço">
                  <KV label="CEP"      value={maskCEP(detailItem.cep ?? '')} />
                  <KV label="Endereço" value={`${detailItem.endereco ?? ''}${detailItem.numero ? ', ' + detailItem.numero : ''}`} />
                  <KV label="Bairro"   value={detailItem.bairro} />
                  <KV label="Cidade"   value={[detailItem.municipio, detailItem.estado].filter(Boolean).join(' - ')} />
                  <KV label="País"     value={detailItem.pais} />
                  <KV label="Compl."   value={detailItem.complemento} />
                </Section>
              </div>
            )}

            {detailTab === 'veiculo' && (
              (detailItem.veiculos ?? []).length === 0 ? (
                <div className={styles.emBreve}><Car size={36} opacity={0.2} /><span>Sem veículos cadastrados.</span></div>
              ) : (
                <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                  {detailItem.veiculos.map((v, i) => (
                    <div key={i} className={styles.veiculoCard}>
                      <div className={styles.veiculoCardHead}>
                        <Car size={14} className={styles.iconViolet} />
                        <span className={styles.placa}>{v.placa || '—'}</span>
                        <span className={styles.veiculoCardTitle}>{[v.modelo, v.marca].filter(Boolean).join(' ') || '—'}</span>
                      </div>
                      <div className={styles.kvList} style={{ marginTop:8 }}>
                        <KV label="Modelo" value={v.modelo} />
                        <KV label="Marca"  value={v.marca} />
                        <KV label="Ano"    value={v.ano} />
                        <KV label="Cor"    value={v.cor} />
                      </div>
                    </div>
                  ))}
                </div>
              )
            )}

            {detailTab === 'empresa' && (
              (detailItem.empresasVinculadas ?? []).length === 0 ? (
                <div className={styles.emBreve}><Building2 size={36} opacity={0.2} /><span>Sem empresas vinculadas.</span></div>
              ) : (
                <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                  {detailItem.empresasVinculadas.map(e => (
                    <div key={e.id} className={styles.empresaCard}>
                      <div className={styles.empresaCardHead}>
                        <Building2 size={14} className={styles.iconViolet} />
                        <span className={styles.empresaCardTitle}>{empresaNome(e)}</span>
                        <span className={styles.detailId}>#{e.id}</span>
                      </div>
                      <div className={styles.kvList} style={{ marginTop:8 }}>
                        <KV label="CNPJ"         value={maskCNPJ(e.cnpj ?? '')} />
                        <KV label="Razão Social"  value={e.razaoSocial ?? e.razao_social} />
                        <KV label="Nome Fantasia" value={e.nomeFantasia ?? e.nome_fantasia} />
                        <KV label="Telefone"      value={e.telefone} />
                        <KV label="Email"         value={e.email} />
                        <KV label="Status"        value={e.status} />
                      </div>
                    </div>
                  ))}
                </div>
              )
            )}

            {detailTab === 'historico' && (
              <div className={styles.emBreve}>
                <Calendar size={36} opacity={0.2} />
                <span>Histórico de hospedagens em breve.</span>
              </div>
            )}

            {detailTab === 'dependentes' && (
              detailItem.titularId != null
                ? <div className={styles.emBreve}><Users size={32} opacity={0.2} /><span>Esta pessoa é dependente de {detailItem.titularNome}. <a style={{ color: 'var(--violet)', cursor: 'pointer' }} onClick={() => { setLinkedPessoaBackRef(null); setDetailItem(prev => ({ ...prev })); }}>Voltar</a></span></div>
                : (detailItem.acompanhantes ?? []).length === 0
                ? <div className={styles.emBreve}><Users size={32} opacity={0.2} /><span>Sem dependentes cadastrados.</span></div>
                : (
                  <div className={styles.depList}>
                    {(detailItem.acompanhantes ?? []).map(dep => (
                      <div key={dep.id} className={styles.depCard}
                        onClick={() => {
                          setLinkedPessoaBackRef(detailItem);
                          setDetailItem({ ...dep, _type: 'pessoa' });
                          setDetailTab('cadastro');
                        }}>
                        <AvatarCircle name={dep.nome} size={34} />
                        <div>
                          <div className={styles.nome}>{dep.nome}</div>
                          <div className={styles.sub}>{maskCPF(dep.cpf ?? '')} · {dep.status}</div>
                        </div>
                        <ChevronRight size={14} className={styles.iconMuted} />
                      </div>
                    ))}
                  </div>
                )
            )}
          </div>
        </Modal>
      )}

      {/* ══ MODAL: DETALHE EMPRESA ════════════════════════════ */}
      {detailItem && detailType === 'empresa' && (
        <Modal
          open={showDetail}
          onClose={() => setShowDetail(false)}
          size="xl"
          title={empresaTitleJSX}
          footer={empresaDetailFooter}
          style={{ maxHeight: '90vh' }}
        >
          <div className={styles.tabs}>
            {[['informacoes','Informações'],['vinculados','Vinculados'],['historico','Histórico de Hospedagens']].map(([id, label]) => (
              <button key={id} className={[styles.tab, detailTab === id ? styles.tabActive : ''].join(' ')}
                onClick={() => setDetailTab(id)}>{label}</button>
            ))}
          </div>

          <div className={styles.tabBody}>
            {detailTab === 'informacoes' && (
              <div className={styles.detailGrid}>
                <Section title="Dados Empresariais">
                  <KV label="CNPJ"         value={maskCNPJ(detailItem.cnpj ?? '')} />
                  <KV label="Razão Social"  value={detailItem.razaoSocial ?? detailItem.razao_social} />
                  <KV label="Nome Fantasia" value={detailItem.nomeFantasia ?? detailItem.nome_fantasia} />
                  <KV label="Tipo"          value={detailItem.tipoEmpresa ?? detailItem.tipo_empresa} />
                  <KV label="Telefone" value={
                    <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                      <span>{detailItem.telefone || '—'}</span>
                      {detailItem.telefone && (
                        <a href={`https://wa.me/55${unmask(detailItem.telefone)}`} target="_blank"
                          rel="noreferrer" className={styles.quickBtn} title="WhatsApp" onClick={e => e.stopPropagation()}>
                          <Phone size={11} />
                        </a>
                      )}
                    </div>
                  } />
                  <KV label="Email" value={
                    <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                      <span>{detailItem.email || '—'}</span>
                      {detailItem.email && (
                        <a href={`mailto:${detailItem.email}`} target="_blank" rel="noreferrer"
                          className={styles.quickBtn} title="Enviar e-mail" onClick={e => e.stopPropagation()}>
                          <Mail size={11} />
                        </a>
                      )}
                    </div>
                  } />
                </Section>
                <Section title="Endereço">
                  <KV label="CEP"      value={maskCEP(detailItem.cep ?? '')} />
                  <KV label="Endereço" value={detailItem.endereco} />
                  <KV label="Bairro"   value={detailItem.bairro} />
                  <KV label="Cidade"   value={detailItem.municipio} />
                  <KV label="Estado"   value={detailItem.estado} />
                </Section>
              </div>
            )}
            {detailTab === 'vinculados' && (
              <div>
                <div className={styles.vinculBar}>
                  <div className={styles.searchWrap} style={{ flex: 1 }}>
                    <Search size={13} className={styles.searchIcon} />
                    <Input value={vinculSearch} onChange={e => setVinculSearch(e.target.value)}
                      placeholder="Buscar pessoa por nome ou CPF..."
                      className={styles.searchInput} />
                    {vinculLoading && <Loader2 size={13} className={[styles.spinInline, styles.searchSpinner].join(' ')} />}
                  </div>
                </div>
                {vinculResults.length > 0 && (
                  <div className={styles.vinculResults}>
                    {vinculResults.map(p => (
                      <div key={p.id} className={styles.vinculResult}>
                        <AvatarCircle name={p.nome} size={26} />
                        <span className={styles.nome}>{p.nome}</span>
                        <span className={styles.mono}>{maskCPF(p.cpf ?? '')}</span>
                        <Button variant="primary" onClick={() => handleVincular(p.id)}>
                          <Plus size={12} /> Vincular
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
                <div className={styles.depList}>
                  {vinculadosList.length === 0
                    ? <div className={styles.emBreve}><Users size={28} opacity={0.2} /><span>Nenhum vinculado.</span></div>
                    : vinculadosList.map(p => (
                      <div key={p.id} className={styles.depCard}>
                        <AvatarCircle name={p.nome} size={32} />
                        <div style={{ flex: 1, cursor: 'pointer' }} onClick={() => viewLinkedPessoa(p)}>
                          <div className={styles.nome}>{p.nome}</div>
                          <div className={styles.sub}>{maskCPF(p.cpf ?? '')}</div>
                        </div>
                        <button className={styles.btnRemove} onClick={() => handleDesvincular(p.id)} title="Desvincular">
                          <Trash2 size={13} />
                        </button>
                      </div>
                    ))
                  }
                </div>
              </div>
            )}
            {detailTab === 'historico' && (
              <div className={styles.emBreve}>
                <Calendar size={36} opacity={0.2} />
                <span>Histórico de hospedagens em breve.</span>
              </div>
            )}
          </div>
        </Modal>
      )}

      {/* ══ MODAL: EDITAR PESSOA ══════════════════════════════ */}
      <Modal open={showEdit} onClose={() => setShowEdit(false)} size="lg" title="Editar Hóspede"
        footer={
          <div className={styles.modalFooter}>
            <Button onClick={() => setShowEdit(false)} className={styles.full}>Cancelar</Button>
            <Button variant="primary" onClick={handleSaveEditPessoa} disabled={isSubmitting} className={styles.full}>
              {isSubmitting ? <><Loader2 size={13} className={styles.spinInline} /> Salvando...</> : 'Salvar'}
            </Button>
          </div>
        }>
        <PessoaForm data={editPessoa} onChange={setEditPessoa} onFetchCEP={fetchCEP} onCheckCPF={checkCPF} />
      </Modal>

      {/* ══ MODAL: ADICIONAR HÓSPEDE ══════════════════════════ */}
      <Modal
        open={showAddPessoa}
        onClose={() => { setShowAddPessoa(false); setConfirmStep(false); setShowErrors(false); }}
        size="xl"
        title={confirmStep ? 'Confirmar Cadastro' : 'Novo Hóspede'}
        footer={
          <div className={styles.modalFooter}>
            {!confirmStep ? (
              <>
                <div className={styles.personCount}>
                  <Users size={13} />
                  <span>{totalPessoas}</span>
                  pessoa{totalPessoas !== 1 ? 's' : ''}
                </div>
                <Button onClick={() => setShowAddPessoa(false)}>Cancelar</Button>
                <Button variant="primary" onClick={handleAddPessoa}>Próximo →</Button>
              </>
            ) : (
              <>
                <Button onClick={() => setConfirmStep(false)}>← Voltar</Button>
                <Button variant="primary" onClick={doSavePessoa} disabled={isSubmitting}>
                  {isSubmitting ? <><Loader2 size={13} className={styles.spinInline} /> Salvando...</> : 'Confirmar e Salvar'}
                </Button>
              </>
            )}
          </div>
        }>

        {!confirmStep ? (
          <>
            <div className={styles.addBlock}>
              <div className={styles.addBlockTitle}><User size={13} /> Titular</div>
              <PessoaForm
                data={titular} onChange={setTitular}
                onFetchCEP={fetchCEP} onCheckCPF={checkCPF}
                showErrors={showErrors}
              />
            </div>

            <div className={styles.addBlock}>
              <div className={styles.addBlockTitle}><Building2 size={13} /> Empresa (opcional)</div>
              {linkEmpresa ? (
                <div className={styles.selectedEmpresa}>
                  <Building2 size={13} className={styles.iconViolet} />
                  <span className={styles.nome}>{empresaNome(linkEmpresa)}</span>
                  <span className={styles.mono}>{maskCNPJ(linkEmpresa.cnpj ?? '')}</span>
                  <button className={styles.btnRemove} onClick={() => setLinkEmpresa(null)}><X size={12} /></button>
                </div>
              ) : (
                <div className={styles.linkEmpresaSearch}>
                  <div className={styles.searchWrap}>
                    <Search size={13} className={styles.searchIcon} />
                    <Input value={linkSearch} onChange={e => setLinkSearch(e.target.value)}
                      placeholder="Buscar empresa por nome ou CNPJ (mín. 3 caracteres)..."
                      className={styles.searchInput} />
                    {linkLoading && <Loader2 size={13} className={[styles.spinInline, styles.searchSpinner].join(' ')} />}
                  </div>
                  {linkResults.length > 0 && (
                    <div className={styles.linkDropdown}>
                      {linkResults.map(e => (
                        <button key={e.id} className={styles.linkDropdownItem}
                          onClick={() => { setLinkEmpresa(e); setLinkSearch(''); setLinkResults([]); }}>
                          <Building2 size={12} className={styles.iconViolet} />
                          <span className={styles.nome}>{empresaNome(e)}</span>
                          <span className={styles.mono}>{maskCNPJ(e.cnpj ?? '')}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className={styles.addBlock}>
              <div className={styles.addBlockHead}>
                <span className={styles.addBlockTitle}>
                  <Users size={13} /> Dependentes
                  {dependentes.length > 0 && (
                    <span className={styles.depCountBadge}>{dependentes.length}</span>
                  )}
                </span>
                <Button onClick={() => setDependentes(d => [...d, blankPessoa()])}>
                  <Plus size={12} /> Adicionar
                </Button>
              </div>
              {dependentes.map((dep, i) => (
                <div key={i} className={styles.subFormBlock} style={{ marginTop: 12 }}>
                  <div className={styles.subFormTitle}>
                    <span>Dependente {i + 1}</span>
                    <button className={styles.btnRemove}
                      onClick={() => setDependentes(d => d.filter((_,j) => j !== i))}>
                      <X size={13} />
                    </button>
                  </div>
                  <PessoaForm
                    data={dep}
                    onChange={val => setDependentes(d => d.map((x, j) =>
                      j === i ? (typeof val === 'function' ? val(x) : val) : x))}
                    onFetchCEP={fetchCEP}
                    onCheckCPF={checkCPF}
                  />
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className={styles.confirmWrap}>
            <p className={styles.confirmTitle}>Revise as pessoas que serão cadastradas:</p>
            <div className={styles.confirmList}>
              {[titular, ...dependentes].map((p, i) => (
                <div key={i} className={styles.confirmCard}>
                  <div className={styles.confirmAvatar}>{(p.nome || '?')[0].toUpperCase()}</div>
                  <div className={styles.confirmInfo}>
                    <div className={styles.confirmName}>{p.nome || '—'}</div>
                    <div className={styles.confirmMeta}>
                      {maskCPF(p.cpf)} · {p.dataNascimento instanceof Date ? p.dataNascimento.toLocaleDateString('pt-BR') : '—'}
                    </div>
                  </div>
                  <span className={i === 0 ? styles.confirmBadgeTitular : styles.confirmBadgeDep}>
                    {i === 0 ? 'Titular' : 'Dependente'}
                  </span>
                </div>
              ))}
            </div>
            {linkEmpresa && (
              <div className={styles.confirmEmpresa}>
                <Building2 size={13} className={styles.iconViolet} />
                <span>Vinculado à empresa: <strong>{empresaNome(linkEmpresa)}</strong></span>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* ══ MODAL: ADICIONAR / EDITAR EMPRESA ════════════════ */}
      <Modal
        open={showAddEmpresa}
        onClose={() => { setShowAddEmpresa(false); setEditMode(false); }}
        size="lg"
        title={editMode ? 'Editar Empresa' : 'Nova Empresa'}
        footer={
          <div className={styles.modalFooter}>
            <Button onClick={() => { setShowAddEmpresa(false); setEditMode(false); }}>Cancelar</Button>
            <Button variant="primary" onClick={handleSaveEmpresa} disabled={isSubmitting}>
              {isSubmitting ? <><Loader2 size={13} className={styles.spinInline} /> Salvando...</> : 'Salvar'}
            </Button>
          </div>
        }>
        <EmpresaForm data={empresa} onChange={setEmpresa} onFetchCNPJ={fetchCNPJ} onFetchCEP={fetchCEP} editMode={editMode} />
      </Modal>

      <Notification notification={notification} />
    </div>
  );
}
