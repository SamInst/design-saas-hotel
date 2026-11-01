import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Search, Loader2, ShieldCheck, X, Trash2,
  ChevronLeft, ChevronRight,
} from 'lucide-react';

import { Button }                from '../../components/ui/Button';
import { Modal }                 from '../../components/ui/Modal';
import { Input, FormField }      from '../../components/ui/Input';
import { Notification }          from '../../components/ui/Notification';
import { cargoApi } from '../../services/api';

import styles from './RolePermissions.module.css';
import { tr } from '../../i18n';

const PAGE_SIZE = 10;
const up = v => (v ?? '').toUpperCase().trim();

// ── FINANCEIRO: cascade rules (checking A also checks B,C…) ──
const FINANCEIRO_CASCADES = {
  'APLICAR DESCONTO': ['EDITAR PAGAMENTO', 'EDITAR RELATORIO', 'NOVO RELATORIO'],
  'EDITAR RELATORIO': ['NOVO RELATORIO'],
  'EDITAR PAGAMENTO': ['NOVO RELATORIO'],
};
// permission auto-selected when FINANCEIRO tela is first enabled
const FINANCEIRO_AUTO = 'HISTORICO DO FLUXO DE CAIXA';
const isFinanceiro = tela => (tela?.nome ?? tela?.descricao ?? '').toUpperCase() === 'FINANCEIRO';

// ── Campo rótulo/valor do painel de detalhe ──────────────────
function Field({ label, value }) {
  const vazio = value == null || value === '';
  return (
    <div>
      <p className={styles.fLabel}>{label}</p>
      <p className={styles.fVal}>{vazio ? '—' : value}</p>
    </div>
  );
}

// ── Esqueletos de carregamento ───────────────────────────────
const sk = (...extra) => [styles.sk, ...extra].join(' ');

function SkeletonLista({ linhas = 7 }) {
  return (
    <div role="status" aria-label={tr('Carregando cargos')}>
      {Array.from({ length: linhas }, (_, i) => (
        <div key={i} className={styles.listItem} aria-hidden="true">
          <span className={styles.listItemBody}>
            <span className={sk(styles.skName)} style={{ width: `${52 + ((i * 13) % 26)}%` }} />
            <span className={sk(styles.skSub)} />
          </span>
        </div>
      ))}
    </div>
  );
}

