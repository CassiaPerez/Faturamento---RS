import React, { useState, useRef, useEffect } from 'react';
import { createChatSession, sendMessageToChat } from '../services/geminiService';
import { GeminiMessage } from '../types';
import { MessageSquare, X, Send, Sparkles, Bot } from 'lucide-react';

const GeminiChat: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<GeminiMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  const chatSession = useRef<any>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen && !chatSession.current) {
      chatSession.current = createChatSession();
      setMessages([{
        role: 'model',
        text: 'Olá! Sou seu assistente virtual Cropfield. Como posso ajudar com seus pedidos ou relatórios hoje?',
        timestamp: new Date()
      }]);
    }
  }, [isOpen]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!inputValue.trim()) return;

    const userMsg: GeminiMessage = { role: 'user', text: inputValue, timestamp: new Date() };
    setMessages(prev => [...prev, userMsg]);
    setInputValue('');
    setIsLoading(true);

    try {
      if (!chatSession.current) chatSession.current = createChatSession();
      const responseText = await sendMessageToChat(chatSession.current, userMsg.text);
      
      const modelMsg: GeminiMessage = { role: 'model', text: responseText, timestamp: new Date() };
      setMessages(prev => [...prev, modelMsg]);
    } catch (e) {
      setMessages(prev => [...prev, { role: 'model', text: 'Desculpe, ocorreu um erro.', timestamp: new Date() }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end">
      {isOpen && (
        <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-[400px] h-[600px] flex flex-col mb-4 transition-all animate-scale-in overflow-hidden">
          
          {/* Header */}
          <div className="bg-gradient-to-r from-brand-600 to-indigo-700 text-white p-4 flex justify-between items-center shadow-md relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-10">
              <Sparkles size={80} />
            </div>
            <div className="flex items-center gap-3 relative z-10">
              <div className="p-2 bg-white/20 rounded-lg backdrop-blur-sm">
                <Bot size={20} className="text-white" />
              </div>
              <div>
                <h3 className="font-bold flex items-center gap-2 text-sm">
                  Cropfield AI
                </h3>
                <p className="text-[10px] text-blue-100 opacity-90 font-medium">Gemini 3 Pro Powered</p>
              </div>
            </div>
            <button 
              onClick={() => setIsOpen(false)} 
              className="text-white/80 hover:text-white hover:bg-white/20 rounded-lg p-1.5 transition-colors relative z-10"
            >
              <X size={18} />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50 scroll-smooth">
            {messages.map((msg, idx) => (
              <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] rounded-2xl p-3.5 text-sm shadow-sm leading-relaxed ${
                  msg.role === 'user' 
                    ? 'bg-brand-600 text-white rounded-br-none' 
                    : 'bg-white text-slate-700 border border-slate-100 rounded-bl-none'
                }`}>
                  {msg.text}
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-white border border-slate-100 rounded-2xl p-4 rounded-bl-none flex items-center gap-1.5 shadow-sm">
                  <div className="w-1.5 h-1.5 bg-brand-400 rounded-full animate-bounce"></div>
                  <div className="w-1.5 h-1.5 bg-brand-400 rounded-full animate-bounce delay-75"></div>
                  <div className="w-1.5 h-1.5 bg-brand-400 rounded-full animate-bounce delay-150"></div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="p-4 bg-white border-t border-slate-100">
            <div className="flex gap-2 items-center bg-slate-50 border border-slate-200 rounded-xl px-2 py-2 focus-within:ring-2 focus-within:ring-brand-100 focus-within:border-brand-300 transition-all">
              <input
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                placeholder="Digite sua dúvida..."
                className="flex-1 bg-transparent border-none focus:ring-0 text-sm text-slate-800 placeholder:text-slate-400 px-2"
                autoFocus
              />
              <button 
                onClick={handleSend}
                disabled={!inputValue.trim() || isLoading}
                className="bg-brand-600 text-white p-2 rounded-lg hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
              >
                <Send size={16} />
              </button>
            </div>
            <p className="text-[10px] text-slate-400 text-center mt-2">IA pode cometer erros. Verifique informações importantes.</p>
          </div>
        </div>
      )}

      <button
        onClick={() => setIsOpen(!isOpen)}
        className="bg-brand-600 hover:bg-brand-700 text-white rounded-full w-14 h-14 shadow-xl shadow-brand-900/30 transition-transform hover:scale-110 active:scale-95 flex items-center justify-center group"
      >
        {isOpen ? (
          <X size={24} />
        ) : (
          <MessageSquare size={24} className="group-hover:animate-pulse" />
        )}
      </button>
    </div>
  );
};

export default GeminiChat;