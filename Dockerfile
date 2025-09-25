FROM denoland/deno:alpine

WORKDIR /app

# Copy source
COPY . .

# Expose the server port
EXPOSE 1338

# Run using deno task
CMD ["deno", "task", "dev"]