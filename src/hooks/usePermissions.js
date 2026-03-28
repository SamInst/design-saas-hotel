import { useMemo } from 'react';
import { userStorage } from '../services/api';

/**
 * Hook global de permissões.
 *
 * Lê o funcionário logado do localStorage e monta um mapa de
 * permissões por tela, baseado em cargo.telas[].permissoes[].
 *
 * Uso:
 *   const { can, hasTela, loggedUser } = usePermissions();
 *   can('CADASTRO', 'CADASTRO')          // pode cadastrar?
 *   can('CADASTRO', 'ATUALIZAR')         // pode editar?
 *   can('CADASTRO', 'BLOQUEIO')          // pode bloquear?
 *   can('CADASTRO', 'ACESSO HISTORICO')  // pode ver histórico?
 *   hasTela('FINANCEIRO')                // tem acesso à tela?
 *
 * ACESSO TOTAL libera qualquer permissão da tela.
 */

const norm = s => (s ?? '').trim().toUpperCase();

export function usePermissions() {
  const rawUser = userStorage.get();

  const { telaMap, isAdmin } = useMemo(() => {
    const telas = rawUser?.cargo?.telas ?? [];
    const map = {};
    let admin = false;
    for (const tela of telas) {
      if (norm(tela.nome) === 'ADMIN') { admin = true; break; }
      map[norm(tela.nome)] = new Set((tela.permissoes ?? []).map(p => norm(p.permissao)));
    }
    return { telaMap: map, isAdmin: admin };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rawUser?.id, rawUser?.cargo?.id, JSON.stringify(rawUser?.cargo?.telas)]);

  /** Verifica se o usuário tem acesso à tela (independente de permissão). */
  const hasTela = (nome) => isAdmin || !!telaMap[norm(nome)];

  /**
   * Verifica se o usuário pode executar uma ação na tela.
   * ACESSO TOTAL na tela libera qualquer permissão.
   */
  const can = (tela, permissao) => {
    if (isAdmin) return true;
    const set = telaMap[norm(tela)];
    if (!set) return false;
    return set.has('ACESSO TOTAL') || set.has(norm(permissao));
  };

  return {
    can,
    hasTela,
    loggedUser: rawUser,
  };
}
