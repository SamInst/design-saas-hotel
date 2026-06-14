import { useMemo, useState } from 'react';
import { Tag, Percent, CalendarDays } from 'lucide-react';
import { Modal } from './Modal';
import { Button } from './Button';
import { Input, FormField } from './Input';

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
const fmtBRL = (v) =>
  (Number(v) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

/**
 * Cálculo puro do total ajustado ("Gerenciar Preços"). Todo o cálculo é feito no front-end;
 * o resultado (valor_total, diárias e os campos do snapshot) é enviado ao back-end.
 *
 * @param mode  'diaria' | 'desconto' | 'porcentagem'
 * @param sign  'desconto' (−) | 'adicional' (+)  — ignorado no modo 'diaria'
 * @returns { valorTotal, diarias, requestFields }
 */
export function computeAdjustedTotal({ baseTotal = 0, baseDiarias = [], mode, sign, value }) {
  const s = sign === 'desconto' ? -1 : 1;
  const v = Number(value) || 0;
  const requestFields = {
    quantidade_diarias: null,
    quantidade_pessoas: null,
    valor_diaria: null,
    porcentagem: null,
    valor_desconto: null,
  };
  let valorTotal = round2(baseTotal);
  let diarias = null;

  if (mode === 'diaria') {
    // Sobrescreve o valor de cada diária pelo valor informado.
    const novoValor = Math.max(0, round2(v));
    diarias = baseDiarias.map((d) => ({ id: d.id, valor: novoValor }));
    valorTotal = round2(novoValor * baseDiarias.length);
    requestFields.quantidade_diarias = baseDiarias.length || null;
    requestFields.valor_diaria = novoValor;
  } else if (mode === 'desconto') {
    valorTotal = Math.max(0, round2(baseTotal + s * v));
    requestFields.valor_desconto = s * v;
  } else if (mode === 'porcentagem') {
    valorTotal = Math.max(0, round2(baseTotal + (s * baseTotal * v) / 100));
    requestFields.porcentagem = s * Math.round(v);
  }

  return { valorTotal, diarias, requestFields };
}

/** Reconstrói o estado inicial do modal a partir de um snapshot vindo do back-end (novo_preco). */
export function novoPrecoToState(np) {
  if (!np) return null;
  if (np.valor_diaria != null) {
    return { mode: 'diaria', sign: 'adicional', value: np.valor_diaria };
  }
  if (np.valor_desconto != null) {
    return {
      mode: 'desconto',
      sign: np.valor_desconto < 0 ? 'desconto' : 'adicional',
      value: Math.abs(np.valor_desconto),
    };
  }
  if (np.porcentagem != null) {
    return {
      mode: 'porcentagem',
      sign: np.porcentagem < 0 ? 'desconto' : 'adicional',
      value: Math.abs(np.porcentagem),
    };
  }
  return null;
}

/** Descrição automática da ação de ajuste, para exibir no card de preço. */
export function describeAdjustment(raw) {
  if (!raw) return '';
  const { mode, sign, value } = raw;
  const v = Number(value) || 0;
  if (mode === 'diaria') return `Diária definida para ${fmtBRL(v)}`;
  if (mode === 'desconto') return sign === 'desconto' ? 'Desconto sobre o total' : 'Adicional sobre o total';
  return sign === 'desconto'
    ? `Desconto de ${v}% sobre o total`
    : `Adicional de ${v}% sobre o total`;
}

const MODE_ICONS = { diaria: CalendarDays, desconto: Tag, porcentagem: Percent };

const modeLabel = (key, sign) => {
  if (key === 'diaria') return 'Valor por diária';
  if (key === 'desconto') {
    return sign === 'desconto' ? 'Valor de desconto sobre o total' : 'Valor adicional sobre o total';
  }
  return sign === 'desconto'
    ? 'Desconto por porcentagem sobre o total'
    : 'Adicional por porcentagem sobre o total';
};

const modeHint = (key) => {
  if (key === 'diaria') return 'Sobrescreve o valor de cada diária.';
  if (key === 'desconto') return 'Ajuste em reais sobre o total.';
  return 'Ajuste percentual sobre o total.';
};

const card = (active) => ({
  display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', cursor: 'pointer',
  border: `1px solid ${active ? 'var(--accent, #6366f1)' : 'var(--border, #2a2a35)'}`,
  borderRadius: 8, background: active ? 'color-mix(in srgb, var(--accent, #6366f1) 12%, transparent)' : 'transparent',
});

/**
 * Modal de ajuste manual de preço por hospedagem. Apenas um modo por vez.
 *
 * @param baseTotal    total atual (sem ajuste).
 * @param baseDiarias  [{ id, valor }] — diárias atuais (necessário para o modo "diária").
 * @param initial      estado inicial (use novoPrecoToState para reconstruir de um snapshot).
 * @param onApply      (result, raw) => void  — result de computeAdjustedTotal.
 */
export function PriceAdjustmentModal({ open, onClose, baseTotal = 0, baseDiarias = [], initial, onApply }) {
  const [sign, setSign] = useState(initial?.sign ?? 'desconto');
  const [mode, setMode] = useState(initial?.mode ?? 'desconto');
  const [value, setValue] = useState(initial?.value ?? '');

  const result = useMemo(
    () => computeAdjustedTotal({ baseTotal, baseDiarias, mode, sign, value }),
    [baseTotal, baseDiarias, mode, sign, value],
  );

  const diff = result.valorTotal - baseTotal;
  const canApply = value !== '' && Number(value) >= 0 && (mode !== 'diaria' || baseDiarias.length > 0);
  const showSign = mode !== 'diaria';

  const fieldLabel =
    mode === 'porcentagem' ? 'Porcentagem (%)' : mode === 'diaria' ? 'Novo valor da diária (R$)' : 'Valor (R$)';

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Gerenciar Preços"
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button
            variant="primary"
            disabled={!canApply}
            onClick={() => {
              onApply(result, { mode, sign, value: Number(value) || 0 });
              onClose();
            }}
          >
            Aplicar
          </Button>
        </>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {/* Sinal: desconto / adicional (não se aplica ao modo diária) */}
        {showSign && (
          <div style={{ display: 'flex', gap: 8 }}>
            {[
              { k: 'desconto',  t: 'Desconto (−)' },
              { k: 'adicional', t: 'Adicional (+)' },
            ].map(({ k, t }) => (
              <button
                key={k}
                type="button"
                onClick={() => setSign(k)}
                style={{ ...card(sign === k), flex: 1, justifyContent: 'center', fontWeight: 600 }}
              >
                {t}
              </button>
            ))}
          </div>
        )}

        {/* Modo: apenas um por vez */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {['diaria', 'desconto', 'porcentagem'].map((key) => {
            const Icon = MODE_ICONS[key];
            return (
              <button key={key} type="button" onClick={() => { setMode(key); setValue(''); }} style={card(mode === key)}>
                <Icon size={16} />
                <span style={{ display: 'flex', flexDirection: 'column', textAlign: 'left' }}>
                  <b style={{ fontSize: 13 }}>{modeLabel(key, sign)}</b>
                  <span style={{ fontSize: 11, color: 'var(--text-2, #9aa)' }}>{modeHint(key)}</span>
                </span>
              </button>
            );
          })}
        </div>

        {/* Campo do modo ativo */}
        <FormField label={fieldLabel}>
          <Input
            type="number"
            min="0"
            step={mode === 'porcentagem' ? '1' : '0.01'}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={mode === 'porcentagem' ? 'Ex.: 10' : mode === 'diaria' ? 'Ex.: 150,00' : 'Ex.: 50,00'}
          />
        </FormField>

        {/* Prévia — mostra a diferença em relação ao valor original */}
        <div style={{ borderTop: '1px solid var(--border, #2a2a35)', paddingTop: 10, fontSize: 13 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-2, #9aa)' }}>
            <span>{mode === 'diaria' ? 'Total atual (diárias)' : 'Total atual'}</span><span>{fmtBRL(baseTotal)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-2, #9aa)' }}>
            <span>Diferença</span>
            <span style={{ color: diff < 0 ? '#10b981' : diff > 0 ? '#f97316' : 'inherit' }}>
              {diff > 0 ? '+' : ''}{fmtBRL(diff)}
            </span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, marginTop: 4 }}>
            <span>Novo total</span><span>{fmtBRL(result.valorTotal)}</span>
          </div>
        </div>
      </div>
    </Modal>
  );
}
