import { useState, useEffect } from "react";
import { ArrowLeft, Send, Bot, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";

interface Message {
  id: number;
  text: string;
  isBot: boolean;
  timestamp: Date;
}

export function ChauffeurSupport() {
  const [, setLocation] = useLocation();
  const [isAuthed, setIsAuthed] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 1,
      text: "Bonjour ! Je suis l'assistant TĀPE'A pour les chauffeurs. Comment puis-je vous aider aujourd'hui ?",
      isBot: true,
      timestamp: new Date()
    }
  ]);
  const [inputValue, setInputValue] = useState("");

  useEffect(() => {
    const isAuth = sessionStorage.getItem("chauffeurAuth");
    if (!isAuth) {
      setLocation("/chauffeur-login");
    } else {
      setIsAuthed(true);
    }
  }, [setLocation]);

  if (!isAuthed) {
    return (
      <div className="w-full max-w-[420px] mx-auto bg-white flex items-center justify-center" style={{ height: "100dvh" }}>
        <div className="w-8 h-8 border-4 border-[#ffdf6d] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const handleSend = () => {
    if (!inputValue.trim()) return;

    const userMessage: Message = {
      id: messages.length + 1,
      text: inputValue,
      isBot: false,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputValue("");

    setTimeout(() => {
      const botResponse: Message = {
        id: messages.length + 2,
        text: "Merci pour votre message. Un membre de notre équipe support chauffeur va vous répondre dans les plus brefs délais. En attendant, n'hésitez pas à consulter notre FAQ dans la section Aide.",
        isBot: true,
        timestamp: new Date()
      };
      setMessages(prev => [...prev, botResponse]);
    }, 1000);
  };

  return (
    <div 
      className="relative w-full max-w-[420px] mx-auto bg-[#f8f8f8] flex flex-col"
      style={{ height: "100dvh" }}
    >
      <header 
        className="sticky top-0 z-20 bg-white flex items-center gap-3 px-4 py-3 shadow-sm"
        style={{ paddingTop: 'max(12px, env(safe-area-inset-top))' }}
      >
        <Button
          size="icon"
          variant="ghost"
          onClick={() => setLocation("/chauffeur")}
          data-testid="button-back"
        >
          <ArrowLeft className="w-5 h-5 text-[#343434]" />
        </Button>
        <div className="flex-1">
          <h1 className="text-lg font-semibold text-[#343434]">Support Chauffeur</h1>
          <p className="text-xs text-green-500">En ligne</p>
        </div>
      </header>

      <div className="flex-1 overflow-auto p-4 space-y-3">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex gap-2 ${message.isBot ? '' : 'flex-row-reverse'}`}
          >
            <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
              message.isBot ? 'bg-[#ffdf6d]' : 'bg-[#343434]'
            }`}>
              {message.isBot ? (
                <Bot className="w-4 h-4 text-[#343434]" />
              ) : (
                <User className="w-4 h-4 text-white" />
              )}
            </div>
            <div className={`max-w-[75%] p-3 rounded-2xl ${
              message.isBot 
                ? 'bg-white rounded-tl-sm' 
                : 'bg-[#343434] text-white rounded-tr-sm'
            }`}>
              <p className="text-sm">{message.text}</p>
              <p className={`text-xs mt-1 ${message.isBot ? 'text-[#8c8c8c]' : 'text-white/60'}`}>
                {message.timestamp.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
          </div>
        ))}
      </div>

      <div 
        className="bg-white p-4 border-t"
        style={{ paddingBottom: 'max(16px, env(safe-area-inset-bottom))' }}
      >
        <div className="flex gap-2">
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Écrivez votre message..."
            className="flex-1 px-4 py-3 bg-[#f6f6f6] rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-[#ffdf6d]"
            data-testid="input-message"
          />
          <Button
            size="icon"
            className="bg-[#ffdf6d] hover:bg-[#ffd84f] rounded-full w-12 h-12"
            onClick={handleSend}
            data-testid="button-send"
          >
            <Send className="w-5 h-5 text-[#343434]" />
          </Button>
        </div>
      </div>
    </div>
  );
}
