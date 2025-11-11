import { useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import { ActiveArtist, clearActiveArtist, getActiveArtist, setActiveArtist as saveActiveArtist } from './artistContext';
import { getArtists } from './supabase/artistService';
import { getCurrentUser } from './supabase/authService';

export const useActiveArtist = () => {
  const [activeArtist, setActiveArtistState] = useState<ActiveArtist | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const channelRef = useRef<any>(null);

  const loadActiveArtist = async () => {
    try {
      setIsLoading(true);
      
      // Sempre obter o usuário atual primeiro
      const { user, error: userError } = await getCurrentUser();
      
      if (userError || !user) {
        setActiveArtistState(null);
        return;
      }
      
      // Buscar artistas do usuário atual
      const { artists, error: artistsError } = await getArtists(user.id);
      
      if (artistsError) {
        setActiveArtistState(null);
        return;
      }
      
      // Se não há artistas, limpar artista ativo
      if (!artists || artists.length === 0) {
        await clearActiveArtist();
        setActiveArtistState(null);
        return;
      }
      
      // Verificar se o artista salvo ainda é válido para este usuário
      const savedActiveArtist = await getActiveArtist();
      let validActiveArtist = null;
      
      if (savedActiveArtist) {
        // Verificar se o artista salvo ainda pertence ao usuário atual
        const currentArtistData = artists.find(artist => artist.id === savedActiveArtist.id);
        
        if (currentArtistData) {
          validActiveArtist = {
            id: currentArtistData.id,
            name: currentArtistData.name,
            role: currentArtistData.role || 'owner',
            profile_url: currentArtistData.profile_url
          };
          
          // Atualizar os dados salvos com as informações mais recentes
          await saveActiveArtist(validActiveArtist);
        } else {
          await clearActiveArtist();
        }
      }
      
      // Se não há artista válido salvo, NÃO selecionar automaticamente
      // Deixar null para que o usuário escolha ou seja direcionado para criar
      if (!validActiveArtist) {
        // Se houver artistas mas nenhum selecionado, usuário precisa escolher
        if (artists.length > 0) {
          // Não definir nenhum automaticamente
          setActiveArtistState(null);
        } else {
          setActiveArtistState(null);
        }
        return;
      }
      
      setActiveArtistState(validActiveArtist);
    } catch (error) {
      setActiveArtistState(null);
    } finally {
      setIsLoading(false);
    }
  };

  const setActiveArtist = async (artist: ActiveArtist) => {
    try {
      await saveActiveArtist(artist);
      setActiveArtistState(artist);
    } catch (error) {
      // Erro ao definir artista ativo
    }
  };

  useEffect(() => {
    loadActiveArtist();
  }, []);

  // 🔥 ESCUTAR MUDANÇAS NO ROLE DO ARTISTA EM TEMPO REAL
  useEffect(() => {
    // Limpar canal anterior
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }

    if (!activeArtist) {
      return;
    }

    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        return;
      }

      const channelName = `active-artist:${user.id}:${activeArtist.id}`;

      channelRef.current = supabase
        .channel(channelName)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'artist_members',
            filter: `user_id=eq.${user.id}`,
          },
          (payload) => {
            if (payload.eventType === 'INSERT') {
              // Novo artista criado - recarregar para atualizar lista
              loadActiveArtist();
            } else if (payload.eventType === 'UPDATE') {
              const newData = payload.new as any;
              
              // Se é uma atualização do artista atual
              if (newData.artist_id === activeArtist.id) {
                loadActiveArtist();
              }
            } else if (payload.eventType === 'DELETE') {
              const oldData = payload.old as any;
              
              // Se o usuário foi removido do artista atual
              if (oldData.artist_id === activeArtist.id) {
                loadActiveArtist();
              }
            }
          }
        )
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'artists',
          },
          (payload) => {
            // Quando um artista é atualizado (ex: nome, imagem)
            if (payload.eventType === 'UPDATE') {
              const updatedArtist = payload.new as any;
              if (activeArtist && updatedArtist.id === activeArtist.id) {
                loadActiveArtist();
              }
            }
          }
        )
        .subscribe();
    })();

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [activeArtist?.id]);

  return {
    activeArtist,
    setActiveArtist,
    loadActiveArtist,
    isLoading
  };
};
