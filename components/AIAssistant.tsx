
import React, { useState, useRef, useEffect } from 'react';
import { createChatSession } from '../services/geminiService';
import { Send, BrainCircuit, Bot, Loader2, Sparkles, Globe } from 'lucide-react';
import { Language } from '../types';

interface Message { role: 'user' | 'model'; text: string; }

const AIAssistant: React.FC<{ lang: Language }> = ({ lang }) => {
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [chatSession, setChatSession] = useState<any>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        // Fix: Expected 0-1 arguments, but got 2. Removed the second boolean argument.
        const session = createChatSession(lang);
        setChatSession(session);
    }, [lang]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const handleSend = async () => {
        if (!input.trim() || !chatSession) return;
        const text = input;
        setInput('');
        setMessages(prev => [...prev, { role: 'user', text }]);
        setIsLoading(true);

        try {
            const result = await chatSession.sendMessage({ message: text });
            setMessages(prev => [...prev, { role: 'model', text: result.text || '' }]);
        } catch (error) {
            setMessages(prev => [...prev, { role: 'model', text: "Error." }]);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="h-[calc(100vh-120px)] flex flex-col glass-panel rounded-[2rem] border border-[var(--border-default)] overflow-hidden shadow-2xl">
            <div className="p-6 border-b border-[var(--border-subtle)] bg-gradient-to-r from-fs-brand/10 to-transparent flex justify-between items-center">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-fs-brand flex items-center justify-center shadow-glow">
                        <Bot className="w-6 h-6 text-[var(--text-primary)]" />
                    </div>
                    <div>
                        <h3 className="text-lg font-black text-white">AI Assistant</h3>
                        <p className="text-[10px] font-extrabold text-slate-500 uppercase">Multilingual Decision Support</p>
                    </div>
                </div>
                <div className="flex items-center gap-2 px-3 py-1 bg-[var(--elevated)] rounded-lg border border-white/10 text-[10px] text-slate-400 font-bold uppercase">
                    <Globe className="w-3 h-3" /> {lang} Mode
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-[var(--deep)] scrollbar-hide">
                {messages.map((msg, idx) => (
                    <div key={idx} className={`flex gap-4 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[85%] p-5 rounded-2xl text-sm ${msg.role === 'user' ? 'bg-fs-brand text-white shadow-glow' : 'bg-[var(--surface)] border border-[var(--border-default)] text-slate-300 border border-white/5'}`}>
                            {msg.text}
                        </div>
                    </div>
                ))}
                <div ref={messagesEndRef} />
            </div>

            <div className="p-6 bg-[var(--surface)] border-t border-white/5">
                <div className="flex gap-4">
                    <input type="text" value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSend()} placeholder="Ask AI..." className="flex-1 bg-[var(--deep)] border border-white/10 rounded-2xl px-6 py-4 text-white focus:border-fs-brand outline-none" />
                    <button onClick={handleSend} disabled={isLoading} className="p-4 bg-fs-brand text-white rounded-2xl shadow-glow transition-all">{isLoading ? <Loader2 className="w-6 h-6 animate-spin" /> : <Send className="w-6 h-6" />}</button>
                </div>
            </div>
        </div>
    );
};

export default AIAssistant;
