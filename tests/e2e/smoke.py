# Optional browser smoke test (needs: pip install playwright && playwright install chromium).
# Start the site first (npm start), then: python3 tests/e2e/smoke.py [http://localhost:8080]
import sys, json, time
from playwright.sync_api import sync_playwright
BASE = sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:8080'
errs = []
def ok(cond, msg):
    print(('PASS ' if cond else 'FAIL ') + msg)
    if not cond: errs.append(msg)

with sync_playwright() as p:
    b = p.chromium.launch(); ctx = b.new_context(); pg = ctx.new_page(); logs = []
    pg.on('pageerror', lambda e: logs.append(str(e)))
    pg.on('console', lambda m: logs.append(m.text) if m.type == 'error' and 'ERR_NAME_NOT_RESOLVED' not in m.text else None)

    # ---- sign-in: the two pages point at each other, and a code on the wrong page explains itself ----
    pg.goto(BASE + '/index.html'); pg.fill('#code', 'mgr-7777'); pg.click('#gateForm button')
    ok('manager code' in pg.inner_text('#gateErr'), 'a manager code on the staff page says where to go instead')
    ok(pg.locator('a[href="manager.html"]').count() == 1, 'staff sign-in links to the manager sign-in')
    x = ctx.new_page(); x.goto(BASE + '/manager.html')
    ok(x.locator('a[href="index.html"]').count() == 1, 'manager sign-in links back to staff sign-in')
    x.fill('#code', 'ee-1001'); x.click('#gateForm button')
    ok('staff code' in x.inner_text('#gateErr'), 'a staff code on the manager page says where to go instead')
    x.fill('#code', 'mgr-7777'); x.click('#gateForm button')
    ok(x.is_visible('#app'), 'manager code works in lower case too')
    x.close()

    # ---- agent: sign in, shift, partial break, resume ----
    pg.goto(BASE + '/index.html'); pg.fill('#code', 'EE-1001'); pg.click('#gateForm button')
    pg.click('.chip[data-len="9"]')
    ok('worked' in pg.inner_text('#pctLabel'), 'work-time headline shows time worked, not a percentage')
    pg.click('#tiles button[data-slot="break1"]'); pg.wait_for_timeout(1200); pg.click('#tStop')
    ok(pg.is_visible('#resOv'), 'ending a break shows the result popup'); pg.click('#rOk')
    btn = pg.locator('#tiles button[data-slot="break1"]')
    ok(btn.inner_text() == 'Resume' and btn.is_enabled(), 'break 1 can be RESUMED after a short use (not disabled)')
    ok('Min Left' in pg.inner_text('#tiles'), 'tile shows "N Min Left"')

    # ---- agent: 17 minutes on break 1 -> 2 minutes come off break 2 with a note ----
    pg.evaluate("""() => { const k='bt-break-tracker:v1', db=JSON.parse(localStorage.getItem(k)), d=Object.keys(db.days)[0], r=db.days[d]['EE-1001'];
      const s=Date.now()-3600000; r.breaks=[{slot:'break1',start:s,end:s+17*60000}]; localStorage.setItem(k,JSON.stringify(db)); }""")
    pg.reload(); pg.wait_for_selector('#tiles .tile')
    t = pg.inner_text('#tiles')
    ok('Break 2 is 13 min' in t and 'Sorry mate' in t, 'break 2 tile says: sorry mate, Break 2 is 13 min')
    ok(pg.locator('#tiles button[data-slot="break2"]').is_enabled(), 'break 2 still startable')
    ok(pg.is_visible('#rFg') and 'of 60 min' in pg.inner_text('.rg'), 'ring + legend present')

    # ---- manager: view more, custom break (every day), edit time ----
    m = ctx.new_page(); m.on('pageerror', lambda e: logs.append(str(e)))
    m.goto(BASE + '/manager.html'); m.fill('#code', 'MGR-7777'); m.click('#gateForm button'); m.click('#demo')
    ok(m.locator('#rows tr').count() == 5, 'manager sees the 5 pilot people')
    m.click('button[data-det="EE-1001"]')
    ok(m.is_visible('#dOv') and 'Break history' in m.inner_text('#dBody'), 'View more opens detailed history')
    m.select_option('#cKey', 'c1'); m.fill('#cMin', '10'); m.check('input[name=sc][value=daily]'); m.click('#cAdd')
    ok('Custom 1' in m.inner_text('#dBody') and 'every day' in m.inner_text('#dBody'), 'custom break added (every day)')
    m.fill('#lS', '08:00') if m.locator('#lS').count() else None
    m.click('#dClose')
    ok('+1 custom' in m.inner_text('#rows'), 'table flags the extra custom break')
    pg.reload(); pg.wait_for_selector('#tiles .tile')
    ok('Custom 1' in pg.inner_text('#tiles') and '10 Min' in pg.inner_text('#tiles'), 'agent now sees "Custom 1 / 10 Min"')

    # ---- breakathon (agent) and punctuality (manager) ----
    pg.click('a.link[href="breakathon.html"]'); pg.wait_for_selector('#rows tr')
    ok(pg.locator('#rows tr').count() == 5 and 'Top spot' in pg.inner_text('#sub'), 'Breakathon ranks everyone and shows the reward')
    ok('Minutes over' not in pg.inner_text('#th'), 'agents do not see other people\'s minutes over')
    m.goto(BASE + '/breakathon.html'); m.wait_for_selector('#rows tr')
    ok('Minutes over' in m.inner_text('#th'), 'manager punctuality report has the detail columns')
    ok(not logs, 'no JS or CSP errors: ' + '; '.join(logs)[:300])
    b.close()
print('\nRESULT:', 'ALL PASSED' if not errs else f'{len(errs)} FAILED'); sys.exit(1 if errs else 0)
