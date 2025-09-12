# Étape 1 : Build du TypeScript
#FROM node:18-alpine AS builder

#WORKDIR /app

#COPY package*.json ./
#RUN npm install

#COPY tsconfig.json ./
#COPY . ./

# Compile front.ts → dist/front.js
#RUN npx tsc

# Étape 2 : Serveur NGINX
#FROM nginx:alpine

# Copie le JS compilé
#COPY --from=builder /app/dist /usr/share/nginx/html/


#COPY --from=builder /app/dist /usr/share/nginx/html/dist
#COPY --from=builder /app/index.html /usr/share/nginx/html/index.html
#COPY --from=builder /app/dist/output.css /usr/share/nginx/html/output.css
#COPY --from=builder /app/src/pages /usr/share/nginx/html/src/pages

#EXPOSE 80

#CMD ["nginx", "-g", "daemon off;"]
# Étape de build
FROM node:20-alpine

WORKDIR /app
COPY package*.json ./
RUN npm ci

COPY . .

ENV NODE_ENV=development

EXPOSE 5173

CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]