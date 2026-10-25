# Optional browser smoke test (needs: pip install playwright && playwright install chromium).
# It runs in DEMO mode: set backend: 'fake' in src/config.js first (and put it back to 'api' afterwards).
# Start the site (npm start), then: python3 tests/e2e/smoke.py [http://localhost:8080]
import sys, re
from playwright.sync_api import sync_playwright
BASE = sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:8080'
errs = []
def ok(cond, msg):
    print(('PASS ' if cond else 'FAIL ') + msg)
    if not cond: errs.append(msg)

with sync_playwright() as p:
    b = p.chromium.launch(); ctx = b.new_context(); logs = []
    def watch(pg):
        pg.on('pageerror', lambda e: logs.append(str(e)))
        pg.on('console', lambda m: logs.append(m.text) if m.type == 'error' and 'favicon' not in m.text and '404' not in m.text else None)

    # ---- sign-in: each page says where to go for the other kind of code ----
    pg = ctx.new_page(); watch(pg)
    pg.goto(BASE + '/index.html'); pg.fill('#code', 'mgr-001'); pg.click('#gateForm button')
    ok('manager code' in pg.inner_text('#gateErr'), 'a manager code on the staff page says where to go instead')

    # ---- manager: dashboard (view only), filters, team pulse, live clock ----
    m = ctx.new_page(); watch(m)
    m.goto(BASE + '/manager.html'); m.fill('#code', 'MGR-001'); m.click('#gateForm button')
    m.wait_for_selector('#uiPick:not(.hidden)')
    ok(m.locator('#uiPick [data-pick]').count() == 2, 'the first sign-in asks which look to use')
    m.click('#uiPick [data-pick="fun"]')
    m.click('[data-tab="manage"]'); m.click('#demo'); m.click('[data-tab="dash"]')
    ok(re.match(r'^\d\d:\d\d:\d\d$', m.text_content('#clock')) is not None, 'manager clock shows seconds')
    ok('Live' in m.text_content('#live'), 'Live pill on the manager page')
    ok(m.locator('.fbtn').count() == 6, 'six filters on the dashboard')
    ok(m.locator('#tab-dash button[data-u], #tab-dash input').count() == 0, 'dashboard has no edit controls')
    ok(len(m.inner_text('#pulse')) > 20, 'team pulse has something to say')
    m.click('[data-f="onbreak"]')
    ok(m.locator('#cards tr').count() == int(m.text_content('[data-f="onbreak"] b')), 'filter shows only the people on a break')

    # ---- manager: Manage tab, add an OH break, rename it, edit the shift ----
    m.click('[data-tab="manage"]'); m.click('button[data-det="EE-001"]')
    m.select_option('#cKey', 'c1'); m.fill('#cMin', '10'); m.check('input[name=sc][value=daily]'); m.click('#cAdd')
    ok('OH Break 1' in m.inner_text('#dBody'), 'OH Break 1 added')
    m.fill('#dSe', '23:30'); m.dispatch_event('#dSe', 'change')
    m.click('#dClose')

    # ---- agent: break bars (the OH break is a new bar), shift pie ticking, pep talk ----
    pg.fill('#code', 'EE-001'); pg.click('#gateForm button'); pg.wait_for_selector('#bars .brow')
    pg.wait_for_selector('#uiPick:not(.hidden)'); pg.click('#uiPick [data-pick="fun"]')
    ok(pg.locator('#bars .brow').count() == 4 and 'OH Break 1' in pg.inner_text('#bars'), 'the OH break shows as its own bar')
    ok(pg.input_value('#endIn') == '23:30', 'agent sees the shift end the manager set')
    w1 = pg.text_content('#worked'); pg.wait_for_timeout(1100)
    ok(w1 != pg.text_content('#worked'), 'shift clock ticks every second')
    ok(len(pg.text_content('#joke')) > 10, 'pep talk shown')
    pg.click('#bars button[data-slot="break2"]'); pg.wait_for_timeout(1200)
    ok(pg.locator('#bars .brow.on .btrack.big').count() == 1 and pg.is_visible('[data-tab="race"]'), 'a running break grows in its own row, the rest of the page stays usable')
    pg.click('#tStop')
    ok(pg.locator('#bars .brow.on').count() == 0 and pg.is_visible('#toast'), 'ending a break shows the result as a note')
    ok(pg.inner_text('#bars button[data-slot="break2"]') == 'Resume', 'a part-used break can be resumed')

    # ---- Breakathon on both pages ----
    pg.click('[data-tab="race"]'); pg.wait_for_selector('.racer')
    ok(pg.locator('.racer').count() == 6 and 'Minutes over' not in pg.inner_text('#race'), 'agents see the race but not minutes over')
    m.click('[data-tab="race"]'); m.wait_for_selector('.racer')
    ok('Minutes over' in m.inner_text('#race'), 'managers also see minutes over')

    # ---- the Professional view: same features, no mascots or map, plain wording; the choice is recorded ----
    pg.click('#uiBtn'); pg.wait_for_timeout(300)
    ok(pg.get_attribute('html', 'data-ui') == 'pro' and pg.get_attribute('#uiBtn', 'aria-label') == 'Switch to the playful view', 'the header button switches to the professional view')
    ok(pg.locator('.racer').count() == 0 and pg.locator('#race table.rank tr').count() == 7 and 'Level' not in pg.inner_text('#race'), 'weekly scores show as a plain table')
    ok(pg.inner_text('[data-tab="race"]') == 'Weekly scores' and not pg.is_visible('#look'), 'no game names or mascot panel')
    pg.click('[data-tab="day"]')
    ok(not pg.is_visible('#custBtn') and pg.locator('#bars .brow').count() == 4, 'no mascot button, and the breaks work the same')
    pg.reload(); pg.wait_for_selector('#bars .brow')
    ok(pg.get_attribute('html', 'data-ui') == 'pro' and not pg.is_visible('#uiPick'), 'the choice is remembered and not asked again')
    m.click('#uiBtn'); m.click('[data-tab="dash"]'); m.wait_for_timeout(300)
    ok(not m.is_visible('#peek') and 'wake' not in m.inner_text('#pulse'), 'manager professional view: no mascot, plain wording')
    m.reload(); m.click('[data-tab="manage"]'); m.wait_for_selector('#uiStats table')
    stats = m.inner_text('#uiStats')
    ok('Staff: Professional 1' in stats.replace('\n', ' ') and 'Team lead: Professional 1' in stats.replace('\n', ' '), 'the manager sees who picked which look: ' + stats[:80].replace('\n', ' '))
    ok(not logs, 'no JS or CSP errors: ' + '; '.join(logs)[:300])
    b.close()
print('\nRESULT:', 'ALL PASSED' if not errs else f'{len(errs)} FAILED'); sys.exit(1 if errs else 0)
