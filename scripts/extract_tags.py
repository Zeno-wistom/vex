"""Extract original VEX vector paths, not regenerated AprilTag codes.
Input: artifacts/official-tags.pdf from URL recorded in public/tags/SOURCE.md.
Requires existing PyMuPDF; this is a one-time asset preparation tool.
"""
from pathlib import Path
import fitz

source = fitz.open('artifacts/official-tags.pdf')
Path('public/tags').mkdir(parents=True, exist_ok=True)
for tag_id in range(4):
    paths = source[1 + tag_id * 2].get_drawings()
    outer = next(p for p in paths if 30 < p['rect'].x0 < 40 and 80 < p['rect'].y0 < 90 and 110 < p['rect'].height < 120)
    bounds = fitz.Rect(outer['rect'])
    bounds.x1 = bounds.x0 + bounds.height
    selection_bounds = bounds + (-0.01, -0.01, 0.01, 0.01)
    selected = [p for p in paths if selection_bounds.contains(p['rect']) and p['fill'] is not None and p['rect'].width > 10]
    selected.sort(key=lambda p: p['rect'].get_area(), reverse=True)
    # Render the original PDF paths directly: no reconstruction of compound paths.
    page = source[1 + tag_id * 2]
    # Remove the printed ID in the unused lower-right corner (not code cells).
    id_paths = [p for p in paths if 135 < p['rect'].x0 < 151 and 180 < p['rect'].y0 < 200 and p['rect'].width < 10]
    for p in id_paths:
        page.draw_rect(p['rect'] + (-.2,-.2,.2,.2), color=None, fill=(1,1,1))
    # Preserve the full 9-cell square, replace surrounding paper guides with white.
    for blank in [fitz.Rect(0,0,612,bounds.y0),fitz.Rect(0,bounds.y1,612,792),fitz.Rect(0,0,bounds.x0,792),fitz.Rect(bounds.x1,0,612,792)]:
        page.draw_rect(blank, color=None, fill=(1,1,1))
    margin = bounds.width / 9
    crop = bounds + (-margin, -margin, margin, margin)
    page.get_pixmap(matrix=fitz.Matrix(4,4),clip=crop,alpha=False).save(f'public/tags/tag-{tag_id}.png')
    print(f'Tag {tag_id}: PDF page {2+tag_id*2}, {len(selected)} original paths')
