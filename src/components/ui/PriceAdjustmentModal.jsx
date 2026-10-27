import { useMemo, useState } from 'react';
import { Tag, Percent, CalendarDays, Check } from 'lucide-react';
import { Modal } from './Modal';
import { Button } from './Button';
import { Input, FormField } from './Input';
import styles from './PriceAdjustmentModal.module.css';
import { tr } from '../../i18n';

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
 * @param selecionadas  índices das diárias alteradas no modo 'diaria' (null = todas)
 * @returns { valorTotal, diarias, requestFields }
 */
export function computeAdjustedTotal({ baseTotal = 0, baseDiarias = [], mode, sign, value, selecionadas = null }) {
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
    // Sobrescreve o valor das diárias escolhidas (todas, sem seleção); as demais ficam como estão.
    const novoValor = Math.max(0, round2(v));
    const alvo = (i) => !selecionadas || selecionadas.includes(i);
    diarias = baseDiarias.map((d, i) => ({ id: d.id, valor: alvo(i) ? novoValor : round2(d.valor) }));
    valorTotal = round2(diarias.reduce((acc, d) => acc + d.valor, 0));
    requestFields.quantidade_diarias = (selecionadas ? selecionadas.length : baseDiarias.length) || null;
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
  if (mode === 'diaria') return tr('Diária definida para {{v0}}', { v0: fmtBRL(v) });
  if (mode === 'desconto') return sign === 'desconto' ? tr('Desconto sobre o total') : tr('Adicional sobre o total');
  return sign === 'desconto'
    ? tr('Desconto de {{v}}% sobre o total', { v })
    : tr('Adicional de {{v}}% sobre o total', { v });
}

const MODE_ICONS = { diaria: CalendarDays, desconto: Tag, porcentagem: Percent };

const modeLabel = (key, sign) => {
  if (key === 'diaria') return tr('Por diária');
  if (key === 'desconto') {
    return sign === 'desconto' ? tr('Sobre o total') : tr('Sobre o total');
  }
  return sign === 'desconto'
    ? tr('Porcentagem sobre o total')
    : tr('Porcentagem sobre o total');
};

const modeHint = (key) => {
  if (key === 'diaria') return tr('Sobrescreve o valor de cada diária.');
  if (key === 'desconto') return tr('Ajuste em reais sobre o total.');
  return tr('Ajuste percentual sobre o total.');
};

/**
 * Modal de ajuste manual de preço por hospedagem. Apenas um modo por vez.
 *
 * @param baseTotal    total atual (sem ajuste).
 * @param baseDiarias  [{ id, valor, sazonalidade? }] — diárias atuais (necessário para o modo "diária").
 * @param initial      estado inicial (use novoPrecoToState para reconstruir de um snapshot).
 * @param onApply      (result, raw) => void  — result de computeAdjustedTotal.
 */
