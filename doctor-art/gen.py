#!/usr/bin/env python3
"""Generator for the doctor-dashboard decorative SVG art.
Authors the SVG once; emits static files + a composite raster for pixel-diff."""
import math, os

OUT = "/tmp/claude-0/-home-user-hair-diagnostic/9ddb01ce-dcb1-5e45-8ab2-4832c583b081/scratchpad"

# ---------- helpers ----------
def leaf(cx, cy, length, width, angle, fill, opacity, rib=None, rib_op=0.0):
    """Tapered, pointed leaf whose base sits at (cx,cy), pointing at `angle` deg."""
    a = math.radians(angle)
    ca, sa = math.cos(a), math.sin(a)
    def P(px, py):          # local(point along length=x, across=y) -> global
        return (cx + px*ca - py*sa, cy + px*sa + py*ca)
    L, W = length, width/2
    p0 = P(0,0); p1 = P(L*0.30,-W); p2 = P(L*0.72,-W*0.62); tip = P(L,0)
    p4 = P(L*0.72, W*0.62); p5 = P(L*0.30, W)
    d = (f"M{p0[0]:.1f},{p0[1]:.1f} "
         f"C{p1[0]:.1f},{p1[1]:.1f} {p2[0]:.1f},{p2[1]:.1f} {tip[0]:.1f},{tip[1]:.1f} "
         f"C{p4[0]:.1f},{p4[1]:.1f} {p5[0]:.1f},{p5[1]:.1f} {p0[0]:.1f},{p0[1]:.1f} Z")
    s = f'<path d="{d}" fill="{fill}" fill-opacity="{opacity:.2f}"/>'
    if rib:
        rt = P(L*0.95,0)
        s += (f'<path d="M{p0[0]:.1f},{p0[1]:.1f} L{rt[0]:.1f},{rt[1]:.1f}" '
              f'stroke="{rib}" stroke-opacity="{rib_op:.2f}" stroke-width="{max(0.6,width*0.05):.1f}" fill="none"/>')
    return s

# palette
SAGE_D = "#8fae8f"   # deeper sage
SAGE_M = "#a9c4a3"   # mid sage
SAGE_L = "#c3d8bd"   # light sage
SAGE_P = "#d7e6d2"   # pale sage
IVORY  = "#f6f1e6"
CREAM  = "#efe7d4"
CREAM2 = "#e9dcc0"
GOLD   = "#c9a24b"   # champagne
GOLD_L = "#d8bd82"

# ======================================================================
# 1. SIDEBAR BOTANICAL  (viewBox 0 0 330 440 ; sits in lower sidebar)
# ======================================================================
def sidebar():
    W,H = 330,440
    parts = []
    parts.append(f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" '
                 f'preserveAspectRatio="xMaxYMax meet" width="100%" height="100%">')
    parts.append('<defs>')
    parts.append(f'<linearGradient id="sbLeaf" x1="0" y1="0" x2="1" y2="1">'
                 f'<stop offset="0" stop-color="{SAGE_L}"/><stop offset="1" stop-color="{SAGE_D}"/></linearGradient>')
    parts.append('</defs>')

    # --- faint large rounded leaf blobs behind the mascot (left) ---
    blobs = [
        (70,150,120,170,-18,0.14),
        (40,300,120,150,10,0.12),
        (150,120,95,150,22,0.10),
        (215,250,90,130,-30,0.10),
    ]
    g = ['<g>']
    for cx,cy,l,w,an,op in blobs:
        g.append(leaf(cx,cy,l,w,an,SAGE_P,op))
    g.append('</g>')
    parts.append(''.join(g))

    # --- lower-left broad bushy cluster (partly behind pills) ---
    bush = [
        (120,360,95,46,-40,0.42),
        (108,372,80,40,-14,0.40),
        (138,350,88,42,-66,0.36),
        (150,386,70,34,-8,0.30),
    ]
    gb=['<g>']
    for cx,cy,l,w,an,op in bush:
        gb.append(leaf(cx,cy,l,w,an,SAGE_M,op,rib=SAGE_D,rib_op=op*0.5))
    gb.append('</g>')
    parts.append(''.join(gb))

    # --- primary branch: curved stem rising on the right, slight lean left at top ---
    stem = "M302,410 C297,330 303,252 294,176 C287,112 282,60 272,20"
    parts.append(f'<path d="{stem}" fill="none" stroke="{SAGE_D}" stroke-opacity="0.34" stroke-width="2.2" stroke-linecap="round"/>')

    # leaves along the stem, alternating & fanning (slender, rising).
    # (x,y,len,wid,angle,opacity) ; angle: -90 straight up, more negative = up-left
    stem_leaves = [
        (272, 22, 74, 20, -104, 0.42),   # top-left
        (274, 30, 70, 19,  -72, 0.44),   # top-right
        (278, 60, 84, 23, -116, 0.48),   # left
        (281, 72, 78, 21,  -62, 0.44),   # right
        (285,106, 92, 25, -122, 0.54),   # left
        (288,120, 84, 23,  -56, 0.48),   # right
        (291,158,100, 28, -126, 0.58),   # left
        (294,174, 90, 25,  -52, 0.50),   # right
        (297,214,108, 31, -132, 0.60),   # lower-left (bigger)
        (299,232, 96, 27,  -46, 0.52),   # lower-right
        (301,276,116, 34, -138, 0.60),   # left broad
        (302,300, 98, 29,  -42, 0.52),   # right
        (302,346,118, 36, -148, 0.56),   # bottom-left broad
    ]
    gs=['<g>']
    for cx,cy,l,w,an,op in stem_leaves:
        fill = SAGE_D if op>0.52 else (SAGE_M if op>0.45 else SAGE_L)
        gs.append(leaf(cx,cy,l,w,an,fill,op,rib="#6f8f6f",rib_op=op*0.45))
    gs.append('</g>')
    parts.append(''.join(gs))

    # --- cream ground ribbon + champagne edge at base ---
    parts.append(f'<path d="M-5,392 C90,356 230,372 335,418 L335,440 L-5,440 Z" '
                 f'fill="{CREAM}" fill-opacity="0.55"/>')
    parts.append(f'<path d="M-5,398 C95,362 232,378 335,424" fill="none" '
                 f'stroke="{GOLD_L}" stroke-opacity="0.55" stroke-width="1.6"/>')
    parts.append('</svg>')
    return '\n'.join(parts)

