// Implementação simples de EventEmitter para React Native
type EventCallback = (data: { artistId: string; newImageUrl: string }) => void;

class SimpleEventEmitter {
  private events: { [key: string]: EventCallback[] } = {};

  on(event: string, callback: EventCallback) {
    if (!this.events[event]) {
      this.events[event] = [];
    }
    this.events[event].push(callback);
  }

  emit(event: string, data: { artistId: string; newImageUrl: string }) {
    if (this.events[event]) {
      this.events[event].forEach(callback => callback(data));
    }
  }

  removeListener(event: string, callback: EventCallback) {
    if (this.events[event]) {
      this.events[event] = this.events[event].filter(cb => cb !== callback);
    }
  }
}

class ArtistImageUpdateService extends SimpleEventEmitter {
  private static instance: ArtistImageUpdateService;

  private constructor() {
    super();
  }

  public static getInstance(): ArtistImageUpdateService {
    if (!ArtistImageUpdateService.instance) {
      ArtistImageUpdateService.instance = new ArtistImageUpdateService();
    }
    return ArtistImageUpdateService.instance;
  }

  // Notificar que a imagem do artista foi atualizada
  public notifyArtistImageUpdated(artistId: string, newImageUrl: string) {
    this.emit('artistImageUpdated', { artistId, newImageUrl });
  }

  // Escutar atualizações da imagem do artista
  public onArtistImageUpdated(callback: (data: { artistId: string; newImageUrl: string }) => void) {
    this.on('artistImageUpdated', callback);
  }

  // Remover listener
  public removeArtistImageUpdatedListener(callback: (data: { artistId: string; newImageUrl: string }) => void) {
    this.removeListener('artistImageUpdated', callback);
  }
}

export const artistImageUpdateService = ArtistImageUpdateService.getInstance();
