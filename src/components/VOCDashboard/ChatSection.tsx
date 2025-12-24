import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Search, Send, MessageCircle, Trash2, Bot, UserCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface ChatMessage {
  id: string;
  sender: "user" | "agent";
  message: string;
  timestamp: string;
}

interface Chat {
  id: string;
  userName: string;
  lastMessage: string;
  timestamp: string;
  unread: number;
  status: "active" | "waiting" | "closed";
  messages: ChatMessage[];
  handledBy?: "ai" | "admin";
}

const initialMockChats: Chat[] = [
  {
    id: "1",
    userName: "Ahmad Yusuf",
    lastMessage: "Bagaimana cara deposit?",
    timestamp: "10:30",
    unread: 2,
    status: "active",
    handledBy: "ai",
    messages: [
      { id: "1", sender: "user", message: "Halo, saya mau tanya", timestamp: "10:25" },
      { id: "2", sender: "agent", message: "Halo kak! Ada yang bisa Danila bantu?", timestamp: "10:26" },
      { id: "3", sender: "user", message: "Bagaimana cara deposit?", timestamp: "10:30" },
    ],
  },
  {
    id: "2",
    userName: "Siti Nurhaliza",
    lastMessage: "Terima kasih!",
    timestamp: "09:45",
    unread: 0,
    status: "closed",
    handledBy: "ai",
    messages: [
      { id: "1", sender: "user", message: "Withdraw saya sudah masuk?", timestamp: "09:40" },
      { id: "2", sender: "agent", message: "Sudah diproses ya kak!", timestamp: "09:42" },
      { id: "3", sender: "user", message: "Terima kasih!", timestamp: "09:45" },
    ],
  },
];

export function ChatSection() {
  const [searchQuery, setSearchQuery] = useState("");
  const [chats, setChats] = useState<Chat[]>(initialMockChats);
  const [selectedChat, setSelectedChat] = useState<Chat | null>(initialMockChats[0]);
  const [replyMessage, setReplyMessage] = useState("");

  const filteredChats = chats.filter(chat =>
    chat.userName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleSendMessage = () => {
    if (!replyMessage.trim() || !selectedChat) return;
    setReplyMessage("");
  };

  const handleToggleHandler = (chatId: string) => {
    setChats(prev => prev.map(chat => {
      if (chat.id === chatId) {
        const newHandler = chat.handledBy === "admin" ? "ai" : "admin";
        toast.success(newHandler === "admin" ? "Chat diambil alih oleh Admin" : "Chat dialihkan ke AI");
        return { ...chat, handledBy: newHandler };
      }
      return chat;
    }));
    
    if (selectedChat?.id === chatId) {
      setSelectedChat(prev => prev ? { ...prev, handledBy: prev.handledBy === "admin" ? "ai" : "admin" } : null);
    }
  };

  const handleDeleteChat = (chatId: string) => {
    setChats(prev => prev.filter(chat => chat.id !== chatId));
    if (selectedChat?.id === chatId) {
      setSelectedChat(null);
    }
    toast.success("Chat berhasil dihapus");
  };

  return (
    <div className="max-w-7xl mx-auto">
      <Card className="p-0 overflow-hidden">
        <div className="flex h-[calc(100vh-200px)]">
          {/* Chat List */}
          <div className="w-80 border-r border-border flex flex-col">
            <div className="p-4 border-b border-border">
              <div className="flex items-center gap-2 mb-3">
                <MessageCircle className="h-5 w-5 text-button-hover" />
                <h3 className="font-semibold text-button-hover">Live Chat</h3>
              </div>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Cari chat..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
            <ScrollArea className="flex-1">
              {filteredChats.map((chat) => (
                  <div
                    key={chat.id}
                    onClick={() => setSelectedChat(chat)}
                    className={cn(
                      "p-4 border-b border-border cursor-pointer hover:bg-muted transition-colors",
                      selectedChat?.id === chat.id && "bg-card"
                    )}
                  >
                  <div className="flex items-start gap-3">
                    <Avatar className="h-10 w-10">
                      <AvatarFallback className="bg-button-hover/20 text-button-hover text-sm">
                        {chat.userName.split(" ").map(n => n[0]).join("")}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="font-medium truncate">{chat.userName}</span>
                        <span className="text-xs text-muted-foreground">{chat.timestamp}</span>
                      </div>
                      <p className="text-sm text-muted-foreground truncate">{chat.lastMessage}</p>
                    </div>
                    {chat.unread > 0 && (
                      <Badge className="bg-button-hover text-button-hover-foreground">{chat.unread}</Badge>
                    )}
                  </div>
                </div>
              ))}
            </ScrollArea>
          </div>

          {/* Chat Window */}
          <div className="flex-1 flex flex-col">
            {selectedChat ? (
              <>
                <div className="p-4 border-b border-border flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-10 w-10">
                      <AvatarFallback className="bg-button-hover/20 text-button-hover">
                        {selectedChat.userName.split(" ").map(n => n[0]).join("")}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <div className="font-medium">{selectedChat.userName}</div>
                      <div className="text-xs text-muted-foreground">
                        via LiveChat • {selectedChat.messages.length} pesan
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="destructive" size="sm" className="gap-1">
                          <Trash2 className="h-4 w-4" />
                          Hapus
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Hapus Chat?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Apakah Anda yakin ingin menghapus chat dengan {selectedChat.userName}? 
                            Tindakan ini tidak dapat dibatalkan.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Batal</AlertDialogCancel>
                          <AlertDialogAction 
                            onClick={() => handleDeleteChat(selectedChat.id)}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            Hapus
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                    
                    <Button 
                      variant={selectedChat.handledBy === "admin" ? "golden" : "golden-outline"}
                      size="sm"
                      className="gap-1"
                      onClick={() => handleToggleHandler(selectedChat.id)}
                    >
                      {selectedChat.handledBy === "admin" ? (
                        <>
                          <Bot className="h-4 w-4" />
                          Alihkan ke AI
                        </>
                      ) : (
                        <>
                          <UserCheck className="h-4 w-4" />
                          Ambil Alih Chat
                        </>
                      )}
                    </Button>
                  </div>
                </div>

                <ScrollArea className="flex-1 p-4">
                  <div className="space-y-4">
                    {selectedChat.messages.map((msg) => (
                      <div
                        key={msg.id}
                        className={cn(
                          "flex",
                          msg.sender === "agent" ? "justify-end" : "justify-start"
                        )}
                      >
                        <div
                          className={cn(
                            "max-w-[70%] rounded-lg px-4 py-2",
                            msg.sender === "agent"
                              ? "bg-button-hover text-button-hover-foreground"
                              : "bg-muted"
                          )}
                        >
                          <p className="text-sm">{msg.message}</p>
                          <span className={cn(
                            "text-xs",
                            msg.sender === "agent" ? "text-button-hover-foreground/70" : "text-muted-foreground"
                          )}>
                            {msg.timestamp}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>

                <div className="p-4 border-t border-border">
                  <div className="flex gap-2">
                    <Input
                      placeholder="Ketik pesan..."
                      value={replyMessage}
                      onChange={(e) => setReplyMessage(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleSendMessage()}
                    />
                    <Button
                      variant="outline"
                      onClick={handleSendMessage}
                      className="border-border text-foreground hover:bg-button-hover hover:text-button-hover-foreground hover:border-button-hover"
                    >
                      <Send className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center text-muted-foreground">
                Pilih chat untuk memulai
              </div>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
}
