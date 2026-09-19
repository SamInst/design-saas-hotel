import { useState, useEffect, useCallback } from 'react';
import {
  BedDouble, Calendar, DollarSign, Tag, Users, Clock,
  Plus, Edit2, Trash2, Loader2,
  Search, X, ChevronLeft, ChevronRight, AlertCircle,
  Baby, Sun, Layers, Link2,
} from 'lucide-react';
import { Modal }                    from '../../components/ui/Modal';
import { Button }                   from '../../components/ui/Button';
import { Input, Select, FormField } from '../../components/ui/Input';
import { TimePicker }               from '../../components/ui/TimePicker';
import { DatePicker }               from '../../components/ui/DatePicker';
import { Notification }             from '../../components/ui/Notification';
import { quartoCategoriApi, quartoApi, sazonalidadeApi } from '../../services/api';
import styles from './PricingManagement.module.css';

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

const DIAS_SEMANA = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const MESES_NOME  = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
const DIAS_MES    = Array.from({ length: 31 }, (_, i) => i + 1);

const MODO_LABEL = {
  'data-especifica': 'Data Específica',
  semanal:           'Semanal',
  mensal:            'Mensal',
  anual:             'Anual',
};

/** "2026-12-01" → "01/12/2026". Deixa passar o que não for ISO. */
const fmtDataBR = (d) => (/^\d{4}-\d{2}-\d{2}$/.test(d ?? '') ? d.split('-').reverse().join('/') : (d || ''));

function describeSchedule(s) {
  switch (s.modoOperacao) {
    case 'data-especifica':
      return `${fmtDataBR(s.dataInicio) || '—'} → ${fmtDataBR(s.dataFim) || '—'}  ${s.horaInicio || ''} / ${s.horaFim || ''}`.trim();
    case 'semanal': {
      const dias = (s.diasSemana || []).map((d) => DIAS_SEMANA[d]).join(', ');
      return `Semanal · ${dias || '—'} · check-in ${s.horaCheckin} / check-out ${s.horaCheckout}`;
    }
    case 'mensal': {
      const dias = (s.diasMes || []).join(', ');
      return `Mensal · dias ${dias || '—'} · check-in ${s.horaCheckin} / check-out ${s.horaCheckout}`;
    }
    case 'anual': {
      const meses = (s.meses || []).map((m) => MESES_NOME[m]).join(', ');
      return `Anual · ${meses || '—'} · check-in ${s.horaCheckin} / check-out ${s.horaCheckout}`;
    }
    default: return '';
  }
}

// ── Tab constants ─────────────────────────────────────────────────────────────
const CAT_FORM_TABS   = ['precos', 'dayuse', 'vinculos', 'criancas'];
const CAT_FORM_LABELS = ['Preços', 'Day Use', 'Quartos & Sazonais', 'Menores de Idade'];
const SEA_FORM_TABS   = ['agenda', 'categorias', 'precos', 'dayuse', 'criancas'];
const SEA_FORM_LABELS = ['Agendamento', 'Categorias', 'Preços', 'Day Use', 'Menores de Idade'];