export function PriceAdjustmentModal({ open, onClose, baseTotal = 0, baseDiarias = [], initial, onApply, allowDiaria = true, title = tr('Gerenciar Preços'), as: Wrap = Modal, lateral = null, wrapProps = {}, botaoAplicar = null }) {
  // Modos disponíveis. allowDiaria=false (ex.: ajuste de grupo) remove o "Por diária".
  const modeKeys = allowDiaria ? ['diaria', 'desconto', 'porcentagem'] : ['desconto', 'porcentagem'];
  const [sign, setSign] = useState(initial?.sign ?? 'desconto');
  const [mode, setMode] = useState(modeKeys.includes(initial?.mode) ? initial.mode : 'desconto');
  const [value, setValue] = useState(() => valueToDisplay(initial?.mode ?? 'desconto', initial?.value));
  // Aplicar pede confirmação antes de enviar.
  const [confirmando, setConfirmando] = useState(false);
  // Por diária: aplicar em todas ou só nas diárias marcadas.
  const [alcance, setAlcance] = useState('todas');
  const [marcadas, setMarcadas] = useState(() => new Set());
  const selecionadas = mode === 'diaria' && alcance === 'especificas' ? [...marcadas].sort((a, b) => a - b) : null;
  const alternar = (i) => setMarcadas((prev) => { const n = new Set(prev); if (n.has(i)) n.delete(i); else n.add(i); return n; });

  // Modos em reais usam máscara de moeda; a porcentagem permanece numérica.
  const numericValue = mode === 'porcentagem' ? (Number(value) || 0) : parseBRL(value);

  const result = useMemo(
    () => computeAdjustedTotal({ baseTotal, baseDiarias, mode, sign, value: numericValue, selecionadas }),
    [baseTotal, baseDiarias, mode, sign, numericValue, selecionadas?.join(',')], // eslint-disable-line react-hooks/exhaustive-deps
  );

  const diff = result.valorTotal - baseTotal;
  const canApply = value !== '' && numericValue >= 0 && (mode !== 'diaria' || baseDiarias.length > 0)
    && !(selecionadas && selecionadas.length === 0);
  // No "Por diária" o desconto/adicional não se aplica: os cards ficam à vista, bloqueados.
  const signBloqueado = mode === 'diaria';

  const fieldLabel =
    mode === 'porcentagem' ? tr('Porcentagem (%)') : mode === 'diaria' ? tr('Novo valor da diária (R$)') : tr('Valor (R$)');

  return (
    <Wrap
      open={open}
      onClose={onClose}
      title={title}
      size="sm"
      {...wrapProps}
      lateral={lateral ? lateral(result, { baseTotal, diff }) : undefined}
      footer={confirmando ? (
        <div className={styles.confirma}>
          <span>{tr('Aplicar o novo total de {{v}}?', { v: fmtBRL(result.valorTotal) })}</span>
          <span className={styles.confirmaBtns}>
            <Button variant="secondary" onClick={() => setConfirmando(false)}>{tr('Voltar')}</Button>
            <Button variant="primary" onClick={() => { onApply(result, { mode, sign, value: numericValue, selecionadas }); onClose(); }}>
              {tr('Confirmar')}
            </Button>
          </span>
        </div>
      ) : lateral ? (canApply ? (
        // botaoAplicar: a tela fornece o botão com a confirmação dela (balão do sistema).
        botaoAplicar
          ? botaoAplicar(() => { onApply(result, { mode, sign, value: numericValue, selecionadas }); onClose(); }, result, { mode, sign, value: numericValue, selecionadas })
          : <Button variant="primary" onClick={() => setConfirmando(true)}>{tr('Aplicar')}</Button>
      ) : null) : (
        <>
          <Button variant="secondary" onClick={onClose}>{tr('Cancelar')}</Button>
          <Button variant="primary" disabled={!canApply} onClick={() => setConfirmando(true)}>{tr('Aplicar')}</Button>
        </>
      )}
    >
      <div className={styles.stack}>
        {/* Sinal: desconto / adicional — bloqueado no modo diária */}
        <div className={[styles.alcanceSeg, signBloqueado ? styles.alcanceSegOff : ''].join(' ')} role="tablist">
          {[['desconto', tr('Desconto (−)')], ['adicional', tr('Adicional (+)')]].map(([k, rot]) => (
            <button key={k} type="button" role="tab" aria-selected={sign === k} disabled={signBloqueado}
              className={[styles.alcanceBtn, sign === k && !signBloqueado ? styles.alcanceBtnOn : ''].join(' ')}
              onClick={() => setSign(k)}>
              {rot}
            </button>
          ))}
        </div>

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

        {/* Por diária: em todas ou só nas escolhidas */}
        {mode === 'diaria' && baseDiarias.length > 1 && (
          <div className={styles.alcance}>
            <div className={styles.alcanceSeg} role="tablist">
              {[['todas', tr('Todas as diárias')], ['especificas', tr('Diárias específicas')]].map(([k, rot]) => (
                <button key={k} type="button" role="tab" aria-selected={alcance === k}
                  className={[styles.alcanceBtn, alcance === k ? styles.alcanceBtnOn : ''].join(' ')}
                  onClick={() => setAlcance(k)}>
                  {rot}
                </button>
              ))}
            </div>
            {alcance === 'especificas' && (
              <div className={styles.alcanceLista}>
                {baseDiarias.map((d, i) => (
                  <label key={i} className={styles.alcanceItem}>
                    <input type="checkbox" checked={marcadas.has(i)} onChange={() => alternar(i)} />
                    <span className={styles.alcanceTxt}>
                      {tr('Diária')} {String(i + 1).padStart(2, '0')}
                      {d.sazonalidade && <small>{tr('Sazonalidade aplicada: “{{v}}”', { v: d.sazonalidade })}</small>}
                    </span>
                    <span className={styles.alcanceValor}>{fmtBRL(d.valor)}</span>
                  </label>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Campo do modo ativo */}
        <FormField label={fieldLabel}>
          {mode === 'porcentagem' ? (
            <Input
              type="number"
              min="0"
              step="1"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder={tr('Ex.: 10')}
            />
          ) : (
            <Input
              type="text"
              inputMode="numeric"
              value={value}
              onChange={(e) => setValue(maskBRL(e.target.value))}
              placeholder={tr('R$ 0,00')}
            />
          )}
        </FormField>

        {/* Prévia por diária — desconto/adicional aplicado a cada diária (modo "Por diária") */}
        {mode === 'diaria' && numericValue > 0 && baseDiarias.length > 0 && (
          <div className={styles.preview}>
            {baseDiarias.map((d, i) => {
              const novo = result.diarias?.[i]?.valor ?? 0;
              const dd = novo - (d.valor || 0);
              if (selecionadas && !selecionadas.includes(i)) return null;
              return (
                <div key={i} className={styles.diariaRow}>
                  <span className={styles.diariaLabel}>{tr('Diária')} {i + 1}</span>
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

        {/* Prévia — mostra a diferença em relação ao valor original (no painel, vai para o resumo ao lado) */}
        {!lateral && <div className={styles.preview}>
          <div className={styles.previewRow}>
            <span>{mode === 'diaria' ? tr('Total atual (diárias)') : tr('Total atual')}</span>
            <span>{fmtBRL(baseTotal)}</span>
          </div>
          <div className={styles.previewRow}>
            <span>{tr('Diferença')}</span>
            <span className={diff < 0 ? styles.previewDown : diff > 0 ? styles.previewUp : ''}>
              {diff > 0 ? '+' : ''}{fmtBRL(diff)}
            </span>
          </div>
          <div className={[styles.previewRow, styles.previewTotal].join(' ')}>
            <span>{tr('Novo total')}</span><span>{fmtBRL(result.valorTotal)}</span>
          </div>
        </div>}
      </div>
    </Wrap>
  );
}
