import { useMemo, useState } from 'react';
import { Tag, Percent, CalendarDays, Check } from 'lucide-react';
import { Modal } from './Modal';
import { Button } from './Button';
import { Input, FormField } from './Input';
import styles from './PriceAdjustmentModal.module.css';

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
const fmtBRL = (v) =>
  (Number(v) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

// Máscara de moeda (mesmo padrão do campo "Valor *" do PaymentModal).
const maskBRL = (v) => {
  const digits = String(v ?? '').replace(/\D/g, '');
  if (!digits) return '';
  return (parseInt(digits, 10) / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
};
const parseBRL = (v) => {
  const s = String(v ?? '').replace(/[R$\s.]/g, '').replace(',', '.');
  return parseFloat(s) || 0;
};

// Converte o valor numérico (snapshot/back-end) para o texto exibido no campo.
const valueToDisplay = (mode, num) => {
  if (num == null || num === '') return '';
  if (mode === 'porcentagem') return String(num);
  return maskBRL(String(Math.round(Number(num) * 100)));
};

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
  if (key === 'diaria') return 'Por diária';
  if (key === 'desconto') {
    return sign === 'desconto' ? 'Sobre o total' : 'Sobre o total';
  }
  return sign === 'desconto'
    ? 'Porcentagem sobre o total'
    : 'Porcentagem sobre o total';
};

const modeHint = (key) => {
  if (key === 'diaria') return 'Sobrescreve o valor de cada diária.';
  if (key === 'desconto') return 'Ajuste em reais sobre o total.';
  return 'Ajuste percentual sobre o total.';
};

/**
 * Modal de ajuste manual de preço por hospedagem. Apenas um modo por vez.
 *
 * @param baseTotal    total atual (sem ajuste).
 * @param baseDiarias  [{ id, valor }] — diárias atuais (necessário para o modo "diária").
 * @param initial      estado inicial (use novoPrecoToState para reconstruir de um snapshot).
 * @param onApply      (result, raw) => void  — result de computeAdjustedTotal.
 */
export function PriceAdjustmentModal({ open, onClose, baseTotal = 0, baseDiarias = [], initial, onApply, allowDiaria = true, title = 'Gerenciar Preços' }) {
  // Modos disponíveis. allowDiaria=false (ex.: ajuste de grupo) remove o "Por diária".
  const modeKeys = allowDiaria ? ['diaria', 'desconto', 'porcentagem'] : ['desconto', 'porcentagem'];
  const [sign, setSign] = useState(initial?.sign ?? 'desconto');
  const [mode, setMode] = useState(modeKeys.includes(initial?.mode) ? initial.mode : 'desconto');
  const [value, setValue] = useState(() => valueToDisplay(initial?.mode ?? 'desconto', initial?.value));

  // Modos em reais usam máscara de moeda; a porcentagem permanece numérica.
  const numericValue = mode === 'porcentagem' ? (Number(value) || 0) : parseBRL(value);

  const result = useMemo(
    () => computeAdjustedTotal({ baseTotal, baseDiarias, mode, sign, value: numericValue }),
    [baseTotal, baseDiarias, mode, sign, numericValue],
  );

  const diff = result.valorTotal - baseTotal;
  const canApply = value !== '' && numericValue >= 0 && (mode !== 'diaria' || baseDiarias.length > 0);
  const showSign = mode !== 'diaria';

  const fieldLabel =
    mode === 'porcentagem' ? 'Porcentagem (%)' : mode === 'diaria' ? 'Novo valor da diária (R$)' : 'Valor (R$)';

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button
            variant="primary"
            disabled={!canApply}
            onClick={() => {
              onApply(result, { mode, sign, value: numericValue });
              onClose();
            }}
          >
            Aplicar
          </Button>
        </>
      }
    >
      <div className={styles.stack}>
        {/* Sinal: desconto / adicional (não se aplica ao modo diária) */}
        {showSign && (
          <div className={[styles.choiceCards, styles.choiceCardsRow].join(' ')}>
            {[
              { k: 'desconto',  t: 'Desconto (−)', d: 'Diminui o total.' },
              { k: 'adicional', t: 'Adicional (+)', d: 'Aumenta o total.' },
            ].map(({ k, t, d }) => (
              <button
                key={k}
                type="button"
                onClick={() => setSign(k)}
                className={[styles.choiceCard, sign === k ? styles.choiceCardOn : ''].join(' ')}
              >
                <span className={[styles.checkBox, sign === k ? styles.checkBoxOn : ''].join(' ')}>
                  {sign === k && <Check size={11} />}
                </span>
                <span className={styles.choiceCardText}>
                  <span className={styles.choiceCardTitle}>{t}</span>
                  <span className={styles.choiceCardDesc}>{d}</span>
                </span>
              </button>
            ))}
          </div>
        )}

        {/* Modo: apenas um por vez */}
        <div className={styles.choiceCards}>
          {modeKeys.map((key) => {
            const Icon = MODE_ICONS[key];
            return (
              <button
                key={key}
                type="button"
                onClick={() => { setMode(key); setValue(''); }}
                className={[styles.choiceCard, mode === key ? styles.choiceCardOn : ''].join(' ')}
              >
                <span className={[styles.checkBox, mode === key ? styles.checkBoxOn : ''].join(' ')}>
                  {mode === key && <Check size={11} />}
                </span>
                <span className={styles.choiceCardText}>
                  <span className={styles.choiceCardTitle}><Icon size={14} /> {modeLabel(key, sign)}</span>
                  <span className={styles.choiceCardDesc}>{modeHint(key)}</span>
                </span>
              </button>
            );
          })}
        </div>

        {/* Campo do modo ativo */}
        <FormField label={fieldLabel}>
          {mode === 'porcentagem' ? (
            <Input
              type="number"
              min="0"
              step="1"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="Ex.: 10"
            />
          ) : (
            <Input
              type="text"
              inputMode="numeric"
              value={value}
              onChange={(e) => setValue(maskBRL(e.target.value))}
              placeholder="R$ 0,00"
            />
          )}
        </FormField>

        {/* Prévia por diária — desconto/adicional aplicado a cada diária (modo "Por diária") */}
        {mode === 'diaria' && numericValue > 0 && baseDiarias.length > 0 && (
          <div className={styles.preview}>
            {baseDiarias.map((d, i) => {
              const novo = result.diarias?.[i]?.valor ?? 0;
              const dd = novo - (d.valor || 0);
              return (
                <div key={i} className={styles.diariaRow}>
                  <span className={styles.diariaLabel}>Diária {i + 1}</span>
                  <span className={styles.diariaVals}>
                    <span className={styles.diariaOld}>{fmtBRL(d.valor)}</span>
                    <span>{fmtBRL(novo)}</span>
                    <span className={[styles.diariaDiff, dd < 0 ? styles.previewDown : dd > 0 ? styles.previewUp : ''].join(' ')}>
                      {dd > 0 ? '+' : ''}{fmtBRL(dd)}
                    </span>
                  </span>
                </div>
              );
            })}
          </div>
        )}

        {/* Prévia — mostra a diferença em relação ao valor original */}
        <div className={styles.preview}>
          <div className={styles.previewRow}>
            <span>{mode === 'diaria' ? 'Total atual (diárias)' : 'Total atual'}</span>
            <span>{fmtBRL(baseTotal)}</span>
          </div>
          <div className={styles.previewRow}>
            <span>Diferença</span>
            <span className={diff < 0 ? styles.previewDown : diff > 0 ? styles.previewUp : ''}>
              {diff > 0 ? '+' : ''}{fmtBRL(diff)}
            </span>
          </div>
          <div className={[styles.previewRow, styles.previewTotal].join(' ')}>
            <span>Novo total</span><span>{fmtBRL(result.valorTotal)}</span>
          </div>
        </div>
      </div>
    </Modal>
  );
}
