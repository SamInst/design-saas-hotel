import { useState, useEffect } from 'react';
import { Percent, DollarSign, FileUp, Tag, X, Loader2, Eye, Trash2 } from 'lucide-react';
import { arquivoApi } from '../../services/api';
import { Modal }            from './Modal';
import { Button }           from './Button';
import { Input, Select, FormField } from './Input';
import styles from './PaymentModal.module.css';
import { tr } from '../../i18n';

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
    <Modal open={open} onClose={onClose} title={tr('Aplicar Desconto')}
      footer={
        <div style={{ display: 'flex', gap: 8 }}>
          <Button onClick={onClose} style={{ flex: 1 }}>{tr('Cancelar')}</Button>
          <Button variant="primary" onClick={handleConfirm} style={{ flex: 1 }}>{tr('Aplicar')}</Button>
        </div>
      }>
      <div className={styles.tipoRow}>
        <button
          className={[styles.tipoBtn, tipo === 'porcentagem' ? styles.tipoBtnActive : ''].join(' ')}
          onClick={() => setTipo('porcentagem')}>
          <Percent size={13} /> {tr('Porcentagem')}
        </button>
        <button
          className={[styles.tipoBtn, tipo === 'fixo' ? styles.tipoBtnActive : ''].join(' ')}
          onClick={() => setTipo('fixo')}>
          <DollarSign size={13} /> {tr('Valor Fixo')}
        </button>
      </div>

      {tipo === 'porcentagem' ? (
        <FormField label={tr('Porcentagem (%)')}>
          <Input type="number" min="1" max="100" placeholder={tr('Ex: 10')}
            value={pct} onChange={e => setPct(e.target.value.replace(/[^0-9]/g, ''))} />
        </FormField>
      ) : (
        <FormField label={tr('Valor do Desconto (R$)')}>
          <Input type="text" placeholder={tr('R$ 0,00')}
            value={fixo} onChange={e => setFixo(maskBRL(e.target.value))} />
        </FormField>
      )}

      <div className={styles.discountPreview}>
        <div className={styles.discountRow}>
          <span>{tr('Valor original')}</span>
          <b>{fmtBRL(valorBase)}</b>
        </div>
        <div className={styles.discountRow}>
          <span>{tr('Desconto')}</span>
          <b className={styles.discountMinus}>−{fmtBRL(valorBase - valorFinal)}</b>
        </div>
        <div className={styles.discountDivider} />
        <div className={styles.discountRow}>
          <span>{tr('Valor final')}</span>
          <b className={styles.discountFinal}>{fmtBRL(valorFinal)}</b>
        </div>
      </div>
    </Modal>
  );
}

