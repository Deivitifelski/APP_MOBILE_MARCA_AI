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
      console.log('useActiveArtist: Iniciando carregamento do artista ativo');
      
      // Sempre obter o usuário atual primeiro
      const { user, error: userError } = await getCurrentUser();
      
      if (userError || !user) {
        console.log('useActiveArtist: Usuário não encontrado, limpando artista ativo');
        setActiveArtistState(null);
        return;
      }
      
      console.log('useActiveArtist: Usuário atual:', user.id);
      
      // Buscar artistas do usuário atual
      const { artists, error: artistsError } = await getArtists(user.id);
      
      if (artistsError) {
        console.log('useActiveArtist: Erro ao buscar artistas:', artistsError);
        setActiveArtistState(null);
        return;
      }
      
      console.log('useActiveArtist: Artistas do usuário:', artists?.length || 0);
      
      // Se não há artistas, limpar artista ativo
      if (!artists || artists.length === 0) {
        console.log('useActiveArtist: Usuário não tem artistas, limpando artista ativo');
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
          console.log('useActiveArtist: Artista salvo ainda é válido, usando dados atualizados');
          validActiveArtist = {
            id: currentArtistData.id,
            name: currentArtistData.name,
            role: currentArtistData.role || 'owner',
            profile_url: currentArtistData.profile_url
          };
          
          // Atualizar os dados salvos com as informações mais recentes
          await saveActiveArtist(validActiveArtist);
        } else {
          console.log('useActiveArtist: Artista salvo não pertence ao usuário atual, limpando');
          await clearActiveArtist();
        }
      }
      
      // Se não há artista válido salvo, NÃO selecionar automaticamente
      // Deixar null para que o usuário escolha ou seja direcionado para criar
      if (!validActiveArtist) {
        console.log('⚠️ useActiveArtist: Nenhum artista salvo válido');
        console.log('📋 Artistas disponíveis:', artists.length);
        
        // Se houver artistas mas nenhum selecionado, usuário precisa escolher
        if (artists.length > 0) {
          console.log('👤 Usuário tem artistas, mas nenhum estava selecionado');
          // Não definir nenhum automaticamente
          setActiveArtistState(null);
        } else {
          console.log('📝 Usuário não tem artistas, precisa criar');
          setActiveArtistState(null);
        }
        return;
      }
      
      console.log('✅ useActiveArtist: Artista ativo final:', validActiveArtist.name);
      setActiveArtistState(validActiveArtist);
    } catch (error) {
      console.error('Erro ao carregar artista ativo:', error);
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
      console.error('Erro ao definir artista ativo:', error);
    }
  };

  useEffect(() => {
    loadActiveArtist();
  }, []);

  // 🔥 ESCUTAR MUDANÇAS NO ROLE DO ARTISTA EM TEMPO REAL
  useEffect(() => {
    // Limpar canal anterior
    if (channelRef.current) {
      console.log('🧹 useActiveArtist: Removendo canal anterior');
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }

    if (!activeArtist) {
      console.log('🔇 useActiveArtist: Nenhum artista ativo, não criando subscription');
      return;
    }

    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        console.log('🔇 useActiveArtist: Sem usuário logado');
        return;
      }

      const channelName = `active-artist:${user.id}:${activeArtist.id}`;
      console.log('🔔 useActiveArtist: Criando subscription para:', channelName);

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
            console.log('🔔 useActiveArtist: Mudança detectada:', payload.eventType);
            
            if (payload.eventType === 'UPDATE') {
              const newData = payload.new as any;
              console.log('📝 useActiveArtist: Dados atualizados:', newData);
              
              // Se é uma atualização do artista atual
              if (newData.artist_id === activeArtist.id) {
                console.log('✅ useActiveArtist: Role mudou! Recarregando artista');
                loadActiveArtist();
              }
            } else if (payload.eventType === 'DELETE') {
              const oldData = payload.old as any;
              console.log('🗑️ useActiveArtist: Membro deletado:', oldData);
              
              // Se o usuário foi removido do artista atual
              if (oldData.artist_id === activeArtist.id) {
                console.log('⚠️ useActiveArtist: Usuário removido do artista, recarregando');
                loadActiveArtist();
              }
            }
          }
        )
        .subscribe((status) => {
          console.log('🔔 useActiveArtist: Status da subscription:', status);
        });
    })();

    return () => {
      console.log('🧹 useActiveArtist: Executando cleanup');
      if (channelRef.current) {
        console.log('🗑️ useActiveArtist: Removendo canal');
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
