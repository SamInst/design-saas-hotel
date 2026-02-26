import { useState, useEffect, useCallback } from 'react';
import {
  BedDouble, Calendar, DollarSign, Users, Clock, Tag,
  Plus, Edit2, ChevronDown, Trash2, RefreshCw, Loader2,
} from 'lucide-react';
import { Modal }                    from '../../components/ui/Modal';
import { Button }                   from '../../components/ui/Button';
import { Input, Select, FormField } from '../../components/ui/Input';
import { Notification }             from '../../components/ui/Notification';
import { pricingApi }               from './pricingMocks';
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

function getPrecoRange(c) {
  if (c.modeloCobranca === 'Por quarto (tarifa fixa)') return fmtBRL(c.precoFixo);
  const vals = Object.values(c.precosOcupacao || {});
  if (!vals.length) return '—';
  const mn = Math.min(...vals), mx = Math.max(...vals);
  return mn === mx ? fmtBRL(mn) : `${fmtBRL(mn)} – ${fmtBRL(mx)}`;
}

// ── Blank form factories ──────────────────────────────────────────────────────
const blankCat = () => ({
  nome: '', descricao: '', maxPessoas: 5,
  modeloCobranca: 'Por ocupação',
  precoFixo: '', precosOcupacao: { 1: '', 2: '', 3: '', 4: '', 5: '' },
  quartos: [], sazonaisAtivas: [],
  dayUse: { ativo: false, modo: 'padrao', precoFixo: '', precoAdicional: '', precosOcupacao: { 1: '', 2: '', 3: '', 4: '', 5: '' }, horaAdicionalPorPessoa: '' },
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
  dayUse: { ativo: false, modo: 'padrao', precoFixo: '', precoAdicional: '', precosOcupacao: { 1: '', 2: '', 3: '', 4: '', 5: '' }, horaAdicionalPorPessoa: '' },
});

// Fills precosOcupacao keys 1..maxPessoas from existing object
function normOcc(occ, max) {
  const n = {};
  for (let i = 1; i <= max; i++) n[i] = occ?.[i] != null ? occ[i] : '';
  return n;
}

// ── Sub-components ────────────────────────────────────────────────────────────

