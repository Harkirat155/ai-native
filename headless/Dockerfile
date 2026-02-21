FROM node:18-bullseye

ENV DEBIAN_FRONTEND=noninteractive

# Minimal deps for VS Code CLI + extension packaging. (Headless VS Code server wiring is v1.)
RUN apt-get update && apt-get install -y --no-install-recommends \
  git \
  curl \
  ca-certificates \
  unzip \
  xvfb \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY . .

# Build the controller (Node) and protocol docs; VSIX can be built in CI/release flows.
RUN npm install && npm run build && npm run -s protocol:generate

CMD ["bash", "-lc", "echo 'Headless mode scaffold. Next: wire code-server + auto-install VSIX into server.' && sleep infinity"]

