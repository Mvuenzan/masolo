import { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import { Search, MessageCircle, Settings, LogOut, Plus } from "lucide-react";
import { createClient } from "../../../utils/supabase/client";
import React from "react";

export default function Home() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [users, setUsers] = useState<any[]>([]); 
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<any>(null);

  useEffect(() => {
    const init = async () => {
      try {
        const supabase = createClient();
        
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          navigate("/");
          return;
        }
        setCurrentUser(session.user);

        // Récupérer TOUTES les lignes de la table (profils + discussions)
        const { data, error } = await supabase
          .from('kv_store_612c0bfe') 
          .select('*');

        if (error) throw error;

        if (data) {
          // 1. Isoler les lignes des utilisateurs et les lignes des discussions
          const userRows = data.filter((item: any) => item.key.startsWith("utilisateur:") || item.key.startsWith("user:"));
          const chatRows = data.filter((item: any) => item.key.startsWith("discussion:"));

          const formattedUsers = userRows.map((item: any) => {
            const cleanId = item.key.replace("utilisateur:", "").replace("user:", "");
            const userEmail = item.value?.email || `user.${cleanId.substring(0, 5)}@masolo.com`;
            const userName = item.value?.name || item.value?.full_name || `Utilisateur ${cleanId.substring(0, 5)}`;

            // Trouver la discussion correspondante entre toi et cet utilisateur
            const sortedIds = [session.user.id, cleanId].sort();
            const targetChatKey = `discussion:${sortedIds[0]}:${sortedIds[1]}`;
            const matchingChat = chatRows.find((c: any) => c.key === targetChatKey);

            let lastMessageTimestamp = "";
            let hasUnread = false;
            let lastMessageText = "";

            if (matchingChat && matchingChat.value?.messages?.length > 0) {
              const msgs = matchingChat.value.messages;
              const lastMsg = msgs[msgs.length - 1];
              lastMessageText = lastMsg.text;
              lastMessageTimestamp = lastMsg.timestamp;
              
              // On a un message non lu si le dernier message vient de l'AUTRE et qu'il n'est pas "read"
              if (lastMsg.senderId !== session.user.id && lastMsg.status !== "read") {
                hasUnread = true;
              }
            }

            return {
              id: cleanId,
              email: userEmail,
              name: userName,
              online: item.value?.online || false,
              lastMessageTime: lastMessageTimestamp,
              lastMessageText: lastMessageText,
              hasUnread: hasUnread
            };
          });

          // TRI DYNAMIQUE : On classe par date du dernier message (les plus récents en premier)
          // Les contacts sans message vont à la fin.
          const sortedUsers = formattedUsers.sort((a: any, b: any) => {
            if (!a.lastMessageTime) return 1;
            if (!b.lastMessageTime) return -1;
            return new Date(b.lastMessageTime).getTime() - new Date(a.lastMessageTime).getTime();
          });
          
          setUsers(sortedUsers);
        }
      } catch (err) {
        console.error("Erreur d'initialisation:", err);
      } finally {
        setLoading(false);
      }
    };

    init();
  }, [navigate]);

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    navigate("/");
  };

  const handleUserClick = (otherUserId: string) => {
    if (!currentUser) return;
    const sortedIds = [currentUser.id, otherUserId].sort();
    const conversationKey = `discussion:${sortedIds[0]}:${sortedIds[1]}`;
    navigate(`/chat/${conversationKey}`);
  };

  const getAvatar = (name: string) => {
    const avatars = ["👨‍💼", "👩‍💼", "👨‍💻", "👩‍💻", "👨‍🎨", "👩‍🎨", "👨‍🔧", "👩‍⚕️"];
    const index = name ? name.charCodeAt(0) % avatars.length : 0;
    return avatars[index];
  };

  const filteredUsers = users.filter(user =>
    user.id !== currentUser?.id && 
    user.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) {
    return (
      <div className="min-h-screen w-full bg-gray-50 flex items-center justify-center">
        <MessageCircle className="w-12 h-12 text-purple-600 animate-pulse" />
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full bg-gray-50 flex">
      <div className="w-full bg-white flex flex-col">
        {/* HEADER */}
        <div className="p-4 border-b border-gray-200 bg-gradient-to-r from-purple-600 to-pink-600">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center text-2xl shadow-sm">
                {getAvatar(currentUser?.user_metadata?.name || currentUser?.email || "U")}
              </div>
              <div className="flex flex-col">
                <h1 className="text-lg font-bold text-white leading-none">
                  {currentUser?.user_metadata?.name || currentUser?.email?.split("@")[0] || "Moi"}
                </h1>
                <p className="text-xs text-purple-100 opacity-90 mt-1">
                  {currentUser?.email}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button className="p-2 hover:bg-white/10 rounded-full transition-colors">
                <Settings className="w-5 h-5 text-white" />
              </button>
              <button onClick={handleLogout} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                <LogOut className="w-5 h-5 text-white" />
              </button>
            </div>
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Rechercher une conversation..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-white rounded-full focus:outline-none focus:ring-2 focus:ring-white/50"
            />
          </div>
        </div>

        {/* LISTE DES UTILISATEURS - AVEC TRI ET COCHAGE MESSAGE RECUS */}
        <div className="flex-1 overflow-y-auto">
          {filteredUsers.length === 0 ? (
            <div className="text-center p-8 text-gray-500">
              <p>Aucun utilisateur trouvé</p>
            </div>
          ) : (
            filteredUsers.map((user) => (
              <button
                key={user.id}
                onClick={() => handleUserClick(user.id)}
                className={`w-full p-4 border-b border-gray-100 transition-colors flex items-center gap-3 text-left ${
                  user.hasUnread ? "bg-purple-50/50 hover:bg-purple-50" : "hover:bg-gray-50"
                }`}
              >
                <div className="relative flex-shrink-0">
                  <div className="w-14 h-14 bg-gradient-to-br from-purple-400 to-pink-400 rounded-full flex items-center justify-center text-2xl">
                    {getAvatar(user.name)}
                  </div>
                  {user.online && (
                    <div className="absolute bottom-0 right-0 w-4 h-4 bg-green-500 border-2 border-white rounded-full"></div>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <h3 className={`truncate font-medium ${user.hasUnread ? "text-purple-900 font-bold" : "text-gray-900"}`}>
                      {user.name}
                    </h3>
                    {user.lastMessageTime && (
                      <span className="text-xs text-gray-400">
                        {new Date(user.lastMessageTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    )}
                  </div>
                  <p className={`text-sm truncate ${user.hasUnread ? "text-purple-700 font-medium" : "text-gray-500"}`}>
                    {user.lastMessageText || user.email}
                  </p>
                </div>

                {/* SIGNE / NOTIFICATION DE MESSAGE REÇU */}
                <div className="flex-shrink-0">
                  {user.hasUnread ? (
                    <div className="w-3 h-3 bg-gradient-to-r from-purple-600 to-pink-600 rounded-full animate-pulse shadow-sm"></div>
                  ) : (
                    <Plus className="w-5 h-5 text-gray-300" />
                  )}
                </div>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}