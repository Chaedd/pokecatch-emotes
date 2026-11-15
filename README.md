# Poke'Catch · Concours d'emotes

Plateforme de dépôt et de vote pour le concours d'emotes du Discord. **Rien n'est partagé avec le jeu** : autre projet Supabase, autre dépôt, autre adresse.

## Ce que ça fait

- **Dépôt** : un membre du serveur se connecte avec Discord, dépose des images ou un `.zip`. Le zip est ouvert **dans son navigateur** : seules les images en sortent, le zip n'est jamais envoyé.
- **Aperçu** : chaque lot est montré en grille et en taille « chat », sur fond sombre ou clair.
- **Vote** : par lot, 3 votes par membre (réglable), pas pour son propre lot. L'ordre des lots change d'un visiteur à l'autre.
- **Modération** : un lot n'apparaît qu'après ton accord (onglet Modération, visible par toi seul). Tu y ouvres / fermes les dépôts et les votes, et tu rends les scores visibles quand tu veux.

## Pourquoi c'est sans danger pour ton ordinateur

1. Tu ne télécharges rien pour juger : tout se regarde dans la page, en `<img>`. Un fichier qui n'est pas une image ne s'affiche pas, il ne s'exécute pas.
2. Le type est lu dans les premiers octets du fichier (pas l'extension) ; un `.exe` renommé en `.png` est refusé.
3. Les images fixes sont **redessinées** en PNG neuf par le navigateur : seuls les pixels passent. Les GIF (animés) sont gardés tels quels, après vérification.
4. Côté serveur, le stockage n'accepte que `image/png` et `image/gif`, 256 Ko max par fichier, 80 fichiers par membre.
5. Pour récupérer les emotes du gagnant : bouton « Télécharger (copies nettoyées) » de la modération, qui redessine encore une fois chaque PNG chez toi.

Un participant qui contournerait la page pourrait au pire envoyer un fichier non-image déclaré comme image : il resterait une icône cassée dans la modération, à supprimer.

## Essayer tout de suite (mode démo)

Tant que `config.js` est vide, la page tourne avec de faux lots et n'envoie rien :

```bash
python -m http.server 5599 --bind 127.0.0.1
```

puis http://127.0.0.1:5599 — « Se connecter » te met en faux membre + modérateur.

## Mise en ligne (gratuit, ~20 min)

### 1. Supabase — un projet à part
1. https://supabase.com/dashboard › **New organization** (plan Free, pas l'organisation du jeu) › **New project** (région Europe).
2. Note l'adresse du projet (`https://xxxx.supabase.co`) et la clé **anon / publishable** (Settings › API Keys).

### 2. Discord — une application pour la connexion
1. https://discord.com/developers/applications › **New Application** (ex. « Emote Contest »).
2. **OAuth2** › Redirects : ajoute `https://xxxx.supabase.co/auth/v1/callback`.
3. Copie **Client ID** et **Client Secret** dans Supabase › Authentication › Sign In / Providers › **Discord** (activer).

### 3. La base
1. Ouvre `supabase/setup.sql`, remplace en haut `SERVER_ID_HERE` (ID du serveur) et `YOUR_DISCORD_USER_ID_HERE` (ton ID) — Discord › Paramètres › Avancés › Mode développeur, puis clic droit › Copier l'identifiant.
2. Colle tout le fichier dans Supabase › SQL Editor › Run.

Ajouter un modérateur plus tard : `insert into admins values ('son_id_discord');`

### 4. La page
1. Remplis `config.js` (adresse, clé anon, lien d'invitation du serveur).
2. Crée un dépôt GitHub **public** (ex. `pokecatch-emotes`), pousse ce dossier, puis Settings › Pages › Deploy from branch › `main` / root.
3. Dans Supabase › Authentication › URL Configuration : **Site URL** et **Redirect URLs** = l'adresse de la page (`https://<compte>.github.io/pokecatch-emotes/`).

### 5. Vérifier avant d'annoncer
- Connexion avec ton compte : ton pseudo s'affiche, l'onglet Modération apparaît.
- Dépose un lot de test, approuve-le, vote avec un second compte, supprime-le.
- Un compte qui n'est pas sur le serveur doit voir « réservé aux membres ».

## Limites du gratuit

- Supabase Free : 1 Go de fichiers (≈ 4 000 emotes au poids maximum), 5 Go de trafic par mois, projet mis en pause après 7 jours sans visite (il se relance d'un clic).
- GitHub Pages : gratuit, dépôt public (il ne contient aucun secret : la clé anon est publique par nature, les droits sont dans le SQL).

## Déroulé conseillé

1. Dépôts ouverts, votes fermés → tu approuves au fil de l'eau.
2. Dépôts fermés, votes ouverts (scores cachés).
3. Votes fermés, « Scores visibles par tous » → annonce du gagnant.
