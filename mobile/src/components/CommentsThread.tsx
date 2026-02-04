/**
 * NextGen Fiber - CommentsThread Component
 * Chat-like comments/discussion thread
 */

import React, { useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Image,
} from 'react-native';
import { Comment, CreateCommentPayload } from '../types/jobs';

// ============================================
// TYPES
// ============================================

interface CommentsThreadProps {
  comments: Comment[];
  jobId: string;
  currentUserId: string;
  onSendComment: (payload: CreateCommentPayload) => Promise<void>;
  onRefresh?: () => Promise<void>;
  isRefreshing?: boolean;
}

// ============================================
// HELPERS
// ============================================

function formatCommentTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Agora';
  if (diffMins < 60) return `${diffMins} min`;
  if (diffHours < 24) return `${diffHours}h`;
  if (diffDays < 7) return `${diffDays}d`;

  return date.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .substring(0, 2);
}

// ============================================
// COMMENT BUBBLE
// ============================================

interface CommentBubbleProps {
  comment: Comment;
  isOwn: boolean;
}

function CommentBubble({ comment, isOwn }: CommentBubbleProps): JSX.Element {
  const roleColors: Record<string, string> = {
    LINEMAN: '#3B82F6',
    FOREMAN: '#8B5CF6',
    ADMIN: '#EF4444',
    OFFICE: '#059669',
  };

  const avatarColor = roleColors[comment.authorRole] || '#6B7280';

  return (
    <View style={[styles.bubbleContainer, isOwn && styles.bubbleContainerOwn]}>
      {/* Avatar */}
      {!isOwn && (
        <View style={styles.avatarContainer}>
          {comment.authorAvatarUrl ? (
            <Image
              source={{ uri: comment.authorAvatarUrl }}
              style={styles.avatar}
            />
          ) : (
            <View style={[styles.avatarPlaceholder, { backgroundColor: avatarColor }]}>
              <Text style={styles.avatarText}>{getInitials(comment.authorName)}</Text>
            </View>
          )}
        </View>
      )}

      {/* Bubble */}
      <View style={styles.bubbleContent}>
        {/* Header */}
        {!isOwn && (
          <View style={styles.bubbleHeader}>
            <Text style={styles.authorName}>{comment.authorName}</Text>
            {comment.isFromOffice && (
              <View style={styles.officeBadge}>
                <Text style={styles.officeBadgeText}>Escritório</Text>
              </View>
            )}
          </View>
        )}

        {/* Message */}
        <View
          style={[
            styles.bubble,
            isOwn ? styles.bubbleOwn : styles.bubbleOther,
            comment.isFromOffice && !isOwn && styles.bubbleOffice,
          ]}
        >
          <Text
            style={[
              styles.bubbleText,
              isOwn && styles.bubbleTextOwn,
            ]}
          >
            {comment.text}
          </Text>
        </View>

        {/* Timestamp & Status */}
        <View style={[styles.bubbleMeta, isOwn && styles.bubbleMetaOwn]}>
          <Text style={styles.timeText}>{formatCommentTime(comment.createdAt)}</Text>
          {comment.syncStatus === 'SENDING' && (
            <Text style={styles.syncingText}>Enviando...</Text>
          )}
          {comment.syncStatus === 'FAILED' && (
            <Text style={styles.failedText}>Falhou</Text>
          )}
        </View>
      </View>
    </View>
  );
}

// ============================================
// MAIN COMPONENT
// ============================================

