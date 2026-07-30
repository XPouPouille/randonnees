FROM node:20-alpine AS build
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install
COPY . .
ARG VITE_IGN_MODE=geoplateforme
ARG VITE_IGN_API_KEY=
ENV VITE_IGN_MODE=$VITE_IGN_MODE
ENV VITE_IGN_API_KEY=$VITE_IGN_API_KEY
RUN npm run build

FROM nginx:1.27-alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
