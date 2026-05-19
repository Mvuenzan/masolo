import { useState, useRef, useEffect } from "react";
import { useNavigate, useParams } from "react-router";
import { ArrowLeft, Phone, Video, MoreVertical, Send, Smile, Paperclip, Mic, Image as ImageIcon, Square, Play, Pause, X, Download } from "lucide-react";
import { createClient } from "../../../utils/supabase/client";
import React from "react";

interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  text: string;
  timestamp: string;
  status?: "sent" | "delivered" | "read";
  type: "text" | "image" | "audio";
  mediaData?: string;
}

interface OtherUser {
  id: string;
  name: string;
  email: string;
  online: boolean;
}

// Composant pour la bulle Audio (Play/Pause propre)
function AudioBubble({ src }: { src: string }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
  };

  return (
    <div className="flex items-center gap-3 bg-black/10 rounded-xl p-2 min-w-[200px]">
      <audio 
        ref={audioRef} 
        src={src} 
        onPlay={() => setIsPlaying(true)} 
        onPause={() => setIsPlaying(false)} 
        onEnded={() => setIsPlaying(false)}
        className="hidden" 
      />
      <button 
        type="button" 
        onClick={togglePlay} 
        className="w-8 h-8 bg-white text-purple-600 rounded-full flex items-center justify-center shadow-sm hover:scale-105 transition-transform"
      >
        {isPlaying ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current ml-0.5" />}
      </button>
      <div className="flex-1 h-1 bg-white/30 rounded-full relative overflow-hidden">
        <div className={`h-full bg-white rounded-full ${isPlaying ? "w-full transition-all duration-[10s] linear" : "w-0"}`} />
      </div>
      <span className="text-[10px] opacity-80">Vocal</span>
    </div>
  );
}

