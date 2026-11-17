# BQInsights

## Development

### Setup

```sh
bun install
bun run build:openbq
```

### Run

```sh
bun run dev:openbq
```

### Build

#### Windows (exe)

```sh
bun run dist:openbq:win
```

#### macOS (dmg)

```sh
bun run dist:openbq:unsigned
```

> macOS Gatekeeper may block the app with the message: “OpenBQ” is damaged and can’t be opened. This is caused by an operating-system bug that incorrectly applies a quarantine flag. The app itself is not damaged.

```sh
# Remove the quarantine attribute in the metadata added by macOS.
xattr -cr /Applications/OpenBQ.app
```

#### Linux (deb)

```sh
bun run dist:openbq:win
```

## Start LLM service via Docker container

### Start service

```sh
docker run -d --gpus=all -v ollama:/root/.ollama -p 11434:11434 --name ollama ollama/ollama
```

### Pull model

```sh
curl http://localhost:11434/api/pull -d '{"model": "deepseek-r1:1.5b"}'
```

| Model | Size |
| --- | --- |
| gemma3:270m | 292MB |
| gemma3:1b | 815MB |
| deepseek-r1:1.5b | 1.1 GB |
| gemma3:4b | 3.3GB |
| deepseek-r1:8b | 5.2GB |
| gemma4:e2b | 7.2GB |
| gemma4:e4b | 9.6GB |
| gpt-oss:20b | 14GB |
| gemma4:26b-mlx (Darwin) | 18GB |
| qwen3.6:35b-mlx (Darwin) | 22Gb |

### Test endpoint

```sh
curl http://localhost:11434/api/generate -d '{
  "model": "deepseek-r1:1.5b",
  "prompt": "Why is the sky blue?",
  "stream": false
}'
```
