# ============================================================================
#  Frontend Dockerfile - Multi-stage build (React + Vite -> Nginx)
# ============================================================================

# ---------- Stage 1: build de producción con Vite ----------
FROM node:20-alpine AS builder

WORKDIR /app

# La URL de la API se inyecta en build-time (Vite la embebe en el bundle).
ARG VITE_API_URL=http://localhost:4000/api
ENV VITE_API_URL=$VITE_API_URL

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build


# ---------- Stage dev: servidor de Vite con HMR ----------
# El código se monta como volumen en docker-compose.dev.yml.
FROM node:20-alpine AS development

WORKDIR /app

COPY package*.json ./
RUN npm ci

EXPOSE 5173
CMD ["npm", "run", "dev", "--", "--host"]


# ---------- Stage 2: servir estáticos con Nginx ----------
FROM nginx:1.27-alpine AS production

# Configuración de Nginx para una SPA (fallback a index.html en rutas client-side).
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copia el build estático generado por Vite.
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