export default function Chat() {
  const navigate = useNavigate();
  const { userId: conversationId } = useParams();
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [otherUser, setOtherUser] = useState<OtherUser | null>(null);
  
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  // États Appels
  const [incomingCall, setIncomingCall] = useState<boolean>(false);
  const [callType, setCallType] = useState<"audio" | "video" | null>(null);
  const [isInCall, setIsInCall] = useState<boolean>(false);

  // État pour le "Mode Plein Écran" de l'image
  const [fullscreenImage, setFullscreenImage] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!conversationId) return;
    let channel: any = null;

    const init = async () => {
      try {
        const supabase = createClient();
        
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          navigate("/");
          return;
        }
        setCurrentUser(session.user);

        const participants = conversationId.replace("discussion:", "").split(":");
        const otherUserId = participants.find((id) => id !== session.user.id) || participants[0];

        // 1. Profil de l'autre
        const { data: userData } = await supabase
          .from("kv_store_612c0bfe")
          .select("*")
          .or(`key.eq.utilisateur:${otherUserId},key.eq.user:${otherUserId}`)
          .maybeSingle();

        if (userData) {
          const cleanId = userData.key.replace("utilisateur:", "").replace("user:", "");
          setOtherUser({
            id: cleanId,
            email: userData.value?.email || "user@masolo.com",
            name: userData.value?.name || userData.value?.full_name || "Utilisateur",
            online: userData.value?.online === true
          });
        }

        // 2. Historique des messages
        const { data: chatData } = await supabase
          .from("kv_store_612c0bfe")
          .select("*")
          .eq("key", conversationId)
          .maybeSingle();

        if (chatData && chatData.value?.messages) {
          let currentMessages = chatData.value.messages as Message[];
          let hasChanges = false;
          const updated = currentMessages.map((msg) => {
            if (msg.senderId !== session.user.id && msg.status !== "read") {
              hasChanges = true;
              return { ...msg, status: "read" as const };
            }
            return msg;
          });

          if (hasChanges) {
            await supabase.from("kv_store_612c0bfe").upsert({ key: conversationId, value: { messages: updated } });
            setMessages(updated);
          } else {
            setMessages(currentMessages);
          }
        }

        // Vérifier appel actif
        const { data: currentCall } = await supabase
          .from("kv_store_612c0bfe")
          .select("*")
          .eq("key", `call_signal:${conversationId}`)
          .maybeSingle();
          
        if (currentCall && currentCall.value?.status === "ringing" && currentCall.value?.callerId !== session.user.id) {
          setCallType(currentCall.value.type);
          setIncomingCall(true);
        }

        // 3. REALTIME : Écoute globale
        channel = supabase
          .channel(`chat_global_events_${conversationId.replace(/:/g, '_')}`)
          .on("postgres_changes", { event: "*", schema: "public", table: "kv_store_612c0bfe" }, 
            async (payload: any) => {
              if (!payload.new) return;

              // Détection des Messages
              if (payload.new.key === conversationId && payload.new.value?.messages) {
                const incomingMsgs = payload.new.value.messages as Message[];
                let triggerUpsert = false;
                const readChecked = incomingMsgs.map(msg => {
                  if (msg.senderId !== session.user.id && msg.status !== "read") {
                    triggerUpsert = true;
                    return { ...msg, status: "read" as const };
                  }
                  return msg;
                });

                if (triggerUpsert) {
                  await supabase.from("kv_store_612c0bfe").upsert({ key: conversationId, value: { messages: readChecked } });
                } else {
                  setMessages(incomingMsgs);
                }
              }

              // RÉCEPTION DU SIGNAL D'APPEL
              if (payload.new.key === `call_signal:${conversationId}`) {
                const callInfo = payload.new.value;
                if (callInfo) {
                  if (callInfo.status === "ringing" && callInfo.callerId !== session.user.id) {
                    setCallType(callInfo.type);
                    setIncomingCall(true);
                  } else if (callInfo.status === "ended" || callInfo.status === "accepted") {
                    setIncomingCall(false);
                    if (callInfo.status === "ended") setIsInCall(false);
                  }
                }
              }

              // Statut de présence
              if (payload.new.key === `utilisateur:${otherUserId}` || payload.new.key === `user:${otherUserId}`) {
                setOtherUser(prev => prev ? { ...prev, online: payload.new.value?.online === true } : null);
              }
            }
          ).subscribe();

      } catch (error) {
        console.error("Erreur:", error);
      } finally {
        setLoading(false);
      }
    };

    init();
    return () => { if (channel) createClient().removeChannel(channel); };
  }, [conversationId, navigate]);

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const sendMessagePayload = async (type: "text" | "image" | "audio", content: string, mediaData?: string) => {
    if (!conversationId || !currentUser || !otherUser) return;
    try {
      const supabase = createClient();
      const { data: latestUserData } = await supabase.from("kv_store_612c0bfe").select("value").or(`key.eq.utilisateur:${otherUser.id},key.eq.user:${otherUser.id}`).maybeSingle();
      const initialStatus = latestUserData?.value?.online === true ? "delivered" : "sent";

      const messagePayload: Message = {
        id: crypto.randomUUID(),
        conversationId,
        senderId: currentUser.id,
        text: content,
        timestamp: new Date().toISOString(),
        status: initialStatus,
        type,
        mediaData
      };

      const updatedMessages = [...messages, messagePayload];
      setMessages(updatedMessages);
      await supabase.from("kv_store_612c0bfe").upsert({ key: conversationId, value: { messages: updatedMessages } });
    } catch (e) { console.error(e); }
  };

  const handleSendText = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim()) return;
    sendMessagePayload("text", newMessage.trim());
    setNewMessage("");
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        const maxW = 500;
        const scale = maxW / img.width;
        canvas.width = maxW;
        canvas.height = img.height * scale;
        ctx?.drawImage(img, 0, 0, canvas.width, canvas.height);
        sendMessagePayload("image", "📷 Photo", canvas.toDataURL("image/jpeg", 0.6));
      };
    };
    reader.readAsDataURL(file);
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        const reader = new FileReader();
        reader.onloadend = () => {
          sendMessagePayload("audio", "🎙️ Note vocale", reader.result as string);
        };
        reader.readAsDataURL(audioBlob);
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (err) { alert("Micro non autorisé."); }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  // ACTIONS APPELS
  const startCall = async (type: "audio" | "video") => {
    if (!currentUser) return;
    const supabase = createClient();
    setCallType(type);
    setIsInCall(true);
    await supabase.from("kv_store_612c0bfe").upsert({
      key: `call_signal:${conversationId}`,
      value: { callerId: currentUser.id, type, status: "ringing", timestamp: new Date().toISOString() }
    });
  };

  const answerCall = async () => {
    const supabase = createClient();
    setIncomingCall(false);
    setIsInCall(true);
    await supabase.from("kv_store_612c0bfe").upsert({
      key: `call_signal:${conversationId}`,
      value: { status: "accepted" }
    });
  };

  const endCall = async () => {
    const supabase = createClient();
    setIncomingCall(false);
    setIsInCall(false);
    setCallType(null);
    await supabase.from("kv_store_612c0bfe").upsert({
      key: `call_signal:${conversationId}`,
      value: { status: "ended" }
    });
  };

  // FONCTION POUR TÉLÉCHARGER L'IMAGE
  const downloadImage = (base64Url: string) => {
    const link = document.createElement("a");
    link.href = base64Url;
    link.download = `masolo_photo_${new Date().getTime()}.jpeg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="min-h-screen w-full bg-gray-50 flex flex-col relative">
      
      {/* MODE PLEIN ÉCRAN POUR L'IMAGE (CORRIGÉ) */}
      {fullscreenImage && (
        <div className="absolute inset-0 bg-black/95 z-50 flex flex-col items-center animate-fade-in">
          {/* Header Plein Écran */}
          <div className="w-full flex items-center justify-between p-4 bg-black/50">
            <button onClick={() => setFullscreenImage(null)} className="p-2 hover:bg-white/10 rounded-full transition-colors text-white">
              <X className="w-6 h-6" />
            </button>
            <button onClick={() => downloadImage(fullscreenImage)} className="p-2 hover:bg-white/10 rounded-full transition-colors text-white">
              <Download className="w-6 h-6" />
            </button>
          </div>
          {/* Conteneur Image */}
          <div className="flex-1 flex items-center justify-center p-4">
            <img 
              src={fullscreenImage} 
              alt="Photo en plein écran" 
              className="max-w-full max-h-full rounded-md shadow-lg object-contain" 
            />
          </div>
        </div>
      )}

      {/* POPUP APPEL ENTRANT */}
      {incomingCall && (
        <div className="absolute inset-0 bg-black/85 z-50 flex flex-col items-center justify-center text-white p-4 animate-fade-in">
          <div className="w-20 h-20 bg-green-500 rounded-full flex items-center justify-center text-3xl mb-4 animate-pulse">📞</div>
          <h2 className="text-xl font-semibold mb-1">{otherUser?.name || "Un utilisateur"}</h2>
          <p className="text-sm text-gray-300 mb-8">Appel {callType === "video" ? "Vidéo" : "Audio"} entrant...</p>
          <div className="flex gap-6 w-full max-w-xs">
            <button onClick={answerCall} className="flex-1 py-3 bg-green-600 rounded-xl font-medium shadow-md hover:bg-green-700 transition-colors">Décrocher</button>
            <button onClick={endCall} className="flex-1 py-3 bg-red-600 rounded-xl font-medium shadow-md hover:bg-red-700 transition-colors">Refuser</button>
          </div>
        </div>
      )}

      {/* INTERFACE APPEL EN COURS */}
      {isInCall && (
        <div className="absolute inset-0 bg-gray-950 z-40 flex flex-col items-center justify-between text-white p-6">
          <div className="text-center mt-16">
            <div className="w-24 h-24 bg-purple-600 rounded-full mx-auto flex items-center justify-center text-3xl shadow-md">👤</div>
            <h2 className="text-xl font-medium mt-4">{otherUser?.name}</h2>
            <p className="text-xs text-green-400 animate-pulse mt-1">{callType === "video" ? "Session vidéo active" : "Appel audio en cours..."}</p>
          </div>
          <button onClick={endCall} className="mb-12 p-4 bg-red-600 hover:bg-red-700 text-white rounded-full shadow-lg transition-transform hover:scale-105"><Square className="w-6 h-6" /></button>
        </div>
      )}

      {/* HEADER */}
      <div className="bg-white border-b border-gray-200 p-4 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate("/home")} className="p-2 hover:bg-gray-100 rounded-full transition-colors"><ArrowLeft className="w-5 h-5 text-gray-700" /></button>
          <div className="relative">
            <div className="w-10 h-10 bg-gradient-to-br from-purple-400 to-pink-400 rounded-full flex items-center justify-center text-sm font-bold text-white">
              {(otherUser?.name || "U").substring(0, 2).toUpperCase()}
            </div>
            {otherUser?.online && <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-white rounded-full"></div>}
          </div>
          <div>
            <h2 className="text-gray-900 font-medium text-sm">{otherUser?.name || "Utilisateur"}</h2>
            <p className={`text-[11px] ${otherUser?.online ? "text-green-600 font-medium" : "text-gray-400"}`}>{otherUser?.online ? "En ligne" : "Hors ligne"}</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => startCall("audio")} className="p-2 hover:bg-gray-100 rounded-full transition-colors"><Phone className="w-5 h-5 text-gray-600" /></button>
          <button onClick={() => startCall("video")} className="p-2 hover:bg-gray-100 rounded-full transition-colors"><Video className="w-5 h-5 text-gray-600" /></button>
          <button className="p-2 hover:bg-gray-100 rounded-full transition-colors"><MoreVertical className="w-5 h-5 text-gray-600" /></button>
        </div>
      </div>

      {/* CONTENEUR MESSAGES */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((message) => {
          const isMe = message.senderId === currentUser?.id;
          return (
            <div key={message.id} className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[75%] rounded-2xl px-4 py-2 ${isMe ? "bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-br-sm" : "bg-white text-gray-900 shadow-sm rounded-bl-sm"}`}>
                
                {/* RENDU IMAGE CLIQUABLE (CORRIGÉ) */}
                {message.type === "image" && message.mediaData && (
                  <button type="button" onClick={() => setFullscreenImage(message.mediaData as string)} className="block focus:outline-none mb-1 group relative">
                    <img src={message.mediaData} alt="Média" className="rounded-lg max-w-full h-auto max-h-60 object-cover group-hover:opacity-90 transition-opacity" />
                  </button>
                )}
                
                {/* RENDU AUDIOPERSONNALISÉ */}
                {message.type === "audio" && message.mediaData && (
                  <AudioBubble src={message.mediaData} />
                )}

                {message.type === "text" && <p className="text-sm break-words">{message.text}</p>}

                <div className={`text-[9px] mt-1 flex items-center justify-end gap-1 ${isMe ? "text-white/80" : "text-gray-400"}`}>
                  {new Date(message.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  {isMe && (
                    <span className="font-bold text-xs ml-0.5">
                      {message.status === "read" ? <span className="text-green-300">✓✓</span> : message.status === "delivered" ? <span className="text-white/70">✓✓</span> : <span className="text-white/40">✓</span>}
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* ZONE SAISIE */}
      <div className="bg-white border-t border-gray-200 p-4">
        <form onSubmit={handleSendText} className="flex items-center gap-2">
          <input type="file" ref={fileInputRef} onChange={handlePhotoUpload} accept="image/*" className="hidden" />
          
          <button type="button" onClick={() => fileInputRef.current?.click()} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
            <ImageIcon className="w-5 h-5 text-gray-500" />
          </button>

          <div className="flex-1">
            <input
              type="text"
              placeholder={isRecording ? "Micro activé... Parlez" : "Écrivez un message..."}
              disabled={isRecording}
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              className="w-full px-4 py-2.5 bg-gray-100 rounded-full focus:outline-none focus:ring-1 focus:ring-purple-500 text-sm disabled:opacity-60"
            />
          </div>

          {newMessage.trim() ? (
            <button type="submit" className="p-2.5 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-full shadow-sm"><Send className="w-4 h-4" /></button>
          ) : (
            <button
              type="button"
              onClick={isRecording ? stopRecording : startRecording}
              className={`p-2.5 rounded-full transition-all ${isRecording ? "bg-red-500 text-white animate-pulse" : "bg-gray-100 text-gray-500 hover:bg-gray-200"}`}
            >
              {isRecording ? <Square className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
            </button>
          )}
        </form>
      </div>
    </div>
  );
}