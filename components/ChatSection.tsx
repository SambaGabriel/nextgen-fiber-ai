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
    <div className="flex flex-col rounded-xl sm:rounded-2xl overflow-hidden" style={{ background: 'var(--surface)', border: '1px solid var(--border-default)' }}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: '1px solid var(--border-subtle)', background: 'var(--neural-dim)' }}>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'var(--gradient-neural)' }}>
            <Bot className="w-5 h-5" style={{ color: 'var(--void)' }} />
          </div>
          <div>
            <h3 className="text-sm font-bold flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
              {t.title}
              <Sparkles className="w-4 h-4" style={{ color: 'var(--neural-core)' }} />
            </h3>
            <p className="text-[10px]" style={{ color: 'var(--text-tertiary)' }}>{t.subtitle}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isOnline ? (
            <div className="flex items-center gap-1.5 px-2 py-1 rounded-full" style={{ background: 'var(--online-glow)' }}>
              <div className="w-2 h-2 rounded-full animate-pulse" style={{ background: 'var(--online-core)' }} />
              <span className="text-[10px] font-bold" style={{ color: 'var(--online-core)' }}>Online</span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 px-2 py-1 rounded-full" style={{ background: 'var(--alert-glow)' }}>
              <WifiOff className="w-3 h-3" style={{ color: 'var(--alert-core)' }} />
              <span className="text-[10px] font-bold" style={{ color: 'var(--alert-core)' }}>Offline</span>
            </div>
          )}
        </div>
      </div>

      {/* Offline banner */}
      {!isOnline && (
        <div className="px-4 py-2" style={{ background: 'var(--alert-glow)', borderBottom: '1px solid var(--border-alert)' }}>
          <p className="text-xs" style={{ color: 'var(--alert-core)' }}>{t.offline}</p>
        </div>
      )}

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-[300px] max-h-[500px]" style={{ background: 'var(--deep)' }}>
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <RefreshCw className="w-6 h-6 animate-spin" style={{ color: 'var(--text-ghost)' }} />
          </div>
        ) : (
          messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div className={`flex gap-2 max-w-[85%] ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                {/* Avatar */}
                <div
                  className="flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center"
                  style={{
                    background: msg.role === 'user' ? 'var(--energy-core)' : 'var(--gradient-neural)'
                  }}
                >
                  {msg.role === 'user' ? (
                    <User className="w-4 h-4" style={{ color: 'var(--void)' }} />
                  ) : (
                    <Bot className="w-4 h-4" style={{ color: 'var(--void)' }} />
                  )}
                </div>

                {/* Message bubble */}
                <div
                  className={`rounded-2xl px-4 py-3 ${msg.role === 'user' ? 'rounded-br-md' : 'rounded-bl-md'} ${msg.status === 'sending' ? 'opacity-70' : ''}`}
                  style={{
                    background: msg.role === 'user' ? 'var(--neural-core)' : 'var(--elevated)',
                    color: msg.role === 'user' ? 'var(--void)' : 'var(--text-secondary)',
                    border: msg.role === 'user' ? 'none' : '1px solid var(--border-subtle)'
                  }}
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
                    <span className="text-[10px]" style={{ color: msg.role === 'user' ? 'rgba(0,0,0,0.5)' : 'var(--text-ghost)' }}>
                      {formatTime(msg.timestamp)}
                    </span>
                    {msg.status === 'error' && (
                      <AlertCircle className="w-3 h-3" style={{ color: 'var(--critical-core)' }} />
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
      <div className="px-4 py-1" style={{ borderTop: '1px solid var(--border-subtle)', background: 'var(--surface)' }}>
        <p className="text-[9px] text-center flex items-center justify-center gap-1" style={{ color: 'var(--text-ghost)' }}>
          <Sparkles className="w-3 h-3" />
          {t.poweredBy}
        </p>
      </div>

      {/* Input area */}
      <div className="p-3" style={{ borderTop: '1px solid var(--border-subtle)', background: 'var(--elevated)' }}>
        <div className="flex items-center gap-2">
          <input
            ref={inputRef}
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder={t.placeholder}
            disabled={!isOnline || isSending}
            className="flex-1 px-4 py-2.5 rounded-full text-sm focus:outline-none disabled:opacity-50"
            style={{
              background: 'var(--surface)',
              border: '1px solid var(--border-default)',
              color: 'var(--text-primary)'
            }}
          />
          <button
            onClick={handleSend}
            disabled={!inputText.trim() || !isOnline || isSending}
            className="p-2.5 rounded-full transition-all disabled:opacity-50"
            style={{
              background: !inputText.trim() || !isOnline || isSending ? 'var(--surface)' : 'var(--gradient-neural)',
              color: !inputText.trim() || !isOnline || isSending ? 'var(--text-ghost)' : 'var(--void)'
            }}
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
