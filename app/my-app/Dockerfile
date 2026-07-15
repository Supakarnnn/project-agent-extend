FROM node:22-alpine

WORKDIR /app
ENV BACKEND_INTERNAL_URL=http://backend:8000
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

EXPOSE 3000
CMD ["npm", "start"]
