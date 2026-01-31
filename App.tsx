
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { GeminiService, decodeAudioData } from './services/geminiService';
import { Message } from './types';
import { SILAS_SYSTEM_PROMPT } from './constants';

const App: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([
    { role: 'model', text: "I've been expecting you. Sit. Tell me what needs managing.", timestamp: new Date() }
  ]);
  const [input, setInput] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [portrait, setPortrait] = useState<string | null>(null);
  const [isSpeaking, setIsSpeaking] = useState(false);
  
  const geminiRef = useRef<GeminiService | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    geminiRef.current = new GeminiService();
    // Generate initial portrait of Silas
    geminiRef.current.generateSilasPortrait().then(url => setPortrait(url));
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const speak = useCallback(async (text: string) => {
    if (!geminiRef.current) return;
    
    setIsSpeaking(true);
    const audioData = await geminiRef.current.generateSilasSpeech(text);
    
    if (audioData) {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      }
      
      const ctx = audioContextRef.current;
      const audioBuffer = await decodeAudioData(audioData, ctx, 24000, 1);
      const source = ctx.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(ctx.destination);
      source.onended = () => setIsSpeaking(false);
      source.start();
    } else {
      setIsSpeaking(false);
    }
  }, []);

  const handleSendMessage = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!input.trim() || isGenerating || !geminiRef.current) return;

    const userMessage: Message = { role: 'user', text: input, timestamp: new Date() };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsGenerating(true);

    try {
      const history = messages.map(m => ({
        role: m.role,
        parts: [{ text: m.text }]
      }));
      
      const responseText = await geminiRef.current.generateSilasResponse(input, history);
      const modelMessage: Message = { role: 'model', text: responseText, timestamp: new Date() };
      
      setMessages(prev => [...prev, modelMessage]);
      // Silas speaks his response
      speak(responseText);
    } catch (error) {
      console.error("Failed to generate response", error);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-zinc-950 text-zinc-100 overflow-hidden">
      {/* Sidebar: The Visual Identity of Silas */}
      <div className="md:w-1/3 lg:w-1/4 border-b md:border-b-0 md:border-r border-zinc-800 bg-zinc-900/50 p-6 flex flex-col gap-6">
        <div className="flex flex-col items-center">
          <div className="relative group">
            <div className="absolute -inset-1 bg-gradient-to-r from-amber-600 to-zinc-800 rounded-lg blur opacity-25 group-hover:opacity-40 transition duration-1000"></div>
            <div className="relative w-full aspect-[3/4] bg-zinc-800 rounded-lg overflow-hidden border border-zinc-700 shadow-2xl">
              {portrait ? (
                <img src={portrait} alt="Silas Crowe" className="w-full h-full object-cover grayscale hover:grayscale-0 transition-all duration-700" />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <div className="animate-pulse text-zinc-600 italic">Materializing...</div>
                </div>
              )}
            </div>
          </div>
          <h1 className="mt-6 text-3xl font-light tracking-widest text-zinc-200">SILAS CROWE</h1>
          <p className="text-amber-600/70 text-sm tracking-tighter uppercase mb-4">Strategic Consultant</p>
        </div>

        <div className="flex-1 space-y-6 text-sm text-zinc-400 font-light leading-relaxed">
          <div className="p-4 border-l border-amber-900/50 bg-zinc-800/20 italic">
            "Chaos isn't random. It's just badly managed."
          </div>
          
          <div className="space-y-4">
            <h3 className="text-zinc-500 uppercase text-xs tracking-[0.2em]">Operational Code</h3>
            <ul className="space-y-2">
              <li className="flex gap-3"><span className="text-amber-900">01</span> Never explains twice.</li>
              <li className="flex gap-3"><span className="text-amber-900">02</span> No wasted movement.</li>
              <li className="flex gap-3"><span className="text-amber-900">03</span> Leverage is the only currency.</li>
            </ul>
          </div>
        </div>

        <div className="pt-6 border-t border-zinc-800 flex items-center gap-3">
          <div className={`w-3 h-3 rounded-full ${isSpeaking ? 'bg-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.5)] animate-pulse' : 'bg-zinc-700'}`}></div>
          <span className="text-xs uppercase tracking-widest text-zinc-500">{isSpeaking ? 'Direct Link Active' : 'Standby'}</span>
        </div>
      </div>

      {/* Main Content: The Strategy Room */}
      <main className="flex-1 flex flex-col relative">
        <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-20">
          <div className="absolute top-0 right-0 w-96 h-96 bg-amber-900/20 blur-[120px] rounded-full"></div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 md:p-12 custom-scrollbar">
          <div className="max-w-3xl mx-auto space-y-8 pb-12">
            {messages.map((msg, idx) => (
              <div 
                key={idx} 
                className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'} fade-in`}
              >
                <div 
                  className={`max-w-[85%] px-6 py-4 rounded-xl text-lg font-light leading-relaxed whitespace-pre-wrap
                    ${msg.role === 'user' 
                      ? 'bg-zinc-800/40 text-zinc-300 border border-zinc-700/50' 
                      : 'text-zinc-100 italic serif border-l-2 border-amber-800 pl-8'}`}
                >
                  {msg.text}
                </div>
                <span className="mt-2 text-[10px] uppercase tracking-widest text-zinc-600 font-medium">
                  {msg.role === 'user' ? 'Inquirer' : 'Crowe'} • {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            ))}
            {isGenerating && (
              <div className="flex flex-col items-start animate-pulse">
                <div className="w-12 h-0.5 bg-amber-900/50 mb-4"></div>
                <div className="text-zinc-600 text-sm tracking-widest uppercase">Calculating variables...</div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>
        </div>

        {/* Input: The Negotiation Bar */}
        <div className="p-6 md:p-12 bg-gradient-to-t from-zinc-950 via-zinc-950 to-transparent">
          <form 
            onSubmit={handleSendMessage}
            className="max-w-3xl mx-auto relative group"
          >
            <input 
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="State your business..."
              className="w-full bg-zinc-900/50 border border-zinc-800 px-8 py-5 rounded-full text-zinc-200 placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-amber-900/50 transition-all text-lg font-light shadow-xl"
              disabled={isGenerating}
            />
            <button 
              type="submit"
              disabled={isGenerating || !input.trim()}
              className="absolute right-3 top-1/2 -translate-y-1/2 bg-zinc-100 text-zinc-950 px-6 py-2 rounded-full font-medium text-sm hover:bg-amber-500 transition-colors disabled:opacity-30 disabled:hover:bg-zinc-100"
            >
              Consult
            </button>
          </form>
          <p className="mt-4 text-center text-[10px] uppercase tracking-[0.3em] text-zinc-700">
            Confidentiality Guaranteed. All interactions are final.
          </p>
        </div>
      </main>
    </div>
  );
};

export default App;
