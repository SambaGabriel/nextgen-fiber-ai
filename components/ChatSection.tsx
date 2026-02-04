/**
 * ChatSection - AI Supervisor Chat for Job Details
 * Powered by Claude AI with expertise in NESC 232, field operations, and safety
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Send, Wifi, WifiOff, AlertCircle, RefreshCw, Bot, User, Sparkles } from 'lucide-react';
import { Job, JobChatMessage } from '../types/project';
import { chatStorage } from '../services/chatStorage';
import { createSupervisorSession } from '../services/aiSupervisorService';
import { Language } from '../types';

interface ChatSectionProps {
  jobId: string;
  job: Job | null;
  userId: string;
  userName: string;
  userRole: 'LINEMAN' | 'ADMIN';
  lang: Language;
}

const translations = {
  EN: {
    title: 'AI Supervisor',
    subtitle: 'Expert in NESC 232, Safety & Field Operations',
    placeholder: 'Ask about safety, clearances, procedures...',
    send: 'Send',
    thinking: 'Thinking...',
    offline: 'Offline - Messages will be sent when connected',
    error: 'Error sending message. Tap to retry.',
    welcome: 'Hello! I\'m your AI Field Supervisor. I can help you with:\n\n• NESC 232 clearance requirements\n• Safety protocols and PPE\n• Installation techniques\n• Troubleshooting field problems\n• Quality standards\n\nHow can I assist you today?',
    poweredBy: 'Powered by Claude AI',
  },
  PT: {
    title: 'Supervisor IA',
    subtitle: 'Especialista em NESC 232, Segurança e Operações de Campo',
    placeholder: 'Pergunte sobre segurança, folgas, procedimentos...',
    send: 'Enviar',
    thinking: 'Pensando...',
    offline: 'Offline - Mensagens serão enviadas quando conectar',
    error: 'Erro ao enviar. Toque para tentar novamente.',
    welcome: 'Olá! Sou seu Supervisor de Campo IA. Posso ajudar com:\n\n• Requisitos de folga NESC 232\n• Protocolos de segurança e EPI\n• Técnicas de instalação\n• Resolução de problemas em campo\n• Padrões de qualidade\n\nComo posso ajudá-lo hoje?',
    poweredBy: 'Powered by Claude AI',
  },
  ES: {
    title: 'Supervisor IA',
    subtitle: 'Experto en NESC 232, Seguridad y Operaciones de Campo',
    placeholder: 'Pregunta sobre seguridad, distancias, procedimientos...',
    send: 'Enviar',
    thinking: 'Pensando...',
    offline: 'Sin conexión - Los mensajes se enviarán cuando conecte',
    error: 'Error al enviar. Toca para reintentar.',
    welcome: '¡Hola! Soy tu Supervisor de Campo IA. Puedo ayudarte con:\n\n• Requisitos de distancia NESC 232\n• Protocolos de seguridad y EPP\n• Técnicas de instalación\n• Resolución de problemas en campo\n• Estándares de calidad\n\n¿Cómo puedo ayudarte hoy?',
    poweredBy: 'Powered by Claude AI',
  }
};

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  status?: 'sending' | 'sent' | 'error';
}

const formatTime = (dateStr: string): string => {
  return new Date(dateStr).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

const ChatSection: React.FC<ChatSectionProps> = ({
  jobId,
  job,
  userId,
  userName,
  userRole,
  lang
}) => {
  const t = translations[lang] || translations.EN;
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isLoading, setIsLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const supervisorSessionRef = useRef<ReturnType<typeof createSupervisorSession> | null>(null);

  // Initialize supervisor session
  useEffect(() => {
    supervisorSessionRef.current = createSupervisorSession(jobId, job, lang);

    // Load existing conversation from session
    const history = supervisorSessionRef.current.getHistory();
    if (history.length > 0) {
      setMessages(history.map((msg, idx) => ({
        id: `${jobId}-${idx}`,
        role: msg.role,
        content: msg.content,
        timestamp: new Date().toISOString(),
        status: 'sent' as const
      })));
    } else {
      // Show welcome message
      setMessages([{
        id: 'welcome',
        role: 'assistant',
        content: t.welcome,
        timestamp: new Date().toISOString(),
        status: 'sent'
      }]);
    }
    setIsLoading(false);
  }, [jobId, job, lang, t.welcome]);

  // Scroll to bottom
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // Online/offline detection
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Send message handler
  const handleSend = useCallback(async () => {
    const text = inputText.trim();
    if (!text || isSending || !isOnline) return;

    const userMessageId = `user-${Date.now()}`;
    const userMessage: ChatMessage = {
      id: userMessageId,
      role: 'user',
      content: text,
      timestamp: new Date().toISOString(),
      status: 'sent'
    };

    setMessages(prev => [...prev, userMessage]);
    setInputText('');
    setIsSending(true);

    // Add thinking indicator
    const thinkingId = `thinking-${Date.now()}`;
    setMessages(prev => [...prev, {
      id: thinkingId,
      role: 'assistant',
      content: t.thinking,
      timestamp: new Date().toISOString(),
      status: 'sending'
    }]);

    try {
      if (!supervisorSessionRef.current) {
        supervisorSessionRef.current = createSupervisorSession(jobId, job, lang);
      }

      const response = await supervisorSessionRef.current.sendMessage(text);

      // Replace thinking with actual response
      setMessages(prev => prev.map(msg =>
        msg.id === thinkingId
          ? { ...msg, id: `assistant-${Date.now()}`, content: response, status: 'sent' as const }
          : msg
      ));

      // Also save to local storage for persistence
      chatStorage.saveMessage({
        jobId,
        senderUserId: userId,
        senderName: userName,
        senderRole: userRole,
        body: text,
        clientMessageId: userMessageId
      });

    } catch (error) {
      console.error('[ChatSection] Error sending message:', error);
      // Replace thinking with error
      setMessages(prev => prev.map(msg =>
        msg.id === thinkingId
          ? { ...msg, content: t.error, status: 'error' as const }
          : msg
      ));
    } finally {
      setIsSending(false);
      inputRef.current?.focus();
    }
  }, [inputText, isSending, isOnline, jobId, job, lang, userId, userName, userRole, t.thinking, t.error]);

  // Handle Enter key
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex flex-col bg-slate-900/50 rounded-xl sm:rounded-2xl border border-white/10 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 bg-gradient-to-r from-blue-600/20 to-purple-600/20">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
            <Bot className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              {t.title}
              <Sparkles className="w-4 h-4 text-yellow-400" />
            </h3>
            <p className="text-[10px] text-slate-400">{t.subtitle}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isOnline ? (
            <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-emerald-500/20">
              <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-[10px] font-bold text-emerald-400">Online</span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-amber-500/20">
              <WifiOff className="w-3 h-3 text-amber-400" />
              <span className="text-[10px] font-bold text-amber-400">Offline</span>
            </div>
          )}
        </div>
      </div>

      {/* Offline banner */}
      {!isOnline && (
        <div className="px-4 py-2 bg-amber-500/10 border-b border-amber-500/20">
          <p className="text-xs text-amber-400">{t.offline}</p>
        </div>
      )}

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-[300px] max-h-[500px]">
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <RefreshCw className="w-6 h-6 text-slate-500 animate-spin" />
          </div>
        ) : (
          messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div className={`flex gap-2 max-w-[85%] ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                {/* Avatar */}
                <div className={`flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center ${
                  msg.role === 'user'
                    ? 'bg-blue-600'
                    : 'bg-gradient-to-br from-blue-500 to-purple-600'
                }`}>
                  {msg.role === 'user' ? (
                    <User className="w-4 h-4 text-white" />
                  ) : (
                    <Bot className="w-4 h-4 text-white" />
                  )}
                </div>

                {/* Message bubble */}
                <div
                  className={`rounded-2xl px-4 py-3 ${
                    msg.role === 'user'
                      ? 'bg-blue-600 text-white rounded-br-md'
                      : 'bg-slate-800/80 text-slate-200 rounded-bl-md border border-white/5'
                  } ${msg.status === 'sending' ? 'opacity-70' : ''}`}
                >
                  {/* Message content */}
                  <div className={`text-sm whitespace-pre-wrap break-words ${
                    msg.status === 'sending' ? 'flex items-center gap-2' : ''
                  }`}>
                    {msg.status === 'sending' && (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    )}
                    {msg.content}
                  </div>

                  {/* Time and status */}
                  <div className={`flex items-center gap-2 mt-2 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <span className={`text-[10px] ${msg.role === 'user' ? 'text-blue-200' : 'text-slate-500'}`}>
                      {formatTime(msg.timestamp)}
                    </span>
                    {msg.status === 'error' && (
                      <AlertCircle className="w-3 h-3 text-red-400" />
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Powered by badge */}
      <div className="px-4 py-1 border-t border-white/5 bg-slate-900/30">
        <p className="text-[9px] text-slate-600 text-center flex items-center justify-center gap-1">
          <Sparkles className="w-3 h-3" />
          {t.poweredBy}
        </p>
      </div>

      {/* Input area */}
      <div className="p-3 border-t border-white/10 bg-slate-800/30">
        <div className="flex items-center gap-2">
          <input
            ref={inputRef}
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder={t.placeholder}
            disabled={!isOnline || isSending}
            className="flex-1 px-4 py-2.5 bg-slate-700/50 border border-white/10 rounded-full text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20 disabled:opacity-50"
          />
          <button
            onClick={handleSend}
            disabled={!inputText.trim() || !isOnline || isSending}
            className="p-2.5 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 disabled:from-slate-700 disabled:to-slate-700 disabled:text-slate-500 text-white rounded-full transition-all"
          >
            {isSending ? (
              <RefreshCw className="w-5 h-5 animate-spin" />
            ) : (
              <Send className="w-5 h-5" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ChatSection;