function InlineWrap({ open, children, footer }) {
  if (!open) return null;
  return (
    <div className={styles.inline}>
      <div className={styles.inlineBody}>{children}</div>
      <div className={styles.inlineFooter}>{footer}</div>
    </div>
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
  lastPayerName      = null,
  quartoNumero       = null,
  canAplicarDesconto = true,
  canDespesaPessoal  = false,
  quartos               = [],
  initialQuarto         = '',
  despesaInternaEnabled = false,
  initialDespesaInterna = false,
  valorTotal         = null,
  valorPago          = null,
  grupoTotal         = null,
  grupoPago          = null,
  containerStyle     = undefined,
  backdropStyle      = undefined,
  inline             = false,
  compacto           = false,
}) {
  const emGrupo = grupoTotal !== null && grupoPago !== null;
  const [tipoPagId,   setTipoPagId]   = useState('');
  const [nomePagador, setNomePagador] = useState('');
  const [descricao,   setDescricao]   = useState('');
  const [valor,       setValor]       = useState('');
  const [arquivo,       setArquivo]       = useState(null);
  const [arquivoAtual,  setArquivoAtual]  = useState(null);
  const [arquivoRemov,  setArquivoRemov]  = useState(false);
  const [desconto,      setDesconto]      = useState(null);
  const [showDesc,      setShowDesc]      = useState(false);
  const [descontoOrigUuid, setDescontoOrigUuid] = useState(null);
  const [despesaPessoal,   setDespesaPessoal]   = useState(false);
  const [quartoSel,        setQuartoSel]        = useState('');
  const [despesaInterna,   setDespesaInterna]   = useState(false);
  const [localSubmitting,  setLocalSubmitting]  = useState(false);
  const [limiteAtingido,   setLimiteAtingido]   = useState(false);

  // Inicializa ao abrir
  useEffect(() => {
    if (!open) { setLocalSubmitting(false); return; }
    setLimiteAtingido(false);
    setDespesaPessoal(false);
    setQuartoSel(initialQuarto ? String(initialQuarto) : '');
    setDespesaInterna(!!initialDespesaInterna);
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

  // ── Teto do pagamento ────────────────────────────────────────
  // Nunca lançar mais do que ainda falta pagar. Em grupo o teto é o pendente do
  // grupo (um pagador pode cobrir os outros pernoites); fora dele, o pendente do
  // próprio total. Editando um pagamento, o valor dele volta para o teto porque
  // já está somado em "pago". Sem total e pago informados (carrinho de consumo,
  // lançamento avulso) não há teto.
  const limite = emGrupo
    ? { total: grupoTotal, pago: grupoPago }
    : (valorTotal !== null && valorPago !== null ? { total: valorTotal, pago: valorPago } : null);
  const maxPagavel = limite
    ? Math.max(0, Math.round((limite.total - limite.pago + (initialPayment?.valor ?? 0)) * 100) / 100)
    : null;
  const excedeTeto = (v) => maxPagavel !== null && v > maxPagavel + 0.005;

  // Digitar acima do teto trava no teto em vez de engolir a tecla.
  const handleValorChange = (raw) => {
    const masked = maskBRL(raw);
    if (!excedeTeto(parseBRL(masked))) { setLimiteAtingido(false); setValor(masked); return; }
    setLimiteAtingido(true);
    setValor(maxPagavel > 0 ? maskBRL(String(Math.round(maxPagavel * 100))) : '');
  };

  // ── 50% quick-fill ───────────────────────────────────────────
  const metade = valorTotal != null && valorTotal > 0 ? Math.round(valorTotal * 0.5 * 100) / 100 : null;
  const is50   = metade != null && valorNum > 0 && Math.abs(valorNum - metade) < 0.005;
  const aplicar50 = (checked) => {
    if (checked && metade != null) {
      setValor(maskBRL(String(Math.round(metade * 100))));
      setDescricao(`PAGO 50%`);
      if (titularNome) setNomePagador(titularNome.toUpperCase());
    } else {
      setValor('');
      setDescricao('');
    }
  };

  // ── 100% quick-fill ──────────────────────────────────────────
  const total100 = valorTotal != null && valorTotal > 0 ? Math.round(valorTotal * 100) / 100 : null;
  const is100    = total100 != null && valorNum > 0 && Math.abs(valorNum - total100) < 0.005;
  const aplicar100 = (checked) => {
    if (checked && total100 != null) {
      setValor(maskBRL(String(Math.round(total100 * 100))));
      setDescricao(`PAGO 100%`);
      if (titularNome) setNomePagador(titularNome.toUpperCase());
    } else {
      setValor('');
      setDescricao('');
    }
  };

  const valorFinal = desconto
    ? desconto.porcentagem !== undefined
      ? Math.max(0, valorNum * (1 - desconto.porcentagem / 100))
      : Math.max(0, valorNum - (desconto.valor ?? 0))
    : valorNum;

  const canConfirm = despesaPessoal
    || (!!tipoPagId && !!nomePagador && !!valor && !excedeTeto(valorNum));

  const handleConfirm = () => {
    if (!canConfirm || localSubmitting || isSubmitting) return;
    setLocalSubmitting(true);
    if (despesaPessoal) {
      onConfirm({ despesa_pessoal: true, descricao: descricao.trim() || undefined });
      return;
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
    if (quartos.length && quartoSel) payment._quarto = Number(quartoSel);
    if (despesaInternaEnabled && despesaInterna) payment._despesaInterna = true;
    onConfirm(payment);
  };

  const footer = (
    <div style={{ display: 'flex', gap: 8 }}>
      <Button onClick={onClose} style={{ flex: 1 }}>{tr('Cancelar')}</Button>
      <Button variant="primary" onClick={handleConfirm}
        disabled={localSubmitting || isSubmitting || !canConfirm}
        style={{ flex: 1 }}>
        {(localSubmitting || isSubmitting) ? <><Loader2 size={13} className={styles.spin} /> {tr('Salvando...')}</> : tr('Confirmar')}
      </Button>
    </div>
  );

  const comprovante = (
    <FormField label={tr('Comprovante (opcional)')}>
      {/* arquivo existente (edição) */}
      {arquivoAtual && !arquivoRemov && !arquivo && (
        <div className={styles.arquivoAtual}>
          <span className={styles.arquivoNome}>
            {arquivoAtual.split(/[\\/]/).pop()}
          </span>
          <button className={styles.arquivoBtn} title={tr('Ver')}
            onClick={() => arquivoApi.abrir(arquivoAtual)}>
            <Eye size={13} />
          </button>
          <button className={styles.arquivoBtnRemove} title={tr('Remover')}
            onClick={() => setArquivoRemov(true)}>
            <Trash2 size={13} />
          </button>
        </div>
      )}

      {/* novo arquivo selecionado */}
      {arquivo && (
        <div className={styles.arquivoAtual}>
          <span className={styles.arquivoNome}>{arquivo.name}</span>
          <button className={styles.arquivoBtnRemove} title={tr('Cancelar')}
            onClick={() => { setArquivo(null); }}>
            <X size={13} />
          </button>
        </div>
      )}

      {/* input para selecionar novo arquivo */}
      {(!arquivoAtual || arquivoRemov || arquivo) && !arquivo && (
        <label className={styles.fileLabel}>
          <FileUp size={13} />
          <span>{arquivoRemov ? tr('Selecionar novo arquivo...') : tr('Selecionar arquivo...')}</span>
          <input type="file" style={{ display: 'none' }}
            accept="image/*,application/pdf"
            onChange={e => setArquivo(e.target.files?.[0] ?? null)} />
        </label>
      )}
    </FormField>
  );

  // Dentro de um painel (Financeiro): os mesmos campos agrupados em seções.
  if (inline) {
    if (!open) return null;
    const outros = [
      lastPayerName && lastPayerName.toUpperCase() !== titularNome?.toUpperCase() && [tr('Último pagador'), lastPayerName.toUpperCase()],
      titularNome && [tr('Titular'), titularNome.toUpperCase()],
      loggedUser?.pessoa?.nome && [tr('Funcionário'), loggedUser.pessoa.nome.toUpperCase()],
    ].filter(Boolean);
    return (
      <div className={[styles.inline, compacto ? styles.compacto : ''].join(' ')}>
        <section className={styles.secao}>
          <h4 className={styles.secaoTit}>{tr('Valor')}</h4>
          <div className={styles.secaoGrid}>
            <FormField label={tr('Valor *')}>
              <Input type="text" inputMode="numeric" placeholder={tr('R$ 0,00')} autoFocus
                className={[styles.valorGrande, tipoRegistro === 'SAIDA' ? styles.valorOut : styles.valorIn].join(' ')}
                value={valor} onChange={e => handleValorChange(e.target.value)} />
            </FormField>
            <FormField label={tr('Tipo de Pagamento *')}>
              <Select value={tipoPagId} onChange={e => setTipoPagId(e.target.value)}>
                <option value="">{tr('Selecione...')}</option>
                {tiposPagamento.map(tp => (
                  <option key={tp.id} value={tp.id}>{tp.descricao}</option>
                ))}
              </Select>
            </FormField>
          </div>
        </section>

        <section className={styles.secao}>
          {!compacto && <h4 className={styles.secaoTit}>{tipoRegistro === 'SAIDA' ? tr('Pago a') : tr('Pagador')}</h4>}
          {compacto && titularNome ? (
            <div className={styles.nomeLinha}>
              <FormField label={tr('Nome do Pagador *')}>
                <Input placeholder={tr('Nome completo')}
                  value={nomePagador} onChange={e => setNomePagador(e.target.value.toUpperCase())} />
              </FormField>
              <label className={styles.nomeTitular}>
                <input type="checkbox" checked={nomePagador === titularNome.toUpperCase()}
                  onChange={e => setNomePagador(e.target.checked ? titularNome.toUpperCase() : '')} />
                {tr('Titular')}
              </label>
            </div>
          ) : (
            <FormField label={tr('Nome do Pagador *')}>
              <Input placeholder={tr('Nome completo')}
                value={nomePagador} onChange={e => setNomePagador(e.target.value.toUpperCase())} />
            </FormField>
          )}
          {(compacto ? outros.filter(([rot]) => rot !== tr('Titular')) : outros).length > 0 && (
            <div className={styles.atalhos}>
              {(compacto ? outros.filter(([rot]) => rot !== tr('Titular')) : outros).map(([rot, nome]) => (
                <button key={rot} type="button"
                  className={[styles.atalho, nomePagador === nome ? styles.atalhoOn : ''].join(' ')}
                  onClick={() => setNomePagador(nomePagador === nome ? '' : nome)}>
                  {rot}
                </button>
              ))}
            </div>
          )}
        </section>

        <section className={styles.secao}>
          {!compacto && <h4 className={styles.secaoTit}>{tr('Detalhes')}</h4>}
          <div className={styles.secaoGrid}>
            <div className={styles.secaoLarga}>
              <FormField label={tr('Descrição')}>
                <Input placeholder={tr('Descrição do pagamento')}
                  value={descricao} onChange={e => setDescricao(e.target.value.toUpperCase())} />
              </FormField>
            </div>
            {quartos.length > 0 && (
              <FormField label={tr('Quarto')}>
                <Select value={quartoSel} onChange={e => setQuartoSel(e.target.value)}>
                  <option value="">{tr('Nenhum')}</option>
                  {quartos.map(q => (
                    <option key={q.id} value={q.id}>{tr('Quarto {{id}} - {{descricao}}', { id: q.id, descricao: q.descricao })}</option>
                  ))}
                </Select>
              </FormField>
            )}
            {despesaInternaEnabled && (
              <label className={[styles.checkRow, styles.checkAlinhado].join(' ')}>
                <input type="checkbox" checked={despesaInterna} onChange={e => setDespesaInterna(e.target.checked)} />
                <span>{tr('Despesa interna do Hotel')}</span>
              </label>
            )}
          </div>
        </section>

        <section className={styles.secao}>{comprovante}</section>

        <div className={styles.inlineFooter}>{footer}</div>
      </div>
    );
  }

  const Wrap = inline ? InlineWrap : Modal;

  return (
    <>
      <Wrap open={open} onClose={onClose} title={tr('Pagamento')}
        containerStyle={containerStyle}
        backdropStyle={backdropStyle}
        footer={footer}>

        {emGrupo && (
          <div className={styles.resumoList}>
            <div className={styles.resumoRow}>
              <span>{tr('Total · grupo')}</span><span>{fmtBRL(grupoTotal)}</span>
            </div>
            <div className={[styles.resumoRow, styles.resumoGreen].join(' ')}>
              <span>{tr('Pago · grupo')}</span><span>{fmtBRL(grupoPago)}</span>
            </div>
            <div className={[styles.resumoRow, grupoTotal - grupoPago > 0.005 ? styles.resumoDanger : styles.resumoGreen].join(' ')}>
              <span>{tr('Pendente · grupo')}</span><span>{fmtBRL(Math.max(0, grupoTotal - grupoPago))}</span>
            </div>
          </div>
        )}

        {valorTotal !== null && valorPago !== null && (
          <div className={[styles.resumoList, emGrupo ? styles.resumoListDivided : ''].join(' ')}>
            <div className={styles.resumoRow}>
              <span>{emGrupo ? tr('Total do pernoite') : tr('Total')}</span><span>{fmtBRL(valorTotal)}</span>
            </div>
            <div className={[styles.resumoRow, styles.resumoGreen].join(' ')}>
              <span>{tr('Pago')}</span><span>{fmtBRL(valorPago)}</span>
            </div>
            <div className={[styles.resumoRow, valorTotal - valorPago > 0.005 ? styles.resumoDanger : styles.resumoGreen].join(' ')}>
              <span>{tr('Pendente')}</span><span>{fmtBRL(Math.max(0, valorTotal - valorPago))}</span>
            </div>
          </div>
        )}

        {valorTotal !== null && valorPago === null && (
          <div className={styles.resumoList}>
            <div className={styles.resumoRow}>
              <span>{tr('Total dos itens')}</span><span>{fmtBRL(valorTotal)}</span>
            </div>
            <div className={[styles.resumoRow, valorNum > 0 ? styles.resumoGreen : styles.resumoDanger].join(' ')}>
              <span>{tr('A pagar')}</span><span>{valorNum > 0 ? fmtBRL(valorNum) : '—'}</span>
            </div>
          </div>
        )}

        {canDespesaPessoal && (
          <label className={styles.despesaPessoalRow}>
            <input type="checkbox" checked={despesaPessoal} onChange={e => setDespesaPessoal(e.target.checked)} />
            <span>{tr('Despesa pessoal')} <span className={styles.despesaPessoalHint}>{tr('(sem cobrança)')}</span></span>
          </label>
        )}

        {quartos.length > 0 && (
          <FormField label={tr('Quarto')}>
            <Select value={quartoSel} onChange={e => setQuartoSel(e.target.value)}>
              <option value="">{tr('Nenhum')}</option>
              {quartos.map(q => (
                <option key={q.id} value={q.id}>{tr('Quarto {{id}} - {{descricao}}', { id: q.id, descricao: q.descricao })}</option>
              ))}
            </Select>
          </FormField>
        )}

        {despesaInternaEnabled && (
          <label className={styles.checkRow}>
            <input type="checkbox" checked={despesaInterna} onChange={e => setDespesaInterna(e.target.checked)} />
            <span>{tr('Despesa interna do Hotel')}</span>
          </label>
        )}

        {!despesaPessoal && (
          <>
            <FormField label={tr('Nome do Pagador *')}>
              {(() => {
                const up = lastPayerName?.toUpperCase();
                const isDup = !up || up === titularNome?.toUpperCase() || up === loggedUser?.pessoa?.nome?.toUpperCase();
                return !isDup ? (
                  <label className={styles.checkRow}>
                    <input type="checkbox"
                      checked={nomePagador === up}
                      onChange={e => setNomePagador(e.target.checked ? up : '')} />
                    <span>{tr('Último pagador:')} <b>{lastPayerName}</b></span>
                  </label>
                ) : null;
              })()}
              <Input placeholder={tr('Nome completo')}
                value={nomePagador} onChange={e => setNomePagador(e.target.value.toUpperCase())} />
              {titularNome && (
                <label className={styles.checkRow}>
                  <input type="checkbox"
                    checked={nomePagador === titularNome.toUpperCase()}
                    onChange={e => setNomePagador(e.target.checked ? titularNome.toUpperCase() : '')} />
                  <span>{tr('Nome do titular')}</span>
                </label>
              )}
              {loggedUser?.pessoa?.nome && (
                <label className={styles.checkRow}>
                  <input type="checkbox"
                    checked={nomePagador === loggedUser.pessoa.nome.toUpperCase()}
                    onChange={e => setNomePagador(e.target.checked ? loggedUser.pessoa.nome.toUpperCase() : '')} />
                  <span>{tr('Nome do funcionário')}</span>
                </label>
              )}
            </FormField>

            {((metade != null && !excedeTeto(metade)) || (total100 != null && !excedeTeto(total100))) && (
              <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
                {metade != null && !excedeTeto(metade) && (
                  <label className={styles.checkRow}>
                    <input type="checkbox" checked={is50} onChange={e => aplicar50(e.target.checked)} />
                    <span>{tr('Pago 50%')} <b>({fmtBRL(metade)})</b></span>
                  </label>
                )}
                {total100 != null && !excedeTeto(total100) && (
                  <label className={styles.checkRow}>
                    <input type="checkbox" checked={is100} onChange={e => aplicar100(e.target.checked)} />
                    <span>{tr('Pago 100%')} <b>({fmtBRL(total100)})</b></span>
                  </label>
                )}
              </div>
            )}

            <div className={styles.rowGrid}>
              <FormField label={tr('Tipo de Pagamento *')}>
                <Select value={tipoPagId} onChange={e => setTipoPagId(e.target.value)}>
                  <option value="">{tr('Selecione...')}</option>
                  {tiposPagamento.map(tp => (
                    <option key={tp.id} value={tp.id}>{tp.descricao}</option>
                  ))}
                </Select>
              </FormField>

              <FormField label={<>{tr('Valor *')}{maxPagavel !== null && (
                <span className={styles.despesaPessoalHint}> {tr('· máx.')} {fmtBRL(maxPagavel)}</span>
              )}</>}>
                <Input type="text" placeholder={tr('R$ 0,00')}
                  value={valor} onChange={e => handleValorChange(e.target.value)}
                  style={tipoRegistro === 'SAIDA'
                    ? { borderColor: '#f43f5e', color: '#f43f5e' }
                    : tipoRegistro === 'ENTRADA'
                      ? { borderColor: '#10b981', color: '#10b981' }
                      : undefined}
                />
                {limiteAtingido && (
                  <div className={styles.limiteAviso}>
                    {maxPagavel > 0
                      ? tr('O valor não pode passar do pendente ({{v0}}).', { v0: fmtBRL(maxPagavel) })
                      : tr('Não há valor pendente para este pagamento.')}
                  </div>
                )}
              </FormField>
            </div>
          </>
        )}

        {!despesaPessoal && (
          <FormField label={tr('Descrição')}>
            <Input placeholder={tr('Descrição do pagamento')}
              value={descricao} onChange={e => setDescricao(e.target.value.toUpperCase())} />
          </FormField>
        )}

        {/* Desconto */}
        {!despesaPessoal && tipoRegistro !== 'SAIDA' && canAplicarDesconto && (desconto ? (
          <div className={styles.descontoApplied}>
            <Tag size={12} />
            <span>
              {tr('Desconto:')}&nbsp;
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
            <Tag size={12} /> {tr('Aplicar desconto')}
          </button>
        ))}

        {/* Comprovante */}
        {!despesaPessoal && comprovante}
      </Wrap>

      <DiscountModal
        open={showDesc}
        onClose={() => setShowDesc(false)}
        valorBase={valorNum}
        onConfirm={d => { setDesconto(d); setShowDesc(false); }}
      />
    </>
  );
}
