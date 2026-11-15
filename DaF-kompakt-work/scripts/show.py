import sys
# print page tsv in reading order: split by column boundary(s) given as x fractions
p=sys.argv[1]; cuts=[float(c) for c in sys.argv[2:]] or [0.5]
rows=[l.split('\t',4) for l in open(f'ocr_vision/p-{int(p):03d}.tsv') if l.strip()]
cols=[[] for _ in range(len(cuts)+1)]
for r in rows:
    x=float(r[0]); i=sum(x>=c for c in cuts); cols[i].append((float(r[1]),x,r[4].rstrip('\n')))
for i,c in enumerate(cols):
    print(f'=== col {i}')
    for y,x,t in sorted(c): print(f'{y:.3f} {x:.2f} {t}')
