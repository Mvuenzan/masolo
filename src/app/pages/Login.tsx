import { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import { Mail, Lock, MessageCircle, User } from "lucide-react";
import { createClient, apiCall } from "../../../utils/supabase/client";
import InstallPrompt from '../components/InstallPrompt';
import React from "react";

export default function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    // Check if user is already logged in
    const checkSession = async () => {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        navigate("/home");
      }
    };
    checkSession();
  }, [navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); // ✅ Corrigé (au lieu de loading(true))
    setError("");

    // SÉCURITÉ : Forcer au moins 8 caractères uniquement à l'inscription
    if (isSignUp && password.length < 8) {
      setError("Le mot de passe doit contenir au moins 8 caractères.");
      setLoading(false);
      return;
    }

    try {
      const supabase = createClient();

      if (isSignUp) {
        // Sign up
        await apiCall("/auth/signup", {
          method: "POST",
          body: JSON.stringify({ email, password, name }),
        });

        // Sign in after sign up
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (signInError) throw signInError;

        // Update online status
        await apiCall("/auth/status", {
          method: "POST",
          body: JSON.stringify({ online: true }),
        });

        navigate("/home");
      } else {
        // Sign in
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (signInError) throw signInError;

        // Update online status
        await apiCall("/auth/status", {
          method: "POST",
          body: JSON.stringify({ online: true }),
        });

        navigate("/home");
      }
    } catch (err: any) {
      console.error("Authentication error:", err);
      setError(err.message || "Échec de la connexion");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-blue-500 via-purple-500 to-pink-500 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo et Titre */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-white rounded-full shadow-lg mb-4">
            <MessageCircle className="w-10 h-10 text-purple-600" />
          </div>
          <h1 className="text-4xl text-white mb-2">masolo.com</h1>
          <p className="text-white/90">Connectez-vous avec le monde</p>
        </div>

        {/* Formulaire de connexion */}
        <div className="bg-white rounded-3xl shadow-2xl p-8">
          <h2 className="text-2xl mb-6 text-center text-gray-800">
            {isSignUp ? "Créer un compte" : "Bienvenue"}
          </h2>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm font-medium">
              {error}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-5">
            {/* Name Input (for sign up only) */}
            {isSignUp && (
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <User className="w-5 h-5 text-gray-400" />
                </div>
                <input
                  type="text"
                  placeholder="Nom complet"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full pl-12 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                  required
                />
              </div>
            )}

            {/* Email Input */}
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <Mail className="w-5 h-5 text-gray-400" />
              </div>
              <input
                type="email"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-12 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                required
              />
            </div>

            {/* Password Input */}
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <Lock className="w-5 h-5 text-gray-400" />
              </div>
              <input
                type="password"
                placeholder={isSignUp ? "Mot de passe (8 caractères min.)" : "Mot de passe"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                minLength={isSignUp ? 8 : undefined}
                className="w-full pl-12 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                required
              />
            </div>

            {/* Forgot Password */}
            {!isSignUp && (
              <div className="text-right">
                <button type="button" className="text-sm text-purple-600 hover:text-purple-700 transition-colors">
                  Mot de passe oublié ?
                </button>
              </div>
            )}

            {/* Login/Sign Up Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-xl hover:from-purple-700 hover:to-pink-700 transition-all shadow-lg hover:shadow-xl transform hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? "Chargement..." : isSignUp ? "S'inscrire" : "Se connecter"}
            </button>
          </form>

          {/* Toggle Sign Up / Sign In */}
          <div className="text-center mt-6">
            <p className="text-gray-600">
              {isSignUp ? "Vous avez déjà un compte ?" : "Pas encore de compte ?"}{" "}
              <button
                type="button"
                onClick={() => {
                  setIsSignUp(!isSignUp);
                  setError("");
                }}
                className="text-purple-600 hover:text-purple-700 transition-colors"
              >
                {isSignUp ? "Se connecter" : "S'inscrire"}
              </button>
            </p>
          </div>
        </div>
      </div>

      {/* Message d'installation instantané */}
      <InstallPrompt />
    </div>
  );
}