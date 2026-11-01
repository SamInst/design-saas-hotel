import { useState, useEffect, useCallback, useRef } from 'react';
import {
  BedDouble, Calendar, Tag, Users, Clock,
  Plus, Trash2, Loader2, Check,
  Search, X, ChevronLeft, ChevronRight, AlertCircle,
} from 'lucide-react';
import { Modal }                    from '../../components/ui/Modal';
import { Button }                   from '../../components/ui/Button';
import { Input, Select, FormField } from '../../components/ui/Input';
import { TimePicker }               from '../../components/ui/TimePicker';
import { DatePicker }               from '../../components/ui/DatePicker';
import { Notification }             from '../../components/ui/Notification';
import { quartoCategoriApi, quartoApi, sazonalidadeApi } from '../../services/api';
import styles from './PricingManagement.module.css';
import { tr } from '../../i18n';

// ── Helpers ──────────────────────────────────────────────────────────────────
const fmtBRL = (v) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v ?? 0);

const maskBRL = (v) => {
  const digits = String(v ?? '').replace(/\D/g, '');
  if (!digits) return '';
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
    .format(parseInt(digits, 10) / 100);
};
const parseBRL = (v) => {
  const s = String(v ?? '').replace(/[R$\s.]/g, '').replace(',', '.');
  return parseFloat(s) || 0;
};

// ── Backend → Frontend transformer ───────────────────────────────────────────
const MENOR_MODO_MAP = {
  TAXA_ADICIONAL_FIXA:      'taxa-fixa',
  TAXA_POR_QUANTIDADE:      'taxa-quantidade',
  TAXA_POR_FAIXA_ETARIA:    'taxa-faixa',
  PORCENTAGEM_POR_QUANTIDADE: 'porcentagem-quantidade',
};

function catFromBackend(cat) {
  const baseOcc  = (cat.modelos_ocupacao ?? []).filter(m => !m.sazonalidade);
  const baseFixo = (cat.modelos_fixo    ?? []).filter(m => !m.sazonalidade);
  const isFixo   = baseFixo.length > 0;

  const precosOcupacao = {};
  baseOcc.forEach(m => { precosOcupacao[m.quantidade] = m.valor; });
  const maxPessoas = baseOcc.length ? Math.max(...baseOcc.map(m => m.quantidade)) : 5;

  const baseDu = (cat.day_use ?? []).find(d => !d.sazonalidade);
  const du = baseDu ? {
    ativo:                baseDu.ativo,
    modo:                 baseDu.padrao ? 'padrao' : 'ocupacao',
    precoFixo:            baseDu.padrao?.preco_base ?? 0,
    horasBase:            baseDu.padrao?.hora_preco_base ?? null,
    precoAdicional:       baseDu.padrao?.valor_hora_adicional ?? 0,
    precosOcupacao: baseDu.padrao ? {} : Object.fromEntries(
      (baseDu.ocupacoes ?? []).map(o => [o.quantidade_pessoa, o.quantidades?.[0]?.valor ?? 0])
    ),
    horaAdicionalPorPessoa: baseDu.padrao ? 0 : (baseDu.ocupacoes?.[0]?.quantidades?.[0]?.valor_hora_adicional_por_pessoa ?? 0),
  } : { ativo: false, modo: 'padrao', precoFixo: 0, horasBase: null, precoAdicional: 0, precosOcupacao: {}, horaAdicionalPorPessoa: 0 };

  const baseMenor = (cat.menores_idade ?? []).find(m => !m.sazonalidade);
  let criancas = null;
  if (baseMenor) {
    const modo = MENOR_MODO_MAP[baseMenor.modelo] ?? 'taxa-fixa';
    criancas = {
      ativo: true,
      gratuidadeAtiva: baseMenor.idade_gratuidade != null,
      gratuidadeMax:   baseMenor.idade_gratuidade ?? '',
      modo,
      idadeMaxima: baseMenor.taxas_fixas?.[0]?.idade_maxima ?? '',
      valorFixo:   baseMenor.taxas_fixas?.[0]?.valor_por_crianca ?? '',
      entradas: modo === 'taxa-quantidade'
        ? (baseMenor.taxas_por_quantidade ?? []).map(e => ({ quantidade: e.quantidade_crianca, valor: e.valor }))
        : modo === 'porcentagem-quantidade'
        ? (baseMenor.porcentagens_por_quantidade ?? []).map(e => ({ quantidade: e.quantidade, valor: e.porcentagem }))
        : [],
      faixas: (baseMenor.faixas_etarias ?? []).map(f => ({
        idadeMin: f.faixa_etaria?.[0] ?? 0,
        idadeMax: f.faixa_etaria?.[1] ?? 0,
        valor: f.valor,
      })),
      porcentagem: '',
      maxCriancas: '',
    };
  }

  return {
    id:             cat.id,
    nome:           cat.nome,
    descricao:      cat.descricao ?? '',
    hora_checkin:   cat.hora_checkin,
    hora_checkout:  cat.hora_checkout,
    maxPessoas,
    modeloCobranca: isFixo ? 'Por quarto (tarifa fixa)' : 'Por ocupação',
    precoFixo:      isFixo ? baseFixo[0].valor : null,
    precosOcupacao,
    dayUse: du,
    quartosObj:     (cat.quartos     ?? []),
    quartos:        (cat.quartos     ?? []).map(q => q.id),
    sazonaisAtivas: (cat.sazonalidades ?? []).map(s => s.id),
    criancas,
    criado_por:     cat.funcionario  ?? null,
    data_criacao:   cat.data_hora_cadastro ?? null,
  };
}

function seaFromBackend(s) {
  // ── Detect scheduling mode ──────────────────────────────────────────────────
  let modoOperacao = 'data-especifica';
  let dataInicio = '', dataFim = '', horaInicio = '', horaFim = '';
  let diaIntegral = true, horaInicioCiclo = '', horaFimCiclo = '';
  let diasSemana = [], diasMes = [], meses = [];
  const fmtDate = (d) => (d ? d.split('/').reverse().join('-') : '');

  if (s.data_inicio != null) {
    modoOperacao = 'data-especifica';
    dataInicio   = fmtDate(s.data_inicio);
    dataFim      = fmtDate(s.data_fim);
    horaInicio   = s.hora_checkin  ?? '';
    horaFim      = s.hora_checkout ?? '';
  } else if (s.semanal != null) {
    modoOperacao = 'semanal';
    // backend 1-7 (Mon=1, Sun=7) → frontend 0-6 (Sun=0, Mon=1…Sat=6)
    diasSemana = (s.semanal ?? []).map((d) => d % 7);
  } else if (s.mensal != null) {
    modoOperacao = 'mensal';
    diasMes = s.mensal ?? [];
  } else if (s.anual != null) {
    modoOperacao = 'anual';
    // backend 1-12 → frontend 0-11
    meses = (s.anual ?? []).map((m) => m - 1);
  }

  const horaCheckin  = s.hora_checkin  ?? '14:00';
  const horaCheckout = s.hora_checkout ?? '12:00';

  // ── Pricing ─────────────────────────────────────────────────────────────────
  const baseOcc  = (s.modelos_ocupacao ?? []);
  const baseFixo = (s.modelos_fixo    ?? []);
  const isFixo   = baseFixo.length > 0;

  const precosOcupacao = {};
  baseOcc.forEach((m) => { precosOcupacao[m.quantidade] = m.valor; });
  const maxPessoas = baseOcc.length ? Math.max(...baseOcc.map((m) => m.quantidade)) : 5;

  // ── Day Use ──────────────────────────────────────────────────────────────────
  const baseDu = (s.day_use ?? [])[0] ?? null;
  const du = baseDu ? {
    ativo:    baseDu.ativo,
    modo:     baseDu.padrao ? 'padrao' : 'ocupacao',
    precoFixo:            baseDu.padrao?.preco_base ?? 0,
    horasBase:            baseDu.padrao?.hora_preco_base ?? null,
    precoAdicional:       baseDu.padrao?.valor_hora_adicional ?? 0,
    precosOcupacao: baseDu.padrao ? {} : Object.fromEntries(
      (baseDu.ocupacoes ?? []).map((o) => [o.quantidade_pessoa, o.quantidades?.[0]?.valor ?? 0])
    ),
    horaAdicionalPorPessoa: baseDu.padrao ? 0 : (baseDu.ocupacoes?.[0]?.quantidades?.[0]?.valor_hora_adicional_por_pessoa ?? 0),
  } : { ativo: false, modo: 'padrao', precoFixo: 0, horasBase: null, precoAdicional: 0, precosOcupacao: {}, horaAdicionalPorPessoa: 0 };

  // ── Menores ──────────────────────────────────────────────────────────────────
  const baseMenor = (s.menores_idade ?? [])[0] ?? null;
  let criancas = null;
  if (baseMenor) {
    const modo = MENOR_MODO_MAP[baseMenor.modelo] ?? 'taxa-fixa';
    criancas = {
      ativo: true,
      gratuidadeAtiva: baseMenor.idade_gratuidade != null,
      gratuidadeMax:   baseMenor.idade_gratuidade ?? '',
      modo,
      idadeMaxima: baseMenor.taxas_fixas?.[0]?.idade_maxima ?? '',
      valorFixo:   baseMenor.taxas_fixas?.[0]?.valor_por_crianca ?? '',
      entradas: modo === 'taxa-quantidade'
        ? (baseMenor.taxas_por_quantidade ?? []).map((e) => ({ quantidade: e.quantidade_crianca, valor: e.valor }))
        : modo === 'porcentagem-quantidade'
        ? (baseMenor.porcentagens_por_quantidade ?? []).map((e) => ({ quantidade: e.quantidade, valor: e.porcentagem }))
        : [],
      faixas: (baseMenor.faixas_etarias ?? []).map((f) => ({
        idadeMin: f.faixa_etaria?.[0] ?? 0,
        idadeMax: f.faixa_etaria?.[1] ?? 0,
        valor: f.valor,
      })),
      porcentagem: '',
      maxCriancas: '',
    };
  }

  return {
    id:              s.id,
    nome:            s.descricao,
    modoOperacao,
    dataInicio,      dataFim,
    horaInicio,      horaFim,
    diaIntegral,     horaInicioCiclo, horaFimCiclo,
    horaCheckin,     horaCheckout,
    diasSemana,      diasMes,         meses,
    modeloCobranca:  isFixo ? 'Por quarto (tarifa fixa)' : 'Por ocupação',
    precoFixo:       isFixo ? baseFixo[0].valor : null,
    precosOcupacao,
    maxPessoas,
    dayUse:          du,
    criancas,
    categoriasIds:   (s.categorias ?? []).map((c) => c.categoria?.id ?? c.id),
    criado_por:      s.funcionario       ?? null,
    data_criacao:    s.data_hora_cadastro ?? null,
  };
}

const DIAS_SEMANA = [tr('Dom'), tr('Seg'), tr('Ter'), tr('Qua'), tr('Qui'), tr('Sex'), tr('Sáb')];
const MESES_NOME  = [tr('Jan'),tr('Fev'),tr('Mar'),tr('Abr'),tr('Mai'),tr('Jun'),tr('Jul'),tr('Ago'),tr('Set'),tr('Out'),tr('Nov'),tr('Dez')];
const DIAS_MES    = Array.from({ length: 31 }, (_, i) => i + 1);

const MODO_LABEL = {
  'data-especifica': tr('Data Específica'),
  semanal:           tr('Semanal'),
  mensal:            tr('Mensal'),
  anual:             tr('Anual'),
};

/** "2026-12-01" → "01/12/2026". Deixa passar o que não for ISO. */
const fmtDataBR = (d) => (/^\d{4}-\d{2}-\d{2}$/.test(d ?? '') ? d.split('-').reverse().join('/') : (d || ''));

