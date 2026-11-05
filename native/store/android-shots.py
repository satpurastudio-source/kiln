# Android store screenshots: drives the debug build on a running emulator with adb and uiautomator.
# usage: python3 android-shots.py <output folder>   (needs the debug APK installed; see README.md)
import subprocess, re, time, sys, os, xml.etree.ElementTree as ET
ADB = os.path.expanduser('~/Library/Android/sdk/platform-tools/adb')
OUT = sys.argv[1]
def sh(*a, capture=True):
    return subprocess.run([ADB, *a], capture_output=capture, text=True).stdout
def nodes():
    sh('shell', 'uiautomator', 'dump', '/sdcard/ui.xml')
    x = sh('exec-out', 'cat', '/sdcard/ui.xml')
    try: root = ET.fromstring(x)
    except ET.ParseError: return []
    out = []
    for n in root.iter('node'):
        b = list(map(int, re.findall(r'\d+', n.get('bounds', '[0,0][0,0]'))))
        out.append((n.get('text', ''), n.get('content-desc', ''), b, n.get('clickable') == 'true'))
    return out
def find(label, timeout=8, exact=True):
    end = time.time() + timeout
    while time.time() < end:
        for t, d, b, c in nodes():
            for v in (t, d):
                if v and (v == label if exact else v.startswith(label)):
                    return b
        time.sleep(0.5)
    return None
def tap(label, timeout=8, exact=True, required=True):
    b = find(label, timeout, exact)
    if not b:
        if required: raise SystemExit(f'not found: {label}\n' + '\n'.join(f'{t!r} {d!r}' for t, d, *_ in nodes() if t or d)[:3000])
        return False
    sh('shell', 'input', 'tap', str((b[0] + b[2]) // 2), str((b[1] + b[3]) // 2))
    time.sleep(0.7)
    return True
def type_(text):
    sh('shell', 'input', 'text', text.replace(' ', '%s').replace('!', '\\!').replace('#', '\\#'))
def enter(): sh('shell', 'input', 'keyevent', '66'); time.sleep(0.6)
def back(): sh('shell', 'input', 'keyevent', '4'); time.sleep(0.7)
def shot(name):
    with open(os.path.join(OUT, name + '.png'), 'wb') as f:
        f.write(subprocess.run([ADB, 'exec-out', 'screencap', '-p'], capture_output=True).stdout)
def close_tip():
    tap('Close', timeout=1.5, required=False)

sh('shell', 'pm', 'clear', 'com.satpurastudio.kiln')
sh('shell', 'am', 'start', '-n', 'com.satpurastudio.kiln/.MainActivity', '--es', 'kiln_clock', '2026-11-06T10:20')
time.sleep(3)
tap('Next →', exact=False)
tap('Your name', exact=False); type_('Anany'); time.sleep(0.5)
for _ in range(5): tap('Next →', exact=False)
tap('Continue on this device')
time.sleep(2)
for label in ('Allow', 'ALLOW'):
    tap(label, timeout=2, required=False)
close_tip()
tap('Add a task', exact=False)
for task in ["Call the CA about GST return today 4pm !high #work", "Pay electricity bill today 11am #home",
             "Buy diyas and rangoli colours today 6pm #home", "Send invoice to Sharma Traders today 2pm #work",
             "Gym tomorrow 7am", "Submit project report 12 nov !med #work", "Pay rent friday 5pm !high #home",
             "Book train tickets to Indore parso"]:
    type_(task); enter()
time.sleep(4)
type_('mummy ko kal 9 baje raat call'); time.sleep(1.2)
shot('02-hinglish')
enter(); time.sleep(3)
back()  # keyboard away
print('added')
def menu():
    tap('Open menu', timeout=3, required=False)
close_tip()
menu(); tap('Upcoming', exact=False); time.sleep(1); close_tip(); shot('03-upcoming')
menu(); tap('Calendar', exact=False); time.sleep(1); close_tip(); shot('04-calendar')
menu(); tap('Today', exact=False); time.sleep(1); close_tip(); shot('01-today')
tap('Focus on this task', exact=False); time.sleep(1); close_tip(); time.sleep(2); shot('05-focus')
tap('Minimize', required=False); time.sleep(1)
print('done core')
tap('Command palette (Ctrl+K)', exact=False); type_('ambient'); time.sleep(1)
tap('Open Ambient mode', exact=False); time.sleep(3); shot('06-ambient')
back(); time.sleep(1)
menu(); tap('Settings'); time.sleep(1); tap('Dark'); time.sleep(1); back(); time.sleep(1); close_tip(); shot('07-dark')
menu(); tap('Settings'); time.sleep(1); tap('Light'); time.sleep(1); tap('हिन्दी'); time.sleep(2); back(); time.sleep(3); close_tip(); shot('08-hindi')
print('rest done')
