import { AlertTriangle, CheckCircle, Loader2, Sparkles, XCircle } from 'lucide-react';
import { Modal }  from '../../../../components/ui/Modal';
import { Button } from '../../../../components/ui/Button';
import { Select, Input } from '../../../../components/ui/Input';
import { fmtBRL } from '../../shared/helpers';
import styles from '../../recepcao.module.css';
import { tr } from '../../../../i18n';

export default function AtribuirLimpezaModal({
  atribuirLimpezaModal, setAtribuirLimpezaModal,
  checkoutAntecipado, setCheckoutAntecipado,
  pendingPayWarning, setPendingPayWarning,
  confirmModal, setConfirmModal,
  cancelMotivo, setCancelMotivo,
  selectedRoom,
  limpezaFuncs, limpezaFuncsLoading,
  limpezaFuncId, setLimpezaFuncId,
  saving,
  handleDoFinalizar, _prosseguirFinalizar,
  openAtribuirLimpeza, handleCancelar,
}) {
  return (
    <>
      {/* ─ Checkout Antecipado ─ */}
      {checkoutAntecipado && selectedRoom && (
        <Modal
          open
          onClose={() => setCheckoutAntecipado(false)}
          size="sm"
          title={<><AlertTriangle size={15} /> {tr('Finalização Antecipada')}</>}
          footer={
            <div className={styles.footerRight}>
              <Button variant="secondary" onClick={() => setCheckoutAntecipado(false)}>{tr('Cancelar')}</Button>
              <Button variant="danger" onClick={() => { setCheckoutAntecipado(false); _prosseguirFinalizar(); }}>
                {tr('Finalizar mesmo assim')}
              </Button>
            </div>
          }
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <p style={{ fontSize: 14, color: 'var(--text)', lineHeight: 1.6 }}>
              {tr('O checkout previsto do')} <strong>{tr('Apt.')} {selectedRoom.numero}</strong> {tr('é')}{' '}
              <strong style={{ color: '#d97706' }}>{selectedRoom.servico?.saidaPrevista?.split(' ')[0] || '—'}</strong>{tr(', diferente de hoje.')}
            </p>
            <p style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.6 }}>
              {tr('Deseja finalizar o pernoite antes da data prevista?')}
            </p>
          </div>
        </Modal>
      )}

      {/* ─ Pagamento Pendente ao Finalizar ─ */}
      {pendingPayWarning && selectedRoom && (
        <Modal
          open
          onClose={() => setPendingPayWarning(false)}
          size="sm"
          title={<><AlertTriangle size={15} /> {tr('Pagamento Pendente')}</>}
          footer={
            <div className={styles.footerRight}>
              <Button variant="secondary" onClick={() => setPendingPayWarning(false)} disabled={saving}>{tr('Cancelar')}</Button>
              <Button variant="danger" onClick={() => { setPendingPayWarning(false); openAtribuirLimpeza('FINALIZADO_PAGAMENTO_PENDENTE'); }} disabled={saving}>
                {tr('Prosseguir mesmo assim')}
              </Button>
            </div>
          }
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <p style={{ fontSize: 14, color: 'var(--text)', lineHeight: 1.6 }}>
              {tr('Ainda há')} <strong style={{ color: '#d97706' }}>{fmtBRL(selectedRoom.servico?.pagamentoPendente)}</strong> {tr('de pagamento pendente no')} <strong>{tr('Apt.')} {selectedRoom.numero}</strong>.
            </p>
            <p style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.6 }}>
              {tr('Prosseguir com a finalização? O pernoite ficará com o status')} <strong>{tr('Finalizado com Pagamento Pendente')}</strong>.
            </p>
          </div>
        </Modal>
      )}

      {/* ─ Confirmar Cancelar Serviço ─ */}
      {confirmModal && selectedRoom && (() => {
        const isPernoite = selectedRoom.servico?.tipo === 'pernoite';
        return (
        <Modal
          open
          onClose={() => { setConfirmModal(null); setCancelMotivo?.(''); }}
          size="sm"
          title={<><XCircle size={15} /> {isPernoite ? tr('Cancelar Pernoite') : tr('Cancelar Serviço')}</>}
          footer={
            <div className={styles.footerRight}>
              <Button variant="secondary" onClick={() => { setConfirmModal(null); setCancelMotivo?.(''); }}>{tr('Voltar')}</Button>
              <Button variant="danger" onClick={handleCancelar} disabled={saving || (isPernoite && !(cancelMotivo || '').trim())}>
                {saving && <Loader2 size={14} className={styles.spin} />}
                {isPernoite ? tr('Cancelar Pernoite') : tr('Cancelar Serviço')}
              </Button>
            </div>
          }
        >
          <p style={{ fontSize: 14, color: 'var(--text)', lineHeight: 1.6, marginBottom: isPernoite ? 14 : 0 }}>
            {tr('Confirma o cancelamento do')} {isPernoite ? tr('pernoite') : tr('serviço')} {tr('no')} <strong>{tr('Apt.')} {selectedRoom.numero}</strong>{tr('? O quarto ficará disponível.')}
          </p>
          {isPernoite && (
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-2)', display: 'block', marginBottom: 6 }}>{tr('Motivo do cancelamento *')}</label>
              <Input value={cancelMotivo || ''} onChange={(e) => setCancelMotivo?.(e.target.value)} placeholder={tr('Ex.: Desistência do hóspede')} autoFocus />
            </div>
          )}
        </Modal>
        );
      })()}

      {/* ─ Atribuir Limpeza ao Finalizar ─ */}
      {atribuirLimpezaModal && selectedRoom && (
        <Modal
          open
          onClose={() => setAtribuirLimpezaModal(null)}
          size="sm"
          title={<><Sparkles size={15} /> {tr('Atribuir Limpeza')}</>}
          footer={
            <div className={styles.footerBetween}>
              <Button variant="secondary" onClick={() => handleDoFinalizar(null)} disabled={saving}>
                {saving && <Loader2 size={14} className={styles.spin} />}
                {tr('Pular')}
              </Button>
              <Button variant="primary" onClick={() => handleDoFinalizar(limpezaFuncId || null)} disabled={saving || limpezaFuncsLoading || !limpezaFuncId}>
                {saving && <Loader2 size={14} className={styles.spin} />}
                <CheckCircle size={14} /> {tr('Atribuir e Finalizar')}
              </Button>
            </div>
          }
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <p style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.5 }}>
              {tr('Selecione o funcionário responsável pela limpeza do')} <strong style={{ color: 'var(--text)' }}>{tr('Apt.')} {selectedRoom.numero}</strong>.
            </p>
            {limpezaFuncsLoading ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--text-2)' }}>
                <Loader2 size={14} className={styles.spin} /> {tr('Carregando funcionários...')}
              </div>
            ) : (
              <Select
                label={tr('Funcionário')}
                value={limpezaFuncId}
                onChange={(e) => setLimpezaFuncId(e.target.value)}
              >
                <option value="">{tr('Selecione...')}</option>
                {limpezaFuncs.map((f) => (
                  <option key={f.id} value={f.id}>{f.pessoa?.nome ?? f.nome ?? f.id}</option>
                ))}
              </Select>
            )}
          </div>
        </Modal>
      )}
    </>
  );
}
