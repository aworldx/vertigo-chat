from docx import Document
from docx.enum.section import WD_ORIENT
from docx.enum.table import WD_ALIGN_VERTICAL
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.shared import Cm, Pt, RGBColor


OUT = "/Users/amirhasanov/Projects/chat/english_question_words.docx"


def shade(cell, fill):
    tc_pr = cell._tc.get_or_add_tcPr()
    shd = tc_pr.find(qn("w:shd"))
    if shd is None:
        shd = OxmlElement("w:shd")
        tc_pr.append(shd)
    shd.set(qn("w:fill"), fill)


def border(cell):
    tc_pr = cell._tc.get_or_add_tcPr()
    borders = tc_pr.first_child_found_in("w:tcBorders")
    if borders is None:
        borders = OxmlElement("w:tcBorders")
        tc_pr.append(borders)
    for edge in ("top", "left", "bottom", "right", "insideH", "insideV"):
        tag = qn(f"w:{edge}")
        node = borders.find(tag)
        if node is None:
            node = OxmlElement(f"w:{edge}")
            borders.append(node)
        node.set(qn("w:val"), "single")
        node.set(qn("w:sz"), "8")
        node.set(qn("w:color"), "D9D9D9")


def margins(cell):
    tc_pr = cell._tc.get_or_add_tcPr()
    tc_mar = tc_pr.first_child_found_in("w:tcMar")
    if tc_mar is None:
        tc_mar = OxmlElement("w:tcMar")
        tc_pr.append(tc_mar)
    for side, value in (("top", 90), ("start", 120), ("bottom", 90), ("end", 120)):
        node = tc_mar.find(qn(f"w:{side}"))
        if node is None:
            node = OxmlElement(f"w:{side}")
            tc_mar.append(node)
        node.set(qn("w:w"), str(value))
        node.set(qn("w:type"), "dxa")


def run(p, text, bold=False, size=9.3, color=None):
    r = p.add_run(text)
    r.bold = bold
    r.font.name = "Arial"
    r._element.rPr.rFonts.set(qn("w:eastAsia"), "Arial")
    r.font.size = Pt(size)
    if color:
        r.font.color.rgb = RGBColor(*color)
    return r


def cell_text(cell, lines, header=False, centered=False):
    p = cell.paragraphs[0]
    p.clear()
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER if centered else WD_ALIGN_PARAGRAPH.LEFT
    p.paragraph_format.space_after = Pt(0)
    p.paragraph_format.line_spacing = 1.03
    for index, (text, bold) in enumerate(lines):
        if index:
            p.add_run("\n")
        run(p, text, bold=bold, size=9.2 if not header else 9.7, color=(255, 255, 255) if header else None)
    cell.vertical_alignment = WD_ALIGN_VERTICAL.CENTER
    margins(cell)
    border(cell)


doc = Document()
section = doc.sections[0]
section.orientation = WD_ORIENT.LANDSCAPE
section.page_width, section.page_height = Cm(29.7), Cm(21)
section.top_margin = Cm(1.05)
section.bottom_margin = Cm(1.05)
section.left_margin = Cm(1.15)
section.right_margin = Cm(1.15)

doc.styles["Normal"].font.name = "Arial"
doc.styles["Normal"]._element.rPr.rFonts.set(qn("w:eastAsia"), "Arial")
title_pr = doc.styles["Title"]._element.get_or_add_pPr()
title_border = title_pr.find(qn("w:pBdr"))
if title_border is not None:
    title_pr.remove(title_border)

title = doc.add_paragraph(style="Title")
title.alignment = WD_ALIGN_PARAGRAPH.CENTER
title.paragraph_format.space_after = Pt(3)
run(title, "Вопросительные слова в английском", bold=True, size=20, color=(0, 0, 0))

intro = doc.add_paragraph()
intro.alignment = WD_ALIGN_PARAGRAPH.CENTER
intro.paragraph_format.space_after = Pt(7)
run(intro, "Вопросительное слово стоит первым. После него ставим знакомую структуру: is, are, have или has.", bold=True, size=10)

