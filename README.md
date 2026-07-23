# RQML VS Code

Official development repository for the RQML VS Code extension.

RQML (Requirements Markup Language) is an open standard for structured software requirements that both people and coding agents can read and write. This repository contains the source code and supporting assets for the VS Code extension that enables working with RQML in real projects.

---

## 📦 Repository contents

This repository is intentionally multi-part:

* `extension/`
  Source code for the VS Code extension, including the Marketplace-facing README and packaging configuration.

* `docs/`
  Documentation site for the extension and RQML tooling.

* `requirements.rqml`
  The RQML specification for this project itself (RQML dogfooding).

* `.rqml/`
  Architecture Decision Records and the drift baseline for this project.

---

## 🚀 For users

If you are looking to **use RQML in VS Code**:

* Install the extension from the VS Code Marketplace
* See the extension README: `extension/README.md`
* Visit documentation: https://rqml.dev

---

## 🧭 For contributors

This repository is the **development home** of the RQML VS Code extension.

### Prerequisites

* Node.js (LTS recommended)
* VS Code
* npm or pnpm

### Install dependencies

Dependencies live in two packages, and both are needed to build the extension:

```bash
npm install --prefix extension && npm install --prefix extension/webview-ui
```

### Run the extension locally

Open the repo in VS Code and press `F5`. This launches an Extension Development
Host. The default build task watches both halves of the build — `tsc` for the
extension host (`extension/out/`) and esbuild for the webview bundles
(`extension/dist/`) — so the views render on a fresh clone.

### Build

```bash
npm run build:extension
```

### Package a VSIX

```bash
npm run package
```

### Check the specification

This repository is governed by its own RQML specification, and the check must
pass before a change is complete:

```bash
npx @rqml/cli check
```

### Run the docs site

```bash
npm install --prefix docs && npm start --prefix docs
```

---

## 🧠 Project principles

* **Open standard**
  RQML is defined independently at https://rqml.org

* **Fully open source extension**
  The VS Code extension is and will remain fully open source

* **No crippleware model**
  Any future commercial offerings (if any) will live outside the extension

* **Machine-checkable**
  A specification is only useful if something can verify it; `@rqml/cli` provides
  the same deterministic checks in CI that the extension surfaces in the editor

---

## 🔗 Related projects

* 🌐 Standard: https://rqml.org
* 🛠 Tooling & docs: https://rqml.dev
* 📦 Extension source: `extension/`
* 📄 Extension spec: `requirements.rqml`

---

## 🤝 Contributing

Contributions are welcome.

* Open an issue to discuss ideas or bugs
* Submit a pull request for improvements
* Keep changes aligned with RQML principles and simplicity

---

## 🏢 Maintained by

RQML is developed and maintained by Stakkar Analytics.

---
