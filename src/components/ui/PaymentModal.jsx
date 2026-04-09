import { useState, useEffect } from 'react';
import { Percent, DollarSign, FileUp, Tag, X, Loader2, Eye, Trash2 } from 'lucide-react';
import { arquivoApi } from '../../services/api';
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
    if (tipo === 'porcentagem') {
      const p = parseFloat(pct) || 0;
      if (!pct || p <= 0 || p > 100) return;
    }
    if (tipo === 'fixo') {
      if (!fixo || parseBRL(fixo) <= 0) return;
    }
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
          <Input type="number" min="1" max="100" placeholder="Ex: 10"
            value={pct} onChange={e => setPct(e.target.value.replace(/[^0-9]/g, ''))} />
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
  tipoRegistro       = '',
  loggedUser         = null,
  titularNome        = null,
  canAplicarDesconto = true,
}) {
  const [tipoPagId,   setTipoPagId]   = useState('');
  const [nomePagador, setNomePagador] = useState('');
  const [descricao,   setDescricao]   = useState('');
  const [valor,       setValor]       = useState('');
  const [arquivo,       setArquivo]       = useState(null);   // novo arquivo
  const [arquivoAtual,  setArquivoAtual]  = useState(null);   // path do arquivo existente
  const [arquivoRemov,  setArquivoRemov]  = useState(false);  // usuario quer remover
  const [desconto,      setDesconto]      = useState(null);
  const [showDesc,      setShowDesc]      = useState(false);
  const [descontoOrigUuid, setDescontoOrigUuid] = useState(null);

  // Inicializa ao abrir
  useEffect(() => {
    if (!open) return;
    if (initialPayment) {
      setTipoPagId(String(initialPayment.tipo_pagamento?.id ?? ''));
      setNomePagador((initialPayment.nome_pagador ?? '').toUpperCase());
      setDescricao((initialPayment.descricao ?? '').toUpperCase());
      const v = initialPayment.valor ?? defaultValor;
      setValor(v ? maskBRL(String(Math.round(v * 100))) : '');
      const origUuid = initialPayment.desconto?.uuid ?? initialPayment.desconto?._uuid ?? null;
      setDescontoOrigUuid(origUuid);
      setDesconto(initialPayment.desconto
        ? { _uuid: origUuid, porcentagem: initialPayment.desconto.porcentagem, valor: initialPayment.desconto.valor }
        : null);
      setArquivoAtual(initialPayment.path_arquivo ?? null);
    } else {
      setTipoPagId('');
      setNomePagador('');
      setDescricao('');
      setValor(defaultValor ? maskBRL(String(Math.round(defaultValor * 100))) : '');
      setDesconto(null);
      setArquivoAtual(null);
    }
    setArquivo(null);
    setArquivoRemov(false);
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
    const descontoFinal = desconto
      ? { ...desconto, ...(descontoOrigUuid ? { _uuid: descontoOrigUuid } : {}) }
      : undefined;
    const payment = {
      tipo_pagamento: { id: Number(tipoPagId) },
      nome_pagador:   nomePagador.trim(),
      descricao:      descricao.trim() || undefined,
      valor:          valorNum,
      ...(descontoFinal ? { desconto: descontoFinal } : {}),
      ...(initialPayment?.uuid ? { uuid: initialPayment.uuid } : {}),
    };
    if (arquivo)      payment._arquivo       = arquivo;
    if (arquivoRemov) payment._arquivoRemov  = true;
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
            value={nomePagador} onChange={e => setNomePagador(e.target.value.toUpperCase())} />
          {titularNome && (
            <label className={styles.checkRow}>
              <input type="checkbox"
                checked={nomePagador === titularNome.toUpperCase()}
                onChange={e => setNomePagador(e.target.checked ? titularNome.toUpperCase() : '')} />
              <span>Nome do titular</span>
            </label>
          )}
          {loggedUser?.pessoa?.nome && (
            <label className={styles.checkRow}>
              <input type="checkbox"
                checked={nomePagador === loggedUser.pessoa.nome.toUpperCase()}
                onChange={e => setNomePagador(e.target.checked ? loggedUser.pessoa.nome.toUpperCase() : '')} />
              <span>Nome do funcionário</span>
            </label>
          )}
        </FormField>

        <FormField label="Descrição">
          <Input placeholder="Descrição do pagamento"
            value={descricao} onChange={e => setDescricao(e.target.value.toUpperCase())} />
        </FormField>

        <FormField label="Valor *">
          <Input type="text" placeholder="R$ 0,00"
            value={valor} onChange={e => setValor(maskBRL(e.target.value))}
            style={tipoRegistro === 'SAIDA'
              ? { borderColor: '#f43f5e', color: '#f43f5e' }
              : tipoRegistro === 'ENTRADA'
                ? { borderColor: '#10b981', color: '#10b981' }
                : undefined}
          />
        </FormField>

        {/* Desconto */}
        {tipoRegistro !== 'SAIDA' && canAplicarDesconto && (desconto ? (
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
        ))}

        {/* Comprovante */}
        <FormField label="Comprovante (opcional)">
          {/* arquivo existente (edição) */}
          {arquivoAtual && !arquivoRemov && !arquivo && (
            <div className={styles.arquivoAtual}>
              <span className={styles.arquivoNome}>
                {arquivoAtual.split(/[\\/]/).pop()}
              </span>
              <button className={styles.arquivoBtn} title="Ver"
                onClick={() => arquivoApi.abrir(arquivoAtual)}>
                <Eye size={13} />
              </button>
              <button className={styles.arquivoBtnRemove} title="Remover"
                onClick={() => setArquivoRemov(true)}>
                <Trash2 size={13} />
              </button>
            </div>
          )}

          {/* novo arquivo selecionado */}
          {arquivo && (
            <div className={styles.arquivoAtual}>
              <span className={styles.arquivoNome}>{arquivo.name}</span>
              <button className={styles.arquivoBtnRemove} title="Cancelar"
                onClick={() => { setArquivo(null); }}>
                <X size={13} />
              </button>
            </div>
          )}

          {/* input para selecionar novo arquivo */}
          {(!arquivoAtual || arquivoRemov || arquivo) && !arquivo && (
            <label className={styles.fileLabel}>
              <FileUp size={13} />
              <span>{arquivoRemov ? 'Selecionar novo arquivo...' : 'Selecionar arquivo...'}</span>
              <input type="file" style={{ display: 'none' }}
                accept="image/*,application/pdf"
                onChange={e => setArquivo(e.target.files?.[0] ?? null)} />
            </label>
          )}
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