function describeSchedule(s) {
  switch (s.modoOperacao) {
    case 'data-especifica':
      return `${fmtDataBR(s.dataInicio) || '—'} → ${fmtDataBR(s.dataFim) || '—'}  ${s.horaInicio || ''} / ${s.horaFim || ''}`.trim();
    case 'semanal': {
      const dias = (s.diasSemana || []).map((d) => DIAS_SEMANA[d]).join(', ');
      return tr('Semanal · {{v0}} · check-in {{horaCheckin}} / check-out {{horaCheckout}}', { v0: dias || '—', horaCheckin: s.horaCheckin, horaCheckout: s.horaCheckout });
    }
    case 'mensal': {
      const dias = (s.diasMes || []).join(', ');
      return tr('Mensal · dias {{v0}} · check-in {{horaCheckin}} / check-out {{horaCheckout}}', { v0: dias || '—', horaCheckin: s.horaCheckin, horaCheckout: s.horaCheckout });
    }
    case 'anual': {
      const meses = (s.meses || []).map((m) => MESES_NOME[m]).join(', ');
      return tr('Anual · {{v0}} · check-in {{horaCheckin}} / check-out {{horaCheckout}}', { v0: meses || '—', horaCheckin: s.horaCheckin, horaCheckout: s.horaCheckout });
    }
    default: return '';
  }
}

// ── Tab constants ─────────────────────────────────────────────────────────────
const CAT_FORM_TABS   = ['precos', 'dayuse', 'vinculos', 'criancas'];
const CAT_FORM_LABELS = [tr('Preços'), tr('Day Use'), tr('Quartos & Sazonais'), tr('Menores de Idade')];
const SEA_FORM_TABS   = ['agenda', 'categorias', 'precos', 'dayuse', 'criancas'];
const SEA_FORM_LABELS = [tr('Agendamento'), tr('Categorias'), tr('Preços'), tr('Day Use'), tr('Menores de Idade')];


const CRIANCAS_MODO_LABEL = {
  'taxa-fixa':             tr('Taxa adicional fixa'),
  'taxa-quantidade':       tr('Taxa por quantidade'),
  'taxa-faixa':            tr('Taxa por faixa etária'),
  'porcentagem-quantidade':tr('Porcentagem por quantidade'),
};

// ── Blank form factories ──────────────────────────────────────────────────────
const blankCriancas = () => ({
  ativo: false,
  modo: 'taxa-fixa',
  idadeMaxima: '',
  valorFixo: '',
  entradas: [],
  faixas: [],
  porcentagem: '',
  maxCriancas: '',
  gratuidadeAtiva: false,
  gratuidadeMax: '',
});

const blankCat = () => ({
  nome: '', descricao: '', maxPessoas: 5,
  hora_checkin: '14:00', hora_checkout: '12:00',
  modeloCobranca: 'Por ocupação',
  precoFixo: '', precosOcupacao: { 1: '', 2: '', 3: '', 4: '', 5: '' },
  quartos: [], sazonaisAtivas: [],
  dayUse: { ativo: false, modo: 'padrao', precoFixo: '', horasBase: '', precoAdicional: '', precosOcupacao: { 1: '', 2: '', 3: '', 4: '', 5: '' }, horaAdicionalPorPessoa: '' },
  criancas: blankCriancas(),
});

const blankSea = () => ({
  nome: '', descricao: '',
  modoOperacao: 'data-especifica',
  dataInicio: '', dataFim: '', horaInicio: '', horaFim: '',
  diaIntegral: true, horaInicioCiclo: '', horaFimCiclo: '',
  horaCheckin: '14:00', horaCheckout: '12:00',
  diasSemana: [], diasMes: [], meses: [],
  modeloCobranca: 'Por ocupação', maxPessoas: 5,
  precoFixo: '', precosOcupacao: { 1: '', 2: '', 3: '', 4: '', 5: '' },
  dayUse: { ativo: false, modo: 'padrao', precoFixo: '', horasBase: '', precoAdicional: '', precosOcupacao: { 1: '', 2: '', 3: '', 4: '', 5: '' }, horaAdicionalPorPessoa: '' },
  criancas: blankCriancas(),
  categoriasIds: [],
});

function normOcc(occ, max) {
  const n = {};
  for (let i = 1; i <= max; i++) n[i] = occ?.[i] != null ? occ[i] : '';
  return n;
}

// ── Validation ────────────────────────────────────────────────────────────────
function isCatValid(f) {
  if (!f.nome.trim()) return false;
  if (f.modeloCobranca === 'Por quarto (tarifa fixa)') return !!f.precoFixo;
  return !!f.precosOcupacao[1]; // ao menos 1 pessoa preenchida
}

function isSeaValid(f) {
  if (!f.nome.trim()) return false;
  switch (f.modoOperacao) {
    case 'data-especifica':
      if (!f.dataInicio || !f.dataFim || !f.horaInicio || !f.horaFim) return false;
      break;
    case 'semanal':
      if (!f.diasSemana.length || !f.horaCheckin || !f.horaCheckout) return false;
      break;
    case 'mensal':
      if (!f.diasMes.length || !f.horaCheckin || !f.horaCheckout) return false;
      break;
    case 'anual':
      if (!f.meses.length || !f.horaCheckin || !f.horaCheckout) return false;
      break;
    default: break;
  }
  if (f.modeloCobranca === 'Por quarto (tarifa fixa)') return !!f.precoFixo;
  return !!f.precosOcupacao[1];
}

// ── Resumo curto do agendamento — cabe no subtítulo da lista ─────────────────
/** Data específica cuja data final já passou. */
function expirada(s) {
  if (s.modoOperacao !== 'data-especifica' || !s.dataFim) return false;
  const d = new Date();
  const hoje = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  return s.dataFim < hoje;
}

function resumoSchedule(s) {
  switch (s.modoOperacao) {
    case 'data-especifica': return `${fmtDataBR(s.dataInicio) || '—'} → ${fmtDataBR(s.dataFim) || '—'}`;
    case 'semanal': return (s.diasSemana || []).map((d) => DIAS_SEMANA[d]).join(', ') || '—';
    case 'mensal':  return tr('Dias {{v0}}', { v0: (s.diasMes || []).join(', ') || '—' });
    case 'anual':   return (s.meses || []).map((m) => MESES_NOME[m]).join(', ') || '—';
    default: return '';
  }
}

// ── Campo rótulo/valor do painel de detalhe ───────────────────────────────────
function Field({ label, value, lg = false }) {
  const vazio = value == null || value === '';
  return (
    <div>
      <p className={styles.fLabel}>{label}</p>
      <p className={[styles.fVal, lg && !vazio ? styles.fValLg : ''].join(' ')}>{vazio ? '—' : value}</p>
    </div>
  );
}

// ── Pílula ────────────────────────────────────────────────────────────────────
function Pill({ tom = '', children }) {
  return <span className={[styles.tag, tom ? styles[tom] : ''].join(' ')}>{children}</span>;
}

// ── Esqueletos de carregamento ────────────────────────────────────────────────
const sk = (...extra) => [styles.sk, ...extra].join(' ');

function SkeletonLista({ linhas = 7 }) {
  return (
    <div role="status" aria-label={tr('Carregando')}>
      {Array.from({ length: linhas }, (_, i) => (
        <div key={i} className={styles.listItem} aria-hidden="true">
          <span className={styles.listItemBody}>
            <span className={sk(styles.skName)} style={{ width: `${62 + ((i * 13) % 26)}%` }} />
            <span className={sk(styles.skSub)} />
          </span>
        </div>
      ))}
    </div>
  );
}


// ── Sub-components ────────────────────────────────────────────────────────────

