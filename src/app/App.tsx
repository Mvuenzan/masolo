import { RouterProvider } from "react-router";
import { router } from "./routes";
import InstallPrompt from '../app/components/InstallPrompt';
import React from "react";

export default function App() {
  return (
    <>
      {/* Gère toute l'application et les routes */}
      <RouterProvider router={router} />
      
      {/* Écoute globalement l'événement PWA et affiche la bannière d'installation */}
      <InstallPrompt />
    </>
  );
}