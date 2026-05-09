import { BedDouble, ChevronDown, Clock, CreditCard, Loader2, Plus, Trash2, XCircle } from 'lucide-react';
import { Modal }                    from '../../../../components/ui/Modal';
import { Button }                   from '../../../../components/ui/Button';
import { Input, Select, FormField } from '../../../../components/ui/Input';
import { DatePicker }               from '../../../../components/ui/DatePicker';
import { TimeInput }                from '../../../../components/ui/TimeInput';
import NhHospedesPicker             from '../../shared/NhHospedesPicker';
import HospedeResults               from '../../shared/HospedeResults';
import { DAY_USE_PRICING }          from '../../shared/overviewApi';
import { fmtBRL, maskBRL, parseBRL, todayDisplay } from '../../shared/helpers';
import styles from '../../recepcao.module.css';

export default function NovoServicoModal({
  novoModal, setNovoModal, novoRoom,
  // Pernoite
  nhHospedes, setNhHospedes,
  nhCheckinDate, setNhCheckinDate,
  nhCheckoutDate, setNhCheckoutDate,
  nhCalcLoading, nhCalc,
  nhShowPriceDetail, setNhShowPriceDetail,
  nhTotalHosp, nhTotalPago, nhPendente,
  nhPagamentos, setNhPagamentos,
  nhPagTipoId, setNhPagTipoId,
  nhPagNomePagador, setNhPagNomePagador,
  nhPagDescricao, setNhPagDescricao,
  nhPagValor, setNhPagValor,
  nhShowPagForm, setNhShowPagForm,
  savingNh, handleCriarPernoite,
  // Day Use
  saving, handleCriarDayUse,
  nduForm, setNduForm,
  nduHosp, addNduHospede, remNduHospede,
  // Shared
  tiposPagamentoOv,
}) {
  return (
    <>
      {/* ─ Nova Hospedagem (Pernoite) ─ */}
      {novoModal === 'pernoite' && novoRoom && (
        <Modal
          open
          onClose={() => setNovoModal(null)}
          size="lg"
          title={<><BedDouble size={15} /> Nova Hospedagem — Apt. {novoRoom.numero} <span style={{ fontWeight: 400, fontSize: 12, color: 'var(--text-2)', marginLeft: 6 }}>{novoRoom.categoria} · {novoRoom.tipoOcupacao}</span></>}
          footer={
            <div className={styles.footerRight}>
              <Button variant="secondary" onClick={() => setNovoModal(null)}>Cancelar</Button>
              <Button variant="primary" onClick={handleCriarPernoite} disabled={savingNh || !nhCheckinDate || !nhCheckoutDate}>
                {savingNh && <Loader2 size={14} className={styles.spin} />}
                Criar Hospedagem
              </Button>
            </div>
          }
        >
          <div className={styles.formStack}>

            <div className={styles.formStack} style={{ gap: 8 }}>
              <div className={styles.nhDividerBlue}>Hóspedes</div>
              <NhHospedesPicker value={nhHospedes} onChange={setNhHospedes} />
            </div>

            <div className={styles.formStack} style={{ gap: 8 }}>
              <div className={styles.nhDividerBlue}>Período</div>
              <DatePicker
                mode="range"
                startDate={nhCheckinDate}
                endDate={nhCheckoutDate}
                onRangeChange={({ start, end }) => { setNhCheckinDate(start); setNhCheckoutDate(end); }}
              />
              {nhCheckinDate && nhCheckoutDate && (
                <div className={styles.nhPriceCard}>
                  <button
                    className={styles.nhPriceCardHeader}
                    onClick={() => !nhCalcLoading && setNhShowPriceDetail((v) => !v)}
                  >
                    <span className={styles.nhFinStrip}>
                      <span className={styles.nhFinStripItem}>
                        Valor Total{' '}
                        {nhCalcLoading
                          ? <b><Loader2 size={11} className={styles.spin} /></b>
                          : <b>{fmtBRL(nhTotalHosp)}</b>
                        }
                      </span>
                      <span className={styles.nhFinStripDivider} />
                      <span className={styles.nhFinStripItem}>
                        Pago <b style={{ color: 'var(--emerald)' }}>{fmtBRL(nhTotalPago)}</b>
                      </span>
                      <span className={styles.nhFinStripDivider} />
                      <span className={styles.nhFinStripItem}>
                        Pendente <b style={{ color: nhPendente > 0 ? '#f97316' : 'var(--emerald)' }}>{fmtBRL(nhPendente)}</b>
                      </span>
                    </span>
                    {!nhCalcLoading && nhCalc?.detalhes?.length > 0 && (
                      <ChevronDown size={14} className={nhShowPriceDetail ? styles.nhChevronOpen : styles.nhChevron} />
                    )}
                  </button>

                  {nhShowPriceDetail && !nhCalcLoading && nhCalc?.detalhes?.length > 0 && (
                    <div className={styles.nhPriceCardBody}>
                      <div className={styles.nhPriceCardRoom}>
                        {nhCalc.detalhes.map((d, i) => (
                          <div key={i} className={styles.nhPriceDetailItem}>
                            <div className={styles.nhPriceRow}>
                              <span className={styles.nhPriceDesc}>{d.descricao}</span>
                              <span className={styles.nhPriceVal}>{fmtBRL(d.valor_final)}</span>
                            </div>
                            {(d.acrescimo_sazonalidade > 0 || d.valor_criancas > 0) && (
                              <div className={styles.nhPriceDetailSub}>
                                <span>{fmtBRL((d.valor_base ?? 0) + (d.acrescimo_sazonalidade ?? 0))}</span>
                                {d.sazonalidade?.descricao && <span className={styles.nhSazChip}>{d.sazonalidade.descricao}</span>}
                                {d.valor_criancas > 0 && <span>+ Crianças {fmtBRL(d.valor_criancas)}</span>}
                              </div>
                            )}
                          </div>
                        ))}
                        <div className={styles.nhPriceTotalRow}>
                          <span>Total</span>
                          <span>{fmtBRL(nhCalc.valor_total)}</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className={styles.formStack} style={{ gap: 8 }}>
              <div className={styles.nhDividerOrange}>Pagamentos</div>

              {nhPagamentos.map((p, i) => (
                <div key={i} className={styles.nhPagItem}>
                  <CreditCard size={13} />
                  <div className={styles.nhPagItemInfo}>
                    <span className={styles.nhPagItemNome}>{p.nomePagador || '—'}</span>
                    <span className={styles.nhPagItemSub}>
                      {tiposPagamentoOv.find((t) => t.id === p.tipoPagamentoId)?.descricao ?? ''}
                      {p.descricao ? ` · ${p.descricao}` : ''}
                    </span>
                  </div>
                  <span className={styles.nhPagItemValor}>{fmtBRL(p.valor)}</span>
                  <button className={styles.removeBtn} onClick={() => setNhPagamentos((prev) => prev.filter((_, j) => j !== i))}>
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}

              {nhShowPagForm ? (
                <div className={styles.nhPagForm}>
                  <FormField label="Tipo de Pagamento">
                    <Select value={nhPagTipoId} onChange={(e) => setNhPagTipoId(e.target.value)}>
                      <option value="">Selecione...</option>
                      {tiposPagamentoOv.map((t) => <option key={t.id} value={t.id}>{t.descricao}</option>)}
                    </Select>
                  </FormField>
                  <FormField label="Nome do Pagador">
                    <Input placeholder="Nome completo"
                      value={nhPagNomePagador} onChange={(e) => setNhPagNomePagador(e.target.value.toUpperCase())} />
                    {nhHospedes[0]?.nome && (
                      <label className={styles.checkRow}>
                        <input type="checkbox"
                          checked={nhPagNomePagador === nhHospedes[0].nome.toUpperCase()}
                          onChange={(e) => setNhPagNomePagador(e.target.checked ? nhHospedes[0].nome.toUpperCase() : '')} />
                        <span>Nome do titular</span>
                      </label>
                    )}
                  </FormField>
                  <FormField label="Descrição">
                    <Input placeholder="Descrição do pagamento"
                      value={nhPagDescricao} onChange={(e) => setNhPagDescricao(e.target.value.toUpperCase())} />
                  </FormField>
                  <div className={styles.nhPagValorRow}>
                    <FormField label="Valor" style={{ flex: 1 }}>
                      <Input value={nhPagValor} onChange={(e) => setNhPagValor(maskBRL(e.target.value))} placeholder="R$ 0,00" />
                    </FormField>
                    <div className={styles.nhPagAddWrap}>
                      <Button variant="secondary" onClick={() => {
                        const v = parseBRL(nhPagValor);
                        if (!v || !nhPagTipoId || !nhPagNomePagador.trim()) return;
                        setNhPagamentos((prev) => [...prev, {
                          tipoPagamentoId: Number(nhPagTipoId),
                          nomePagador: nhPagNomePagador.trim(),
                          descricao: nhPagDescricao.trim(),
                          valor: v,
                        }]);
                        setNhPagTipoId(''); setNhPagNomePagador(''); setNhPagDescricao(''); setNhPagValor('');
                        setNhShowPagForm(false);
                      }}>Adicionar</Button>
                    </div>
                  </div>
                  <button className={styles.nhAddPagBtn} style={{ alignSelf: 'flex-start', borderColor: 'var(--border)', background: 'none', color: 'var(--text-2)' }}
                    onClick={() => { setNhShowPagForm(false); setNhPagTipoId(''); setNhPagNomePagador(''); setNhPagDescricao(''); setNhPagValor(''); }}>
                    Cancelar
                  </button>
                </div>
              ) : (
                <button className={styles.nhAddPagBtn} onClick={() => setNhShowPagForm(true)}>
                  <Plus size={11} /> Adicionar pagamento
                </button>
              )}
            </div>

          </div>
        </Modal>
      )}

      {/* ─ Novo Day Use ─ */}
      {novoModal === 'dayuse' && novoRoom && (
        <Modal
          open
          onClose={() => setNovoModal(null)}
          size="sm"
          title={<><Clock size={15} /> Novo Day Use — Apt. {novoRoom.numero}</>}
          footer={
            <div className={styles.footerRight}>
              <Button variant="secondary" onClick={() => setNovoModal(null)}>Cancelar</Button>
              <Button variant="primary" onClick={handleCriarDayUse} disabled={saving || !nduForm.horaEntrada}>
                {saving && <Loader2 size={14} className={styles.spin} />}
                Iniciar Day Use
              </Button>
            </div>
          }
        >
          <div className={styles.formStack}>
            {(() => { const p = DAY_USE_PRICING[novoRoom.categoria]; return (
              <div className={styles.pricingHint}>
                <span className={styles.pricingHintLabel}>{novoRoom.categoria}</span>
                <span><strong>{fmtBRL(p?.precoBase)}</strong> base ({p?.horasBase}h)</span>
                <span>+ {fmtBRL(p?.precoAdicional)}/h adicional</span>
              </div>
            ); })()}

            <FormField label="Data de uso">
              <Input value={todayDisplay()} disabled />
            </FormField>
            <FormField label="Hora de entrada *">
              <TimeInput value={nduForm.horaEntrada} onChange={(v) => setNduForm((f) => ({ ...f, horaEntrada: v }))} />
            </FormField>

            <FormField label="Hóspede (opcional)">
              <Input value={nduForm.hospedeSearch} onChange={(e) => setNduForm((f) => ({ ...f, hospedeSearch: e.target.value }))} placeholder="Buscar hóspede cadastrado..." />
              <HospedeResults results={nduHosp} onAdd={addNduHospede} />
              {nduForm.hospedes.length > 0 && (
                <div className={styles.hospedeChips}>
                  {nduForm.hospedes.map((h, i) => (
                    <span key={h.id} className={[styles.hospedeChip, i === 0 ? styles.hospedeChipTitular : ''].join(' ')}>
                      {h.nome}
                      <button className={styles.chipRemove} onClick={() => remNduHospede(h.id)}><XCircle size={12} /></button>
                    </span>
                  ))}
                </div>
              )}
            </FormField>
          </div>
        </Modal>
      )}
    </>
  );
}
