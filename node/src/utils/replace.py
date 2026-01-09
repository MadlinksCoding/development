from pathlib import Path
path = Path('Logger.js')
data = path.read_text()
import re
new = re.sub(r'\s*\(fix #[^\)]+\)', '', data)
path.write_text(new)
