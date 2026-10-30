import { useEffect, useState } from 'react';
import { Plus, Trash2, PlugZap } from 'lucide-react';
import stoneLogo from '../../assets/pagamento/stone-logo.png';
import { useTranslation } from 'react-i18next';
import { integracaoStoneApi } from '../../services/api';
import { Input, FormField } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import styles from './SettingsPage.module.css';

// Integração opcional com a maquininha Stone (Stone Connect 2.0). A Secret Key fica só no
// back-end: aqui ela é apenas enviada, nunca exibida.
export default function StoneIntegracao({ onNotify }) {
  const { t } = useTranslation();
  const [config,     setConfig]     = useState(null);
  const [ativo,      setAtivo]      = useState(false);
  const [partnerId,  setPartnerId]  = useState('');
  const [secretKey,  setSecretKey]  = useState('');
  const [salvando,   setSalvando]   = useState(false);
  const [testando,   setTestando]   = useState(false);
  const [teste,      setTeste]      = useState(null);
  const [novoNome,   setNovoNome]   = useState('');
  const [novaSerie,  setNovaSerie]  = useState('');
  const [removendo,  setRemovendo]  = useState(null);

  const aplicar = (c) => {
    setConfig(c);
    setAtivo(!!c.ativo);
    setPartnerId(c.partnerId ?? '');
    setSecretKey('');
  };

  useEffect(() => {
    integracaoStoneApi.buscar().then(aplicar).catch((e) => onNotify?.(e?.message ?? t('settings.stone.loadError'), 'error'));
  }, []);

  const salvar = async (proxAtivo = ativo) => {
    setSalvando(true);
    try {
      aplicar(await integracaoStoneApi.salvar({ ativo: proxAtivo, partnerId, secretKey }));
      setTeste(null);
      onNotify?.(t('settings.stone.saved'));
    } catch (e) {
      onNotify?.(e?.message ?? t('settings.stone.saveError'), 'error');
    } finally { setSalvando(false); }
  };

  const testar = async () => {
    setTestando(true);
    try { setTeste(await integracaoStoneApi.testar()); }
    catch (e) { setTeste({ ok: false, mensagem: e?.message ?? t('settings.stone.testError') }); }
    finally { setTestando(false); }
  };

  const adicionar = async () => {
    if (!novaSerie.trim()) return;
    try {
      const m = await integracaoStoneApi.adicionarMaquininha({ nome: novoNome, numeroSerie: novaSerie });
      setConfig((c) => ({ ...c, maquininhas: [...(c.maquininhas ?? []), m] }));
      setNovoNome(''); setNovaSerie('');
    } catch (e) {
      onNotify?.(e?.message ?? t('settings.stone.addError'), 'error');
    }
  };

  const remover = async (id) => {
    try {
      await integracaoStoneApi.removerMaquininha(id);
      setConfig((c) => ({ ...c, maquininhas: c.maquininhas.filter((m) => m.id !== id) }));
    } catch (e) {
      onNotify?.(e?.message ?? t('settings.stone.removeError'), 'error');
    } finally { setRemovendo(null); }
  };

  const maquininhas = config?.maquininhas ?? [];

  return (
    <section className={styles.card}>
      <div className={styles.cardHead}>
        <span className={styles.cardLogo}><img src={stoneLogo} alt="Stone" /></span>
        <div className={styles.cardHeadText}>
          <h3 className={styles.cardTitle}>{t('settings.stone.title')}</h3>
          <p className={styles.cardDesc}>{t('settings.stone.description')}</p>
        </div>
        <label className={styles.switch} title={ativo ? t('settings.stone.disable') : t('settings.stone.enable')}>
          <input type="checkbox" checked={ativo} disabled={!config || salvando}
            onChange={(e) => { setAtivo(e.target.checked); salvar(e.target.checked); }} />
          <span className={styles.switchTrack} />
        </label>
      </div>

      {config && (
        <>
          <div className={styles.formGrid}>
            <FormField label={t('settings.stone.partnerId')}>
              <Input value={partnerId} onChange={(e) => setPartnerId(e.target.value)} placeholder="ServiceRefererName" />
            </FormField>
            <FormField label={t('settings.stone.secretKey')}>
              <Input type="password" autoComplete="off" value={secretKey} onChange={(e) => setSecretKey(e.target.value)}
                placeholder={config.secretKeyConfigurada ? t('settings.stone.secretKeySaved', { fim: config.secretKeyFinal }) : 'sk_...'} />
            </FormField>
          </div>
          <div className={styles.actions}>
            {teste && <span className={teste.ok ? styles.testeOk : styles.testeErro}>{teste.mensagem}</span>}
            <Button onClick={testar} disabled={testando || !config.secretKeyConfigurada}>
              <PlugZap size={14} /> {testando ? t('settings.stone.testing') : t('settings.stone.test')}
            </Button>
            <Button variant="primary" onClick={() => salvar()} disabled={salvando}>
              {salvando ? t('settings.stone.saving') : t('settings.stone.save')}
            </Button>
          </div>

          <div className={styles.subsecao}>
            <h4 className={styles.subTitle}>{t('settings.stone.terminals')}</h4>
            {maquininhas.length === 0 ? (
              <p className={styles.cardDesc}>{t('settings.stone.noTerminals')}</p>
            ) : (
              <ul className={styles.lista}>
                {maquininhas.map((m) => (
                  <li key={m.id} className={styles.listaItem}>
                    <span className={styles.listaNome}>{m.nome}</span>
                    <span className={styles.listaMeta}>{m.numeroSerie}</span>
                    {removendo === m.id ? (
                      <span className={styles.listaAcoes}>
                        <Button onClick={() => setRemovendo(null)}>{t('settings.stone.cancel')}</Button>
                        <Button variant="danger" onClick={() => remover(m.id)}>{t('settings.stone.confirmRemove')}</Button>
                      </span>
                    ) : (
                      <button type="button" className={styles.iconBtn} onClick={() => setRemovendo(m.id)}
                        title={t('settings.stone.remove')} aria-label={t('settings.stone.remove')}>
                        <Trash2 size={15} />
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
            <div className={styles.formGridAdd}>
              <Input value={novoNome} onChange={(e) => setNovoNome(e.target.value)} placeholder={t('settings.stone.terminalName')} />
              <Input value={novaSerie} onChange={(e) => setNovaSerie(e.target.value)} placeholder={t('settings.stone.serialNumber')}
                onKeyDown={(e) => { if (e.key === 'Enter') adicionar(); }} />
              <Button onClick={adicionar} disabled={!novaSerie.trim()}><Plus size={14} /> {t('settings.stone.add')}</Button>
            </div>
          </div>
        </>
      )}
    </section>
  );
}
