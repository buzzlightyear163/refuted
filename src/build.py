# python3 build.py <srcdir> <out.html>  -> inlines site.css and termkit.js
import sys, pathlib
d = pathlib.Path(sys.argv[1]); out = pathlib.Path(sys.argv[2]); s = (d / "index.src.html").read_text()
s = s.replace('<link rel="stylesheet" href="site.css">', "<style>\n" + (d / "site.css").read_text() + "</style>")
s = s.replace('<script src="termkit.js"></script>', "<script>\n" + (d / "termkit.js").read_text() + "</script>")
out.write_text(s); print(out.name, len(s), "bytes")
