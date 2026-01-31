
import { GoogleGenAI, Modality, LiveServerMessage } from "@google/genai";
import { SILAS_SYSTEM_PROMPT, CHAT_MODEL, IMAGE_MODEL, LIVE_MODEL } from "../constants";

export class GeminiService {
  private ai: GoogleGenAI;

  constructor() {
    this.ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });
  }

  async generateSilasResponse(message: string, history: any[]) {
    const chat = this.ai.chats.create({
      model: CHAT_MODEL,
      config: {
        systemInstruction: SILAS_SYSTEM_PROMPT,
        temperature: 0.8,
        topP: 0.95,
      }
    });

    const response = await chat.sendMessage({ message });
    return response.text;
  }

  async generateSilasPortrait() {
    const prompt = "A hyper-realistic cinematic portrait of Silas Crowe, elite underground strategist, mid-40s. He wears a bespoke obsidian charcoal coat. Sharp features, calm, dangerous amber-glinting eyes. Setting: A rainy, neon-blurred city night viewed from a shadowed, minimalist luxury balcony. Moody noir lighting, smoke-drifts, cinematic depth of field.";
    
    const response = await this.ai.models.generateContent({
      model: IMAGE_MODEL,
      contents: { parts: [{ text: prompt }] },
      config: {
        imageConfig: { aspectRatio: "3:4" }
      }
    });

    for (const part of response.candidates[0].content.parts) {
      if (part.inlineData) {
        return `data:image/png;base64,${part.inlineData.data}`;
      }
    }
    return null;
  }

  connectLive(callbacks: {
    onAudio: (base64: string) => void;
    onInterrupted: () => void;
    onTranscription: (text: string, isUser: boolean) => void;
  }) {
    return this.ai.live.connect({
      model: LIVE_MODEL,
      callbacks: {
        onopen: () => console.log('Silas: Connection established.'),
        onmessage: async (message: LiveServerMessage) => {
          if (message.serverContent?.modelTurn?.parts[0]?.inlineData?.data) {
            callbacks.onAudio(message.serverContent.modelTurn.parts[0].inlineData.data);
          }
          if (message.serverContent?.interrupted) {
            callbacks.onInterrupted();
          }
          if (message.serverContent?.outputTranscription) {
            callbacks.onTranscription(message.serverContent.outputTranscription.text, false);
          }
          if (message.serverContent?.inputTranscription) {
            callbacks.onTranscription(message.serverContent.inputTranscription.text, true);
          }
        },
        onerror: (e) => console.error('Silas: Connection error.', e),
        onclose: () => console.log('Silas: Connection closed.')
      },
      config: {
        systemInstruction: SILAS_SYSTEM_PROMPT + "\nSpeak with absolute authority and deliberate pace. Use the canon phrases.",
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Fenrir' } }
        },
        inputAudioTranscription: {},
        outputAudioTranscription: {}
      }
    });
  }
}

// Utility functions for audio
export function decode(base64: string) {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

export async function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number,
  numChannels: number,
): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}

export function encode(bytes: Uint8Array) {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}
