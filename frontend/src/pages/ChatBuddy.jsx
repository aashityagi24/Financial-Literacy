import { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { API } from '@/App';
import { toast } from 'sonner';
import { MessageCircle, ChevronLeft, Send, Sparkles, Lightbulb } from 'lucide-react';
import { Input } from "@/components/ui/input";

export default function ChatBuddy({ user }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [tip, setTip] = useState(null);
  const messagesEndRef = useRef(null);
  
  const gradeNames = ['Kindergarten', '1st Grade', '2nd Grade', '3rd Grade', '4th Grade', '5th Grade'];
  
  const suggestedQuestions = user?.grade <= 2 
    ? [
        "What is saving?",
        "Why should I save my coins?",
        "What's the difference between wants and needs?",
        "How can I earn more coins?"
      ]
    : [
        "How does investing work?",
        "What is interest?",
        "How do I make a budget?",
        "What's the difference between saving and investing?"
      ];
  
  useEffect(() => {
    fetchTip();
    // Add welcome message
    setMessages([{
      role: 'assistant',
      content: `Hi ${user?.name?.split(' ')[0] || 'friend'}! I'm Money Buddy, your financial helper! Ask me anything about money, saving, or spending. What would you like to learn about today? 🌟`
    }]);
  }, [user]);
  
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);
  
  const fetchTip = async () => {
    try {
      const response = await axios.post(`${API}/ai/tip`, {
        grade: user?.grade || 3
      });
      setTip(response.data.tip);
    } catch (error) {
      console.error('Failed to fetch tip');
    }
  };
  
  const handleSend = async () => {
    if (!input.trim() || loading) return;
    
    const userMessage = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setLoading(true);
    
    try {
      const response = await axios.post(`${API}/ai/chat`, {
        message: userMessage,
        grade: user?.grade || 3
      });
      
      setMessages(prev => [...prev, { role: 'assistant', content: response.data.response }]);
    } catch (error) {
      toast.error('Failed to get response');
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: "Oops! I'm having trouble thinking right now. Let's try again in a moment! 🤔" 
      }]);
    } finally {
      setLoading(false);
    }
  };
  
  const handleSuggestedQuestion = (question) => {
    setInput(question);
  };
  
  return (
    <div className="min-h-screen bg-[#E0FBFC] flex flex-col" data-testid="chat-page">
      {/* Header */}
      <header className="bg-white border-b-3 border-[#1D3557]">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Link to="/dashboard" className="p-2 rounded-xl border-2 border-[#1D3557] hover:bg-[#E0FBFC]">
              <ChevronLeft className="w-5 h-5 text-[#1D3557]" />
            </Link>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-[#FFD23F] rounded-xl border-3 border-[#1D3557] flex items-center justify-center animate-pulse-glow">
                <MessageCircle className="w-6 h-6 text-[#1D3557]" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-[#1D3557]" style={{ fontFamily: 'Fredoka' }}>Money Buddy</h1>
                <p className="text-xs text-[#3D5A80]">Your AI Financial Friend • {gradeNames[user?.grade] || 'All ages'}</p>
              </div>
            </div>
          </div>
        </div>
      </header>
      
      {/* Tip Banner */}
      {tip && (
        <div className="bg-[#FFD23F]/30 border-b-2 border-[#1D3557]">
          <div className="container mx-auto px-4 py-3">
            <div className="flex items-start gap-2">
              <Lightbulb className="w-5 h-5 text-[#1D3557] flex-shrink-0 mt-0.5" />
              <p className="text-sm text-[#1D3557]"><strong>Today's Tip:</strong> {tip}</p>
            </div>
          </div>
        </div>
      )}
      
      {/* Chat Messages */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="container mx-auto max-w-2xl space-y-4">
          {messages.map((message, index) => (
            <div
              key={index}
              className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'} animate-bounce-in`}
            >
              <div
                className={`max-w-[80%] p-4 rounded-2xl border-3 border-[#1D3557] ${
                  message.role === 'user'
                    ? 'bg-[#3D5A80] text-white rounded-tr-sm'
                    : 'bg-white text-[#1D3557] rounded-tl-sm'
                }`}
              >
                {message.role === 'assistant' && (
                  <div className="flex items-center gap-2 mb-2 pb-2 border-b border-[#1D3557]/20">
                    <span className="text-lg">🤖</span>
                    <span className="font-bold text-sm">Money Buddy</span>
                  </div>
                )}
                <p className="whitespace-pre-wrap">{message.content}</p>
              </div>
            </div>
          ))}
          
          {loading && (
            <div className="flex justify-start">
              <div className="bg-white p-4 rounded-2xl border-3 border-[#1D3557] rounded-tl-sm">
                <div className="flex items-center gap-2">
                  <span className="text-lg">🤖</span>
                  <div className="flex gap-1">
                    <span className="w-2 h-2 bg-[#3D5A80] rounded-full animate-bounce" style={{ animationDelay: '0s' }}></span>
                    <span className="w-2 h-2 bg-[#3D5A80] rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></span>
                    <span className="w-2 h-2 bg-[#3D5A80] rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></span>
                  </div>
                </div>
              </div>
            </div>
          )}
          
          <div ref={messagesEndRef} />
        </div>
      </div>
      
      {/* Suggested Questions */}
      {messages.length <= 1 && (
        <div className="p-4 border-t border-[#1D3557]/20">
          <div className="container mx-auto max-w-2xl">
            <p className="text-sm text-[#3D5A80] mb-2 flex items-center gap-1">
              <Sparkles className="w-4 h-4" /> Try asking:
            </p>
            <div className="flex flex-wrap gap-2">
              {suggestedQuestions.map((question, index) => (
                <button
                  key={index}
                  onClick={() => handleSuggestedQuestion(question)}
                  className="bg-white px-3 py-2 rounded-xl border-2 border-[#1D3557] text-sm text-[#3D5A80] hover:bg-[#FFD23F]/20 transition-colors"
                >
                  {question}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
      
      {/* Input Area */}
      <div className="bg-white border-t-3 border-[#1D3557] p-4">
        <div className="container mx-auto max-w-2xl">
          <div className="flex gap-3">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSend()}
              placeholder="Ask me anything about money..."
              className="flex-1 border-3 border-[#1D3557] rounded-xl py-3 px-4"
              disabled={loading}
            />
            <button
              onClick={handleSend}
              disabled={loading || !input.trim()}
              className="btn-primary px-5 py-3 flex items-center gap-2"
            >
              <Send className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
