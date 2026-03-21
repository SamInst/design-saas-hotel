import { useState, useEffect } from 'react';
import { Percent, DollarSign, FileUp, Tag, X, Loader2 } from 'lucide-react';
import { Modal }            from './Modal';
import { Button }           from './Button';
import { Input, Select, FormField } from './Input';
import styles from './PaymentModal.module.css';

// ── Money helpers (same pattern as InventoryManagement) ──────
const maskBRL = (v) => {
  const digits = String(v ?? '').replace(/\D/g, '');
  if (!digits) return '';
  const num = parseInt(digits, 10) / 100;
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(num);
};
const parseBRL = (v) => {
  const s = String(v ?? '').replace(/[R$\s.]/g, '').replace(',', '.');
  return parseFloat(s) || 0;
};
const fmtBRL = (v) =>
  Number(v ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

// ── DiscountModal ─────────────────────────────────────────────
function DiscountModal({ open, onClose, onConfirm, valorBase = 0 }) {
  const [tipo, setTipo]   = useState('porcentagem');
  const [pct,  setPct]    = useState('');
  const [fixo, setFixo]   = useState('');

  useEffect(() => { if (!open) { setPct(''); setFixo(''); setTipo('porcentagem'); } }, [open]);

  const valorFinal = (() => {
    if (tipo === 'porcentagem') {
      const p = parseFloat(pct) || 0;
      return Math.max(0, valorBase * (1 - p / 100));
    }
    const f = parseBRL(fixo);
    return Math.max(0, valorBase - f);
  })();

  const handleConfirm = () => {
    if (tipo === 'porcentagem' && !pct) return;
    if (tipo === 'fixo'        && !fixo) return;
    onConfirm({
      porcentagem: tipo === 'porcentagem' ? parseInt(pct, 10)  : undefined,
      valor:       tipo === 'fixo'        ? parseBRL(fixo)     : undefined,
    });
  };

  return (
    <Modal open={open} onClose={onClose} title="Aplicar Desconto"
      footer={
        <div style={{ display: 'flex', gap: 8 }}>
          <Button onClick={onClose} style={{ flex: 1 }}>Cancelar</Button>
          <Button variant="primary" onClick={handleConfirm} style={{ flex: 1 }}>Aplicar</Button>
        </div>
      }>
      <div className={styles.tipoRow}>
        <button
          className={[styles.tipoBtn, tipo === 'porcentagem' ? styles.tipoBtnActive : ''].join(' ')}
          onClick={() => setTipo('porcentagem')}>
          <Percent size={13} /> Porcentagem
        </button>
        <button
          className={[styles.tipoBtn, tipo === 'fixo' ? styles.tipoBtnActive : ''].join(' ')}
          onClick={() => setTipo('fixo')}>
          <DollarSign size={13} /> Valor Fixo
        </button>
      </div>

      {tipo === 'porcentagem' ? (
        <FormField label="Porcentagem (%)">
          <Input type="number" min="0" max="100" placeholder="Ex: 10"
            value={pct} onChange={e => setPct(e.target.value)} />
        </FormField>
      ) : (
        <FormField label="Valor do Desconto (R$)">
          <Input type="text" placeholder="R$ 0,00"
            value={fixo} onChange={e => setFixo(maskBRL(e.target.value))} />
        </FormField>
      )}

      <div className={styles.discountPreview}>
        <div className={styles.discountRow}>
          <span>Valor original</span>
          <b>{fmtBRL(valorBase)}</b>
        </div>
        <div className={styles.discountRow}>
          <span>Desconto</span>
          <b className={styles.discountMinus}>−{fmtBRL(valorBase - valorFinal)}</b>
        </div>
        <div className={styles.discountDivider} />
        <div className={styles.discountRow}>
          <span>Valor final</span>
          <b className={styles.discountFinal}>{fmtBRL(valorFinal)}</b>
        </div>
      </div>
    </Modal>
  );
}

// ── PaymentModal ──────────────────────────────────────────────
/**
 * Modal universal de pagamento.
 *
 * Props:
 *   open             {boolean}
 *   onClose          {() => void}
 *   onConfirm        {(payment) => void}  — recebe o objeto de pagamento montado
 *   tiposPagamento   {Array<{id, descricao}>}
 *   initialPayment   {object|null}  — pagamento existente (para edição)
 *   defaultValor     {number}       — valor pré-preenchido (do lançamento)
 *   isSubmitting     {boolean}
 */
export function PaymentModal({
  open, onClose, onConfirm,
  tiposPagamento = [],
  initialPayment = null,
  defaultValor   = 0,
  isSubmitting   = false,
}) {
  const [tipoPagId,   setTipoPagId]   = useState('');
  const [nomePagador, setNomePagador] = useState('');
  const [descricao,   setDescricao]   = useState('');
  const [valor,       setValor]       = useState('');
  const [arquivo,     setArquivo]     = useState(null);
  const [desconto,    setDesconto]    = useState(null);
  const [showDesc,    setShowDesc]    = useState(false);

  // Inicializa ao abrir
  useEffect(() => {
    if (!open) return;
    if (initialPayment) {
      setTipoPagId(String(initialPayment.tipo_pagamento?.id ?? ''));
      setNomePagador(initialPayment.nome_pagador ?? '');
      setDescricao(initialPayment.descricao ?? '');
      const v = initialPayment.valor ?? defaultValor;
      setValor(v ? maskBRL(String(Math.round(v * 100))) : '');
      setDesconto(initialPayment.desconto
        ? { porcentagem: initialPayment.desconto.porcentagem, valor: initialPayment.desconto.valor }
        : null);
    } else {
      setTipoPagId('');
      setNomePagador('');
      setDescricao('');
      setValor(defaultValor ? maskBRL(String(Math.round(defaultValor * 100))) : '');
      setDesconto(null);
    }
    setArquivo(null);
  }, [open]);

  const valorNum   = parseBRL(valor);
  const valorFinal = desconto
    ? desconto.porcentagem !== undefined
      ? Math.max(0, valorNum * (1 - desconto.porcentagem / 100))
      : Math.max(0, valorNum - (desconto.valor ?? 0))
    : valorNum;

  const handleConfirm = () => {
    if (!tipoPagId || !nomePagador || !valor) {
      return; // campos obrigatórios incompletos
    }
    const payment = {
      tipo_pagamento: { id: Number(tipoPagId) },
      nome_pagador:   nomePagador.trim(),
      descricao:      descricao.trim() || undefined,
      valor:          valorNum,
      ...(desconto ? { desconto } : {}),
      ...(initialPayment?.uuid ? { uuid: initialPayment.uuid } : {}),
    };
    if (arquivo) payment._arquivo = arquivo;
    onConfirm(payment);
  };

  return (
    <>
      <Modal open={open} onClose={onClose} title="Pagamento"
        footer={
          <div style={{ display: 'flex', gap: 8 }}>
            <Button onClick={onClose} style={{ flex: 1 }}>Cancelar</Button>
            <Button variant="primary" onClick={handleConfirm}
              disabled={isSubmitting || !tipoPagId || !nomePagador || !valor}
              style={{ flex: 1 }}>
              {isSubmitting ? <><Loader2 size={13} className={styles.spin} /> Salvando...</> : 'Confirmar'}
            </Button>
          </div>
        }>

        <FormField label="Tipo de Pagamento *">
          <Select value={tipoPagId} onChange={e => setTipoPagId(e.target.value)}>
            <option value="">Selecione...</option>
            {tiposPagamento.map(tp => (
              <option key={tp.id} value={tp.id}>{tp.descricao}</option>
            ))}
          </Select>
        </FormField>

        <FormField label="Nome do Pagador *">
          <Input placeholder="Nome completo"
            value={nomePagador} onChange={e => setNomePagador(e.target.value)} />
        </FormField>

        <FormField label="Descrição">
          <Input placeholder="Descrição do pagamento"
            value={descricao} onChange={e => setDescricao(e.target.value)} />
        </FormField>

        <FormField label="Valor *">
          <Input type="text" placeholder="R$ 0,00"
            value={valor} onChange={e => setValor(maskBRL(e.target.value))} />
        </FormField>

        {/* Desconto */}
        {desconto ? (
          <div className={styles.descontoApplied}>
            <Tag size={12} />
            <span>
              Desconto:&nbsp;
              {desconto.porcentagem !== undefined
                ? `${desconto.porcentagem}%`
                : fmtBRL(desconto.valor ?? 0)}
              &nbsp;→&nbsp;<b>{fmtBRL(valorFinal)}</b>
            </span>
            <button className={styles.removeDesconto} onClick={() => setDesconto(null)}>
              <X size={12} />
            </button>
          </div>
        ) : (
          <button className={styles.addDesconto} onClick={() => setShowDesc(true)}>
            <Tag size={12} /> Aplicar desconto
          </button>
        )}

        {/* Comprovante */}
        <FormField label="Comprovante (opcional)">
          <label className={styles.fileLabel}>
            <FileUp size={13} />
            <span>{arquivo ? arquivo.name : 'Selecionar arquivo...'}</span>
            <input type="file" style={{ display: 'none' }}
              accept="image/*,application/pdf"
              onChange={e => setArquivo(e.target.files?.[0] ?? null)} />
          </label>
        </FormField>
      </Modal>

      <DiscountModal
        open={showDesc}
        onClose={() => setShowDesc(false)}
        valorBase={valorNum}
        onConfirm={d => { setDesconto(d); setShowDesc(false); }}
      />
    </>
  );
}
