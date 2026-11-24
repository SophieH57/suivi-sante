# Suivi santé — plan

Application web installable (PWA) pour noter en 1–2 taps les symptômes ressentis dans la journée.
Usage personnel, une seule utilisatrice, téléphone Android.

## Fonctionnalités

### 1. Saisie rapide (écran d'accueil)
4 boutons : 🤒 Symptôme, 💊 Médicament, 🏃 Sport, 💩 Selles.

- **Symptôme** : choix de la zone du corps (Tête / ORL, Ventre / digestif, Thorax / dos / membres,
  Général / peau / moral) → fenêtre avec les favoris de la zone, les récents et « Autre… ».
  Contexte libre facultatif (intensité, durée, repas, température…).
- **Médicament** : fenêtre avec favoris, récents et « Autre… ». Dose et note facultatives.
- **Sport** : fenêtre avec favoris, récents et « Autre… ». Durée (minutes) et note facultatives.
- Favori : 1 tap → saisie + heure (toast avec « Détails » / « Annuler »).
- **Autre…** : saisie **ponctuelle**, nom tapé à la main (+ emoji, heure modifiable). Elle n'est pas
  ajoutée aux Réglages ; si le nom est celui d'un favori, la saisie est reliée au favori.
- **Récents** : 5 dernières saisies ponctuelles (noms différents, hors favoris ; par zone pour les symptômes).
  1 tap pour la re-saisir, ⭐ pour l'ajouter aux favoris.
- **Selles** : bouton 💩 → choix du type sur l'échelle de Bristol (1 à 7, avec description courte) + heure. Note facultative.
- Frise du jour : liste chronologique des saisies, modifiables / supprimables (heure, contexte).

### 2. Bilan du soir
- Sommeil : heures + qualité (1–5)
- Humeur (1–5), stress (1–5)
- Cycle : case « règles aujourd'hui » + jour du cycle (facultatif)
- Activités : sélection d'un ou plusieurs types (yoga, zumba, course à pied, marche,
  vélo elliptique, vélo d'appartement) + note. Les activités notées dans la journée sont cochées d'avance ;
  les activités ponctuelles sont rappelées en dessous.
- Note libre du jour
- Rappel : alarme Android récurrente au début (pas de code) ; notification push en option plus tard.

### 3. Calendrier du mois
- Une pastille par jour :
  - 🟢 vert : 0 à 2 saisies de symptôme
  - 🟠 orange : 3 à 4 saisies
  - 🔴 rouge : 5 saisies et plus
- Couleur modifiable à la main ; la couleur manuelle prime sur le calcul.
- Seules les saisies de **symptômes** comptent, favoris et ponctuels (pas les médicaments, le sport ni les selles).
- Tap sur un jour → détail : symptômes, médicaments, sport, selles, bilan.
- Flèches pour naviguer entre les mois.

### 4. Réglages
- Listes modifiables : symptômes, médicaments, types d'activité (ajout, renommage, ordre, emoji).
- Symptômes rangés par zone (une zone par symptôme). Les symptômes enregistrés avant les zones
  sont rangés au premier lancement (fenêtre de choix ; sans réponse : Général, redemandé au lancement suivant).
- Connexion Google (sauvegarde en ligne).
- Export / restauration JSON.

## Stack (identique au projet `library`)
- HTML + JavaScript + CSS, **sans étape de compilation**.
- PWA : `manifest.webmanifest` + `sw.js` (fonctionne hors ligne).
- Données : `localStorage` sur le téléphone + copie dans **Firebase Firestore** (connexion Google).
  Firestore met les écritures en file hors ligne et les envoie au retour du réseau.
- Mise en ligne : **GitHub Pages** (branche `main`, dossier `/`) → `https://sophieh57.github.io/suivi-sante/`.
- Projet Firebase **dédié** (séparé de celui de `library`), base Firestore en région **europe-west9 (Paris)**.

## Données

Stockage local : un objet JSON dans `localStorage`.
Firestore (même principe que `library`) :

```
users/{uid}                  → listes : symptoms [{ id, name, emoji, zone }], meds, activities
users/{uid}/days/{AAAA-MM-JJ} → tout ce qui concerne un jour :
  symptoms: [{ id, typeId, zone, time, context }]
  meds:     [{ id, medId, time, dose, note }]
  sports:   [{ id, actId, time, duration, note }]
  stools:   [{ id, bristol (1–7), time, note }]
  checkin:  { sleepHours, sleepQuality, mood, stress, period, cycleDay, activities: [typeId], note }
  color:    null | 'green' | 'orange' | 'red'
```

Saisie ponctuelle : pas de `typeId` / `medId` / `actId`, mais `name` (+ `emoji` facultatif) dans la saisie.
Les récents sont recalculés à partir de l'historique (rien de plus à stocker).

Un document par jour : synchronisation simple, lecture d'un mois = ~31 documents.
Les jours sont découpés selon l'heure locale du téléphone.

Règles Firestore : chaque compte ne lit et n'écrit que `users/{son uid}/…` (comme `library/firestore.rules`).

## Étapes

1. **Mise en place** : dépôt GitHub, squelette PWA (index, style, manifest, service worker, icône),
   projet Firebase (Firestore europe-west9, connexion Google, domaine `sophieh57.github.io` autorisé),
   GitHub Pages activé.
2. **Saisie** : symptômes, médicaments, selles (Bristol), frise du jour, gestion des listes.
3. **Bilan du soir** : formulaire avec activités.
4. **Calendrier du mois** : couleurs, détail du jour, couleur manuelle.
5. **Sauvegarde** : connexion Google + synchronisation Firestore, export / restauration JSON.
6. **Option** : notification push du soir.

Les étapes 2–4 fonctionnent déjà sans compte (données sur le téléphone) ; l'étape 5 ajoute la copie en ligne.

## Hors périmètre (volontairement)
Intensité et durée structurées, suivi des repas, météo, export médecin, corrélations automatiques.
À noter si besoin dans le contexte libre.
