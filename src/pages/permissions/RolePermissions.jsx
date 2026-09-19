import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Search, Loader2, ShieldCheck, X,
  Lock, ChevronLeft, ChevronRight,
} from 'lucide-react';

import { Button }                from '../../components/ui/Button';
import { Modal }                 from '../../components/ui/Modal';
import { Input, FormField }      from '../../components/ui/Input';
import { Notification }          from '../../components/ui/Notification';
import { cargoApi } from '../../services/api';

import styles from './RolePermissions.module.css';

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
    <div role="status" aria-label="Carregando cargos">
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

function SkeletonPainel() {
  return (
    <div className={styles.statGrid} role="status" aria-label="Carregando totais">
      {Array.from({ length: 3 }, (_, i) => (
        <div key={i} className={styles.statCard} aria-hidden="true">
          <span className={sk(styles.skLabel)} />
          <span className={sk(styles.skNumero)} />
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

  // ── ficha aberta no painel de detalhe / modal de formulário ──
  const [formModal,     setFormModal]     = useState(false);
  const [selectedCargo, setSelectedCargo] = useState(null);
  const [isEditing,     setIsEditing]     = useState(false);

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
      notify(err.message || 'Erro ao carregar cargos', 'error');
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

  // O painel geral mostra os totais de telas e permissões do sistema, então
  // agora isso precisa carregar na montagem, não só ao abrir o formulário.
  useEffect(() => { loadSystemData(); }, [loadSystemData]);

  // ── painel de detalhe ─────────────────────────────────────
  const openDetail  = (cargo) => setSelectedCargo(cargo);
  const closeDetail = () => setSelectedCargo(null);

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
    if (!desc) { notify('Informe o nome do cargo', 'error'); return; }
    setSaving(true);
    try {
      await cargoApi.criar({
        descricao: desc,
        telas: [...formTelasIds].map(id => ({ id })),
        permissoes: [...formPermissoesIds].map(id => ({ id })),
      });
      notify('Cargo criado com sucesso!');
      setFormModal(false);
      loadCargos(0, search);
    } catch (err) {
      notify(err.message || 'Erro ao criar cargo', 'error');
    } finally {
      setSaving(false);
    }
  };

  // ── update ────────────────────────────────────────────────
  const handleUpdate = async () => {
    const desc = up(formDescricao);
    if (!desc) { notify('Informe o nome do cargo', 'error'); return; }
    setSaving(true);
    try {
      await cargoApi.atualizar({
        id: selectedCargo.id,
        descricao: desc,
        telas: [...formTelasIds].map(id => ({ id })),
        permissoes: [...formPermissoesIds].map(id => ({ id })),
      });
      notify('Cargo atualizado com sucesso!');
      setFormModal(false);
      loadCargos(page, search);
    } catch (err) {
      notify(err.message || 'Erro ao atualizar cargo', 'error');
    } finally {
      setSaving(false);
    }
  };

  // ── Render ────────────────────────────────────────────────
  // Totais do painel geral: as telas/permissões do sistema só chegam depois
  // de loadSystemData, então enquanto não chegam o cartão mostra o esqueleto.
  const totalPermsSistema = systemTelas.reduce((n, t) => n + (t.permissoes ?? []).length, 0);

  const telasDoCargo = selectedCargo?.telas ?? [];
  const permsDoCargo = telasDoCargo.reduce((n, t) => n + (t.permissoes ?? []).length, 0);

  return (
    <div className={styles.page}>
      <Notification notification={notification} />
      <div className={styles.container}>
        {/* Abaixo de 1024px, com uma ficha aberta, ela toma a tela e a lista sai. */}
        <main className={[styles.split, selectedCargo ? styles.splitListHidden : ''].join(' ')}>

          {/* ══ LISTA ═══════════════════════════════════════════ */}
          <aside className={styles.listPanel}>
            <div className={[styles.searchWrap, styles.searchWrapFull].join(' ')}>
              <Search size={16} className={styles.searchIcon} />
              <Input
                value={search}
                onChange={handleSearch}
                placeholder="Buscar cargo..."
                className={styles.searchInput}
                aria-label="Buscar"
              />
              {searchLoading
                ? <Loader2 size={14} className={[styles.spinInline, styles.searchSpinner].join(' ')} />
                : search.length > 0 && (
                  <button className={styles.searchClear} onClick={clearSearch} aria-label="Limpar busca">
                    <X size={14} />
                  </button>
                )}
            </div>

            <div className={styles.listMeta}>
              <span>
                {loading ? 'Carregando...' : `${totalElements} cargo${totalElements !== 1 ? 's' : ''}`}
              </span>
              <Button className={[styles.btnSolid, styles.btnSm, styles.btnPrimary].join(' ')}
                onClick={openCreate}>
                Novo cargo
              </Button>
            </div>

            <div className={styles.listScroll}>
              {loading ? (
                <SkeletonLista />
              ) : cargos.length === 0 ? (
                <div className={styles.empty}>
                  <ShieldCheck size={24} opacity={0.3} />
                  <span>{search ? 'Nenhum cargo encontrado.' : 'Nenhum cargo cadastrado.'}</span>
                </div>
              ) : cargos.map(cargo => {
                const telas = cargo.telas ?? [];
                const ativo = selectedCargo?.id === cargo.id;
                return (
                  <button key={cargo.id} type="button"
                    className={[styles.listItem, ativo ? styles.listItemActive : ''].join(' ')}
                    onClick={() => openDetail(cargo)}>
                    <span className={styles.listItemBody}>
                      <span className={styles.listItemName}>
                        <span className={styles.nome}>{cargo.descricao}</span>
                        <span className={styles.idMono}>#{cargo.id}</span>
                      </span>
                      <span className={styles.listItemSub}>
                        <TelaTags telas={telas} />
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
                  onClick={() => handlePageChange(page - 1)} aria-label="Página anterior">
                  <ChevronLeft size={16} />
                </button>
                <span className={styles.pageCurrent}>{page + 1} de {totalPages}</span>
                <button className={styles.pageBtn} disabled={page >= totalPages - 1}
                  onClick={() => handlePageChange(page + 1)} aria-label="Próxima página">
                  <ChevronRight size={16} />
                </button>
              </div>
            )}
          </aside>

          {/* ══ DETALHE ═════════════════════════════════════════ */}
          {!selectedCargo ? (
            /* ── Painel geral (nenhum cargo selecionado) ── */
            <div className={styles.detailPanel}>
              <section className={styles.dCard}>
                <h3 className={styles.dCardHead}>
                  <ShieldCheck size={16} />
                  <span className={styles.dCardTitle}>Visão geral de acessos</span>
                </h3>

                <div className={styles.dCardBody}>
                  {!systemDataLoaded ? (
                    <SkeletonPainel />
                  ) : (
                    <div className={styles.statGrid}>
                      <div className={styles.statCard}>
                        <p className={styles.statLabel}>Cargos</p>
                        <p className={styles.statVal}>{totalElements}</p>
                      </div>
                      <div className={styles.statCard}>
                        <p className={styles.statLabel}>Telas do sistema</p>
                        <p className={styles.statVal}>{systemTelas.length}</p>
                      </div>
                      <div className={styles.statCard}>
                        <p className={styles.statLabel}>Permissões do sistema</p>
                        <p className={styles.statVal}>{totalPermsSistema}</p>
                      </div>
                    </div>
                  )}
                </div>
              </section>

              <div className={styles.detailHint}>
                Escolha um cargo na lista ao lado para ver as telas e permissões.
              </div>
            </div>
          ) : (
            /* ── Ficha do cargo ── */
            <div className={styles.detailPanel}>

              {/* ── Identificação ── */}
              <section className={styles.dCard}>
                <h3 className={styles.dCardHead}>
                  <button type="button" className={styles.backBtn} onClick={closeDetail}
                    title="Voltar para a lista" aria-label="Voltar para a lista">
                    <ChevronLeft size={17} />
                  </button>
                  <ShieldCheck size={16} />
                  <span className={styles.dCardTitle}>Dados do cargo</span>
                  <div className={styles.dCardActions}>
                    <Button className={styles.btnSolid} onClick={() => openEdit(selectedCargo)}>
                      Editar
                    </Button>
                    <button type="button" className={styles.idClose} onClick={closeDetail}
                      title="Fechar ficha" aria-label="Fechar ficha">
                      <X size={16} />
                    </button>
                  </div>
                </h3>

                <div className={styles.dCardBody}>
                  <div className={styles.idHead}>
                    <div className={styles.idHeadMain}>
                      <div className={styles.idName}>
                        <h2 style={{ margin: 0, font: 'inherit' }}>{selectedCargo.descricao}</h2>
                        <span className={styles.idMono}>#{selectedCargo.id}</span>
                      </div>
                      {telasDoCargo.length === 0 && (
                        <div className={styles.idTags}>
                          <span className={[styles.tag, styles.tagMuted].join(' ')}>Sem acesso a nenhuma tela</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* "x de y" diz mais que a contagem sozinha: mostra o quanto
                      do sistema este cargo alcança. */}
                  <div className={styles.fieldGrid}>
                    <Field
                      label="Telas com acesso"
                      value={systemDataLoaded
                        ? `${telasDoCargo.length} de ${systemTelas.length}`
                        : telasDoCargo.length}
                    />
                    <Field
                      label="Permissões concedidas"
                      value={systemDataLoaded && totalPermsSistema > 0
                        ? `${permsDoCargo} de ${totalPermsSistema}`
                        : permsDoCargo}
                    />
                  </div>
                </div>
              </section>

              {/* ── Telas e permissões ── */}
              <section className={styles.dCard}>
                <h3 className={styles.dCardHead}>
                  <Lock size={16} />
                  <span className={styles.dCardTitle}>Telas e permissões</span>
                </h3>

                <div className={styles.dCardBody}>
                  {telasDoCargo.length === 0 ? (
                    <p className={styles.blockEmpty}>Nenhuma tela vinculada a este cargo.</p>
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
                              <p className={styles.permEmpty}>Sem permissões específicas.</p>
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
          )}
        </main>
      </div>


      {/* ── CREATE / EDIT MODAL ── */}
      <Modal
        open={formModal}
        onClose={() => setFormModal(false)}
        title={isEditing ? `Editar: ${selectedCargo?.descricao ?? ''}` : 'Novo Cargo'}
        size="md"
        footer={
          <div className={styles.modalFooter}>
            <Button variant="secondary" className={styles.full} onClick={() => setFormModal(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button
              variant="primary"
              className={styles.full}
              onClick={isEditing ? handleUpdate : handleCreate}
              disabled={saving}
            >
              {saving && <Loader2 size={14} className={styles.spin} />}
              {isEditing ? 'Salvar alterações' : 'Criar cargo'}
            </Button>
          </div>
        }
      >
        <div className={styles.formBody}>
          <FormField label="Nome do cargo *">
            <Input
              placeholder="Ex: GERENTE, RECEPCIONISTA..."
              value={formDescricao}
              onChange={e => setFormDescricao(e.target.value.toUpperCase())}
              disabled={saving}
            />
          </FormField>

          <div className={styles.formDivider} />

          <div className={styles.telasSection}>
            <div className={styles.telasSectionTitle}>
              <Lock size={12} />
              Telas e Permissões
            </div>

            {!systemDataLoaded ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0', color: 'var(--text-2)', fontSize: 13 }}>
                <Loader2 size={14} className={styles.spin} />
                Carregando telas…
              </div>
            ) : systemTelas.length === 0 ? (
              <div style={{ fontSize: 13, color: 'var(--text-2)' }}>Nenhuma tela disponível</div>
            ) : (
              systemTelas.map(tela => {
                const isChecked    = formTelasIds.has(tela.id);
                const hasTotal     = formAcessoTotal.has(tela.id);
                const perms = systemPerms[tela.id];

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
                        <div className={styles.permissaoEmpty}>Nenhuma permissão disponível para esta tela</div>
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
                            <span className={styles.acessoTotalLabel}>Acesso Total</span>
                            {hasTotal && (
                              <span className={styles.acessoTotalBadge}>Todas selecionadas</span>
                            )}
                          </label>

                          {/* Lista de permissões (exclui "ACESSO TOTAL" pois já está no toggle) */}
                          <div className={styles.permissoesList}>
                            {perms.filter(p => (p.permissao ?? p.descricao ?? '').toUpperCase() !== 'ACESSO TOTAL').map(perm => (
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
                                  {(() => {
                                    const title = perm.permissao ?? perm.descricao;
                                    const desc  = perm.descricao || permDescMap[perm.id];
                                    const showDesc = desc && desc !== title;
                                    return (
                                      <>
                                        <span className={styles.permissaoNome}>{title}</span>
                                        {showDesc && <span className={styles.permissaoDesc}>{desc}</span>}
                                      </>
                                    );
                                  })()}
                                </div>
                              </label>
                            ))}
                          </div>
                        </>
                      )
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      </Modal>

    </div>
  );
}

// ── TelaTags ─────────────────────────────────────────────────
// Só as duas primeiras telas cabem na linha da lista; o resto vira "+n".
function TelaTags({ telas }) {
  if (!telas || telas.length === 0) {
    return <span className={[styles.tag, styles.tagMuted].join(' ')}>Sem telas</span>;
  }
  const visible = telas.slice(0, 2);
  const rest    = telas.length - visible.length;
  return (
    <>
      {visible.map(t => (
        <span key={t.id} className={styles.tag}>{t.nome ?? t.descricao}</span>
      ))}
      {rest > 0 && <span className={[styles.tag, styles.tagMuted].join(' ')}>+{rest}</span>}
    </>
  );
}
