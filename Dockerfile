FROM node:14-alpine
ENV NODE_ENV=production

WORKDIR /app

# Copy package files
COPY ["package.json", "package-lock.json", "./"]

# Install dependencies
RUN npm ci

# Copy bot files
COPY . .

# Run app
CMD ["node", "index.js"]