table = doc.add_table(rows=1, cols=4)
table.autofit = False
table.style = "Table Grid"
widths = [Cm(5.1), Cm(4.5), Cm(10.7), Cm(11.1)]
for cell, width, label in zip(table.rows[0].cells, widths, ["Слово", "Значение", "Пример вопроса", "Короткий ответ"]):
    cell.width = width
    shade(cell, "244C66")
    cell_text(cell, [(label, True)], header=True, centered=True)

data = [
    ([("what [уот]", True)], [("что?", True)], [("What is it?", True), ("[уот из ит?]", False), ("Что это?", False)], [("It is a cat.", True), ("[ит из э кэт]", False), ("Это кошка.", False)]),
    ([("where [уэа]", True)], [("где?", True)], [("Where is the cat?", True), ("[уэа из зэ кэт?]", False), ("Где кошка?", False)], [("It is at home.", True), ("[ит из эт хоум]", False), ("Она дома.", False)]),
    ([("who [ху:]", True)], [("кто?", True)], [("Who are they?", True), ("[ху: а: зэй?]", False), ("Кто они?", False)], [("They are doctors.", True), ("[зэй а: доктэз]", False), ("Они врачи.", False)]),
    ([("when [уэн]", True)], [("когда?", True)], [("When is the party?", True), ("[уэн из зэ па:ти?]", False), ("Когда праздник?", False)], [("It is on Sunday.", True), ("[ит из он сандэй]", False), ("Он в воскресенье.", False)]),
    ([("why [уай]", True)], [("почему?", True)], [("Why are you sad?", True), ("[уай а: ю: сэд?]", False), ("Почему ты грустный?", False)], [("I am sad.", True), ("[ай эм сэд]", False), ("Я грустный.", False)]),
    ([("how [хау]", True)], [("как?", True)], [("How are you?", True), ("[хау а: ю:?]", False), ("Как ты?", False)], [("I am fine.", True), ("[ай эм файн]", False), ("У меня всё хорошо.", False)]),
    ([("which [уич]", True)], [("который?", True)], [("Which is your bag?", True), ("[уич из йо: бэг?]", False), ("Которая твоя сумка?", False)], [("This is my bag.", True), ("[зис из май бэг]", False), ("Это моя сумка.", False)]),
    ([("whose [хуз]", True)], [("чей?", True)], [("Whose bag is this?", True), ("[хуз бэг из зис?]", False), ("Чья это сумка?", False)], [("It is my bag.", True), ("[ит из май бэг]", False), ("Это моя сумка.", False)]),
    ([("how old [хау оулд]", True)], [("сколько лет?", True)], [("How old are you?", True), ("[хау оулд а: ю:?]", False), ("Сколько тебе лет?", False)], [("I am eight.", True), ("[ай эм эйт]", False), ("Мне восемь лет.", False)]),
    ([("how many [хау мэни]", True)], [("сколько?", True)], [("How many books have you got?", True), ("[хау мэни букс хэв ю: гот?]", False), ("Сколько у тебя книг?", False)], [("I have got five books.", True), ("[ай хэв гот файв букс]", False), ("У меня пять книг.", False)]),
]

for index, row in enumerate(data):
    cells = table.add_row().cells
    for cell, width, content in zip(cells, widths, row):
        cell.width = width
        if index % 2:
            shade(cell, "EFF5F8")
        cell_text(cell, content, centered=(cell == cells[0] or cell == cells[1]))

note = doc.add_paragraph()
note.paragraph_format.space_before = Pt(6)
note.paragraph_format.space_after = Pt(0)
note.paragraph_format.line_spacing = 1.0
run(note, "Запомни: ", bold=True, size=9.3)
run(note, "what, where, who, when, why и how - это начало вопроса. Знак вопроса в конце предложения обязателен.", size=9.3)

doc.save(OUT)
print(OUT)
