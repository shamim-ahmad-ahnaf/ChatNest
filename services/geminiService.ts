
import { GoogleGenAI } from "@google/genai";

export const geminiService = {
  async getChatResponse(prompt: string, history: any[] = []) {
    try {
      const apiKey = process.env.API_KEY;
      if (!apiKey) throw new Error("API Key is missing");

      // Always create a new instance to ensure up-to-date API key from the selection dialog
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const response = await ai.models.generateContent({
        model: 'gemini-3-pro-preview',
        contents: [
            ...history.map(h => ({ role: h.role === 'model' ? 'model' : 'user', parts: [{ text: h.text }] })),
            { role: 'user', parts: [{ text: prompt }] }
        ],
        config: {
          systemInstruction: "You are Neo, a futuristic AI friend living in ChatNest. You are witty, helpful, and love metaphors. Use search grounding for facts.",
          tools: [{ googleSearch: {} }]
        }
      });
      
      const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
      return { 
        text: response.text || "I'm processing but couldn't generate text.", 
        sources: groundingChunks?.map((c: any) => c.web).filter(Boolean) || []
      };
    } catch (error: any) {
      console.error("Gemini API Error:", error);
      // If the request fails with "Requested entity was not found", the API key might be invalid or from an unpaid project
      if (error?.message?.includes("Requested entity was not found")) {
        window.aistudio?.openSelectKey();
      }
      return { text: "Connection to the neural network failed. Please verify your API key in Settings.", sources: [] };
    }
  },

  async generateImage(prompt: string) {
    try {
      const apiKey = process.env.API_KEY;
      if (!apiKey) return null;
      
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: { parts: [{ text: prompt }] }
      });
      if (response.candidates?.[0]?.content?.parts) {
        for (const part of response.candidates[0].content.parts) {
          // Nano banana models return images in inlineData parts
          if (part.inlineData) return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
        }
      }
      return null;
    } catch (error: any) { 
      if (error?.message?.includes("Requested entity was not found")) {
        window.aistudio?.openSelectKey();
      }
      return null; 
    }
  },

  async generateVideo(prompt: string) {
    try {
      const apiKey = process.env.API_KEY;
      if (!apiKey) return null;

      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      let operation = await ai.models.generateVideos({
        model: 'veo-3.1-fast-generate-preview',
        prompt,
        config: { 
          numberOfVideos: 1, 
          resolution: '720p', 
          aspectRatio: '16:9' 
        }
      });
      
      // Poll for video completion as per Veo requirements
      while (!operation.done) {
        await new Promise(resolve => setTimeout(resolve, 10000));
        operation = await ai.operations.getVideosOperation({ operation: operation });
      }
      
      const downloadLink = operation.response?.generatedVideos?.[0]?.video?.uri;
      // Must append API key when fetching from the download link
      return `${downloadLink}&key=${process.env.API_KEY}`;
    } catch (error: any) {
      console.error("Video Gen Error:", error);
      if (error?.message?.includes("Requested entity was not found")) {
        window.aistudio?.openSelectKey();
      }
      return null;
    }
  }
};