// ── main component ───────────────────────────────────────────
export default function RolePermissions() {

  // ── list ──────────────────────────────────────────────────
  const [cargos, setCargos]               = useState([]);
  const [loading, setLoading]             = useState(false);
  const [page, setPage]                   = useState(0);
  const [totalPages, setTotalPages]       = useState(0);
  const [totalElements, setTotalElements] = useState(0);
  const [search, setSearch]               = useState('');
  const [searchLoading, setSearchLoading] = useState(false);

  // ── system data ───────────────────────────────────────────
  const [systemTelas, setSystemTelas]           = useState([]);
  const [systemPerms, setSystemPerms]           = useState({});   // { telaId: [perm] }
  const [systemDataLoaded, setSystemDataLoaded] = useState(false);
  const [permDescMap, setPermDescMap]           = useState({});   // { permId: descricao }

  // ── ficha aberta no painel de detalhe / formulário no lugar dela ──
  const [formModal,     setFormModal]     = useState(false);
  const [selectedCargo, setSelectedCargo] = useState(null);
  const [isEditing,     setIsEditing]     = useState(false);
  const [abaFicha,      setAbaFicha]      = useState('telas');
  const [formTab,       setFormTab]       = useState('dados');

  // ── exclusão ──────────────────────────────────────────────
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting,     setDeleting]     = useState(false);

  const [isDesktop, setIsDesktop] = useState(() => window.matchMedia('(min-width: 1024px)').matches);
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)');
    const on = (e) => setIsDesktop(e.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);

  // ── form ──────────────────────────────────────────────────
  const [formDescricao,     setFormDescricao]     = useState('');
  const [formTelasIds,      setFormTelasIds]      = useState(new Set());
  const [formPermissoesIds, setFormPermissoesIds] = useState(new Set());
  const [formAcessoTotal,   setFormAcessoTotal]   = useState(new Set()); // telas com acesso total

  const [saving, setSaving] = useState(false);
  const [notification, setNotification] = useState(null);
  const searchTimer = useRef(null);

  // ── helpers ───────────────────────────────────────────────
  const notify = useCallback((message, type = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3500);
  }, []);

  // ── load cargos ───────────────────────────────────────────
  const loadCargos = useCallback(async (pageNum = 0, termo = '') => {
    setLoading(true);
    try {
      const params = { page: pageNum, size: PAGE_SIZE };
      if (termo) params.termo = termo;
      const data = await cargoApi.listar(params);
      const content = data?.content ?? [];
      setCargos(content);
      setTotalPages(data?.totalPages ?? 0);
      setTotalElements(data?.totalElements ?? 0);
      // extrai descrições de permissões conhecidas
      const map = {};
      content.forEach(c => (c.telas ?? []).forEach(t =>
        (t.permissoes ?? []).forEach(p => { if (p.descricao) map[p.id] = p.descricao; })
      ));
      if (Object.keys(map).length) setPermDescMap(prev => ({ ...prev, ...map }));
    } catch (err) {
      notify(err.message || tr('Erro ao carregar cargos'), 'error');
    } finally {
      setLoading(false);
      setSearchLoading(false);
    }
  }, [notify]);

  useEffect(() => { loadCargos(0, ''); }, [loadCargos]);

  // ── search ────────────────────────────────────────────────
  const handleSearch = (e) => {
    const val = e.target.value;
    setSearch(val);
    setPage(0);
    clearTimeout(searchTimer.current);
    if (val.length === 0 || val.length >= 3) {
      setSearchLoading(true);
      searchTimer.current = setTimeout(() => loadCargos(0, val), 400);
    }
  };

  const handlePageChange = (p) => { setPage(p); loadCargos(p, search); };

  // ── system telas / permissoes ─────────────────────────────
  const loadSystemData = useCallback(async () => {
    if (systemDataLoaded) return;
    try {
      const telas = await cargoApi.listarTelas();
      setSystemTelas(telas ?? []);
      // pré-popula systemPerms e permDescMap de uma vez
      const permsMap = {};
      const descMap  = {};
      (telas ?? []).forEach(t => {
        permsMap[t.id] = t.permissoes ?? [];
        (t.permissoes ?? []).forEach(p => { if (p.descricao) descMap[p.id] = p.descricao; });
      });
      setSystemPerms(prev => ({ ...prev, ...permsMap }));
      setPermDescMap(prev => ({ ...prev, ...descMap }));
      setSystemDataLoaded(true);
    } catch { /* silencioso */ }
  }, [systemDataLoaded]);

  // mantido por compatibilidade (toggleTela ainda chama, mas retorna imediatamente pois já carregado)
  const loadPermsForTela = useCallback((telaId) => {
    void telaId; // systemPerms já preenchido em loadSystemData
  }, []);

  // A ficha mostra "x de y" telas e permissões do sistema, então isso
  // carrega na montagem, não só ao abrir o formulário.
  useEffect(() => { loadSystemData(); }, [loadSystemData]);

  // ── painel de detalhe ─────────────────────────────────────
  const openDetail  = (cargo) => {
    setFormModal(false);
    setSelectedCargo(cargo);
    setAbaFicha('telas');
  };
  const closeDetail = () => setSelectedCargo(null);

  // Fecha o formulário: na edição volta para a ficha, no cadastro para a lista.
  const cancelForm = () => {
    setFormModal(false);
    if (!isEditing) setSelectedCargo(null);
  };

  // Ao abrir a tela no desktop, já mostra a ficha do primeiro cargo.
  const fichaInicial = useRef(false);
  useEffect(() => {
    if (fichaInicial.current || !isDesktop || !cargos.length) return;
    fichaInicial.current = true;
    if (selectedCargo || formModal) return;
    setSelectedCargo(cargos[0]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cargos, isDesktop]);

  // Depois de salvar, loadCargos recria os objetos: a ficha aberta precisa
  // apontar para a versão nova, ou fica mostrando os dados antigos.
  useEffect(() => {
    if (!selectedCargo) return;
    const fresco = cargos.find(c => c.id === selectedCargo.id);
    if (fresco && fresco !== selectedCargo) setSelectedCargo(fresco);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cargos]);

  const clearSearch = () => {
    setSearch('');
    setPage(0);
    clearTimeout(searchTimer.current);
    setSearchLoading(true);
    loadCargos(0, '');
  };

  // ── open create ───────────────────────────────────────────
  const openCreate = async () => {
    setIsEditing(false);
    setSelectedCargo(null);
    setFormDescricao('');
    setFormTelasIds(new Set());
    setFormPermissoesIds(new Set());
    setFormAcessoTotal(new Set());
    setFormTab('dados');
    await loadSystemData();
    setFormModal(true);
  };

  // ── open edit ─────────────────────────────────────────────
  const openEdit = async (cargo) => {
    setIsEditing(true);
    setSelectedCargo(cargo);
    setFormDescricao(cargo.descricao ?? '');

    const telaIds = new Set((cargo.telas ?? []).map(t => t.id));
    setFormTelasIds(telaIds);

    const permIds = new Set(
      (cargo.telas ?? []).flatMap(t => (t.permissoes ?? []).map(p => p.id))
    );
    setFormPermissoesIds(permIds);

    // restaura o estado do toggle de Acesso Total por tela
    const acessoTotalTelaIds = new Set(
      (cargo.telas ?? []).filter(t =>
        (t.permissoes ?? []).some(p => (p.permissao ?? '').toUpperCase() === 'ACESSO TOTAL')
      ).map(t => t.id)
    );
    setFormAcessoTotal(acessoTotalTelaIds);

    await loadSystemData();
    for (const tela of (cargo.telas ?? [])) loadPermsForTela(tela.id);

    setFormTab('telas');
    setFormModal(true);
  };

  // ── toggle tela ───────────────────────────────────────────
  const toggleTela = (telaId) => {
    setFormTelasIds(prev => {
      const next = new Set(prev);
      if (next.has(telaId)) {
        next.delete(telaId);
        // remove permissões e acesso total desta tela
        const permsOfTela = (systemPerms[telaId] ?? []).map(p => p.id);
        setFormPermissoesIds(pp => {
          const np = new Set(pp); permsOfTela.forEach(id => np.delete(id)); return np;
        });
        setFormAcessoTotal(at => {
          const na = new Set(at); na.delete(telaId); return na;
        });
      } else {
        next.add(telaId);
        loadPermsForTela(telaId);
        // auto-select HISTORICO DO FLUXO DE CAIXA when FINANCEIRO is enabled
        const tela = systemTelas.find(t => t.id === telaId);
        if (isFinanceiro(tela)) {
          const perms = systemPerms[telaId] ?? [];
          const autoId = perms.find(p => p.permissao === FINANCEIRO_AUTO)?.id;
          if (autoId) {
            setFormPermissoesIds(pp => { const np = new Set(pp); np.add(autoId); return np; });
          }
        }
      }
      return next;
    });
  };

  // ── toggle acesso total ───────────────────────────────────
  const toggleAcessoTotal = (telaId) => {
    const perms = systemPerms[telaId] ?? [];
    setFormAcessoTotal(prev => {
      const next = new Set(prev);
      if (next.has(telaId)) {
        next.delete(telaId);
        // remove a permissão ACESSO TOTAL da lista (as demais o usuário decide)
        const acessoTotalPerm = (systemPerms[telaId] ?? []).find(
          p => (p.permissao ?? '').toUpperCase() === 'ACESSO TOTAL'
        );
        if (acessoTotalPerm) {
          setFormPermissoesIds(pp => {
            const np = new Set(pp);
            np.delete(acessoTotalPerm.id);
            return np;
          });
        }
      } else {
        next.add(telaId);
        // remove todas as permissões desta tela e adiciona só ACESSO TOTAL
        const allPermIds     = perms.map(p => p.id);
        const acessoTotalPerm = perms.find(
          p => (p.permissao ?? '').toUpperCase() === 'ACESSO TOTAL'
        );
        setFormPermissoesIds(pp => {
          const np = new Set(pp);
          allPermIds.forEach(id => np.delete(id));
          if (acessoTotalPerm) np.add(acessoTotalPerm.id);
          return np;
        });
      }
      return next;
    });
  };

  // ── toggle permissao ──────────────────────────────────────
  const togglePermissao = (permId, tela) => {
    setFormPermissoesIds(prev => {
      const next = new Set(prev);
      const adding = !next.has(permId);
      adding ? next.add(permId) : next.delete(permId);

      // cascade rules only when checking a permission in FINANCEIRO
      if (adding && isFinanceiro(tela)) {
        const perms = systemPerms[tela.id] ?? [];
        const code  = perms.find(p => p.id === permId)?.permissao ?? '';
        (FINANCEIRO_CASCADES[code] ?? []).forEach(cascadeCode => {
          const target = perms.find(p => p.permissao === cascadeCode);
          if (target) next.add(target.id);
        });
      }

      return next;
    });
  };

  // ── create ────────────────────────────────────────────────
  const handleCreate = async () => {
    const desc = up(formDescricao);
    if (!desc) { notify(tr('Informe o nome do cargo'), 'error'); return; }
    setSaving(true);
    try {
      await cargoApi.criar({
        descricao: desc,
        telas: [...formTelasIds].map(id => ({ id })),
        permissoes: [...formPermissoesIds].map(id => ({ id })),
      });
      notify(tr('Cargo criado com sucesso!'));
      setFormModal(false);
      setSelectedCargo(null);
      loadCargos(0, search);
    } catch (err) {
      notify(err.message || tr('Erro ao criar cargo'), 'error');
    } finally {
      setSaving(false);
    }
  };

  // ── update ────────────────────────────────────────────────
  const handleUpdate = async () => {
    const desc = up(formDescricao);
    if (!desc) { notify(tr('Informe o nome do cargo'), 'error'); return; }
    setSaving(true);
    try {
      await cargoApi.atualizar({
        id: selectedCargo.id,
        descricao: desc,
        telas: [...formTelasIds].map(id => ({ id })),
        permissoes: [...formPermissoesIds].map(id => ({ id })),
      });
      notify(tr('Cargo atualizado com sucesso!'));
      setFormModal(false);
      loadCargos(page, search);
    } catch (err) {
      notify(err.message || tr('Erro ao atualizar cargo'), 'error');
    } finally {
      setSaving(false);
    }
  };

  // ── delete ────────────────────────────────────────────────
  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await cargoApi.deletar(deleteTarget.id);
      notify(tr('Cargo excluído.'));
      setDeleteTarget(null);
      closeDetail();
      loadCargos(0, search);
    } catch (err) {
      notify(tr('Erro: ') + err.message, 'error');
    } finally {
      setDeleting(false);
    }
  };

  // ── Render ────────────────────────────────────────────────
  const totalPermsSistema = systemTelas.reduce((n, t) => n + (t.permissoes ?? []).length, 0);

  // só aparece quando a ficha/formulário ocupa a tela e a lista está fora
  const BackBtn = ({ onClick = closeDetail, title = tr('Voltar para a lista') }) => (
    <button type="button" className={styles.backBtn} onClick={onClick}
      title={title} aria-label={title}>
      <ChevronLeft size={17} />
    </button>
  );

  /** Abas da ficha (mesmo desenho das abas da ficha de Preços). */
  const FichaTabs = ({ abas, atual, onChange }) => (
    <div className={styles.fichaTabs} role="tablist">
      {abas.map(([k, label]) => (
        <button key={k} type="button" role="tab" aria-selected={atual === k}
          className={[styles.fichaTab, atual === k ? styles.fichaTabAtiva : ''].join(' ')}
          onClick={() => onChange(k)}>
          {label}
        </button>
      ))}
    </div>
  );

  // ── Ficha do cargo ──────────────────────────────────────────
  const renderFicha = (cargo) => {
    const telasDoCargo = cargo.telas ?? [];
    const permsDoCargo = telasDoCargo.reduce((n, t) => n + (t.permissoes ?? []).length, 0);
    const abas = [
      ['telas', tr('Telas e permissões')],
      ['dados', tr('Dados do cargo')],
    ];

    return (
      <div className={styles.detailPanel}>
        <section className={[styles.dCard, styles.fichaCard].join(' ')}>
          <h3 className={[styles.dCardHead, styles.fichaHead].join(' ')}>
            <BackBtn />
            <ShieldCheck size={16} />
            <span className={styles.dCardTitle}>{tr('Ficha do cargo')}</span>
            <div className={styles.dCardActions}>
              <Button className={styles.btnSolid} onClick={() => openEdit(cargo)}>{tr('Editar')}</Button>
              <Button variant="danger" className={[styles.btnSolid, styles.btnDanger].join(' ')}
                onClick={() => setDeleteTarget(cargo)}>
                {tr('Excluir')}
              </Button>
              <button type="button" className={styles.idClose} onClick={closeDetail}
                title={tr('Fechar ficha')} aria-label={tr('Fechar ficha')}>
                <X size={16} />
              </button>
            </div>
          </h3>

          <div className={[styles.dCardBody, styles.fichaBody].join(' ')}>
            <div className={styles.fichaTopo}>
              <div className={styles.fichaId}>
                <span className={styles.fichaIcone}><ShieldCheck size={26} /></span>
                <div className={styles.idHeadMain}>
                  <h2 className={styles.fichaNome}>{cargo.descricao}</h2>
                  <p className={styles.fichaSub}>#{cargo.id}</p>
                  <div className={styles.idTags}>
                    {telasDoCargo.length === 0
                      ? <span className={styles.tag}>{tr('Sem acesso a nenhuma tela')}</span>
                      : <>
                          <span className={[styles.tag, styles.tagPrimary].join(' ')}>
                            {telasDoCargo.length !== 1 ? tr('{{n}} telas', { n: telasDoCargo.length }) : tr('{{n}} tela', { n: telasDoCargo.length })}
                          </span>
                          <span className={styles.tag}>
                            {permsDoCargo !== 1 ? tr('{{n}} permissões', { n: permsDoCargo }) : tr('{{n}} permissão', { n: permsDoCargo })}
                          </span>
                        </>}
                  </div>
                </div>
              </div>
              <FichaTabs abas={abas} atual={abaFicha} onChange={setAbaFicha} />
            </div>

            {abaFicha === 'dados' ? (
              /* "x de y" diz mais que a contagem sozinha: mostra o quanto
                 do sistema este cargo alcança. */
              <div className={styles.fieldGrid}>
                <Field label={tr('Nome do cargo')} value={cargo.descricao} />
                <Field
                  label={tr('Telas com acesso')}
                  value={systemDataLoaded
                    ? tr('{{n}} de {{total}}', { n: telasDoCargo.length, total: systemTelas.length })
                    : telasDoCargo.length}
                />
                <Field
                  label={tr('Permissões concedidas')}
                  value={systemDataLoaded && totalPermsSistema > 0
                    ? tr('{{n}} de {{total}}', { n: permsDoCargo, total: totalPermsSistema })
                    : permsDoCargo}
                />
              </div>
            ) : telasDoCargo.length === 0 ? (
              <p className={styles.blockEmpty}>{tr('Nenhuma tela vinculada a este cargo.')}</p>
            ) : (
              <div className={styles.telaGrid}>
                {telasDoCargo.map(tela => {
                  const perms = tela.permissoes ?? [];
                  return (
                    <div key={tela.id} className={styles.telaCard}>
                      <div className={styles.telaCardHead}>
                        <span className={styles.telaCardNome}>{tela.nome ?? tela.descricao}</span>
                        {perms.length > 0 && (
                          <span className={[styles.tag, styles.telaCardCount].join(' ')}>{perms.length}</span>
                        )}
                      </div>
                      {tela.nome && tela.descricao && tela.descricao !== tela.nome && (
                        <p className={styles.telaCardDesc}>{tela.descricao}</p>
                      )}

                      {perms.length === 0 ? (
                        <p className={styles.permEmpty}>{tr('Sem permissões específicas.')}</p>
                      ) : (
                        <div className={styles.permList}>
                          {perms.map(p => (
                            <span key={p.id} className={styles.permItem}>
                              <span className={styles.permBullet} />
                              <span>{p.descricao ?? p.permissao}</span>
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </section>
      </div>
    );
  };

  // ── Formulário (novo / editar), no lugar da ficha ───────────
  const renderForm = () => {
    const abas = [
      ['dados', tr('Dados do cargo')],
      ['telas', tr('Telas e permissões')],
    ];
    const ultima = formTab === 'telas';

    return (
      <div className={styles.detailPanel}>
        <section className={[styles.dCard, styles.fichaCard].join(' ')}>
          <h3 className={[styles.dCardHead, styles.fichaHead].join(' ')}>
            <BackBtn onClick={cancelForm} title={isEditing ? tr('Voltar para a ficha') : tr('Voltar para a lista')} />
            <ShieldCheck size={16} />
            <span className={styles.dCardTitle}>{isEditing ? tr('Editar cargo') : tr('Novo cargo')}</span>
            <div className={styles.dCardActions}>
              <button type="button" className={styles.idClose} onClick={cancelForm}
                title={tr('Cancelar')} aria-label={tr('Cancelar')}>
                <X size={16} />
              </button>
            </div>
          </h3>

          <div className={[styles.dCardBody, styles.fichaBody].join(' ')}>
            <div className={[styles.fichaTopo, styles.fichaTopoForm].join(' ')}>
              <FichaTabs abas={abas} atual={formTab} onChange={setFormTab} />
            </div>

            <div className={styles.formBody}>
              {formTab === 'dados' ? (
                <FormField label={tr('Nome do cargo *')}>
                  <Input
                    placeholder={tr('Ex: GERENTE, RECEPCIONISTA...')}
                    value={formDescricao}
                    onChange={e => setFormDescricao(e.target.value.toUpperCase())}
                    disabled={saving}
                  />
                </FormField>
              ) : !systemDataLoaded ? (
                <div className={styles.empty}>
                  <Loader2 size={14} className={styles.spinInline} /> {tr('Carregando telas…')}
                </div>
              ) : systemTelas.length === 0 ? (
                <p className={styles.blockEmpty}>{tr('Nenhuma tela disponível')}</p>
              ) : (
                <div className={styles.telasSection}>
                  {systemTelas.map(tela => {
                    const isChecked = formTelasIds.has(tela.id);
                    const hasTotal  = formAcessoTotal.has(tela.id);
                    const perms     = systemPerms[tela.id];

                    return (
                      <div key={tela.id} className={[styles.telaItem, isChecked ? styles.telaItemActive : ''].join(' ')}>

                        {/* header da tela */}
                        <div
                          className={[styles.telaItemHeader, isChecked ? styles.telaItemHeaderActive : ''].join(' ')}
                          onClick={() => toggleTela(tela.id)}
                        >
                          <input
                            type="checkbox"
                            className={styles.telaCheckbox}
                            checked={isChecked}
                            onChange={() => toggleTela(tela.id)}
                            onClick={e => e.stopPropagation()}
                          />
                          <div className={styles.telaInfo}>
                            <div className={styles.telaNome}>{tela.nome ?? tela.descricao}</div>
                            {tela.nome && tela.descricao && (
                              <div className={styles.telaDesc}>{tela.descricao}</div>
                            )}
                          </div>
                        </div>

                        {/* permissões (só quando a tela está ativa) */}
                        {isChecked && (
                          !perms || perms.length === 0 ? (
                            <div className={styles.permissaoEmpty}>{tr('Nenhuma permissão disponível para esta tela')}</div>
                          ) : (
                            <>
                              {/* Acesso Total */}
                              <label className={styles.acessoTotalRow}>
                                <input
                                  type="checkbox"
                                  className={styles.acessoTotalCheckbox}
                                  checked={hasTotal}
                                  onChange={() => toggleAcessoTotal(tela.id)}
                                />
                                <span className={styles.acessoTotalLabel}>{tr('Acesso Total')}</span>
                                {hasTotal && (
                                  <span className={styles.acessoTotalBadge}>{tr('Todas selecionadas')}</span>
                                )}
                              </label>

                              {/* Lista de permissões (exclui "ACESSO TOTAL" pois já está no toggle) */}
                              <div className={styles.permissoesList}>
                                {perms.filter(p => (p.permissao ?? p.descricao ?? '').toUpperCase() !== 'ACESSO TOTAL').map(perm => {
                                  const title = perm.permissao ?? perm.descricao;
                                  const desc  = perm.descricao || permDescMap[perm.id];
                                  return (
                                    <label
                                      key={perm.id}
                                      className={[
                                        styles.permissaoItem,
                                        hasTotal ? styles.permissaoItemDisabled : '',
                                      ].join(' ')}
                                    >
                                      <input
                                        type="checkbox"
                                        className={styles.permissaoCheckbox}
                                        checked={formPermissoesIds.has(perm.id)}
                                        onChange={() => !hasTotal && togglePermissao(perm.id, tela)}
                                        disabled={hasTotal}
                                      />
                                      <div className={styles.permissaoTexts}>
                                        <span className={styles.permissaoNome}>{title}</span>
                                        {desc && desc !== title && <span className={styles.permissaoDesc}>{desc}</span>}
                                      </div>
                                    </label>
                                  );
                                })}
                              </div>
                            </>
                          )
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className={styles.formFoot}>
              <Button className={styles.btnSolid} onClick={cancelForm} disabled={saving}>
                {tr('Cancelar')}
              </Button>
              {isEditing || ultima ? (
                <Button variant="primary" className={[styles.btnSolid, styles.btnPrimary].join(' ')}
                  onClick={isEditing ? handleUpdate : handleCreate} disabled={saving}>
                  {saving && <Loader2 size={14} className={styles.spinInline} />}
                  {isEditing ? tr('Salvar alterações') : tr('Criar cargo')}
                </Button>
              ) : (
                <Button variant="primary" className={[styles.btnSolid, styles.btnPrimary].join(' ')}
                  onClick={() => setFormTab('telas')}>
                  {tr('Avançar')}
                </Button>
              )}
            </div>
          </div>
        </section>
      </div>
    );
  };

  return (
    <div className={styles.page}>
      <Notification notification={notification} />
      <div className={styles.container}>
        {/* Abaixo de 1024px, com ficha ou formulário aberto, ele toma a tela e a lista sai. */}
        <main className={[styles.split, (selectedCargo || formModal) ? styles.splitListHidden : ''].join(' ')}>

          {/* ══ LISTA ═══════════════════════════════════════════ */}
          <aside className={styles.listPanel}>
            <div className={styles.listTopoEscuro}>
            <div className={styles.listTopo}>
              <span className={styles.listTitulo}>{tr('Cargos')}</span>
              {!formModal && (
                <Button variant="primary" className={[styles.btnSolid, styles.btnPrimary].join(' ')}
                  onClick={openCreate}>
                  {tr('Cadastrar')}
                </Button>
              )}
            </div>

            <div className={[styles.searchWrap, styles.searchWrapFull, search ? styles.searchAtiva : ''].join(' ')}>
              <Search size={16} className={styles.searchIcon} />
              <Input
                value={search}
                onChange={handleSearch}
                placeholder={tr('Buscar cargo...')}
                className={styles.searchInput}
                aria-label={tr('Buscar')}
              />
              {searchLoading
                ? <Loader2 size={14} className={[styles.spinInline, styles.searchSpinner].join(' ')} />
                : search.length > 0 && (
                  <button className={styles.searchClear} onClick={clearSearch} aria-label={tr('Limpar busca')}>
                    <X size={14} />
                  </button>
                )}
            </div>

            </div>
            <div className={styles.listCorpo}>
            <div className={styles.listMeta}>
              <span>
                {loading ? tr('Carregando...') : totalElements !== 1 ? tr('{{n}} cargos', { n: totalElements }) : tr('{{n}} cargo', { n: totalElements })}
              </span>
            </div>

            <div className={styles.listScroll}>
              {loading ? (
                <SkeletonLista />
              ) : cargos.length === 0 ? (
                <div className={styles.empty}>
                  <ShieldCheck size={24} opacity={0.3} />
                  <span>{search ? tr('Nenhum cargo encontrado.') : tr('Nenhum cargo cadastrado.')}</span>
                </div>
              ) : cargos.map(cargo => {
                const telas = cargo.telas ?? [];
                const nPerms = telas.reduce((n, t) => n + (t.permissoes ?? []).length, 0);
                const ativo = selectedCargo?.id === cargo.id;
                return (
                  <button key={cargo.id} type="button"
                    className={[styles.listItem, ativo ? styles.listItemActive : ''].join(' ')}
                    onClick={() => openDetail(cargo)}>
                    <span className={styles.listItemBody}>
                      <span className={styles.listItemName}>
                        <span className={styles.nome}>{cargo.descricao}</span>
                      </span>
                      <span className={styles.listItemSub}>
                        {telas.length === 0
                          ? tr('Sem telas')
                          : [
                              telas.length !== 1 ? tr('{{n}} telas', { n: telas.length }) : tr('{{n}} tela', { n: telas.length }),
                              nPerms !== 1 ? tr('{{n}} permissões', { n: nPerms }) : tr('{{n}} permissão', { n: nPerms }),
                            ].join(' · ')}
                      </span>
                    </span>
                    <ChevronRight size={16} className={styles.listChevron} />
                  </button>
                );
              })}
            </div>

            {totalPages > 1 && (
              <div className={styles.pagination}>
                <button className={styles.pageBtn} disabled={page === 0}
                  onClick={() => handlePageChange(page - 1)} aria-label={tr('Página anterior')}>
                  <ChevronLeft size={16} />
                </button>
                <span className={styles.pageCurrent}>{page + 1} {tr('de')} {totalPages}</span>
                <button className={styles.pageBtn} disabled={page >= totalPages - 1}
                  onClick={() => handlePageChange(page + 1)} aria-label={tr('Próxima página')}>
                  <ChevronRight size={16} />
                </button>
              </div>
            )}
            </div>
          </aside>

          {/* ══ DIREITA: formulário ou ficha ══════ */}
          {formModal ? renderForm()
            : selectedCargo ? renderFicha(selectedCargo)
            : null}
        </main>
      </div>

      {/* ═══════════════════════════════════════════════════════
          MODAL — Confirmar exclusão
      ═══════════════════════════════════════════════════════ */}
      <Modal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        size="sm"
        title={<><Trash2 size={15} /> {tr('Confirmar exclusão')}</>}
        footer={
          <div className={styles.modalFooter}>
            <Button variant="secondary" onClick={() => setDeleteTarget(null)}>{tr('Cancelar')}</Button>
            <Button variant="danger" onClick={handleDelete} disabled={deleting}>
              {deleting && <Loader2 size={14} className={styles.spinInline} />}
              {tr('Excluir')}
            </Button>
          </div>
        }
      >
        <div style={{ fontSize: 14, color: 'var(--text)', lineHeight: 1.6 }}>
          {tr('Tem certeza que deseja excluir')} <strong>{deleteTarget?.descricao}</strong>?
        </div>
      </Modal>
    </div>
  );
}
