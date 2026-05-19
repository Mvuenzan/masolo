import React, { useState, useEffect } from 'react';

// Interface pour typer l'événement natif de Chrome
interface BeforeInstallPromptEvent extends Event {
  readonly platforms: Array<string>;
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
  prompt(): Promise<void>;
}

export default function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  
  // MODIFICATION 1 : On force l'affichage à true pour que la bannière soit là INSTANTANÉMENT
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setIsVisible(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    window.addEventListener('appinstalled', () => {
      setIsVisible(false);
      setDeferredPrompt(null);
    });

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    // MODIFICATION 2 : Si l'événement Chrome n'est pas encore prêt, on aide l'utilisateur
    if (!deferredPrompt) {
      alert("Cliquez sur les 3 petits points de votre navigateur en haut à droite, puis sur 'Installer l'application' ou 'Ajouter à l'écran d'accueil'.");
      return;
    }
    
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === 'accepted') {
      console.log('Application installée avec succès !');
    }
    
    setDeferredPrompt(null);
    setIsVisible(false);
  };

  // MODIFICATION 3 : On commente cette sécurité pour empêcher le composant de se cacher
  // if (!isVisible) return null;

  // Si l'état passe à false (clic sur Plus tard), on ne l'affiche plus
  if (!isVisible) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-96 bg-white border border-gray-200 dark:bg-gray-800 dark:border-gray-700 shadow-2xl rounded-xl p-4 flex items-center justify-between z-50 transition-all duration-300">
      <div className="flex items-center space-x-3">
        {/* Petite icône de smartphone stylisée */}
        <div className="p-2 bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400 rounded-lg">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
          </svg>
        </div>
        <div>
          <h4 className="text-sm font-semibold text-gray-900 dark:text-white">Installer Masolo</h4>
          <p className="text-xs text-gray-500 dark:text-gray-400">Ajoute l'application sur ton écran d'accueil</p>
        </div>
      </div>
      <div className="flex space-x-2 et-actions">
        <button 
          onClick={() => setIsVisible(false)}
          className="px-2 py-1 text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
        >
          Plus tard
        </button>
        <button
          onClick={handleInstallClick}
          className="px-3 py-1.5 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors shadow-sm"
        >
          Installer
        </button>
      </div>
    </div>
  );
}