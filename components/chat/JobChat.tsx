/**
 * Job Chat Component
 * Real-time messaging for job collaboration
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Send, MessageCircle, Loader2, AlertCircle } from 'lucide-react';
import {
  getJobMessages,
  sendMessage,
  subscribeToJobMessages,
  markMessagesAsRead,
  type ChatMessage
} from '../../services/chatService';
import type { User } from '../../types';

interface Props {
  jobId: string;
  user: User | null;
  compact?: boolean;
}

const JobChat: React.FC<Props> = ({ jobId, user, compact = false }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [inputValue, setInputValue] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Load messages
  const loadMessages = useCallback(async () => {
    if (!jobId) return;

    setLoading(true);
    try {
      const data = await getJobMessages(jobId);
      setMessages(data);
    } catch (err) {
      console.error('[JobChat] Error loading messages:', err);
    }
    setLoading(false);
  }, [jobId]);

  useEffect(() => {
    loadMessages();
  }, [loadMessages]);

  // Subscribe to new messages
  useEffect(() => {
    if (!jobId) return;

    const unsubscribe = subscribeToJobMessages(jobId, (newMessage) => {
      setMessages(prev => {
        // Avoid duplicates
        if (prev.some(m => m.id === newMessage.id)) return prev;
        return [...prev, newMessage];
      });
    });

    return () => unsubscribe();
  }, [jobId]);

  // Mark as read when viewing
  useEffect(() => {
    if (jobId && user?.id && messages.length > 0) {
      markMessagesAsRead(jobId, user.id);
    }
  }, [jobId, user?.id, messages.length]);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Send message
  const handleSend = async () => {
    if (!inputValue.trim() || !user) return;

    const messageText = inputValue.trim();
    setInputValue('');
    setSending(true);
    setError('');

    try {
      await sendMessage({
        jobId,
        userId: user.id,
        userName: user.name,
        userRole: user.role,
        message: messageText
      });
    } catch (err: any) {
      setError(err.message || 'Failed to send message');
      setInputValue(messageText);
    }

    setSending(false);
    inputRef.current?.focus();
  };

  // Handle enter key
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Format timestamp
  const formatTime = (isoString: string) => {
    const date = new Date(isoString);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();

    if (isToday) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }

    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    if (date.toDateString() === yesterday.toDateString()) {
      return 'Yesterday ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }

    return date.toLocaleDateString([], { month: 'short', day: 'numeric' }) +
      ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  // Get role color
  const getRoleColor = (role: string) => {
    switch (role.toUpperCase()) {
      case 'ADMIN':
        return 'var(--critical-core)';
      case 'SUPERVISOR':
        return 'var(--warning-core)';
      case 'LINEMAN':
        return 'var(--neural-core)';
      case 'FOREMAN':
        return 'var(--info-core)';
      case 'SYSTEM':
        return 'var(--text-ghost)';
      default:
        return 'var(--text-secondary)';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin" style={{ color: 'var(--neural-core)' }} />
      </div>
    );
  }

  return (
    <div
      className={`flex flex-col ${compact ? 'h-80' : 'h-full'} rounded-2xl`}
      style={{ background: 'var(--surface)', border: '1px solid var(--border-default)' }}
    >
      {/* Header */}
      <div className="flex items-center gap-3 p-4 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
        <MessageCircle className="w-5 h-5" style={{ color: 'var(--neural-core)' }} />
        <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>Job Chat</span>
        <span
          className="text-xs px-2 py-0.5 rounded-full"
          style={{ background: 'var(--elevated)', color: 'var(--text-tertiary)' }}
        >
          {messages.length} messages
        </span>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="text-center py-8" style={{ color: 'var(--text-tertiary)' }}>
            <MessageCircle className="w-10 h-10 mx-auto mb-2 opacity-30" />
            <p>No messages yet</p>
            <p className="text-sm">Start the conversation!</p>
          </div>
        ) : (
          messages.map((msg, index) => {
            const isOwnMessage = msg.userId === user?.id;
            const isSystem = msg.messageType === 'system';
            const showAvatar = index === 0 || messages[index - 1].userId !== msg.userId;

            if (isSystem) {
              return (
                <div key={msg.id} className="flex justify-center">
                  <div
                    className="px-3 py-1.5 rounded-full text-xs"
                    style={{ background: 'var(--elevated)', color: 'var(--text-ghost)' }}
                  >
                    {msg.message}
                  </div>
                </div>
              );
            }

            return (
              <div
                key={msg.id}
                className={`flex ${isOwnMessage ? 'justify-end' : 'justify-start'}`}
              >
                <div className={`max-w-[80%] ${isOwnMessage ? 'items-end' : 'items-start'}`}>
                  {/* Sender Info */}
                  {showAvatar && !isOwnMessage && (
                    <div className="flex items-center gap-2 mb-1">
                      <div
                        className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white"
                        style={{ background: getRoleColor(msg.userRole) }}
                      >
                        {msg.userName.charAt(0).toUpperCase()}
                      </div>
                      <span className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
                        {msg.userName}
                      </span>
                      <span className="text-xs" style={{ color: 'var(--text-ghost)' }}>
                        {msg.userRole}
                      </span>
                    </div>
                  )}

                  {/* Message Bubble */}
                  <div
                    className={`px-4 py-2.5 rounded-2xl ${
                      isOwnMessage
                        ? 'rounded-br-md'
                        : 'rounded-bl-md'
                    }`}
                    style={{
                      background: isOwnMessage ? 'var(--neural-core)' : 'var(--elevated)',
                      color: isOwnMessage ? 'white' : 'var(--text-primary)'
                    }}
                  >
                    <p className="text-sm whitespace-pre-wrap">{msg.message}</p>
                    {msg.editedAt && (
                      <span className="text-xs opacity-70">(edited)</span>
                    )}
                  </div>

                  {/* Timestamp */}
                  <p
                    className={`text-xs mt-1 ${isOwnMessage ? 'text-right' : 'text-left'}`}
                    style={{ color: 'var(--text-ghost)' }}
                  >
                    {formatTime(msg.createdAt)}
                  </p>
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 px-4 py-2" style={{ background: 'var(--critical-dim)' }}>
          <AlertCircle className="w-4 h-4" style={{ color: 'var(--critical-core)' }} />
          <span className="text-sm" style={{ color: 'var(--critical-core)' }}>{error}</span>
        </div>
      )}

      {/* Input */}
      <div className="p-4 border-t" style={{ borderColor: 'var(--border-subtle)' }}>
        <div className="flex items-center gap-3">
          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Type a message..."
            disabled={!user}
            className="flex-1 px-4 py-2.5 rounded-xl text-sm"
            style={{
              background: 'var(--elevated)',
              border: '1px solid var(--border-default)',
              color: 'var(--text-primary)'
            }}
          />
          <button
            onClick={handleSend}
            disabled={!inputValue.trim() || sending || !user}
            className="p-2.5 rounded-xl transition-all disabled:opacity-50"
            style={{
              background: 'var(--neural-core)',
              color: 'white'
            }}
          >
            {sending ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Send className="w-5 h-5" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default JobChat;
