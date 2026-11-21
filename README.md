# SafetyProof AI

SafetyProof AI cross-checks garment factory inspection reports against supporting records. The reviewer can compare English and Bangla evidence, open the exact PDF page behind a result, and keep a record of their decision.

Live app: https://safetyproof.vercel.app · API: https://safetyproof-api.vercel.app/docs

## Local setup

Requires Docker, Python 3.12, Node 22 and npm. Run from the repository root.

```bash
python3 -m venv .venv
. .venv/bin/activate
pip install -r backend/requirements-dev.lock
npm --prefix frontend ci

npx --yes supabase@2.98.2 start --exclude studio,imgproxy,realtime,postgres-meta,logflare,vector,edge-runtime,supavisor,mailpit
mkdir -p .local/tessdata
for lang in eng ben; do
  curl -fsS "https://raw.githubusercontent.com/tesseract-ocr/tessdata_fast/87416418657359cb625c412a48b6e1d6d41c29bd/$lang.traineddata" -o ".local/tessdata/$lang.traineddata"
done
python scripts/local_setup.py
```

The setup script records the generated local reviewer, viewer and Factory Manager passwords in `.local/accounts.json`. Both this file and the root `.env` are ignored by Git. Keep the local Supabase stack on a trusted network. Choose **Sign in** and use the reviewer account, then **Load sample case**. The original sample files are also available in **Document library** without signing in.

Add a free-tier project key as `GEMINI_API_KEY` in the root `.env`. Before starting the backend, check generation and embeddings with `PYTHONPATH=backend python scripts/check_models.py`. Set `MIN_REQUEST_INTERVAL` according to the project's quota. Start the services in separate terminals.

```bash
PYTHONPATH=backend .venv/bin/uvicorn safetyproof.main:app --host 127.0.0.1 --port 8000
npm --prefix frontend run dev
```

Open **http://localhost:3000**. Restart FastAPI after editing environment variables. API documentation is available at **http://127.0.0.1:8000/docs**.

## How verification works

FastAPI stores private originals in Supabase Storage and extracts page-bound text. Printed scans use Tesseract with English and Bangla language data. Gemini extracts structured assertions and findings from inspection reports. Supabase pgvector ranks candidate passages together with lexical and asset identifier matching. Gemini then verifies the retrieved evidence. A separate blind natural-language inference prompt uses the same model and sends disagreements to review. The application validates exact source quotations, applies scope checks and records the documents examined before publishing results.

The three review flags are contradiction, unsupported claim and missing documented closure. Unreadable pages and incomplete searches can prevent an assessment. The reviewer can accept or dismiss a flag, request evidence, or add a note. Decisions apply to their analysis run. **Overview** brings pending flags and evidence requests together. Requests remain open across later runs until a reviewer changes the decision on the original assessment. **Run history** compares selected document revisions and exact source-matched outcomes. Formal closure and physical safety assessments remain the responsibility of the appropriate inspection authority.

Upload a Corrective Action Plan using the **CAP** document role and include it in a run. **CAP matching** shows source-cited actions and suggests links from explicit finding references or shared asset identifiers. A reviewer may confirm, dismiss, or manually add a link. Each decision belongs to its snapshot.

## Factory Manager workflow

Sign in as a reviewer, open a case and choose **Corrective work → Share with manager**. Enter the email of a confirmed Supabase Auth account with `app_metadata.workspace_role` set to `factory_manager`. Local setup provisions `factory-manager@safetyproof.test`. The Factory Manager can open shared cases, assign work to a person or department, set deadlines, start tasks and upload corrective evidence. Private audit records and verification results stay in the auditor workspace.

The reviewer can open the submitted PDF, request a revision or accept the evidence. **Add to verification** brings the same PDF into the case document reader for a future verification run. Factory submissions and reviewer decisions remain in task history.

## Verification and evaluation

```bash
PYTHONPATH=backend .venv/bin/pytest -q backend/tests
npm --prefix frontend run build
.venv/bin/python scripts/make_fixtures.py --evaluation
PYTHONPATH=backend .venv/bin/python evaluation/run.py --split held_out --baseline
```

The integration test uses real local Supabase and a scripted inference boundary. The evaluation command requires running services and a configured Gemini key and calls the real provider. Results go under `evaluation/output/`. Document fixtures are fictional. Their labels are separate from the application inputs. More details are in [evaluation/README.md](evaluation/README.md).

## Deployment and disclosure

Deploy two Vercel projects from this repository: `frontend` (Next.js) and `backend` (FastAPI). The backend uses Vercel Queues for document processing and bounded, resumable verification jobs. Supabase provides Auth, Postgres and private PDF storage. Configuration and the live demonstration sequence are in the [delivery guide](docs/planning/delivery.md). The Docker service in `render.yaml` remains an optional alternative; run only one worker deployment against a database. Record the public repo, live link, demo video and team member names before submitting. Share test credentials in the organizer's submission form.

- Stack and libraries include [Next.js](https://nextjs.org), React, Tailwind CSS, TanStack Query, Lucide, PDF.js, [FastAPI](https://fastapi.tiangolo.com), [Supabase](https://supabase.com), pgvector, pdfplumber, pypdfium2 and [Tesseract](https://github.com/tesseract-ocr/tesseract). The lock files list exact dependencies.
- AI inference uses Gemini API with `gemini-3.5-flash-lite` and `gemini-embedding-001` by default. Google’s SDK provides access. The application uses no model training.
- DM Sans and Noto Sans Bengali are served locally through Fontsource. The document illustration uses HTML and CSS. Synthetic PDFs are generated with ReportLab and Pillow.
- OpenAI Codex assisted with planning, implementation, debugging and testing. Add other tools if the team uses them.
- All PDFs included here are fictional. Send only synthetic records through the free model API for this prototype.
