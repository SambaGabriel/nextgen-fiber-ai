
import { GoogleGenAI, Type } from "@google/genai";
import { AuditResult, AuditStatus, MapAnalysisResult, Language, MarketAnalysis, FieldReport } from "../types";

const getAi = () => new GoogleGenAI({ apiKey: process.env.API_KEY });

// Safe ID Generator for browser environments (avoids crypto.randomUUID crash on http)
const generateId = () => Date.now().toString(36) + Math.random().toString(36).substr(2, 9);

// --- CÉREBRO DE ENGENHARIA (STRICT PDF LAYER EXTRACTION) ---
const BOQ_ENGINE_INSTRUCTION = `
ROLE: Senior OSP Drawing Analyst.
MISSION: Convert Technical Drawings (PDF) into high-fidelity Digital Twin data layers.

CRITICAL PROTOCOLS:
1. **LEGEND IS SUPREME**: Your first task is to find the "LEGEND" or "SYMBOLOGY" box. Identify:
   - Color code for fiber sizes (e.g., Pink = 144F, Blue = 288F).
   - Line types (Solid = Aerial, Dashed/Dotted = Trenching/Sulcos).
   - Symbols (MST terminals, Splice points, Guy anchors).
2. **SUMMARY BOX ANALYSIS**: Extract precise footage and counts from the official "Summary Table" or "Project Notes" area. Do not estimate if numbers are printed.
3. **NO HALLUCINATIONS**: If a route is not clearly labeled in the PDF, do not invent it. Report ONLY what is visual/textual in the drawing.
4. **GEOSPATIAL ANCHOR**: Look for GPS coordinates (Lat/Long) or Street Addresses to anchor the map.
5. **SULCOS (FURROWS)**: Identify exact trenching paths and quantify them separately from aerial spans.

OUTPUT: Return structured JSON with "colorCode" for each segment according to the legend.
`;

export const analyzeMapBoQ = async (base64Data: string, mimeType: string, lang: Language = Language.PT): Promise<MapAnalysisResult> => {
    try {
        const ai = getAi();
        const cleanBase64 = base64Data.includes('base64,') ? base64Data.split('base64,')[1] : base64Data;

        const response = await ai.models.generateContent({
            model: 'gemini-3-pro-preview',
            contents: {
                parts: [
                    { inlineData: { mimeType: mimeType, data: cleanBase64 } },
                    { text: `PERFORM STRICT BOQ EXTRACTION. Priority 1: Read LEGEND and apply color codes. Priority 2: Extract Sumário Section. Language: ${lang}.` }
                ]
            },
            config: {
                systemInstruction: BOQ_ENGINE_INSTRUCTION,
                responseMimeType: "application/json",
                temperature: 0,
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        totalCableLength: { type: Type.NUMBER },
                        aerialFootage: { type: Type.NUMBER },
                        undergroundFootage: { type: Type.NUMBER },
                        cableType: { type: Type.STRING },
                        spanCount: { type: Type.NUMBER },
                        anchorCount: { type: Type.NUMBER },
                        mstCount: { type: Type.NUMBER },
                        difficultyRating: { type: Type.STRING, description: "Official Project Summary/Notes" },
                        projectStartGps: {
                            type: Type.OBJECT,
                            properties: { lat: { type: Type.NUMBER }, lng: { type: Type.NUMBER }, label: { type: Type.STRING } },
                            nullable: true
                        },
                        segments: {
                            type: Type.ARRAY,
                            items: {
                                type: Type.OBJECT,
                                properties: {
                                    id: { type: Type.STRING },
                                    length: { type: Type.NUMBER },
                                    type: { type: Type.STRING, enum: ["AERIAL", "UNDERGROUND"] },
                                    fiberType: { type: Type.STRING },
                                    colorCode: { type: Type.STRING, description: "HEX color from Legend" },
                                    startNode: { type: Type.STRING },
                                    endNode: { type: Type.STRING }
                                }
                            }
                        },
                        materialList: { 
                            type: Type.ARRAY, 
                            items: { 
                                type: Type.OBJECT, 
                                properties: { item: { type: Type.STRING }, quantity: { type: Type.NUMBER }, unit: { type: Type.STRING }, category: { type: Type.STRING } } 
                            } 
                        },
                        financials: { type: Type.OBJECT, properties: { estimatedLaborCost: { type: Type.NUMBER }, potentialSavings: { type: Type.NUMBER } } },
                        detectedAnomalies: { type: Type.ARRAY, items: { type: Type.STRING } }
                    },
                    required: ["totalCableLength", "materialList", "segments"]
                }
            }
        });
        
        return JSON.parse(response.text || "{}");
    } catch (error) {
        console.error("Drawing Analysis Error:", error);
        throw error;
    }
};

