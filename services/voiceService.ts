/**
 * NextGen Fiber AI - Voice Command Service
 * Enables hands-free operation for linemen in the field
 * Uses Web Speech API for speech recognition and synthesis
 */

// ============================================================================
// TypeScript Interfaces
// ============================================================================

/** Types of voice commands supported */
export type VoiceCommandType =
  | 'ADD_FOOTAGE'
  | 'ADD_HARDWARE'
  | 'TAKE_PHOTO'
  | 'SUBMIT'
  | 'CANCEL'
  | 'NAVIGATE_BACK'
  | 'NEXT_JOB'
  | 'UNKNOWN';

/** Hardware items that can be added via voice */
export type HardwareItem = 'anchor' | 'coil' | 'snowshoe';

/** Base interface for all voice commands */
export interface VoiceCommandBase {
  type: VoiceCommandType;
  rawTranscript: string;
  confidence: number;
  timestamp: Date;
}

/** Command to add footage */
export interface AddFootageCommand extends VoiceCommandBase {
  type: 'ADD_FOOTAGE';
  value: number;
}

/** Command to add hardware item */
export interface AddHardwareCommand extends VoiceCommandBase {
  type: 'ADD_HARDWARE';
  item: HardwareItem;
}

/** Simple commands without additional data */
export interface SimpleCommand extends VoiceCommandBase {
  type: 'TAKE_PHOTO' | 'SUBMIT' | 'CANCEL' | 'NAVIGATE_BACK' | 'NEXT_JOB';
}

/** Unknown command */
export interface UnknownCommand extends VoiceCommandBase {
  type: 'UNKNOWN';
}

/** Union type for all possible commands */
export type VoiceCommand = AddFootageCommand | AddHardwareCommand | SimpleCommand | UnknownCommand;

/** Voice recognition event */
export interface VoiceEvent {
  transcript: string;
  confidence: number;
  isFinal: boolean;
}

/** Voice error event */
export interface VoiceError {
  code: string;
  message: string;
  timestamp: Date;
}

/** Command handler callback */
export type CommandCallback = (command: VoiceCommand) => void;

/** Error handler callback */
export type ErrorCallback = (error: VoiceError) => void;

/** Interim result callback (for showing live transcription) */
export type InterimCallback = (transcript: string) => void;

/** Voice recognition state */
export type VoiceState = 'idle' | 'listening' | 'processing' | 'error';

// ============================================================================
// Web Speech API Type Declarations
// ============================================================================

interface SpeechRecognitionEvent extends Event {
  resultIndex: number;
  results: SpeechRecognitionResultList;
}

interface SpeechRecognitionResultList {
  length: number;
  item(index: number): SpeechRecognitionResult;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionResult {
  length: number;
  isFinal: boolean;
  item(index: number): SpeechRecognitionAlternative;
  [index: number]: SpeechRecognitionAlternative;
}

interface SpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string;
  message: string;
}

interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  onstart: (() => void) | null;
  onspeechstart: (() => void) | null;
  onspeechend: (() => void) | null;
}

interface SpeechRecognitionConstructor {
  new (): SpeechRecognition;
}

declare global {
  interface Window {
    SpeechRecognition: SpeechRecognitionConstructor;
    webkitSpeechRecognition: SpeechRecognitionConstructor;
  }
}

// ============================================================================
// Command Patterns
// ============================================================================

