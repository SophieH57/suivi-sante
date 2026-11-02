# Suivi santé

Application web installable (PWA) pour noter en 1–2 taps les symptômes ressentis dans la journée.

- Symptômes et médicaments favoris : un tap enregistre l'heure, contexte libre en option
- Selles selon l'échelle de Bristol
- Bilan du soir : sommeil, humeur, stress, cycle, activités, note
- Calendrier du mois coloré (vert : aucun symptôme, orange : 1–2, rouge : 3 et plus), couleur modifiable à la main
- Fonctionne hors ligne ; données sur le téléphone, copie en ligne via Firebase (compte Google), export / restauration JSON

Voir [PLAN.md](PLAN.md) pour le détail des choix.

## Tester en local

```sh
python3 -m http.server 8000   # puis ouvrir http://localhost:8000
```

## Mettre en ligne (GitHub Pages)

1. Settings → Pages → Source : branche `main`, dossier `/`.
2. Sur le téléphone, ouvrir `https://sophieh57.github.io/suivi-sante/` dans Chrome → menu ⋮ → « Installer l'application ».

Après une modification des fichiers, changer `CACHE` dans `sw.js` pour forcer la mise à jour.

## Sauvegarde en ligne (Firebase)

1. Console Firebase → nouveau projet.
2. Firestore Database → créer la base en région **europe-west9 (Paris)** → onglet Règles : coller `firestore.rules`.
3. Authentication → Sign-in method → activer **Google** ; Paramètres → Domaines autorisés → ajouter `sophieh57.github.io`.
4. Paramètres du projet → Vos applications → ajouter une appli Web → copier la configuration dans `firebase-config.js`.
