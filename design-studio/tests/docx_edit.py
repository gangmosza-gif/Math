"""Edit an exported Word file with python-docx (a real .docx library), the way a person would in Word.

usage: python3 docx_edit.py in.docx out.docx
prints JSON describing what was changed, so the test can check the edits show up after rendering.
"""
import json
import sys

from docx import Document
from docx.enum.text import WD_BREAK
from docx.oxml.ns import qn
from docx.shared import Pt, RGBColor

src, dst = sys.argv[1], sys.argv[2]
doc = Document(src)
done = {'header': 0, 'footer': 0, 'heading': None, 'table': None, 'bold': None, 'added': None, 'styles': []}

NEW_HEADER = 'แก้ไขหัวกระดาษแล้ว'
NEW_FOOTER = 'แก้ไขท้ายกระดาษแล้ว'


def set_text(par, text):
    """Replace the visible text of a paragraph, keeping the formatting of its first text run."""
    runs = [r for r in par.runs if r.text]
    if not runs:
        return False
    runs[0].text = text
    for r in runs[1:]:
        r.text = ''
    return True


def thai_font(run, name='Sarabun'):
    run.font.name = name
    rpr = run._element.get_or_add_rPr()
    fonts = rpr.find(qn('w:rFonts'))
    if fonts is None:
        fonts = rpr.makeelement(qn('w:rFonts'), {})
        rpr.insert(0, fonts)
    for k in ('w:ascii', 'w:hAnsi', 'w:cs', 'w:eastAsia'):
        fonts.set(qn(k), name)


def has_field(par):
    x = par._p.xml
    return 'PAGE' in x and ('fldSimple' in x or 'instrText' in x)


# 1) header & footer text of every section (fields such as page numbers are left alone)
for sec in doc.sections:
    parts = [(sec.header, 'header', NEW_HEADER), (sec.footer, 'footer', NEW_FOOTER)]
    if sec.different_first_page_header_footer:
        parts += [(sec.first_page_header, 'header', NEW_HEADER), (sec.first_page_footer, 'footer', NEW_FOOTER)]
    for part, key, new in parts:
        if part.is_linked_to_previous:
            continue
        for par in part.paragraphs:
            if has_field(par):
                continue
            if par.text.strip() and set_text(par, new):
                done[key] += 1
                break

# 2) body: rename the first chapter heading, make a sentence bold, change a table cell
for par in doc.paragraphs:
    if done['heading'] is None and par.text.strip().startswith('บทที่ 1'):
        done['heading'] = par.text.strip() + ' (แก้ไขใน Word)'
        done['styles'].append(par.style.name)
        set_text(par, done['heading'])
    elif done['bold'] is None and par.text.strip().startswith('ผลการศึกษาพบว่า'):
        for r in par.runs:
            r.bold = True
        done['bold'] = par.text.strip()
for t in doc.tables:
    cell = t.cell(1, 0)
    if cell.paragraphs and set_text(cell.paragraphs[0], 'แก้ในตาราง'):
        done['table'] = 'แก้ในตาราง'
    break

# 3) add a new page with a new paragraph (bold, coloured, Thai font)
last = doc.paragraphs[-1]
last.add_run().add_break(WD_BREAK.PAGE)
p = doc.add_paragraph()
r = p.add_run('ย่อหน้าที่เพิ่มใหม่ใน Word')
r.bold = True
r.font.size = Pt(18)
r.font.color.rgb = RGBColor(0x1D, 0x4E, 0xD8)
thai_font(r)
done['added'] = 'ย่อหน้าที่เพิ่มใหม่ใน Word'

doc.save(dst)
print(json.dumps(done, ensure_ascii=False))