/** Pattern definitions for command recognition */
const COMMAND_PATTERNS: Array<{
  pattern: RegExp;
  type: VoiceCommandType;
  extract?: (match: RegExpMatchArray) => Partial<VoiceCommand>;
}> = [
  // Add footage commands - supports various formats
  {
    pattern: /(?:add|at|had)\s+(?:footage\s+)?(\d+(?:\.\d+)?)\s*(?:feet|foot|ft)?/i,
    type: 'ADD_FOOTAGE',
    extract: (match) => ({ value: parseFloat(match[1]) } as Partial<AddFootageCommand>),
  },
  {
    pattern: /(\d+(?:\.\d+)?)\s*(?:feet|foot|ft)\s*(?:of\s+)?(?:footage)?/i,
    type: 'ADD_FOOTAGE',
    extract: (match) => ({ value: parseFloat(match[1]) } as Partial<AddFootageCommand>),
  },
  // Hardware commands
  {
    pattern: /(?:add|at|had)\s+(?:an?\s+)?anchor/i,
    type: 'ADD_HARDWARE',
    extract: () => ({ item: 'anchor' as HardwareItem }),
  },
  {
    pattern: /(?:add|at|had)\s+(?:a\s+)?coil/i,
    type: 'ADD_HARDWARE',
    extract: () => ({ item: 'coil' as HardwareItem }),
  },
  {
    pattern: /(?:add|at|had)\s+(?:a\s+)?(?:snow\s*shoe|snowshoe)/i,
    type: 'ADD_HARDWARE',
    extract: () => ({ item: 'snowshoe' as HardwareItem }),
  },
  // Photo command
  {
    pattern: /(?:take|capture|snap)\s+(?:a\s+)?photo/i,
    type: 'TAKE_PHOTO',
  },
  // Submit command
  {
    pattern: /^submit$|submit\s+(?:job|report|production)/i,
    type: 'SUBMIT',
  },
  // Cancel command
  {
    pattern: /^cancel$|cancel\s+(?:that|this|it)/i,
    type: 'CANCEL',
  },
  // Navigation commands
  {
    pattern: /(?:go\s+)?back|go\s+back|navigate\s+back/i,
    type: 'NAVIGATE_BACK',
  },
  {
    pattern: /next\s+job|go\s+(?:to\s+)?next/i,
    type: 'NEXT_JOB',
  },
];

// ============================================================================
// VoiceRecognition Class
// ============================================================================

/**
 * VoiceRecognition class for hands-free voice commands
 * Designed for field workers (linemen) with dirty hands
 */
