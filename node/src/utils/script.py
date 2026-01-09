import pathlib
path=pathlib.Path('Logger.js')
lines=path.read_text().splitlines()
start=None
end=None
for i,line in enumerate(lines):
    if 'static async writeLog' in line and start is None:
        start=i
    elif start is not None and line.strip().startswith('static async writeLogs'):
        end=i
        break
if end is None:
    end=len(lines)
print('\n'.join(lines[start:end]))
