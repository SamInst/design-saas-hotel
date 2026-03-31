import { useState, useEffect, useCallback } from 'react';
import {
  BedDouble, Calendar, DollarSign, Tag, Users, Clock,
  Plus, Edit2, Trash2, Loader2,
} from 'lucide-react';
import { Modal }                    from '../../components/ui/Modal';
import { Button }                   from '../../components/ui/Button';
import { Input, Select, FormField } from '../../components/ui/Input';
import { TimePicker }               from '../../components/ui/TimePicker';
import { Notification }             from '../../components/ui/Notification';
import { pricingApi }               from './pricingMocks'; // sazonalidades ainda sem endpoint backend
import { quartoCategoriApi, quartoApi } from '../../services/api';
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
  };
}

const DIAS_SEMANA = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const MESES_NOME  = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
const DIAS_MES    = Array.from({ length: 31 }, (_, i) => i + 1);

const MODO_LABEL = {
  'data-especifica': 'Data Específica',
  diario:            'Diário',
  semanal:           'Semanal',
  mensal:            'Mensal',
  anual:             'Anual',
};

function describeSchedule(s) {
  switch (s.modoOperacao) {
    case 'data-especifica':
      return `${s.dataInicio || '—'} → ${s.dataFim || '—'}  ${s.horaInicio || ''} / ${s.horaFim || ''}`.trim();
    case 'diario':
      return s.diaIntegral
        ? `Diário · Integral · check-in ${s.horaCheckin} / check-out ${s.horaCheckout}`
        : `Diário · ${s.horaInicioCiclo}–${s.horaFimCiclo} · check-in ${s.horaCheckin} / check-out ${s.horaCheckout}`;
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
const SEA_FORM_TABS   = ['agenda', 'precos', 'dayuse'];
const SEA_FORM_LABELS = ['Agendamento', 'Preços', 'Day Use'];

const CAT_DETAIL_LABELS = ['Hospedagem', 'Day Use', 'Quartos & Sazonais', 'Menores de Idade'];
const SEA_DETAIL_LABELS = ['Agendamento', 'Preços', 'Day Use'];

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
  return !!f.precosOcupacao[1]; // ao menos 1 pax preenchido
}

function isSeaValid(f) {
  if (!f.nome.trim()) return false;
  switch (f.modoOperacao) {
    case 'data-especifica':
      if (!f.dataInicio || !f.dataFim || !f.horaInicio || !f.horaFim) return false;
      break;
    case 'diario':
      if (!f.horaCheckin || !f.horaCheckout) return false;
      if (!f.diaIntegral && (!f.horaInicioCiclo || !f.horaFimCiclo)) return false;
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

// ── Sub-components ────────────────────────────────────────────────────────────

function OccTable({ label, occ, maxPessoas }) {
  return (
    <table className={styles.miniTable}>
      <thead><tr><th>Pax</th><th>{label}</th></tr></thead>
      <tbody>
        {Array.from({ length: maxPessoas }, (_, i) => i + 1).map((q) => (
          <tr key={q}>
            <td>{q} pax</td>
            <td className={styles.miniPrice}>{fmtBRL(occ?.[q])}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function OccInputs({ occ, maxPessoas, onChange }) {
  return (
    <div className={styles.occGrid}>
      {Array.from({ length: maxPessoas }, (_, i) => i + 1).map((q) => (
        <div key={q} className={styles.occCell}>
          <span className={styles.occLabel}>{q} pessoas</span>
          <Input placeholder="R$ 0,00" value={occ?.[q] ?? ''} onChange={(e) => onChange(q, maskBRL(e.target.value))} />
        </div>
      ))}
    </div>
  );
}



function ScheduleFields({ form, onChange }) {
  const mode = form.modoOperacao;
  const toggleDia     = (d) => onChange('diasSemana', form.diasSemana.includes(d) ? form.diasSemana.filter((x) => x !== d) : [...form.diasSemana, d]);
  const toggleMesDia  = (d) => onChange('diasMes',    form.diasMes.includes(d)    ? form.diasMes.filter((x) => x !== d)    : [...form.diasMes,    d]);
  const toggleMes     = (m) => onChange('meses',      form.meses.includes(m)      ? form.meses.filter((x) => x !== m)      : [...form.meses,      m]);

  if (mode === 'data-especifica') return (
    <>
      <div className={styles.formRow}>
        <FormField label="Data início *"><Input type="date" value={form.dataInicio} onChange={(e) => onChange('dataInicio', e.target.value)} /></FormField>
        <FormField label="Data fim *"><Input type="date" value={form.dataFim} onChange={(e) => onChange('dataFim', e.target.value)} /></FormField>
      </div>
      <div className={styles.formRow}>
        <FormField label="Check-in *"><Input type="time" value={form.horaInicio} onChange={(e) => onChange('horaInicio', e.target.value)} /></FormField>
        <FormField label="Check-out *"><Input type="time" value={form.horaFim} onChange={(e) => onChange('horaFim', e.target.value)} /></FormField>
      </div>
    </>
  );

  if (mode === 'diario') return (
    <>
      <label className={styles.checkboxRow}>
        <input type="checkbox" className={styles.checkbox} checked={form.diaIntegral} onChange={(e) => onChange('diaIntegral', e.target.checked)} />
        <div><span className={styles.checkboxLabel}>Dia Integral</span><span className={styles.checkboxSub}>Sem definição de horário de ciclo</span></div>
      </label>
      {!form.diaIntegral && (
        <div className={styles.formRow}>
          <FormField label="Início do ciclo *"><Input type="time" value={form.horaInicioCiclo} onChange={(e) => onChange('horaInicioCiclo', e.target.value)} /></FormField>
          <FormField label="Fim do ciclo *"><Input type="time" value={form.horaFimCiclo} onChange={(e) => onChange('horaFimCiclo', e.target.value)} /></FormField>
        </div>
      )}
      <div className={styles.formRow}>
        <FormField label="Check-in *"><Input type="time" value={form.horaCheckin} onChange={(e) => onChange('horaCheckin', e.target.value)} /></FormField>
        <FormField label="Check-out *"><Input type="time" value={form.horaCheckout} onChange={(e) => onChange('horaCheckout', e.target.value)} /></FormField>
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
        <FormField label="Check-in *"><Input type="time" value={form.horaCheckin} onChange={(e) => onChange('horaCheckin', e.target.value)} /></FormField>
        <FormField label="Check-out *"><Input type="time" value={form.horaCheckout} onChange={(e) => onChange('horaCheckout', e.target.value)} /></FormField>
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
        <FormField label="Check-in *"><Input type="time" value={form.horaCheckin} onChange={(e) => onChange('horaCheckin', e.target.value)} /></FormField>
        <FormField label="Check-out *"><Input type="time" value={form.horaCheckout} onChange={(e) => onChange('horaCheckout', e.target.value)} /></FormField>
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
        <FormField label="Check-in *"><Input type="time" value={form.horaCheckin} onChange={(e) => onChange('horaCheckin', e.target.value)} /></FormField>
        <FormField label="Check-out *"><Input type="time" value={form.horaCheckout} onChange={(e) => onChange('horaCheckout', e.target.value)} /></FormField>
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
      <span className={styles.sectionTitle}>Hospedagem</span>
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
          <FormField label="Preço por número de hóspedes *">
            <OccInputs occ={occ} maxPessoas={maxPessoas} onChange={(q, v) => setOcc(q, v)} />
          </FormField>
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
              <FormField label="Preços por hóspedes">
                <OccInputs occ={du.precosOcupacao} maxPessoas={maxPessoas}
                  onChange={(q, v) => onChange({ ...du, precosOcupacao: { ...du.precosOcupacao, [q]: v } })} />
              </FormField>
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
            <label className={styles.checkboxRow} style={{ marginBottom: 0 }}>
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
              <span className={styles.sectionTitle}>Valores por quantidade de crianças</span>
              {criancas.entradas.map((e, i) => (
                <div key={i} className={styles.childRow}>
                  <span className={styles.childQtdLabel}>{e.quantidade} criança{e.quantidade > 1 ? 's' : ''}</span>
                  <Input placeholder="R$ 0,00"
                    value={e.valor}
                    onChange={(ev) => setEntrada(i, 'valor', maskBRL(ev.target.value))} />
                  <button type="button" className={styles.childRemoveBtn} onClick={() => removeEntrada(i)}>
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}
              <Button variant="secondary" onClick={addEntrada}>
                <Plus size={13} /> Adicionar linha
              </Button>
            </>
          )}

          {/* ── Taxa por faixa etária ── */}
          {criancas.modo === 'taxa-faixa' && (
            <>
              <span className={styles.sectionTitle}>Faixas etárias</span>
              {criancas.faixas.map((f, i) => (
                <div key={i} className={styles.childRow}>
                  <Input type="number" min="0" max="17" placeholder="De"
                    value={f.idadeMin}
                    onChange={(ev) => setFaixa(i, 'idadeMin', ev.target.value)} />
                  <span className={styles.childSep}>–</span>
                  <Input type="number" min="0" max="17" placeholder="Até"
                    value={f.idadeMax}
                    onChange={(ev) => setFaixa(i, 'idadeMax', ev.target.value)} />
                  <span className={styles.childSep}>anos</span>
                  <Input placeholder="R$ 0,00"
                    value={f.valor}
                    onChange={(ev) => setFaixa(i, 'valor', maskBRL(ev.target.value))} />
                  <button type="button" className={styles.childRemoveBtn} onClick={() => removeFaixa(i)}>
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}
              <Button variant="secondary" onClick={addFaixa}>
                <Plus size={13} /> Adicionar faixa
              </Button>
            </>
          )}

          {/* ── Porcentagem por quantidade ── */}
          {criancas.modo === 'porcentagem-quantidade' && (
            <>
              <span className={styles.sectionTitle}>Porcentagem por quantidade de crianças</span>
              {criancas.entradas.map((e, i) => (
                <div key={i} className={styles.childRow}>
                  <span className={styles.childQtdLabel}>{e.quantidade} criança{e.quantidade > 1 ? 's' : ''}</span>
                  <Input type="number" min="0" max="100" placeholder="% da diária"
                    value={e.valor}
                    onChange={(ev) => setEntrada(i, 'valor', ev.target.value)} />
                  <span className={styles.childSep}>%</span>
                  <button type="button" className={styles.childRemoveBtn} onClick={() => removeEntrada(i)}>
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}
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
    <div>
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

  // Detail modal (read-only view)
  const [detailItem, setDetailItem] = useState(null);
  const [detailType, setDetailType] = useState(null); // 'cat' | 'sea'
  const [detailTab,  setDetailTab]  = useState(0);

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
      const [catPage, quartoPage, mockData] = await Promise.all([
        quartoCategoriApi.listar({ size: 900 }),
        quartoApi.listar(),
        pricingApi.listar(), // sazonalidades: ainda sem endpoint próprio no backend
      ]);
      setData({
        categorias:    (Array.isArray(catPage) ? catPage : (catPage.content ?? [])).map(catFromBackend),
        sazonalidades: mockData.sazonalidades,
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

  // ── KPIs ──────────────────────────────────────────────────────────────────
  // ── Detail modal ──────────────────────────────────────────────────────────
  const openDetail = (item, type) => { setDetailItem(item); setDetailType(type); setDetailTab(0); };
  const closeDetail = () => setDetailItem(null);

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
    });
    setEditingSea(s);
    setSeaTab('agenda');
    setSeaModal('edit');
  };

  const setSeaField = (key, val) => setSeaForm((f) => ({ ...f, [key]: val }));
  const setSeaOcc   = (q, val)   => setSeaForm((f) => ({ ...f, precosOcupacao: { ...f.precosOcupacao, [q]: val } }));

  const handleSaveSea = async () => {
    setSeaSaving(true);
    try {
      const payload = {
        nome:            seaForm.nome.trim(), descricao: seaForm.descricao.trim(),
        modoOperacao:    seaForm.modoOperacao,
        dataInicio:      seaForm.dataInicio, dataFim: seaForm.dataFim,
        horaInicio:      seaForm.horaInicio, horaFim: seaForm.horaFim,
        diaIntegral:     seaForm.diaIntegral,
        horaInicioCiclo: seaForm.horaInicioCiclo, horaFimCiclo: seaForm.horaFimCiclo,
        horaCheckin:     seaForm.horaCheckin, horaCheckout: seaForm.horaCheckout,
        diasSemana:      seaForm.diasSemana, diasMes: seaForm.diasMes, meses: seaForm.meses,
        modeloCobranca:  seaForm.modeloCobranca, maxPessoas: seaForm.maxPessoas,
        precoFixo:       seaForm.modeloCobranca === 'Por quarto (tarifa fixa)' ? parseBRL(seaForm.precoFixo) : null,
        precosOcupacao:  seaForm.modeloCobranca === 'Por ocupação'
          ? Object.fromEntries(Object.entries(seaForm.precosOcupacao).map(([k, v]) => [k, parseBRL(v)]))
          : null,
        dayUse: {
          ativo:                seaForm.dayUse.ativo, modo: seaForm.dayUse.modo,
          precoFixo:            parseBRL(seaForm.dayUse.precoFixo),
          horasBase:            Number(seaForm.dayUse.horasBase) || null,
          precoAdicional:       parseBRL(seaForm.dayUse.precoAdicional),
          horaAdicionalPorPessoa: parseBRL(seaForm.dayUse.horaAdicionalPorPessoa),
          precosOcupacao:       seaForm.dayUse.modo === 'ocupacao'
            ? Object.fromEntries(Object.entries(seaForm.dayUse.precosOcupacao).map(([k, v]) => [k, parseBRL(v)]))
            : {},
        },
      };
      if (seaModal === 'create') { await pricingApi.criarSazonalidade(payload);            notify('Sazonalidade criada com sucesso!'); }
      else                       { await pricingApi.atualizarSazonalidade(editingSea.id, payload); notify('Sazonalidade atualizada com sucesso!'); }
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
      if (deleteTarget.type === 'cat') {
        notify('Exclusão de categoria não disponível no momento.', 'error');
        setDeleteTarget(null);
        return;
      }
      await pricingApi.excluirSazonalidade(deleteTarget.id);
      notify('Sazonalidade removida.');
      setDeleteTarget(null);
      load();
    } catch (e) {
      notify('Erro: ' + e.message, 'error');
    } finally {
      setDeleting(false);
    }
  };

  // ── Detail modal content helpers ──────────────────────────────────────────
  const IB = ({ icon, label, children, span2 }) => (
    <div className={[styles.infoBox, span2 ? styles.infoBoxSpan2 : ''].join(' ')}>
      <div className={styles.infoBoxHeader}>
        {icon}<span className={styles.infoBoxLabel}>{label}</span>
      </div>
      <div className={styles.infoBoxValue}>{children}</div>
    </div>
  );

  const renderCatDetail = (cat, tab) => {
    const du = cat.dayUse ?? {};
    const seaNomes = (cat.sazonaisAtivas ?? [])
      .map((sid) => sazonalidades.find((s) => s.id === sid)?.nome).filter(Boolean);

    if (tab === 0) return (
      <div className={styles.detailSection}>
        <div className={styles.infoGrid}>
          <IB icon={<Tag size={13} color="var(--violet)" />} label="Modelo de cobrança">
            {cat.modeloCobranca}
          </IB>
          <IB icon={<Users size={13} color="var(--violet)" />} label="Capacidade">
            {cat.maxPessoas} pessoa{cat.maxPessoas !== 1 ? 's' : ''}
          </IB>
        </div>
        {(cat.hora_checkin || cat.hora_checkout) && (
          <div className={styles.infoGrid}>
            <IB icon={<Clock size={13} color="#10b981" />} label="Check-in">
              {cat.hora_checkin || '—'}
            </IB>
            <IB icon={<Clock size={13} color="#10b981" />} label="Check-out">
              {cat.hora_checkout || '—'}
            </IB>
          </div>
        )}
        {cat.modeloCobranca === 'Por quarto (tarifa fixa)' ? (
          <IB icon={<DollarSign size={13} color="var(--violet)" />} label="Tarifa fixa" span2>
            <span className={styles.infoBoxValueLg}>{fmtBRL(cat.precoFixo)}</span>
          </IB>
        ) : (
          <div className={styles.infoBox}>
            <div className={styles.infoBoxHeader}>
              <DollarSign size={13} color="var(--violet)" />
              <span className={styles.infoBoxLabel}>Preço por ocupação</span>
            </div>
            <OccTable label="Preço/noite" occ={cat.precosOcupacao} maxPessoas={cat.maxPessoas} />
          </div>
        )}
      </div>
    );

    if (tab === 1) {
      if (!du.ativo) return (
        <div className={styles.detailSection}>
          <IB icon={<Calendar size={13} color="var(--text-2)" />} label="Day Use" span2>
            <span className={styles.badge}>Inativo</span>
          </IB>
        </div>
      );
      return (
        <div className={styles.detailSection}>
          <div className={styles.infoGrid}>
            <IB icon={<Calendar size={13} color="#f59e0b" />} label="Day Use">
              <span className={[styles.badge, styles.badgeAmber].join(' ')}>Ativo</span>
            </IB>
            <IB icon={<Tag size={13} color="var(--violet)" />} label="Modo">
              {du.modo === 'padrao' ? 'Padrão' : 'Por ocupação'}
            </IB>
          </div>
          {du.modo === 'padrao' ? (
            <div className={styles.infoGrid}>
              <IB icon={<DollarSign size={13} color="var(--violet)" />} label="Preço base">
                <span className={styles.infoBoxValueLg}>{fmtBRL(du.precoFixo)}</span>
              </IB>
              <IB icon={<Clock size={13} color="var(--violet)" />} label="Horas incluídas">
                {du.horasBase ? `${du.horasBase}h` : '—'}
              </IB>
              <IB icon={<DollarSign size={13} color="#f59e0b" />} label="Hora adicional">
                {fmtBRL(du.precoAdicional)}
              </IB>
            </div>
          ) : (
            <div className={styles.infoBox}>
              <div className={styles.infoBoxHeader}>
                <DollarSign size={13} color="var(--violet)" />
                <span className={styles.infoBoxLabel}>Preço por ocupação</span>
              </div>
              <OccTable label="Preço" occ={du.precosOcupacao} maxPessoas={cat.maxPessoas} />
            </div>
          )}
        </div>
      );
    }

    if (tab === 2) return (
      <div className={styles.detailSection}>
        <div className={styles.infoBox}>
          <div className={styles.infoBoxHeader}>
            <BedDouble size={13} color="var(--violet)" />
            <span className={styles.infoBoxLabel}>Quartos vinculados</span>
          </div>
          <div className={styles.pillWrap} style={{ marginTop: 8 }}>
            {(cat.quartosObj ?? []).length === 0
              ? <span className={styles.detailEmpty}>Nenhum quarto vinculado</span>
              : (cat.quartosObj ?? []).map((q) => {
                  const full = quartos.find((x) => x.id === q.id);
                  const num = full?.numero ?? q.id;
                  const desc = q.descricao ? ` - ${q.descricao}` : '';
                  return <span key={q.id} className={styles.pill}>Quarto {num}{desc}</span>;
                })}
          </div>
        </div>
        <div className={styles.infoBox}>
          <div className={styles.infoBoxHeader}>
            <Calendar size={13} color="var(--violet)" />
            <span className={styles.infoBoxLabel}>Sazonalidades ativas</span>
          </div>
          <div className={styles.pillWrap} style={{ marginTop: 8 }}>
            {seaNomes.length === 0
              ? <span className={styles.detailEmpty}>Nenhuma sazonalidade ativa</span>
              : seaNomes.map((n, i) => <span key={i} className={[styles.pill, styles.pillViolet].join(' ')}>{n}</span>)}
          </div>
        </div>
      </div>
    );

    if (tab === 3) return (
      <div className={styles.detailSection}>
        <ChildPricingDisplay criancas={cat.criancas} />
      </div>
    );

    return null;
  };

  const renderSeaDetail = (s, tab) => {
    const du = s.dayUse ?? {};

    if (tab === 0) return (
      <div className={styles.detailSection}>
        <IB icon={<Calendar size={13} color="var(--violet)" />} label="Modo de operação" span2>
          {MODO_LABEL[s.modoOperacao]}
        </IB>
        {s.modoOperacao === 'data-especifica' && (
          <div className={styles.infoGrid}>
            <IB icon={<Clock size={13} color="#10b981" />} label="Início">
              {s.dataInicio || '—'} {s.horaInicio}
            </IB>
            <IB icon={<Clock size={13} color="#10b981" />} label="Fim">
              {s.dataFim || '—'} {s.horaFim}
            </IB>
          </div>
        )}
        {s.modoOperacao === 'semanal' && (
          <IB icon={<Clock size={13} color="var(--violet)" />} label="Dias da semana" span2>
            {(s.diasSemana || []).map((d) => DIAS_SEMANA[d]).join(', ') || '—'}
          </IB>
        )}
        {s.modoOperacao === 'mensal' && (
          <IB icon={<Clock size={13} color="var(--violet)" />} label="Dias do mês" span2>
            {(s.diasMes || []).join(', ') || '—'}
          </IB>
        )}
        {s.modoOperacao === 'anual' && (
          <IB icon={<Clock size={13} color="var(--violet)" />} label="Meses" span2>
            {(s.meses || []).map((m) => MESES_NOME[m]).join(', ') || '—'}
          </IB>
        )}
        {s.modoOperacao === 'diario' && (
          <IB icon={<Clock size={13} color="var(--violet)" />} label="Ciclo" span2>
            {s.diaIntegral ? 'Integral' : `${s.horaInicioCiclo}–${s.horaFimCiclo}`}
          </IB>
        )}
        {(s.horaCheckin || s.horaCheckout) && (
          <div className={styles.infoGrid}>
            <IB icon={<Clock size={13} color="#10b981" />} label="Check-in">
              {s.horaCheckin || '—'}
            </IB>
            <IB icon={<Clock size={13} color="#10b981" />} label="Check-out">
              {s.horaCheckout || '—'}
            </IB>
          </div>
        )}
      </div>
    );

    if (tab === 1) return (
      <div className={styles.detailSection}>
        <div className={styles.infoGrid}>
          <IB icon={<Tag size={13} color="var(--violet)" />} label="Modelo de cobrança">
            {s.modeloCobranca}
          </IB>
          <IB icon={<Users size={13} color="var(--violet)" />} label="Capacidade">
            {s.maxPessoas} pessoa{s.maxPessoas !== 1 ? 's' : ''}
          </IB>
        </div>
        {s.modeloCobranca === 'Por quarto (tarifa fixa)' ? (
          <IB icon={<DollarSign size={13} color="var(--violet)" />} label="Tarifa fixa" span2>
            <span className={styles.infoBoxValueLg}>{fmtBRL(s.precoFixo)}</span>
          </IB>
        ) : (
          <div className={styles.infoBox}>
            <div className={styles.infoBoxHeader}>
              <DollarSign size={13} color="var(--violet)" />
              <span className={styles.infoBoxLabel}>Preço por ocupação</span>
            </div>
            <OccTable label="Preço/noite" occ={s.precosOcupacao} maxPessoas={s.maxPessoas} />
          </div>
        )}
      </div>
    );

    if (tab === 2) {
      if (!du.ativo) return (
        <div className={styles.detailSection}>
          <IB icon={<Calendar size={13} color="var(--text-2)" />} label="Day Use" span2>
            <span className={styles.badge}>Inativo</span>
          </IB>
        </div>
      );
      return (
        <div className={styles.detailSection}>
          <div className={styles.infoGrid}>
            <IB icon={<Calendar size={13} color="#f59e0b" />} label="Day Use">
              <span className={[styles.badge, styles.badgeAmber].join(' ')}>Ativo</span>
            </IB>
            <IB icon={<Tag size={13} color="var(--violet)" />} label="Modo">
              {du.modo === 'padrao' ? 'Padrão' : 'Por ocupação'}
            </IB>
          </div>
          {du.modo === 'padrao' ? (
            <div className={styles.infoGrid}>
              <IB icon={<DollarSign size={13} color="var(--violet)" />} label="Preço base">
                <span className={styles.infoBoxValueLg}>{fmtBRL(du.precoFixo)}</span>
              </IB>
              <IB icon={<Clock size={13} color="var(--violet)" />} label="Horas incluídas">
                {du.horasBase ? `${du.horasBase}h` : '—'}
              </IB>
              <IB icon={<DollarSign size={13} color="#f59e0b" />} label="Hora adicional">
                {fmtBRL(du.precoAdicional)}
              </IB>
            </div>
          ) : (<>
            <IB icon={<DollarSign size={13} color="#f59e0b" />} label="Hora adicional/pessoa" span2>
              {fmtBRL(du.horaAdicionalPorPessoa)}
            </IB>
            <div className={styles.infoBox}>
              <div className={styles.infoBoxHeader}>
                <DollarSign size={13} color="var(--violet)" />
                <span className={styles.infoBoxLabel}>Preço por ocupação</span>
              </div>
              <OccTable label="Preço" occ={du.precosOcupacao} maxPessoas={s.maxPessoas} />
            </div>
          </>)}
        </div>
      );
    }

    return null;
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className={styles.page}>
      <Notification notification={notification} />
      <div className={styles.container}>

        {/* ── Categorias de Preço ── */}
        <div className={styles.card}>
          <div className={styles.tableHeader}>
            <div>
              <h2 className={styles.h2}>Categorias de Preço</h2>
              <p className={styles.subtitle}>Clique em uma categoria para ver detalhes, tarifas e Day Use</p>
            </div>
            <div className={styles.tableTools}>
              <Button variant="secondary" onClick={openCreateSea}><Calendar size={14} /> Nova Sazonalidade</Button>
              <Button variant="primary"   onClick={openCreateCat}><Plus size={15} /> Nova Categoria</Button>
            </div>
          </div>

          {loading ? (
            <div className={styles.empty}><Loader2 size={28} className={styles.spin} /><span>Carregando...</span></div>
          ) : categorias.length === 0 ? (
            <div className={styles.empty}><Tag size={32} color="var(--text-2)" /><span>Nenhuma categoria cadastrada</span></div>
          ) : categorias.map((cat) => {
            const du = cat.dayUse ?? {};
            return (
              <div key={cat.id} className={styles.listRow} onClick={() => openDetail(cat, 'cat')}>
                <div className={styles.listRowLeft}>
                  <span className={styles.rowName}>{cat.nome}</span>
                  <div className={styles.listRowTags}>
                    {du.ativo && <span className={[styles.listTag, styles.listTagAmber].join(' ')}>Day Use</span>}
                    {(cat.sazonaisAtivas ?? []).length > 0 && <span className={[styles.listTag, styles.listTagViolet].join(' ')}>{cat.sazonaisAtivas.length} sazonalidade{cat.sazonaisAtivas.length !== 1 ? 's' : ''}</span>}
                    <span className={styles.listTag}>{(cat.quartos ?? []).length} quarto{(cat.quartos ?? []).length !== 1 ? 's' : ''}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* ── Sazonalidades Cadastradas ── */}
        <div className={styles.card}>
          <div className={styles.tableHeader}>
            <div>
              <h2 className={styles.h2}>Sazonalidades Cadastradas</h2>
              <p className={styles.subtitle}>Clique em uma sazonalidade para ver detalhes e preços</p>
            </div>
          </div>

          {loading ? (
            <div className={styles.empty}><Loader2 size={24} className={styles.spin} /></div>
          ) : sazonalidades.length === 0 ? (
            <div className={styles.empty}><Calendar size={32} color="var(--text-2)" /><span>Nenhuma sazonalidade cadastrada</span></div>
          ) : sazonalidades.map((s) => {
            const du = s.dayUse ?? {};
            return (
              <div key={s.id} className={styles.listRow} onClick={() => openDetail(s, 'sea')}>
                <div className={styles.listRowLeft}>
                  <span className={styles.rowName}>{s.nome}</span>
                  <div className={styles.listRowTags}>
                    <span className={styles.listTag}>{MODO_LABEL[s.modoOperacao] || s.modoOperacao}</span>
                    <span className={styles.listTag}>{s.modeloCobranca}</span>
                    {du.ativo && <span className={[styles.listTag, styles.listTagAmber].join(' ')}>Day Use</span>}
                  </div>
                </div>
                <div className={styles.listRowRight}>
                  <span className={styles.listPriceSub} style={{ textAlign: 'right' }}>{describeSchedule(s)}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════
          MODAL — Detalhe (Categoria ou Sazonalidade)
      ═══════════════════════════════════════════════════════ */}
      {detailItem && (
        <Modal
          open={!!detailItem}
          onClose={closeDetail}
          size="md"
          title={detailItem.nome}
          footer={
            <div className={styles.modalFooterBetween}>
              <Button variant="danger" onClick={() => {
                closeDetail();
                setDeleteTarget({ type: detailType, id: detailItem.id, nome: detailItem.nome });
              }}>
                <Trash2 size={14} /> Excluir
              </Button>
              <Button variant="primary" onClick={() => {
                const item = detailItem;
                const type = detailType;
                closeDetail();
                if (type === 'cat') openEditCat(item);
                else openEditSea(item);
              }}>
                <Edit2 size={14} /> Editar
              </Button>
            </div>
          }
        >
          <div className={styles.tabs}>
            {(detailType === 'cat' ? CAT_DETAIL_LABELS : SEA_DETAIL_LABELS).map((label, i) => (
              <button key={i} type="button"
                className={[styles.tab, detailTab === i ? styles.tabActive : ''].join(' ')}
                onClick={() => setDetailTab(i)}
              >{label}</button>
            ))}
          </div>
          <div className={styles.detailTabBody}>
            {detailType === 'cat' && renderCatDetail(detailItem, detailTab)}
            {detailType === 'sea' && renderSeaDetail(detailItem, detailTab)}
          </div>
        </Modal>
      )}

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
              <span className={styles.sectionTitle}>Quartos vinculados</span>
              <div className={styles.checkList}>
                {quartos.map((q) => {
                  const active = catForm.quartos.includes(q.id);
                  return (
                    <label key={q.id} className={[styles.checkItem, active ? styles.checkItemActive : ''].join(' ')}>
                      <input type="checkbox" className={styles.checkItemCb} checked={active} onChange={() => toggleCatQuarto(q.id)} />
                      <span className={styles.checkItemLabel}>Quarto {q.numero}{q.tipoOcupacao ? ` - ${q.tipoOcupacao.toUpperCase()}` : ''}</span>
                    </label>
                  );
                })}
              </div>
              <span className={styles.sectionTitle}>Sazonalidades ativas</span>
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
              <FormField label="Descrição">
                <Input value={seaForm.descricao} onChange={(e) => setSeaField('descricao', e.target.value.toUpperCase())} placeholder="DESCRIÇÃO" />
              </FormField>
              <span className={styles.sectionTitle}>Modo de Operação *</span>
              <div className={styles.modeCards}>
                {[
                  { value: 'data-especifica', label: 'Data Específica', desc: 'Período fixo' },
                  { value: 'diario',          label: 'Diário',          desc: 'Todo dia' },
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
