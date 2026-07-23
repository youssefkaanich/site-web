<?php

return [
    // Fichier JSON de la clé de service Firebase (jamais commité, voir .gitignore).
    // Par défaut : storage/app/firebase-service-account.json
    'credentials' => env('FIREBASE_CREDENTIALS') ?: storage_path('app/firebase-service-account.json'),

    'project_id' => env('FIREBASE_PROJECT_ID'),
];