function OccTable({ label, occ, maxPessoas }) {
  const entries = Array.from({ length: maxPessoas }, (_, i) => i + 1);
  return (
    <table className={styles.miniTable}>
      <thead><tr><th>Pax</th><th>{label}</th></tr></thead>
      <tbody>
        {entries.map((q) => (
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
  const entries = Array.from({ length: maxPessoas }, (_, i) => i + 1);
  return (
    <div className={styles.occGrid}>
      {entries.map((q) => (
        <div key={q} className={styles.occCell}>
          <span className={styles.occLabel}>{q} pax</span>
          <Input
            placeholder="R$ 0,00"
            value={occ?.[q] ?? ''}
            onChange={(e) => onChange(q, maskBRL(e.target.value))}
          />
        </div>
      ))}
    </div>
  );
}

function ScheduleFields({ form, onChange }) {
  const mode = form.modoOperacao;

  const toggleDia = (d) => onChange('diasSemana', form.diasSemana.includes(d)
    ? form.diasSemana.filter((x) => x !== d)
    : [...form.diasSemana, d]);

  const toggleMesDia = (d) => onChange('diasMes', form.diasMes.includes(d)
    ? form.diasMes.filter((x) => x !== d)
    : [...form.diasMes, d]);

  const toggleMes = (m) => onChange('meses', form.meses.includes(m)
    ? form.meses.filter((x) => x !== m)
    : [...form.meses, m]);

  if (mode === 'data-especifica') return (
    <>
      <div className={styles.formRow}>
        <FormField label="Data início"><Input type="date" value={form.dataInicio} onChange={(e) => onChange('dataInicio', e.target.value)} /></FormField>
        <FormField label="Data fim"><Input type="date" value={form.dataFim} onChange={(e) => onChange('dataFim', e.target.value)} /></FormField>
      </div>
      <div className={styles.formRow}>
        <FormField label="Hora check-in"><Input type="time" value={form.horaInicio} onChange={(e) => onChange('horaInicio', e.target.value)} /></FormField>
        <FormField label="Hora check-out"><Input type="time" value={form.horaFim} onChange={(e) => onChange('horaFim', e.target.value)} /></FormField>
      </div>
    </>
  );

  if (mode === 'diario') return (
    <>
      <label className={styles.checkboxRow}>
        <input type="checkbox" className={styles.checkbox} checked={form.diaIntegral} onChange={(e) => onChange('diaIntegral', e.target.checked)} />
        <div>
          <span className={styles.checkboxLabel}>Dia Integral</span>
          <span className={styles.checkboxSub}>Sem definição de horário de ciclo</span>
        </div>
      </label>
      {!form.diaIntegral && (
        <div className={styles.formRow}>
          <FormField label="Início do ciclo"><Input type="time" value={form.horaInicioCiclo} onChange={(e) => onChange('horaInicioCiclo', e.target.value)} /></FormField>
          <FormField label="Fim do ciclo"><Input type="time" value={form.horaFimCiclo} onChange={(e) => onChange('horaFimCiclo', e.target.value)} /></FormField>
        </div>
      )}
      <div className={styles.formRow}>
        <FormField label="Check-in"><Input type="time" value={form.horaCheckin} onChange={(e) => onChange('horaCheckin', e.target.value)} /></FormField>
        <FormField label="Check-out"><Input type="time" value={form.horaCheckout} onChange={(e) => onChange('horaCheckout', e.target.value)} /></FormField>
      </div>
    </>
  );

  if (mode === 'semanal') return (
    <>
      <FormField label="Dias da semana">
        <div className={styles.chipGroup}>
          {DIAS_SEMANA.map((d, i) => (
            <button key={i} type="button"
              className={[styles.chip, form.diasSemana.includes(i) ? styles.chipActive : ''].join(' ')}
              onClick={() => toggleDia(i)}
            >{d}</button>
          ))}
        </div>
      </FormField>
      <div className={styles.formRow}>
        <FormField label="Check-in"><Input type="time" value={form.horaCheckin} onChange={(e) => onChange('horaCheckin', e.target.value)} /></FormField>
        <FormField label="Check-out"><Input type="time" value={form.horaCheckout} onChange={(e) => onChange('horaCheckout', e.target.value)} /></FormField>
      </div>
    </>
  );

  if (mode === 'mensal') return (
    <>
      <FormField label="Dias do mês">
        <div className={styles.dayGrid}>
          {DIAS_MES.map((d) => (
            <button key={d} type="button"
              className={[styles.chip, form.diasMes.includes(d) ? styles.chipActive : ''].join(' ')}
              onClick={() => toggleMesDia(d)}
            >{d}</button>
          ))}
        </div>
      </FormField>
      <div className={styles.formRow}>
        <FormField label="Check-in"><Input type="time" value={form.horaCheckin} onChange={(e) => onChange('horaCheckin', e.target.value)} /></FormField>
        <FormField label="Check-out"><Input type="time" value={form.horaCheckout} onChange={(e) => onChange('horaCheckout', e.target.value)} /></FormField>
      </div>
    </>
  );

  if (mode === 'anual') return (
    <>
      <FormField label="Meses">
        <div className={styles.chipGroup}>
          {MESES_NOME.map((m, i) => (
            <button key={i} type="button"
              className={[styles.chip, form.meses.includes(i) ? styles.chipActive : ''].join(' ')}
              onClick={() => toggleMes(i)}
            >{m}</button>
          ))}
        </div>
      </FormField>
      <div className={styles.formRow}>
        <FormField label="Check-in"><Input type="time" value={form.horaCheckin} onChange={(e) => onChange('horaCheckin', e.target.value)} /></FormField>
        <FormField label="Check-out"><Input type="time" value={form.horaCheckout} onChange={(e) => onChange('horaCheckout', e.target.value)} /></FormField>
      </div>
    </>
  );

  return null;
}

function PricingFields({ form, setField, setOcc, prefix = '' }) {
  // prefix = '' for category, 'sea' for seasonal
  const modelo     = form.modeloCobranca;
  const maxPessoas = form.maxPessoas;
  const occ        = form.precosOcupacao ?? {};

  const handleMaxChange = (val) => {
    const max = Math.min(10, Math.max(1, Number(val)));
    setField('maxPessoas', max);
    setField('precosOcupacao', normOcc(occ, max));
    // Also normalize day use occ if it's occupancy mode
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
        <FormField label="Tarifa fixa (R$)">
          <Input placeholder="R$ 0,00" value={form.precoFixo} onChange={(e) => setField('precoFixo', maskBRL(e.target.value))} />
        </FormField>
      ) : (
        <>
          <FormField label="Máximo de pessoas">
            <Input type="number" min="1" max="10" value={maxPessoas} onChange={(e) => handleMaxChange(e.target.value)} />
          </FormField>
          <FormField label="Preço por número de hóspedes">
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
    if (modo === 'padrao') {
      onChange({ ...du, modo, precosOcupacao: {}, horaAdicionalPorPessoa: '' });
    } else {
      onChange({ ...du, modo, precosOcupacao: normOcc(du.precosOcupacao, maxPessoas) });
    }
  };

  return (
    <>
      <label className={styles.checkboxRow}>
        <input type="checkbox" className={styles.checkbox} checked={du.ativo} onChange={(e) => setDu('ativo', e.target.checked)} />
        <div>
          <span className={styles.checkboxLabel}>Habilitar Day Use</span>
          <span className={styles.checkboxSub}>Permite uso do quarto por período (sem pernoite)</span>
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
            <div className={styles.formRow}>
              <FormField label="Preço base">
                <Input placeholder="R$ 0,00" value={du.precoFixo} onChange={(e) => setDu('precoFixo', maskBRL(e.target.value))} />
              </FormField>
              <FormField label="Hora adicional">
                <Input placeholder="R$ 0,00" value={du.precoAdicional} onChange={(e) => setDu('precoAdicional', maskBRL(e.target.value))} />
              </FormField>
            </div>
          ) : (
            <>
              <FormField label="Hora adicional por pessoa">
                <Input placeholder="R$ 0,00" value={du.horaAdicionalPorPessoa} onChange={(e) => setDu('horaAdicionalPorPessoa', maskBRL(e.target.value))} />
              </FormField>
              <FormField label="Preços por hóspedes">
                <OccInputs
                  occ={du.precosOcupacao}
                  maxPessoas={maxPessoas}
                  onChange={(q, v) => onChange({ ...du, precosOcupacao: { ...du.precosOcupacao, [q]: v } })}
                />
              </FormField>
            </>
          )}
        </>
      )}
    </>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function PricingManagement() {
  const [data, setData]             = useState({ categorias: [], sazonalidades: [] });
  const [quartos, setQuartos]       = useState([]);
  const [loading, setLoading]       = useState(true);
  const [notification, setNotif]    = useState(null);
  const [expanded, setExpanded]     = useState({});   // {`cat-${id}` | `sea-${id}`}: bool

  // Category modal
  const [catModal, setCatModal]     = useState(null);  // null | 'create' | 'edit'
  const [editingCat, setEditingCat] = useState(null);
  const [catForm, setCatForm]       = useState(blankCat());
  const [catTab, setCatTab]         = useState('precos');
  const [catSaving, setCatSaving]   = useState(false);

  // Seasonal modal
  const [seaModal, setSeaModal]     = useState(null);  // null | 'create' | 'edit'
  const [editingSea, setEditingSea] = useState(null);
  const [seaForm, setSeaForm]       = useState(blankSea());
  const [seaTab, setSeaTab]         = useState('agenda');
  const [seaSaving, setSeaSaving]   = useState(false);

  // Delete confirm
  const [deleteTarget, setDeleteTarget] = useState(null); // { type: 'cat'|'sea', id, nome }
  const [deleting, setDeleting]         = useState(false);

  // ── Notification helper ────────────────────────────────────────────────────
  const notify = (message, type = 'success') => {
    setNotif({ message, type });
    setTimeout(() => setNotif(null), 3500);
  };

  // ── Load ──────────────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [d, q] = await Promise.all([pricingApi.listar(), pricingApi.listarQuartos()]);
      setData(d);
      setQuartos(q);
    } catch (e) {
      notify('Erro ao carregar dados: ' + e.message, 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const { categorias, sazonalidades } = data;

  // ── KPIs ──────────────────────────────────────────────────────────────────
  const kpis = [
    { label: 'Categorias',        sub: 'Tipos de quarto',        value: categorias.length,                                             color: 'blue',    icon: <Tag size={18} /> },
    { label: 'Com Day Use',       sub: 'Categorias habilitadas', value: categorias.filter((c) => c.dayUse?.ativo).length,              color: 'amber',   icon: <Clock size={18} /> },
    { label: 'Sazonalidades',     sub: 'Períodos cadastrados',   value: sazonalidades.length,                                          color: 'violet',  icon: <Calendar size={18} /> },
    { label: 'Com Sazonais',      sub: 'Categorias vinculadas',  value: categorias.filter((c) => c.sazonaisAtivas?.length > 0).length, color: 'emerald', icon: <Users size={18} /> },
  ];

  // ── Expand toggle ──────────────────────────────────────────────────────────
  const toggleExpand = (key) => setExpanded((p) => ({ ...p, [key]: !p[key] }));

  // ── Category handlers ──────────────────────────────────────────────────────
  const openCreateCat = () => {
    setCatForm(blankCat());
    setEditingCat(null);
    setCatTab('precos');
    setCatModal('create');
  };

  const openEditCat = (cat, e) => {
    e?.stopPropagation();
    const occ = normOcc(cat.precosOcupacao, cat.maxPessoas);
    const du  = cat.dayUse ?? {};
    setCatForm({
      nome:            cat.nome,
      descricao:       cat.descricao,
      maxPessoas:      cat.maxPessoas,
      modeloCobranca:  cat.modeloCobranca,
      precoFixo:       cat.precoFixo != null ? maskBRL(String(Math.round(cat.precoFixo * 100))) : '',
      precosOcupacao:  Object.fromEntries(Object.entries(occ).map(([k, v]) => [k, v != null ? maskBRL(String(Math.round(v * 100))) : ''])),
      quartos:         cat.quartos ?? [],
      sazonaisAtivas:  cat.sazonaisAtivas ?? [],
      dayUse: {
        ativo:                du.ativo ?? false,
        modo:                 du.modo ?? 'padrao',
        precoFixo:            du.precoFixo != null ? maskBRL(String(Math.round(du.precoFixo * 100))) : '',
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

  const toggleCatQuarto    = (id)  => setCatField('quartos', catForm.quartos.includes(id) ? catForm.quartos.filter((x) => x !== id) : [...catForm.quartos, id]);
  const toggleCatSazonais  = (id)  => setCatField('sazonaisAtivas', catForm.sazonaisAtivas.includes(id) ? catForm.sazonaisAtivas.filter((x) => x !== id) : [...catForm.sazonaisAtivas, id]);

  const handleSaveCat = async () => {
    if (!catForm.nome.trim()) { notify('Informe o nome da categoria.', 'error'); return; }
    setCatSaving(true);
    try {
      const payload = {
        nome:           catForm.nome.trim(),
        descricao:      catForm.descricao.trim(),
        maxPessoas:     catForm.maxPessoas,
        modeloCobranca: catForm.modeloCobranca,
        quartos:        catForm.quartos,
        sazonaisAtivas: catForm.sazonaisAtivas,
        precoFixo:      catForm.modeloCobranca === 'Por quarto (tarifa fixa)' ? parseBRL(catForm.precoFixo) : null,
        precosOcupacao: catForm.modeloCobranca === 'Por ocupação'
          ? Object.fromEntries(Object.entries(catForm.precosOcupacao).map(([k, v]) => [k, parseBRL(v)]))
          : null,
        dayUse: {
          ativo:                catForm.dayUse.ativo,
          modo:                 catForm.dayUse.modo,
          precoFixo:            parseBRL(catForm.dayUse.precoFixo),
          precoAdicional:       parseBRL(catForm.dayUse.precoAdicional),
          horaAdicionalPorPessoa: parseBRL(catForm.dayUse.horaAdicionalPorPessoa),
          precosOcupacao:       catForm.dayUse.modo === 'ocupacao'
            ? Object.fromEntries(Object.entries(catForm.dayUse.precosOcupacao).map(([k, v]) => [k, parseBRL(v)]))
            : {},
        },
      };
      if (catModal === 'create') {
        await pricingApi.criarCategoria(payload);
        notify('Categoria criada com sucesso!');
      } else {
        await pricingApi.atualizarCategoria(editingCat.id, payload);
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

  // ── Seasonal handlers ──────────────────────────────────────────────────────
  const openCreateSea = () => {
    setSeaForm(blankSea());
    setEditingSea(null);
    setSeaTab('agenda');
    setSeaModal('create');
  };

  const openEditSea = (s, e) => {
    e?.stopPropagation();
    const occ = normOcc(s.precosOcupacao, s.maxPessoas);
    const du  = s.dayUse ?? {};
    setSeaForm({
      nome:           s.nome,
      descricao:      s.descricao,
      modoOperacao:   s.modoOperacao,
      dataInicio:     s.dataInicio  || '',
      dataFim:        s.dataFim     || '',
      horaInicio:     s.horaInicio  || '',
      horaFim:        s.horaFim     || '',
      diaIntegral:    s.diaIntegral ?? true,
      horaInicioCiclo: s.horaInicioCiclo || '',
      horaFimCiclo:   s.horaFimCiclo    || '',
      horaCheckin:    s.horaCheckin  || '14:00',
      horaCheckout:   s.horaCheckout || '12:00',
      diasSemana:     s.diasSemana   || [],
      diasMes:        s.diasMes      || [],
      meses:          s.meses        || [],
      modeloCobranca: s.modeloCobranca,
      maxPessoas:     s.maxPessoas,
      precoFixo:      s.precoFixo != null ? maskBRL(String(Math.round(s.precoFixo * 100))) : '',
      precosOcupacao: Object.fromEntries(Object.entries(occ).map(([k, v]) => [k, v != null ? maskBRL(String(Math.round(v * 100))) : ''])),
      dayUse: {
        ativo:                du.ativo ?? false,
        modo:                 du.modo ?? 'padrao',
        precoFixo:            du.precoFixo != null ? maskBRL(String(Math.round(du.precoFixo * 100))) : '',
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
    if (!seaForm.nome.trim()) { notify('Informe o nome da sazonalidade.', 'error'); return; }
    setSeaSaving(true);
    try {
      const occ = seaForm.modeloCobranca === 'Por ocupação'
        ? Object.fromEntries(Object.entries(seaForm.precosOcupacao).map(([k, v]) => [k, parseBRL(v)]))
        : null;
      const payload = {
        nome:            seaForm.nome.trim(),
        descricao:       seaForm.descricao.trim(),
        modoOperacao:    seaForm.modoOperacao,
        dataInicio:      seaForm.dataInicio,
        dataFim:         seaForm.dataFim,
        horaInicio:      seaForm.horaInicio,
        horaFim:         seaForm.horaFim,
        diaIntegral:     seaForm.diaIntegral,
        horaInicioCiclo: seaForm.horaInicioCiclo,
        horaFimCiclo:    seaForm.horaFimCiclo,
        horaCheckin:     seaForm.horaCheckin,
        horaCheckout:    seaForm.horaCheckout,
        diasSemana:      seaForm.diasSemana,
        diasMes:         seaForm.diasMes,
        meses:           seaForm.meses,
        modeloCobranca:  seaForm.modeloCobranca,
        maxPessoas:      seaForm.maxPessoas,
        precoFixo:       seaForm.modeloCobranca === 'Por quarto (tarifa fixa)' ? parseBRL(seaForm.precoFixo) : null,
        precosOcupacao:  occ,
        dayUse: {
          ativo:                seaForm.dayUse.ativo,
          modo:                 seaForm.dayUse.modo,
          precoFixo:            parseBRL(seaForm.dayUse.precoFixo),
          precoAdicional:       parseBRL(seaForm.dayUse.precoAdicional),
          horaAdicionalPorPessoa: parseBRL(seaForm.dayUse.horaAdicionalPorPessoa),
          precosOcupacao:       seaForm.dayUse.modo === 'ocupacao'
            ? Object.fromEntries(Object.entries(seaForm.dayUse.precosOcupacao).map(([k, v]) => [k, parseBRL(v)]))
            : {},
        },
      };
      if (seaModal === 'create') {
        await pricingApi.criarSazonalidade(payload);
        notify('Sazonalidade criada com sucesso!');
      } else {
        await pricingApi.atualizarSazonalidade(editingSea.id, payload);
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
      if (deleteTarget.type === 'cat') {
        await pricingApi.excluirCategoria(deleteTarget.id);
        notify('Categoria removida.');
      } else {
        await pricingApi.excluirSazonalidade(deleteTarget.id);
        notify('Sazonalidade removida.');
      }
      setDeleteTarget(null);
      load();
    } catch (e) {
      notify('Erro: ' + e.message, 'error');
    } finally {
      setDeleting(false);
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className={styles.page}>
      <Notification notification={notification} />

      <div className={styles.container}>

        {/* KPIs */}
        {!loading && (
          <div className={styles.kpiGrid}>
            {kpis.map((k) => (
              <div key={k.label} className={[styles.kpiCard, styles[`kpi_${k.color}`]].join(' ')}>
                <div className={styles.kpiIcon}>{k.icon}</div>
                <div className={styles.kpiBody}>
                  <span className={styles.kpiLabel}>{k.label}</span>
                  <span className={styles.kpiValue}>{k.value}</span>
                  <span className={styles.kpiSub}>{k.sub}</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── Categorias de Preço ── */}
        <div className={styles.card}>
          <div className={styles.tableHeader}>
            <div>
              <h2 className={styles.h2}>Categorias de Preço</h2>
              <p className={styles.subtitle}>Defina tarifas, Day Use e sazonalidades por categoria de quarto</p>
            </div>
            <div className={styles.tableTools}>
              <Button variant="secondary" onClick={openCreateSea}>
                <Calendar size={14} /> Nova Sazonalidade
              </Button>
              <Button variant="primary" onClick={openCreateCat}>
                <Plus size={15} /> Nova Categoria
              </Button>
            </div>
          </div>

          {loading ? (
            <div className={styles.empty}><Loader2 size={28} className={styles.spin} /><span>Carregando...</span></div>
          ) : categorias.length === 0 ? (
            <div className={styles.empty}><Tag size={32} color="var(--text-2)" /><span>Nenhuma categoria cadastrada</span></div>
          ) : categorias.map((cat) => {
            const key     = `cat-${cat.id}`;
            const isOpen  = !!expanded[key];
            const du      = cat.dayUse ?? {};
            const seaNomes = (cat.sazonaisAtivas ?? [])
              .map((sid) => sazonalidades.find((s) => s.id === sid)?.nome)
              .filter(Boolean);

            return (
              <div key={cat.id}>
                <div className={styles.expandRow} onClick={() => toggleExpand(key)}>
                  <div className={styles.expandLeft}>
                    <ChevronDown size={14} className={[styles.chevron, isOpen ? styles.chevronOpen : ''].join(' ')} />
                    <div>
                      <div className={styles.rowName}>{cat.nome}</div>
                      {cat.descricao && <div className={styles.rowDesc}>{cat.descricao}</div>}
                      <div className={styles.badges}>
                        <span className={styles.badge}>{cat.modeloCobranca}</span>
                        {du.ativo && <span className={[styles.badge, styles.badgeAmber].join(' ')}>Day Use</span>}
                        {seaNomes.length > 0 && <span className={[styles.badge, styles.badgeViolet].join(' ')}>{seaNomes.length} sazonalidade{seaNomes.length !== 1 ? 's' : ''}</span>}
                        <span className={styles.badge}>{(cat.quartos ?? []).length} quartos</span>
                      </div>
                    </div>
                  </div>
                  <div className={styles.expandRight}>
                    <span className={styles.priceRange}>{getPrecoRange(cat)}</span>
                    <div className={styles.actionBtns} onClick={(e) => e.stopPropagation()}>
                      <button type="button" className={styles.actionBtn} onClick={(e) => openEditCat(cat, e)}>
                        <Edit2 size={11} /> Editar
                      </button>
                      <button type="button" className={[styles.actionBtn, styles.actionBtnDanger].join(' ')}
                        onClick={(e) => { e.stopPropagation(); setDeleteTarget({ type: 'cat', id: cat.id, nome: cat.nome }); }}
                      >
                        <Trash2 size={11} /> Excluir
                      </button>
                    </div>
                  </div>
                </div>

                {isOpen && (
                  <div className={styles.expandBody}>
                    {/* Hospedagem */}
                    <div className={styles.expandPanel}>
                      <div className={styles.panelTitle}><Users size={12} /> Hospedagem</div>
                      {cat.modeloCobranca === 'Por quarto (tarifa fixa)' ? (
                        <div className={styles.fixedPrice}>{fmtBRL(cat.precoFixo)}</div>
                      ) : (
                        <OccTable label="Preço/noite" occ={cat.precosOcupacao} maxPessoas={cat.maxPessoas} />
                      )}
                    </div>

                    {/* Day Use */}
                    <div className={styles.expandPanel}>
                      <div className={styles.panelTitle}>
                        <Clock size={12} /> Day Use
                        <span className={[styles.badge, du.ativo ? styles.badgeAmber : ''].join(' ')} style={{ marginLeft: 'auto' }}>
                          {du.ativo ? 'Ativo' : 'Inativo'}
                        </span>
                      </div>
                      {du.ativo ? (
                        du.modo === 'padrao' ? (
                          <>
                            <div className={styles.duRow}><span className={styles.duLabel}>Preço base</span><span className={styles.duVal}>{fmtBRL(du.precoFixo)}</span></div>
                            <div className={styles.duRow}><span className={styles.duLabel}>Hora adicional</span><span className={styles.duVal}>{fmtBRL(du.precoAdicional)}</span></div>
                          </>
                        ) : (
                          <>
                            <div className={styles.duRow}><span className={styles.duLabel}>Hora ad./pessoa</span><span className={styles.duVal}>{fmtBRL(du.horaAdicionalPorPessoa)}</span></div>
                            <OccTable label="Preço" occ={du.precosOcupacao} maxPessoas={cat.maxPessoas} />
                          </>
                        )
                      ) : <div className={styles.duInactive}>Não habilitado para esta categoria.</div>}
                    </div>

                    {/* Sazonais + Quartos */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      <div className={styles.expandPanel}>
                        <div className={styles.panelTitle}><Calendar size={12} /> Sazonalidades ativas</div>
                        {seaNomes.length === 0
                          ? <div className={styles.pillEmpty}>Nenhuma sazonal ativa.</div>
                          : (
                            <div className={styles.pillWrap}>
                              {seaNomes.map((n, i) => <span key={i} className={[styles.pill, styles.badgeViolet].join(' ')} style={{ border: 'none' }}>{n}</span>)}
                            </div>
                          )}
                      </div>
                      <div className={styles.expandPanel}>
                        <div className={styles.panelTitle}><BedDouble size={12} /> Quartos vinculados</div>
                        {(cat.quartos ?? []).length === 0
                          ? <div className={styles.pillEmpty}>Nenhum quarto vinculado.</div>
                          : (
                            <div className={styles.pillWrap}>
                              {(cat.quartos ?? []).map((qid) => {
                                const q = quartos.find((x) => x.id === qid);
                                return q ? <span key={qid} className={styles.pill}>Quarto {q.numero}</span> : null;
                              })}
                            </div>
                          )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* ── Sazonalidades Cadastradas ── */}
        <div className={styles.card}>
          <div className={styles.tableHeader}>
            <div>
              <h2 className={styles.h2}>Sazonalidades Cadastradas</h2>
              <p className={styles.subtitle}>Períodos especiais com tarifas diferenciadas</p>
            </div>
          </div>

          {loading ? (
            <div className={styles.empty}><Loader2 size={24} className={styles.spin} /></div>
          ) : sazonalidades.length === 0 ? (
            <div className={styles.empty}><Calendar size={32} color="var(--text-2)" /><span>Nenhuma sazonalidade cadastrada</span></div>
          ) : sazonalidades.map((s) => {
            const key    = `sea-${s.id}`;
            const isOpen = !!expanded[key];
            const du     = s.dayUse ?? {};

            return (
              <div key={s.id}>
                <div className={styles.expandRow} onClick={() => toggleExpand(key)}>
                  <div className={styles.expandLeft}>
                    <ChevronDown size={14} className={[styles.chevron, isOpen ? styles.chevronOpen : ''].join(' ')} />
                    <div>
                      <div className={styles.rowName}>{s.nome}</div>
                      {s.descricao && <div className={styles.rowDesc}>{s.descricao}</div>}
                      <div className={styles.rowMeta}>{describeSchedule(s)}</div>
                      <div className={styles.badges}>
                        <span className={styles.badge}>{MODO_LABEL[s.modoOperacao] || s.modoOperacao}</span>
                        <span className={styles.badge}>{s.modeloCobranca}</span>
                        {du.ativo && <span className={[styles.badge, styles.badgeAmber].join(' ')}>Day Use</span>}
                      </div>
                    </div>
                  </div>
                  <div className={styles.expandRight}>
                    <span className={styles.priceRange}>{getPrecoRange(s)}</span>
                    <div className={styles.actionBtns} onClick={(e) => e.stopPropagation()}>
                      <button type="button" className={styles.actionBtn} onClick={(e) => openEditSea(s, e)}>
                        <Edit2 size={11} /> Editar
                      </button>
                      <button type="button" className={[styles.actionBtn, styles.actionBtnDanger].join(' ')}
                        onClick={(e) => { e.stopPropagation(); setDeleteTarget({ type: 'sea', id: s.id, nome: s.nome }); }}
                      >
                        <Trash2 size={11} /> Excluir
                      </button>
                    </div>
                  </div>
                </div>

                {isOpen && (
                  <div className={styles.expandBody}>
                    {/* Preços */}
                    <div className={styles.expandPanel}>
                      <div className={styles.panelTitle}><DollarSign size={12} /> Preços</div>
                      {s.modeloCobranca === 'Por quarto (tarifa fixa)' ? (
                        <div className={styles.fixedPrice}>{fmtBRL(s.precoFixo)}</div>
                      ) : (
                        <OccTable label="Preço/noite" occ={s.precosOcupacao} maxPessoas={s.maxPessoas} />
                      )}
                    </div>

                    {/* Day Use */}
                    <div className={styles.expandPanel}>
                      <div className={styles.panelTitle}>
                        <Clock size={12} /> Day Use
                        <span className={[styles.badge, du.ativo ? styles.badgeAmber : ''].join(' ')} style={{ marginLeft: 'auto' }}>
                          {du.ativo ? 'Ativo' : 'Inativo'}
                        </span>
                      </div>
                      {du.ativo ? (
                        du.modo === 'padrao' ? (
                          <>
                            <div className={styles.duRow}><span className={styles.duLabel}>Preço base</span><span className={styles.duVal}>{fmtBRL(du.precoFixo)}</span></div>
                            <div className={styles.duRow}><span className={styles.duLabel}>Hora adicional</span><span className={styles.duVal}>{fmtBRL(du.precoAdicional)}</span></div>
                          </>
                        ) : (
                          <>
                            <div className={styles.duRow}><span className={styles.duLabel}>Hora ad./pessoa</span><span className={styles.duVal}>{fmtBRL(du.horaAdicionalPorPessoa)}</span></div>
                            <OccTable label="Preço" occ={du.precosOcupacao} maxPessoas={s.maxPessoas} />
                          </>
                        )
                      ) : <div className={styles.duInactive}>Não habilitado para esta sazonalidade.</div>}
                    </div>

                    {/* Agendamento detalhado */}
                    <div className={styles.expandPanel}>
                      <div className={styles.panelTitle}><RefreshCw size={12} /> Agendamento</div>
                      <div className={styles.duRow}><span className={styles.duLabel}>Modo</span><span className={styles.duVal}>{MODO_LABEL[s.modoOperacao]}</span></div>
                      {s.modoOperacao === 'data-especifica' && (
                        <>
                          <div className={styles.duRow}><span className={styles.duLabel}>Início</span><span className={styles.duVal}>{s.dataInicio || '—'} {s.horaInicio}</span></div>
                          <div className={styles.duRow}><span className={styles.duLabel}>Fim</span><span className={styles.duVal}>{s.dataFim || '—'} {s.horaFim}</span></div>
                        </>
                      )}
                      {s.modoOperacao === 'semanal' && (
                        <div className={styles.duRow}>
                          <span className={styles.duLabel}>Dias</span>
                          <span className={styles.duVal}>{(s.diasSemana || []).map((d) => DIAS_SEMANA[d]).join(', ') || '—'}</span>
                        </div>
                      )}
                      {s.modoOperacao === 'mensal' && (
                        <div className={styles.duRow}>
                          <span className={styles.duLabel}>Dias do mês</span>
                          <span className={styles.duVal}>{(s.diasMes || []).join(', ') || '—'}</span>
                        </div>
                      )}
                      {s.modoOperacao === 'anual' && (
                        <div className={styles.duRow}>
                          <span className={styles.duLabel}>Meses</span>
                          <span className={styles.duVal}>{(s.meses || []).map((m) => MESES_NOME[m]).join(', ') || '—'}</span>
                        </div>
                      )}
                      {(s.horaCheckin || s.horaCheckout) && (
                        <>
                          <div className={styles.duRow}><span className={styles.duLabel}>Check-in</span><span className={styles.duVal}>{s.horaCheckin || '—'}</span></div>
                          <div className={styles.duRow}><span className={styles.duLabel}>Check-out</span><span className={styles.duVal}>{s.horaCheckout || '—'}</span></div>
                        </>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════
          MODAL — Categoria (create / edit)
      ═══════════════════════════════════════════════════════ */}
      <Modal
        open={!!catModal}
        onClose={() => setCatModal(null)}
        size="lg"
        title={catModal === 'create' ? <><Tag size={15} /> Nova Categoria</> : <><Edit2 size={15} /> Editar Categoria</>}
        footer={
          <div className={styles.modalFooter}>
            <Button variant="secondary" onClick={() => setCatModal(null)}>Cancelar</Button>
            <Button variant="primary" onClick={handleSaveCat} disabled={catSaving}>
              {catSaving && <Loader2 size={14} className={styles.spinInline} />}
              {catModal === 'create' ? 'Criar Categoria' : 'Salvar'}
            </Button>
          </div>
        }
      >
        <div className={styles.tabs}>
          {[['precos','Preços'],['dayuse','Day Use'],['vinculos','Quartos & Sazonais']].map(([t, label]) => (
            <button key={t} type="button"
              className={[styles.tab, catTab === t ? styles.tabActive : ''].join(' ')}
              onClick={() => setCatTab(t)}
            >{label}</button>
          ))}
        </div>

        <div style={{ padding: '16px 0 0' }}>
          {catTab === 'precos' && (
            <div className={styles.formBody}>
              <FormField label="Nome da Categoria *">
                <Input value={catForm.nome} onChange={(e) => setCatField('nome', e.target.value.toUpperCase())} placeholder="EX: STANDARD ATÉ 5 PESSOAS" />
              </FormField>
              <FormField label="Descrição">
                <Input value={catForm.descricao} onChange={(e) => setCatField('descricao', e.target.value.toUpperCase())} placeholder="DESCRIÇÃO DA CATEGORIA" />
              </FormField>
              <PricingFields
                form={catForm}
                setField={setCatField}
                setOcc={setCatOcc}
              />
            </div>
          )}

          {catTab === 'dayuse' && (
            <div className={styles.formBody}>
              <DayUseFields
                du={catForm.dayUse}
                maxPessoas={catForm.maxPessoas}
                onChange={(du) => setCatField('dayUse', du)}
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
                      <span className={styles.checkItemLabel}>Quarto {q.numero}</span>
                      <span className={styles.checkItemSub}>{q.tipo}</span>
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
          MODAL — Sazonalidade (create / edit)
      ═══════════════════════════════════════════════════════ */}
      <Modal
        open={!!seaModal}
        onClose={() => setSeaModal(null)}
        size="lg"
        title={seaModal === 'create' ? <><Calendar size={15} /> Nova Sazonalidade</> : <><Edit2 size={15} /> Editar Sazonalidade</>}
        footer={
          <div className={styles.modalFooter}>
            <Button variant="secondary" onClick={() => setSeaModal(null)}>Cancelar</Button>
            <Button variant="primary" onClick={handleSaveSea} disabled={seaSaving}>
              {seaSaving && <Loader2 size={14} className={styles.spinInline} />}
              {seaModal === 'create' ? 'Criar Sazonalidade' : 'Salvar'}
            </Button>
          </div>
        }
      >
        <div className={styles.tabs}>
          {[['agenda','Agendamento'],['precos','Preços'],['dayuse','Day Use']].map(([t, label]) => (
            <button key={t} type="button"
              className={[styles.tab, seaTab === t ? styles.tabActive : ''].join(' ')}
              onClick={() => setSeaTab(t)}
            >{label}</button>
          ))}
        </div>

        <div style={{ padding: '16px 0 0' }}>
          {seaTab === 'agenda' && (
            <div className={styles.formBody}>
              <FormField label="Nome da Sazonalidade *">
                <Input value={seaForm.nome} onChange={(e) => setSeaField('nome', e.target.value.toUpperCase())} placeholder="EX: ALTA TEMPORADA VERÃO" />
              </FormField>
              <FormField label="Descrição">
                <Input value={seaForm.descricao} onChange={(e) => setSeaField('descricao', e.target.value.toUpperCase())} placeholder="DESCRIÇÃO" />
              </FormField>
              <span className={styles.sectionTitle}>Modo de Operação</span>
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
              <ScheduleFields
                form={seaForm}
                onChange={setSeaField}
              />
            </div>
          )}

          {seaTab === 'precos' && (
            <div className={styles.formBody}>
              <PricingFields
                form={seaForm}
                setField={setSeaField}
                setOcc={setSeaOcc}
              />
            </div>
          )}

          {seaTab === 'dayuse' && (
            <div className={styles.formBody}>
              <DayUseFields
                du={seaForm.dayUse}
                maxPessoas={seaForm.maxPessoas}
                onChange={(du) => setSeaField('dayUse', du)}
              />
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
        <div style={{ fontSize: 14, color: 'var(--text)', lineHeight: 1.5 }}>
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