const CRIANCAS_MODO_LABEL = {
  'taxa-fixa':             'Taxa adicional fixa',
  'taxa-quantidade':       'Taxa por quantidade',
  'taxa-faixa':            'Taxa por faixa etária',
  'porcentagem-quantidade':'Porcentagem por quantidade',
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
function resumoSchedule(s) {
  switch (s.modoOperacao) {
    case 'data-especifica': return `${fmtDataBR(s.dataInicio) || '—'} → ${fmtDataBR(s.dataFim) || '—'}`;
    case 'semanal': return (s.diasSemana || []).map((d) => DIAS_SEMANA[d]).join(', ') || '—';
    case 'mensal':  return `Dias ${(s.diasMes || []).join(', ') || '—'}`;
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
    <div role="status" aria-label="Carregando">
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

// ── Sub-components ────────────────────────────────────────────────────────────

function OccTable({ label, occ, maxPessoas }) {
  return (
    <table className={styles.miniTable}>
      <thead><tr><th>Pax</th><th>{label}</th></tr></thead>
      <tbody>
        {Array.from({ length: maxPessoas }, (_, i) => i + 1).map((q) => (
          <tr key={q}>
            <td>{q} {q === 1 ? 'pessoa' : 'pessoas'}</td>
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
          <span className={styles.fieldCardLabel}>{q} {q === 1 ? 'pessoa' : 'pessoas'}</span>
          <Input placeholder="R$ 0,00" value={occ?.[q] ?? ''} onChange={(e) => onChange(q, maskBRL(e.target.value))} />
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
      <div className={styles.formRow}>
        <FormField label="Data início *">
          <DatePicker value={strToDate(form.dataInicio)} onChange={(d) => onChange('dataInicio', dateToStr(d))} placeholder="DD/MM/AAAA" />
        </FormField>
        <FormField label="Data fim *">
          <DatePicker value={strToDate(form.dataFim)} onChange={(d) => onChange('dataFim', dateToStr(d))} placeholder="DD/MM/AAAA" />
        </FormField>
      </div>
      <div className={styles.formRow}>
        <FormField label="Check-in *"><TimePicker value={form.horaInicio} onChange={(v) => onChange('horaInicio', v)} /></FormField>
        <FormField label="Check-out *"><TimePicker value={form.horaFim} onChange={(v) => onChange('horaFim', v)} /></FormField>
      </div>
    </>
  );


  if (mode === 'semanal') return (
    <>
      <FormField label="Dias da semana *">
        <div className={styles.chipGroup}>
          {DIAS_SEMANA.map((d, i) => (
            <button key={i} type="button" className={[styles.chip, form.diasSemana.includes(i) ? styles.chipActive : ''].join(' ')} onClick={() => toggleDia(i)}>{d}</button>
          ))}
        </div>
      </FormField>
      <div className={styles.formRow}>
        <FormField label="Check-in *"><TimePicker value={form.horaCheckin} onChange={(v) => onChange('horaCheckin', v)} /></FormField>
        <FormField label="Check-out *"><TimePicker value={form.horaCheckout} onChange={(v) => onChange('horaCheckout', v)} /></FormField>
      </div>
    </>
  );

  if (mode === 'mensal') return (
    <>
      <FormField label="Dias do mês *">
        <div className={styles.dayGrid}>
          {DIAS_MES.map((d) => (
            <button key={d} type="button" className={[styles.chip, form.diasMes.includes(d) ? styles.chipActive : ''].join(' ')} onClick={() => toggleMesDia(d)}>{d}</button>
          ))}
        </div>
      </FormField>
      <div className={styles.formRow}>
        <FormField label="Check-in *"><TimePicker value={form.horaCheckin} onChange={(v) => onChange('horaCheckin', v)} /></FormField>
        <FormField label="Check-out *"><TimePicker value={form.horaCheckout} onChange={(v) => onChange('horaCheckout', v)} /></FormField>
      </div>
    </>
  );

  if (mode === 'anual') return (
    <>
      <FormField label="Meses *">
        <div className={styles.chipGroup}>
          {MESES_NOME.map((m, i) => (
            <button key={i} type="button" className={[styles.chip, form.meses.includes(i) ? styles.chipActive : ''].join(' ')} onClick={() => toggleMes(i)}>{m}</button>
          ))}
        </div>
      </FormField>
      <div className={styles.formRow}>
        <FormField label="Check-in *"><TimePicker value={form.horaCheckin} onChange={(v) => onChange('horaCheckin', v)} /></FormField>
        <FormField label="Check-out *"><TimePicker value={form.horaCheckout} onChange={(v) => onChange('horaCheckout', v)} /></FormField>
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
      <div className={styles.sectionTitle}>Hospedagem</div>
      <FormField label="Modelo de cobrança">
        <Select value={modelo} onChange={(e) => handleModeloChange(e.target.value)}>
          <option value="Por ocupação">Por ocupação</option>
          <option value="Por quarto (tarifa fixa)">Por quarto (tarifa fixa)</option>
        </Select>
      </FormField>
      {modelo === 'Por quarto (tarifa fixa)' ? (
        <FormField label="Tarifa fixa (R$) *">
          <Input placeholder="R$ 0,00" value={form.precoFixo} onChange={(e) => setField('precoFixo', maskBRL(e.target.value))} />
        </FormField>
      ) : (
        <>
          <FormField label="Máximo de pessoas">
            <Input type="number" min="1" max="10" value={maxPessoas} onChange={(e) => handleMaxChange(e.target.value)} />
          </FormField>
          <div className={styles.sectionTitle}>Preço por número de hóspedes *</div>
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
          <span className={styles.checkboxLabel}>Habilitar Day Use</span>
          <span className={styles.checkboxSub}>Permite uso do quarto por quantidade de horas</span>
        </div>
      </label>
      {du.ativo && (
        <>
          <FormField label="Modo Day Use">
            <Select value={du.modo} onChange={(e) => handleModoChange(e.target.value)}>
              <option value="padrao">Padrão (preço base + hora adicional)</option>
              <option value="ocupacao">Por ocupação (preço varia por hóspedes)</option>
            </Select>
          </FormField>
          {du.modo === 'padrao' ? (
            <>
              <div className={styles.formRow}>
                <FormField label="Preço base"><Input placeholder="R$ 0,00" value={du.precoFixo} onChange={(e) => setDu('precoFixo', maskBRL(e.target.value))} /></FormField>
                <FormField label="Horas (Preço Base)"><Input type="number" min="1" placeholder="Ex: 4" value={du.horasBase} onChange={(e) => setDu('horasBase', e.target.value)} /></FormField>
              </div>
              <div className={styles.formRow}>
                <FormField label="Valor da Hora adicional"><Input placeholder="R$ 0,00" value={du.precoAdicional} onChange={(e) => setDu('precoAdicional', maskBRL(e.target.value))} /></FormField>
              </div>
            </>
          ) : (
            <>
              <FormField label="Hora adicional por pessoa">
                <Input placeholder="R$ 0,00" value={du.horaAdicionalPorPessoa} onChange={(e) => setDu('horaAdicionalPorPessoa', maskBRL(e.target.value))} />
              </FormField>
              <div className={styles.sectionTitle}>Preços por hóspedes</div>
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
          <span className={styles.checkboxLabel}>Habilitar cobrança de menores de idade</span>
          <span className={styles.checkboxSub}>Define tarifas específicas para crianças</span>
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
                <span className={styles.checkboxLabel}>Faixa de gratuidade</span>
                <span className={styles.checkboxSub}>Crianças nessa faixa etária não pagam, independente do modelo de cobrança</span>
              </div>
            </label>
            {criancas.gratuidadeAtiva && (
              <div style={{ marginTop: 12 }}>
                <FormField label="Gratuito até (anos)">
                  <Input type="number" min="0" max="17" placeholder="Ex: 5"
                    value={criancas.gratuidadeMax}
                    onChange={(e) => set('gratuidadeMax', e.target.value)} />
                </FormField>
              </div>
            )}
          </div>

          <FormField label="Modelo de cobrança">
            <Select value={criancas.modo} onChange={(e) => handleModoChange(e.target.value)}>
              {Object.entries(CRIANCAS_MODO_LABEL).map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </Select>
          </FormField>

          {/* ── Taxa adicional fixa ── */}
          {criancas.modo === 'taxa-fixa' && (
            <div className={styles.formRow}>
              <FormField label="Idade máxima (anos)">
                <Input type="number" min="0" max="17" placeholder="Ex: 12"
                  value={criancas.idadeMaxima}
                  onChange={(e) => set('idadeMaxima', e.target.value)} />
              </FormField>
              <FormField label="Valor fixo por criança">
                <Input placeholder="R$ 0,00"
                  value={criancas.valorFixo}
                  onChange={(e) => set('valorFixo', maskBRL(e.target.value))} />
              </FormField>
            </div>
          )}

          {/* ── Taxa por quantidade ── */}
          {criancas.modo === 'taxa-quantidade' && (
            <>
              <div className={styles.sectionTitle}>Valores por quantidade de crianças</div>
              <div className={styles.inputGrid}>
                {criancas.entradas.map((e, i) => (
                  <div key={i} className={styles.fieldCard}>
                    <span className={styles.fieldCardLabel}>{e.quantidade} criança{e.quantidade > 1 ? 's' : ''}</span>
                    <div className={styles.fieldCardRow}>
                      <Input placeholder="R$ 0,00" value={e.valor}
                        onChange={(ev) => setEntrada(i, 'valor', maskBRL(ev.target.value))} />
                      <button type="button" className={styles.childRemoveBtn} onClick={() => removeEntrada(i)}>
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              <Button variant="secondary" onClick={addEntrada}>
                <Plus size={13} /> Adicionar linha
              </Button>
            </>
          )}

          {/* ── Taxa por faixa etária ── */}
          {criancas.modo === 'taxa-faixa' && (
            <>
              <div className={styles.sectionTitle}>Faixas etárias</div>
              <div className={styles.inputGrid}>
                {criancas.faixas.map((f, i) => (
                  <div key={i} className={styles.fieldCard}>
                    <span className={styles.fieldCardLabel}>Faixa {i + 1}</span>
                    <div className={styles.fieldCardRow}>
                      <Input type="number" min="0" max="17" placeholder="De"
                        className={styles.childInputAge} value={f.idadeMin}
                        onChange={(ev) => setFaixa(i, 'idadeMin', ev.target.value)} />
                      <span className={styles.childSep}>–</span>
                      <Input type="number" min="0" max="17" placeholder="Até"
                        className={styles.childInputAge} value={f.idadeMax}
                        onChange={(ev) => setFaixa(i, 'idadeMax', ev.target.value)} />
                      <span className={styles.childSep}>anos</span>
                    </div>
                    <div className={styles.fieldCardRow}>
                      <Input placeholder="R$ 0,00" className={styles.childInputVal} value={f.valor}
                        onChange={(ev) => setFaixa(i, 'valor', maskBRL(ev.target.value))} />
                      <button type="button" className={styles.childRemoveBtn} onClick={() => removeFaixa(i)}>
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              <Button variant="secondary" onClick={addFaixa}>
                <Plus size={13} /> Adicionar faixa
              </Button>
            </>
          )}

          {/* ── Porcentagem por quantidade ── */}
          {criancas.modo === 'porcentagem-quantidade' && (
            <>
              <div className={styles.sectionTitle}>Porcentagem por quantidade de crianças</div>
              <div className={styles.inputGrid}>
                {criancas.entradas.map((e, i) => (
                  <div key={i} className={styles.fieldCard}>
                    <span className={styles.fieldCardLabel}>{e.quantidade} criança{e.quantidade > 1 ? 's' : ''}</span>
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
              <Button variant="secondary" onClick={addEntrada}>
                <Plus size={13} /> Adicionar linha
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
          <span className={styles.gratuidadeDisplayLabel}>Gratuidade</span>
          <span className={styles.gratuidadeDisplayVal}>
            0–{criancas.gratuidadeMax} anos (isento de cobrança)
          </span>
        </div>
      )}
      {!criancas?.ativo ? (
        <div className={styles.duInactive}>Cobrança de menores não configurada.</div>
      ) : (
      <>
      <div className={styles.duRow}>
        <span className={styles.duLabel}>Modelo</span>
        <span className={styles.duVal}>{CRIANCAS_MODO_LABEL[modo] ?? modo}</span>
      </div>
      {modo === 'taxa-fixa' && (
        <>
          <div className={styles.duRow}><span className={styles.duLabel}>Idade máxima</span><span className={styles.duVal}>{criancas.idadeMaxima} anos</span></div>
          <div className={styles.duRow}><span className={styles.duLabel}>Valor por criança</span><span className={styles.duVal}>{fmtBRL(parseBRL(criancas.valorFixo))}</span></div>
        </>
      )}
      {(modo === 'taxa-quantidade' || modo === 'porcentagem-quantidade') && (
        <table className={styles.miniTable}>
          <thead><tr><th>Qtd</th><th>{modo === 'taxa-quantidade' ? 'Valor' : '%'}</th></tr></thead>
          <tbody>
            {(criancas.entradas ?? []).map((e, i) => (
              <tr key={i}>
                <td>{e.quantidade} criança{e.quantidade > 1 ? 's' : ''}</td>
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
          <thead><tr><th>Faixa</th><th>Valor</th></tr></thead>
          <tbody>
            {(criancas.faixas ?? []).map((f, i) => (
              <tr key={i}>
                <td>{f.idadeMin}–{f.idadeMax} anos</td>
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
      notify('Erro ao carregar dados: ' + e.message, 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const { categorias, sazonalidades } = data;

  // ── Painel de detalhe ─────────────────────────────────────────────────────
  const openDetail = (item, type) => { setDetailItem(item); setDetailType(type); };
  const closeDetail = () => { setDetailItem(null); setDetailType(null); };

  // Trocar de aba fecha a ficha aberta — ela é da outra lista.
  const changeAba = (nova) => {
    if (nova === aba) return;
    setAba(nova); setSearchTerm(''); closeDetail();
  };

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

  const openCreateCat = () => { setCatForm(blankCat()); setEditingCat(null); setCatTab('precos'); setCatModal('create'); };

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

      if (catModal === 'create') {
        await quartoCategoriApi.criar(payload);
        notify('Categoria criada com sucesso!');
      } else {
        await quartoCategoriApi.atualizar({ id: editingCat.id, ...payload });
        notify('Categoria atualizada com sucesso!');
      }
      setCatModal(null);
      load();
    } catch (e) {
      notify('Erro: ' + e.message, 'error');
    } finally {
      setCatSaving(false);
    }
  };

  // ── Seasonal form ──────────────────────────────────────────────────────────
  const advanceSeaTab = () => {
    const idx = SEA_FORM_TABS.indexOf(seaTab);
    setSeaTab(SEA_FORM_TABS[(idx + 1) % SEA_FORM_TABS.length]);
  };

  const openCreateSea = () => { setSeaForm(blankSea()); setEditingSea(null); setSeaTab('agenda'); setSeaModal('create'); };

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

      if (seaModal === 'create') {
        await sazonalidadeApi.criar(payload);
        notify('Sazonalidade criada com sucesso!');
      } else {
        await sazonalidadeApi.atualizar({ id: editingSea.id, ...payload });
        notify('Sazonalidade atualizada com sucesso!');
      }
      setSeaModal(null);
      load();
    } catch (e) {
      notify('Erro: ' + e.message, 'error');
    } finally {
      setSeaSaving(false);
    }
  };

  // ── Delete ─────────────────────────────────────────────────────────────────
  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      if (deleteTarget.type === 'cat' || deleteTarget.type === 'sea') {
        notify('Exclusão não disponível no momento.', 'error');
        setDeleteTarget(null);
        return;
      }
      notify('Sazonalidade removida.');
      setDeleteTarget(null);
      load();
    } catch (e) {
      notify('Erro: ' + e.message, 'error');
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
          <Field label="Modelo de cobrança" value={item.modeloCobranca} />
          {!fixo && (
            <Field label="Capacidade" value={`${item.maxPessoas} pessoa${item.maxPessoas !== 1 ? 's' : ''}`} />
          )}
        </div>
        {fixo
          ? <Field label="Tarifa fixa" value={fmtBRL(item.precoFixo)} lg />
          : <OccTable label="Preço/noite" occ={item.precosOcupacao} maxPessoas={item.maxPessoas} />}
      </>
    );
  };

  /** Day Use de um item. */
  const DayUseBloco = ({ item }) => {
    const d = item.dayUse ?? {};
    if (!d.ativo) return <p className={styles.duInactive}>Day Use não está ativo.</p>;
    return (
      <>
        <div className={styles.panelFields}>
          <Field label="Modo" value={d.modo === 'padrao' ? 'Padrão' : 'Por ocupação'} />
          {d.modo === 'padrao'
            ? <Field label="Horas incluídas" value={d.horasBase ? `${d.horasBase}h` : ''} />
            : <Field label="Hora adicional/pessoa" value={fmtBRL(d.horaAdicionalPorPessoa)} />}
        </div>
        {d.modo === 'padrao' ? (
          <div className={styles.panelFields}>
            <Field label="Preço base" value={fmtBRL(d.precoFixo)} lg />
            <Field label="Hora adicional" value={fmtBRL(d.precoAdicional)} />
          </div>
        ) : (
          <OccTable label="Preço" occ={d.precosOcupacao} maxPessoas={item.maxPessoas} />
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
          <span className={styles.comparePanelTitle}>Base</span>
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

  /** Barra de ações da ficha — voltar, editar, excluir, fechar. */
  const FichaActions = ({ onEdit }) => (
    <div className={styles.dCardActions}>
      <Button className={styles.btnSolid} onClick={onEdit}>Editar</Button>
      <Button variant="danger" className={[styles.btnSolid, styles.btnDanger].join(' ')}
        onClick={() => setDeleteTarget({ type: detailType, id: detailItem.id, nome: detailItem.nome })}>
        Excluir
      </Button>
      <button type="button" className={styles.idClose} onClick={closeDetail}
        title="Fechar ficha" aria-label="Fechar ficha">
        <X size={16} />
      </button>
    </div>
  );

  const BackBtn = () => (
    <button type="button" className={styles.backBtn} onClick={closeDetail}
      title="Voltar para a lista" aria-label="Voltar para a lista">
      <ChevronLeft size={17} />
    </button>
  );

  // ── Ficha da categoria ─────────────────────────────────────────────────────
  const renderCatPanel = (cat) => {
    const seas   = seasOf(cat);
    const fixo   = cat.modeloCobranca === 'Por quarto (tarifa fixa)';
    const nQuart = (cat.quartos ?? []).length;

    return (
      <div className={styles.detailPanel}>

        {/* ── Identificação ── */}
        <section className={styles.dCard}>
          <h3 className={styles.dCardHead}>
            <BackBtn />
            <Tag size={16} />
            <span className={styles.dCardTitle}>Dados da categoria</span>
            <FichaActions onEdit={() => openEditCat(cat)} />
          </h3>

          <div className={styles.dCardBody}>
            <div className={styles.idHead}>
              <div className={styles.idHeadMain}>
                <div className={styles.idName}>
                  <h2 style={{ margin: 0, font: 'inherit' }}>{cat.nome}</h2>
                </div>
                {cat.descricao && <p className={styles.idSub}>{cat.descricao}</p>}
                <div className={styles.idTags}>
                  <Pill tom={fixo ? 'tagSlate' : 'tagEmerald'}>{fixo ? 'Tarifa fixa' : 'Por ocupação'}</Pill>
                  {cat.dayUse?.ativo && <Pill tom="tagAmber">Day Use</Pill>}
                  {cat.criancas?.ativo && <Pill tom="tagPrimary">Menores</Pill>}
                  <Pill>{nQuart} quarto{nQuart !== 1 ? 's' : ''}</Pill>
                </div>
              </div>
            </div>

            <div className={styles.fieldGrid}>
              <Field label="Modelo de cobrança" value={cat.modeloCobranca} />
              {!fixo && <Field label="Capacidade" value={`${cat.maxPessoas} pessoa${cat.maxPessoas !== 1 ? 's' : ''}`} />}
              <Field label="Check-in"  value={cat.hora_checkin} />
              <Field label="Check-out" value={cat.hora_checkout} />
            </div>

            <AuditFooter item={cat} />
          </div>
        </section>

        {/* ── Tarifas de hospedagem ── */}
        <section className={styles.dCard}>
          <h3 className={styles.dCardHead}>
            <DollarSign size={16} />
            <span className={styles.dCardTitle}>Tarifas de hospedagem</span>
          </h3>
          <div className={styles.dCardBody}>
            <Comparado base={cat} seas={seas} render={(item) => <PrecoBloco item={item} />} />
          </div>
        </section>

        {/* ── Day Use ── */}
        <section className={styles.dCard}>
          <h3 className={styles.dCardHead}>
            <Sun size={16} />
            <span className={styles.dCardTitle}>Day Use</span>
          </h3>
          <div className={styles.dCardBody}>
            <Comparado base={cat} seas={seas} render={(item) => <DayUseBloco item={item} />} />
          </div>
        </section>

        {/* ── Menores de idade ── */}
        <section className={styles.dCard}>
          <h3 className={styles.dCardHead}>
            <Baby size={16} />
            <span className={styles.dCardTitle}>Menores de idade</span>
          </h3>
          <div className={styles.dCardBody}>
            <Comparado base={cat} seas={seas} render={(item) => <ChildPricingDisplay criancas={item.criancas} />} />
          </div>
        </section>

        {/* ── Quartos e sazonalidades ── */}
        <section className={styles.dCard}>
          <h3 className={styles.dCardHead}>
            <BedDouble size={16} />
            <span className={styles.dCardTitle}>Quartos e sazonalidades</span>
          </h3>

          <div className={styles.dCardBody}>
            <div className={styles.pillWrap}>
              {(cat.quartosObj ?? []).length === 0
                ? <span className={styles.detailEmpty}>Nenhum quarto vinculado.</span>
                : (cat.quartosObj ?? []).map((q) => {
                    const full = quartos.find((x) => x.id === q.id);
                    return (
                      <span key={q.id} className={styles.pill}>
                        Quarto {full?.numero ?? q.id}{q.descricao ? ` · ${q.descricao}` : ''}
                      </span>
                    );
                  })}
            </div>

            <div className={styles.subBlock}>
              <div className={styles.blockHead}><Calendar size={15} /><span>Sazonalidades ativas</span></div>
              {seas.length === 0 ? (
                <p className={styles.blockEmpty}>Nenhuma sazonalidade ativa nesta categoria.</p>
              ) : (
                <div className={styles.rowsBlock}>
                  {seas.map((s) => (
                    <div key={s.id} className={styles.duRow}>
                      <span className={styles.duLabel}>{s.nome}</span>
                      <span className={styles.duVal}>{MODO_LABEL[s.modoOperacao]} · {resumoSchedule(s)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
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

    return (
      <div className={styles.detailPanel}>

        {/* ── Identificação e agendamento ── */}
        <section className={styles.dCard}>
          <h3 className={styles.dCardHead}>
            <BackBtn />
            <Calendar size={16} />
            <span className={styles.dCardTitle}>Dados da sazonalidade</span>
            <FichaActions onEdit={() => openEditSea(s)} />
          </h3>

          <div className={styles.dCardBody}>
            <div className={styles.idHead}>
              <div className={styles.idHeadMain}>
                <div className={styles.idName}>
                  <h2 style={{ margin: 0, font: 'inherit' }}>{s.nome}</h2>
                </div>
                <p className={styles.idSub}>{describeSchedule(s)}</p>
                <div className={styles.idTags}>
                  <Pill tom="tagAmber">{MODO_LABEL[s.modoOperacao]}</Pill>
                  <Pill tom={fixo ? 'tagSlate' : 'tagEmerald'}>{fixo ? 'Tarifa fixa' : 'Por ocupação'}</Pill>
                  {s.dayUse?.ativo && <Pill tom="tagAmber">Day Use</Pill>}
                  {s.criancas?.ativo && <Pill tom="tagPrimary">Menores</Pill>}
                </div>
              </div>
            </div>

            <div className={styles.fieldGrid}>
              <Field label="Modo de operação" value={MODO_LABEL[s.modoOperacao]} />
              {s.modoOperacao === 'data-especifica' && <>
                <Field label="Início" value={[fmtDataBR(s.dataInicio), s.horaInicio].filter(Boolean).join(' · ')} />
                <Field label="Fim"    value={[fmtDataBR(s.dataFim), s.horaFim].filter(Boolean).join(' · ')} />
              </>}
              {s.modoOperacao === 'semanal' && (
                <Field label="Dias da semana" value={(s.diasSemana || []).map((d) => DIAS_SEMANA[d]).join(', ')} />
              )}
              {s.modoOperacao === 'mensal' && (
                <Field label="Dias do mês" value={(s.diasMes || []).join(', ')} />
              )}
              {s.modoOperacao === 'anual' && (
                <Field label="Meses" value={(s.meses || []).map((m) => MESES_NOME[m]).join(', ')} />
              )}
              <Field label="Check-in"  value={s.horaCheckin} />
              <Field label="Check-out" value={s.horaCheckout} />
            </div>

            <AuditFooter item={s} />
          </div>
        </section>

        {/* ── Tarifas de hospedagem ── */}
        <section className={styles.dCard}>
          <h3 className={styles.dCardHead}>
            <DollarSign size={16} />
            <span className={styles.dCardTitle}>Tarifas de hospedagem</span>
          </h3>
          <div className={styles.dCardBody}>
            <PrecoBloco item={s} />
          </div>
        </section>

        {/* ── Day Use ── */}
        <section className={styles.dCard}>
          <h3 className={styles.dCardHead}>
            <Sun size={16} />
            <span className={styles.dCardTitle}>Day Use</span>
          </h3>
          <div className={styles.dCardBody}>
            <DayUseBloco item={s} />
          </div>
        </section>

        {/* ── Menores de idade ── */}
        <section className={styles.dCard}>
          <h3 className={styles.dCardHead}>
            <Baby size={16} />
            <span className={styles.dCardTitle}>Menores de idade</span>
          </h3>
          <div className={styles.dCardBody}>
            <ChildPricingDisplay criancas={s.criancas} />
          </div>
        </section>

        {/* ── Categorias vinculadas ── */}
        <section className={styles.dCard}>
          <h3 className={styles.dCardHead}>
            <Link2 size={16} />
            <span className={styles.dCardTitle}>Categorias vinculadas</span>
          </h3>
          <div className={styles.dCardBody}>
            {vinculadas.length === 0 ? (
              <p className={styles.blockEmpty}>Esta sazonalidade não está vinculada a nenhuma categoria.</p>
            ) : (
              <div className={styles.rowsBlock}>
                {vinculadas.map((c) => (
                  <div key={c.id} className={styles.duRow}>
                    <span className={styles.duLabel}>{c.nome}</span>
                    <span className={styles.duVal}>
                      {c.modeloCobranca === 'Por quarto (tarifa fixa)' ? 'Tarifa fixa' : 'Por ocupação'}
                      {c.dayUse?.ativo ? ' · Day Use' : ''}
                    </span>
                  </div>
                ))}
              </div>
            )}
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

  // Totais do painel geral.
  const quartosVinculados = new Set(categorias.flatMap((c) => c.quartos ?? [])).size;
  const comDayUse = categorias.filter((c) => c.dayUse?.ativo).length;

  return (
    <div className={styles.page}>
      <Notification notification={notification} />
      <div className={styles.container}>
        {/* Abaixo de 1024px, com uma ficha aberta, ela toma a tela e a lista sai. */}
        <main className={[styles.split, detailItem ? styles.splitListHidden : ''].join(' ')}>

          {/* ══ LISTA ═══════════════════════════════════════════ */}
          <aside className={styles.listPanel}>
            <div className={styles.segmented}>
              <button type="button"
                className={[styles.segmentedBtn, !isSeaTab ? styles.segmentedBtnActive : ''].join(' ')}
                onClick={() => changeAba('cat')}>
                Categorias
              </button>
              <button type="button"
                className={[styles.segmentedBtn, isSeaTab ? styles.segmentedBtnActive : ''].join(' ')}
                onClick={() => changeAba('sea')}>
                Sazonalidades
              </button>
            </div>

            <div className={[styles.searchWrap, styles.searchWrapFull].join(' ')}>
              <Search size={16} className={styles.searchIcon} />
              <Input
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder={isSeaTab ? 'Buscar sazonalidade...' : 'Buscar categoria...'}
                className={styles.searchInput}
                aria-label="Buscar"
              />
              {searchTerm.length > 0 && (
                <button className={styles.searchClear} onClick={() => setSearchTerm('')} aria-label="Limpar busca">
                  <X size={14} />
                </button>
              )}
            </div>

            <div className={styles.listMeta}>
              <span>
                {loading
                  ? 'Carregando...'
                  : isSeaTab
                    ? `${items.length} sazonalidade${items.length !== 1 ? 's' : ''}`
                    : `${items.length} categoria${items.length !== 1 ? 's' : ''}`}
              </span>
              <Button className={[styles.btnSolid, styles.btnSm, styles.btnPrimary].join(' ')}
                onClick={isSeaTab ? openCreateSea : openCreateCat}>
                {isSeaTab ? 'Nova sazonalidade' : 'Nova categoria'}
              </Button>
            </div>

            <div className={styles.listScroll}>
              {loading ? (
                <SkeletonLista />
              ) : items.length === 0 ? (
                <div className={styles.empty}>
                  <AlertCircle size={24} opacity={0.3} />
                  <span>{searchTerm ? 'Nenhum resultado encontrado.' : isSeaTab ? 'Nenhuma sazonalidade cadastrada.' : 'Nenhuma categoria cadastrada.'}</span>
                </div>
              ) : items.map((item, i) => {
                const ativo = detailItem?.id === item.id && detailType === (isSeaTab ? 'sea' : 'cat');
                const fixo  = item.modeloCobranca === 'Por quarto (tarifa fixa)';
                return (
                  <button key={item.id} type="button"
                    className={[styles.listItem, ativo ? styles.listItemActive : ''].join(' ')}
                    onClick={() => openDetail(item, isSeaTab ? 'sea' : 'cat')}>
                    <span className={styles.listItemBody}>
                      <span className={styles.listItemName}>
                        <span className={styles.nome}>{item.nome}</span>
                      </span>
                      <span className={styles.listItemSub}>
                        {isSeaTab ? (
                          <>
                            <Pill tom="tagAmber">{MODO_LABEL[item.modoOperacao]}</Pill>
                            {resumoSchedule(item)}
                          </>
                        ) : (
                          <>
                            <Pill tom={fixo ? 'tagSlate' : 'tagEmerald'}>{fixo ? 'Tarifa fixa' : 'Por ocupação'}</Pill>
                            {item.dayUse?.ativo && <Pill tom="tagAmber">Day Use</Pill>}
                            {(item.sazonaisAtivas ?? []).length > 0 && (
                              <Pill tom="tagPrimary">
                                {item.sazonaisAtivas.length} sazonal{item.sazonaisAtivas.length !== 1 ? 'idades' : 'idade'}
                              </Pill>
                            )}
                          </>
                        )}
                      </span>
                    </span>
                    <ChevronRight size={16} className={styles.listChevron} />
                  </button>
                );
              })}
            </div>
          </aside>

          {/* ══ DETALHE ═════════════════════════════════════════ */}
          {!detailItem ? (
            /* ── Painel geral (nada selecionado) ── */
            <div className={styles.detailPanel}>
              <section className={styles.dCard}>
                <h3 className={styles.dCardHead}>
                  <Layers size={16} />
                  <span className={styles.dCardTitle}>Visão geral de preços</span>
                </h3>

                <div className={styles.dCardBody}>
                  {loading ? <SkeletonPainel /> : (
                    <div className={styles.statGrid}>
                      <div className={styles.statCard}>
                        <p className={styles.statLabel}>Categorias</p>
                        <p className={styles.statVal}>{categorias.length}</p>
                      </div>
                      <div className={styles.statCard}>
                        <p className={styles.statLabel}>Sazonalidades</p>
                        <p className={[styles.statVal, styles.statValAmber].join(' ')}>{sazonalidades.length}</p>
                      </div>
                      <div className={styles.statCard}>
                        <p className={styles.statLabel}>Quartos vinculados</p>
                        <p className={styles.statVal}>{quartosVinculados}</p>
                      </div>
                      <div className={styles.statCard}>
                        <p className={styles.statLabel}>Com Day Use</p>
                        <p className={[styles.statVal, styles.statValGreen].join(' ')}>{comDayUse}</p>
                      </div>
                    </div>
                  )}
                </div>
              </section>

              <div className={styles.detailHint}>
                Escolha uma categoria ou sazonalidade na lista ao lado para ver as tarifas.
              </div>
            </div>
          ) : detailType === 'cat' ? renderCatPanel(detailItem) : renderSeaPanel(detailItem)}
        </main>
      </div>

      {/* ═══════════════════════════════════════════════════════
          MODAL — Criar / Editar Categoria
      ═══════════════════════════════════════════════════════ */}
      <Modal
        open={!!catModal}
        onClose={() => setCatModal(null)}
        size="md"
        title={catModal === 'create' ? <><Tag size={15} /> Nova Categoria</> : <><Edit2 size={15} /> Editar Categoria</>}
        footer={
          <div className={styles.modalFooter}>
            <Button variant="secondary" onClick={() => setCatModal(null)}>Cancelar</Button>
            {isCatValid(catForm)
              ? (
                <Button variant="primary" onClick={handleSaveCat} disabled={catSaving}>
                  {catSaving && <Loader2 size={14} className={styles.spinInline} />}
                  {catModal === 'create' ? 'Criar Categoria' : 'Salvar'}
                </Button>
              ) : (
                <Button variant="primary" onClick={advanceCatTab}>
                  Avançar →
                </Button>
              )
            }
          </div>
        }
      >
        <div className={styles.tabs}>
          {CAT_FORM_LABELS.map((label, i) => (
            <button key={i} type="button"
              className={[styles.tab, catTab === CAT_FORM_TABS[i] ? styles.tabActive : ''].join(' ')}
              onClick={() => setCatTab(CAT_FORM_TABS[i])}
            >{label}</button>
          ))}
        </div>
        <div className={styles.formTabBody}>
          {catTab === 'precos' && (
            <div className={styles.formBody}>
              <FormField label="Nome da Categoria *">
                <Input value={catForm.nome} onChange={(e) => setCatField('nome', e.target.value.toUpperCase())} placeholder="EX: STANDARD ATÉ 5 PESSOAS" />
              </FormField>
              <FormField label="Descrição">
                <Input value={catForm.descricao} onChange={(e) => setCatField('descricao', e.target.value.toUpperCase())} placeholder="DESCRIÇÃO DA CATEGORIA" />
              </FormField>
              <div className={styles.formRow}>
                <FormField label="Check-in">
                  <TimePicker value={catForm.hora_checkin} onChange={(v) => setCatField('hora_checkin', v)} />
                </FormField>
                <FormField label="Check-out">
                  <TimePicker value={catForm.hora_checkout} onChange={(v) => setCatField('hora_checkout', v)} />
                </FormField>
              </div>
              <PricingFields form={catForm} setField={setCatField} setOcc={setCatOcc} />
            </div>
          )}
          {catTab === 'dayuse' && (
            <div className={styles.formBody}>
              <DayUseFields du={catForm.dayUse} maxPessoas={catForm.maxPessoas} onChange={(du) => setCatField('dayUse', du)} />
            </div>
          )}
          {catTab === 'criancas' && (
            <div className={styles.formBody}>
              <ChildPricingFields
                criancas={catForm.criancas}
                onChange={(c) => setCatField('criancas', c)}
              />
            </div>
          )}
          {catTab === 'vinculos' && (
            <div className={styles.formBody}>
              <div className={styles.sectionTitle}>Quartos vinculados</div>
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
                        Quarto {q.numero ?? q.id}{(q.tipoOcupacao || q.descricao) ? ` - ${(q.tipoOcupacao || q.descricao).toUpperCase()}` : ''}
                        {unavailable && <span className={styles.checkItemTag}>{outraCat.nome}</span>}
                      </span>
                    </label>
                  );
                })}
              </div>
              <div className={styles.sectionTitle}>Sazonalidades ativas</div>
              {sazonalidades.length === 0
                ? <div style={{ fontSize: 13, color: 'var(--text-2)' }}>Nenhuma sazonalidade cadastrada.</div>
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
            </div>
          )}
        </div>
      </Modal>

      {/* ═══════════════════════════════════════════════════════
          MODAL — Criar / Editar Sazonalidade
      ═══════════════════════════════════════════════════════ */}
      <Modal
        open={!!seaModal}
        onClose={() => setSeaModal(null)}
        size="lg"
        title={seaModal === 'create' ? <><Calendar size={15} /> Nova Sazonalidade</> : <><Edit2 size={15} /> Editar Sazonalidade</>}
        footer={
          <div className={styles.modalFooter}>
            <Button variant="secondary" onClick={() => setSeaModal(null)}>Cancelar</Button>
            {isSeaValid(seaForm)
              ? (
                <Button variant="primary" onClick={handleSaveSea} disabled={seaSaving}>
                  {seaSaving && <Loader2 size={14} className={styles.spinInline} />}
                  {seaModal === 'create' ? 'Criar Sazonalidade' : 'Salvar'}
                </Button>
              ) : (
                <Button variant="primary" onClick={advanceSeaTab}>
                  Avançar →
                </Button>
              )
            }
          </div>
        }
      >
        <div className={styles.tabs}>
          {SEA_FORM_LABELS.map((label, i) => (
            <button key={i} type="button"
              className={[styles.tab, seaTab === SEA_FORM_TABS[i] ? styles.tabActive : ''].join(' ')}
              onClick={() => setSeaTab(SEA_FORM_TABS[i])}
            >{label}</button>
          ))}
        </div>
        <div className={styles.formTabBody}>
          {seaTab === 'agenda' && (
            <div className={styles.formBody}>
              <FormField label="Nome da Sazonalidade *">
                <Input value={seaForm.nome} onChange={(e) => setSeaField('nome', e.target.value.toUpperCase())} placeholder="EX: ALTA TEMPORADA VERÃO" />
              </FormField>

              <div className={styles.sectionTitle}>Modo de Operação *</div>
              <div className={styles.modeCards}>
                {[
                  { value: 'data-especifica', label: 'Data Específica', desc: 'Período fixo' },
                  { value: 'semanal',         label: 'Semanal',         desc: 'Dias da semana' },
                  { value: 'mensal',          label: 'Mensal',          desc: 'Dias do mês' },
                  { value: 'anual',           label: 'Anual',           desc: 'Meses do ano' },
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
            </div>
          )}
          {seaTab === 'precos' && (
            <div className={styles.formBody}>
              <PricingFields form={seaForm} setField={setSeaField} setOcc={setSeaOcc} />
            </div>
          )}
          {seaTab === 'dayuse' && (
            <div className={styles.formBody}>
              <DayUseFields du={seaForm.dayUse} maxPessoas={seaForm.maxPessoas} onChange={(du) => setSeaField('dayUse', du)} />
            </div>
          )}
          {seaTab === 'criancas' && (
            <div className={styles.formBody}>
              <ChildPricingFields
                criancas={seaForm.criancas}
                onChange={(c) => setSeaField('criancas', c)}
              />
            </div>
          )}
          {seaTab === 'categorias' && (
            <div className={styles.formBody}>
              <div className={styles.sectionTitle}>Vincular categorias</div>
              <div className={styles.checkList}>
                {categorias.map((cat) => {
                  const active = seaForm.categoriasIds.includes(cat.id);
                  const duLabel = cat.dayUse?.ativo
                    ? (cat.dayUse.modo === 'ocupacao' ? 'Day Use · por ocupação' : 'Day Use · preço fixo')
                    : 'Sem Day Use';
                  const criLabel = cat.criancas?.ativo
                    ? `Menores · ${CRIANCAS_MODO_LABEL[cat.criancas.modo] ?? cat.criancas.modo}`
                    : 'Sem cobrança de menores';
                  return (
                    <label key={cat.id} className={[styles.checkboxRow, active ? styles.checkboxRowActive : ''].join(' ')}>
                      <input type="checkbox" className={styles.checkbox} checked={active}
                        onChange={() => toggleSeaCat(cat.id)} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <span className={styles.checkboxLabel}>{cat.nome}</span>
                        <span className={styles.checkboxSub}>{cat.modeloCobranca} · {duLabel} · {criLabel}</span>
                      </div>
                      {active && (
                        <button type="button" className={styles.seaRefBtn}
                          onClick={(e) => { e.preventDefault(); preencherDeCat(cat); }}>
                          Usar como referência
                        </button>
                      )}
                    </label>
                  );
                })}
                {categorias.length === 0 && (
                  <span className={styles.detailEmpty}>Nenhuma categoria cadastrada</span>
                )}
              </div>
            </div>
          )}
        </div>
      </Modal>

      {/* ═══════════════════════════════════════════════════════
          MODAL — Confirmar exclusão
      ═══════════════════════════════════════════════════════ */}
      <Modal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        size="sm"
        title={<><Trash2 size={15} /> Confirmar exclusão</>}
        footer={
          <div className={styles.modalFooter}>
            <Button variant="secondary" onClick={() => setDeleteTarget(null)}>Cancelar</Button>
            <Button variant="danger" onClick={confirmDelete} disabled={deleting}>
              {deleting && <Loader2 size={14} className={styles.spinInline} />}
              Excluir
            </Button>
          </div>
        }
      >
        <div style={{ fontSize: 14, color: 'var(--text)', lineHeight: 1.6 }}>
          Tem certeza que deseja excluir <strong>{deleteTarget?.nome}</strong>?
          {deleteTarget?.type === 'sea' && (
            <div style={{ marginTop: 8, fontSize: 12, color: 'var(--text-2)' }}>
              O vínculo desta sazonalidade será removido de todas as categorias.
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}
