# --- Stage 1: Build the Next.js application ---
# Use an official Node.js image as the base for building.
FROM node:18-alpine AS builder

# Set the working directory inside the container.
WORKDIR /app

# Copy package.json and package-lock.json to the working directory.
# This allows Docker to cache the dependency installation step.
COPY package*.json ./

# Install dependencies.
RUN npm install

# Copy the rest of the application files.
COPY . .

# Build the Next.js application for production.
RUN npm run build


# --- Stage 2: Create a production-ready image ---
# Use a minimal Node.js image to run the application.
FROM node:18-alpine

# Set the working directory inside the container.
WORKDIR /app

# Copy only the necessary files from the builder stage.
# This includes the `node_modules`, `.next` folder, and `package.json`
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/package.json ./package.json

# Expose the port on which the Next.js server will run.
EXPOSE 3000

# Set the command to start the Next.js production server.
CMD ["npm", "start"]
