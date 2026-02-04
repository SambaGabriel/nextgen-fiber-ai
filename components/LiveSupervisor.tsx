
import React, { useEffect, useRef, useState } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality } from "@google/genai";
import { Mic, MicOff, PhoneOff, Radio, User, FileText, Download, Loader2, CheckCircle2, AlertTriangle, ShieldAlert, BrainCircuit } from 'lucide-react';
import FiberLoader from './FiberLoader';
import { jsPDF } from 'jspdf';

interface LiveSupervisorProps {
    onClose: () => void;
    userName: string;
}

interface TranscriptionItem {
    role: 'user' | 'model';
    text: string;
    timestamp: string;
}

function floatTo16BitPCM(input: Float32Array) {
    const output = new Int16Array(input.length);
    for (let i = 0; i < input.length; i++) {
        const s = Math.max(-1, Math.min(1, input[i]));
        output[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
    }
    return output.buffer;
}

function base64ToUint8Array(base64: string) {
    const binaryString = atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
}

function arrayBufferToBase64(buffer: ArrayBuffer) {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
}

const LiveSupervisor: React.FC<LiveSupervisorProps> = ({ onClose, userName }) => {
    const [status, setStatus] = useState<'connecting' | 'connected' | 'processing_report' | 'report_ready' | 'error' | 'closed'>('connecting');
    const [isMuted, setIsMuted] = useState(false);
    const [isTalking, setIsTalking] = useState(false); 
    const [isThinking, setIsThinking] = useState(false); // Simulated comprehension delay
    const [violationDetected, setViolationDetected] = useState(false);
    
    const audioContextRef = useRef<AudioContext | null>(null);
    const inputContextRef = useRef<AudioContext | null>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const processorRef = useRef<ScriptProcessorNode | null>(null);
    const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
    const nextStartTimeRef = useRef<number>(0);
    const activeSourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
    const sessionRef = useRef<any>(null);

    const transcriptionHistoryRef = useRef<TranscriptionItem[]>([]);
    const currentInputRef = useRef<string>('');
    const currentOutputRef = useRef<string>('');

    useEffect(() => {
        startSession();
        return () => cleanupAudio();
    }, []);

    const startSession = async () => {
        try {
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
            
            inputContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
            audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
            
            const stream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, sampleRate: 16000 }});
            streamRef.current = stream;

            const config = {
                model: 'gemini-2.5-flash-native-audio-preview-12-2025',
                config: {
                    responseModalities: [Modality.AUDIO],
                    inputAudioTranscription: {}, 
                    outputAudioTranscription: {},
                    speechConfig: {
                        voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Charon' } }, // Mature, objective tone
                    },
                    systemInstruction: `
                        ROLE: You are the Infrastructure Sentinel (The Arch-Architect). 
                        TONE: Educated, objective, visionary, and calm. 
                        USER: ${userName}, a technician in the field.

                        BEHAVIORAL RULES:
                        1. **Listen Deeply**: Let the user finish their report entirely. Do not jump to conclusions. The technician's data is the absolute priority.
                        2. **Wait to Process**: Before responding, pause for a moment to consider the future of the network. Demonstrate foresight.
                        3. **Stop on Interruption**: If the user interrupts you, stop speaking immediately and listen. Their real-time field data overrides your current output.
                        4. **Offer Tangible Alternatives**: If a safety standard (like NESC 235 or 232) is compromised, propose objective engineering alternatives such as relocation, undergrounding, or using specialized dielectric brackets.
                        5. **Problem Solver for Humanity**: You are building the digital nervous system of our species. Every decision must be rooted in long-term safety and objective regulatory compliance.

                        SAFETY ENFORCEMENT:
                        - NESC 235 (Separation): 40 inches.
                        - NESC 232 (Clearance): 15.5 ft.
                        Base every response on these standards.
                    `,
                },
            };

            const sessionPromise = ai.live.connect({
                ...config,
                callbacks: {
                    onopen: () => {
                        setStatus('connected');
                        if (!inputContextRef.current) return;
                        sourceRef.current = inputContextRef.current.createMediaStreamSource(stream);
                        processorRef.current = inputContextRef.current.createScriptProcessor(4096, 1, 1);
                        
                        processorRef.current.onaudioprocess = (e) => {
                            if (isMuted) return;
                            const inputData = e.inputBuffer.getChannelData(0);
                            const pcm16 = floatTo16BitPCM(inputData);
                            const base64Data = arrayBufferToBase64(pcm16);
                            sessionPromise.then(session => session.sendRealtimeInput({ media: { mimeType: 'audio/pcm;rate=16000', data: base64Data } }));
                        };
                        
                        sourceRef.current.connect(processorRef.current);
                        processorRef.current.connect(inputContextRef.current.destination);
                    },
                    onmessage: async (msg: LiveServerMessage) => {
                        // HANDLE INTERRUPTION
                        if (msg.serverContent?.interrupted) {
                            activeSourcesRef.current.forEach(source => {
                                try { source.stop(); } catch(e) {}
                                activeSourcesRef.current.delete(source);
                            });
                            nextStartTimeRef.current = 0;
                            setIsTalking(false);
                            setIsThinking(false);
                            return;
                        }

                        const audioData = msg.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
                        if (audioData && audioContextRef.current) {
                            // SIMULATED COMPREHENSION DELAY
                            setIsThinking(true);
                            await new Promise(r => setTimeout(r, 1200)); 
                            setIsThinking(false);
                            
                            setIsTalking(true);
                            const audioBytes = base64ToUint8Array(audioData);
                            const int16Data = new Int16Array(audioBytes.buffer);
                            const float32Buffer = audioContextRef.current.createBuffer(1, int16Data.length, 24000);
                            const channelData = float32Buffer.getChannelData(0);
                            for (let i = 0; i < int16Data.length; i++) {
                                channelData[i] = int16Data[i] / 32768.0;
                            }
                            const source = audioContextRef.current.createBufferSource();
                            source.buffer = float32Buffer;
                            source.connect(audioContextRef.current.destination);
                            
                            const currentTime = audioContextRef.current.currentTime;
                            if (nextStartTimeRef.current < currentTime) nextStartTimeRef.current = currentTime;
                            source.start(nextStartTimeRef.current);
                            nextStartTimeRef.current += float32Buffer.duration;
                            
                            activeSourcesRef.current.add(source);
                            source.onended = () => {
                                activeSourcesRef.current.delete(source);
                                if (activeSourcesRef.current.size === 0) setIsTalking(false);
                            };
                        }

                        if (msg.serverContent?.inputTranscription) {
                            currentInputRef.current += msg.serverContent.inputTranscription.text;
                        }

                        if (msg.serverContent?.outputTranscription) {
                            const text = msg.serverContent.outputTranscription.text;
                            currentOutputRef.current += text;
                            const upperText = text.toUpperCase();
                            if (upperText.includes("STOP WORK") || upperText.includes("VIOLATION") || upperText.includes("DANGER")) {
                                setViolationDetected(true);
                                setTimeout(() => setViolationDetected(false), 8000);
                            }
                        }

                        if (msg.serverContent?.turnComplete) {
                            if (currentInputRef.current.trim()) {
                                transcriptionHistoryRef.current.push({
                                    role: 'user',
                                    text: currentInputRef.current.trim(),
                                    timestamp: new Date().toLocaleTimeString()
                                });
                                currentInputRef.current = '';
                            }
                            if (currentOutputRef.current.trim()) {
                                transcriptionHistoryRef.current.push({
                                    role: 'model',
                                    text: currentOutputRef.current.trim(),
                                    timestamp: new Date().toLocaleTimeString()
                                });
                                currentOutputRef.current = '';
                            }
                        }
                    },
                    onclose: () => {},
                    onerror: (err) => { console.error(err); setStatus('error'); }
                }
            });
            sessionRef.current = sessionPromise;

        } catch (e) {
            console.error("Connection failed", e);
            setStatus('error');
        }
    };

    const cleanupAudio = () => {
        if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
        if (processorRef.current) processorRef.current.disconnect();
        if (sourceRef.current) sourceRef.current.disconnect();
        if (inputContextRef.current) inputContextRef.current.close();
        if (audioContextRef.current) audioContextRef.current.close();
        activeSourcesRef.current.forEach(s => { try { s.stop(); } catch(e) {} });
        activeSourcesRef.current.clear();
    };

    const handleEndCall = async () => {
        cleanupAudio();
        setStatus('processing_report');
        try {
            await generateAndDownloadReport();
            setStatus('report_ready');
        } catch (e) {
            console.error("Report error", e);
            onClose();
        }
    };

    const generateAndDownloadReport = async () => {
        const historyText = transcriptionHistoryRef.current.map(t => `${t.timestamp} [${t.role === 'user' ? 'LINEMAN' : 'SUPERVISOR'}]: ${t.text}`).join('\n');
        if (!historyText) { onClose(); return; }

        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        const prompt = `
            ACT AS: Senior Infrastructure Auditor with objective foresight.
            TRANSCRIPT: ${historyText}
            TASK: Generate an objective safety log in JSON format with these fields:
            - summary: Brief summary of the conversation (2-3 sentences)
            - violations: Array of any NESC 232/235 violations detected (empty array if none)
            - recommendations: Array of suggested alternatives
            - language: The primary language used in the conversation (EN, ES, or PT)
            Identify NESC 232/235 violations and record suggested alternatives. Include the foresight impact.
        `;
        const response = await ai.models.generateContent({
            model: "gemini-3-flash-preview",
            contents: prompt,
            config: { responseMimeType: "application/json" }
        });
        const responseText = response.text;
        if (!responseText) throw new Error("Empty response");
        const reportData = JSON.parse(responseText);

        // Generate PDF
        generatePDF(reportData, historyText);

        // Send email to ngf@nextgenfiberllc.com
        await sendReportEmail(historyText, reportData);
    };

    const sendReportEmail = async (transcript: string, reportData: any) => {
        try {
            const response = await fetch('/api/v1/email/send-supervisor-report', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    lineman_name: userName,
                    report_date: new Date().toISOString().split('T')[0],
                    transcript: transcript,
                    summary: reportData.summary || null,
                    violations: reportData.violations || null
                })
            });

            if (!response.ok) {
                console.error('Failed to send email report');
            } else {
                console.log('Report sent to ngf@nextgenfiberllc.com');
            }
        } catch (error) {
            console.error('Email send error:', error);
            // Don't throw - email failure shouldn't block the user
        }
    };

    const generatePDF = (data: any, fullTranscript: string) => {
        const doc = new jsPDF();
        const width = doc.internal.pageSize.getWidth();
        doc.setFillColor(11, 17, 33);
        doc.rect(0, 0, width, 40, 'F');
        doc.setTextColor(255, 85, 0);
        doc.setFontSize(22);
        doc.text("SENTINEL AI - SAFETY REPORT", 15, 20);
        doc.save(`Sentinel_Safety_Log_${new Date().toISOString().slice(0,10)}.pdf`);
    };

    return (
        <div className={`fixed inset-0 z-[200] backdrop-blur-xl flex flex-col items-center justify-between py-12 animate-in slide-in-from-bottom duration-500 transition-colors ${violationDetected ? 'bg-red-950/90' : 'bg-black/90'}`}>
            <div className="text-center space-y-2">
                <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full border transition-all ${violationDetected ? 'bg-red-600 border-red-400 animate-pulse' : 'bg-emerald-500/10 border-emerald-500/30'}`}>
                    <div className={`w-2 h-2 rounded-full ${violationDetected ? 'bg-white' : status === 'connected' ? 'bg-emerald-500 animate-pulse' : 'bg-slate-500'}`} />
                    <span className="text-[10px] font-black text-white uppercase tracking-widest">
                        {violationDetected ? 'CRITICAL SAFETY ALERT' : isThinking ? 'SENTINEL IS PROCESSING...' : 'INFRASTRUCTURE SENTINEL ONLINE'}
                    </span>
                </div>
                <h3 className="text-xl font-black text-white uppercase tracking-wider">The Arch-Architect</h3>
                <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Educated Foresight & Logic</p>
            </div>

            <div className="relative w-64 h-64 flex items-center justify-center">
                {isThinking ? (
                    <div className="flex flex-col items-center gap-4">
                        <BrainCircuit className="w-16 h-16 text-fs-brand animate-pulse" />
                        <p className="text-xs text-white font-bold uppercase tracking-widest">Synthesizing Logic...</p>
                    </div>
                ) : (
                    <>
                        <div className={`absolute z-10 w-32 h-32 rounded-full border-4 flex items-center justify-center overflow-hidden shadow-2xl transition-all ${violationDetected ? 'bg-red-600 border-red-400 scale-110' : 'bg-slate-800 border-[#0b1121]'}`}>
                            {violationDetected ? <ShieldAlert className="w-16 h-16 text-white animate-bounce" /> : <User className="w-16 h-16 text-slate-400" />}
                        </div>
                        <div className={`absolute inset-0 rounded-full border-2 transition-all duration-100 ${violationDetected ? 'border-red-500 scale-150 opacity-100 animate-ping' : `border-emerald-500/50 ${isTalking ? 'scale-150 opacity-100 animate-pulse' : 'scale-100 opacity-20'}`}`} />
                    </>
                )}
            </div>

            {violationDetected && (
                <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 mt-32 text-center animate-bounce">
                    <h1 className="text-4xl font-black text-red-500 uppercase tracking-tighter bg-black/50 px-6 py-2 rounded-xl backdrop-blur-md border border-red-500">STOP WORK</h1>
                    <p className="text-white font-bold uppercase tracking-widest mt-2 text-sm bg-red-600/80 px-4 py-1 rounded">Alternative Mitigation Active</p>
                </div>
            )}

            <div className="w-full max-w-sm px-8 grid grid-cols-3 gap-6 items-center">
                <button onClick={() => setIsMuted(!isMuted)} className={`aspect-square rounded-full flex items-center justify-center border transition-all ${isMuted ? 'bg-white text-black border-white' : 'bg-white/10 text-white border-white/10 hover:bg-white/20'}`}>
                    {isMuted ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
                </button>
                <button onClick={handleEndCall} className="aspect-square rounded-full bg-rose-600 flex items-center justify-center shadow-[0_0_30px_rgba(225,29,72,0.4)] hover:scale-110 active:scale-95 transition-all">
                    <PhoneOff className="w-8 h-8 text-white fill-white" />
                </button>
                <div className="aspect-square rounded-full bg-white/5 border border-white/10 flex items-center justify-center">
                    <Radio className="w-6 h-6 text-emerald-500" />
                </div>
            </div>
            <p className="text-[10px] font-bold text-slate-600 uppercase tracking-widest mt-4">HUMANITY-DRIVEN INFRASTRUCTURE AUDIT</p>
        </div>
    );
};

export default LiveSupervisor;
