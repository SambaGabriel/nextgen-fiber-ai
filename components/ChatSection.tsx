/**
 * ChatSection - Bidirectional chat component for Job Details
 * Supports real-time messaging between Lineman and Supervisor
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Send, Wifi, WifiOff, AlertCircle, RefreshCw } from 'lucide-react';
import { JobChatMessage, MessageStatus } from '../types/project';
import { chatStorage } from '../services/chatStorage';
import { Language } from '../types';

interface ChatSectionProps {
  jobId: string;
  userId: string;
  userName: string;
  userRole: 'LINEMAN' | 'ADMIN';
  lang: Language;
}

const translations = {
  EN: {
    title: 'Messages',
    placeholder: 'Type a message...',
    send: 'Send',
    noMessages: 'No messages yet. Start the conversation!',
    offline: 'Offline - Messages will be sent when connected',
    sending: 'Sending...',
    failed: 'Failed to send. Tap to retry.',
    today: 'Today',
    yesterday: 'Yesterday',
  },
  PT: {
    title: 'Mensagens',
    placeholder: 'Digite uma mensagem...',
    send: 'Enviar',
    noMessages: 'Nenhuma mensagem ainda. Inicie a conversa!',
    offline: 'Offline - Mensagens serão enviadas quando conectar',
    sending: 'Enviando...',
    failed: 'Falha ao enviar. Toque para tentar novamente.',
    today: 'Hoje',
    yesterday: 'Ontem',
  },
  ES: {
    title: 'Mensajes',
    placeholder: 'Escribe un mensaje...',
    send: 'Enviar',
    noMessages: 'No hay mensajes aún. ¡Inicia la conversación!',
    offline: 'Sin conexión - Los mensajes se enviarán cuando se conecte',
    sending: 'Enviando...',
    failed: 'Error al enviar. Toca para reintentar.',
    today: 'Hoy',
    yesterday: 'Ayer',
  }
};

// Generate unique client message ID for idempotency
const generateClientMessageId = () => `msg_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

// Format date for message grouping
const formatMessageDate = (dateStr: string, t: typeof translations.EN): string => {
  const date = new Date(dateStr);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  if (date.toDateString() === today.toDateString()) {
    return t.today;
  } else if (date.toDateString() === yesterday.toDateString()) {
    return t.yesterday;
  } else {
    return date.toLocaleDateString();
  }
};

// Format time for message display
const formatMessageTime = (dateStr: string): string => {
  return new Date(dateStr).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

const ChatSection: React.FC<ChatSectionProps> = ({
  jobId,
  userId,
  userName,
  userRole,
  lang
}) => {
  const t = translations[lang] || translations.EN;
  const [messages, setMessages] = useState<JobChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isLoading, setIsLoading] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Scroll to bottom of messages
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  // Load messages
  const loadMessages = useCallback(() => {
    const msgs = chatStorage.getMessages(jobId);
    setMessages(msgs);
    setIsLoading(false);
  }, [jobId]);

  // Initialize and mark as read
  useEffect(() => {
    // Initialize sample messages for demo
    chatStorage.initializeSampleMessages(jobId, userId, userName);
    loadMessages();
    chatStorage.markAsRead(jobId, userId);
  }, [jobId, userId, userName, loadMessages]);

  // Scroll to bottom when messages change
  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // Online/offline detection
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      // Process offline queue when back online
      chatStorage.processQueue();
    };
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Polling for new messages (every 5 seconds)
  useEffect(() => {
    pollIntervalRef.current = setInterval(() => {
      loadMessages();
    }, 5000);

    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, [loadMessages]);

  // Send message handler
  const handleSend = useCallback(() => {
    const text = inputText.trim();
    if (!text) return;

    const clientMessageId = generateClientMessageId();

    if (isOnline) {
      // Send directly
      chatStorage.saveMessage({
        jobId,
        senderUserId: userId,
        senderName: userName,
        senderRole: userRole,
        body: text,
        clientMessageId
      });
    } else {
      // Queue for later
      chatStorage.enqueueMessage({
        jobId,
        senderUserId: userId,
        senderName: userName,
        senderRole: userRole,
        body: text,
        clientMessageId
      });
    }

    setInputText('');
    loadMessages();
    inputRef.current?.focus();
  }, [inputText, isOnline, jobId, userId, userName, userRole, loadMessages]);

  // Handle Enter key
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Group messages by date
  const groupedMessages = messages.reduce((groups, msg) => {
    const dateKey = formatMessageDate(msg.createdAt, t);
    if (!groups[dateKey]) {
      groups[dateKey] = [];
    }
    groups[dateKey].push(msg);
    return groups;
  }, {} as Record<string, JobChatMessage[]>);

  // Render message status indicator
  const renderStatus = (status?: MessageStatus) => {
    if (!status || status === 'SENT') return null;

    if (status === 'SENDING' || status === 'QUEUED') {
      return (
        <span className="text-[10px] text-slate-500 flex items-center gap-1">
          <RefreshCw className="w-3 h-3 animate-spin" />
          {t.sending}
        </span>
      );
    }

    if (status === 'FAILED') {
      return (
        <span className="text-[10px] text-red-400 flex items-center gap-1">
          <AlertCircle className="w-3 h-3" />
          {t.failed}
        </span>
      );
    }

    return null;
  };

  return (
    <div className="flex flex-col h-full bg-slate-900/50 rounded-xl border border-white/10 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 bg-slate-800/50">
        <h3 className="text-sm font-semibold text-white">{t.title}</h3>
        <div className="flex items-center gap-2">
          {isOnline ? (
            <Wifi className="w-4 h-4 text-emerald-400" />
          ) : (
            <WifiOff className="w-4 h-4 text-amber-400" />
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
      <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-[200px] max-h-[400px]">
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <RefreshCw className="w-6 h-6 text-slate-500 animate-spin" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-sm text-slate-500 text-center">{t.noMessages}</p>
          </div>
        ) : (
          Object.entries(groupedMessages).map(([date, msgs]) => (
            <div key={date}>
              {/* Date separator */}
              <div className="flex items-center gap-2 my-4">
                <div className="flex-1 h-px bg-white/10" />
                <span className="text-[10px] text-slate-500 uppercase tracking-wider">{date}</span>
                <div className="flex-1 h-px bg-white/10" />
              </div>

              {/* Messages for this date */}
              <div className="space-y-3">
                {msgs.map((msg) => {
                  const isOwnMessage = msg.senderUserId === userId;
                  return (
                    <div
                      key={msg.id}
                      className={`flex ${isOwnMessage ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-[80%] rounded-2xl px-4 py-2 ${
                          isOwnMessage
                            ? 'bg-blue-600 text-white rounded-br-md'
                            : 'bg-slate-700/50 text-slate-200 rounded-bl-md'
                        }`}
                      >
                        {/* Sender name (only for others) */}
                        {!isOwnMessage && (
                          <p className="text-[10px] font-semibold text-blue-400 mb-1">
                            {msg.senderName}
                            <span className="ml-2 text-slate-500">
                              {msg.senderRole === 'ADMIN' ? 'Supervisor' : 'Lineman'}
                            </span>
                          </p>
                        )}

                        {/* Message body */}
                        <p className="text-sm whitespace-pre-wrap break-words">{msg.body}</p>

                        {/* Time and status */}
                        <div className={`flex items-center gap-2 mt-1 ${isOwnMessage ? 'justify-end' : 'justify-start'}`}>
                          <span className={`text-[10px] ${isOwnMessage ? 'text-blue-200' : 'text-slate-500'}`}>
                            {formatMessageTime(msg.createdAt)}
                          </span>
                          {isOwnMessage && renderStatus(msg.status)}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
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
            className="flex-1 px-4 py-2.5 bg-slate-700/50 border border-white/10 rounded-full text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20"
          />
          <button
            onClick={handleSend}
            disabled={!inputText.trim()}
            className="p-2.5 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 disabled:text-slate-500 text-white rounded-full transition-colors"
          >
            <Send className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default ChatSection;
