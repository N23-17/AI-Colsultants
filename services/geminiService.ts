
import { GoogleGenAI, Modality } from "@google/genai";
import { SILAS_SYSTEM_PROMPT, MODEL_NAME, IMAGE_MODEL, TTS_MODEL } from "../constants";

export class GeminiService {
  private ai: GoogleGenAI;

  constructor() {
    this.ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });
  }

  async generateSilasResponse(message: string, history: { role: 'user' | 'model', parts: { text: string }[] }[]) {
    const chat = this.ai.chats.create({
      model: MODEL_NAME,
      config: {
        systemInstruction: SILAS_SYSTEM_PROMPT,
        temperature: 0.7,
        topP: 0.95,
      }
    });

    const response = await chat.sendMessage({ message });
    return response.text;
  }

  async generateSilasPortrait() {
    const prompt = "A hyper-realistic cinematic portrait of Silas Crowe, an elite underground strategist. He is in his 40s, wearing a bespoke obsidian-black charcoal suit, sharp features, calm yet dangerous eyes. Setting: A dimly lit luxury lounge with subtle smoke and amber lighting. Expensive aesthetic, noir atmosphere.";
    
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

  async generateSilasSpeech(text: string): Promise<Uint8Array | null> {
    try {
      // Prompt for TTS needs to include stylistic cues
      const ttsPrompt = `Speak low, slow, and with controlled authority: ${text}`;
      
      const response = await this.ai.models.generateContent({
        model: TTS_MODEL,
        contents: [{ parts: [{ text: ttsPrompt }] }],
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: 'Fenrir' } // Fenrir is a deep, authoritative voice
            }
          }
        }
      });

      const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (base64Audio) {
        return this.decodeBase64(base64Audio);
      }
      return null;
    } catch (error) {
      console.error("Speech generation failed", error);
      return null;
    }
  }

  private decodeBase64(base64: string): Uint8Array {
    const binaryString = atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
  }
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
