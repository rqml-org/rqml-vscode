# RQML VS Code

Official development repository for the RQML VS Code extension.

RQML (Requirements Markup Language) is an open standard for structured, LLM-first software requirements. This repository contains the source code and supporting assets for the VS Code extension that enables working with RQML in real projects.

---

## 📦 Repository contents

This repository is intentionally multi-part:

* `extension/`
  Source code for the VS Code extension, including the Marketplace-facing README and packaging configuration.

* `docs/`
  Documentation site for the extension and RQML tooling.

* `rqml-vscode.rqml`
  The RQML specification for this project itself (RQML dogfooding).

* `.github/`
  CI workflows, issue templates, and community configuration.

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

```bash
npm install
```

### Run the extension locally

Open the repo in VS Code and press:

```text
F5
```

This launches a new Extension Development Host.

### Run the docs site

```bash
cd docs
npm install
npm start
```

### Build

```bash
npm run build
```

---

## 🧠 Project principles

* **Open standard**
  RQML is defined independently at https://rqml.org

* **Fully open source extension**
  The VS Code extension is and will remain fully open source

* **No crippleware model**
  Any future commercial offerings (if any) will live outside the extension

* **LLM-first design**
  RQML is designed to work naturally with coding agents and AI-assisted development

---

## 🔗 Related projects

* 🌐 Standard: https://rqml.org
* 🛠 Tooling & docs: https://rqml.dev
* 📦 Extension source: `extension/`
* 📄 Extension spec: `rqml-vscode.rqml`

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
