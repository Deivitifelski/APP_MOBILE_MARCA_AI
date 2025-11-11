import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { getActiveArtist, setActiveArtist as saveToStorage, clearActiveArtist } from '../services/artistContext';
import { getArtistById } from '../services/supabase/artistService';
import { getCurrentUser } from '../services/supabase/authService';

export interface ActiveArtist {
  id: string;
  name: string;
  role: string;
  profile_url?: string;
}

interface ActiveArtistContextData {
  activeArtist: ActiveArtist | null;
  isLoading: boolean;
  setActiveArtist: (artist: ActiveArtist) => Promise<void>;
  refreshActiveArtist: () => Promise<void>;
  clearArtist: () => Promise<void>;
}

const ActiveArtistContext = createContext<ActiveArtistContextData>({} as ActiveArtistContextData);

export const ActiveArtistProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [activeArtist, setActiveArtistState] = useState<ActiveArtist | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const channelRef = useRef<any>(null);
  const artistIdRef = useRef<string | null>(null);

  // Carregar artista do AsyncStorage na inicialização
  useEffect(() => {
    loadArtistFromStorage();
  }, []);

  // Configurar realtime quando artista mudar
  useEffect(() => {
    if (activeArtist) {
      artistIdRef.current = activeArtist.id;
      setupRealtime();
    } else {
      artistIdRef.current = null;
      cleanupRealtime();
    }

    return () => {
      cleanupRealtime();
    };
  }, [activeArtist?.id]);

  const loadArtistFromStorage = async () => {
    try {
      setIsLoading(true);
      const saved = await getActiveArtist();
      
      if (saved) {
        // Validar se o artista ainda existe no banco
        const { artist, error } = await getArtistById(saved.id);
        
        if (!error && artist) {
          // Artista válido, usar dados do AsyncStorage (mais recentes)
          setActiveArtistState(saved);
        } else {
          // Artista não existe mais, limpar
          await clearActiveArtist();
          setActiveArtistState(null);
        }
      } else {
        setActiveArtistState(null);
      }
    } catch (error) {
      setActiveArtistState(null);
    } finally {
      setIsLoading(false);
    }
  };

  const setActiveArtist = async (artist: ActiveArtist) => {
    try {
      // 1. Salvar no AsyncStorage
      await saveToStorage(artist);
      
      // 2. Atualizar estado imediatamente
      setActiveArtistState(artist);
      artistIdRef.current = artist.id;
    } catch (error) {
      // Erro ao definir artista
    }
  };

  const refreshActiveArtist = async () => {
    try {
      const saved = await getActiveArtist();
      if (!saved) return;

      // Buscar dados atualizados do banco
      const { artist, error } = await getArtistById(saved.id);
      
      if (!error && artist) {
        // Atualizar apenas se o ID for o mesmo (garantir que não troca)
        if (artistIdRef.current === artist.id) {
          const updatedArtist: ActiveArtist = {
            id: artist.id,
            name: artist.name,
            role: saved.role, // Manter role do AsyncStorage
            profile_url: artist.profile_url
          };
          
          await saveToStorage(updatedArtist);
          setActiveArtistState(updatedArtist);
        }
      }
    } catch (error) {
      // Erro ao atualizar
    }
  };

  const clearArtist = async () => {
    try {
      await clearActiveArtist();
      setActiveArtistState(null);
      artistIdRef.current = null;
    } catch (error) {
      // Erro ao limpar
    }
  };

  const setupRealtime = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !activeArtist) return;

      // Limpar canal anterior
      if (channelRef.current) {
        await supabase.removeChannel(channelRef.current);
      }

      const channelName = `artist-updates-${user.id}-${activeArtist.id}-${Date.now()}`;

      channelRef.current = supabase
        .channel(channelName)
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'artists',
            filter: `id=eq.${activeArtist.id}`,
          },
          async (payload) => {
            const updated = payload.new as any;
            
            // Apenas atualizar se for o mesmo artista ativo
            if (artistIdRef.current === updated.id) {
              const saved = await getActiveArtist();
              if (saved && saved.id === updated.id) {
                const updatedArtist: ActiveArtist = {
                  id: updated.id,
                  name: updated.name,
                  role: saved.role,
                  profile_url: updated.profile_url
                };
                
                await saveToStorage(updatedArtist);
                setActiveArtistState(updatedArtist);
              }
            }
          }
        )
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'artist_members',
            filter: `user_id=eq.${user.id}`,
          },
          async (payload) => {
            const updated = payload.new as any;
            
            // Atualizar role se mudou
            if (artistIdRef.current === updated.artist_id) {
              const saved = await getActiveArtist();
              if (saved && saved.id === updated.artist_id) {
                const updatedArtist: ActiveArtist = {
                  ...saved,
                  role: updated.role
                };
                
                await saveToStorage(updatedArtist);
                setActiveArtistState(updatedArtist);
              }
            }
          }
        )
        .on(
          'postgres_changes',
          {
            event: 'DELETE',
            schema: 'public',
            table: 'artist_members',
            filter: `user_id=eq.${user.id}`,
          },
          async (payload) => {
            const deleted = payload.old as any;
            
            // Se removido do artista atual, limpar
            if (artistIdRef.current === deleted.artist_id) {
              await clearArtist();
            }
          }
        )
        .subscribe();
    } catch (error) {
      // Erro ao configurar realtime
    }
  };

  const cleanupRealtime = async () => {
    if (channelRef.current) {
      await supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }
  };

  return (
    <ActiveArtistContext.Provider
      value={{
        activeArtist,
        isLoading,
        setActiveArtist,
        refreshActiveArtist,
        clearArtist,
      }}
    >
      {children}
    </ActiveArtistContext.Provider>
  );
};

export const useActiveArtistContext = () => {
  const context = useContext(ActiveArtistContext);
  
  if (!context) {
    throw new Error('useActiveArtistContext deve ser usado dentro de ActiveArtistProvider');
  }
  
  return context;
};

