
import { GoogleGenAI, Modality } from "@google/genai";

export const geminiService = {
  // Use generateContent to get chat responses with search grounding support
  async getChatResponse(prompt: string, history: any[] = []) {
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
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
        // Access text as a property, not a method
        text: response.text || "", 
        sources: groundingChunks?.map((c: any) => c.web).filter(Boolean) || []
      };
    } catch (error) {
      console.error("Gemini API Error:", error);
      return { text: "Neural link disrupted.", sources: [] };
    }
  },

  // Simple text summary using a faster model
  async summarizeChat(messages: any[]) {
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const textToSummarize = messages.map(m => `${m.senderName}: ${m.text}`).join('\n');
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Please summarize the following conversation in 3-4 bullet points:\n\n${textToSummarize}`
      });
      return response.text;
    } catch (e) { return "Could not summarize."; }
  },

  // Image generation using the flash image model
  async generateImage(prompt: string) {
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: { parts: [{ text: prompt }] }
      });
      if (response.candidates?.[0]?.content?.parts) {
        for (const part of response.candidates[0].content.parts) {
          // Find the image part in the response
          if (part.inlineData) return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
        }
      }
      return null;
    } catch (e) { return null; }
  },

  // Video generation using Veo model with recommended polling logic
  async generateVideo(prompt: string) {
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      let operation = await ai.models.generateVideos({
        model: 'veo-3.1-fast-generate-preview',
        prompt,
        config: { numberOfVideos: 1, resolution: '720p', aspectRatio: '16:9' }
      });
      
      // Wait for operation completion using 10s intervals
      while (!operation.done) {
        await new Promise(resolve => setTimeout(resolve, 10000));
        operation = await ai.operations.getVideosOperation({ operation: operation });
      }
      
      const downloadLink = operation.response?.generatedVideos?.[0]?.video?.uri;
      // Must append API key when fetching from the download link
      return `${downloadLink}&key=${process.env.API_KEY}`;
    } catch (e) {
      console.error("Video Gen Error:", e);
      return null;
    }
  }
};
