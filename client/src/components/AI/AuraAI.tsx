import React, { useState, useEffect, useRef } from 'react';
import { Send, Loader } from 'lucide-react';
import { api } from '../../services/api';

interface Message {
  id: string;
  text: string;
  sender: 'user' | 'ai';
}

export function AuraAI() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim()) return;
    setLoading(true);
    const userMessage: Message = { id: Date.now().toString(), text: input, sender: 'user' };
    setMessages(prev => [...prev, userMessage]);
    setInput('');

    try {
      // Check if AI is available first
      const status = await api.aiStatus();
      if (!status.available) {
        throw new Error('AI service is currently unavailable');
      }

      // Prepare conversation history
      const history = messages.map(m => ({
        role: m.sender === 'ai' ? 'assistant' : 'user',
        content: m.text
      })) as { role: 'user' | 'assistant'; content: string }[];

      const reply = await api.aiChat(input, history, 'en');
      const aiMessage: Message = { id: Date.now().toString(), text: reply, sender: 'ai' };
      setMessages(prev => [...prev, aiMessage]);
    } catch (error) {
      console.error('AI request failed:', error);
      const aiMessage: Message = {
        id: Date.now().toString(),
        text: 'Sorry, I encountered an error while processing your request. Please try again later.',
        sender: 'ai'
      };
      setMessages(prev => [...prev, aiMessage]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-aura-bg">
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((message) => (
          <div key={message.id} className={`flex ${message.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${message.sender === 'user' ? 'bg-aura-primary text-white' : 'bg-aura-paper'}`}>
              {message.text}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="px-4 py-2 rounded-lg bg-aura-paper">
              <Loader className="w-4 h-4 animate-spin" />
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>
      <div className="p-4 border-t border-aura-border">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSend()}
            className="flex-1 input-aura"
            placeholder="Type your message..."
          />
          <button onClick={handleSend} disabled={loading} className="btn-primary p-2">
            <Send className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
}