function OccTable({ label, occ, maxPessoas }) {
  return (
    <table className={styles.miniTable}>
      <thead><tr><th>{tr('Capacidade')}</th><th>{label}</th></tr></thead>
      <tbody>
        {Array.from({ length: maxPessoas }, (_, i) => i + 1).map((q) => (
          <tr key={q}>
            <td>{q} {q === 1 ? tr('pessoa') : tr('pessoas')}</td>
            <td className={styles.miniPrice}>{fmtBRL(occ?.[q])}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function OccInputs({ occ, maxPessoas, onChange }) {
  return (
    <div className={styles.inputGrid}>
      {Array.from({ length: maxPessoas }, (_, i) => i + 1).map((q) => (
        <div key={q} className={styles.fieldCard}>
          <span className={styles.fieldCardLabel}>{q} {q === 1 ? tr('pessoa') : tr('pessoas')}</span>
          <Input placeholder={tr('R$ 0,00')} value={occ?.[q] ?? ''} onChange={(e) => onChange(q, maskBRL(e.target.value))} />
        </div>
      ))}
    </div>
  );
}



const strToDate = (s) => s ? new Date(s + 'T12:00:00') : null;
const dateToStr = (d) => d ? d.toISOString().slice(0, 10) : '';

function ScheduleFields({ form, onChange }) {
  const mode = form.modoOperacao;
  const toggleDia     = (d) => onChange('diasSemana', form.diasSemana.includes(d) ? form.diasSemana.filter((x) => x !== d) : [...form.diasSemana, d]);
  const toggleMesDia  = (d) => onChange('diasMes',    form.diasMes.includes(d)    ? form.diasMes.filter((x) => x !== d)    : [...form.diasMes,    d]);
  const toggleMes     = (m) => onChange('meses',      form.meses.includes(m)      ? form.meses.filter((x) => x !== m)      : [...form.meses,      m]);

  if (mode === 'data-especifica') return (
    <>
      <div className={styles.formGrid4}>
        <FormField label={tr('Data início *')}>
          <DatePicker value={strToDate(form.dataInicio)} onChange={(d) => onChange('dataInicio', dateToStr(d))} placeholder="DD/MM/AAAA" />
        </FormField>
        <FormField label={tr('Data fim *')}>
          <DatePicker value={strToDate(form.dataFim)} onChange={(d) => onChange('dataFim', dateToStr(d))} placeholder="DD/MM/AAAA" />
        </FormField>
        <FormField label={tr('Check-in *')}><TimePicker value={form.horaInicio} onChange={(v) => onChange('horaInicio', v)} /></FormField>
        <FormField label={tr('Check-out *')}><TimePicker value={form.horaFim} onChange={(v) => onChange('horaFim', v)} /></FormField>
      </div>
    </>
  );


  if (mode === 'semanal') return (
    <>
      <FormField label={tr('Dias da semana *')}>
        <div className={styles.chipGroup}>
          {DIAS_SEMANA.map((d, i) => (
            <button key={i} type="button" className={[styles.chip, form.diasSemana.includes(i) ? styles.chipActive : ''].join(' ')} onClick={() => toggleDia(i)}>{d}</button>
          ))}
        </div>
      </FormField>
      <div className={styles.formRow}>
        <FormField label={tr('Check-in *')}><TimePicker value={form.horaCheckin} onChange={(v) => onChange('horaCheckin', v)} /></FormField>
        <FormField label={tr('Check-out *')}><TimePicker value={form.horaCheckout} onChange={(v) => onChange('horaCheckout', v)} /></FormField>
      </div>
    </>
  );

  if (mode === 'mensal') return (
    <>
      <FormField label={tr('Dias do mês *')}>
        <div className={styles.dayGrid}>
          {DIAS_MES.map((d) => (
            <button key={d} type="button" className={[styles.chip, form.diasMes.includes(d) ? styles.chipActive : ''].join(' ')} onClick={() => toggleMesDia(d)}>{d}</button>
          ))}
        </div>
      </FormField>
      <div className={styles.formRow}>
        <FormField label={tr('Check-in *')}><TimePicker value={form.horaCheckin} onChange={(v) => onChange('horaCheckin', v)} /></FormField>
        <FormField label={tr('Check-out *')}><TimePicker value={form.horaCheckout} onChange={(v) => onChange('horaCheckout', v)} /></FormField>
      </div>
    </>
  );

  if (mode === 'anual') return (
    <>
      <FormField label={tr('Meses *')}>
        <div className={styles.chipGroup}>
          {MESES_NOME.map((m, i) => (
            <button key={i} type="button" className={[styles.chip, form.meses.includes(i) ? styles.chipActive : ''].join(' ')} onClick={() => toggleMes(i)}>{m}</button>
          ))}
        </div>
      </FormField>
      <div className={styles.formRow}>
        <FormField label={tr('Check-in *')}><TimePicker value={form.horaCheckin} onChange={(v) => onChange('horaCheckin', v)} /></FormField>
        <FormField label={tr('Check-out *')}><TimePicker value={form.horaCheckout} onChange={(v) => onChange('horaCheckout', v)} /></FormField>
      </div>
    </>
  );
  return null;
}

function PricingFields({ form, setField, setOcc }) {
  const modelo     = form.modeloCobranca;
  const maxPessoas = form.maxPessoas;
  const occ        = form.precosOcupacao ?? {};

  const handleMaxChange = (val) => {
    const max = Math.min(10, Math.max(1, Number(val)));
    setField('maxPessoas', max);
    setField('precosOcupacao', normOcc(occ, max));
    if (form.dayUse?.modo === 'ocupacao') {
      setField('dayUse', { ...form.dayUse, precosOcupacao: normOcc(form.dayUse.precosOcupacao, max) });
    }
  };

  const handleModeloChange = (m) => {
    setField('modeloCobranca', m);
    if (m === 'Por quarto (tarifa fixa)') setField('precosOcupacao', {});
    else setField('precoFixo', '');
  };

  return (
    <>
      <div className={styles.sectionTitle}>{tr('Hospedagem')}</div>
      <div className={styles.formGrid4}>
        <div className={styles.span2}>
          <FormField label={tr('Modelo de cobrança')}>
            <Select value={modelo} onChange={(e) => handleModeloChange(e.target.value)}>
              <option value="Por ocupação">{tr('Por ocupação')}</option>
              <option value="Por quarto (tarifa fixa)">{tr('Por quarto (tarifa fixa)')}</option>
            </Select>
          </FormField>
        </div>
        {modelo === 'Por quarto (tarifa fixa)' ? (
          <FormField label={tr('Tarifa fixa (R$) *')}>
            <Input placeholder={tr('R$ 0,00')} value={form.precoFixo} onChange={(e) => setField('precoFixo', maskBRL(e.target.value))} />
          </FormField>
        ) : (
          <FormField label={tr('Máximo de pessoas')}>
            <Input type="number" min="1" max="10" value={maxPessoas} onChange={(e) => handleMaxChange(e.target.value)} />
          </FormField>
        )}
      </div>
      {modelo !== 'Por quarto (tarifa fixa)' && (
        <>
          <div className={styles.sectionTitle}>{tr('Preço por número de hóspedes *')}</div>
          <OccInputs occ={occ} maxPessoas={maxPessoas} onChange={(q, v) => setOcc(q, v)} />
        </>
      )}
    </>
  );
}

function DayUseFields({ du, maxPessoas, onChange }) {
  const setDu = (key, val) => onChange({ ...du, [key]: val });
  const handleModoChange = (modo) => {
    if (modo === 'padrao') onChange({ ...du, modo, precosOcupacao: {}, horaAdicionalPorPessoa: '' });
    else onChange({ ...du, modo, precosOcupacao: normOcc(du.precosOcupacao, maxPessoas) });
  };

  return (
    <>
      <label className={styles.checkboxRow}>
        <input type="checkbox" className={styles.checkbox} checked={du.ativo} onChange={(e) => setDu('ativo', e.target.checked)} />
        <div>
          <span className={styles.checkboxLabel}>{tr('Habilitar Day Use')}</span>
          <span className={styles.checkboxSub}>{tr('Permite uso do quarto por quantidade de horas')}</span>
        </div>
      </label>
      {du.ativo && (
        <>
          <FormField label={tr('Modo Day Use')}>
            <Select value={du.modo} onChange={(e) => handleModoChange(e.target.value)}>
              <option value="padrao">{tr('Padrão (preço base + hora adicional)')}</option>
              <option value="ocupacao">{tr('Por ocupação (preço varia por hóspedes)')}</option>
            </Select>
          </FormField>
          {du.modo === 'padrao' ? (
            <>
              <div className={styles.formRow}>
                <FormField label={tr('Preço base')}><Input placeholder={tr('R$ 0,00')} value={du.precoFixo} onChange={(e) => setDu('precoFixo', maskBRL(e.target.value))} /></FormField>
                <FormField label={tr('Horas (Preço Base)')}><Input type="number" min="1" placeholder={tr('Ex: 4')} value={du.horasBase} onChange={(e) => setDu('horasBase', e.target.value)} /></FormField>
                <FormField label={tr('Valor da Hora adicional')}><Input placeholder={tr('R$ 0,00')} value={du.precoAdicional} onChange={(e) => setDu('precoAdicional', maskBRL(e.target.value))} /></FormField>
              </div>
            </>
          ) : (
            <>
              <FormField label={tr('Hora adicional por pessoa')}>
                <Input placeholder={tr('R$ 0,00')} value={du.horaAdicionalPorPessoa} onChange={(e) => setDu('horaAdicionalPorPessoa', maskBRL(e.target.value))} />
              </FormField>
              <div className={styles.sectionTitle}>{tr('Preços por hóspedes')}</div>
              <OccInputs occ={du.precosOcupacao} maxPessoas={maxPessoas}
                onChange={(q, v) => onChange({ ...du, precosOcupacao: { ...du.precosOcupacao, [q]: v } })} />
            </>
          )}
        </>
      )}
    </>
  );
}

// ── ChildPricingFields ────────────────────────────────────────────────────────
function ChildPricingFields({ criancas, onChange }) {
  const set = (key, val) => onChange({ ...criancas, [key]: val });

  const addEntrada = () =>
    set('entradas', [...criancas.entradas, { quantidade: criancas.entradas.length + 1, valor: '' }]);
  const removeEntrada = (i) =>
    set('entradas', criancas.entradas.filter((_, idx) => idx !== i));
  const setEntrada = (i, field, val) =>
    set('entradas', criancas.entradas.map((e, idx) => idx === i ? { ...e, [field]: val } : e));

  const addFaixa = () =>
    set('faixas', [...criancas.faixas, { idadeMin: '', idadeMax: '', valor: '' }]);
  const removeFaixa = (i) =>
    set('faixas', criancas.faixas.filter((_, idx) => idx !== i));
  const setFaixa = (i, field, val) =>
    set('faixas', criancas.faixas.map((f, idx) => idx === i ? { ...f, [field]: val } : f));

  const handleModoChange = (modo) => onChange({ ...criancas, modo, entradas: [], faixas: [] });

  return (
    <>
      <label className={styles.checkboxRow}>
        <input type="checkbox" className={styles.checkbox} checked={criancas.ativo} onChange={(e) => set('ativo', e.target.checked)} />
        <div>
          <span className={styles.checkboxLabel}>{tr('Habilitar cobrança de menores de idade')}</span>
          <span className={styles.checkboxSub}>{tr('Define tarifas específicas para crianças')}</span>
        </div>
      </label>

      {criancas.ativo && (
        <>
          <div className={styles.gratuidadeBox}>
            <label className={styles.checkboxRow} style={{ marginBottom: 0, background: 'none', border: 'none', padding: 0 }}>
              <input type="checkbox" className={styles.checkbox}
                checked={criancas.gratuidadeAtiva}
                onChange={(e) => set('gratuidadeAtiva', e.target.checked)} />
              <div>
                <span className={styles.checkboxLabel}>{tr('Faixa de gratuidade')}</span>
                <span className={styles.checkboxSub}>{tr('Crianças nessa faixa etária não pagam, independente do modelo de cobrança')}</span>
              </div>
            </label>
            {criancas.gratuidadeAtiva && (
              <div style={{ marginTop: 12 }}>
                <FormField label={tr('Gratuito até (anos)')}>
                  <Input type="number" min="0" max="17" placeholder={tr('Ex: 5')}
                    value={criancas.gratuidadeMax}
                    onChange={(e) => set('gratuidadeMax', e.target.value)} />
                </FormField>
              </div>
            )}
          </div>

          <FormField label={tr('Modelo de cobrança')}>
            <Select value={criancas.modo} onChange={(e) => handleModoChange(e.target.value)}>
              {Object.entries(CRIANCAS_MODO_LABEL).map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </Select>
          </FormField>

          {/* ── Taxa adicional fixa ── */}
          {criancas.modo === 'taxa-fixa' && (
            <div className={styles.formRow}>
              <FormField label={tr('Idade máxima (anos)')}>
                <Input type="number" min="0" max="17" placeholder={tr('Ex: 12')}
                  value={criancas.idadeMaxima}
                  onChange={(e) => set('idadeMaxima', e.target.value)} />
              </FormField>
              <FormField label={tr('Valor fixo por criança')}>
                <Input placeholder={tr('R$ 0,00')}
                  value={criancas.valorFixo}
                  onChange={(e) => set('valorFixo', maskBRL(e.target.value))} />
              </FormField>
            </div>
          )}

          {/* ── Taxa por quantidade ── */}
          {criancas.modo === 'taxa-quantidade' && (
            <>
              <div className={styles.sectionTitle}>{tr('Valores por quantidade de crianças')}</div>
              <div className={styles.inputGrid}>
                {criancas.entradas.map((e, i) => (
                  <div key={i} className={styles.fieldCard}>
                    <span className={styles.fieldCardLabel}>{e.quantidade} {tr('criança')}{e.quantidade > 1 ? 's' : ''}</span>
                    <div className={styles.fieldCardRow}>
                      <Input placeholder={tr('R$ 0,00')} value={e.valor}
                        onChange={(ev) => setEntrada(i, 'valor', maskBRL(ev.target.value))} />
                      <button type="button" className={styles.childRemoveBtn} onClick={() => removeEntrada(i)}>
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              <Button className={[styles.btnSolid, styles.btnAdd].join(' ')} onClick={addEntrada}>
                <Plus size={13} /> {tr('Adicionar linha')}
              </Button>
            </>
          )}

          {/* ── Taxa por faixa etária ── */}
          {criancas.modo === 'taxa-faixa' && (
            <>
              <div className={styles.sectionTitle}>{tr('Faixas etárias')}</div>
              <div className={styles.inputGrid}>
                {criancas.faixas.map((f, i) => (
                  <div key={i} className={styles.fieldCard}>
                    <span className={styles.fieldCardLabel}>{tr('Faixa')} {i + 1}</span>
                    <div className={styles.fieldCardRow}>
                      <Input type="number" min="0" max="17" placeholder={tr('De')}
                        className={styles.childInputAge} value={f.idadeMin}
                        onChange={(ev) => setFaixa(i, 'idadeMin', ev.target.value)} />
                      <span className={styles.childSep}>–</span>
                      <Input type="number" min="0" max="17" placeholder={tr('Até')}
                        className={styles.childInputAge} value={f.idadeMax}
                        onChange={(ev) => setFaixa(i, 'idadeMax', ev.target.value)} />
                      <span className={styles.childSep}>{tr('anos')}</span>
                    </div>
                    <div className={styles.fieldCardRow}>
                      <Input placeholder={tr('R$ 0,00')} className={styles.childInputVal} value={f.valor}
                        onChange={(ev) => setFaixa(i, 'valor', maskBRL(ev.target.value))} />
                      <button type="button" className={styles.childRemoveBtn} onClick={() => removeFaixa(i)}>
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              <Button className={[styles.btnSolid, styles.btnAdd].join(' ')} onClick={addFaixa}>
                <Plus size={13} /> {tr('Adicionar faixa')}
              </Button>
            </>
          )}

          {/* ── Porcentagem por quantidade ── */}
          {criancas.modo === 'porcentagem-quantidade' && (
            <>
              <div className={styles.sectionTitle}>{tr('Porcentagem por quantidade de crianças')}</div>
              <div className={styles.inputGrid}>
                {criancas.entradas.map((e, i) => (
                  <div key={i} className={styles.fieldCard}>
                    <span className={styles.fieldCardLabel}>{e.quantidade} {tr('criança')}{e.quantidade > 1 ? 's' : ''}</span>
                    <div className={styles.fieldCardRow}>
                      <Input type="number" min="0" max="100" placeholder="%" value={e.valor}
                        onChange={(ev) => setEntrada(i, 'valor', ev.target.value)} />
                      <button type="button" className={styles.childRemoveBtn} onClick={() => removeEntrada(i)}>
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              <Button className={[styles.btnSolid, styles.btnAdd].join(' ')} onClick={addEntrada}>
                <Plus size={13} /> {tr('Adicionar linha')}
              </Button>
            </>
          )}
        </>
      )}
    </>
  );
}

// ── ChildPricingDisplay ───────────────────────────────────────────────────────
function ChildPricingDisplay({ criancas }) {
  const modo = criancas?.modo;
  return (
    <div className={styles.rowsBlock}>
      {criancas?.gratuidadeAtiva && (
        <div className={styles.gratuidadeDisplay}>
          <span className={styles.gratuidadeDisplayLabel}>{tr('Gratuidade')}</span>
          <span className={styles.gratuidadeDisplayVal}>
            0–{criancas.gratuidadeMax} {tr('anos (isento de cobrança)')}
          </span>
        </div>
      )}
      {!criancas?.ativo ? (
        <div className={styles.duInactive}>{tr('Cobrança de menores não configurada.')}</div>
      ) : (
      <>
      <div className={styles.duRow}>
        <span className={styles.duLabel}>{tr('Modelo')}</span>
        <span className={styles.duVal}>{CRIANCAS_MODO_LABEL[modo] ?? modo}</span>
      </div>
      {modo === 'taxa-fixa' && (
        <>
          <div className={styles.duRow}><span className={styles.duLabel}>{tr('Idade máxima')}</span><span className={styles.duVal}>{criancas.idadeMaxima} {tr('anos')}</span></div>
          <div className={styles.duRow}><span className={styles.duLabel}>{tr('Valor por criança')}</span><span className={styles.duVal}>{fmtBRL(parseBRL(criancas.valorFixo))}</span></div>
        </>
      )}
      {(modo === 'taxa-quantidade' || modo === 'porcentagem-quantidade') && (
        <table className={styles.miniTable}>
          <thead><tr><th>{tr('Qtd')}</th><th>{modo === 'taxa-quantidade' ? tr('Valor') : '%'}</th></tr></thead>
          <tbody>
            {(criancas.entradas ?? []).map((e, i) => (
              <tr key={i}>
                <td>{e.quantidade} {tr('criança')}{e.quantidade > 1 ? 's' : ''}</td>
                <td className={styles.miniPrice}>
                  {modo === 'taxa-quantidade' ? fmtBRL(parseBRL(e.valor)) : `${e.valor}%`}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {modo === 'taxa-faixa' && (
        <table className={styles.miniTable}>
          <thead><tr><th>{tr('Faixa')}</th><th>{tr('Valor')}</th></tr></thead>
          <tbody>
            {(criancas.faixas ?? []).map((f, i) => (
              <tr key={i}>
                <td>{f.idadeMin}–{f.idadeMax} {tr('anos')}</td>
                <td className={styles.miniPrice}>{fmtBRL(parseBRL(f.valor))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      </>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function PricingManagement() {
  const [data, setData]           = useState({ categorias: [], sazonalidades: [] });
  const [quartos, setQuartos]     = useState([]);
  const [loading, setLoading]     = useState(true);
  const [notification, setNotif]  = useState(null);

  // Lista: aba corrente e busca
  const [aba, setAba]               = useState('cat'); // 'cat' | 'sea'
  const [searchTerm, setSearchTerm] = useState('');

  // Ficha aberta no painel de detalhe
  const [detailItem, setDetailItem] = useState(null);
  const [detailType, setDetailType] = useState(null); // 'cat' | 'sea'
  // aba aberta na ficha: dados | precos | dayuse | menores | vinculos/categorias
  const [abaFicha, setAbaFicha]     = useState('dados');

  // desktop: sem ficha aberta, o cadastro da aba atual já fica aberto na direita
  const [isDesktop, setIsDesktop] = useState(() => window.matchMedia('(min-width: 1024px)').matches);
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)');
    const onChange = (e) => setIsDesktop(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  // Category form modal
  const [catModal, setCatModal]     = useState(null);
  const [editingCat, setEditingCat] = useState(null);
  const [catForm, setCatForm]       = useState(blankCat());
  const [catTab, setCatTab]         = useState('precos');
  const [catSaving, setCatSaving]   = useState(false);

  // Seasonal form modal
  const [seaModal, setSeaModal]     = useState(null);
  const [editingSea, setEditingSea] = useState(null);
  const [seaForm, setSeaForm]       = useState(blankSea());
  const [seaTab, setSeaTab]         = useState('agenda');
  const [seaSaving, setSeaSaving]   = useState(false);

  // Delete confirm
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting]         = useState(false);

  // ── Helpers ────────────────────────────────────────────────────────────────
  const notify = (message, type = 'success') => {
    setNotif({ message, type });
    setTimeout(() => setNotif(null), 3500);
  };

  // ── Load ──────────────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [catPage, quartoPage, seaPage] = await Promise.all([
        quartoCategoriApi.listar({ size: 900 }),
        quartoApi.listar(),
        sazonalidadeApi.listar({ size: 900 }),
      ]);
      setData({
        categorias:    (Array.isArray(catPage)  ? catPage  : (catPage.content  ?? [])).map(catFromBackend),
        sazonalidades: (Array.isArray(seaPage)  ? seaPage  : (seaPage.content  ?? [])).map(seaFromBackend),
      });
      setQuartos(Array.isArray(quartoPage) ? quartoPage : (quartoPage.content ?? []));
    } catch (e) {
      notify(tr('Erro ao carregar dados: ') + e.message, 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const { categorias, sazonalidades } = data;

  // ── Qual formulário ocupa a direita ───────────────────────────────────────
  // Aberto pelo "Cadastrar"/"Editar" (explícito) ou, no desktop sem ficha
  // aberta, o cadastro da aba atual — como na tela de Cadastros.
  const formExplicito = !!(catModal || seaModal);
  const formAtivo = catModal ? 'cat' : seaModal ? 'sea'
    : (!detailItem && isDesktop ? (aba === 'sea' ? 'sea' : 'cat') : null);
  const formModo = formAtivo === 'cat' ? (catModal ?? 'create')
    : formAtivo === 'sea' ? (seaModal ?? 'create') : null;

  const formSujo = () => {
    if (formModo === 'edit') return true;
    if (formAtivo === 'cat') return JSON.stringify(catForm) !== JSON.stringify(blankCat());
    if (formAtivo === 'sea') return JSON.stringify(seaForm) !== JSON.stringify(blankSea());
    return false;
  };

  /** Fecha o formulário aberto; com algo digitado, pergunta antes. */
  const descartarForm = () => {
    if (formSujo() && !window.confirm(formModo === 'edit'
      ? tr('Deseja descartar as alterações em andamento?')
      : tr('Deseja descartar o cadastro em andamento?'))) return false;
    setCatModal(null); setSeaModal(null);
    setEditingCat(null); setEditingSea(null);
    setCatForm(blankCat()); setSeaForm(blankSea());
    setCatTab('precos'); setSeaTab('agenda');
    return true;
  };
  const cancelarForm = () => { descartarForm(); };

  // ── Painel de detalhe ─────────────────────────────────────────────────────
  const openDetail = (item, type) => {
    if (!descartarForm()) return;
    setDetailItem(item); setDetailType(type); setAbaFicha('dados');
  };
  const closeDetail = () => { setDetailItem(null); setDetailType(null); };

  // Trocar de aba fecha a ficha aberta — ela é da outra lista.
  const changeAba = (nova) => {
    if (nova === aba) return;
    if (!descartarForm()) return;
    setAba(nova); setSearchTerm(''); closeDetail();
  };

  // Ao abrir a tela no desktop, já mostra as tarifas da primeira categoria.
  const fichaInicial = useRef(false);
  useEffect(() => {
    if (fichaInicial.current || !isDesktop || !categorias.length) return;
    fichaInicial.current = true;
    if (detailItem || catModal || seaModal) return;
    setDetailItem(categorias[0]); setDetailType('cat'); setAbaFicha('precos');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categorias, isDesktop]);

  // Depois de salvar, `load()` recria os objetos: a ficha aberta precisa
  // apontar para a versão nova, ou fica mostrando os dados antigos.
  useEffect(() => {
    if (!detailItem) return;
    const lista = detailType === 'sea' ? sazonalidades : categorias;
    const fresco = lista.find((x) => x.id === detailItem.id);
    if (!fresco) closeDetail();
    else if (fresco !== detailItem) setDetailItem(fresco);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categorias, sazonalidades]);

  // ── Category form ──────────────────────────────────────────────────────────
  const advanceCatTab = () => {
    const idx  = CAT_FORM_TABS.indexOf(catTab);
    setCatTab(CAT_FORM_TABS[(idx + 1) % CAT_FORM_TABS.length]);
  };

  const openCreateCat = () => { if (!descartarForm()) return; closeDetail(); setCatModal('create'); };

  const openEditCat = (cat) => {
    const occ = normOcc(cat.precosOcupacao, cat.maxPessoas);
    const du  = cat.dayUse ?? {};
    setCatForm({
      nome:           cat.nome,
      descricao:      cat.descricao,
      hora_checkin:   cat.hora_checkin  ?? '14:00',
      hora_checkout:  cat.hora_checkout ?? '12:00',
      maxPessoas:     cat.maxPessoas,
      modeloCobranca: cat.modeloCobranca,
      precoFixo:      cat.precoFixo != null ? maskBRL(String(Math.round(cat.precoFixo * 100))) : '',
      precosOcupacao: Object.fromEntries(Object.entries(occ).map(([k, v]) => [k, v != null ? maskBRL(String(Math.round(v * 100))) : ''])),
      quartos:        cat.quartos ?? [],
      sazonaisAtivas: cat.sazonaisAtivas ?? [],
      criancas: cat.criancas ? {
        ...blankCriancas(),
        ...cat.criancas,
        valorFixo:   cat.criancas.valorFixo   != null ? maskBRL(String(Math.round(cat.criancas.valorFixo * 100)))   : '',
        entradas:   (cat.criancas.entradas ?? []).map(e => ({
          ...e,
          valor: e.valor != null
            ? (cat.criancas.modo === 'porcentagem-quantidade' ? String(e.valor) : maskBRL(String(Math.round(e.valor * 100))))
            : '',
        })),
        faixas: (cat.criancas.faixas ?? []).map(f => ({
          ...f,
          valor: f.valor != null ? maskBRL(String(Math.round(f.valor * 100))) : '',
        })),
      } : blankCriancas(),
      dayUse: {
        ativo:                du.ativo ?? false,
        modo:                 du.modo ?? 'padrao',
        precoFixo:            du.precoFixo != null ? maskBRL(String(Math.round(du.precoFixo * 100))) : '',
        horasBase:            du.horasBase != null ? String(du.horasBase) : '',
        precoAdicional:       du.precoAdicional != null ? maskBRL(String(Math.round(du.precoAdicional * 100))) : '',
        horaAdicionalPorPessoa: du.horaAdicionalPorPessoa != null ? maskBRL(String(Math.round(du.horaAdicionalPorPessoa * 100))) : '',
        precosOcupacao:       Object.fromEntries(
          Object.entries(normOcc(du.precosOcupacao, cat.maxPessoas))
            .map(([k, v]) => [k, v != null ? maskBRL(String(Math.round(v * 100))) : ''])
        ),
      },
    });
    setEditingCat(cat);
    setCatTab('precos');
    setCatModal('edit');
  };

  const setCatField = (key, val) => setCatForm((f) => ({ ...f, [key]: val }));
  const setCatOcc   = (q, val)   => setCatForm((f) => ({ ...f, precosOcupacao: { ...f.precosOcupacao, [q]: val } }));
  const toggleCatQuarto   = (id) => setCatField('quartos',       catForm.quartos.includes(id)       ? catForm.quartos.filter((x) => x !== id)       : [...catForm.quartos, id]);
  const toggleCatSazonais = (id) => setCatField('sazonaisAtivas', catForm.sazonaisAtivas.includes(id) ? catForm.sazonaisAtivas.filter((x) => x !== id) : [...catForm.sazonaisAtivas, id]);

  const handleSaveCat = async () => {
    setCatSaving(true);
    try {
      const f      = catForm;
      const isFixo = f.modeloCobranca === 'Por quarto (tarifa fixa)';
      const maxPax = Number(f.maxPessoas) || 5;

      const modelos_ocupacao = isFixo ? [] :
        Array.from({ length: maxPax }, (_, i) => ({
          quantidade: i + 1,
          valor: parseBRL(f.precosOcupacao[i + 1] ?? ''),
        }));

      const modelos_fixo = isFixo ? [{ valor: parseBRL(f.precoFixo) }] : [];

      const du = f.dayUse;
      const day_use = du.ativo ? [{
        ativo: true,
        padrao: du.modo !== 'ocupacao' ? {
          preco_base:            parseBRL(du.precoFixo ?? ''),
          hora_preco_base:       Number(du.horasBase) || 0,
          valor_hora_adicional:  parseBRL(du.precoAdicional ?? '') || null,
        } : null,
        ocupacoes: du.modo === 'ocupacao'
          ? Object.entries(du.precosOcupacao)
              .filter(([, v]) => parseBRL(v) > 0)
              .map(([k, v]) => ({
                quantidade_pessoa: Number(k),
                quantidades: [{ quantidade: 1, valor: parseBRL(v), valor_hora_adicional_por_pessoa: parseBRL(du.horaAdicionalPorPessoa) || null }],
              }))
          : [],
      }] : null;

      const MODO_ENUM = {
        'taxa-fixa':              'TAXA_ADICIONAL_FIXA',
        'taxa-quantidade':        'TAXA_POR_QUANTIDADE',
        'taxa-faixa':             'TAXA_POR_FAIXA_ETARIA',
        'porcentagem-quantidade': 'PORCENTAGEM_POR_QUANTIDADE',
      };
      const c = f.criancas;
      const menores_idade = c.ativo ? [{
        idade_gratuidade: c.gratuidadeAtiva ? Number(c.gratuidadeMax) || null : null,
        modelo: MODO_ENUM[c.modo],
        taxas_fixas: c.modo === 'taxa-fixa'
          ? [{ idade_maxima: Number(c.idadeMaxima) || 0, valor_por_crianca: parseBRL(c.valorFixo) }]
          : [],
        taxas_por_quantidade: c.modo === 'taxa-quantidade'
          ? c.entradas.map(e => ({ quantidade_crianca: e.quantidade, valor: parseBRL(e.valor) }))
          : [],
        faixas_etarias: c.modo === 'taxa-faixa'
          ? c.faixas.map(fi => ({ faixa_etaria: [Number(fi.idadeMin), Number(fi.idadeMax)], valor: parseBRL(fi.valor) }))
          : [],
        porcentagens_por_quantidade: c.modo === 'porcentagem-quantidade'
          ? c.entradas.map(e => ({ quantidade: e.quantidade, porcentagem: Number(e.valor) || 0 }))
          : [],
      }] : [];

      const payload = {
        nome:             f.nome.trim(),
        descricao:        f.descricao.trim() || null,
        hora_checkin:     f.hora_checkin  || null,
        hora_checkout:    f.hora_checkout || null,
        modelos_ocupacao,
        modelos_fixo,
        day_use,
        fk_quartos:       f.quartos,
        fk_sazonalidades: f.sazonaisAtivas,
        menores_idade,
      };

      if (catModal !== 'edit') {
        await quartoCategoriApi.criar(payload);
        notify(tr('Categoria criada com sucesso!'));
      } else {
        await quartoCategoriApi.atualizar({ id: editingCat.id, ...payload });
        notify(tr('Categoria atualizada com sucesso!'));
      }
      setCatModal(null); setEditingCat(null);
      setCatForm(blankCat()); setCatTab('precos');
      load();
    } catch (e) {
      notify(tr('Erro: ') + e.message, 'error');
    } finally {
      setCatSaving(false);
    }
  };

  // ── Seasonal form ──────────────────────────────────────────────────────────
  const advanceSeaTab = () => {
    const idx = SEA_FORM_TABS.indexOf(seaTab);
    setSeaTab(SEA_FORM_TABS[(idx + 1) % SEA_FORM_TABS.length]);
  };

  const openCreateSea = () => { if (!descartarForm()) return; closeDetail(); setSeaModal('create'); };

  const openEditSea = (s) => {
    const occ = normOcc(s.precosOcupacao, s.maxPessoas);
    const du  = s.dayUse ?? {};
    setSeaForm({
      nome:            s.nome,
      descricao:       s.descricao,
      modoOperacao:    s.modoOperacao,
      dataInicio:      s.dataInicio || '', dataFim: s.dataFim || '',
      horaInicio:      s.horaInicio || '', horaFim: s.horaFim || '',
      diaIntegral:     s.diaIntegral ?? true,
      horaInicioCiclo: s.horaInicioCiclo || '', horaFimCiclo: s.horaFimCiclo || '',
      horaCheckin:     s.horaCheckin || '14:00', horaCheckout: s.horaCheckout || '12:00',
      diasSemana:      s.diasSemana || [], diasMes: s.diasMes || [], meses: s.meses || [],
      modeloCobranca:  s.modeloCobranca, maxPessoas: s.maxPessoas,
      precoFixo:       s.precoFixo != null ? maskBRL(String(Math.round(s.precoFixo * 100))) : '',
      precosOcupacao:  Object.fromEntries(Object.entries(occ).map(([k, v]) => [k, v != null ? maskBRL(String(Math.round(v * 100))) : ''])),
      dayUse: {
        ativo:                du.ativo ?? false, modo: du.modo ?? 'padrao',
        precoFixo:            du.precoFixo != null ? maskBRL(String(Math.round(du.precoFixo * 100))) : '',
        horasBase:            du.horasBase != null ? String(du.horasBase) : '',
        precoAdicional:       du.precoAdicional != null ? maskBRL(String(Math.round(du.precoAdicional * 100))) : '',
        horaAdicionalPorPessoa: du.horaAdicionalPorPessoa != null ? maskBRL(String(Math.round(du.horaAdicionalPorPessoa * 100))) : '',
        precosOcupacao:       Object.fromEntries(
          Object.entries(normOcc(du.precosOcupacao, s.maxPessoas))
            .map(([k, v]) => [k, v != null ? maskBRL(String(Math.round(v * 100))) : ''])
        ),
      },
      criancas: s.criancas ? {
        ...blankCriancas(),
        ...s.criancas,
        valorFixo: s.criancas.valorFixo != null ? maskBRL(String(Math.round(s.criancas.valorFixo * 100))) : '',
        entradas: (s.criancas.entradas ?? []).map(e => ({ ...e, valor: e.valor != null ? maskBRL(String(Math.round(e.valor * 100))) : '' })),
        faixas:   (s.criancas.faixas   ?? []).map(f => ({ ...f, valor: f.valor != null ? maskBRL(String(Math.round(f.valor * 100))) : '' })),
      } : blankCriancas(),
      categoriasIds: s.categoriasIds ?? [],
    });
    setEditingSea(s);
    setSeaTab('agenda');
    setSeaModal('edit');
  };

  const setSeaField = (key, val) => setSeaForm((f) => ({ ...f, [key]: val }));
  const setSeaOcc   = (q, val)   => setSeaForm((f) => ({ ...f, precosOcupacao: { ...f.precosOcupacao, [q]: val } }));

  const toggleSeaCat = (catId) => setSeaForm((f) => ({
    ...f,
    categoriasIds: f.categoriasIds.includes(catId)
      ? f.categoriasIds.filter((id) => id !== catId)
      : [...f.categoriasIds, catId],
  }));

  const preencherDeCat = (cat) => {
    const max = cat.maxPessoas ?? 5;
    const du  = cat.dayUse ?? {};
    setSeaForm((f) => ({
      ...f,
      modeloCobranca: cat.modeloCobranca,
      maxPessoas:     max,
      precoFixo:      cat.precoFixo != null ? maskBRL(String(Math.round(cat.precoFixo * 100))) : '',
      precosOcupacao: Object.fromEntries(
        Array.from({ length: max }, (_, i) => i + 1).map((k) => [
          k, cat.precosOcupacao?.[k] != null ? maskBRL(String(Math.round(cat.precosOcupacao[k] * 100))) : '',
        ])
      ),
      dayUse: {
        ativo:                du.ativo ?? false, modo: du.modo ?? 'padrao',
        precoFixo:            du.precoFixo != null ? maskBRL(String(Math.round(du.precoFixo * 100))) : '',
        horasBase:            du.horasBase != null ? String(du.horasBase) : '',
        precoAdicional:       du.precoAdicional != null ? maskBRL(String(Math.round(du.precoAdicional * 100))) : '',
        horaAdicionalPorPessoa: du.horaAdicionalPorPessoa != null ? maskBRL(String(Math.round(du.horaAdicionalPorPessoa * 100))) : '',
        precosOcupacao: Object.fromEntries(
          Array.from({ length: max }, (_, i) => i + 1).map((k) => [
            k, du.precosOcupacao?.[k] != null ? maskBRL(String(Math.round(du.precosOcupacao[k] * 100))) : '',
          ])
        ),
      },
      criancas: cat.criancas ? {
        ...blankCriancas(),
        ...cat.criancas,
        valorFixo: cat.criancas.valorFixo != null ? maskBRL(String(Math.round(cat.criancas.valorFixo * 100))) : '',
        entradas: (cat.criancas.entradas ?? []).map(e => ({ ...e, valor: e.valor != null ? maskBRL(String(Math.round(e.valor * 100))) : '' })),
        faixas:   (cat.criancas.faixas   ?? []).map(fi => ({ ...fi, valor: fi.valor != null ? maskBRL(String(Math.round(fi.valor * 100))) : '' })),
      } : blankCriancas(),
    }));
  };

  const handleSaveSea = async () => {
    setSeaSaving(true);
    try {
      const f      = seaForm;
      const isFixo = f.modeloCobranca === 'Por quarto (tarifa fixa)';
      const maxPax = Number(f.maxPessoas) || 5;
      const fmtDateOut = (d) => (d ? d.split('-').reverse().join('/') : null);

      // ── Scheduling ──────────────────────────────────────────────────────────
      const scheduleFields = {};
      if (f.modoOperacao === 'data-especifica') {
        scheduleFields.data_inicio  = fmtDateOut(f.dataInicio);
        scheduleFields.data_fim     = fmtDateOut(f.dataFim);
        scheduleFields.hora_checkin  = f.horaInicio || null;
        scheduleFields.hora_checkout = f.horaFim    || null;
      } else {
        scheduleFields.hora_checkin  = f.horaCheckin  || null;
        scheduleFields.hora_checkout = f.horaCheckout || null;
        if (f.modoOperacao === 'semanal') {
          // frontend 0-6 (Sun=0) → backend 1-7 (Sun=7)
          scheduleFields.semanal = f.diasSemana.map((d) => d === 0 ? 7 : d);
        } else if (f.modoOperacao === 'mensal') {
          scheduleFields.mensal = f.diasMes;
        } else if (f.modoOperacao === 'anual') {
          // frontend 0-11 → backend 1-12
          scheduleFields.anual = f.meses.map((m) => m + 1);
        }
      }

      // ── Pricing ─────────────────────────────────────────────────────────────
      const modelos_ocupacao = isFixo ? [] :
        Array.from({ length: maxPax }, (_, i) => ({
          quantidade: i + 1,
          valor: parseBRL(f.precosOcupacao[i + 1] ?? ''),
        }));
      const modelos_fixo = isFixo ? [{ valor: parseBRL(f.precoFixo) }] : [];

      // ── Day Use ─────────────────────────────────────────────────────────────
      const du = f.dayUse;
      const day_use = du.ativo ? [{
        ativo: true,
        padrao: du.modo !== 'ocupacao' ? {
          preco_base:           parseBRL(du.precoFixo ?? ''),
          hora_preco_base:      Number(du.horasBase) || 0,
          valor_hora_adicional: parseBRL(du.precoAdicional ?? '') || null,
        } : null,
        ocupacoes: du.modo === 'ocupacao'
          ? Object.entries(du.precosOcupacao)
              .filter(([, v]) => parseBRL(v) > 0)
              .map(([k, v]) => ({
                quantidade_pessoa: Number(k),
                quantidades: [{ quantidade: 1, valor: parseBRL(v), valor_hora_adicional_por_pessoa: parseBRL(du.horaAdicionalPorPessoa) || null }],
              }))
          : [],
      }] : null;

      // ── Menores ─────────────────────────────────────────────────────────────
      const MODO_ENUM = {
        'taxa-fixa':              'TAXA_ADICIONAL_FIXA',
        'taxa-quantidade':        'TAXA_POR_QUANTIDADE',
        'taxa-faixa':             'TAXA_POR_FAIXA_ETARIA',
        'porcentagem-quantidade': 'PORCENTAGEM_POR_QUANTIDADE',
      };
      const c = f.criancas;
      const menores_idade = c.ativo ? [{
        idade_gratuidade: c.gratuidadeAtiva ? Number(c.gratuidadeMax) || null : null,
        modelo: MODO_ENUM[c.modo],
        taxas_fixas: c.modo === 'taxa-fixa'
          ? [{ idade_maxima: Number(c.idadeMaxima) || 0, valor_por_crianca: parseBRL(c.valorFixo) }]
          : [],
        taxas_por_quantidade: c.modo === 'taxa-quantidade'
          ? c.entradas.map((e) => ({ quantidade_crianca: e.quantidade, valor: parseBRL(e.valor) }))
          : [],
        faixas_etarias: c.modo === 'taxa-faixa'
          ? c.faixas.map((fi) => ({ faixa_etaria: [Number(fi.idadeMin), Number(fi.idadeMax)], valor: parseBRL(fi.valor) }))
          : [],
        porcentagens_por_quantidade: c.modo === 'porcentagem-quantidade'
          ? c.entradas.map((e) => ({ quantidade: e.quantidade, porcentagem: Number(e.valor) || 0 }))
          : [],
      }] : [];

      const payload = {
        descricao: f.nome.trim(),
        ...scheduleFields,
        modelos_ocupacao,
        modelos_fixo,
        day_use,
        menores_idade,
        fk_categorias: f.categoriasIds,
      };

      if (seaModal !== 'edit') {
        await sazonalidadeApi.criar(payload);
        notify(tr('Sazonalidade criada com sucesso!'));
      } else {
        await sazonalidadeApi.atualizar({ id: editingSea.id, ...payload });
        notify(tr('Sazonalidade atualizada com sucesso!'));
      }
      setSeaModal(null); setEditingSea(null);
      setSeaForm(blankSea()); setSeaTab('agenda');
      load();
    } catch (e) {
      notify(tr('Erro: ') + e.message, 'error');
    } finally {
      setSeaSaving(false);
    }
  };

  // ── Delete ─────────────────────────────────────────────────────────────────
  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      if (deleteTarget.type === 'cat') {
        await quartoCategoriApi.excluir(deleteTarget.id);
        notify(tr('Categoria excluída.'));
      } else {
        await sazonalidadeApi.excluir(deleteTarget.id);
        notify(tr('Sazonalidade excluída.'));
      }
      setDeleteTarget(null);
      closeDetail();
      load();
    } catch (e) {
      notify(tr('Erro: ') + e.message, 'error');
    } finally {
      setDeleting(false);
    }
  };

  // ── Painel de detalhe ──────────────────────────────────────────────────────
  /** Sazonalidades que incidem sobre a categoria aberta. */
  const seasOf = (cat) => (cat.sazonaisAtivas ?? [])
    .map((sid) => sazonalidades.find((s) => s.id === sid))
    .filter(Boolean);

  /** Tarifas de hospedagem de um item (categoria ou sazonalidade). */
  const PrecoBloco = ({ item }) => {
    const fixo = item.modeloCobranca === 'Por quarto (tarifa fixa)';
    return (
      <>
        <div className={styles.panelFields}>
          <Field label={tr('Modelo de cobrança')} value={tr(item.modeloCobranca)} />
        </div>
        {fixo
          ? <Field label={tr('Tarifa fixa')} value={fmtBRL(item.precoFixo)} lg />
          : <OccTable label={tr('Preço/noite')} occ={item.precosOcupacao} maxPessoas={item.maxPessoas} />}
      </>
    );
  };

  /** Day Use de um item. */
  const DayUseBloco = ({ item }) => {
    const d = item.dayUse ?? {};
    if (!d.ativo) return <p className={styles.duInactive}>{tr('Day Use não está ativo.')}</p>;
    return (
      <>
        <div className={styles.panelFields}>
          <Field label={tr('Modo')} value={d.modo === 'padrao' ? tr('Padrão') : tr('Por ocupação')} />
          {d.modo === 'padrao'
            ? <Field label={tr('Horas incluídas')} value={d.horasBase ? `${d.horasBase}h` : ''} />
            : <Field label={tr('Hora adicional/pessoa')} value={fmtBRL(d.horaAdicionalPorPessoa)} />}
        </div>
        {d.modo === 'padrao' ? (
          <div className={styles.panelFields}>
            <Field label={tr('Preço base')} value={fmtBRL(d.precoFixo)} lg />
            <Field label={tr('Hora adicional')} value={fmtBRL(d.precoAdicional)} />
          </div>
        ) : (
          <OccTable label={tr('Preço')} occ={d.precosOcupacao} maxPessoas={item.maxPessoas} />
        )}
      </>
    );
  };

  /**
   * Base + uma coluna por sazonalidade. Os campos entram na mesma ordem dos
   * dois lados, então as linhas se alinham sozinhas. Sem sazonalidade, mostra
   * só o conteúdo, sem moldura.
   */
  const Comparado = ({ base, seas, render }) => {
    if (seas.length === 0) return render(base);
    return (
      <div className={styles.compareGrid}>
        <div className={styles.comparePanel}>
          <span className={styles.comparePanelTitle}>{tr('Base')}</span>
          {render(base)}
        </div>
        {seas.map((s) => (
          <div key={s.id} className={[styles.comparePanel, styles.comparePanelSea].join(' ')}>
            <span className={[styles.comparePanelTitle, styles.comparePanelTitleSea].join(' ')}>{s.nome}</span>
            {render(s)}
          </div>
        ))}
      </div>
    );
  };

  /** Rodapé "criado por / cadastrado em", quando o back-end devolve. */
  const AuditFooter = ({ item }) => (
    (item.criado_por || item.data_criacao) ? (
      <div className={styles.auditRow}>
        {item.criado_por && <span className={styles.auditItem}><Users size={11} /> {item.criado_por.nome ?? '—'}</span>}
        {item.data_criacao && <span className={styles.auditItem}><Clock size={11} /> {item.data_criacao}</span>}
      </div>
    ) : null
  );

  /** Barra de ações da ficha — editar, excluir, fechar. */
  const FichaActions = ({ onEdit }) => (
    <div className={styles.dCardActions}>
      <Button className={styles.btnSolid} onClick={onEdit}>{tr('Editar')}</Button>
      <Button variant="danger" className={[styles.btnSolid, styles.btnDanger].join(' ')}
        onClick={() => setDeleteTarget({ type: detailType, id: detailItem.id, nome: detailItem.nome })}>
        {tr('Excluir')}
      </Button>
      <button type="button" className={styles.idClose} onClick={closeDetail}
        title={tr('Fechar ficha')} aria-label={tr('Fechar ficha')}>
        <X size={16} />
      </button>
    </div>
  );

  // só aparece quando a ficha/formulário ocupa a tela e a lista está fora
  const BackBtn = ({ onClick = closeDetail, title = tr('Voltar para a lista') }) => (
    <button type="button" className={styles.backBtn} onClick={onClick}
      title={title} aria-label={title}>
      <ChevronLeft size={17} />
    </button>
  );

  /** Abas da ficha (mesmo desenho das abas da ficha do hóspede). */
  const FichaTabs = ({ abas, atual, onChange }) => (
    <div className={styles.fichaTabs} role="tablist">
      {abas.map(([k, label]) => (
        <button key={k} type="button" role="tab" aria-selected={atual === k}
          className={[styles.fichaTab, atual === k ? styles.fichaTabAtiva : ''].join(' ')}
          onClick={() => onChange(k)}>
          {label}
        </button>
      ))}
    </div>
  );

  // ── Ficha da categoria ─────────────────────────────────────────────────────
  const renderCatPanel = (cat) => {
    const seas   = seasOf(cat);
    const fixo   = cat.modeloCobranca === 'Por quarto (tarifa fixa)';
    const nQuart = (cat.quartos ?? []).length;
    const abas = [
      ['dados', tr('Dados da categoria')],
      ['precos', tr('Tarifas')],
      ['dayuse', tr('Day Use')],
      ['menores', tr('Menores de idade')],
      ['vinculos', tr('Quartos e sazonalidades')],
    ];

    return (
      <div className={styles.detailPanel}>
        <section className={[styles.dCard, styles.fichaCard].join(' ')}>
          <h3 className={[styles.dCardHead, styles.fichaHead].join(' ')}>
            <BackBtn />
            <Tag size={16} />
            <span className={styles.dCardTitle}>{tr('Ficha da categoria')}</span>
            <FichaActions onEdit={() => openEditCat(cat)} />
          </h3>

          <div className={[styles.dCardBody, styles.fichaBody].join(' ')}>
            <div className={styles.fichaTopo}>
              <div className={styles.fichaId}>
                <span className={styles.fichaIcone}><Tag size={26} /></span>
                <div className={styles.idHeadMain}>
                  <h2 className={styles.fichaNome}>{cat.nome}</h2>
                  {cat.descricao && <p className={styles.fichaSub}>{cat.descricao}</p>}
                  <div className={styles.idTags}>
                    <Pill tom={fixo ? 'tagSlate' : 'tagEmerald'}>{fixo ? tr('Tarifa fixa') : tr('Por ocupação')}</Pill>
                    {cat.dayUse?.ativo && <Pill tom="tagAmber">{tr('Day Use')}</Pill>}
                    {cat.criancas?.ativo && <Pill tom="tagPrimary">{tr('Menores')}</Pill>}
                    <Pill>{nQuart} {tr('quarto')}{nQuart !== 1 ? 's' : ''}</Pill>
                  </div>
                </div>
              </div>
              <FichaTabs abas={abas} atual={abaFicha} onChange={setAbaFicha} />
            </div>

            {abaFicha === 'dados' && (<>
              <div className={styles.fieldGrid}>
                <Field label={tr('Modelo de cobrança')} value={tr(cat.modeloCobranca)} />
                {!fixo && <Field label={tr('Capacidade')} value={`${cat.maxPessoas} pessoa${cat.maxPessoas !== 1 ? 's' : ''}`} />}
                <Field label={tr('Check-in')}  value={cat.hora_checkin} />
                <Field label={tr('Check-out')} value={cat.hora_checkout} />
                <Field label={tr('Quartos vinculados')} value={String(nQuart)} />
                <Field label={tr('Sazonalidades')} value={String(seas.length)} />
              </div>
              <AuditFooter item={cat} />
            </>)}

            {abaFicha === 'precos' && (
              <Comparado base={cat} seas={seas} render={(item) => <PrecoBloco item={item} />} />
            )}

            {abaFicha === 'dayuse' && (
              <Comparado base={cat} seas={seas} render={(item) => <DayUseBloco item={item} />} />
            )}

            {abaFicha === 'menores' && (
              <Comparado base={cat} seas={seas} render={(item) => <ChildPricingDisplay criancas={item.criancas} />} />
            )}

            {/* mesmo desenho da aba "Quartos & Sazonais" do formulário, só leitura */}
            {abaFicha === 'vinculos' && (<div className={styles.formBody}>
              <div className={styles.sectionTitle}>{tr('Quartos vinculados')}</div>
              {(cat.quartosObj ?? []).length === 0 ? (
                <p className={styles.blockEmpty}>{tr('Nenhum quarto vinculado.')}</p>
              ) : (
                <div className={styles.checkList}>
                  {(cat.quartosObj ?? []).map((q) => {
                    const full = quartos.find((x) => x.id === q.id);
                    const desc = full?.tipoOcupacao || q.descricao || full?.descricao;
                    return (
                      <div key={q.id} className={[styles.checkItem, styles.checkItemView].join(' ')}>
                        <Check size={14} className={styles.checkItemIco} />
                        <span className={styles.checkItemLabel}>
                          {tr('Quarto')} {full?.numero ?? q.id}{desc ? ` - ${desc.toUpperCase()}` : ''}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}

              <div className={styles.sectionTitle}>{tr('Sazonalidades ativas')}</div>
              {seas.length === 0 ? (
                <p className={styles.blockEmpty}>{tr('Nenhuma sazonalidade ativa nesta categoria.')}</p>
              ) : (
                <div className={styles.checkList}>
                  {seas.map((s) => (
                    <div key={s.id} className={[styles.checkItem, styles.checkItemView].join(' ')}>
                      <Check size={14} className={styles.checkItemIco} />
                      <span className={styles.checkItemLabel}>{s.nome}</span>
                      <span className={styles.checkItemSub}>{MODO_LABEL[s.modoOperacao]}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>)}
          </div>
        </section>
      </div>
    );
  };

  // ── Ficha da sazonalidade ──────────────────────────────────────────────────
  const renderSeaPanel = (s) => {
    const fixo = s.modeloCobranca === 'Por quarto (tarifa fixa)';
    const vinculadas = categorias.filter((c) =>
      (c.sazonaisAtivas ?? []).includes(s.id) || (s.categoriasIds ?? []).includes(c.id)
    );
    const abas = [
      ['dados', tr('Agendamento')],
      ['precos', tr('Tarifas')],
      ['dayuse', tr('Day Use')],
      ['menores', tr('Menores de idade')],
      ['categorias', tr('Categorias vinculadas')],
    ];

    return (
      <div className={styles.detailPanel}>
        <section className={[styles.dCard, styles.fichaCard].join(' ')}>
          <h3 className={[styles.dCardHead, styles.fichaHead].join(' ')}>
            <BackBtn />
            <Calendar size={16} />
            <span className={styles.dCardTitle}>{tr('Ficha da sazonalidade')}</span>
            <FichaActions onEdit={() => openEditSea(s)} />
          </h3>

          <div className={[styles.dCardBody, styles.fichaBody].join(' ')}>
            <div className={styles.fichaTopo}>
              <div className={styles.fichaId}>
                <span className={[styles.fichaIcone, styles.fichaIconeSea].join(' ')}><Calendar size={26} /></span>
                <div className={styles.idHeadMain}>
                  <h2 className={styles.fichaNome}>{s.nome}</h2>
                  <p className={styles.fichaSub}>{describeSchedule(s)}</p>
                  <div className={styles.idTags}>
                    {expirada(s) && <Pill tom="tagRed">{tr('Expirado')}</Pill>}
                    <Pill tom="tagAmber">{MODO_LABEL[s.modoOperacao]}</Pill>
                    <Pill tom={fixo ? 'tagSlate' : 'tagEmerald'}>{fixo ? tr('Tarifa fixa') : tr('Por ocupação')}</Pill>
                    {s.dayUse?.ativo && <Pill tom="tagAmber">{tr('Day Use')}</Pill>}
                    {s.criancas?.ativo && <Pill tom="tagPrimary">{tr('Menores')}</Pill>}
                  </div>
                </div>
              </div>
              <FichaTabs abas={abas} atual={abaFicha} onChange={setAbaFicha} />
            </div>

            {abaFicha === 'dados' && (<>
              <div className={styles.fieldGrid}>
                <Field label={tr('Modo de operação')} value={MODO_LABEL[s.modoOperacao]} />
                {s.modoOperacao === 'data-especifica' && <>
                  <Field label={tr('Início')} value={[fmtDataBR(s.dataInicio), s.horaInicio].filter(Boolean).join(' · ')} />
                  <Field label={tr('Fim')}    value={[fmtDataBR(s.dataFim), s.horaFim].filter(Boolean).join(' · ')} />
                </>}
                {s.modoOperacao === 'semanal' && (
                  <Field label={tr('Dias da semana')} value={(s.diasSemana || []).map((d) => DIAS_SEMANA[d]).join(', ')} />
                )}
                {s.modoOperacao === 'mensal' && (
                  <Field label={tr('Dias do mês')} value={(s.diasMes || []).join(', ')} />
                )}
                {s.modoOperacao === 'anual' && (
                  <Field label={tr('Meses')} value={(s.meses || []).map((m) => MESES_NOME[m]).join(', ')} />
                )}
                <Field label={tr('Check-in')}  value={s.horaCheckin} />
                <Field label={tr('Check-out')} value={s.horaCheckout} />
              </div>
              <AuditFooter item={s} />
            </>)}

            {abaFicha === 'precos'  && <PrecoBloco item={s} />}
            {abaFicha === 'dayuse'  && <DayUseBloco item={s} />}
            {abaFicha === 'menores' && <ChildPricingDisplay criancas={s.criancas} />}

            {abaFicha === 'categorias' && (
              vinculadas.length === 0 ? (
                <p className={styles.blockEmpty}>{tr('Esta sazonalidade não está vinculada a nenhuma categoria.')}</p>
              ) : (
                <div className={styles.rowsBlock}>
                  {vinculadas.map((c) => (
                    <div key={c.id} className={styles.duRow}>
                      <span className={styles.duLabel}>{c.nome}</span>
                      <span className={styles.duVal}>
                        {c.modeloCobranca === 'Por quarto (tarifa fixa)' ? tr('Tarifa fixa') : tr('Por ocupação')}
                        {c.dayUse?.ativo ? tr(' · Day Use') : ''}
                      </span>
                    </div>
                  ))}
                </div>
              )
            )}
          </div>
        </section>
      </div>
    );
  };

  // ── Formulário (cadastro / edição) no painel da direita ───────────────────
  const catFormContent = () => (<>
    {catTab === 'precos' && (<>
      <div className={styles.formGrid4}>
        <div className={styles.span2}>
          <FormField label={tr('Nome da Categoria *')}>
            <Input value={catForm.nome} onChange={(e) => setCatField('nome', e.target.value.toUpperCase())} placeholder={tr('EX: STANDARD ATÉ 5 PESSOAS')} />
          </FormField>
        </div>
        <div className={styles.span2}>
          <FormField label={tr('Descrição')}>
            <Input value={catForm.descricao} onChange={(e) => setCatField('descricao', e.target.value.toUpperCase())} placeholder={tr('DESCRIÇÃO DA CATEGORIA')} />
          </FormField>
        </div>
        <FormField label={tr('Check-in')}>
          <TimePicker value={catForm.hora_checkin} onChange={(v) => setCatField('hora_checkin', v)} />
        </FormField>
        <FormField label={tr('Check-out')}>
          <TimePicker value={catForm.hora_checkout} onChange={(v) => setCatField('hora_checkout', v)} />
        </FormField>
      </div>
      <PricingFields form={catForm} setField={setCatField} setOcc={setCatOcc} />
    </>)}
    {catTab === 'dayuse' && (
      <DayUseFields du={catForm.dayUse} maxPessoas={catForm.maxPessoas} onChange={(du) => setCatField('dayUse', du)} />
    )}
    {catTab === 'criancas' && (
      <ChildPricingFields criancas={catForm.criancas} onChange={(c) => setCatField('criancas', c)} />
    )}
    {catTab === 'vinculos' && (<>
      <div className={styles.sectionTitle}>{tr('Quartos vinculados')}</div>
      <div className={styles.checkList}>
        {quartos.map((q) => {
          const active = catForm.quartos.includes(q.id);
          const outraCat = data.categorias.find(
            (c) => c.id !== editingCat?.id && (c.quartos ?? []).includes(q.id)
          );
          const unavailable = !!outraCat && !active;
          return (
            <label key={q.id} className={[
              styles.checkItem,
              active ? styles.checkItemActive : '',
              unavailable ? styles.checkItemUnavailable : '',
            ].join(' ')}>
              <input type="checkbox" className={styles.checkItemCb} checked={active} disabled={unavailable} onChange={() => !unavailable && toggleCatQuarto(q.id)} />
              <span className={styles.checkItemLabel}>
                {tr('Quarto')} {q.numero ?? q.id}{(q.tipoOcupacao || q.descricao) ? ` - ${(q.tipoOcupacao || q.descricao).toUpperCase()}` : ''}
                {unavailable && <span className={styles.checkItemTag}>{outraCat.nome}</span>}
              </span>
            </label>
          );
        })}
      </div>
      <div className={styles.sectionTitle}>{tr('Sazonalidades ativas')}</div>
      {sazonalidades.length === 0
        ? <div className={styles.detailEmpty}>{tr('Nenhuma sazonalidade cadastrada.')}</div>
        : (
          <div className={styles.checkList}>
            {sazonalidades.map((s) => {
              const active = catForm.sazonaisAtivas.includes(s.id);
              return (
                <label key={s.id} className={[styles.checkItem, active ? styles.checkItemActive : ''].join(' ')}>
                  <input type="checkbox" className={styles.checkItemCb} checked={active} onChange={() => toggleCatSazonais(s.id)} />
                  <span className={styles.checkItemLabel}>{s.nome}</span>
                  <span className={styles.checkItemSub}>{MODO_LABEL[s.modoOperacao]}</span>
                </label>
              );
            })}
          </div>
        )}
    </>)}
  </>);

  const seaFormContent = () => (<>
    {seaTab === 'agenda' && (<>
      <FormField label={tr('Nome da Sazonalidade *')}>
        <Input value={seaForm.nome} onChange={(e) => setSeaField('nome', e.target.value.toUpperCase())} placeholder={tr('EX: ALTA TEMPORADA VERÃO')} />
      </FormField>

      <div className={styles.sectionTitle}>{tr('Modo de Operação *')}</div>
      <div className={styles.modeCards}>
        {[
          { value: 'data-especifica', label: tr('Data Específica'), desc: tr('Período fixo') },
          { value: 'semanal',         label: tr('Semanal'),         desc: tr('Dias da semana') },
          { value: 'mensal',          label: tr('Mensal'),          desc: tr('Dias do mês') },
          { value: 'anual',           label: tr('Anual'),           desc: tr('Meses do ano') },
        ].map((m) => (
          <button key={m.value} type="button"
            className={[styles.modeCard, seaForm.modoOperacao === m.value ? styles.modeCardActive : ''].join(' ')}
            onClick={() => setSeaField('modoOperacao', m.value)}
          >
            <span className={styles.modeCardLabel}>{m.label}</span>
            <span className={styles.modeCardDesc}>{m.desc}</span>
          </button>
        ))}
      </div>
      <ScheduleFields form={seaForm} onChange={setSeaField} />
    </>)}
    {seaTab === 'precos' && (
      <PricingFields form={seaForm} setField={setSeaField} setOcc={setSeaOcc} />
    )}
    {seaTab === 'dayuse' && (
      <DayUseFields du={seaForm.dayUse} maxPessoas={seaForm.maxPessoas} onChange={(du) => setSeaField('dayUse', du)} />
    )}
    {seaTab === 'criancas' && (
      <ChildPricingFields criancas={seaForm.criancas} onChange={(c) => setSeaField('criancas', c)} />
    )}
    {seaTab === 'categorias' && (<>
      <div className={styles.sectionTitle}>{tr('Vincular categorias')}</div>
      <div className={styles.checkList}>
        {categorias.map((cat) => {
          const active = seaForm.categoriasIds.includes(cat.id);
          const duLabel = cat.dayUse?.ativo
            ? (cat.dayUse.modo === 'ocupacao' ? tr('Day Use · por ocupação') : tr('Day Use · preço fixo'))
            : tr('Sem Day Use');
          const criLabel = cat.criancas?.ativo
            ? tr('Menores · {{v0}}', { v0: CRIANCAS_MODO_LABEL[cat.criancas.modo] ?? cat.criancas.modo })
            : tr('Sem cobrança de menores');
          return (
            <label key={cat.id} className={[styles.checkboxRow, active ? styles.checkboxRowActive : ''].join(' ')}>
              <input type="checkbox" className={styles.checkbox} checked={active}
                onChange={() => toggleSeaCat(cat.id)} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <span className={styles.checkboxLabel}>{cat.nome}</span>
                <span className={styles.checkboxSub}>{tr(cat.modeloCobranca)} · {duLabel} · {criLabel}</span>
              </div>
              {active && (
                <button type="button" className={styles.seaRefBtn}
                  onClick={(e) => { e.preventDefault(); preencherDeCat(cat); }}>
                  {tr('Usar como referência')}
                </button>
              )}
            </label>
          );
        })}
        {categorias.length === 0 && (
          <span className={styles.detailEmpty}>{tr('Nenhuma categoria cadastrada')}</span>
        )}
      </div>
    </>)}
  </>);

  const renderForm = () => {
    const isCat   = formAtivo === 'cat';
    const editar  = formModo === 'edit';
    const abas    = (isCat ? CAT_FORM_TABS : SEA_FORM_TABS).map((k, i) => [k, (isCat ? CAT_FORM_LABELS : SEA_FORM_LABELS)[i]]);
    const tabs    = isCat ? CAT_FORM_TABS : SEA_FORM_TABS;
    const ultima  = (isCat ? catTab : seaTab) === tabs[tabs.length - 1];
    const valido  = (isCat ? isCatValid(catForm) : isSeaValid(seaForm)) && (editar || ultima);
    const salvando = isCat ? catSaving : seaSaving;
    const titulo  = isCat
      ? (editar ? tr('Editar categoria') : tr('Nova categoria'))
      : (editar ? tr('Editar sazonalidade') : tr('Nova sazonalidade'));

    return (
      <div className={styles.detailPanel}>
        <section className={[styles.dCard, styles.fichaCard].join(' ')}>
          <h3 className={[styles.dCardHead, styles.fichaHead].join(' ')}>
            {formExplicito && <BackBtn onClick={cancelarForm} title={editar ? tr('Voltar para a ficha') : tr('Voltar para a lista')} />}
            {isCat ? <Tag size={16} /> : <Calendar size={16} />}
            <span className={styles.dCardTitle}>{titulo}</span>
            {formExplicito && (
              <div className={styles.dCardActions}>
                <button type="button" className={styles.idClose} onClick={cancelarForm}
                  title={tr('Cancelar')} aria-label={tr('Cancelar')}>
                  <X size={16} />
                </button>
              </div>
            )}
          </h3>

          <div className={[styles.dCardBody, styles.fichaBody].join(' ')}>
            <div className={[styles.fichaTopo, styles.fichaTopoForm].join(' ')}>
              <FichaTabs abas={abas} atual={isCat ? catTab : seaTab} onChange={isCat ? setCatTab : setSeaTab} />
            </div>

            <div className={styles.formBody}>
              {isCat ? catFormContent() : seaFormContent()}
            </div>

            <div className={styles.formFoot}>
              <Button className={styles.btnSolid} onClick={cancelarForm}>
                {formExplicito ? tr('Cancelar') : tr('Limpar')}
              </Button>
              {valido ? (
                <Button variant="primary" className={[styles.btnSolid, styles.btnPrimary].join(' ')}
                  onClick={isCat ? handleSaveCat : handleSaveSea} disabled={salvando}>
                  {salvando && <Loader2 size={14} className={styles.spinInline} />}
                  {editar ? tr('Salvar alterações') : isCat ? tr('Criar categoria') : tr('Criar sazonalidade')}
                </Button>
              ) : (
                <Button variant="primary" className={[styles.btnSolid, styles.btnPrimary].join(' ')}
                  onClick={isCat ? advanceCatTab : advanceSeaTab}>
                  {tr('Avançar')}
                </Button>
              )}
            </div>
          </div>
        </section>
      </div>
    );
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  const isSeaTab = aba === 'sea';
  const busca    = searchTerm.trim().toLowerCase();

  // Lista da aba corrente, já filtrada pela busca.
  const items = (isSeaTab ? sazonalidades : categorias).filter((it) => {
    if (!busca) return true;
    const alvo = isSeaTab
      ? [it.nome, MODO_LABEL[it.modoOperacao], describeSchedule(it)]
      : [it.nome, it.descricao, it.modeloCobranca];
    return alvo.filter(Boolean).join(' ').toLowerCase().includes(busca);
  });

  const nSaz = (c) => (c.sazonaisAtivas ?? []).length;

  // Totais do painel geral (celular, sem nada aberto).

  return (
    <div className={styles.page}>
      <Notification notification={notification} />
      <div className={styles.container}>
        {/* Abaixo de 1024px, com ficha ou formulário aberto, ele toma a tela e a lista sai. */}
        <main className={[styles.split, detailItem || formExplicito ? styles.splitListHidden : ''].join(' ')}>

          {/* ══ LISTA ═══════════════════════════════════════════ */}
          <aside className={styles.listPanel}>
            <div className={styles.listTopoEscuro}>
            {/* abas Categorias / Sazonalidades e o cadastro da aba atual ao lado */}
            <div className={styles.listTopo}>
              <div className={styles.segmented}>
                <button type="button"
                  className={[styles.segmentedBtn, !isSeaTab ? styles.segmentedBtnActive : ''].join(' ')}
                  onClick={() => changeAba('cat')}>
                  {tr('Categorias')}
                </button>
                <button type="button"
                  className={[styles.segmentedBtn, isSeaTab ? styles.segmentedBtnActive : ''].join(' ')}
                  onClick={() => changeAba('sea')}>
                  {tr('Sazonalidades')}
                </button>
              </div>
              {!formAtivo && (
                <Button variant="primary" className={[styles.btnSolid, styles.btnPrimary].join(' ')}
                  onClick={isSeaTab ? openCreateSea : openCreateCat}>
                  {tr('Cadastrar')}
                </Button>
              )}
            </div>

            <div className={[styles.searchWrap, styles.searchWrapFull, searchTerm ? styles.searchAtiva : ''].join(' ')}>
              <Search size={16} className={styles.searchIcon} />
              <Input
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder={isSeaTab ? tr('Buscar sazonalidade...') : tr('Buscar categoria...')}
                className={styles.searchInput}
                aria-label={tr('Buscar')}
              />
              {searchTerm.length > 0 && (
                <button className={styles.searchClear} onClick={() => setSearchTerm('')} aria-label={tr('Limpar busca')}>
                  <X size={14} />
                </button>
              )}
            </div>

            </div>
            <div className={styles.listCorpo}>
            <div className={styles.listMeta}>
              <span>
                {loading
                  ? tr('Carregando...')
                  : isSeaTab
                    ? `${items.length} sazonalidade${items.length !== 1 ? 's' : ''}`
                    : `${items.length} categoria${items.length !== 1 ? 's' : ''}`}
              </span>
            </div>

            <div className={styles.listScroll}>
              {loading ? (
                <SkeletonLista />
              ) : items.length === 0 ? (
                <div className={styles.empty}>
                  <AlertCircle size={24} opacity={0.3} />
                  <span>{searchTerm ? tr('Nenhum resultado encontrado.') : isSeaTab ? tr('Nenhuma sazonalidade cadastrada.') : tr('Nenhuma categoria cadastrada.')}</span>
                </div>
              ) : items.map((item) => {
                const ativo = detailItem?.id === item.id && detailType === (isSeaTab ? 'sea' : 'cat');
                const fixo  = item.modeloCobranca === 'Por quarto (tarifa fixa)';
                return (
                  <button key={item.id} type="button"
                    className={[styles.listItem, ativo ? styles.listItemActive : ''].join(' ')}
                    onClick={() => openDetail(item, isSeaTab ? 'sea' : 'cat')}>
                    <span className={styles.listItemBody}>
                      <span className={styles.listItemName}>
                        <span className={styles.nome}>{item.nome}</span>
                        {isSeaTab && expirada(item) && <Pill tom="tagRed">{tr('Expirado')}</Pill>}
                      </span>
                      <span className={styles.listItemSub}>
                        {(isSeaTab
                          ? [MODO_LABEL[item.modoOperacao], resumoSchedule(item)]
                          : [
                              fixo ? tr('Tarifa fixa') : tr('Por ocupação'),
                              item.dayUse?.ativo && tr('Day Use'),
                              nSaz(item) > 0 && (nSaz(item) !== 1 ? tr('{{n}} sazonalidades', { n: nSaz(item) }) : tr('{{n}} sazonalidade', { n: nSaz(item) })),
                            ]
                        ).filter(Boolean).join(' · ')}
                      </span>
                    </span>
                    <ChevronRight size={16} className={styles.listChevron} />
                  </button>
                );
              })}
            </div>
            </div>
          </aside>

          {/* ══ DIREITA: formulário ou ficha ══════ */}
          {formAtivo ? renderForm()
            : detailItem ? (detailType === 'cat' ? renderCatPanel(detailItem) : renderSeaPanel(detailItem))
            : null}
        </main>
      </div>

      {/* ═══════════════════════════════════════════════════════
          MODAL — Confirmar exclusão
      ═══════════════════════════════════════════════════════ */}
      <Modal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        size="sm"
        title={<><Trash2 size={15} /> {tr('Confirmar exclusão')}</>}
        footer={
          <div className={styles.modalFooter}>
            <Button variant="secondary" onClick={() => setDeleteTarget(null)}>{tr('Cancelar')}</Button>
            <Button variant="danger" onClick={confirmDelete} disabled={deleting}>
              {deleting && <Loader2 size={14} className={styles.spinInline} />}
              {tr('Excluir')}
            </Button>
          </div>
        }
      >
        <div style={{ fontSize: 14, color: 'var(--text)', lineHeight: 1.6 }}>
          {tr('Tem certeza que deseja excluir')} <strong>{deleteTarget?.nome}</strong>?
          {deleteTarget?.type === 'cat' && (() => {
            const cat = categorias.find((c) => c.id === deleteTarget.id);
            const qs = (cat?.quartosObj ?? []).map((q) => quartos.find((x) => x.id === q.id)?.numero ?? q.id);
            const ss = cat ? seasOf(cat).map((s) => s.nome) : [];
            if (!qs.length && !ss.length) return null;
            return (
              <div style={{ marginTop: 10, fontSize: 12, color: 'var(--text-2)' }}>
                {tr('Esta categoria possui vínculos que também serão removidos:')}
                {qs.length > 0 && <div style={{ marginTop: 6 }}><strong>{tr('Quartos:')}</strong> {qs.join(', ')}</div>}
                {ss.length > 0 && <div style={{ marginTop: 4 }}><strong>{tr('Sazonalidades:')}</strong> {ss.join(', ')}</div>}
              </div>
            );
          })()}
          {deleteTarget?.type === 'sea' && (() => {
            const cs = categorias.filter((c) => (c.sazonaisAtivas ?? []).includes(deleteTarget.id)).map((c) => c.nome);
            if (!cs.length) return null;
            return (
              <div style={{ marginTop: 10, fontSize: 12, color: 'var(--text-2)' }}>
                {tr('Esta sazonalidade possui vínculos que também serão removidos:')}
                <div style={{ marginTop: 6 }}><strong>{tr('Categorias:')}</strong> {cs.join(', ')}</div>
              </div>
            );
          })()}
        </div>
      </Modal>
    </div>
  );
}
