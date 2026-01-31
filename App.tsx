
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { GeminiService, decode, decodeAudioData, encode } from './services/geminiService';
import { Message } from './types';

const App: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([
    { role: 'model', text: "I've been expecting you. Sit. Tell me what needs managing.", timestamp: new Date() }
  ]);
  const [input, setInput] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [portrait, setPortrait] = useState<string | null>(null);
  const [isLive, setIsLive] = useState(false);
  const [liveTranscript, setLiveTranscript] = useState('');
  
  const geminiRef = useRef<GeminiService | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const liveSessionRef = useRef<any>(null);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const nextStartTimeRef = useRef<number>(0);

  useEffect(() => {
    geminiRef.current = new GeminiService();
    geminiRef.current.generateSilasPortrait().then(url => setPortrait(url));
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const startLiveSession = async () => {
    if (isLive || !geminiRef.current) return;

    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      audioContextRef.current = audioCtx;
      
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const inputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      
      const sessionPromise = geminiRef.current.connectLive({
        onAudio: async (base64) => {
          const buffer = await decodeAudioData(decode(base64), audioCtx, 24000, 1);
          const source = audioCtx.createBufferSource();
          source.buffer = buffer;
          source.connect(audioCtx.destination);
          
          nextStartTimeRef.current = Math.max(nextStartTimeRef.current, audioCtx.currentTime);
          source.start(nextStartTimeRef.current);
          nextStartTimeRef.current += buffer.duration;
          
          sourcesRef.current.add(source);
          source.onended = () => sourcesRef.current.delete(source);
        },
        onInterrupted: () => {
          sourcesRef.current.forEach(s => s.stop());
          sourcesRef.current.clear();
          nextStartTimeRef.current = 0;
        },
        onTranscription: (text, isUser) => {
          if (!isUser) {
             setMessages(prev => {
               const last = prev[prev.length - 1];
               if (last && last.role === 'model' && last.text.length < 500) {
                 return [...prev.slice(0, -1), { ...last, text: last.text + ' ' + text }];
               }
               return [...prev, { role: 'model', text, timestamp: new Date() }];
             });
          }
        }
      });

      sessionPromise.then(session => {
        liveSessionRef.current = session;
        const source = inputCtx.createMediaStreamSource(stream);
        const scriptProcessor = inputCtx.createScriptProcessor(4096, 1, 1);
        
        scriptProcessor.onaudioprocess = (e) => {
          const inputData = e.inputBuffer.getChannelData(0);
          const int16 = new Int16Array(inputData.length);
          for (let i = 0; i < inputData.length; i++) {
            int16[i] = inputData[i] * 32768;
          }
          const pcmBlob = {
            data: encode(new Uint8Array(int16.buffer)),
            mimeType: 'audio/pcm;rate=16000',
          };
          session.sendRealtimeInput({ media: pcmBlob });
        };

        source.connect(scriptProcessor);
        scriptProcessor.connect(inputCtx.destination);
        setIsLive(true);
      });

    } catch (err) {
      console.error("Live failed", err);
    }
  };

  const stopLiveSession = () => {
    liveSessionRef.current?.close();
    liveSessionRef.current = null;
    setIsLive(false);
  };

  const handleSendMessage = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!input.trim() || isGenerating || isLive || !geminiRef.current) return;

    const userMessage: Message = { role: 'user', text: input, timestamp: new Date() };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsGenerating(true);

    try {
      const responseText = await geminiRef.current.generateSilasResponse(input, []);
      setMessages(prev => [...prev, { role: 'model', text: responseText, timestamp: new Date() }]);
    } catch (error) {
      console.error(error);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-[#050505] text-zinc-100 relative z-10 overflow-hidden">
      {/* Sidebar */}
      <div className="md:w-1/3 lg:w-1/4 border-b md:border-b-0 md:border-r border-zinc-900 bg-black/40 backdrop-blur-sm p-8 flex flex-col gap-8 z-20">
        <div className="flex flex-col items-center">
          <div className="relative group w-full max-w-[240px]">
            <div className="absolute -inset-1 bg-amber-900/20 rounded-lg blur-lg group-hover:bg-amber-800/30 transition-all"></div>
            <div className="relative aspect-[3/4] bg-zinc-900 rounded-lg overflow-hidden border border-zinc-800 shadow-2xl">
              {portrait ? (
                <img src={portrait} alt="Silas Crowe" className="w-full h-full object-cover grayscale opacity-80 group-hover:opacity-100 group-hover:grayscale-0 transition-all duration-1000" />
              ) : (
                <div className="w-full h-full flex items-center justify-center animate-pulse italic text-zinc-700">Emerging from shadows...</div>
              )}
            </div>
          </div>
          <h1 className="mt-8 text-4xl font-light tracking-[0.2em] text-zinc-300 serif">SILAS CROWE</h1>
          <div className="w-12 h-[1px] bg-amber-900/50 my-4"></div>
          <p className="text-zinc-500 text-[10px] tracking-[0.4em] uppercase">Private Liquidation Agent</p>
        </div>

        <div className="flex-1 space-y-8 text-sm text-zinc-500 font-light leading-relaxed serif italic">
          <p className="border-l border-amber-900/30 pl-4 py-2 text-zinc-400">
            "The truth is rarely useful. Leverage, on the other hand, moves mountains."
          </p>
          
          <div className="space-y-4">
            <h3 className="text-zinc-600 uppercase text-[9px] tracking-[0.3em] font-bold">Operational Protocol</h3>
            <ul className="space-y-3 text-[12px] tracking-wide font-sans not-italic">
              <li className="flex items-start gap-4">
                <span className="text-amber-900 font-mono">I.</span> 
                <span>Listen for what isn't said.</span>
              </li>
              <li className="flex items-start gap-4">
                <span className="text-amber-900 font-mono">II.</span> 
                <span>Move only when the finish line is visible.</span>
              </li>
              <li className="flex items-start gap-4">
                <span className="text-amber-900 font-mono">III.</span> 
                <span>Assume every room is compromised.</span>
              </li>
            </ul>
          </div>
        </div>

        <button 
          onClick={isLive ? stopLiveSession : startLiveSession}
          className={`flex items-center justify-between w-full px-4 py-3 rounded border transition-all duration-500
            ${isLive 
              ? 'border-amber-600 bg-amber-950/20 text-amber-500 shadow-[0_0_20px_rgba(146,64,14,0.1)]' 
              : 'border-zinc-800 hover:border-zinc-700 bg-zinc-900/30 text-zinc-500'}`}
        >
          <div className="flex items-center gap-3">
            <div className={`w-2 h-2 rounded-full ${isLive ? 'bg-amber-500 animate-ping' : 'bg-zinc-700'}`}></div>
            <span className="text-[10px] uppercase tracking-[0.2em] font-medium">
              {isLive ? 'Link Active' : 'Establish Link'}
            </span>
          </div>
          <span className="text-[10px] opacity-40">● PCM-V2</span>
        </button>
      </div>

      {/* Main Chat */}
      <main className="flex-1 flex flex-col relative z-20">
        <div className="flex-1 overflow-y-auto p-8 md:p-16 custom-scrollbar bg-gradient-to-br from-black to-zinc-950/40">
          <div className="max-w-3xl mx-auto space-y-12">
            {messages.map((msg, idx) => (
              <div key={idx} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'} fade-in`}>
                <div className={`max-w-[90%] px-0 py-2 text-xl font-light leading-relaxed
                    ${msg.role === 'user' 
                      ? 'text-zinc-400 font-sans' 
                      : 'text-zinc-200 serif italic border-l border-amber-900/40 pl-8 ml-2'}`}>
                  {msg.text}
                </div>
                <div className="mt-4 flex items-center gap-3 opacity-20 hover:opacity-100 transition-opacity">
                   <div className="h-[1px] w-4 bg-zinc-700"></div>
                   <span className="text-[9px] uppercase tracking-[0.3em] font-medium text-zinc-500">
                    {msg.role === 'user' ? 'Interrogative' : 'Response Unit'} • {msg.timestamp.toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit' })}
                   </span>
                </div>
              </div>
            ))}
            {isGenerating && (
              <div className="flex items-center gap-4 text-zinc-700 text-[10px] tracking-[0.4em] uppercase">
                <div className="w-1 h-1 bg-amber-900 rounded-full animate-bounce"></div>
                Analyzing Variables
              </div>
            )}
            <div ref={chatEndRef} />
          </div>
        </div>

        {/* Text Input */}
        {!isLive && (
          <div className="p-8 md:p-16 border-t border-zinc-900/50 bg-black/40">
            <form onSubmit={handleSendMessage} className="max-w-3xl mx-auto relative">
              <input 
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="State your business..."
                className="w-full bg-transparent border-b border-zinc-800 py-4 text-zinc-300 placeholder-zinc-700 focus:outline-none focus:border-amber-900/50 transition-all text-lg font-light serif"
                disabled={isGenerating}
              />
              <button 
                type="submit"
                disabled={isGenerating || !input.trim()}
                className="absolute right-0 bottom-4 text-zinc-500 hover:text-amber-600 transition-colors uppercase text-[10px] tracking-[0.2em] font-bold disabled:opacity-0"
              >
                Transmit
              </button>
            </form>
          </div>
        )}

        {/* Live Audio Visualizer Overlay (simplified indicator) */}
        {isLive && (
          <div className="p-12 border-t border-zinc-900/50 bg-black/40 flex flex-col items-center">
             <div className="flex gap-1 items-end h-8 mb-4">
                {[...Array(20)].map((_, i) => (
                  <div 
                    key={i} 
                    className="w-[2px] bg-amber-600 opacity-50"
                    style={{ 
                      height: `${10 + Math.random() * 20}px`,
                      animation: `pulse ${0.5 + Math.random()}s infinite alternate`
                    }}
                  ></div>
                ))}
             </div>
             <p className="text-[10px] tracking-[0.5em] uppercase text-amber-700 animate-pulse font-bold">
               Direct Audio Feed Active
             </p>
          </div>
        )}
      </main>

      <style>{`
        @keyframes pulse {
          from { opacity: 0.2; transform: scaleY(0.5); }
          to { opacity: 0.8; transform: scaleY(1.5); }
        }
      `}</style>
    </div>
  );
};

export default App;
