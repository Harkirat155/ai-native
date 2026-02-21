# Headless mode (scaffold)

This is a starting point for running the Bridge in a container for remote agents.

## Build
```bash
docker build -t ai-native-bridge -f headless/Dockerfile .
```

## Run
```bash
docker run --rm -it ai-native-bridge
```

## Next steps (planned)
- Add code-server or VS Code server installation.
- Auto-install the Bridge VSIX into the server.
- Expose the Bridge WebSocket port and token export file.

