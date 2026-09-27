import { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  Search, Plus, User, Building2, Car,
  Loader2, AlertCircle, Calendar,
  Users, Trash2, CheckCircle2, XCircle,
  AlertTriangle, Camera, ChevronLeft, ChevronRight as ChevRight,
  X, Contact, MapPin, CalendarDays, BedDouble,
  Check, LayoutDashboard, UserPlus, Pencil,
} from 'lucide-react';

import { Button }                   from '../../components/ui/Button';
import { Modal }                    from '../../components/ui/Modal';
import { Input, Select, FormField } from '../../components/ui/Input';
import { Notification }             from '../../components/ui/Notification';
import { cadastroApi, userStorage } from '../../services/api';
import { usePermissions }           from '../../hooks/usePermissions';
import iconWhatsapp from '../../assets/whatsapp.png';
import iconGmail    from '../../assets/gmail.png';
// MOCK — campos que o back-end ainda não devolve. Ver registersMocks.js.
import {
  mockCategoria, mockResumoHospede, mockVinculoEmpresa, mockHistorico,
} from './registersMocks';

import styles from './RegistersPage.module.css';

// ── Listas de veículos ────────────────────────────────────────
const TIPOS_VEICULO = [
  'Carro','Moto','Pickup','SUV','Van','Caminhão','Ônibus','Microônibus','Quadriciclo','Trator',
];

const MARCAS_POR_TIPO = {
  'Carro':       ['Fiat','Volkswagen','Chevrolet','Toyota','Hyundai','Honda','Jeep','Renault','Nissan','Ford','Peugeot','Citroën','BMW','Mercedes-Benz','Audi','Kia','Volvo','Subaru','Mazda','Mitsubishi','Suzuki','Land Rover','Jaguar','Porsche','Tesla','BYD','Chery','Troller','Alfa Romeo','Dodge'],
  'Moto':        ['Honda','Yamaha','Suzuki','Kawasaki','BMW','Ducati','Harley-Davidson','Royal Enfield','Triumph','KTM','Dafra','Shineray','Haojue','Kasinski','Hero'],
  'Pickup':      ['Fiat','Chevrolet','Ford','Toyota','Volkswagen','Renault','Nissan','Mitsubishi','Dodge','Ram','Mercedes-Benz'],
  'SUV':         ['Toyota','Hyundai','Jeep','Honda','Kia','BMW','Mercedes-Benz','Audi','Volvo','Land Rover','Ford','Chevrolet','Nissan','Renault','Mitsubishi','BYD','Peugeot','Citroën'],
  'Van':         ['Mercedes-Benz','Renault','Volkswagen','Ford','Fiat','Peugeot','Citroën','Toyota','Iveco'],
  'Caminhão':    ['Mercedes-Benz','Volvo','Scania','MAN','DAF','Iveco','Ford','Volkswagen','Renault','Agrale'],
  'Ônibus':      ['Mercedes-Benz','Volvo','Scania','MAN','Agrale'],
  'Microônibus': ['Mercedes-Benz','Volkswagen','Agrale','Iveco','Fiat'],
  'Quadriciclo': ['Honda','Yamaha','Kawasaki','Polaris','Can-Am','CF Moto'],
  'Trator':      ['John Deere','Massey Ferguson','New Holland','Valtra','Case','Agrale'],
};

const CORES_VEICULO = [
  'Branco','Preto','Prata','Cinza','Vermelho','Azul','Bege','Marrom','Verde',
  'Amarelo','Laranja','Vinho','Roxo','Dourado','Rosa',
];

const slugVeiculo = v => (v ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase().replace(/\s+/g, '-');
const byFileSlug  = mods => Object.fromEntries(
  Object.entries(mods).map(([path, url]) => [path.split('/').pop().replace(/\.\w+$/, ''), url]),
);
const LOGOS_MARCA = byFileSlug(import.meta.glob('../../assets/veiculos/marcas/*.{png,svg}', { eager: true, import: 'default' }));
const IMGS_TIPO   = byFileSlug(import.meta.glob('../../assets/veiculos/tipos/*.png', { eager: true, import: 'default' }));
const tipoCanon   = t => TIPOS_VEICULO.find(x => slugVeiculo(x) === slugVeiculo(t)) ?? '';
const tipoEnum    = t => slugVeiculo(tipoCanon(t)).replace(/-/g, '').toUpperCase() || null;
const codigoCor   = c => { const i = CORES_VEICULO.findIndex(x => slugVeiculo(x) === slugVeiculo(c)); return i < 0 ? null : i + 1; };
const imgTipo     = (t, cod) => { const k = (tipoEnum(t) ?? 'CARRO').toLowerCase(); return IMGS_TIPO[cod ? `${k}-${cod}` : k] ?? IMGS_TIPO[k] ?? IMGS_TIPO.carro; };

// ── SearchableCombobox ────────────────────────────────────────
function SearchableCombobox({ value, onChange, options, placeholder, hasError = false }) {
  const [open, setOpen]   = useState(false);
  const [query, setQuery] = useState('');
  const [rect,  setRect]  = useState(null);
  const ref               = useRef(null);

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const filtered = query
    ? options.filter(o => o.toLowerCase().includes(query.toLowerCase()))
    : options;

  const handleInput = (e) => {
    setQuery(e.target.value);
    onChange(e.target.value);
    setRect(ref.current?.getBoundingClientRect());
    setOpen(true);
  };

  const handleSelect = (opt) => {
    onChange(opt);
    setQuery('');
    setOpen(false);
  };

  const handleFocus = () => {
    setQuery('');
    setRect(ref.current?.getBoundingClientRect());
    setOpen(true);
  };

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <input
        className={[styles.comboInput, hasError ? styles.inputErr : ''].join(' ')}
        value={open ? query : value}
        onChange={handleInput}
        onFocus={handleFocus}
        placeholder={placeholder}
        autoComplete="off"
      />
      {open && filtered.length > 0 && rect && createPortal(
        <div className={styles.comboDropdown} style={{
          position: 'fixed',
          top:  rect.bottom + 4,
          left: rect.left,
          width: rect.width,
          zIndex: 9999,
        }}>
          {filtered.map(opt => (
            <button key={opt} type="button" className={styles.comboItem}
              onMouseDown={() => handleSelect(opt)}>
              {opt}
            </button>
          ))}
        </div>,
        document.body
      )}
    </div>
  );
}

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
const maskDate  = v => {
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
  if (d.getDate() !== dd || d.getMonth() !== mm - 1) return null;   // 31/02 e afins
  const hoje = new Date(); hoje.setHours(0,0,0,0);
  if (d > hoje) return null;
  return d;
};
const fmtDateBR = d => (d instanceof Date && !isNaN(d) ? d.toLocaleDateString('pt-BR') : '');
const maskPlaca = v => v.replace(/[^A-Za-z0-9]/g,'').slice(0,7).toUpperCase();
const unmask    = v => (v ?? '').replace(/\D/g,'');

const up         = v => (v ?? '').toUpperCase().trim();
const cleanPlaca = v => (v ?? '').replace(/[^A-Za-z0-9]/g,'').toUpperCase();
// ABC1234 → ABC-1234 · ABC1D23 → ABC-1D23
const fmtPlaca   = v => { const c = cleanPlaca(v); return c.length > 3 ? `${c.slice(0, 3)}-${c.slice(3)}` : c; };

// ── Avatar helpers ────────────────────────────────────────────
// Círculo sólido com as iniciais em branco, no ciclo de cores das faixas do
// calendário (bg-bar-*). A cor vem da posição na lista, como no protótipo.
const AVATAR_TONES = ['avTeal', 'avAmber', 'avCoral', 'avIndigo', 'avSky', 'avEmerald'];
const avatarTone = (i) => styles[AVATAR_TONES[((i % AVATAR_TONES.length) + AVATAR_TONES.length) % AVATAR_TONES.length]];

const getInitials = (name) => {
  if (!name) return '?';
  const words = (name ?? '').trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '?';
  if (words.length === 1) return words[0][0].toUpperCase();
  return (words[0][0] + words[words.length - 1][0]).toUpperCase();
};

// ── Formatadores do painel de detalhe ─────────────────────────
const fmtBRL = (v) =>
  (Number(v) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const MESES_CURTOS = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];

/** Normaliza a data de registro (ISO ou dd/MM/yyyy, com ou sem hora) para yyyy-MM-dd. */
const toISODate = (reg) => {
  if (!reg) return '';
  const s = String(reg);
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  if (/^\d{2}\/\d{2}\/\d{4}/.test(s)) {
    const [d, m, y] = s.slice(0, 10).split('/');
    return `${y}-${m}-${d}`;
  }
  return '';
};

/** "2021-04-18" → "18 Abr 2021" */
const fmtDataExtensa = (reg) => {
  const iso = toISODate(reg);
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return `${Number(d)} ${MESES_CURTOS[Number(m) - 1] ?? ''} ${y}`;
};

