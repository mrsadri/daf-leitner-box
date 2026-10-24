/**
 * Speech Synthesis Service for German word and phrase pronunciation
 */

class SpeechService {
  private synth: SpeechSynthesis | null = null;
  private germanVoice: SpeechSynthesisVoice | null = null;

  constructor() {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      this.synth = window.speechSynthesis;
      this.loadVoice();
      if (speechSynthesis.onvoiceschanged !== undefined) {
        speechSynthesis.onvoiceschanged = () => this.loadVoice();
      }
    }
  }

  private loadVoice() {
    if (!this.synth) return;
    const voices = this.synth.getVoices();
    // Prefer German voices (de-DE, de-AT, etc.)
    const deVoice = voices.find(v => v.lang.startsWith('de') || v.lang.includes('DE'));
    if (deVoice) {
      this.germanVoice = deVoice;
    }
  }

  public speak(text: string, rate: number = 0.9): Promise<void> {
    return new Promise((resolve) => {
      if (!this.synth || !text) {
        resolve();
        return;
      }

      try {
        // Cancel ongoing speech
        this.synth.cancel();

        // Clean text (remove Persian translations if combined)
        const cleanText = text.split('·')[0].split('/')[0].trim();

        const utterance = new SpeechSynthesisUtterance(cleanText);
        utterance.lang = 'de-DE';
        utterance.rate = rate;
        utterance.pitch = 1.0;

        if (this.germanVoice) {
          utterance.voice = this.germanVoice;
        }

        utterance.onend = () => resolve();
        utterance.onerror = () => resolve();

        this.synth.speak(utterance);
      } catch {
        resolve();
      }
    });
  }

  public isSupported(): boolean {
    return typeof window !== 'undefined' && 'speechSynthesis' in window;
  }
}

export const speechService = new SpeechService();
