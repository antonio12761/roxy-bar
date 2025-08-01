# Variabili d'ambiente per Vercel

Vai su: https://vercel.com → Il tuo progetto → Settings → Environment Variables

Aggiungi queste variabili:

## 1. DATABASE_URL
```
postgresql://neondb_owner:npg_FgN8nzj6sXMa@ep-nameless-hill-a29w00kd-pooler.eu-central-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require
```

## 2. JWT_SECRET
```
IW6rIR+CHgsVLuenJpIdsbm+EdX4Pf9M5GJSUpENa06eivQ14QnqibOBhqj3eESY
```

## 3. SESSION_COOKIE_NAME
```
bar-roxy-session
```

## 4. SESSION_MAX_AGE
```
86400
```

## 5. SERVER_INSTANCE_ID
```
bar-roxy-clean-prod-001
```

## 6. NEXT_PUBLIC_APP_URL
```
https://www.roxycocktailbar.it
```

## Note importanti:
- NODE_ENV viene impostato automaticamente da Vercel (non serve aggiungerlo)
- Le variabili che iniziano con NEXT_PUBLIC_ sono visibili lato client
- Assicurati di selezionare gli ambienti corretti (Production, Preview, Development)