export const analyzeFieldEvidence = async (base64Image: string, lang: Language = Language.PT): Promise<any> => {
    try {
        const ai = getAi();
        const cleanBase64 = base64Image.includes('base64,') ? base64Image.split('base64,')[1] : base64Image;
        const response = await ai.models.generateContent({
            model: 'gemini-3-pro-preview',
            contents: {
                parts: [
                    { inlineData: { mimeType: 'image/jpeg', data: cleanBase64 } },
                    { text: `GENERATE BILINGUAL (PT/EN) TECHNICAL FIELD AUDIT.` }
                ]
            },
            config: { systemInstruction: "ARCH-ARCHITECT ENGINE", responseMimeType: "application/json" }
        });
        return JSON.parse(response.text || "{}");
    } catch (error) { throw error; }
};

export const analyzeMarketExpansion = async (base64Image: string, regionName: string): Promise<MarketAnalysis> => {
    try {
        const ai = getAi();
        const cleanBase64 = base64Image.includes('base64,') ? base64Image.split('base64,')[1] : base64Image;
        const response = await ai.models.generateContent({
            model: 'gemini-3-pro-preview',
            contents: {
                parts: [
                    { inlineData: { mimeType: 'image/jpeg', data: cleanBase64 } },
                    { text: `Analyze map for expansion in ${regionName}.` }
                ]
            },
            config: { responseMimeType: "application/json" }
        });
        return JSON.parse(response.text || "{}");
    } catch (error) { throw error; }
};

export const generateFieldReport = async (transcript: string, author: string): Promise<FieldReport> => {
    try {
        const ai = getAi();
        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: { parts: [{ text: transcript }] },
            config: { responseMimeType: "application/json" }
        });
        const data = JSON.parse(response.text || "{}");
        return { 
            id: generateId(), 
            timestamp: new Date().toISOString(), 
            author, 
            rawTranscript: transcript, 
            summaryEN: data.summaryEN || "", 
            summaryPT: data.summaryPT || "", 
            category: 'DAILY_LOG', 
            tags: [] 
        };
    } catch (error) { throw error; }
};

export const analyzeConstructionImage = async (base64Image: string, lang: Language = Language.PT): Promise<AuditResult> => {
    try {
        const ai = getAi();
        const cleanBase64 = base64Image.includes('base64,') ? base64Image.split('base64,')[1] : base64Image;
        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: { parts: [{ inlineData: { mimeType: 'image/jpeg', data: cleanBase64 } }] },
            config: { responseMimeType: "application/json" }
        });
        const result = JSON.parse(response.text || "{}");
        return { 
            id: generateId(), 
            timestamp: new Date().toISOString(), 
            status: result.status || AuditStatus.PENDING, 
            complianceScore: result.complianceScore || 0, 
            detectedItems: [], 
            issues: [], 
            aiSummary: result.aiSummary || "", 
            auditedBy: "System", 
            companyName: "FS" 
        };
    } catch (e) { throw e; }
};

export const generateSimulationVideo = async (): Promise<string | null> => {
    try {
        const ai = getAi();
        let operation = await ai.models.generateVideos({ model: 'veo-3.1-fast-generate-preview', prompt: "High quality engineering shot", config: { numberOfVideos: 1, resolution: '1080p', aspectRatio: '9:16' } });
        while (!operation.done) { await new Promise(resolve => setTimeout(resolve, 8000)); operation = await ai.operations.getVideosOperation({ operation: operation }); }
        const downloadLink = operation.response?.generatedVideos?.[0]?.video?.uri;
        if (!downloadLink) return null;
        const response = await fetch(`${downloadLink}&key=${process.env.API_KEY}`);
        const blob = await response.blob();
        return URL.createObjectURL(blob);
    } catch (error) { return null; }
};

export const createChatSession = (lang: Language = Language.PT) => {
    const ai = getAi();
    return ai.chats.create({ model: 'gemini-3-flash-preview', config: { systemInstruction: `Support Assistant. Lang: ${lang}` } });
};

export const createFieldAssistantSession = (lang: Language = Language.PT) => {
    const ai = getAi();
    return ai.chats.create({ model: 'gemini-3-flash-preview', config: { systemInstruction: `Lineman Assistant. Lang: ${lang}` } });
};

export const editImageWithGemini = async (base64ImageData: string, promptString: string): Promise<string | null> => {
    const ai = getAi();
    const response = await ai.models.generateContent({ model: 'gemini-2.5-flash-image', contents: { parts: [{ inlineData: { mimeType: 'image/png', data: base64ImageData } }, { text: promptString }] } });
    for (const part of response.candidates[0].content.parts) { if (part.inlineData) return `data:image/png;base64,${part.inlineData.data}`; }
    return null;
};

export const generateVideoWithVeo = async (base64ImageData: string, promptString: string, aspectRatio: '16:9' | '9:16'): Promise<string> => {
    const ai = getAi();
    let operation = await ai.models.generateVideos({ model: 'veo-3.1-fast-generate-preview', prompt: promptString, image: { imageBytes: base64ImageData, mimeType: 'image/png' }, config: { numberOfVideos: 1, resolution: '720p', aspectRatio } });
    while (!operation.done) { await new Promise(resolve => setTimeout(resolve, 10000)); operation = await ai.operations.getVideosOperation({ operation: operation }); }
    const response = await fetch(`${operation.response?.generatedVideos?.[0]?.video?.uri}&key=${process.env.API_KEY}`);
    const blob = await response.blob();
    return URL.createObjectURL(blob);
};
