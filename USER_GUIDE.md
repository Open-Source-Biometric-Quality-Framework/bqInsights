# BQInsights (OpenBQ)

`BQInsights` (beta) is a desktop application provided by the [OpenBQ](openbq.io) project. It aims to equip biometric identity system operators with analytical capabilities that provide deeper insights and help improve and ensure the system’s data quality.

## Quick Start

> This project is in beta for early access and is not recommended for production environments.

### Prerequisites

You can run the application on Windows, macOS, and Linux. Both ARM and x86 platforms are supported.

- [ ] [Git](https://git-scm.com/install/) (to sync source code)
- [ ] [Python](https://www.python.org/downloads/) (to provide application runtime, Windows only)
- [ ] [Node.js](https://nodejs.org/en/download) (to provide application runtime)
- [ ] [Bun](https://bun.com/get) (to provide application runtime)
- [ ] [Visual Studio](https://visualstudio.microsoft.com/downloads/) (use Desktop development with C++ workload, Windows only)
- [ ] [Docker](https://docs.docker.com/get-started/get-docker/) (to host data processing backend)
- [ ] [Ollama](https://ollama.com/download) (to provide local AI capability)

> You don’t have to use a locally hosted Ollama LLM. You can bring your own AI model—the application supports OpenAI- or Claude-compatible models, hosted locally or remotely.

### Set Up

- Find a location on your computer, open a terminal and run:

```sh
git clone https://github.com/Open-Source-Biometric-Quality-Framework/bqInsights.git
```

This will pull the source code to the current directory.

- Go into the project directory (`/bqInsights`) and run the commands below to build and install the project:

```sh
bun install
```

```sh
bun run build:openbq
```

- Once all dependencies properly configured, run the following command to start up the application:

```sh
bun run dev:openbq
```

### Update

- Pull latest changes from the source code repository:

```sh
git pull
```

### Uninstall

- Simply remove the project directory.

## Use Prebuilt Installer

Alternatively, you could [download](https://github.com/Open-Source-Biometric-Quality-Framework/bqInsights/releases) the prebuilt installer (macOS, Windows, Linux).

> macOS Gatekeeper may block the app with the message: “OpenBQ” is damaged and can’t be opened. This is caused by an operating-system bug that incorrectly applies a quarantine flag. The app itself is not damaged.

```sh
# Remove the quarantine attribute in the metadata added by macOS.
xattr -cr /Applications/OpenBQ.app
```
