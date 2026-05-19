# Guide de Déploiement - masolo.com

Ce guide vous explique comment déployer votre application de messagerie gratuitement.

## Architecture

- **Frontend**: Hébergé sur Vercel (gratuit)
- **Backend**: Supabase Edge Functions (gratuit)
- **Base de données**: Supabase PostgreSQL (gratuit)
- **Authentification**: Supabase Auth (gratuit)

## Étape 1: Déployer le Backend Supabase

### 1.1 Déployer la fonction Edge depuis Figma Make

1. Ouvrez les **Paramètres Make** dans l'interface Figma Make
2. Trouvez la section **Supabase**
3. Cliquez sur **"Deploy Edge Function"** ou **"Déployer la fonction"**
4. Attendez que le déploiement soit terminé (environ 30 secondes)
5. Vous verrez un message de confirmation

⚠️ **IMPORTANT**: Vous devez déployer la fonction Edge depuis Make avant que l'application ne fonctionne. Sans cela, toutes les requêtes API échoueront.

### 1.2 Vérifier que le backend fonctionne

Une fois déployé, testez votre backend en visitant:
```
https://nrsfflpgmnsanmfoqefi.supabase.co/functions/v1/make-server-612c0bfe/health
```

Vous devriez voir: `{"status":"ok"}`

## Étape 2: Déployer le Frontend sur Vercel

### 2.1 Préparer votre code

1. Créez un compte gratuit sur [Vercel](https://vercel.com)
2. Installez Git si ce n'est pas déjà fait
3. Créez un dépôt Git pour votre projet:

```bash
cd /path/to/your/project
git init
git add .
git commit -m "Initial commit - masolo.com"
```

### 2.2 Pousser sur GitHub

1. Créez un nouveau dépôt sur [GitHub](https://github.com)
2. Poussez votre code:

```bash
git remote add origin https://github.com/votre-username/masolo.git
git branch -M main
git push -u origin main
```

### 2.3 Déployer sur Vercel

1. Connectez-vous à [Vercel](https://vercel.com)
2. Cliquez sur **"New Project"**
3. Importez votre dépôt GitHub
4. Configurez les paramètres de build:
   - **Framework Preset**: Vite
   - **Build Command**: `pnpm build`
   - **Output Directory**: `dist`
   - **Install Command**: `pnpm install`

5. Cliquez sur **"Deploy"**

### 2.4 Configuration des variables d'environnement (Optionnel)

Si vous avez des variables d'environnement à configurer:

1. Allez dans **Project Settings** → **Environment Variables**
2. Ajoutez vos variables si nécessaire

## Étape 3: Tester votre application

1. Une fois le déploiement terminé, Vercel vous donnera une URL (ex: `https://masolo.vercel.app`)
2. Visitez cette URL
3. Créez un compte avec l'inscription
4. Testez la messagerie

## Fonctionnalités actuelles

✅ Inscription et connexion des utilisateurs  
✅ Authentification sécurisée avec Supabase  
✅ Liste des conversations  
✅ Envoi et réception de messages en temps réel  
✅ Statut en ligne/hors ligne  
✅ Messages non lus  
✅ Interface responsive et moderne  

## Limitations du plan gratuit

### Vercel (Gratuit)
- Bande passante: 100 GB/mois
- Builds: Illimités
- Domaines personnalisés: 1 domaine

### Supabase (Gratuit)
- Base de données: 500 MB
- Bande passante: 5 GB/mois
- Edge Function: 500,000 requêtes/mois
- Utilisateurs actifs: Illimité

Ces limites sont largement suffisantes pour un projet personnel ou un petit MVP.

## Domaine personnalisé (Optionnel)

Pour utiliser `masolo.com` au lieu de `masolo.vercel.app`:

1. Achetez le domaine `masolo.com` chez un registrar (Namecheap, Google Domains, etc.)
2. Dans Vercel, allez dans **Project Settings** → **Domains**
3. Ajoutez `masolo.com`
4. Suivez les instructions pour configurer les DNS

## Mise à jour de l'application

Pour mettre à jour votre application après des modifications:

```bash
git add .
git commit -m "Description de vos modifications"
git push
```

Vercel déploiera automatiquement la nouvelle version.

## Support

Si vous avez des questions:
- Documentation Vercel: https://vercel.com/docs
- Documentation Supabase: https://supabase.com/docs
- Communauté Figma Make: https://forum.figma.com

---

🎉 **Félicitations !** Votre application de messagerie est maintenant en ligne et accessible à tous, gratuitement !