export class VoiceRecognition {
  private recognition: SpeechRecognition | null = null;
  private synthesis: SpeechSynthesis | null = null;
  private commandCallbacks: CommandCallback[] = [];
  private errorCallbacks: ErrorCallback[] = [];
  private interimCallbacks: InterimCallback[] = [];
  private _state: VoiceState = 'idle';
  private autoRestart: boolean = true;
  private restartTimeout: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    this.initializeSpeechRecognition();
    this.initializeSpeechSynthesis();
  }

  /**
   * Initialize Web Speech API recognition
   */
  private initializeSpeechRecognition(): void {
    if (!this.isSupported()) {
      console.warn('[VoiceService] Speech recognition not supported in this browser');
      return;
    }

    const SpeechRecognitionClass = window.SpeechRecognition || window.webkitSpeechRecognition;
    this.recognition = new SpeechRecognitionClass();

    // Configure for continuous listening
    this.recognition.continuous = true;
    this.recognition.interimResults = true;
    this.recognition.lang = 'en-US';
    this.recognition.maxAlternatives = 3;

    // Set up event handlers
    this.recognition.onresult = this.handleResult.bind(this);
    this.recognition.onerror = this.handleError.bind(this);
    this.recognition.onend = this.handleEnd.bind(this);
    this.recognition.onstart = () => {
      this._state = 'listening';
      console.log('[VoiceService] Recognition started');
    };
    this.recognition.onspeechstart = () => {
      console.log('[VoiceService] Speech detected');
    };
    this.recognition.onspeechend = () => {
      console.log('[VoiceService] Speech ended');
    };
  }

  /**
   * Initialize speech synthesis for feedback
   */
  private initializeSpeechSynthesis(): void {
    if ('speechSynthesis' in window) {
      this.synthesis = window.speechSynthesis;
    } else {
      console.warn('[VoiceService] Speech synthesis not supported in this browser');
    }
  }

  /**
   * Check if Web Speech API is supported
   */
  public isSupported(): boolean {
    return !!(window.SpeechRecognition || window.webkitSpeechRecognition);
  }

  /**
   * Check if speech synthesis is supported
   */
  public isSynthesisSupported(): boolean {
    return 'speechSynthesis' in window;
  }

  /**
   * Get current recognition state
   */
  public get state(): VoiceState {
    return this._state;
  }

  /**
   * Start listening for voice commands
   */
  public start(): void {
    if (!this.recognition) {
      this.notifyError({
        code: 'NOT_SUPPORTED',
        message: 'Speech recognition is not supported in this browser',
        timestamp: new Date(),
      });
      return;
    }

    if (this._state === 'listening') {
      console.log('[VoiceService] Already listening');
      return;
    }

    try {
      this.autoRestart = true;
      this.recognition.start();
      this.speak('Voice commands activated');
    } catch (error) {
      console.error('[VoiceService] Error starting recognition:', error);
      this.notifyError({
        code: 'START_ERROR',
        message: error instanceof Error ? error.message : 'Failed to start recognition',
        timestamp: new Date(),
      });
    }
  }

  /**
   * Stop listening for voice commands
   */
  public stop(): void {
    if (!this.recognition) return;

    this.autoRestart = false;

    if (this.restartTimeout) {
      clearTimeout(this.restartTimeout);
      this.restartTimeout = null;
    }

    try {
      this.recognition.stop();
      this._state = 'idle';
      console.log('[VoiceService] Recognition stopped');
    } catch (error) {
      console.error('[VoiceService] Error stopping recognition:', error);
    }
  }

  /**
   * Register a command handler callback
   */
  public onCommand(callback: CommandCallback): () => void {
    this.commandCallbacks.push(callback);
    // Return unsubscribe function
    return () => {
      const index = this.commandCallbacks.indexOf(callback);
      if (index > -1) {
        this.commandCallbacks.splice(index, 1);
      }
    };
  }

  /**
   * Register an error handler callback
   */
  public onError(callback: ErrorCallback): () => void {
    this.errorCallbacks.push(callback);
    // Return unsubscribe function
    return () => {
      const index = this.errorCallbacks.indexOf(callback);
      if (index > -1) {
        this.errorCallbacks.splice(index, 1);
      }
    };
  }

  /**
   * Register an interim result callback (for live transcription display)
   */
  public onInterim(callback: InterimCallback): () => void {
    this.interimCallbacks.push(callback);
    // Return unsubscribe function
    return () => {
      const index = this.interimCallbacks.indexOf(callback);
      if (index > -1) {
        this.interimCallbacks.splice(index, 1);
      }
    };
  }

  /**
   * Speak text using speech synthesis
   */
  public speak(text: string): void {
    if (!this.synthesis) {
      console.warn('[VoiceService] Speech synthesis not available');
      return;
    }

    // Cancel any ongoing speech
    this.synthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'en-US';
    utterance.rate = 1.0;
    utterance.pitch = 1.0;
    utterance.volume = 1.0;

    // Get available voices and prefer a US English voice
    const voices = this.synthesis.getVoices();
    const usVoice = voices.find(
      (voice) => voice.lang === 'en-US' && voice.localService
    );
    if (usVoice) {
      utterance.voice = usVoice;
    }

    this.synthesis.speak(utterance);
  }

  /**
   * Handle speech recognition results
   */
  private handleResult(event: SpeechRecognitionEvent): void {
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const result = event.results[i];
      const transcript = result[0].transcript.trim();
      const confidence = result[0].confidence;

      if (result.isFinal) {
        console.log('[VoiceService] Final transcript:', transcript, 'Confidence:', confidence);
        this.processCommand(transcript, confidence);
      } else {
        // Notify interim callbacks for live display
        this.interimCallbacks.forEach((callback) => callback(transcript));
      }
    }
  }

  /**
   * Process transcript and identify command
   */
  private processCommand(transcript: string, confidence: number): void {
    const normalizedTranscript = transcript.toLowerCase().trim();

    for (const patternDef of COMMAND_PATTERNS) {
      const match = normalizedTranscript.match(patternDef.pattern);
      if (match) {
        const baseCommand: VoiceCommandBase = {
          type: patternDef.type,
          rawTranscript: transcript,
          confidence,
          timestamp: new Date(),
        };

        const extraData = patternDef.extract ? patternDef.extract(match) : {};
        const command = { ...baseCommand, ...extraData } as VoiceCommand;

        // Provide audio feedback
        this.provideCommandFeedback(command);

        // Notify all command callbacks
        this.commandCallbacks.forEach((callback) => callback(command));
        return;
      }
    }

    // Unknown command
    const unknownCommand: UnknownCommand = {
      type: 'UNKNOWN',
      rawTranscript: transcript,
      confidence,
      timestamp: new Date(),
    };

    console.log('[VoiceService] Unknown command:', transcript);
    this.commandCallbacks.forEach((callback) => callback(unknownCommand));
  }

  /**
   * Provide audio feedback for recognized commands
   */
  private provideCommandFeedback(command: VoiceCommand): void {
    let feedback: string;

    switch (command.type) {
      case 'ADD_FOOTAGE':
        feedback = `Added ${(command as AddFootageCommand).value} feet`;
        break;
      case 'ADD_HARDWARE':
        feedback = `Added ${(command as AddHardwareCommand).item}`;
        break;
      case 'TAKE_PHOTO':
        feedback = 'Taking photo';
        break;
      case 'SUBMIT':
        feedback = 'Submitting';
        break;
      case 'CANCEL':
        feedback = 'Cancelled';
        break;
      case 'NAVIGATE_BACK':
        feedback = 'Going back';
        break;
      case 'NEXT_JOB':
        feedback = 'Next job';
        break;
      default:
        feedback = 'Command not recognized';
    }

    this.speak(feedback);
  }

  /**
   * Handle speech recognition errors
   */
  private handleError(event: SpeechRecognitionErrorEvent): void {
    console.error('[VoiceService] Recognition error:', event.error, event.message);

    this._state = 'error';

    // Map error codes to user-friendly messages
    const errorMessages: Record<string, string> = {
      'no-speech': 'No speech detected. Please try again.',
      'audio-capture': 'Microphone not available. Please check permissions.',
      'not-allowed': 'Microphone access denied. Please allow microphone access.',
      'network': 'Network error. Please check your connection.',
      'aborted': 'Recognition was aborted.',
      'language-not-supported': 'Language not supported.',
      'service-not-allowed': 'Speech recognition service not allowed.',
    };

    const voiceError: VoiceError = {
      code: event.error,
      message: errorMessages[event.error] || event.message || 'Unknown error occurred',
      timestamp: new Date(),
    };

    this.notifyError(voiceError);
  }

  /**
   * Handle recognition end event
   */
  private handleEnd(): void {
    console.log('[VoiceService] Recognition ended');

    if (this.autoRestart && this._state !== 'error') {
      // Auto-restart after a brief delay for continuous listening
      this.restartTimeout = setTimeout(() => {
        if (this.autoRestart && this.recognition) {
          try {
            this.recognition.start();
            console.log('[VoiceService] Auto-restarted');
          } catch (error) {
            console.error('[VoiceService] Auto-restart failed:', error);
          }
        }
      }, 100);
    } else {
      this._state = 'idle';
    }
  }

  /**
   * Notify all error callbacks
   */
  private notifyError(error: VoiceError): void {
    this.errorCallbacks.forEach((callback) => callback(error));
  }

  /**
   * Clean up resources
   */
  public destroy(): void {
    this.stop();
    this.commandCallbacks = [];
    this.errorCallbacks = [];
    this.interimCallbacks = [];
    if (this.synthesis) {
      this.synthesis.cancel();
    }
  }
}