export function CommentsThread({
  comments,
  jobId,
  currentUserId,
  onSendComment,
  onRefresh,
  isRefreshing = false,
}: CommentsThreadProps): JSX.Element {
  const [text, setText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const flatListRef = useRef<FlatList>(null);

  const handleSend = useCallback(async () => {
    const trimmedText = text.trim();
    if (!trimmedText || isSending) return;

    setIsSending(true);
    setText('');

    try {
      await onSendComment({
        jobId,
        text: trimmedText,
      });
    } catch (error) {
      // Comment was queued for offline retry
      console.log('[CommentsThread] Comment queued for retry');
    } finally {
      setIsSending(false);
    }
  }, [text, isSending, onSendComment, jobId]);

  const renderComment = useCallback(
    ({ item }: { item: Comment }) => (
      <CommentBubble comment={item} isOwn={item.authorId === currentUserId} />
    ),
    [currentUserId]
  );

  const keyExtractor = useCallback((item: Comment) => item.id, []);

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={100}
    >
      {/* Comments List */}
      <FlatList
        ref={flatListRef}
        data={comments}
        renderItem={renderComment}
        keyExtractor={keyExtractor}
        contentContainerStyle={styles.listContent}
        inverted={false}
        onRefresh={onRefresh}
        refreshing={isRefreshing}
        onContentSizeChange={() => {
          if (comments.length > 0) {
            flatListRef.current?.scrollToEnd({ animated: false });
          }
        }}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>💬</Text>
            <Text style={styles.emptyText}>Nenhum comentário ainda</Text>
            <Text style={styles.emptySubtext}>
              Inicie a conversa com o escritório
            </Text>
          </View>
        }
      />

      {/* Input Area */}
      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          value={text}
          onChangeText={setText}
          placeholder="Digite uma mensagem..."
          placeholderTextColor="#9CA3AF"
          multiline
          maxLength={1000}
          editable={!isSending}
        />
        <TouchableOpacity
          style={[styles.sendButton, (!text.trim() || isSending) && styles.sendButtonDisabled]}
          onPress={handleSend}
          disabled={!text.trim() || isSending}
        >
          <Text style={styles.sendButtonText}>
            {isSending ? '...' : '➤'}
          </Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

// ============================================
// STYLES
// ============================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  listContent: {
    padding: 16,
    flexGrow: 1,
  },

  // Empty state
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 4,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#6B7280',
  },

  // Bubble container
  bubbleContainer: {
    flexDirection: 'row',
    marginBottom: 12,
    maxWidth: '85%',
  },
  bubbleContainerOwn: {
    alignSelf: 'flex-end',
    flexDirection: 'row-reverse',
  },

  // Avatar
  avatarContainer: {
    marginRight: 8,
    alignSelf: 'flex-end',
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  avatarPlaceholder: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },

  // Bubble content
  bubbleContent: {
    flexShrink: 1,
  },
  bubbleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
    gap: 6,
  },
  authorName: {
    fontSize: 12,
    fontWeight: '600',
    color: '#374151',
  },
  officeBadge: {
    backgroundColor: '#D1FAE5',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  officeBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#065F46',
  },

  // Bubble
  bubble: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
  },
  bubbleOther: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderBottomLeftRadius: 4,
  },
  bubbleOwn: {
    backgroundColor: '#3B82F6',
    borderBottomRightRadius: 4,
  },
  bubbleOffice: {
    backgroundColor: '#ECFDF5',
    borderColor: '#A7F3D0',
  },
  bubbleText: {
    fontSize: 15,
    color: '#111827',
    lineHeight: 20,
  },
  bubbleTextOwn: {
    color: '#FFFFFF',
  },

  // Meta
  bubbleMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    gap: 8,
  },
  bubbleMetaOwn: {
    justifyContent: 'flex-end',
  },
  timeText: {
    fontSize: 11,
    color: '#9CA3AF',
  },
  syncingText: {
    fontSize: 11,
    color: '#3B82F6',
  },
  failedText: {
    fontSize: 11,
    color: '#EF4444',
  },

  // Input area
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: 12,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    gap: 8,
  },
  input: {
    flex: 1,
    backgroundColor: '#F3F4F6',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 15,
    maxHeight: 100,
    color: '#111827',
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#3B82F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: '#D1D5DB',
  },
  sendButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
  },
});
