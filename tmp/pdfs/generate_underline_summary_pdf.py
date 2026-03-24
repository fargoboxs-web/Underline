from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import inch
from reportlab.platypus import Frame, KeepInFrame, Paragraph, Spacer
from reportlab.pdfgen import canvas


ROOT = Path("/Users/fargobox/Underline")
OUTPUT = ROOT / "output/pdf/underline-app-summary.pdf"


def build_styles():
    styles = getSampleStyleSheet()
    return {
        "title": ParagraphStyle(
            "Title",
            parent=styles["Heading1"],
            fontName="Helvetica-Bold",
            fontSize=20,
            leading=24,
            textColor=colors.HexColor("#162316"),
            spaceAfter=4,
        ),
        "subtitle": ParagraphStyle(
            "Subtitle",
            parent=styles["BodyText"],
            fontName="Helvetica",
            fontSize=9,
            leading=11,
            textColor=colors.HexColor("#5F685D"),
            spaceAfter=8,
        ),
        "section": ParagraphStyle(
            "Section",
            parent=styles["Heading2"],
            fontName="Helvetica-Bold",
            fontSize=10,
            leading=12,
            textColor=colors.HexColor("#D6743A"),
            spaceBefore=0,
            spaceAfter=4,
        ),
        "body": ParagraphStyle(
            "Body",
            parent=styles["BodyText"],
            fontName="Helvetica",
            fontSize=9,
            leading=11.2,
            textColor=colors.HexColor("#162316"),
            spaceAfter=2,
        ),
        "bullet": ParagraphStyle(
            "Bullet",
            parent=styles["BodyText"],
            fontName="Helvetica",
            fontSize=8.6,
            leading=10.4,
            textColor=colors.HexColor("#162316"),
            leftIndent=0,
            spaceAfter=1,
        ),
        "small": ParagraphStyle(
            "Small",
            parent=styles["BodyText"],
            fontName="Helvetica",
            fontSize=8.2,
            leading=10,
            textColor=colors.HexColor("#4B554A"),
            spaceAfter=0,
        ),
    }


def bullet_paragraphs(items, style):
    return [Paragraph(f"- {item}", style) for item in items]


def draw_header(pdf):
    pdf.setFillColor(colors.HexColor("#F7F4EF"))
    pdf.rect(0, 0, letter[0], letter[1], stroke=0, fill=1)
    pdf.setFillColor(colors.HexColor("#E9D8C8"))
    pdf.roundRect(40, 724, 532, 52, 18, stroke=0, fill=1)
    pdf.setFillColor(colors.HexColor("#D6743A"))
    pdf.circle(542, 750, 16, stroke=0, fill=1)
    pdf.setFillColor(colors.white)
    pdf.setFont("Helvetica-Bold", 12)
    pdf.drawCentredString(542, 746, "U")


def left_story(styles):
    features = [
        "Chrome extension UI with popup, options page, and in-page reader mode controls.",
        "Captures selected text as structured highlights with DOM path, offsets, and quote context.",
        "Builds a small paragraph window around highlights instead of sending full-page HTML.",
        "Calls a local API for explanations and inserts an AI bridge paragraph back into the article.",
        "Stores highlights, bridges, reader settings, and lightweight learning signals in <font name='Courier'>chrome.storage.local</font>.",
        "Lets the user save provider URL/key/model, test the connection, and fall back to mock mode if upstream fails.",
    ]

    story = [
        Paragraph("Underline", styles["title"]),
        Paragraph(
            "Repo-based one-page summary generated from README, package manifests, and source code.",
            styles["subtitle"],
        ),
        Paragraph("What It Is", styles["section"]),
        Paragraph(
            "Underline is a Chrome reading-tutor MVP built as a browser extension plus a local TypeScript API. It helps readers highlight confusing text on web articles and receive a short bridge explanation tailored to their background.",
            styles["body"],
        ),
        Paragraph("Who It's For", styles["section"]),
        Paragraph(
            "Primary persona: a non-technical or low-familiarity learner reading technical content. Evidence in repo: the default profile is \"Non-technical learner\" and the popup copy says the app infers missing background knowledge from highlighted phrases.",
            styles["body"],
        ),
        Paragraph("What It Does", styles["section"]),
        *bullet_paragraphs(features, styles["bullet"]),
    ]
    return story


