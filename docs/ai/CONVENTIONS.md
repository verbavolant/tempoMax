# CONVENTIONS.md — Regole di codice per linguaggio

> Riferimento per la §6 del `CLAUDE.md`. Tooling, idiomi e layout per i linguaggi del progetto (Python, Bash, Java, C#, Go, TypeScript).
> Adatta versioni e comandi al progetto concreto; i comandi effettivi vanno in `CONTEXT.md`.

## Regole comuni (tutti i linguaggi)
- Diff minimo, niente codice morto, niente import inutilizzati.
- Nomi espliciti; commenti solo per il *perché*.
- Errori gestiti o propagati, mai ingoiati in silenzio.
- Niente numeri/aliquote/soglie hardcoded "a memoria": da config, costante nominata o input.
- Ogni logica non banale ha un test che la dimostra.

---

## Python
- **Versione:** 3.11+ salvo diverso in `CONTEXT.md`. Type hint sempre su funzioni pubbliche.
- **Tooling:** `ruff` (lint + format), `mypy` (type check), `pytest` (test). Ambiente con `uv` o `venv`.
- **Comandi tipici:**
  ```bash
  ruff format . && ruff check --fix .
  mypy src
  pytest -q
  ```
- **Idiomi:** f-string, `pathlib` invece di `os.path`, `dataclasses`/`pydantic` per i dati strutturati, context manager per le risorse, `logging` (mai `print` in codice di produzione).
- **Evita:** `except:` nudo, mutable default arg, import con `*`, side-effect a import-time.
- **Layout:**
  ```
  src/<pacchetto>/        # codice (layout "src")
  tests/                  # test pytest, speculari a src/
  pyproject.toml          # deps, ruff, mypy, pytest
  ```

---

## Bash
- **Sempre in testa:** `#!/usr/bin/env bash` + `set -euo pipefail`.
- **Tooling:** `shellcheck` (lint), `shfmt` (format). Lo script deve passare `shellcheck` pulito.
- **Comandi tipici:**
  ```bash
  shellcheck script.sh
  shfmt -w -i 2 script.sh
  ```
- **Idiomi:** virgolette sempre attorno alle variabili (`"$var"`), `[[ ]]` non `[ ]`, `local` nelle funzioni, `trap` per cleanup, `mktemp` per file temporanei.
- **Evita:** parsing di `ls`, `cat` inutili, path non quotati, `cd` senza controllo. Se lo script supera ~100 righe o serve struttura dati seria → valuta Python.
- **Layout:**
  ```
  scripts/                # script eseguibili (+x)
  scripts/lib/            # funzioni sourceable comuni
  ```

---

## Java
- **Versione:** 21 LTS salvo diverso. Build con **Maven** o **Gradle** (un solo standard per repo).
- **Tooling:** `spotless` (format, profilo Google/Palantir), `JUnit 5` + `AssertJ` per i test.
- **Comandi tipici (Maven):**
  ```bash
  mvn spotless:apply
  mvn test
  mvn -q verify
  ```
- **Idiomi:** immutabilità dove possibile (`record`, `final`), `Optional` invece di null sui ritorni, costruttore-injection (no field injection), package per feature non per layer.
- **Evita:** `null` come valore di dominio, eccezioni checked per controllo di flusso, `System.out` (usa SLF4J), abuso di reflection/setter.
- **Layout (standard Maven):**
  ```
  src/main/java/<gruppo>/   # codice
  src/main/resources/       # config, risorse
  src/test/java/<gruppo>/   # test speculari
  pom.xml | build.gradle
  ```

---

## C#
- **Versione:** .NET 8 LTS, C# moderno. `<Nullable>enable</Nullable>` e `<TreatWarningsAsErrors>` attivi.
- **Tooling:** `dotnet format` (con `.editorconfig`), analizzatori Roslyn, `xUnit` + `FluentAssertions` per i test.
- **Comandi tipici:**
  ```bash
  dotnet format
  dotnet build -warnaserror
  dotnet test
  ```
- **Idiomi:** `async/await` end-to-end (no `.Result`/`.Wait()`), DI nativa, `record` per i DTO, pattern matching, `var` quando il tipo è ovvio.
- **Evita:** `async void` (tranne event handler), eccezioni per flusso normale, campi pubblici mutabili, blocchi `catch` vuoti.
- **Layout:**
  ```
  src/<Progetto>/           # progetto applicativo
  tests/<Progetto>.Tests/   # progetto di test
  <Soluzione>.sln
  .editorconfig             # regole di stile condivise
  ```

---

## Go
- **Versione:** 1.22+ salvo diverso. Moduli Go (`go.mod`), un solo modulo per radice di progetto.
- **Tooling:** `gofmt`/`goimports` (format, non negoziabile), `go vet` + `staticcheck` (lint), `go test` con table-driven test.
- **Comandi tipici:**
  ```bash
  gofmt -w . && goimports -w .
  go vet ./... && staticcheck ./...
  go test ./...
  go build ./...
  ```
- **Idiomi:** gestione esplicita degli errori (`if err != nil`), `errors.Is`/`errors.As` e wrapping con `%w`, `defer` per cleanup, `context.Context` come primo parametro nelle funzioni che fanno I/O, interfacce piccole definite lato consumatore, zero-value utilizzabile.
- **Evita:** ignorare errori con `_`, `panic` per il flusso normale, interfacce "grandi" anticipate, abuso di goroutine senza controllo di vita/cancellazione, naked return su funzioni lunghe.
- **Layout (standard Go):**
  ```
  cmd/<binario>/main.go     # entrypoint per ogni eseguibile
  internal/<pacchetto>/      # codice privato del modulo
  pkg/<pacchetto>/           # codice riusabile esterno (solo se serve davvero)
  go.mod | go.sum
  ```
  I test stanno accanto al codice (`foo.go` → `foo_test.go`), nello stesso pacchetto o in `<pkg>_test`.

---

## TypeScript (browser)
- **Versione:** TypeScript 6.0.x. **Non passare a 7.x** finché `typescript-eslint` non lo supporta (la 8.72 richiede `>=4.8.4 <6.1.0`).
- **Tooling:** Vite (dev/build), Vitest (test), ESLint flat config con `typescript-eslint` (lint), `tsc --noEmit` (type check, `strict` + `noUncheckedIndexedAccess`).
- **Comandi tipici:**
  ```bash
  npm run typecheck && npm run lint && npm test && npm run build
  ```
- **Idiomi:** moduli ES; `import type` per gli import usati solo come tipo (`verbatimModuleSyntax`); `async/await` con errori propagati o mostrati all'utente; tipi del dominio in `src/model/`; niente `any` (usa `unknown` + validazione ai confini: risposte API, JSON letti da Drive).
- **Evita:** `any`, `!` (non-null assertion) per zittire il compilatore nel codice applicativo (nei test va bene su dati fissi), promise non attese (floating), variabili globali, dipendenze npm per cose che il browser fa già.
- **Layout:**
  ```
  index.html        # entry di Vite
  src/              # codice
  tests/**/*.test.ts  # test Vitest
  ```

---

## Repo poliglotta
Se più linguaggi convivono nello stesso repo, isola ciascuno sotto la sua radice e tieni `docs/` a livello root:
```
backend-java/   frontend-csharp/   tools-python/   services-go/   scripts/   docs/
```
Ogni sottoprogetto può avere un proprio `AGENTS.md` locale; quello di root resta la fonte primaria.
