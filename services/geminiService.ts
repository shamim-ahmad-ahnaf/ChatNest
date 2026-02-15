
import { GoogleGenAI } from "@google/genai";

export const geminiService = {
  async getChatResponse(prompt: string, history: any[] = []) {
    try {
      const apiKey = process.env.API_KEY;
      if (!apiKey) throw new Error("API Key is missing");

      const ai = new GoogleGenAI({ apiKey });
      const response = await ai.models.generateContent({
        model: 'gemini-3-pro-preview',
        contents: [
            ...history.map(h => ({ role: h.role === 'model' ? 'model' : 'user', parts: [{ text: h.text }] })),
            { role: 'user', parts: [{ text: prompt }] }
        ],
        config: {
          systemInstruction: "You are Neo, a futuristic AI friend. You are witty and helpful. Provide grounding sources when using search.",
          tools: [{ googleSearch: {} }]
        }
      });
      
      const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
      return { 
        text: response.text || "I'm processing but couldn't generate text.", 
        sources: groundingChunks?.map((c: any) => c.web).filter(Boolean) || []
      };
    } catch (error) {
      console.error("Gemini API Error:", error);
      return { text: "Connection to the neural network failed. Please check your API key.", sources: [] };
    }
  },

  async generateImage(prompt: string) {
    try {
      const apiKey = process.env.API_KEY;
      if (!apiKey) return null;
      
      const ai = new GoogleGenAI({ apiKey });
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: { parts: [{ text: prompt }] }
      });
      if (response.candidates?.[0]?.content?.parts) {
        for (const part of response.candidates[0].content.parts) {
          if (part.inlineData) return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
        }
      }
      return null;
    } catch (e) { return null; }
  },

  async generateVideo(prompt: string) {
    try {
      const apiKey = process.env.API_KEY;
      if (!apiKey) return null;

      const ai = new GoogleGenAI({ apiKey });
      let operation = await ai.models.generateVideos({
        model: 'veo-3.1-fast-generate-preview',
        prompt,
        config: { numberOfVideos: 1, resolution: '720p', aspectRatio: '16:9' }
      });
      
      while (!operation.done) {
        await new Promise(resolve => setTimeout(resolve, 10000));
        operation = await ai.operations.getVideosOperation({ operation: operation });
      }
      
      const downloadLink = operation.response?.generatedVideos?.[0]?.video?.uri;
      return `${downloadLink}&key=${apiKey}`;
    } catch (e) {
      console.error("Video Gen Error:", e);
      return null;
    }
  }
};
