import {
  GoogleGenerativeAI,
  ChatSession,
  GenerateContentResponse
} from "@google/generative-ai";

const apiKey = import.meta.env.VITE_GEMINI_API_KEY;

if (!apiKey) {
  console.error("⚠️ ERRO: VITE_GEMINI_API_KEY não foi definida.");
}

const genAI = new GoogleGenerativeAI(apiKey);

// 1. Chatbot (Gemini 3 Pro)
export const createChatSession = (): ChatSession => {
  const model = genAI.getGenerativeModel({
    model: "gemini-3-pro-preview",
    systemInstruction:
      "Você é um assistente IA especializado no sistema Cropflow. Ajude com dúvidas sobre pedidos, faturamento e status de sincronização. Responda de forma profissional e direta."
  });

  return model.startChat({
    history: [],
    generationConfig: {
      temperature: 0.7
    }
  });
};

export const sendMessageToChat = async (
  chat: ChatSession,
  message: string
): Promise<string> => {
  try {
    const response: GenerateContentResponse = await chat.sendMessage(message);
    return response.response.text() || "Desculpe, não consegui processar sua resposta.";
  } catch (error) {
    console.error("Chat error:", error);
    return "Erro ao comunicar com a IA.";
  }
};

// 2. Fast Response (Gemini 2.5 Flash Lite)
export const getFastAnalysis = async (prompt: string): Promise<string> => {
  try {
    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash-lite"
    });

    const response = await model.generateContent(prompt);
    return response.response.text();
  } catch (error) {
    console.error("Fast analysis error:", error);
    return "";
  }
};

// 3. Search Grounding
export const searchAgroInfo = async (
  query: string
): Promise<{ text: string; sources: any[] }> => {
  try {
    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
      tools: [{ googleSearch: {} }]
    });

    const response = await model.generateContent(query);

    const groundingChunks =
      response.response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];

    const sources = groundingChunks
      .map((chunk: any) =>
        chunk.web ? { uri: chunk.web.uri, title: chunk.web.title } : null
      )
      .filter(Boolean);

    return {
      text: response.response.text() || "Nenhuma informação encontrada.",
      sources
    };
  } catch (error) {
    console.error("Search error:", error);
    return { text: "Erro na busca.", sources: [] };
  }
};

// 4. Maps Grounding
export const findClientLocation = async (
  clientName: string,
  cityContext: string
): Promise<{ text: string; maps: any[] }> => {
  try {
    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
      tools: [{ googleMaps: {} }]
    });

    const response = await model.generateContent(
      `Onde fica o cliente agrícola "${clientName}" em ou perto de ${cityContext}? Mostre detalhes.`
    );

    const groundingChunks =
      response.response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];

    const maps = groundingChunks
      .map((chunk: any) =>
        chunk.maps
          ? { uri: chunk.maps.webUri || chunk.maps.uri, title: chunk.maps.title }
          : null
      )
      .filter(Boolean);

    return {
      text: response.response.text() || "Localização não encontrada.",
      maps
    };
  } catch (error) {
    console.error("Maps error:", error);
    return { text: "Erro ao buscar mapa.", maps: [] };
  }
};

// 5. Thinking Mode (Long Context Analysis)
export const analyzeComplexSyncData = async (
  logData: string
): Promise<string> => {
  try {
    const model = genAI.getGenerativeModel({
      model: "gemini-3-pro-preview",
      thinkingConfig: {
        thinkingBudget: 32768 // LONG reasoning
      }
    });

    const prompt = `Analise este log de sincronização e identifique anomalias complexas ou padrões de erro que podem indicar problemas no arquivo CSV de origem. Sugira correções técnicas:\n\n${logData}`;

    const response = await model.generateContent(prompt);

    return response.response.text() || "Análise concluída sem insights.";
  } catch (error) {
    console.error("Thinking error:", error);
    return "Erro durante a análise profunda.";
  }
};