// ============================================================================
// Singleton Instance & Convenience Functions
// ============================================================================

/** Singleton instance for app-wide use */
let voiceInstance: VoiceRecognition | null = null;

/**
 * Get or create the singleton VoiceRecognition instance
 */
export function getVoiceRecognition(): VoiceRecognition {
  if (!voiceInstance) {
    voiceInstance = new VoiceRecognition();
  }
  return voiceInstance;
}

/**
 * Check if voice commands are supported
 */
export function isVoiceSupported(): boolean {
  return !!(window.SpeechRecognition || window.webkitSpeechRecognition);
}

/**
 * Quick speak function without needing instance
 */
export function speak(text: string): void {
  getVoiceRecognition().speak(text);
}

// ============================================================================
// React Hook Helper
// ============================================================================

/**
 * Helper interface for React hook integration
 */
export interface VoiceHookState {
  isListening: boolean;
  isSupported: boolean;
  lastCommand: VoiceCommand | null;
  lastError: VoiceError | null;
  interimTranscript: string;
}

/**
 * Create initial state for React hook
 */
export function createVoiceHookState(): VoiceHookState {
  return {
    isListening: false,
    isSupported: isVoiceSupported(),
    lastCommand: null,
    lastError: null,
    interimTranscript: '',
  };
}

export default VoiceRecognition;
