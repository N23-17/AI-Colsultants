
export interface Message {
  role: 'user' | 'model';
  text: string;
  timestamp: Date;
}

export interface SilasState {
  isGenerating: boolean;
  isSpeaking: boolean;
  messages: Message[];
  imageUrl: string | null;
}
