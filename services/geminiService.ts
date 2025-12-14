import { GoogleGenerativeAI } from "@google/generative-ai";

// Initialize the client
const ai = new GoogleGenerativeAI(import.meta.env.VITE_GEMINI_API_KEY || '');

let chatSession: any = null;

export const createChatSession = () => {
  try {
    const model = ai.getGenerativeModel({
      model: 'gemini-pro',
      systemInstruction: 'Você é um assistente IA especializado no sistema Cropflow. Ajude com dúvidas sobre pedidos, faturamento e status de sincronização. Responda de forma profissional e direta.'
    });
    chatSession = model.startChat({
      history: [],
    });
    return chatSession;
  } catch (error) {
    console.error("Error creating chat:", error);
    return null;
  }
};

export const sendMessageToChat = async (chat: any, message: string): Promise<string> => {
  try {
    if (!chat) return "Sessão de chat não iniciada.";
    const result = await chat.sendMessage(message);
    const response = await result.response;
    return response.text() || "Desculpe, não consegui processar sua resposta.";
  } catch (error) {
    console.error("Chat error:", error);
    return "Erro ao comunicar com a IA.";
  }
};

export const getFastAnalysis = async (prompt: string): Promise<string> => {
  try {
    const model = ai.getGenerativeModel({ model: 'gemini-pro' });
    const result = await model.generateContent(prompt);
    const response = await result.response;
    return response.text() || "";
  } catch (error) {
    console.error("Fast analysis error:", error);
    return "";
  }
};

export const searchAgroInfo = async (query: string): Promise<{text: string, sources: any[]}> => {
  try {
    const model = ai.getGenerativeModel({ model: 'gemini-pro' });
    const result = await model.generateContent(query);
    const response = await result.response;
    return {
      text: response.text() || "Nenhuma informação encontrada.",
      sources: []
    };
  } catch (error) {
    console.error("Search error:", error);
    return { text: "Erro na busca.", sources: [] };
  }
};

export const findClientLocation = async (clientName: string, cityContext: string): Promise<{text: string, maps: any[]}> => {
  try {
    const model = ai.getGenerativeModel({ model: 'gemini-pro' });
    const result = await model.generateContent(
      `Onde fica o cliente agrícola "${clientName}" em ou perto de ${cityContext}? Mostre detalhes.`
    );
    const response = await result.response;
    return {
      text: response.text() || "Localização não encontrada.",
      maps: []
    };
  } catch (error) {
     console.error("Maps error:", error);
     return { text: "Erro ao buscar mapa.", maps: [] };
  }
};

export const analyzeComplexSyncData = async (logData: string): Promise<string> => {
  try {
    const model = ai.getGenerativeModel({ model: 'gemini-pro' });
    const result = await model.generateContent(
      `Analise este log de sincronização e identifique anomalias complexas ou padrões de erro que podem indicar problemas no arquivo CSV de origem. Sugira correções técnicas:\n\n${logData}`
    );
    const response = await result.response;
    return response.text() || "Análise concluída sem insights.";
  } catch (error) {
    console.error("Thinking error:", error);
    return "Erro durante a análise profunda.";
  }
};