/** Cadastrado hoje — usado para o selo "Novo" na lista. */
const isNovo = (item) => {
  const t = new Date();
  const hoje = `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
  return toISODate(item?.data_hora_registro) === hoje;
};

/** "BRASIL" → "Brasileira"; outros países ficam com o próprio nome capitalizado. */
const nacionalidade = (pais) => {
  const p = (pais ?? '').trim();
  if (!p) return '';
  if (/^brasil$/i.test(p)) return 'Brasileira';
  return p.charAt(0).toUpperCase() + p.slice(1).toLowerCase();
};

const sexoLabel = (sexo) =>
  Number(sexo) === 1 ? 'Masculino' : Number(sexo) === 2 ? 'Feminino' : sexo ? 'Outro' : '';

const catTomClass = (tom) => ({
  ouro:   styles.catOuro,
  prata:  styles.catPrata,
  bronze: styles.catBronze,
}[tom] ?? styles.catRegular);

// ── Smart search ──────────────────────────────────────────────
const buildSearchParams = raw => {
  const stripped = raw.replace(/[\s.,\-\/]/g,'').toUpperCase();
  if (!stripped) return {};
  if (/^[A-Z]{3}\d{4}$/.test(stripped) || /^[A-Z]{3}\d[A-Z]\d{2}$/.test(stripped)) return { placa: stripped };
  if (/^\d+$/.test(stripped)) {
    if (stripped.length === 11) return { termo: stripped };
    if (stripped.length === 14) return { cnpj: stripped };
    return { termo: stripped };
  }
  return { termo: raw.trim().toUpperCase() };
};

const buildPessoaBody = (p, overrides = {}) => {
  const currentUser = userStorage.get();
  const titularId = p.titularId ?? p.titular?.id ?? null;
  // Backend espera dd/MM/yyyy
  const toApiDate = d => {
    if (!d) return '';
    if (d instanceof Date) {
      const dd = String(d.getDate()).padStart(2, '0');
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      return `${dd}/${mm}/${d.getFullYear()}`;
    }
    // já em dd/MM/yyyy
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(d)) return d;
    // yyyy-MM-dd → converte
    if (/^\d{4}-\d{2}-\d{2}$/.test(d)) {
      const [y, m, day] = d.split('-');
      return `${day}/${m}/${y}`;
    }
    return d;
  };
  const rawNasc = toApiDate(p.dataNascimento ?? p.data_nascimento);
  const veiculos = (p.veiculos ?? p.veiculos_vinculados ?? []).map(v => ({
    ...(v.id ? { id: v.id } : {}),
    tipo: tipoEnum(v.tipo),
    codigo_cor: codigoCor(v.cor),
    modelo: up(v.modelo ?? ''), marca: up(v.marca ?? ''),
    ano: Number(v.ano) || 0,
    placa: cleanPlaca(v.placa),
    cor: up(v.cor ?? ''),
  }));
  return {
    nome:            up(p.nome).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' '),
    data_nascimento: rawNasc,
    cpf:             unmask(p.cpf),
    rg:              up(p.rg),
    email:           (p.email ?? '').trim() || null,
    profissao:       up(p.profissao),
    telefone:        unmask(p.telefone),
    pais:            up(p.pais) || 'BRASIL',
    estado:          up(p.estado),
    municipio:       up(p.municipio),
    endereco:        up(p.endereco),
    complemento:     up(p.complemento),
    cep:             unmask(p.cep),
    bairro:          up(p.bairro),
    sexo:            Number(p.sexo) || 1,
    // TODO parentesco: a coluna ainda não existe no back-end. Quando existir,
    // descomentar — o valor já é preenchido no formulário do dependente.
    // parentesco:   p.parentesco || null,
    numero:          up(p.numero),
    status:          p.status ?? 'ATIVO',
    titular:         titularId ? { id: titularId } : null,
    empresas:        (p.empresasVinculadas ?? p.empresas_vinculadas ?? []).map(e => ({ id: e.id })),
    veiculos,
    veiculos_vinculados: veiculos,
    funcionario:     { id: currentUser?.id },
    ...overrides,
  };
};

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

/**
 * Parentesco do dependente com o titular. Campo opcional e, por enquanto, só
 * do front: o back-end ainda não tem a coluna, então buildPessoaBody não
 * manda esse valor (ver o TODO lá).
 */
const PARENTESCO_OPTS = [
  { value: '',          label: 'Selecione'              },
  { value: 'CONJUGE',   label: 'Cônjuge / Companheiro'  },
  { value: 'FILHO',     label: 'Filho(a)'               },
  { value: 'ENTEADO',   label: 'Enteado(a)'             },
  { value: 'PAI_MAE',   label: 'Pai / Mãe'              },
  { value: 'IRMAO',     label: 'Irmão / Irmã'           },
  { value: 'AVO',       label: 'Avô / Avó'              },
  { value: 'NETO',      label: 'Neto(a)'                },
  { value: 'TIO',       label: 'Tio(a)'                 },
  { value: 'SOBRINHO',  label: 'Sobrinho(a)'            },
  { value: 'PRIMO',     label: 'Primo(a)'               },
  { value: 'AMIGO',     label: 'Amigo(a)'               },
  { value: 'OUTRO',     label: 'Outro'                  },
];
const parentescoLabel = (v) => PARENTESCO_OPTS.find(o => o.value === v && o.value)?.label ?? '—';

const blankVeiculo = () => ({ tipo:'', modelo:'', marca:'', ano:'', placa:'', cor:'' });

/** "Honda Civic" / "Civic" — o que aparece na linha da lista de veículos. */
const veiculoLabel = (v) => [v.marca, v.modelo].filter(Boolean).join(' ') || 'Veículo';
/** "2024 · Preto" — os dados secundários da mesma linha. */
const veiculoSub = (v) => [v.ano, v.cor].filter(Boolean).join(' · ');

/** "12/03/1990" a partir do que o formulário guarda (Date ou string). */
const nascLabel = (d) => (d instanceof Date ? d.toLocaleDateString('pt-BR') : (d || '—'));

/**
 * Dependente marcado como "usar os dados do titular" só preencheu nome, CPF e
 * nascimento; contato e endereço vêm do titular na hora de salvar.
 */
const comDadosDoTitular = (dep, titular) => {
  if (dep.usarDadosTitular === false) return dep;
  const { telefone, email, cep, pais, estado, municipio, bairro, endereco, numero, complemento } = titular;
  return { ...dep, telefone, email, cep, pais, estado, municipio, bairro, endereco, numero, complemento };
};
const blankPessoa  = () => ({
  nome:'', dataNascimento: null, cpf:'', rg:'', email:'', profissao:'',
  telefone:'', sexo:'', pais:'Brasil', estado:'', municipio:'',
  endereco:'', complemento:'', cep:'', bairro:'', numero:'',
  veiculos:[], status:'ATIVO', titularId: null, empresasVinculadas: [],
  parentesco:'',
});
const blankEmpresa = () => ({
  cnpj:'', razaoSocial:'', nomeFantasia:'', telefone:'', email:'',
  cep:'', endereco:'', bairro:'', complemento:'', numero:'',
  pais:'Brasil', estado:'', municipio:'', tipoEmpresa: 'CLIENTE',
});

// ── Utilitários visuais ───────────────────────────────────────
// size-10 → 12px; size-14 → 16px; size-9 (dependentes) → 12px, em cinza.
function AvatarCircle({ name, size = 40, tone = 0, muted = false, fontSize }) {
  return (
    <span
      className={[styles.avatar, muted ? styles.avatarMuted : avatarTone(tone)].join(' ')}
      style={{ width: size, height: size, fontSize: fontSize ?? (size >= 56 ? 16 : 12) }}
    >
      {getInitials(name)}
    </span>
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

// ── Esqueletos de carregamento ────────────────────────────────
// Ocupam a forma do conteúdo que vem a seguir, em vez de um spinner solto.
const sk = (...extra) => [styles.sk, ...extra].join(' ');

function SkeletonLista({ linhas = 7 }) {
  return (
    <div role="status" aria-label="Carregando cadastros">
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
    <div role="status" aria-label="Carregando totais">
      <span className={sk(styles.skBarra)} style={{ marginBottom: 16 }} aria-hidden="true" />
      <div className={styles.statLine} aria-hidden="true">
        {Array.from({ length: 4 }, (_, i) => (
          <span key={i} className={styles.statItem}>
            <span className={sk(styles.skLabel)} style={{ width: 70 }} />
            <span className={sk(styles.skNumero)} style={{ width: 34 }} />
          </span>
        ))}
      </div>
    </div>
  );
}

function SkeletonVinculo({ linhas = 3 }) {
  return (
    <div role="status" aria-label="Buscando">
      {Array.from({ length: linhas }, (_, i) => (
        <div key={i} className={styles.linkDropdownItem} aria-hidden="true">
          <span className={sk(styles.skAvatarXs)} />
          <span className={sk(styles.skName)} style={{ width: `${44 + ((i * 19) % 28)}%` }} />
          <span className={sk(styles.skDoc)} />
        </div>
      ))}
    </div>
  );
}

// ── Atalhos de contato (ícones do próprio projeto, em src/assets) ──
// O valor inteiro (ícone + texto) é o clique. Sem fundo em repouso; ao passar o
// mouse ganha uma sombra leve, para ficar claro que dá para acionar.
function ContatoBotao({ tipo, href, title, children }) {
  return (
    <a href={href} title={title} className={styles.contatoBtn}
      {...(tipo === 'whatsapp' ? { target: '_blank', rel: 'noreferrer' } : {})}>
      <img src={tipo === 'whatsapp' ? iconWhatsapp : iconGmail} alt="" className={styles.quickIcon} />
      <span className={styles.contatoTexto}>{children}</span>
    </a>
  );
}

// ── Placa Mercosul em miniatura ───────────────────────────────
function PlacaMercosul({ placa }) {
  const txt = fmtPlaca(placa);
  if (!txt) return <span className={styles.vMeta}>—</span>;
  return (
    <span className={styles.placa} aria-label={`Placa ${txt}`}>
      <span className={styles.placaBand}>
        <span className={styles.placaMerco} aria-hidden="true" />
        <span className={styles.placaPais}>BRASIL</span>
        <svg className={styles.placaFlag} viewBox="0 0 20 14" aria-hidden="true">
          <rect width="20" height="14" fill="#009b3a" />
          <path d="M10 1.6 18.2 7 10 12.4 1.8 7z" fill="#fedf00" />
          <circle cx="10" cy="7" r="3.1" fill="#002776" />
        </svg>
      </span>
      <span className={styles.placaNum}>{txt}</span>
    </span>
  );
}

// ── Campo rótulo/valor do painel de detalhe ───────────────────
function Field({ label, value, mono = false }) {
  return (
    <div>
      <p className={styles.fLabel}>{label}</p>
      <p className={[styles.fVal, mono ? styles.fMono : ''].join(' ')}>
        {value || '—'}
      </p>
    </div>
  );
}

// ── Cartão do histórico de hospedagem ─────────────────────────
function HistoricoCard({ registros, resumo }) {
  return (
    <section className={styles.dCard}>
      <h3 className={styles.dCardHead}>
        <CalendarDays size={16} />
        <span className={styles.dCardTitle}>Histórico de hospedagem</span>
      </h3>
      <div className={styles.dCardBody}>
        {/* MOCK — totais desta pessoa, antes da listagem */}
        <div className={styles.miniStats}>
          <div className={styles.statCard}>
            <p className={styles.statLabel}>Hospedagens</p>
            <p className={styles.statVal}>{resumo.hospedagens}</p>
          </div>
          <div className={styles.statCard}>
            <p className={styles.statLabel}>Diárias</p>
            <p className={styles.statVal}>{resumo.diarias}</p>
          </div>
          <div className={styles.statCard}>
            <p className={styles.statLabel}>Valor total investido</p>
            <p className={styles.statVal}>{fmtBRL(resumo.totalGasto)}</p>
          </div>
        </div>

        {registros.length === 0 ? (
          <div className={styles.empty}>
            <CalendarDays size={26} opacity={0.2} /><span>Nenhuma hospedagem registrada.</span>
          </div>
        ) : (
          <div className={styles.hScroll}>
            <table className={styles.hTable}>
              <thead><tr>
                <th>Quarto</th><th>Check-in</th><th>Check-out</th>
                <th>Diárias</th><th>Total</th><th>Status</th>
              </tr></thead>
              <tbody>
                {registros.map(h => (
                  <tr key={h.id}>
                    <td><span className={styles.hQuarto}><BedDouble size={16} /> {h.quarto}</span></td>
                    <td>{h.checkin}</td>
                    <td>{h.checkout}</td>
                    <td>{h.diarias}</td>
                    <td className={styles.hTotal}>{fmtBRL(h.total)}</td>
                    <td>
                      <span className={[
                        styles.hStatus,
                        h.status === 'Em andamento' ? styles.hStatusAtiva : styles.hStatusFinalizada,
                      ].join(' ')}>{h.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}

// ── Campo de data só com máscara (dd/mm/aaaa), sem calendário ──
function DateMaskInput({ value, onChange, className = '' }) {
  const [text, setText] = useState(() => fmtDateBR(value));

  // Sincroniza quando o valor vem de fora (troca de pessoa, carregar cadastro…)
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
        placeholder="dd/mm/aaaa"
        inputMode="numeric"
        maxLength={10}
        className={className}
      />
      {invalida && <span className={styles.cpfMsg} style={{ color:'#ef4444' }}>Data inválida</span>}
    </>
  );
}

// ── Formulário de pessoa ──────────────────────────────────────
/**
 * `mostrarVeiculos` desliga a seção de veículos. No cadastro novo ela só
 * aparece quando a caixa "Possui veículo" está marcada; na edição segue
 * sempre visível.
 */
function PessoaForm({ data, onChange, onFetchCEP, onCheckCPF, showErrors = false, titular = null, mostrarVeiculos = true }) {
  const [cepLoading, setCepLoading] = useState(false);
  const [cpfStatus,  setCpfStatus]  = useState(null);
  const [useTitularTel,  setUseTitularTel]  = useState(false);
  const [useTitularEmail, setUseTitularEmail] = useState(false);
  const [useTitularEnd,  setUseTitularEnd]  = useState(false);

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

  const toggleTitularTel = (checked) => {
    setUseTitularTel(checked);
    if (checked && titular?.telefone) set('telefone', titular.telefone);
  };
  const toggleTitularEmail = (checked) => {
    setUseTitularEmail(checked);
    if (checked && titular?.email) set('email', titular.email);
  };
  const toggleTitularEnd = (checked) => {
    setUseTitularEnd(checked);
    if (checked && titular) {
      onChange(prev => ({
        ...prev,
        cep: titular.cep ?? prev.cep,
        endereco: titular.endereco ?? prev.endereco,
        bairro: titular.bairro ?? prev.bairro,
        municipio: titular.municipio ?? prev.municipio,
        estado: titular.estado ?? prev.estado,
        pais: titular.pais ?? prev.pais,
        numero: titular.numero ?? prev.numero,
        complemento: titular.complemento ?? prev.complemento,
      }));
    }
  };

  // Veículo entra por um editor: "+ Veículo" abre os campos e só o "Confirmar"
  // joga o veículo na lista. O rascunho fica em data.veiculoEdit — no mesmo
  // objeto da pessoa, para quem salva poder ver que há edição aberta;
  // buildPessoaBody monta o corpo campo a campo, então essa chave não vaza
  // para a API. { index: null } = veículo novo; index n = editando o n-ésimo.
  const veiculosEndRef = useRef(null);
  const vEdit  = data.veiculoEdit ?? null;
  const [vErr, setVErr] = useState(false);

  const abrirVeiculo = (i = null) => {
    setVErr(false);
    set('veiculoEdit', { index: i, value: i == null ? blankVeiculo() : { ...(data.veiculos ?? [])[i] } });
    setTimeout(() => veiculosEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 50);
  };
  const setVeiculo = (field, val) =>
    onChange(p => ({ ...p, veiculoEdit: { ...p.veiculoEdit, value: { ...p.veiculoEdit.value, [field]: val } } }));
  const cancelarVeiculo = () => { setVErr(false); set('veiculoEdit', null); };
  const confirmarVeiculo = () => {
    const v = vEdit.value;
    if (!v.modelo || !v.marca || !cleanPlaca(v.placa)) { setVErr(true); return; }
    onChange(p => ({
      ...p,
      veiculos: vEdit.index == null
        ? [...(p.veiculos ?? []), v]
        : (p.veiculos ?? []).map((x, k) => (k === vEdit.index ? v : x)),
      veiculoEdit: null,
    }));
    setVErr(false);
  };
  const removeVeiculo = (i) => onChange(p => ({
    ...p,
    veiculos: (p.veiculos ?? []).filter((_, k) => k !== i),
    // editando justamente esse: o editor fecha junto
    veiculoEdit: p.veiculoEdit?.index === i ? null : p.veiculoEdit,
  }));

  // A caixa "Possui veículo" acabou de ser marcada e não há nenhum na lista:
  // o editor já abre, para a seção não nascer vazia. Só no momento em que a
  // caixa muda — na edição de um hóspede a seção começa fechada.
  const veicAntes = useRef(mostrarVeiculos);
  useEffect(() => {
    if (mostrarVeiculos && !veicAntes.current && (data.veiculos?.length ?? 0) === 0) abrirVeiculo();
    if (!mostrarVeiculos && data.veiculoEdit) set('veiculoEdit', null);
    veicAntes.current = mostrarVeiculos;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mostrarVeiculos]);

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

      {/* ── Dados Pessoais ── */}
      {/*<div className={styles.sectionDivider}><User size={12} /> Dados Pessoais</div>*/}

      {/* Foto + campos principais */}
      <div className={styles.photoHeaderRow}>
        <div className={styles.photoSide}>
          <div className={styles.photoBig}>
            <Camera size={32} className={styles.photoIconBig} />
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

        <div className={styles.photoRightCol}>
          <div className={styles.photoFields}>
            {/* Row 1: CPF | Nome | Data de Nascimento */}
            <div className={styles.cpfBlock}>
              <label className={[styles.fieldLabel, hasErr('cpf') && !cpfStatus ? styles.labelErr : ''].join(' ')}>
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

            <div className={[styles.reqField, hasErr('dataNascimento') ? styles.reqFieldErr : ''].join(' ')} style={{ width: 150 }}>
              <FormField label="Data de Nascimento *">
                <DateMaskInput
                  value={data.dataNascimento}
                  onChange={d => set('dataNascimento', d)}
                />
              </FormField>
            </div>
          </div>

          {/* Row 2: Telefone | Sexo | RG */}
          <div className={styles.grid3}>
            <div className={[styles.reqField, hasErr('telefone') ? styles.reqFieldErr : ''].join(' ')}>
              <FormField label="Telefone *">
                <Input value={data.telefone} onChange={e => set('telefone', maskPhone(e.target.value))} placeholder="(00) 00000-0000" disabled={useTitularTel} />
              </FormField>
              {titular && (
                <label className={styles.useTitularRow}>
                  <input type="checkbox" checked={useTitularTel} onChange={e => toggleTitularTel(e.target.checked)} />
                  <span>Usar do titular</span>
                </label>
              )}
            </div>
            <FormField label="Sexo">
              <Select value={data.sexo} onChange={e => set('sexo', e.target.value)}>
                {SEXO_OPTS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </Select>
            </FormField>
            <FormField label="RG">
              <Input value={data.rg} onChange={e => set('rg', e.target.value)} placeholder="RG" />
            </FormField>
          </div>

        </div>
      </div>

      <div className={styles.grid2}>
        <div>
          <FormField label="Email">
            <Input type="email" value={data.email} onChange={e => set('email', e.target.value)} placeholder="email@exemplo.com" disabled={useTitularEmail} />
          </FormField>
          {titular && (
            <label className={styles.useTitularRow}>
              <input type="checkbox" checked={useTitularEmail} onChange={e => toggleTitularEmail(e.target.checked)} />
              <span>Usar do titular</span>
            </label>
          )}
        </div>
        <FormField label="Profissão">
          <Input value={data.profissao ?? ''} onChange={e => set('profissao', e.target.value)} placeholder="Ex: Engenheiro" />
        </FormField>
      </div>

      {/* ── Endereço (sem título separador) ── */}
      {/* o endereço não tem título próprio, então um respiro marca a virada */}
      <div className={styles.formGap} aria-hidden="true" />
      {titular && (
        <div className={styles.sectionDividerRow}>
          <label className={styles.useTitularRow} style={{ marginBottom: 0 }}>
            <input type="checkbox" checked={useTitularEnd} onChange={e => toggleTitularEnd(e.target.checked)} />
            <span>Usar endereço do titular</span>
          </label>
        </div>
      )}

      <div className={styles.grid3}>
        <div className={[styles.reqField, hasErr('cep') ? styles.reqFieldErr : ''].join(' ')}>
          <label className={[styles.fieldLabel, hasErr('cep') ? styles.labelErr : ''].join(' ')}>CEP *</label>
          <div className={styles.inputWithSpinner}>
            <Input value={data.cep} onChange={e => handleCEP(e.target.value)} placeholder="00000-000"
              className={hasErr('cep') ? styles.inputErr : ''} disabled={useTitularEnd} />
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

      {/* ── Veículos ── */}
      {/* A seção é aberta pela linha divisória; os campos seguem no mesmo
          fluxo do formulário da pessoa, sem caixa em volta. */}
      {mostrarVeiculos && (<>
      <div className={styles.optTitle}><Car size={16} /> Veículos</div>

      {/* os já confirmados, em tabela — mesma leitura do histórico */}
      {(data.veiculos ?? []).length > 0 && (
        <div className={styles.hScroll}>
          <table className={[styles.hTable, styles.optTable].join(' ')}>
            <thead><tr>
              <th>Veículo</th><th>Tipo</th><th>Cor</th><th>Placa</th><th aria-label="Ações" />
            </tr></thead>
            <tbody>
              {data.veiculos.map((v, i) => (
                <tr key={i} className={vEdit?.index === i ? styles.trEditando : ''}>
                  <td><span className={styles.hQuarto}><Car size={15} /> {veiculoLabel(v)}</span></td>
                  <td>{tipoCanon(v.tipo) || '—'}</td>
                  <td>{v.cor || '—'}</td>
                  <td><span className={styles.itemRowPlaca}>{v.placa}</span></td>
                  <td>
                    <span className={styles.tdAcoes}>
                      <button type="button" className={styles.btnEdit} onClick={() => abrirVeiculo(i)}
                        title="Editar veículo"><Pencil size={12} /></button>
                      <button type="button" className={styles.btnRemove} onClick={() => removeVeiculo(i)}
                        title="Remover veículo"><X size={12} /></button>
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* o editor, aberto pelo "+ Veículo" ou pelo lápis de uma linha */}
      {vEdit && (
        <div className={styles.optItem}>
          <div className={styles.optItemHead}>
            {/*<span>{vEdit.index == null ? 'Novo veículo' : `Editando ${veiculoLabel(vEdit.value)}`}</span>*/}
          </div>
          <div className={styles.grid3}>
            <FormField label="Tipo">
              <Select value={tipoCanon(vEdit.value.tipo)}
                onChange={e => onChange(p => ({ ...p, veiculoEdit: { ...p.veiculoEdit, value: { ...p.veiculoEdit.value, tipo: e.target.value, marca: '' } } }))}>
                <option value="">Selecione</option>
                {TIPOS_VEICULO.map(t => <option key={t} value={t}>{t}</option>)}
              </Select>
            </FormField>
            <FormField label="Marca *">
              <SearchableCombobox
                value={vEdit.value.marca}
                onChange={val => setVeiculo('marca', val)}
                options={MARCAS_POR_TIPO[tipoCanon(vEdit.value.tipo)] ?? []}
                placeholder={tipoCanon(vEdit.value.tipo) ? 'Selecione a marca' : 'Selecione o tipo antes'}
                hasError={vErr && !vEdit.value.marca}
              />
            </FormField>
            <FormField label="Modelo *">
              <Input
                value={vEdit.value.modelo}
                onChange={e => setVeiculo('modelo', e.target.value)}
                placeholder="Ex: Civic"
                className={vErr && !vEdit.value.modelo ? styles.inputErr : ''}
              />
            </FormField>
          </div>
          <div className={styles.grid2}>
            <FormField label="Placa *">
              <Input
                value={vEdit.value.placa}
                onChange={e => setVeiculo('placa', maskPlaca(e.target.value))}
                placeholder="AAA0A00"
                className={vErr && !cleanPlaca(vEdit.value.placa) ? styles.inputErr : ''}
              />
            </FormField>
            <FormField label="Cor">
              <SearchableCombobox value={vEdit.value.cor} onChange={val => setVeiculo('cor', val)} options={CORES_VEICULO} placeholder="Ex: Preto" />
            </FormField>
          </div>
          <div className={styles.editorFoot}>
            <button type="button" className={styles.optAdd} onClick={confirmarVeiculo}>
              <Check size={13} /> Confirmar veículo
            </button>
            <button type="button" className={styles.btnGhost} onClick={cancelarVeiculo}>Cancelar</button>
          </div>
        </div>
      )}

      {!vEdit && (
        <button type="button" className={styles.optAdd} onClick={() => abrirVeiculo()}>
          <Plus size={13} /> Veículo
        </button>
      )}
      <div ref={veiculosEndRef} />
      </>)}
    </div>
  );
}

/**
 * Dependente. Por padrão herda contato e endereço do titular, então só pede
 * nome, CPF e nascimento. Desmarcando "usar os dados do titular" o formulário
 * completo aparece no lugar.
 */
function DependenteForm({ data, onChange, titular, index, onFetchCEP, onCheckCPF, showErrors = false }) {
  const usarTitular = data.usarDadosTitular !== false;
  const set     = (field, val) => onChange(prev => ({ ...prev, [field]: val }));
  const hasErr  = field => showErrors && !data[field];
  const cpfRaw  = unmask(data.cpf ?? '');
  const cpfRuim = cpfRaw.length === 11 && !validarCPF(cpfRaw);

  return (
    <div className={styles.optItem}>
      <div className={styles.optItemHead}>
        <span>{index == null ? 'Novo dependente' : `Editando dependente ${index + 1}`}</span>
        <label className={styles.useTitularRow} style={{ marginBottom: 0, marginLeft: 'auto' }}>
          <input
            type="checkbox"
            checked={usarTitular}
            onChange={e => set('usarDadosTitular', e.target.checked)}
          />
          <span>Usar os dados do titular</span>
        </label>
      </div>

      {usarTitular ? (
        <div className={styles.grid3}>
          <div className={[styles.reqField, hasErr('cpf') ? styles.reqFieldErr : ''].join(' ')}>
            <FormField label="CPF *">
              <Input
                value={data.cpf}
                onChange={e => set('cpf', maskCPF(e.target.value))}
                placeholder="000.000.000-00"
                className={cpfRuim ? styles.inputErr : ''}
              />
            </FormField>
            {cpfRuim && <span className={styles.cpfMsg} style={{ color: '#ef4444' }}>CPF inválido</span>}
          </div>
          <div className={[styles.reqField, hasErr('nome') ? styles.reqFieldErr : ''].join(' ')}>
            <FormField label="Nome completo *">
              <Input value={data.nome} onChange={e => set('nome', e.target.value)} placeholder="Nome completo" />
            </FormField>
          </div>
          <div className={[styles.reqField, hasErr('dataNascimento') ? styles.reqFieldErr : ''].join(' ')}>
            <FormField label="Data de Nascimento *">
              <DateMaskInput value={data.dataNascimento} onChange={d => set('dataNascimento', d)} />
            </FormField>
          </div>
          <FormField label="Sexo">
            <Select value={data.sexo} onChange={e => set('sexo', e.target.value)}>
              {SEXO_OPTS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </Select>
          </FormField>
          <FormField label="Parentesco">
            <Select value={data.parentesco ?? ''} onChange={e => set('parentesco', e.target.value)}>
              {PARENTESCO_OPTS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </Select>
          </FormField>
        </div>
      ) : (
        <>
          {/* o PessoaForm já traz o Sexo; o parentesco é só do dependente */}
          <div className={styles.grid3}>
            <FormField label="Parentesco">
              <Select value={data.parentesco ?? ''} onChange={e => set('parentesco', e.target.value)}>
                {PARENTESCO_OPTS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </Select>
            </FormField>
          </div>
          <PessoaForm
            data={data}
            onChange={onChange}
            onFetchCEP={onFetchCEP}
            onCheckCPF={onCheckCPF}
            showErrors={showErrors}
            titular={titular}
            mostrarVeiculos={false}
          />
        </>
      )}
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
      <div className={styles.sectionDivider}><Building2 size={12} /> Dados Empresariais</div>
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

      <div className={styles.sectionDivider}><Calendar size={12} /> Endereço</div>

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
  const { can } = usePermissions();
  const canCadastrar  = can('CADASTRO', 'CADASTRO');
  const canAtualizar  = can('CADASTRO', 'ATUALIZAR');
  const canBloquear   = can('CADASTRO', 'BLOQUEIO');
  const canHistorico  = can('CADASTRO', 'ACESSO HISTORICO');

  const [items,          setItems]          = useState([]);
  const [loading,        setLoading]        = useState(false);
  const [notification,   setNotification]   = useState(null);
  const [isSubmitting,   setIsSubmitting]   = useState(false);
  const [page,           setPage]           = useState(0);
  const [totalPages,     setTotalPages]     = useState(0);
  const [totalElements,  setTotalElements]  = useState(0);

  const [searchTerm, setSearchTerm] = useState('');
  const [filterMode, setFilterMode] = useState('todos');
  const [ordenacao,  setOrdenacao]  = useState('DATA_CADASTRO');
  const [direcao,    setDirecao]    = useState('DESC');
  const sortRef = useRef({ ordenacao: 'DATA_CADASTRO', direcao: 'DESC' });
  const searchDebounce = useRef(null);

  // modais
  // CPF/CNPJ do que acabou de ser cadastrado — a lista anima essas linhas
  // quando elas chegam no recarregamento. Limpa sozinho depois da animação.
  const [recemCriados, setRecemCriados] = useState(() => new Set());
  const destacarNovos = (docs) => {
    const limpos = docs.map((d) => unmask(d ?? '')).filter(Boolean);
    if (!limpos.length) return;
    setRecemCriados(new Set(limpos));
    setTimeout(() => setRecemCriados(new Set()), 2600);
  };

  // caixas do fim do cadastro de hóspede
  const [temVeiculo,     setTemVeiculo]     = useState(false);
  const [temDependentes, setTemDependentes] = useState(false);
  const [temEmpresa,     setTemEmpresa]     = useState(false);

  // Dependente entra por um editor, como o veículo: "+ Dependente" abre o
  // formulário e só o "Confirmar" joga a pessoa na lista.
  // { index: null } = dependente novo; index n = editando o n-ésimo.
  const [depEdit, setDepEdit] = useState(null);
  const [depErr,  setDepErr]  = useState(false);

  const [showAddPessoa,  setShowAddPessoa]  = useState(false);
  const [showAddEmpresa, setShowAddEmpresa] = useState(false);
  const [showEdit,       setShowEdit]       = useState(false);
  const [detailItem,     setDetailItem]     = useState(null);
  const [detailType,     setDetailType]     = useState('pessoa');
  const [detailTone,     setDetailTone]     = useState(0);

  // menu do botão de filtro (ao lado da busca)
  const [statusMenu,  setStatusMenu]  = useState(false);
  const statusMenuRef = useRef(null);

  // painel geral, exibido enquanto nenhum cadastro está selecionado
  const [stats,        setStats]        = useState(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [editMode,       setEditMode]       = useState(false);

  // forms
  const [titular,     setTitular]     = useState(blankPessoa());
  const [dependentes, setDependentes] = useState([]);
  const [editPessoa,  setEditPessoa]  = useState(blankPessoa());
  const [empresa,     setEmpresa]     = useState(blankEmpresa());

  // validação + prévia no cadastro de hóspede
  const [showErrors,  setShowErrors]  = useState(false);
  const [confirmStep, setConfirmStep] = useState(false);

  // link empresa no cadastro de hóspede
  const [linkSearch,  setLinkSearch]  = useState('');
  const [linkResults, setLinkResults] = useState([]);
  const [linkLoading, setLinkLoading] = useState(false);
  const [linkEmpresa, setLinkEmpresa] = useState(null);
  const linkDebounce = useRef(null);

  // novo hóspede — índice ativo no sidebar (-1 = titular, 0..n = dependentes)

  // vinculados (detalhe empresa)
  const [vinculSearch,  setVinculSearch]  = useState('');
  const [vinculResults, setVinculResults] = useState([]);
  const [vinculLoading, setVinculLoading] = useState(false);
  const vinculDebounce = useRef(null);

  // dependentes search (detalhe pessoa)
  const [depSearch,        setDepSearch]        = useState('');
  const [depSearchResults, setDepSearchResults] = useState([]);
  const [depSearchLoading, setDepSearchLoading] = useState(false);
  const depSearchDebounce = useRef(null);

  // empresa search (detalhe pessoa — aba empresa)
  const [empSearch,        setEmpSearch]        = useState('');
  const [empSearchResults, setEmpSearchResults] = useState([]);
  const [empSearchLoading, setEmpSearchLoading] = useState(false);
  const empSearchDebounce = useRef(null);

  // novo dependente (criar + vincular)
  const [showNewDep,      setShowNewDep]      = useState(false);
  const [showLinkEmpresa, setShowLinkEmpresa] = useState(false);
  const [newDepData,   setNewDepData]   = useState(blankPessoa());
  const [savingNewDep, setSavingNewDep] = useState(false);

  const showNotif = (msg, type = 'success') => {
    setNotification({ message: msg, type });
    setTimeout(() => setNotification(null), 3200);
  };

  const fetchCEP = async (cep, setter) => {
    const raw = unmask(cep);
    if (raw.length !== 8) return;
    const d = await cadastroApi.buscarCEP(raw);
    // O back-end pode devolver estado/municipio/pais como string ("MARANHÃO")
    // ou como objeto ({ descricao: "MARANHÃO" }). Normaliza os dois formatos.
    const desc = v => (v && typeof v === 'object' ? v.descricao : v) || '';
    setter(prev => ({
      ...prev,
      endereco:    d.endereco    || prev.endereco,
      bairro:      d.bairro      || prev.bairro,
      complemento: d.complemento || prev.complemento,
      pais:        desc(d.pais)      || prev.pais,
      estado:      desc(d.estado)    || prev.estado,
      municipio:   desc(d.municipio) || prev.municipio,
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
      const { ordenacao: ord, direcao: dir } = sortRef.current;

      let res;
      if (mode === 'empresas' || sp.cnpj) {
        const params = { ...base };
        if (sp.cnpj)       params.cnpj  = sp.cnpj;
        else if (sp.termo) params.termo = sp.termo;
        res = await cadastroApi.listarEmpresas(params);
        setItems((res?.content ?? []).map(e => ({ ...e, _type: 'empresa' })));
      } else {
        const params = { ...base, ...sp, ordenacao: ord, direcao: dir };
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

  // Totais do painel geral. Cada contagem é um `size: 1` — só o totalElements
  // interessa, então o corpo vem vazio.
  const fetchStats = useCallback(async () => {
    setStatsLoading(true);
    try {
      const [pessoas, hospedados, bloqueados, empresas] = await Promise.all([
        cadastroApi.listarPessoas({ size: 1 }),
        cadastroApi.listarPessoas({ size: 1, status: 'HOSPEDADO' }),
        cadastroApi.listarPessoas({ size: 1, status: 'BLOQUEADO' }),
        cadastroApi.listarEmpresas({ size: 1 }),
      ]);
      setStats({
        pessoas:    pessoas?.totalElements    ?? 0,
        hospedados: hospedados?.totalElements ?? 0,
        bloqueados: bloqueados?.totalElements ?? 0,
        empresas:   empresas?.totalElements   ?? 0,
      });
    } catch {
      setStats(null);
    } finally {
      setStatsLoading(false);
    }
  }, []);

  useEffect(() => { fetchStats(); }, [fetchStats]);

  // Fecha o menu de filtro ao clicar fora ou apertar Esc.
  useEffect(() => {
    if (!statusMenu) return;
    const onDown = e => { if (statusMenuRef.current && !statusMenuRef.current.contains(e.target)) setStatusMenu(false); };
    const onKey  = e => { if (e.key === 'Escape') setStatusMenu(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [statusMenu]);

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
        } catch (e) {
          setLinkResults([]);
          showNotif(e.message || 'Erro ao buscar empresa.', 'error');
        } finally { setLinkLoading(false); }
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

  // Auto-search dependentes
  useEffect(() => {
    clearTimeout(depSearchDebounce.current);
    if (depSearch.length >= 2) {
      depSearchDebounce.current = setTimeout(async () => {
        setDepSearchLoading(true);
        try {
          const res = await cadastroApi.listarPessoas({ termo: depSearch, size: 20 });
          setDepSearchResults(res?.content ?? []);
        } catch {} finally { setDepSearchLoading(false); }
      }, 300);
    } else { setDepSearchResults([]); }
    return () => clearTimeout(depSearchDebounce.current);
  }, [depSearch]);

  // Auto-search empresas (aba empresa do detalhe de pessoa)
  useEffect(() => {
    clearTimeout(empSearchDebounce.current);
    if (empSearch.length >= 2) {
      empSearchDebounce.current = setTimeout(async () => {
        setEmpSearchLoading(true);
        try {
          const res = await cadastroApi.listarEmpresas({ termo: empSearch, size: 20 });
          setEmpSearchResults(res?.content ?? []);
        } catch {} finally { setEmpSearchLoading(false); }
      }, 300);
    } else { setEmpSearchResults([]); }
    return () => clearTimeout(empSearchDebounce.current);
  }, [empSearch]);

  const refreshDetailPessoa = async () => {
    const res = await cadastroApi.listarPessoas({ id: detailItem.id, size: 1 });
    const updated = res?.content?.[0] ?? res;
    if (updated) setDetailItem({ ...updated, _type: 'pessoa' });
    fetchData(searchTerm, filterMode, page);
  };

  const handleSaveNewDep = async () => {
    if (!newDepData.nome || !newDepData.cpf) {
      showNotif('Preencha ao menos nome e CPF do dependente.', 'error'); return;
    }
    setSavingNewDep(true);
    try {
      const res = await cadastroApi.criarPessoa({
        pessoas: [buildPessoaBody(newDepData, { titular: null })],
        empresas: [],
      });
      const novaId = res?.pessoas?.[0]?.id ?? res?.[0]?.id;
      if (novaId) {
        await cadastroApi.vincularTitular({ titular: { id: detailItem.id }, acompanhante: { id: novaId }, vinculo: true });
      }
      showNotif('Dependente cadastrado e vinculado!');
      setShowNewDep(false);
      setNewDepData(blankPessoa());
      await refreshDetailPessoa();
    } catch (e) { showNotif(e.message || 'Erro ao cadastrar dependente.', 'error'); }
    finally { setSavingNewDep(false); }
  };

  const handleVincularDependente = async pessoaId => {
    try {
      await cadastroApi.vincularTitular({ titular: { id: detailItem.id }, acompanhante: { id: pessoaId }, vinculo: true });
      showNotif('Dependente vinculado!');
      setDepSearch(''); setDepSearchResults([]);
      await refreshDetailPessoa();
    } catch (e) { showNotif(e.message || 'Erro ao vincular.', 'error'); }
  };

  const handleDesvincularDependente = async pessoaId => {
    if (!window.confirm('Tem certeza que deseja desvincular este dependente?')) return;
    try {
      await cadastroApi.vincularTitular({ titular: { id: detailItem.id }, acompanhante: { id: pessoaId }, vinculo: false });
      showNotif('Dependente desvinculado!');
      await refreshDetailPessoa();
    } catch (e) { showNotif(e.message || 'Erro ao desvincular.', 'error'); }
  };

  const handleVincularEmpresa = async empresaId => {
    try {
      await cadastroApi.vincularPessoa({ empresa: { id: empresaId }, pessoa: { id: detailItem.id }, ativo: true });
      showNotif('Empresa vinculada!');
      setEmpSearch(''); setEmpSearchResults([]);
      await refreshDetailPessoa();
    } catch (e) { showNotif(e.message || 'Erro ao vincular empresa.', 'error'); }
  };

  const handleDesvincularEmpresa = async empresaId => {
    if (!window.confirm('Tem certeza que deseja desvincular esta empresa?')) return;
    try {
      await cadastroApi.vincularPessoa({ empresa: { id: empresaId }, pessoa: { id: detailItem.id }, ativo: false });
      showNotif('Empresa desvinculada!');
      await refreshDetailPessoa();
    } catch (e) { showNotif(e.message || 'Erro ao desvincular empresa.', 'error'); }
  };

  const changeFilter = mode => {
    // Trocar entre Hóspedes e Empresas muda o tipo listado: o detalhe aberto
    // deixaria de corresponder à lista, então é fechado.
    const eraEmpresas = filterMode === 'empresas';
    if (eraEmpresas !== (mode === 'empresas')) setDetailItem(null);
    setFilterMode(mode); setPage(0); fetchData(searchTerm, mode, 0);
  };
  const goToPage     = pg   => { setPage(pg); fetchData(searchTerm, filterMode, pg); };
  const changeSort   = (ord, dir) => {
    sortRef.current = { ordenacao: ord, direcao: dir };
    setOrdenacao(ord); setDirecao(dir);
    setPage(0); fetchData(searchTerm, filterMode, 0);
  };

  const abrirDependente = (i = null) => {
    setDepErr(false);
    setDepEdit({ index: i, value: i == null ? blankPessoa() : { ...dependentes[i] } });
  };

  const cancelarDependente = () => { setDepEdit(null); setDepErr(false); };

  const setDepEditData = (val) =>
    setDepEdit(prev => ({ ...prev, value: typeof val === 'function' ? val(prev.value) : val }));

  const confirmarDependente = () => {
    const d = depEdit.value;
    const cpfRaw = unmask(d.cpf ?? '');
    if (!d.nome || !d.dataNascimento || !cpfRaw) {
      setDepErr(true);
      showNotif('Preencha CPF, nome e data de nascimento do dependente.', 'error');
      return;
    }
    if (cpfRaw.length !== 11 || !validarCPF(cpfRaw)) {
      setDepErr(true);
      showNotif('CPF do dependente inválido.', 'error');
      return;
    }
    // quem não herda do titular precisa dos próprios contato e endereço
    if (d.usarDadosTitular === false && (!d.telefone || !d.cep)) {
      setDepErr(true);
      showNotif('Preencha telefone e CEP do dependente.', 'error');
      return;
    }
    // o mesmo CPF não pode aparecer duas vezes no cadastro
    const jaUsados = [
      unmask(titular.cpf ?? ''),
      ...dependentes.filter((_, j) => j !== depEdit.index).map(x => unmask(x.cpf ?? '')),
    ].filter(Boolean);
    if (jaUsados.includes(cpfRaw)) {
      showNotif('Esse CPF já está neste cadastro.', 'error');
      return;
    }
    setDependentes(prev => depEdit.index == null
      ? [...prev, d]
      : prev.map((x, j) => (j === depEdit.index ? d : x)));
    setDepEdit(null); setDepErr(false);
  };

  const handleRemoveDependente = i => {
    setDependentes(prev => prev.filter((_, j) => j !== i));
    // editando justamente esse: o editor fecha junto
    setDepEdit(prev => (prev && prev.index === i ? null : prev));
  };

  const handlePreviewPessoa = () => {
    // Um editor aberto guarda dados que ainda não entraram na lista; avançar
    // agora perderia o que foi digitado.
    if (titular.veiculoEdit) {
      showNotif('Confirme ou cancele o veículo em edição.', 'error');
      return;
    }
    if (depEdit) {
      showNotif('Confirme ou cancele o dependente em edição.', 'error');
      return;
    }
    if (!titular.nome || !titular.cpf || !titular.dataNascimento || !titular.telefone || !titular.cep) {
     
      setShowErrors(true);
      showNotif('Preencha os campos obrigatórios do titular (*).', 'error');
      return;
    }
    if ((titular.veiculos ?? []).some(v => !cleanPlaca(v.placa))) {
     
      showNotif('Preencha a placa de todos os veículos do titular.', 'error');
      return;
    }
    for (let i = 0; i < dependentes.length; i++) {
      const dep = dependentes[i];
      if (!dep.nome || !dep.cpf || !dep.dataNascimento) {
        setShowErrors(true);
        showNotif(`Preencha os campos obrigatórios do dependente ${i + 1} (*).`, 'error');
        return;
      }
      // quem não herda do titular precisa dos próprios contato e endereço
      if (dep.usarDadosTitular === false && (!dep.telefone || !dep.cep)) {
        setShowErrors(true);
        showNotif(`Preencha telefone e CEP do dependente ${i + 1} (*).`, 'error');
        return;
      }
      if ((dep.veiculos ?? []).some(v => !cleanPlaca(v.placa))) {

        showNotif(`Preencha a placa dos veículos do dependente ${i + 1}.`, 'error');
        return;
      }
    }
    // CPF duplicado entre titular e dependentes
    const todos = [titular, ...dependentes];
    const cpfs = todos.map(p => unmask(p.cpf)).filter(Boolean);
    const duplicado = cpfs.find((c, idx) => cpfs.indexOf(c) !== idx);
    if (duplicado) {
      const idxs = todos.reduce((acc, p, i) => (unmask(p.cpf) === duplicado ? [...acc, i] : acc), []);
      const nomes = idxs.map(i => i === 0 ? 'Titular' : `Dependente ${i}`).join(' e ');
      showNotif(`CPF duplicado entre ${nomes}.`, 'error');

      return;
    }
    setShowErrors(false);
    setConfirmStep(true);
  };

  const doSavePessoa = async () => {
    setIsSubmitting(true);
    // guardado antes de limpar o formulário, para a lista saber quem destacar
    const cpfsCriados = [titular.cpf, ...dependentes.map((d) => d.cpf)];
    try {
      await cadastroApi.criarPessoa({
        pessoas: [
          buildPessoaBody(titular, { titular: null }),
          ...dependentes.map(d => buildPessoaBody(comDadosDoTitular(d, titular), { titular: null })),
        ],
        empresas: linkEmpresa ? [{ id: linkEmpresa.id }] : [],
      });
      showNotif('Hóspede(s) cadastrado(s) com sucesso!');
      setShowAddPessoa(false);
      setConfirmStep(false); setShowErrors(false);
      setTitular(blankPessoa()); setDependentes([]);
      setLinkEmpresa(null); setLinkSearch(''); setLinkResults([]);
      destacarNovos(cpfsCriados);
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
        email:         (empresa.email ?? '').trim() || null,
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
        await cadastroApi.atualizarEmpresa({ id: detailItem.id, ...body });
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
        destacarNovos([cnpjRaw]);
      }
      setShowAddEmpresa(false); setEmpresa(blankEmpresa()); setEditMode(false);
      fetchData(searchTerm, filterMode, page);
    } catch (e) { showNotif(e.message || 'Erro ao salvar empresa.', 'error'); }
    finally { setIsSubmitting(false); }
  };

  const openEditPessoa = p => {
    if (p.status === 'BLOQUEADO') return;
    // data_nascimento vem da API em dd/mm/yyyy; converte para Date
    const rawNasc = p.data_nascimento ?? p.dataNascimento;
    let dataNasc = null;
    if (rawNasc) {
      if (/^\d{2}\/\d{2}\/\d{4}$/.test(rawNasc)) {
        const [dd, mm, yyyy] = rawNasc.split('/');
        dataNasc = new Date(`${yyyy}-${mm}-${dd}T12:00:00`);
      } else {
        dataNasc = new Date(rawNasc + 'T12:00:00');
      }
    }
    setEditPessoa({
      nome:               p.nome ?? '',
      dataNascimento:     dataNasc,
      cpf:                maskCPF(p.cpf ?? ''),
      rg:                 p.rg ?? '',
      email:              p.email ?? '',
      profissao:          p.profissao ?? '',
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
      empresasVinculadas: p.empresas_vinculadas ?? p.empresasVinculadas ?? [],
      veiculos:           (p.veiculos_vinculados ?? p.veiculos ?? []).map(v => ({
        ...(v.id ? { id: v.id } : {}),
        tipo: tipoCanon(v.tipo),
        modelo: v.modelo ?? '', marca: v.marca ?? '',
        ano: String(v.ano ?? ''), placa: v.placa ?? '', cor: v.cor ?? '',
      })),
    });
    setShowEdit(true);
  };

  const handleSaveEditPessoa = async () => {
    if (editPessoa.veiculoEdit) {
      showNotif('Confirme ou cancele o veículo em edição.', 'error');
      return;
    }
    if ((editPessoa.veiculos ?? []).some(v => !cleanPlaca(v.placa))) {
      showNotif('Preencha a placa de todos os veículos.', 'error');
      return;
    }
    setIsSubmitting(true);
    try {
      await cadastroApi.atualizarPessoa({ id: detailItem.id, ...buildPessoaBody(editPessoa) });
      showNotif('Pessoa atualizada!');
      setShowEdit(false);
      await refreshDetailPessoa();
    } catch (e) { showNotif(e.message || 'Erro ao editar.', 'error'); }
    finally { setIsSubmitting(false); }
  };

  const handleToggleStatus = async () => {
    const novoStatus = detailItem.status === 'BLOQUEADO' ? 'ATIVO' : 'BLOQUEADO';
    setIsSubmitting(true);
    try {
      await cadastroApi.atualizarPessoa({ id: detailItem.id, ...buildPessoaBody(detailItem, { status: novoStatus }) });
      showNotif(`Status alterado para ${novoStatus}!`);
      setDetailItem(prev => ({ ...prev, status: novoStatus }));
      fetchData(searchTerm, filterMode, page);
    } catch (e) { showNotif(e.message || 'Erro ao alterar status.', 'error'); }
    finally { setIsSubmitting(false); }
  };

  // `tone` mantém o avatar do detalhe na mesma cor do item da lista.
  const openDetail = (item, tone = 0) => {
    setDetailItem(item);
    setDetailTone(tone);
    setDetailType(item._type === 'empresa' ? 'empresa' : 'pessoa');
    // limpa as buscas de vínculo do registro anterior
    setVinculSearch(''); setVinculResults([]);
    setEmpSearch('');    setEmpSearchResults([]);
    setDepSearch('');    setDepSearchResults([]);
    setShowLinkEmpresa(false);
  };

  const closeDetail = () => setDetailItem(null);

  const handleVincular = async pessoaId => {
    try {
      const vinculadoIds = (detailItem?.pessoas_vinculadas ?? detailItem?.pessoasVinculadas ?? []).map(p => p.id);
      if (vinculadoIds.includes(pessoaId)) {
        showNotif('Esta pessoa já está vinculada!', 'error');
        return;
      }
      await cadastroApi.vincularPessoa({ empresa: { id: detailItem.id }, pessoa: { id: pessoaId }, ativo: true });
      showNotif('Pessoa vinculada!');
      const res = await cadastroApi.buscarEmpresaPorId(detailItem.id);
      const updated = res?.content?.[0] ?? res;
      setDetailItem({ ...updated, _type: 'empresa' });
      setVinculSearch('');
      setVinculResults([]);
    } catch (e) { showNotif(e.message || 'Erro ao vincular.', 'error'); }
  };

  const handleDesvincular = async pessoaId => {
    if (!window.confirm('Tem certeza que deseja desvincular esta pessoa?')) return;
    try {
      await cadastroApi.vincularPessoa({ empresa: { id: detailItem.id }, pessoa: { id: pessoaId }, ativo: false });
      showNotif('Pessoa desvinculada!');
      const res = await cadastroApi.buscarEmpresaPorId(detailItem.id);
      const updated = res?.content?.[0] ?? res;
      setDetailItem({ ...updated, _type: 'empresa' });
    } catch (e) { showNotif(e.message || 'Erro ao desvincular.', 'error'); }
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
    setEditMode(true); setShowAddEmpresa(true);
  };

  // Status da lista, no botão de filtro ao lado da busca.
  // "Empresas" não entra aqui: virou o alternador do topo.
  const statusFilters = [
    { id: 'todos',      label: 'Todos'      },
    { id: 'hospedados', label: 'Hospedados' },
    { id: 'bloqueados', label: 'Bloqueados' },
  ];
  const isEmpresasTab = filterMode === 'empresas';
  const filtroAtual = statusFilters.find(f => f.id === filterMode) ?? statusFilters[0];

  const vinculadosList   = detailItem?.pessoas_vinculadas ?? detailItem?.pessoasVinculadas ?? [];
  const veiculosList     = detailItem?.veiculos_vinculados ?? detailItem?.veiculos ?? [];
  const empresasList     = detailItem?.empresas_vinculadas ?? detailItem?.empresasVinculadas ?? [];
  const dependentesList  = detailItem?.acompanhantes ?? [];

  const nomeListing = item =>
    item._type === 'empresa'
      ? (item.razaoSocial || item.razao_social || item.nomeFantasia || '—')
      : (item.nome || '—');

  const empresaLabel = e => {
    const razao    = e?.razaoSocial ?? e?.razao_social;
    const fantasia = e?.nomeFantasia ?? e?.nome_fantasia;
    if (razao && fantasia && razao !== fantasia) return `${razao} (${fantasia})`;
    return razao || fantasia || '—';
  };

  const isBloqueado = detailItem?.status === 'BLOQUEADO';

  // Data de cadastro no formato "18 Abr 2021" usado no subtítulo do detalhe.
  const cadastradoEm = fmtDataExtensa(detailItem?.data_hora_registro) || '—';

  // ── Campos que o back-end ainda não devolve. // MOCK ──
  // Derivados do id (valores estáveis, mas fictícios). Ver registersMocks.js.
  const categoria = mockCategoria(detailItem?.id);
  const resumo    = mockResumoHospede(detailItem?.id);
  const historico = mockHistorico(detailItem?.id, { hospedado: detailItem?.status === 'HOSPEDADO' });

  // Qual formulário ocupa o painel. Os estados são os mesmos de quando eram
  // modais — só a renderização mudou de lugar.
  const formMode = showAddPessoa ? 'pessoa-nova'
    : showEdit ? 'pessoa-edit'
    : showAddEmpresa ? 'empresa'
    : null;

  // As três caixas do fim do cadastro. Marcar abre a seção correspondente;
  // desmarcar descarta o que estava preenchido, para não salvar escondido.
  // Marcar não cria item nenhum: quem abre o editor é o próprio PessoaForm
  // (veículo) ou o abrirDependente daqui. Desmarcar joga a lista fora.
  const toggleTemVeiculo = (on) => {
    setTemVeiculo(on);
    if (!on) setTitular(prev => ({ ...prev, veiculos: [], veiculoEdit: null }));
  };

  const toggleTemDependentes = (on) => {
    setTemDependentes(on);
    if (on) { if (dependentes.length === 0) abrirDependente(); }
    else { setDependentes([]); setDepEdit(null); setDepErr(false); }
  };

  const toggleTemEmpresa = (on) => {
    setTemEmpresa(on);
    if (!on) { setLinkEmpresa(null); setLinkSearch(''); setLinkResults([]); }
  };

  const cancelAddPessoa = () => {
    const temDados = titular.nome || titular.cpf || dependentes.length > 0;
    if (temDados && !window.confirm('Deseja descartar o cadastro em andamento?')) return;
    setShowAddPessoa(false); setShowErrors(false);
    setConfirmStep(false);
    setTitular(blankPessoa()); setDependentes([]);
    setDepEdit(null); setDepErr(false);
    setLinkEmpresa(null); setLinkSearch(''); setLinkResults([]);
    setTemVeiculo(false); setTemDependentes(false); setTemEmpresa(false);
  };

  // Corpo do cadastro de hóspede: a etapa de confirmação ou o formulário com
  // a barra lateral de pessoas. Antes era o conteúdo do modal.
  const addPessoaBody = (
        confirmStep ? (
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
                <span>Vinculado à empresa: <strong>{empresaLabel(linkEmpresa)}</strong></span>
              </div>
            )}
          </div>
        ) : (
        <div className={styles.regLayout}>
          <div className={styles.regFormArea}>
            <PessoaForm
              key="reg-titular"
              data={titular} onChange={setTitular}
              onFetchCEP={fetchCEP} onCheckCPF={checkCPF}
              showErrors={showErrors}
              mostrarVeiculos={temVeiculo}
            />

            {/* ── O que mais entra neste cadastro ── */}
            <div className={styles.opcoesBlock}>
              <label className={styles.opcaoRow}>
                <input type="checkbox" checked={temVeiculo} onChange={e => toggleTemVeiculo(e.target.checked)} />
                <Car size={13} /> <span>Possui veículo</span>
              </label>
              <label className={styles.opcaoRow}>
                <input type="checkbox" checked={temDependentes} onChange={e => toggleTemDependentes(e.target.checked)} />
                <Users size={13} /> <span>Possui dependentes</span>
              </label>
              <label className={styles.opcaoRow}>
                <input type="checkbox" checked={temEmpresa} onChange={e => toggleTemEmpresa(e.target.checked)} />
                <Building2 size={13} /> <span>Vínculo com empresa registrada</span>
              </label>
            </div>

            {/* ── Dependentes ── */}
            {temDependentes && (
              <>
                <div className={styles.optTitle}><Users size={16} /> Dependentes</div>

                {/* os já confirmados, em tabela — mesma leitura do histórico */}
                {dependentes.length > 0 && (
                  <div className={styles.hScroll}>
                    <table className={[styles.hTable, styles.optTable].join(' ')}>
                      <thead><tr>
                        <th>Dependente</th><th>CPF</th><th>Nascimento</th><th>Parentesco</th>
                        <th>Contato e endereço</th><th aria-label="Ações" />
                      </tr></thead>
                      <tbody>
                        {dependentes.map((dep, i) => (
                          <tr key={i} className={depEdit?.index === i ? styles.trEditando : ''}>
                            <td>
                              <span className={styles.hQuarto}>
                                <AvatarCircle name={dep.nome || `D${i + 1}`} size={24} tone={i + 1} fontSize={10} />
                                {dep.nome || `Dependente ${i + 1}`}
                              </span>
                            </td>
                            <td>{maskCPF(dep.cpf) || '—'}</td>
                            <td>{nascLabel(dep.dataNascimento)}</td>
                            <td>{parentescoLabel(dep.parentesco)}</td>
                            <td>
                              <span className={styles.optTag}>
                                {dep.usarDadosTitular !== false ? 'Do titular' : 'Próprios'}
                              </span>
                            </td>
                            <td>
                              <span className={styles.tdAcoes}>
                                <button type="button" className={styles.btnEdit} onClick={() => abrirDependente(i)}
                                  title="Editar dependente"><Pencil size={12} /></button>
                                <button type="button" className={styles.btnRemove} onClick={() => handleRemoveDependente(i)}
                                  title="Remover dependente"><X size={12} /></button>
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* o editor, aberto pelo "+ Dependente" ou pelo lápis */}
                {depEdit && (
                  <>
                    <DependenteForm
                      key={`dep-edit-${depEdit.index ?? 'novo'}`}
                      index={depEdit.index}
                      data={depEdit.value}
                      onChange={setDepEditData}
                      titular={titular}
                      onFetchCEP={fetchCEP}
                      onCheckCPF={checkCPF}
                      showErrors={depErr}
                    />
                    <div className={styles.editorFoot}>
                      <button type="button" className={styles.optAdd} onClick={confirmarDependente}>
                        <Check size={13} /> Confirmar dependente
                      </button>
                      <button type="button" className={styles.btnGhost} onClick={cancelarDependente}>Cancelar</button>
                    </div>
                  </>
                )}

                {!depEdit && (
                  <button type="button" className={styles.optAdd} onClick={() => abrirDependente()}>
                    <Plus size={13} /> Dependente
                  </button>
                )}
              </>
            )}

            {/* ── Empresa vinculada ──
                A busca acontece aqui mesmo: escolher na lista de resultados já
                vincula, sem abrir modal. */}
            {temEmpresa && (
              <>
                <div className={styles.optTitle}><Building2 size={16} /> Empresa vinculada</div>
                {linkEmpresa ? (
                  <div className={styles.itemLista}>
                    <div className={styles.itemRow}>
                      <Building2 size={14} className={styles.itemRowIcon} />
                      <span className={styles.itemRowMain}>
                        <span className={styles.itemRowTitle}>{empresaLabel(linkEmpresa)}</span>
                        <span className={styles.itemRowSub}>{maskCNPJ(linkEmpresa.cnpj ?? '')}</span>
                      </span>
                      <span className={styles.itemRowActions}>
                        <button type="button" className={styles.btnRemove}
                          onClick={() => setLinkEmpresa(null)} title="Desvincular empresa"><X size={12} /></button>
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className={styles.optItem}>
                    <div className={styles.searchWrap}>
                      <Search size={13} className={styles.searchIcon} />
                      <Input
                        value={linkSearch}
                        onChange={e => setLinkSearch(e.target.value)}
                        placeholder="Buscar por nome ou CNPJ (mín. 3 caracteres)..."
                        className={styles.searchInput}
                      />
                      {linkLoading && <Loader2 size={13} className={[styles.spinInline, styles.searchSpinner].join(' ')} />}
                    </div>
                    {linkResults.length > 0 && (
                      <div className={[styles.linkDropdown, styles.linkDropdownInline].join(' ')}>
                        {linkResults.map(e => (
                          <button key={e.id} type="button" className={styles.linkDropdownItem}
                            onClick={() => { setLinkEmpresa(e); setLinkSearch(''); setLinkResults([]); }}>
                            <Building2 size={12} className={styles.iconViolet} />
                            <span className={styles.nome}>{empresaLabel(e)}</span>
                            <span className={styles.mono}>{maskCNPJ(e.cnpj ?? '')}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </>
            )}

            {/* ── Fim do cadastro ── */}
            <div className={styles.formFoot}>
              <Button className={styles.btnSolid}
                onClick={() => setTitular(blankPessoa())}>Limpar</Button>
              <Button variant="primary" className={[styles.btnSolid, styles.btnPrimary].join(' ')}
                onClick={handlePreviewPessoa}>Próximo</Button>
            </div>
          </div>
        </div>
        )
  );


  // ─────────────────────────────────────────────────────────
  return (
    <div className={styles.page}>
      <div className={styles.container}>
        {/* Abaixo de 1024px, com um registro aberto, a ficha toma a tela e a
            lista sai; sem seleção as duas se empilham. */}
        <main className={[styles.split, (detailItem || formMode) ? styles.splitListHidden : ''].join(' ')}>

          {/* ══ LISTA ═══════════════════════════════════════════ */}
          <aside className={styles.listPanel}>
            {/* Hóspedes / Empresas */}
            <div className={styles.segmented}>
              <button type="button"
                className={[styles.segmentedBtn, !isEmpresasTab ? styles.segmentedBtnActive : ''].join(' ')}
                onClick={() => changeFilter('todos')}>
                Hóspedes
              </button>
              <button type="button"
                className={[styles.segmentedBtn, isEmpresasTab ? styles.segmentedBtnActive : ''].join(' ')}
                onClick={() => changeFilter('empresas')}>
                Empresas
              </button>
            </div>

            {/* Busca + filtro de status */}
            <div className={styles.searchRow}>
              <div className={[styles.searchWrap, styles.searchWrapFull].join(' ')}>
                <Search size={16} className={styles.searchIcon} />
                <Input
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  placeholder={isEmpresasTab ? 'Buscar razão social ou CNPJ...' : 'Buscar por nome, CPF ou e-mail...'}
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

              {!isEmpresasTab && (
                <div className={styles.filterWrap} ref={statusMenuRef}>
                  <button type="button"
                    className={[styles.filterBtn, filterMode !== 'todos' ? styles.filterBtnOn : ''].join(' ')}
                    onClick={() => setStatusMenu(v => !v)}
                    aria-haspopup="menu" aria-expanded={statusMenu}
                    title={`Filtrar por status — ${filtroAtual.label}`}>
                    <FilterIcon size={18} />
                    {filterMode !== 'todos' && <span className={styles.filterDot} />}
                  </button>

                  {statusMenu && (
                    <div className={styles.filterMenu} role="menu">
                      <span className={styles.filterMenuLabel}>Status</span>
                      {statusFilters.map(({ id, label }) => (
                        <button key={id} type="button" role="menuitem"
                          className={[styles.filterMenuItem, filterMode === id ? styles.filterMenuItemOn : ''].join(' ')}
                          onClick={() => { changeFilter(id); setStatusMenu(false); }}>
                          {label}
                          {filterMode === id && <Check size={14} />}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className={styles.listMeta}>
              <span>
                {loading
                  ? 'Carregando...'
                  : `${totalElements} ${isEmpresasTab
                      ? `empresa${totalElements !== 1 ? 's' : ''}`
                      : `hóspede${totalElements !== 1 ? 's' : ''}`}`}
                {!isEmpresasTab && filterMode !== 'todos' && ` · ${filtroAtual.label}`}
              </span>
              {!isEmpresasTab && (
                <select
                  className={styles.sortSelect}
                  value={`${ordenacao}|${direcao}`}
                  onChange={e => { const [ord, dir] = e.target.value.split('|'); changeSort(ord, dir); }}
                  aria-label="Ordenação"
                >
                  <option value="DATA_CADASTRO|DESC">Mais recentes</option>
                  <option value="DATA_CADASTRO|ASC">Mais antigos</option>
                  <option value="NOME|ASC">Nome A→Z</option>
                  <option value="NOME|DESC">Nome Z→A</option>
                </select>
              )}
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
                const name  = nomeListing(item);
                const ativo = detailItem?.id === item.id && detailItem?._type === item._type;
                // acabou de ser cadastrado nesta sessão → entra animado
                const doc = unmask(item.cpf ?? item.cnpj ?? '');
                const recemCriado = !!doc && recemCriados.has(doc);
                const local = [item.municipio, item.estado].filter(Boolean).join('/');
                return (
                  <button key={`${item._type}-${item.id}`} type="button"
                    className={[
                      styles.listItem,
                      ativo ? styles.listItemActive : '',
                      recemCriado ? styles.listItemNovo : '',
                    ].join(' ')}
                    onClick={() => openDetail(item, i)}>
                    <AvatarCircle name={name} size={40} tone={i} />
                    <span className={styles.listItemBody}>
                      <span className={styles.listItemName}>
                        <span className={styles.nome}>{name}</span>
                        {item.status === 'BLOQUEADO' && <span className={styles.badgeBloqueado}>Bloqueado</span>}
                        {item.status === 'HOSPEDADO' && <span className={styles.badgeHospedado}>Hospedado</span>}
                        {isNovo(item) && <span className={styles.badgeNovo}>Novo</span>}
                      </span>
                      {local && (
                        <span className={styles.listItemLoc}>
                          <MapPin size={12} /> {local}
                        </span>
                      )}
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
          {/* Os formulários ocupam o painel no lugar da ficha — antes abriam
              em modal. Quem manda são os mesmos estados de antes, só que
              agora lidos aqui em vez de alimentarem um <Modal>. */}
          {formMode === 'pessoa-nova' ? (
            <div className={styles.detailPanel}>
              <section className={styles.dCard}>
                <h3 className={styles.dCardHead}>
                  <button type="button" className={styles.backBtn} onClick={cancelAddPessoa}
                    title="Voltar para a lista" aria-label="Voltar para a lista">
                    <ChevronLeft size={17} />
                  </button>
                  <UserPlus size={16} />
                  <span className={styles.dCardTitle}>
                    {confirmStep ? 'Confirmar cadastro' : 'Novo hóspede'}
                  </span>
                  <div className={styles.dCardActions}>
                    {!confirmStep ? (
                      /* Limpar e Próximo ficam no fim do formulário, depois de
                         tudo o que se cadastra; aqui em cima só a contagem. */
                      <span className={styles.personCount}>
                        <Users size={13} />
                        {1 + dependentes.length} pessoa{(1 + dependentes.length) !== 1 ? 's' : ''}
                      </span>
                    ) : (
                      <>
                        <Button className={styles.btnSolid} onClick={() => setConfirmStep(false)}>Voltar</Button>
                        <Button variant="primary" className={[styles.btnSolid, styles.btnPrimary].join(' ')}
                          onClick={doSavePessoa} disabled={isSubmitting}>
                          {isSubmitting ? <><Loader2 size={13} className={styles.spinInline} /> Salvando...</> : 'Confirmar e salvar'}
                        </Button>
                      </>
                    )}
                    <button type="button" className={styles.idClose} onClick={cancelAddPessoa}
                      title="Cancelar cadastro" aria-label="Cancelar cadastro">
                      <X size={16} />
                    </button>
                  </div>
                </h3>
                <div className={styles.dCardBody}>{addPessoaBody}</div>
              </section>
            </div>

          ) : formMode === 'pessoa-edit' ? (
            <div className={styles.detailPanel}>
              <section className={styles.dCard}>
                <h3 className={styles.dCardHead}>
                  <button type="button" className={styles.backBtn} onClick={() => setShowEdit(false)}
                    title="Voltar" aria-label="Voltar">
                    <ChevronLeft size={17} />
                  </button>
                  <Contact size={16} />
                  <span className={styles.dCardTitle}>Editar hóspede</span>
                  <div className={styles.dCardActions}>
                    <Button className={styles.btnSolid} onClick={() => setEditPessoa(blankPessoa())}>Limpar</Button>
                    <Button variant="primary" className={[styles.btnSolid, styles.btnPrimary].join(' ')}
                      onClick={handleSaveEditPessoa} disabled={isSubmitting}>
                      {isSubmitting ? <><Loader2 size={13} className={styles.spinInline} /> Salvando...</> : 'Salvar'}
                    </Button>
                    <button type="button" className={styles.idClose} onClick={() => setShowEdit(false)}
                      title="Cancelar" aria-label="Cancelar">
                      <X size={16} />
                    </button>
                  </div>
                </h3>
                <div className={styles.dCardBody}>
                  <PessoaForm data={editPessoa} onChange={setEditPessoa} onFetchCEP={fetchCEP} onCheckCPF={checkCPF} />
                </div>
              </section>
            </div>

          ) : formMode === 'empresa' ? (
            <div className={styles.detailPanel}>
              <section className={styles.dCard}>
                <h3 className={styles.dCardHead}>
                  <button type="button" className={styles.backBtn}
                    onClick={() => { setShowAddEmpresa(false); setEditMode(false); }}
                    title="Voltar" aria-label="Voltar">
                    <ChevronLeft size={17} />
                  </button>
                  <Building2 size={16} />
                  <span className={styles.dCardTitle}>{editMode ? 'Editar empresa' : 'Nova empresa'}</span>
                  <div className={styles.dCardActions}>
                    <Button className={styles.btnSolid} onClick={() => setEmpresa(blankEmpresa())}>Limpar</Button>
                    <Button variant="primary" className={[styles.btnSolid, styles.btnPrimary].join(' ')}
                      onClick={handleSaveEmpresa} disabled={isSubmitting}>
                      {isSubmitting ? <><Loader2 size={13} className={styles.spinInline} /> Salvando...</> : 'Salvar'}
                    </Button>
                    <button type="button" className={styles.idClose}
                      onClick={() => { setShowAddEmpresa(false); setEditMode(false); }}
                      title="Cancelar" aria-label="Cancelar">
                      <X size={16} />
                    </button>
                  </div>
                </h3>
                <div className={styles.dCardBody}>
                  <EmpresaForm data={empresa} onChange={setEmpresa} onFetchCNPJ={fetchCNPJ} onFetchCEP={fetchCEP} editMode={editMode} />
                </div>
              </section>
            </div>

          ) : !detailItem ? (
            /* ── Painel geral (nenhum cadastro selecionado) ── */
            <div className={styles.detailPanel}>
              <section className={styles.dCard}>
                <h3 className={styles.dCardHead}>
                  <LayoutDashboard size={16} />
                  <span className={styles.dCardTitle}>Visão geral dos cadastros</span>
                  {/* cada aba mostra o seu cadastro */}
                  {canCadastrar && (
                    <div className={styles.dCardActions}>
                      {isEmpresasTab ? (
                        <Button variant="primary" className={[styles.btnSolid, styles.btnPrimary].join(' ')}
                          onClick={() => { setEmpresa(blankEmpresa()); setEditMode(false); setShowAddEmpresa(true); }}>
                          Cadastrar empresa
                        </Button>
                      ) : (
                        <Button variant="primary" className={[styles.btnSolid, styles.btnPrimary].join(' ')} onClick={() => {
                          setTitular(blankPessoa()); setDependentes([]);
                          setLinkEmpresa(null); setLinkSearch(''); setLinkResults([]);
                          setShowErrors(false);
                          setTemVeiculo(false); setTemDependentes(false); setTemEmpresa(false);
                          setShowAddPessoa(true);
                        }}>
                          Cadastrar hóspede
                        </Button>
                      )}
                    </div>
                  )}
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
                    <>
                    {/* Composição da base — hospedados / bloqueados / demais */}
                    {stats.pessoas > 0 && (() => {
                      const pct = n => (n / stats.pessoas) * 100;
                      const demais = Math.max(0, stats.pessoas - stats.hospedados - stats.bloqueados);
                      return (
                        <div className={styles.distBar}>
                          <span className={styles.distHosp}  style={{ width: `${pct(stats.hospedados)}%` }} />
                          <span className={styles.distBloq}  style={{ width: `${pct(stats.bloqueados)}%` }} />
                          <span className={styles.distResto} style={{ width: `${pct(demais)}%` }} />
                        </div>
                      );
                    })()}

                    <div className={styles.statLine}>
                      <span className={styles.statItem}>
                        <i className={[styles.statDot, styles.dotTotal].join(' ')} />
                        <span className={styles.statItemLabel}>Cadastrados</span>
                        <span className={styles.statItemVal}>{stats.pessoas}</span>
                      </span>
                      <span className={styles.statItem}>
                        <i className={[styles.statDot, styles.distHosp].join(' ')} />
                        <span className={styles.statItemLabel}>Hospedados</span>
                        <span className={[styles.statItemVal, styles.statValGreen].join(' ')}>{stats.hospedados}</span>
                      </span>
                      <span className={styles.statItem}>
                        <i className={[styles.statDot, styles.distBloq].join(' ')} />
                        <span className={styles.statItemLabel}>Bloqueados</span>
                        <span className={[styles.statItemVal, styles.statValRed].join(' ')}>{stats.bloqueados}</span>
                      </span>
                      <span className={styles.statItem}>
                        <i className={[styles.statDot, styles.dotEmpresa].join(' ')} />
                        <span className={styles.statItemLabel}>Empresas</span>
                        <span className={styles.statItemVal}>{stats.empresas}</span>
                      </span>
                    </div>
                    </>
                  )}
                </div>
              </section>

              {/*<div className={styles.detailHint}>*/}
              {/*  Escolha um registro na lista ao lado para ver a ficha completa.*/}
              {/*</div>*/}
            </div>
          ) : detailType === 'pessoa' ? (
            <div className={styles.detailPanel}>

              {/* ── Dados de cadastro (inclui veículos e empresa) ── */}
              <section className={styles.dCard}>
                <h3 className={styles.dCardHead}>
                  {/* só aparece quando a ficha ocupa a tela e a lista está fora */}
                  <button type="button" className={styles.backBtn} onClick={closeDetail}
                    title="Voltar para a lista" aria-label="Voltar para a lista">
                    <ChevronLeft size={17} />
                  </button>
                  <Contact size={16} />
                  <span className={styles.dCardTitle}>Dados de cadastro</span>
                  <div className={styles.dCardActions}>
                    {isBloqueado && (
                      <span className={styles.blockedNotice}>Bloqueado</span>
                    )}
                    {canAtualizar && (
                      <Button className={styles.btnSolid} onClick={() => openEditPessoa(detailItem)} disabled={isBloqueado}>
                        Editar
                      </Button>
                    )}
                    {canBloquear && (
                      <Button variant={isBloqueado ? 'primary' : 'danger'}
                        className={[styles.btnSolid, isBloqueado ? styles.btnPrimary : styles.btnDanger].join(' ')}
                        onClick={handleToggleStatus} disabled={isSubmitting}>
                        {isBloqueado ? 'Desbloquear' : 'Bloquear'}
                      </Button>
                    )}
                    <button type="button" className={styles.idClose} onClick={closeDetail}
                      title="Fechar cadastro" aria-label="Fechar cadastro">
                      <X size={16} />
                    </button>
                  </div>
                </h3>

                <div className={styles.dCardBody}>
                  <div className={styles.idHead}>
                    <AvatarCircle name={detailItem.nome} size={56} tone={detailTone} />
                    <div className={styles.idHeadMain}>
                      <div className={styles.idName}>
                        <h2 style={{ margin: 0, font: 'inherit' }}>{detailItem.nome ?? '—'}</h2>
                        {/* MOCK — categoria de fidelidade */}
                        <span className={[styles.catBadge, catTomClass(categoria.tom)].join(' ')}>{categoria.nome}</span>
                      </div>
                      <p className={styles.idSub}>
                        Cliente desde {cadastradoEm}
                        {detailItem.titularNome && ` · Dep. de ${detailItem.titularNome}`}
                      </p>
                      <p className={styles.idSub}>
                        Registrado por: {detailItem.funcionario?.nome || '—'}
                      </p>
                    </div>

                  </div>

                  <div className={styles.fieldGrid}>
                    <Field label="CPF" value={maskCPF(detailItem.cpf ?? '')} mono />
                    <Field label="Data de nascimento" value={detailItem.data_nascimento ?? dateFromApi(detailItem.dataNascimento)} />
                    <Field label="E-mail" value={detailItem.email ? (
                      <ContatoBotao tipo="gmail" href={`mailto:${detailItem.email}`} title="Enviar e-mail">
                        {detailItem.email}
                      </ContatoBotao>
                    ) : ''} />
                    <Field label="Telefone" value={detailItem.telefone ? (
                      <ContatoBotao tipo="whatsapp" href={`https://wa.me/55${unmask(detailItem.telefone)}`} title="WhatsApp">
                        {maskPhone(detailItem.telefone)}
                      </ContatoBotao>
                    ) : ''} />
                    <Field label="Endereço" value={[
                      [detailItem.endereco, detailItem.numero].filter(Boolean).join(', '),
                      detailItem.bairro,
                    ].filter(Boolean).join(' — ')} />
                    <Field label="Cidade / UF" value={[detailItem.municipio, detailItem.estado].filter(Boolean).join(' — ')} />
                    <Field label="Nacionalidade" value={nacionalidade(detailItem.pais)} />
                    <Field label="Categoria" value={categoria.nome} />
                    <Field label="RG" value={detailItem.rg} mono />
                    <Field label="Profissão" value={detailItem.profissao} />
                    <Field label="Sexo" value={sexoLabel(detailItem.sexo)} />
                    <Field label="CEP" value={maskCEP(detailItem.cep ?? '')} mono />
                  </div>

                  {/* ── Veículos ── */}
                  <div className={styles.subBlock}>
                    <div className={styles.blockHead}>
                      <Car size={15} />
                      <span>Veículos</span>
                    </div>
                    {veiculosList.length === 0 ? (
                      <p className={styles.blockEmpty}>Sem veículos cadastrados.</p>
                    ) : (
                      <ul className={styles.vList}>
                        {veiculosList.map((v, i) => (
                          <li key={v.id ?? i} className={styles.vRow}>
                            <img className={styles.vTipoImg} src={imgTipo(v.tipo, v.codigo_cor ?? codigoCor(v.cor))} alt={tipoCanon(v.tipo) || 'Veículo'} />
                            <div className={styles.vInfo}>
                              <p className={styles.vModelo}>
                                {[v.marca, v.modelo].filter(Boolean).join(' ') || '—'}
                              </p>
                              <p className={styles.vMeta}>
                                {[
                                  tipoCanon(v.tipo) || null,
                                  v.cor || null,
                                  Number(v.ano) ? `Ano ${v.ano}` : null,
                                ].filter(Boolean).join(' · ') || '—'}
                              </p>
                            </div>
                            {LOGOS_MARCA[slugVeiculo(v.marca)] && (
                              <img className={styles.vMarcaLogo} src={LOGOS_MARCA[slugVeiculo(v.marca)]} alt={v.marca} />
                            )}
                            <PlacaMercosul placa={v.placa} />
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  {/* ── Empresa ── */}
                  <div className={styles.subBlock}>
                    <div className={styles.blockHead}>
                      <Building2 size={15} />
                      <span>Empresa</span>
                      <Button className={[styles.btnSolid, styles.btnSm].join(' ')}
                        onClick={() => setShowLinkEmpresa(v => !v)}>
                        Vincular
                      </Button>
                    </div>

                    {showLinkEmpresa && (
                      <div className={styles.linkEmpresaSearch} style={{ marginBottom: 14 }}>
                        <div className={styles.searchWrap}>
                          <Search size={13} className={styles.searchIcon} />
                          <Input value={empSearch} onChange={e => setEmpSearch(e.target.value)}
                            placeholder="Buscar empresa para vincular..." className={styles.searchInput} />
                          {empSearchLoading && <Loader2 size={13} className={[styles.spinInline, styles.searchSpinner].join(' ')} />}
                        </div>
                        {(empSearchLoading || empSearchResults.length > 0) && (
                          <div className={styles.linkDropdown}>
                            {empSearchLoading ? <SkeletonVinculo /> : empSearchResults.map(emp => {
                              const jaVinculado = empresasList.some(ev => ev.id === emp.id);
                              return (
                                <button key={emp.id}
                                  className={[styles.linkDropdownItem, jaVinculado ? styles.linkDropdownItemLinked : ''].join(' ')}
                                  onClick={() => { if (!jaVinculado) handleVincularEmpresa(emp.id); }}
                                  disabled={jaVinculado}>
                                  <Building2 size={14} className={styles.iconViolet} />
                                  <span className={styles.nome}>{empresaLabel(emp)}</span>
                                  <span className={styles.mono}>{maskCNPJ(emp.cnpj ?? '')}</span>
                                  {jaVinculado
                                    ? <span className={styles.jaVinculadoBadge}>Já vinculada</span>
                                    : <span className={styles.vincularHint}>Vincular</span>}
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    )}

                    {empresasList.length === 0 ? (
                      <p className={styles.blockEmpty}>Sem empresas vinculadas.</p>
                    ) : empresasList.map((e, i) => {
                      /* MOCK — cargo, faturamento e contato financeiro */
                      const vinculo = mockVinculoEmpresa(detailItem.id, e.id);
                      return (
                        <div key={e.id} className={styles.fieldGridEmpresa}
                          style={i > 0 ? { marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--l-border)' } : undefined}>
                          <Field label="Razão social" value={e.razaoSocial ?? e.razao_social} />
                          <Field label="CNPJ" value={maskCNPJ(e.cnpj ?? '')} mono />
                          <Field label="Cargo" value={vinculo.cargo} />
                          <Field label="Faturamento" value={vinculo.faturamento} />
                          <Field label="Contato financeiro" value={e.email || vinculo.contatoFinanceiro} />
                          <Field label="Vínculo" value={
                            <button className={styles.btnRemove} onClick={() => handleDesvincularEmpresa(e.id)}
                              title="Desvincular" style={{ marginLeft: 0 }}>
                              <Trash2 size={13} />
                            </button>
                          } />
                        </div>
                      );
                    })}
                  </div>
                </div>
              </section>

              {/* ── Histórico de hospedagem ── */}
              {canHistorico && <HistoricoCard registros={historico} resumo={resumo} />}

              {/* ── Dependentes ── */}
              {detailItem.titularId == null && (
                <section className={styles.dCard}>
                  <h3 className={styles.dCardHead}>
                    <Users size={16} />
                    <span className={styles.dCardTitle}>Dependentes</span>
                    <div className={styles.dCardActions}>
                      <Button variant="primary" className={[styles.btnSolid, styles.btnPrimary].join(" ")}
                        onClick={() => { setNewDepData(blankPessoa()); setShowNewDep(true); }}>
                        Novo
                      </Button>
                    </div>
                  </h3>

                  <div className={styles.dCardBody}>
                    <div className={styles.linkEmpresaSearch} style={{ marginBottom: 16 }}>
                      <div className={styles.searchWrap}>
                        <Search size={13} className={styles.searchIcon} />
                        <Input value={depSearch} onChange={e => setDepSearch(e.target.value)}
                          placeholder="Buscar pessoa para vincular como dependente..." className={styles.searchInput} />
                        {depSearchLoading && <Loader2 size={13} className={[styles.spinInline, styles.searchSpinner].join(' ')} />}
                      </div>
                      {(depSearchLoading || depSearchResults.length > 0) && (
                        <div className={styles.linkDropdown}>
                          {depSearchLoading ? <SkeletonVinculo /> : depSearchResults.map(p => {
                            const jaVinculado = dependentesList.some(a => a.id === p.id) || p.id === detailItem.id;
                            return (
                              <button key={p.id}
                                className={[styles.linkDropdownItem, jaVinculado ? styles.linkDropdownItemLinked : ''].join(' ')}
                                onClick={() => { if (!jaVinculado) handleVincularDependente(p.id); }}
                                disabled={jaVinculado}>
                                <AvatarCircle name={p.nome} size={24} muted />
                                <span className={styles.nome}>{p.nome}</span>
                                <span className={styles.mono}>{maskCPF(p.cpf ?? '')}</span>
                                {jaVinculado
                                  ? <span className={styles.jaVinculadoBadge}>Já vinculado</span>
                                  : <span className={styles.vincularHint}>Vincular</span>}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    {dependentesList.length === 0 ? (
                      <p className={styles.blockEmpty}>Sem dependentes vinculados.</p>
                    ) : (
                      <ul className={styles.dList}>
                        {dependentesList.map(dep => (
                          <li key={dep.id} className={styles.depCard}>
                            <AvatarCircle name={dep.nome} size={36} muted />
                            <div className={styles.depCardBody} onClick={() => openDetail({ ...dep, _type: 'pessoa' })}>
                              <p className={styles.nome}>{dep.nome}</p>
                              <p className={styles.sub}>{maskCPF(dep.cpf ?? '')} · {dep.status}</p>
                            </div>
                            <button className={styles.btnRemove} onClick={() => handleDesvincularDependente(dep.id)} title="Desvincular">
                              <Trash2 size={13} />
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </section>
              )}
            </div>
          ) : (
            /* ══ DETALHE — EMPRESA ═════════════════════════════ */
            <div className={styles.detailPanel}>

              <section className={styles.dCard}>
                <h3 className={styles.dCardHead}>
                  {/* só aparece quando a ficha ocupa a tela e a lista está fora */}
                  <button type="button" className={styles.backBtn} onClick={closeDetail}
                    title="Voltar para a lista" aria-label="Voltar para a lista">
                    <ChevronLeft size={17} />
                  </button>
                  <Contact size={16} />
                  <span className={styles.dCardTitle}>Dados da empresa</span>
                  <div className={styles.dCardActions}>
                    {isBloqueado && <span className={styles.blockedNotice}>Bloqueada</span>}
                    {canAtualizar && (
                      <Button className={styles.btnSolid} onClick={openEditEmpresa} disabled={isBloqueado}>
                        Editar
                      </Button>
                    )}
                    <button type="button" className={styles.idClose} onClick={closeDetail}
                      title="Fechar cadastro" aria-label="Fechar cadastro">
                      <X size={16} />
                    </button>
                  </div>
                </h3>

                <div className={styles.dCardBody}>
                  <div className={styles.idHead}>
                    <AvatarCircle name={nomeListing(detailItem)} size={56} tone={detailTone} />
                    <div className={styles.idHeadMain}>
                      <div className={styles.idName}>
                        <h2 style={{ margin: 0, font: 'inherit' }}>
                          {detailItem.razaoSocial ?? detailItem.razao_social ?? '—'}
                        </h2>
                        <span className={styles.detailId}>{detailItem.tipoEmpresa ?? detailItem.tipo_empresa ?? 'CLIENTE'}</span>
                      </div>
                      <p className={styles.idSub}>
                        Cadastrada em {cadastradoEm}
                        {(detailItem.nomeFantasia ?? detailItem.nome_fantasia) &&
                          ` · ${detailItem.nomeFantasia ?? detailItem.nome_fantasia}`}
                        {` · ${vinculadosList.length} vinculado${vinculadosList.length !== 1 ? 's' : ''}`}
                      </p>
                      <p className={styles.idSub}>
                        Registrado por: {detailItem.funcionario?.nome || '—'}
                      </p>
                    </div>
                  </div>

                  <div className={styles.fieldGrid}>
                    <Field label="CNPJ" value={maskCNPJ(detailItem.cnpj ?? '')} mono />
                    <Field label="Nome fantasia" value={detailItem.nomeFantasia ?? detailItem.nome_fantasia} />
                    <Field label="E-mail" value={detailItem.email ? (
                      <ContatoBotao tipo="gmail" href={`mailto:${detailItem.email}`} title="Enviar e-mail">
                        {detailItem.email}
                      </ContatoBotao>
                    ) : ''} />
                    <Field label="Telefone" value={detailItem.telefone ? (
                      <ContatoBotao tipo="whatsapp" href={`https://wa.me/55${unmask(detailItem.telefone)}`} title="WhatsApp">
                        {maskPhone(detailItem.telefone)}
                      </ContatoBotao>
                    ) : ''} />
                    <Field label="Endereço" value={[
                      [detailItem.endereco, detailItem.numero].filter(Boolean).join(', '),
                      detailItem.bairro,
                    ].filter(Boolean).join(' — ')} />
                    <Field label="Cidade / UF" value={[detailItem.municipio, detailItem.estado].filter(Boolean).join(' — ')} />
                    <Field label="CEP" value={maskCEP(detailItem.cep ?? '')} mono />
                    <Field label="Status" value={detailItem.status} />
                  </div>
                </div>
              </section>

              {/* ── Pessoas vinculadas ── */}
              <section className={styles.dCard}>
                <h3 className={styles.dCardHead}>
                  <Users size={16} />
                  <span className={styles.dCardTitle}>Pessoas vinculadas</span>
                </h3>

                <div className={styles.dCardBody}>
                  <div className={styles.linkEmpresaSearch} style={{ marginBottom: 16 }}>
                    <div className={styles.searchWrap}>
                      <Search size={13} className={styles.searchIcon} />
                      <Input value={vinculSearch} onChange={e => setVinculSearch(e.target.value)}
                        placeholder="Buscar pessoa por nome ou CPF..." className={styles.searchInput} />
                      {vinculLoading && <Loader2 size={13} className={[styles.spinInline, styles.searchSpinner].join(' ')} />}
                    </div>
                    {(vinculLoading || vinculResults.length > 0) && (
                      <div className={styles.linkDropdown}>
                        {vinculLoading ? <SkeletonVinculo /> : vinculResults.map(p => {
                          const jaVinculado = vinculadosList.some(v => v.id === p.id);
                          return (
                            <button key={p.id}
                              className={[styles.linkDropdownItem, jaVinculado ? styles.linkDropdownItemLinked : ''].join(' ')}
                              onClick={() => { if (!jaVinculado) { handleVincular(p.id); setVinculSearch(''); setVinculResults([]); } }}
                              disabled={jaVinculado}>
                              <AvatarCircle name={p.nome} size={24} muted />
                              <span className={styles.nome}>{p.nome}</span>
                              <span className={styles.mono}>{maskCPF(p.cpf ?? '')}</span>
                              {jaVinculado
                                ? <span className={styles.jaVinculadoBadge}>Já vinculado</span>
                                : <span className={styles.vincularHint}>Vincular</span>}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {vinculadosList.length === 0 ? (
                    <p className={styles.blockEmpty}>Nenhum vinculado.</p>
                  ) : (
                    <ul className={styles.dList}>
                      {vinculadosList.map(p => (
                        <li key={p.id} className={styles.depCard}>
                          <AvatarCircle name={p.nome} size={36} muted />
                          <div className={styles.depCardBody} onClick={() => openDetail({ ...p, _type: 'pessoa' })}>
                            <p className={styles.nome}>{p.nome}</p>
                            <p className={styles.sub}>{maskCPF(p.cpf ?? '')}</p>
                          </div>
                          <button className={styles.btnRemove} onClick={() => handleDesvincular(p.id)} title="Desvincular">
                            <Trash2 size={13} />
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </section>

              {/* ── Histórico de hospedagem ── */}
              {canHistorico && <HistoricoCard registros={historico} resumo={resumo} />}
            </div>
          )}
        </main>
      </div>

      {/* ══ MODAL: NOVO DEPENDENTE (criar + vincular) ══════════ */}
      <Modal
        open={showNewDep}
        onClose={() => setShowNewDep(false)}
        size="xl"
        title="Novo Dependente"
        footer={
          <div className={styles.modalFooter}>
            <Button onClick={() => setNewDepData(blankPessoa())}>Limpar</Button>
            <Button variant="primary" onClick={handleSaveNewDep} disabled={savingNewDep}>
              {savingNewDep ? <><Loader2 size={13} className={styles.spinInline} /> Salvando...</> : 'Cadastrar e Vincular'}
            </Button>
          </div>
        }
      >
        <PessoaForm
          data={newDepData}
          onChange={setNewDepData}
          onFetchCEP={fetchCEP}
          onCheckCPF={checkCPF}
        />
      </Modal>


      <Notification notification={notification} />
    </div>
  );
}
