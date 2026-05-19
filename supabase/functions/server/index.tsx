import { Hono } from "npm:hono";
import { cors } from "npm:hono/cors";
import { logger } from "npm:hono/logger";
import * as kv from "./kv_store.tsx";
import { createClient } from "jsr:@supabase/supabase-js@2.49.8";

const app = new Hono();

// Enable logger
app.use('*', logger(console.log));

// Enable CORS for all routes and methods
app.use(
  "/*",
  cors({
    origin: "*",
    allowHeaders: ["Content-Type", "Authorization"],
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    exposeHeaders: ["Content-Length"],
    maxAge: 600,
  }),
);

// Helper: Get authenticated user
const getAuthUser = async (authHeader: string | null) => {
  if (!authHeader) return null;
  const token = authHeader.split(' ')[1];
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) return null;
  return user;
};

// Health check endpoint
app.get("/make-server-612c0bfe/health", (c) => {
  return c.json({ status: "ok" });
});

// AUTHENTICATION ROUTES

// Sign up
app.post("/make-server-612c0bfe/auth/signup", async (c) => {
  try {
    const { email, password, name } = await c.req.json();

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password,
      user_metadata: { name },
      // Automatically confirm the user's email since an email server hasn't been configured.
      email_confirm: true
    });

    if (error) {
      console.log(`Sign up error: ${error.message}`);
      return c.json({ error: error.message }, 400);
    }

    // Store user profile
    await kv.set(`user:${data.user.id}`, {
      id: data.user.id,
      email,
      name,
      online: true,
      lastSeen: new Date().toISOString()
    });

    return c.json({ user: data.user });
  } catch (error) {
    console.log(`Sign up error during processing: ${error}`);
    return c.json({ error: "Failed to sign up" }, 500);
  }
});

// Get current user profile
app.get("/make-server-612c0bfe/auth/me", async (c) => {
  try {
    const user = await getAuthUser(c.req.header('Authorization'));
    if (!user) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const profile = await kv.get(`user:${user.id}`);
    return c.json({ user: profile || { id: user.id, email: user.email } });
  } catch (error) {
    console.log(`Get current user error: ${error}`);
    return c.json({ error: "Failed to get user" }, 500);
  }
});

// Update online status
app.post("/make-server-612c0bfe/auth/status", async (c) => {
  try {
    const user = await getAuthUser(c.req.header('Authorization'));
    if (!user) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const { online } = await c.req.json();
    const profile = await kv.get(`user:${user.id}`) || {};

    await kv.set(`user:${user.id}`, {
      ...profile,
      online,
      lastSeen: new Date().toISOString()
    });

    return c.json({ success: true });
  } catch (error) {
    console.log(`Update status error: ${error}`);
    return c.json({ error: "Failed to update status" }, 500);
  }
});

// CONVERSATION ROUTES

// Get all conversations for current user
app.get("/make-server-612c0bfe/conversations", async (c) => {
  try {
    const user = await getAuthUser(c.req.header('Authorization'));
    if (!user) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const conversations = await kv.getByPrefix(`conversation:${user.id}:`);

    // Enrich with other user profiles
    const enrichedConversations = await Promise.all(
      conversations.map(async (conv: any) => {
        const otherUserId = conv.participants.find((id: string) => id !== user.id);
        const otherUser = await kv.get(`user:${otherUserId}`);
        return {
          ...conv,
          otherUser
        };
      })
    );

    // Sort by last message time
    enrichedConversations.sort((a, b) =>
      new Date(b.lastMessageTime).getTime() - new Date(a.lastMessageTime).getTime()
    );

    return c.json({ conversations: enrichedConversations });
  } catch (error) {
    console.log(`Get conversations error: ${error}`);
    return c.json({ error: "Failed to get conversations" }, 500);
  }
});

