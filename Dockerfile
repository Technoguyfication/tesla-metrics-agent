FROM node:18-alpine as builder

WORKDIR /build

# Copy files to generate dependencies
COPY ["package.json", "package-lock.json", "./"]

# Download and install dependencies
RUN ["npm", "ci"]

# Copy project code
COPY ["tsconfig.json", "./"]
COPY ["src/", "src/"]

# Compile typescript
RUN ["npx", "tsc"]

FROM node:18-alpine

WORKDIR /app

# Set node environment so NPM doesn't download dev dependencies
ENV NODE_ENV=production

# Download and install dependencies (again)
COPY --from=builder ["/build/package.json", "/build/package-lock.json", "./"]
RUN ["npm", "ci"]

COPY --from=builder ["/build/build", "./"]

ENTRYPOINT ["node", "."]