with open(f"{OUT}/sidebar.svg","w") as f: f.write(sidebar())
print("wrote sidebar.svg")

# ======================================================================
# 2. HERO WAVES  (viewBox 0 0 1260 300 ; preserveAspectRatio none)
# ======================================================================
def ribbon(top, bot):
    """closed band between a top cubic path `top` and reversed bottom path `bot`."""
    return f"{top} L{bot} Z"

def waves():
    W,H=1260,300
    p=[f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" '
       f'preserveAspectRatio="none" width="100%" height="100%">']
    p.append('<defs>')
    p.append(f'<linearGradient id="hwIvory" x1="0" y1="0" x2="1" y2="0.4">'
             f'<stop offset="0" stop-color="#ffffff" stop-opacity="0"/>'
             f'<stop offset="0.35" stop-color="{IVORY}" stop-opacity="0.9"/>'
             f'<stop offset="1" stop-color="#fffdf8" stop-opacity="0.95"/></linearGradient>')
    p.append(f'<linearGradient id="hwCream" x1="0" y1="0" x2="1" y2="0.5">'
             f'<stop offset="0" stop-color="{CREAM}" stop-opacity="0"/>'
             f'<stop offset="0.4" stop-color="{CREAM2}" stop-opacity="0.85"/>'
             f'<stop offset="1" stop-color="{CREAM}" stop-opacity="0.9"/></linearGradient>')
    p.append(f'<linearGradient id="hwSage" x1="0.2" y1="0" x2="0.8" y2="1">'
             f'<stop offset="0" stop-color="#dfe9df" stop-opacity="0"/>'
             f'<stop offset="0.5" stop-color="#cfe0d2" stop-opacity="0.75"/>'
             f'<stop offset="1" stop-color="#d9e7da" stop-opacity="0.4"/></linearGradient>')
    p.append('</defs>')

    # translucent white wash (broadest, lowest) — crest shifted right, left fades out
    p.append('<path d="M360,300 C540,238 720,196 900,200 C1050,203 1160,236 1260,220 '
             'L1260,300 Z" fill="#ffffff" fill-opacity="0.4"/>')
    # pale sage wave (lower-centre mint pool)
    p.append('<path d="M440,300 C600,236 770,198 930,206 C1070,213 1170,250 1260,236 '
             'L1260,300 Z" fill="url(#hwSage)"/>')
    # warm cream ribbon (between two parallel sweeps)
    p.append('<path d="M400,300 C580,210 770,150 950,150 C1090,150 1180,196 1260,180 '
             'L1260,300 C1180,266 1090,214 950,212 C770,210 580,254 400,300 Z" '
             'fill="url(#hwCream)"/>')
    # ivory ribbon (above cream) — the bright upper band
    p.append('<path d="M430,300 C610,188 810,120 1000,120 C1120,120 1190,160 1260,150 '
             'L1260,198 C1190,214 1120,174 1000,174 C810,174 610,244 430,300 Z" '
             'fill="url(#hwIvory)"/>')
    # thin champagne contour line along the crest (dominant accent)
    p.append(f'<path d="M405,298 C590,190 800,124 998,126 C1125,127 1195,170 1260,158" '
             f'fill="none" stroke="{GOLD}" stroke-opacity="0.6" stroke-width="2.6"/>')
    p.append(f'<path d="M445,300 C625,202 820,142 1008,144 C1132,145 1200,186 1260,176" '
             f'fill="none" stroke="{GOLD_L}" stroke-opacity="0.45" stroke-width="1.5"/>')
    p.append('</svg>')
    return '\n'.join(p)

