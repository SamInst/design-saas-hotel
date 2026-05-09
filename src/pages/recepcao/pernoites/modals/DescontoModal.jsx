import { Loader2, Tag } from 'lucide-react';
import { Modal }       from '../../../../components/ui/Modal';
import { Button }      from '../../../../components/ui/Button';
import { Input, FormField } from '../../../../components/ui/Input';
import { fmtBRL, maskBRL } from '../../shared/helpers';
import styles from '../../recepcao.module.css';

export default function DescontoModal({
  open, onClose, selectedRoom,
  descontoScope, setDescontoScope,
  descontoTipo, setDescontoTipo,
  descontoValor, setDescontoValor,
  descontoDescricao, setDescontoDescricao,
  descontoSaving, handleAplicarDesconto,
}) {
  if (!open || !selectedRoom) return null;

  return (
    <Modal
      open
      onClose={onClose}
      size="sm"
      title={<><Tag size={15} /> Aplicar Desconto — Apt. {selectedRoom.numero}</>}
      footer={
        <div className={styles.footerRight}>
          <Button variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button variant="primary" onClick={handleAplicarDesconto} disabled={descontoSaving}>
            {descontoSaving && <Loader2 size={14} className={styles.spin} />}
            Aplicar Desconto
          </Button>
        </div>
      }
    >
      <div className={styles.formStack}>
        {selectedRoom.servico?.tipo === 'pernoite' && (
          <FormField label="Escopo do desconto">
            <div className={styles.descontoScopeRow}>
              {[['global', 'Global (toda a hospedagem)'], ['diaria', 'Diária atual']].map(([v, label]) => (
                <button key={v} type="button"
                  className={[styles.descontoScopeBtn, descontoScope === v ? styles.descontoScopeBtnActive : ''].join(' ')}
                  onClick={() => setDescontoScope(v)}>{label}</button>
              ))}
            </div>
          </FormField>
        )}
        <FormField label="Tipo de desconto">
          <div className={styles.descontoTipoRow}>
            {[['percentual', 'Porcentagem (%)'], ['fixo', 'Valor Fixo (R$)']].map(([v, label]) => (
              <button key={v} type="button"
                className={[styles.descontoTipoBtn, descontoTipo === v ? styles.descontoTipoBtnActive : ''].join(' ')}
                onClick={() => setDescontoTipo(v)}>{label}</button>
            ))}
          </div>
        </FormField>
        <FormField label={descontoTipo === 'percentual' ? 'Percentual (%) *' : 'Valor (R$) *'}>
          <Input
            value={descontoValor}
            onChange={(e) => setDescontoValor(descontoTipo === 'percentual' ? e.target.value.replace(/[^\d.]/g, '') : maskBRL(e.target.value))}
            placeholder={descontoTipo === 'percentual' ? 'Ex: 10' : 'R$ 0,00'}
          />
        </FormField>
        <FormField label="Descrição *">
          <Input value={descontoDescricao} onChange={(e) => setDescontoDescricao(e.target.value)} placeholder="Ex: Fidelidade, Cortesia, Convenção..." />
        </FormField>
        {selectedRoom.servico?.desconto?.valor > 0 && (
          <div className={styles.pricingHint}>
            <span className={styles.pricingHintLabel}>Desconto atual:</span>
            <span className={styles.textAmber}>
              {selectedRoom.servico.desconto.tipo === 'percentual'
                ? `${selectedRoom.servico.desconto.valor}%`
                : fmtBRL(selectedRoom.servico.desconto.valor)}
              {' '}— {selectedRoom.servico.desconto.descricao}
            </span>
          </div>
        )}
      </div>
    </Modal>
  );
}
