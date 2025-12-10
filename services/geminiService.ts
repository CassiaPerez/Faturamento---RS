import { GoogleGenAI, Chat, GenerateContentResponse } from "@google/genai";

// Initialize the client
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });

// 1. Chatbot Logic (Gemini 3 Pro)
export const createChatSession = () => {
  return ai.chats.create({
    model: 'gemini-3-pro-preview',
    config: {
      systemInstruction: 'Você é um assistente IA especializado no sistema Cropflow. Ajude com dúvidas sobre pedidos, faturamento e status de sincronização. Responda de forma profissional e direta.',
    },
  });
};

export const sendMessageToChat = async (chat: Chat, message: string): Promise<string> => {
  try {
    const response: GenerateContentResponse = await chat.sendMessage({ message });
    return response.text || "Desculpe, não consegui processar sua resposta.";
  } catch (error) {
    console.error("Chat error:", error);
    return "Erro ao comunicar com a IA.";
  }
};

// 2. Fast Response Logic (Gemini 2.5 Flash Lite)
export const getFastAnalysis = async (prompt: string): Promise<string> => {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-lite', // Using requested lite model
      contents: prompt,
    });
    return response.text || "";
  } catch (error) {
    console.error("Fast analysis error:", error);
    return "";
  }
};

// 3. Search Grounding (Agro Market Data)
export const searchAgroInfo = async (query: string): Promise<{text: string, sources: any[]}> => {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: query,
      config: {
        tools: [{ googleSearch: {} }],
      },
    });

    const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
    const sources = groundingChunks
      .map((chunk: any) => chunk.web ? { uri: chunk.web.uri, title: chunk.web.title } : null)
      .filter((s: any) => s !== null);

    return {
      text: response.text || "Nenhuma informação encontrada.",
      sources: sources
    };
  } catch (error) {
    console.error("Search error:", error);
    return { text: "Erro na busca.", sources: [] };
  }
};

// 4. Maps Grounding (Client Location)
export const findClientLocation = async (clientName: string, cityContext: string): Promise<{text: string, maps: any[]}> => {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `Onde fica o cliente agrícola "${clientName}" em ou perto de ${cityContext}? Mostre detalhes.`,
      config: {
        tools: [{ googleMaps: {} }],
      },
    });
    
    const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
    const maps = groundingChunks
      .map((chunk: any) => chunk.maps ? { uri: chunk.maps.webUri || chunk.maps.uri, title: chunk.maps.title } : null)
      .filter((s: any) => s !== null);

    return {
      text: response.text || "Localização não encontrada.",
      maps: maps
    };
  } catch (error) {
     console.error("Maps error:", error);
     return { text: "Erro ao buscar mapa.", maps: [] };
  }
};

// 5. Thinking Mode (Complex Sync Analysis)
export const analyzeComplexSyncData = async (logData: string): Promise<string> => {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: `Analise este log de sincronização e identifique anomalias complexas ou padrões de erro que podem indicar problemas no arquivo CSV de origem. Sugira correções técnicas:\n\n${logData}`,
      config: {
        // REQUIRED: Set thinking budget for complex task
        thinkingConfig: { thinkingBudget: 32768 },
      }
    });
    return response.text || "Análise concluída sem insights.";
  } catch (error) {
    console.error("Thinking error:", error);
    return "Erro durante a análise profunda.";
  }
};