with open(f"{OUT}/waves.svg","w") as f: f.write(waves())
print("wrote waves.svg")

# ======================================================================
# 3. BRANCH BAR ART  (viewBox 0 0 640 64 ; sits top-right of the strip)
# ======================================================================
def branchbar():
    W,Hh=640,64
    p=[f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {Hh}" '
       f'preserveAspectRatio="xMaxYMid meet" width="100%" height="100%">']
    p.append('<defs>')
    p.append(f'<linearGradient id="bbFade" x1="0" y1="0" x2="1" y2="0">'
             f'<stop offset="0" stop-color="#fff" stop-opacity="0"/>'
             f'<stop offset="0.28" stop-color="#fff" stop-opacity="0"/>'
             f'<stop offset="0.5" stop-color="#fff" stop-opacity="1"/>'
             f'<stop offset="1" stop-color="#fff" stop-opacity="1"/></linearGradient>')
    p.append('<clipPath id="bbClip"><rect x="0" y="0" width="640" height="64"/></clipPath>')
    p.append('</defs>')
    p.append('<g clip-path="url(#bbClip)">')

    # ivory ribbon sweep + champagne contour (left-of-centre crest, fades left)
    p.append(f'<path d="M-20,58 C90,36 180,16 250,20 C330,24 420,44 660,30 L660,64 L-20,64 Z" '
             f'fill="{IVORY}" fill-opacity="0.65"/>')
    p.append(f'<path d="M-20,56 C95,33 185,13 252,17 C332,21 430,41 660,27" '
             f'fill="none" stroke="{GOLD}" stroke-opacity="0.55" stroke-width="1.7"/>')

    # building silhouette (modern flat-roof clinic, warm beige), low opacity
    bx=360
    p.append(f'<g fill="#d8c3a2" fill-opacity="0.4">'
             f'<rect x="{bx}" y="24" width="66" height="40"/>'
             f'<rect x="{bx+58}" y="6" width="56" height="58"/>'
             f'<rect x="{bx+108}" y="30" width="48" height="34"/></g>')
    # windows
    wins="".join(f'<rect x="{bx+68+c*16}" y="{16+r*14}" width="8" height="9"/>'
                 for r in range(3) for c in range(3))
    p.append(f'<g fill="#ffffff" fill-opacity="0.45">{wins}</g>')
    p.append(f'<rect x="{bx+80}" y="46" width="14" height="18" fill="#c9b084" fill-opacity="0.6"/>')  # door

    # mid sage leaf cluster (in front of building, broad pointed leaves)
    mid=[ (320,60,46,20,-78,0.5),(332,60,40,18,-104,0.46),(344,60,44,19,-58,0.46),
          (330,58,34,16,-128,0.4),(352,60,38,17,-40,0.42) ]
    g=['<g>']
    for cx,cy,l,w,an,op in mid: g.append(leaf(cx,cy,l,w,an,SAGE_M,op,rib=SAGE_D,rib_op=op*0.45))
    g.append('</g>'); p.append(''.join(g))

    # larger leaf cluster far-right (the big plant)
    big=[ (560,62,58,26,-82,0.55),(548,62,50,23,-112,0.5),(574,62,52,24,-54,0.5),
          (556,60,44,20,-134,0.44),(584,62,46,21,-34,0.46),(566,62,60,27,-72,0.5) ]
    gb=['<g>']
    for cx,cy,l,w,an,op in big: gb.append(leaf(cx,cy,l,w,an,SAGE_M,op,rib=SAGE_D,rib_op=op*0.5))
    gb.append('</g>'); p.append(''.join(gb))

    p.append('</g>')
    # left fade mask over everything
    p.append(f'<rect x="0" y="0" width="300" height="64" fill="url(#bbFade)" fill-opacity="0"/>')
    p.append('</svg>')
    return '\n'.join(p)

with open(f"{OUT}/branchbar.svg","w") as f: f.write(branchbar())
print("wrote branchbar.svg")
