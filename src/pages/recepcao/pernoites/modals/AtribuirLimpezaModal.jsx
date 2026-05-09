import { AlertTriangle, CheckCircle, Loader2, Sparkles, XCircle } from 'lucide-react';
import { Modal }  from '../../../../components/ui/Modal';
import { Button } from '../../../../components/ui/Button';
import { Select } from '../../../../components/ui/Input';
import { fmtBRL } from '../../shared/helpers';
import styles from '../../recepcao.module.css';

export default function AtribuirLimpezaModal({
  atribuirLimpezaModal, setAtribuirLimpezaModal,
  checkoutAntecipado, setCheckoutAntecipado,
  pendingPayWarning, setPendingPayWarning,
  confirmModal, setConfirmModal,
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
          title={<><AlertTriangle size={15} /> Finalização Antecipada</>}
          footer={
            <div className={styles.footerRight}>
              <Button variant="secondary" onClick={() => setCheckoutAntecipado(false)}>Cancelar</Button>
              <Button variant="danger" onClick={() => { setCheckoutAntecipado(false); _prosseguirFinalizar(); }}>
                Finalizar mesmo assim
              </Button>
            </div>
          }
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <p style={{ fontSize: 14, color: 'var(--text)', lineHeight: 1.6 }}>
              O checkout previsto do <strong>Apt. {selectedRoom.numero}</strong> é{' '}
              <strong style={{ color: '#d97706' }}>{selectedRoom.servico?.saidaPrevista?.split(' ')[0] || '—'}</strong>,
              diferente de hoje.
            </p>
            <p style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.6 }}>
              Deseja finalizar o pernoite antes da data prevista?
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
          title={<><AlertTriangle size={15} /> Pagamento Pendente</>}
          footer={
            <div className={styles.footerRight}>
              <Button variant="secondary" onClick={() => setPendingPayWarning(false)} disabled={saving}>Cancelar</Button>
              <Button variant="danger" onClick={() => { setPendingPayWarning(false); openAtribuirLimpeza('FINALIZADO_PAGAMENTO_PENDENTE'); }} disabled={saving}>
                Prosseguir mesmo assim
              </Button>
            </div>
          }
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <p style={{ fontSize: 14, color: 'var(--text)', lineHeight: 1.6 }}>
              Ainda há <strong style={{ color: '#d97706' }}>{fmtBRL(selectedRoom.servico?.pagamentoPendente)}</strong> de pagamento pendente no <strong>Apt. {selectedRoom.numero}</strong>.
            </p>
            <p style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.6 }}>
              Prosseguir com a finalização? O pernoite ficará com o status <strong>Finalizado com Pagamento Pendente</strong>.
            </p>
          </div>
        </Modal>
      )}

      {/* ─ Confirmar Cancelar Serviço ─ */}
      {confirmModal && selectedRoom && (
        <Modal
          open
          onClose={() => setConfirmModal(null)}
          size="sm"
          title={<><XCircle size={15} /> Cancelar Serviço</>}
          footer={
            <div className={styles.footerRight}>
              <Button variant="secondary" onClick={() => setConfirmModal(null)}>Voltar</Button>
              <Button variant="danger" onClick={handleCancelar} disabled={saving}>
                {saving && <Loader2 size={14} className={styles.spin} />}
                Cancelar Serviço
              </Button>
            </div>
          }
        >
          <p style={{ fontSize: 14, color: 'var(--text)', lineHeight: 1.6 }}>
            Confirma o cancelamento do serviço no <strong>Apt. {selectedRoom.numero}</strong>? O quarto ficará disponível.
          </p>
        </Modal>
      )}

      {/* ─ Atribuir Limpeza ao Finalizar ─ */}
      {atribuirLimpezaModal && selectedRoom && (
        <Modal
          open
          onClose={() => setAtribuirLimpezaModal(null)}
          size="sm"
          title={<><Sparkles size={15} /> Atribuir Limpeza</>}
          footer={
            <div className={styles.footerBetween}>
              <Button variant="secondary" onClick={() => handleDoFinalizar(null)} disabled={saving}>
                {saving && <Loader2 size={14} className={styles.spin} />}
                Pular
              </Button>
              <Button variant="primary" onClick={() => handleDoFinalizar(limpezaFuncId || null)} disabled={saving || limpezaFuncsLoading || !limpezaFuncId}>
                {saving && <Loader2 size={14} className={styles.spin} />}
                <CheckCircle size={14} /> Atribuir e Finalizar
              </Button>
            </div>
          }
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <p style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.5 }}>
              Selecione o funcionário responsável pela limpeza do <strong style={{ color: 'var(--text)' }}>Apt. {selectedRoom.numero}</strong>.
            </p>
            {limpezaFuncsLoading ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--text-2)' }}>
                <Loader2 size={14} className={styles.spin} /> Carregando funcionários...
              </div>
            ) : (
              <Select
                label="Funcionário"
                value={limpezaFuncId}
                onChange={(e) => setLimpezaFuncId(e.target.value)}
              >
                <option value="">Selecione...</option>
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