def right_story(styles):
    run_steps = [
        "Install dependencies: <font name='Courier'>npm install</font>",
        "Start the local API: <font name='Courier'>npm run dev:api</font>",
        "Start the extension dev build: <font name='Courier'>npm run dev:extension</font>",
        "In Chrome, open <font name='Courier'>chrome://extensions</font>, enable Developer mode, and load <font name='Courier'>apps/extension/.output/chrome-mv3</font>.",
        "Open the popup, keep local API at <font name='Courier'>http://localhost:8787</font>, add provider URL/key/model if desired, test, then save.",
    ]

    architecture = [
        "<b>Frontend:</b> <font name='Courier'>apps/extension</font> uses WXT + React for the popup/options UI and a content script that manages highlights and injected bridge paragraphs.",
        "<b>Backend:</b> <font name='Courier'>apps/api</font> runs a Fastify server with <font name='Courier'>/health</font>, provider-config routes, and <font name='Courier'>/v1/explanations</font>.",
        "<b>Shared contract:</b> <font name='Courier'>packages/shared</font> holds Zod schemas and shared types for requests, responses, highlights, bridges, and profile data.",
        "<b>Data flow:</b> user selects text -> extension stores highlight + context -> extension POSTs structured JSON to local API -> API calls OpenAI-compatible or mock client -> extension inserts returned bridge text after the anchor paragraph.",
        "<b>Persistence:</b> reading state lives in <font name='Courier'>chrome.storage.local</font>; provider runtime config is saved by the API to <font name='Courier'>.underline-runtime.json</font>.",
        "<b>Not found in repo:</b> database, cloud deployment, authentication, or server-side HTML scraping.",
    ]

    story = [
        Paragraph("How It Works", styles["section"]),
        *bullet_paragraphs(architecture, styles["bullet"]),
        Spacer(1, 4),
        Paragraph("How To Run", styles["section"]),
        *bullet_paragraphs(run_steps, styles["bullet"]),
        Spacer(1, 8),
        Paragraph(
            "Validation commands in repo: <font name='Courier'>npm run build</font>, <font name='Courier'>npm run test</font>, <font name='Courier'>npm run typecheck</font>.",
            styles["small"],
        ),
    ]
    return story


def main():
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    pdf = canvas.Canvas(str(OUTPUT), pagesize=letter)
    draw_header(pdf)
    styles = build_styles()

    usable_top = 706
    frame_height = 620
    column_gap = 20
    margin_x = 46
    total_width = letter[0] - margin_x * 2
    column_width = (total_width - column_gap) / 2

    left = KeepInFrame(column_width, frame_height, left_story(styles), mode="shrink")
    right = KeepInFrame(column_width, frame_height, right_story(styles), mode="shrink")

    left_frame = Frame(margin_x, usable_top - frame_height, column_width, frame_height, showBoundary=0)
    right_frame = Frame(margin_x + column_width + column_gap, usable_top - frame_height, column_width, frame_height, showBoundary=0)

    left_frame.addFromList([left], pdf)
    right_frame.addFromList([right], pdf)

    pdf.setStrokeColor(colors.HexColor("#D9CFC2"))
    pdf.line(margin_x + column_width + (column_gap / 2), 80, margin_x + column_width + (column_gap / 2), 692)

    footer = "Generated from repo evidence only"
    pdf.setFont("Helvetica", 8)
    pdf.setFillColor(colors.HexColor("#6F786C"))
    pdf.drawString(46, 32, footer)

    path_text = str(OUTPUT.relative_to(ROOT))
    pdf.drawRightString(566, 32, path_text)

    pdf.save()


if __name__ == "__main__":
    main()
