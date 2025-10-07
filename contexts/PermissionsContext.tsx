import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { clearPermissionsCache, getUserPermissions, UserPermission } from '../services/supabase/permissionsService';
import { useActiveArtist } from '../services/useActiveArtist';

interface PermissionsContextData {
  userPermissions: UserPermission | null;
  permissionsLoaded: boolean;
  canCreateEvents: boolean;
  canEditEvents: boolean;
  canDeleteEvents: boolean;
  canViewFinancials: boolean;
  canManageMembers: boolean;
  canManageArtist: boolean;
  canDeleteArtist: boolean;
  isViewer: boolean;
  isEditor: boolean;
  isAdmin: boolean;
  isOwner: boolean;
  reloadPermissions: () => Promise<void>;
}

const PermissionsContext = createContext<PermissionsContextData>({} as PermissionsContextData);

export const PermissionsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [userPermissions, setUserPermissions] = useState<UserPermission | null>(null);
  const [permissionsLoaded, setPermissionsLoaded] = useState(false);
  const { activeArtist } = useActiveArtist();

  // Carregar permissões
  const loadPermissions = async () => {
    if (!activeArtist) {
      setUserPermissions(null);
      setPermissionsLoaded(true);
      return;
    }

    try {
      setPermissionsLoaded(false);
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setUserPermissions(null);
        setPermissionsLoaded(true);
        return;
      }

      // Limpar cache para garantir dados frescos
      clearPermissionsCache(user.id, activeArtist.id);
      
      const permissions = await getUserPermissions(user.id, activeArtist.id);

      setUserPermissions(permissions);
      setPermissionsLoaded(true);
    } catch (error) {
      setUserPermissions(null);
      setPermissionsLoaded(true);
    }
  };

  // Carregar permissões quando artista mudar
  useEffect(() => {
    loadPermissions();
  }, [activeArtist]);

  // 🔥 ESCUTAR MUDANÇAS EM TEMPO REAL
  useEffect(() => {
    if (!activeArtist) return;

    const setupRealtimeListener = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const channel = supabase
        .channel(`global-permissions:${user.id}:${activeArtist.id}`)
        .on(
          'postgres_changes',
          {
            event: '*', // INSERT, UPDATE, DELETE
            schema: 'public',
            table: 'artist_members',
            filter: `user_id=eq.${user.id}`,
          },
          (payload) => {
            // Recarregar permissões quando houver mudança
            if (payload.eventType === 'UPDATE' || payload.eventType === 'INSERT') {
              const newData = payload.new as any;
              if (newData.artist_id === activeArtist.id) {
                loadPermissions();
              }
            } else if (payload.eventType === 'DELETE') {
              const oldData = payload.old as any;
              if (oldData.artist_id === activeArtist.id) {
                setUserPermissions(null);
              }
            }
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    };

    const cleanup = setupRealtimeListener();

    return () => {
      cleanup.then(cleanupFn => cleanupFn && cleanupFn());
    };
  }, [activeArtist]);

  // Helpers para verificar permissões facilmente
  // ⚠️ IMPORTANTE: Se userPermissions for null, assumir permissões COMPLETAS (owner/creator)
  // Só restringe se explicitamente tiver role definida
  const canCreateEvents = userPermissions ? userPermissions.permissions.canCreateEvents : true;
  const canEditEvents = userPermissions ? userPermissions.permissions.canEditEvents : true;
  const canDeleteEvents = userPermissions ? userPermissions.permissions.canDeleteEvents : true;
  const canViewFinancials = userPermissions ? userPermissions.permissions.canViewFinancials : true;
  const canManageMembers = userPermissions ? userPermissions.permissions.canManageMembers : true;
  const canManageArtist = userPermissions ? userPermissions.permissions.canManageArtist : true;
  const canDeleteArtist = userPermissions ? userPermissions.permissions.canDeleteArtist : true;
  
  const isViewer = userPermissions?.role === 'viewer';
  const isEditor = userPermissions?.role === 'editor';
  const isAdmin = userPermissions?.role === 'admin';
  const isOwner = userPermissions?.role === 'owner';

  return (
    <PermissionsContext.Provider
      value={{
        userPermissions,
        permissionsLoaded,
        canCreateEvents,
        canEditEvents,
        canDeleteEvents,
        canViewFinancials,
        canManageMembers,
        canManageArtist,
        canDeleteArtist,
        isViewer,
        isEditor,
        isAdmin,
        isOwner,
        reloadPermissions: loadPermissions,
      }}
    >
      {children}
    </PermissionsContext.Provider>
  );
};

export const usePermissions = () => {
  const context = useContext(PermissionsContext);
  
  if (!context) {
    throw new Error('usePermissions deve ser usado dentro de PermissionsProvider');
  }
  
  return context;
};

