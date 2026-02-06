import { useState } from "react";
import { ArrowLeft, MessageCircle, Clock, Phone, Send, Headphones, Calendar, HelpCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Link } from "wouter";

const supportOptions = [
  {
    id: "chat",
    title: "Discussion directe",
    description: "Réponse en moins de 10 minutes",
    icon: MessageCircle,
    color: "#4CAF50",
    available: true,
  },
  {
    id: "booking",
    title: "Réservation complexe",
    description: "Assistance pour vos trajets spéciaux",
    icon: Calendar,
    color: "#2196F3",
    available: true,
  },
  {
    id: "help",
    title: "Aide spécifique",
    description: "Questions sur l'application",
    icon: HelpCircle,
    color: "#FF9800",
    available: true,
  },
  {
    id: "call",
    title: "Appel téléphonique",
    description: "Parlez à un conseiller",
    icon: Phone,
    color: "#9C27B0",
    available: true,
  },
];

export function Support() {
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [chatStarted, setChatStarted] = useState(false);
  const [messages, setMessages] = useState<Array<{ text: string; isUser: boolean; time: string }>>([]);

  const handleStartChat = () => {
    if (selectedOption) {
      setChatStarted(true);
      const now = new Date();
      const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
      setMessages([
        {
          text: "Ia ora na ! Bienvenue sur le support TĀPE'A. Comment puis-je vous aider aujourd'hui ?",
          isUser: false,
          time: timeStr,
        },
      ]);
    }
  };

  const handleSendMessage = () => {
    if (message.trim()) {
      const now = new Date();
      const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
      setMessages((prev) => [
        ...prev,
        { text: message, isUser: true, time: timeStr },
      ]);
      setMessage("");
      
      setTimeout(() => {
        const replyTime = new Date();
        const replyTimeStr = `${replyTime.getHours().toString().padStart(2, '0')}:${replyTime.getMinutes().toString().padStart(2, '0')}`;
        setMessages((prev) => [
          ...prev,
          {
            text: "Merci pour votre message. Un conseiller va vous répondre dans moins de 10 minutes. Restez connecté !",
            isUser: false,
            time: replyTimeStr,
          },
        ]);
      }, 1500);
    }
  };

  if (chatStarted) {
    return (
      <div className="bg-white h-screen w-full max-w-[420px] mx-auto flex flex-col">
        <header className="bg-[#ffdf6d] px-4 py-4 flex items-center gap-3 shadow-sm">
          <Button
            size="icon"
            variant="ghost"
            className="rounded-full"
            onClick={() => setChatStarted(false)}
            data-testid="button-back-chat"
          >
            <ArrowLeft className="w-5 h-5 text-[#5c5c5c]" />
          </Button>
          <div className="flex-1">
            <h1 className="text-lg font-bold text-[#434343]">Support TĀPE'A</h1>
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 bg-green-500 rounded-full" />
              <span className="text-xs text-[#5c5c5c]">En ligne - Réponse &lt; 10 min</span>
            </div>
          </div>
          <Headphones className="w-6 h-6 text-[#5c5c5c]" />
        </header>

        <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-[#f6f6f6]">
          {messages.map((msg, index) => (
            <div
              key={index}
              className={`flex ${msg.isUser ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[80%] rounded-2xl px-4 py-2 ${
                  msg.isUser
                    ? "bg-[#ffdf6d] text-[#434343]"
                    : "bg-white text-[#434343] shadow-sm"
                }`}
              >
                <p className="text-sm">{msg.text}</p>
                <p className={`text-[10px] mt-1 ${msg.isUser ? "text-[#5c5c5c]" : "text-[#8c8c8c]"}`}>
                  {msg.time}
                </p>
              </div>
            </div>
          ))}
        </div>

        <div className="p-4 bg-white border-t">
          <div className="flex items-center gap-2">
            <Input
              type="text"
              placeholder="Écrivez votre message..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSendMessage()}
              className="flex-1 rounded-full border-[#e0e0e0]"
              data-testid="input-chat-message"
            />
            <Button
              size="icon"
              className="bg-[#ffdf6d] hover:bg-[#ffd84f] rounded-full"
              onClick={handleSendMessage}
              data-testid="button-send-message"
            >
              <Send className="w-4 h-4 text-[#5c5c5c]" />
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white h-screen w-full max-w-[420px] mx-auto flex flex-col">
      <header className="bg-[#ffdf6d] px-4 py-4 flex items-center gap-3 shadow-sm">
        <Link href="/">
          <Button
            size="icon"
            variant="ghost"
            className="rounded-full"
            data-testid="button-back"
          >
            <ArrowLeft className="w-5 h-5 text-[#5c5c5c]" />
          </Button>
        </Link>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-[#434343]">Support</h1>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-4">
        <div className="flex items-center gap-2 mb-6 p-3 bg-green-50 rounded-xl">
          <Clock className="w-5 h-5 text-green-600" />
          <p className="text-sm text-green-700 font-medium">
            Temps de réponse moyen : moins de 10 minutes
          </p>
        </div>

        <h2 className="text-lg font-semibold text-[#434343] mb-4">
          Comment pouvons-nous vous aider ?
        </h2>

        <div className="space-y-3">
          {supportOptions.map((option) => {
            const IconComponent = option.icon;
            const isSelected = selectedOption === option.id;
            return (
              <Card
                key={option.id}
                className={`p-4 cursor-pointer transition-all ${
                  isSelected
                    ? "ring-2 ring-[#ffdf6d] bg-[#fffef5]"
                    : "hover:bg-[#fafafa]"
                }`}
                onClick={() => setSelectedOption(option.id)}
                data-testid={`card-support-${option.id}`}
              >
                <div className="flex items-center gap-4">
                  <div
                    className="w-12 h-12 rounded-full flex items-center justify-center"
                    style={{ backgroundColor: `${option.color}20` }}
                  >
                    <IconComponent
                      className="w-6 h-6"
                      style={{ color: option.color }}
                    />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-[#434343]">{option.title}</h3>
                    <p className="text-sm text-[#8c8c8c]">{option.description}</p>
                  </div>
                  <div
                    className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                      isSelected
                        ? "border-[#ffdf6d] bg-[#ffdf6d]"
                        : "border-[#d0d0d0]"
                    }`}
                  >
                    {isSelected && (
                      <div className="w-2 h-2 bg-[#434343] rounded-full" />
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>

        {selectedOption && (
          <div className="mt-6 space-y-4">
            <h3 className="font-semibold text-[#434343]">
              Décrivez brièvement votre demande (optionnel)
            </h3>
            <Textarea
              placeholder="Ex: J'ai besoin d'aide pour réserver un trajet vers l'aéroport demain matin..."
              className="min-h-[100px] resize-none"
              data-testid="textarea-support-description"
            />
          </div>
        )}
      </div>

      <div className="p-4 border-t bg-white">
        <Button
          className="w-full bg-[#ffdf6d] hover:bg-[#ffd84f] text-[#434343] font-semibold h-12"
          disabled={!selectedOption}
          onClick={handleStartChat}
          data-testid="button-start-conversation"
        >
          <MessageCircle className="w-5 h-5 mr-2" />
          Démarrer la conversation
        </Button>
      </div>
    </div>
  );
}