// Get or create conversation with another user
app.post("/make-server-612c0bfe/conversations", async (c) => {
  try {
    const user = await getAuthUser(c.req.header('Authorization'));
    if (!user) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const { otherUserId } = await c.req.json();
    const conversationId = [user.id, otherUserId].sort().join(':');

    // Check if conversation exists
    let conversation = await kv.get(`conversation:${user.id}:${conversationId}`);

    if (!conversation) {
      // Create new conversation
      conversation = {
        id: conversationId,
        participants: [user.id, otherUserId],
        lastMessage: "",
        lastMessageTime: new Date().toISOString(),
        unreadCount: 0
      };

      // Save for both users
      await kv.set(`conversation:${user.id}:${conversationId}`, conversation);
      await kv.set(`conversation:${otherUserId}:${conversationId}`, conversation);
    }

    return c.json({ conversation });
  } catch (error) {
    console.log(`Create conversation error: ${error}`);
    return c.json({ error: "Failed to create conversation" }, 500);
  }
});

// MESSAGE ROUTES

// Get messages for a conversation
app.get("/make-server-612c0bfe/messages/:conversationId", async (c) => {
  try {
    const user = await getAuthUser(c.req.header('Authorization'));
    if (!user) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const conversationId = c.req.param('conversationId');
    const messages = await kv.getByPrefix(`message:${conversationId}:`);

    // Sort by timestamp
    messages.sort((a: any, b: any) =>
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    return c.json({ messages });
  } catch (error) {
    console.log(`Get messages error: ${error}`);
    return c.json({ error: "Failed to get messages" }, 500);
  }
});

// Send a message
app.post("/make-server-612c0bfe/messages", async (c) => {
  try {
    const user = await getAuthUser(c.req.header('Authorization'));
    if (!user) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const { conversationId, text } = await c.req.json();
    const messageId = crypto.randomUUID();
    const timestamp = new Date().toISOString();

    const message = {
      id: messageId,
      conversationId,
      senderId: user.id,
      text,
      timestamp,
      status: "sent"
    };

    // Save message
    await kv.set(`message:${conversationId}:${messageId}`, message);

    // Update conversation for both users
    const participants = conversationId.split(':');
    for (const participantId of participants) {
      const conv = await kv.get(`conversation:${participantId}:${conversationId}`) || {};
      await kv.set(`conversation:${participantId}:${conversationId}`, {
        ...conv,
        lastMessage: text,
        lastMessageTime: timestamp,
        unreadCount: participantId === user.id ? conv.unreadCount || 0 : (conv.unreadCount || 0) + 1
      });
    }

    return c.json({ message });
  } catch (error) {
    console.log(`Send message error: ${error}`);
    return c.json({ error: "Failed to send message" }, 500);
  }
});

// Mark messages as read
app.post("/make-server-612c0bfe/messages/read", async (c) => {
  try {
    const user = await getAuthUser(c.req.header('Authorization'));
    if (!user) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const { conversationId } = await c.req.json();

    // Reset unread count
    const conv = await kv.get(`conversation:${user.id}:${conversationId}`) || {};
    await kv.set(`conversation:${user.id}:${conversationId}`, {
      ...conv,
      unreadCount: 0
    });

    return c.json({ success: true });
  } catch (error) {
    console.log(`Mark as read error: ${error}`);
    return c.json({ error: "Failed to mark as read" }, 500);
  }
});

// USERS ROUTES

// Search users
app.get("/make-server-612c0bfe/users/search", async (c) => {
  try {
    const user = await getAuthUser(c.req.header('Authorization'));
    if (!user) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const query = c.req.query('q')?.toLowerCase() || '';
    const allUsers = await kv.getByPrefix('user:');

    const filteredUsers = allUsers.filter((u: any) =>
      u.id !== user.id &&
      (u.name?.toLowerCase().includes(query) || u.email?.toLowerCase().includes(query))
    );

    return c.json({ users: filteredUsers });
  } catch (error) {
    console.log(`Search users error: ${error}`);
    return c.json({ error: "Failed to search users" }, 500);
  }
});

Deno.serve(app.fetch);