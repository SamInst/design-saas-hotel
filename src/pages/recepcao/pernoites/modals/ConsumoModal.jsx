import { CreditCard, Loader2, Plus, ShoppingCart, Trash2 } from 'lucide-react';
import { Modal }         from '../../../../components/ui/Modal';
import { Button }        from '../../../../components/ui/Button';
import { Select, FormField } from '../../../../components/ui/Input';
import { PaymentModal }  from '../../../../components/ui/PaymentModal';
import { fmtBRL }        from '../../shared/helpers';
import styles from '../../recepcao.module.css';

export default function ConsumoModal({
  showAddConsumoModal, setShowAddConsumoModal,
  showConsumoExternoModal, setShowConsumoExternoModal,
  showConsumoPag, setShowConsumoPag,
  selectedRoom,
  consumoCart, setConsumoCart,
  consumoCartPag, setConsumoCartPag,
  consumoSaving,
  consumoCats, consumoCatsLoading,
  detailConsumoCat, setDetailConsumoCat,
  detailConsumoCatSel,
  externoCart, setExternoCart,
  tiposPagamentoOv,
  updateInternQty, updateExternoQty,
  removeFromCart, removeFromExternoCart,
  handleConfirmConsumoAll, handleConfirmExterno,
}) {
  const cartTotal = consumoCart.reduce((s, c) => s + c.preco * c.qtd, 0);

  return (
    <>
      {/* ─ Consumo Unificado (interno + externo) ─ */}
      {showAddConsumoModal && selectedRoom && (
        <Modal
          open
          onClose={() => { setShowAddConsumoModal(false); setConsumoCart([]); setConsumoCartPag(null); }}
          size="md"
          title={<><ShoppingCart size={15} /> Adicionar Consumo</>}
          footer={
            <div className={styles.footerRight}>
              <Button variant="secondary" onClick={() => { setShowAddConsumoModal(false); setConsumoCart([]); setConsumoCartPag(null); }}>Fechar</Button>
              <Button
                variant="primary"
                disabled={consumoSaving || consumoCart.length === 0}
                onClick={() => handleConfirmConsumoAll(consumoCartPag)}
              >
                {consumoSaving && <Loader2 size={13} className={styles.spin} />}
                <Plus size={13} /> Adicionar Consumo{cartTotal > 0 ? ` · ${fmtBRL(cartTotal)}` : ''}
              </Button>
            </div>
          }
        >
          <div className={styles.consumoModalBody}>
            {selectedRoom.servico?.tipo === 'pernoite' && (() => {
              const _sv = selectedRoom.servico;
              const _d  = (_sv.diarias || [])[(_sv.diariaAtual || 1) - 1];
              return _d ? (
                <div className={styles.diariaInfoStrip}>
                  <span className={styles.diariaInfoLabel}>Diária {_sv.diariaAtual}</span>
                  {_d.dataInicio && <span className={styles.diariaInfoDates}>{_d.dataInicio} → {_d.dataFim}</span>}
                  <span className={styles.diariaAtualChip}>Atual</span>
                </div>
              ) : null;
            })()}

            <div className={styles.consumoModalSection}>
              <div className={styles.consumoModalSectionTitle}><ShoppingCart size={13} /> Itens do quarto</div>
              <div className={styles.consumoItemList}>
                {(selectedRoom.minibar ?? []).map((m) => {
                  const item     = { id: m.produtoId, quartoItemId: m.quartoItemId, nome: m.nome, categoria: m.categoria || 'Minibar', preco: m.preco ?? 0, qtdAtual: m.qtdAtual ?? 0, qtdBase: m.qtdBase ?? 0 };
                  const esgotado = item.qtdAtual === 0;
                  const ratio    = item.qtdBase > 0 ? item.qtdAtual / item.qtdBase : 1;
                  const isLow    = ratio < 0.5;
                  const inCart   = consumoCart.find((c) => c.tipo === 'interno' && c.itemId === item.id);
                  const cartQty  = inCart?.qtd ?? 0;
                  return (
                    <div key={item.id} className={styles.consumoItemRow}>
                      <div className={styles.consumoItemInfo}>
                        <span className={styles.consumoItemNome}>{item.nome}</span>
                        <span className={styles.consumoItemMeta}>
                          {item.categoria}{item.preco > 0 ? ` · ${fmtBRL(item.preco)}/un.` : ''}
                        </span>
                      </div>
                      <div className={[styles.cartQtdStepper, esgotado ? styles.cartQtdStepperDisabled : ''].join(' ')}>
                        <button disabled={cartQty === 0} onClick={() => updateInternQty(item, cartQty - 1)}>−</button>
                        <span className={[styles.cartStepperFrac, isLow && cartQty > 0 ? styles.cartStepperFracLow : ''].join(' ')}>
                          {cartQty}/{item.qtdAtual}
                        </span>
                        <button disabled={esgotado || cartQty >= item.qtdAtual} onClick={() => updateInternQty(item, cartQty + 1)}>+</button>
                      </div>
                      <span className={cartQty > 0 ? styles.cartRowTotal : styles.cartRowTotalEmpty}>
                        {cartQty > 0 ? fmtBRL(item.preco * cartQty) : '—'}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className={styles.consumoModalDivider} />

            <div className={styles.consumoModalSection}>
              <div className={styles.consumoModalSectionTitle}><ShoppingCart size={13} /> Consumo externo (dispensa)</div>
              <button className={styles.consumoExtOpenBtn} onClick={() => setShowConsumoExternoModal(true)}>
                <Plus size={13} /> Selecionar itens da dispensa
              </button>
            </div>

            {consumoCart.length > 0 && (
              <>
                <div className={styles.consumoModalDivider} />
                <div className={styles.consumoModalSection}>
                  <div className={styles.consumoModalSectionTitle}><ShoppingCart size={13} /> Itens selecionados</div>
                  <div className={styles.cartTable}>
                    {consumoCart.map((item) => (
                      <div key={item.key} className={styles.cartRow}>
                        <span className={styles.cartRowNome}>{item.nome}</span>
                        <span className={styles.cartRowQty}>{item.qtd}×</span>
                        <span className={styles.cartRowTotal}>{fmtBRL(item.preco * item.qtd)}</span>
                        <button className={styles.cartRowRemove} onClick={() => removeFromCart(item.key)}>
                          <Trash2 size={13} />
                        </button>
                      </div>
                    ))}
                    <div className={styles.cartTotalRow}>
                      <span>Total</span>
                      <span>{fmtBRL(cartTotal)}</span>
                    </div>
                  </div>

                  {consumoCartPag ? (
                    <div className={styles.pagamentoChipOv}>
                      <CreditCard size={13} />
                      <span>{tiposPagamentoOv.find((t) => t.id === Number(consumoCartPag.tipo_pagamento?.id))?.descricao ?? '—'} · {consumoCartPag.nome_pagador ?? '—'} · {fmtBRL(consumoCartPag.valor)}</span>
                      <button className={styles.pagamentoEditOv} onClick={() => setShowConsumoPag(true)}>Alterar</button>
                    </div>
                  ) : (
                    <button className={styles.definePagamentoOv} onClick={() => setShowConsumoPag(true)}>
                      <CreditCard size={13} /> Adicionar Pagamento (opcional)
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        </Modal>
      )}

      {/* ─ Consumo Externo (Dispensa) ─ */}
      {showConsumoExternoModal && (
        <Modal
          open
          onClose={() => { setShowConsumoExternoModal(false); setExternoCart([]); setDetailConsumoCat(''); }}
          size="md"
          title={<><ShoppingCart size={15} /> Consumo Externo (Dispensa)</>}
          footer={
            <div className={styles.footerRight}>
              <Button variant="secondary" onClick={() => { setShowConsumoExternoModal(false); setExternoCart([]); setDetailConsumoCat(''); }}>Cancelar</Button>
              <Button variant="primary" disabled={externoCart.length === 0} onClick={handleConfirmExterno}>
                <Plus size={13} /> Adicionar ao consumo
              </Button>
            </div>
          }
        >
          <div className={styles.formStack}>
            <FormField label="Categoria">
              <Select value={detailConsumoCat} onChange={(e) => setDetailConsumoCat(e.target.value)}>
                <option value="">Selecione uma categoria...</option>
                {consumoCatsLoading
                  ? <option disabled>Carregando...</option>
                  : consumoCats.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
              </Select>
            </FormField>
          </div>

          {detailConsumoCatSel && (
            <div className={styles.consumoItemList}>
              {(detailConsumoCatSel.itens ?? []).map((item) => {
                const qty   = externoCart.find((c) => c.catId === detailConsumoCat && c.itemId === item.id)?.qtd ?? 0;
                const preco = item.valor_venda ?? 0;
                return (
                  <div key={item.id} className={styles.consumoItemRow}>
                    <div className={styles.consumoItemInfo}>
                      <span className={styles.consumoItemNome}>{item.descricao}</span>
                      <span className={styles.consumoItemMeta}>{preco > 0 ? `${fmtBRL(preco)}/un.` : ''}</span>
                    </div>
                    <div className={styles.cartQtdStepper}>
                      <button disabled={qty === 0} onClick={() => updateExternoQty({ ...item, nome: item.descricao, preco }, qty - 1)}>−</button>
                      <span>{qty}</span>
                      <button onClick={() => updateExternoQty({ ...item, nome: item.descricao, preco }, qty + 1)}>+</button>
                    </div>
                    <span className={qty > 0 ? styles.cartRowTotal : styles.cartRowTotalEmpty}>
                      {qty > 0 ? fmtBRL(preco * qty) : '—'}
                    </span>
                  </div>
                );
              })}
            </div>
          )}

          {externoCart.length > 0 && (
            <>
              <div className={styles.consumoModalDivider} />
              <div className={styles.consumoModalSection}>
                <div className={styles.consumoModalSectionTitle}><ShoppingCart size={13} /> Selecionados</div>
                <div className={styles.cartTable}>
                  {externoCart.map((item) => (
                    <div key={item.key} className={styles.cartRow}>
                      <span className={styles.cartRowNome}>{item.nome}</span>
                      <span className={styles.cartRowQty}>{item.qtd}×</span>
                      <span className={styles.cartRowTotal}>{fmtBRL(item.preco * item.qtd)}</span>
                      <button className={styles.cartRowRemove} onClick={() => removeFromExternoCart(item.key)}>
                        <Trash2 size={13} />
                      </button>
                    </div>
                  ))}
                  <div className={styles.cartTotalRow}>
                    <span>Total</span>
                    <span>{fmtBRL(externoCart.reduce((s, c) => s + c.preco * c.qtd, 0))}</span>
                  </div>
                </div>
              </div>
            </>
          )}
        </Modal>
      )}

      {/* ─ Payment Modal para consumo ─ */}
      <PaymentModal
        open={showConsumoPag}
        onClose={() => setShowConsumoPag(false)}
        onConfirm={(pag) => { setConsumoCartPag(pag); setShowConsumoPag(false); }}
        tiposPagamento={tiposPagamentoOv}
        initialPayment={consumoCartPag ?? undefined}
        canAplicarDesconto={false}
        valorTotal={cartTotal}
      />
    </>
  );
}
