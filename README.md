# Les recettes de notre famille

Application familiale privée pour conserver, transmettre et enrichir les recettes de la famille.

## Fonctionnalités

- recettes familiales et recettes originales de Mamie
- conservation des manuscrits originaux
- variantes et évolution des recettes au fil des générations
- photos, commentaires et souvenirs
- favoris
- gestion des membres et des rôles
- invitations privées
- interface adaptée au mobile

## Stack

- React + Vite
- Supabase (Auth, PostgreSQL, Storage)
- Vercel

## Développement local

Créer un fichier `.env` à partir de `.env.example`, puis :

```bash
npm install
npm run dev
```

Les variables Supabase sont nécessaires pour utiliser l'application.

## Structure

- `src/App.jsx` : application et pages principales
- `src/components/` : écrans fonctionnels spécialisés
- `src/lib/` : accès Supabase et logique partagée
- `api/` : fonctions serveur Vercel
