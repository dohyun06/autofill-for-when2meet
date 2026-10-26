var urlsEl = document.getElementById('urls');
var statusEl = document.getElementById('status');
var say = function (msg) { statusEl.textContent = msg; };

chrome.storage.local.get('urls', function (r) { urlsEl.value = r.urls || ''; });

// Runs in the when2meet page (MAIN world) so it can see the page's own globals.
function readPage() {
  if (typeof TimeOfSlot === 'undefined') return null;
  return { slots: TimeOfSlot, user: UserID };
}

// Runs in the page. Mirrors the site's SelectStop() save, but for arbitrary (non-rectangular) slot sets.
async function applyFree(free) {
  try {
    var want = new Set(free), add = [], remove = [], bits = '';
    for (var i = 0; i < TimeOfSlot.length; i++) {
      if (!document.getElementById('YouTime' + TimeOfSlot[i])) continue; // SelectStop skips these too
      var has = AvailableAtSlot[i].indexOf(UserID) !== -1, should = want.has(TimeOfSlot[i]);
      if (should && !has) { add.push(TimeOfSlot[i]); AvailableAtSlot[i].push(UserID); }
      if (!should && has) { remove.push(TimeOfSlot[i]); AvailableAtSlot[i].splice(AvailableAtSlot[i].indexOf(UserID), 1); }
      bits += should ? '1' : '0';
    }
    var batches = [[add, true], [remove, false]];
    for (var b = 0; b < batches.length; b++) {
      if (!batches[b][0].length) continue;
      var res = await fetch('SaveTimes.php', { method: 'POST', body: new URLSearchParams({
        person: UserID,
        event: location.search.slice(1).split('-')[0],
        slots: batches[b][0].join(','),
        availability: bits,
        password: document.getElementById('password').value,
        ChangeToAvailable: batches[b][1],
      }) });
      if (!res.ok) throw new Error('SaveTimes.php ' + res.status);
    }
    ReColorIndividual();
    ReColorGroup();
    return { add: add.length, remove: remove.length };
  } catch (e) {
    return { error: String(e) };
  }
}

async function run(tabId, urls) {
  var page = (await chrome.scripting.executeScript({ target: { tabId: tabId }, world: 'MAIN', func: readPage }))[0].result;
  if (!page) return say('when2meet 이벤트 페이지가 아니에요.');
  if (!page.user) return say('먼저 when2meet에서 이름을 입력해 로그인하세요.');
  // shortcut: "days of the week" events use fake dates, so calendar matching is meaningless; support if someone needs it.
  if (page.slots[0] < Date.UTC(2000, 0, 1) / 1000) return say('요일 형식 이벤트는 지원하지 않아요.');

  say('캘린더 불러오는 중…');
  var texts = await Promise.all(urls.map(async function (u) {
    var res = await fetch(u);
    if (!res.ok) throw new Error('캘린더 주소 오류 (' + res.status + '): 주소를 다시 확인하세요.');
    return res.text();
  }));
  var free = freeSlots(texts, page.slots);

  say('칠하는 중…');
  var r = (await chrome.scripting.executeScript({ target: { tabId: tabId }, world: 'MAIN', func: applyFree, args: [free] }))[0].result;
  if (r.error) return say('저장 실패: ' + r.error + ' — 페이지를 새로고침하고 다시 시도하세요.');
  say('완료: ' + r.add + '칸 가능, ' + r.remove + '칸 불가능으로 바꿨어요.');
}

document.getElementById('fill').addEventListener('click', async function () {
  var urls = urlsEl.value.split('\n').map(function (s) { return s.trim().replace(/^webcal:/, 'https:'); }).filter(Boolean);
  chrome.storage.local.set({ urls: urlsEl.value });
  if (!urls.length) return say('iCal 비공개 주소를 넣어주세요.');
  if (urls.some(function (u) { return !u.startsWith('https://calendar.google.com/'); }))
    return say('Google Calendar 주소(https://calendar.google.com/…)만 지원해요.');

  var tab = (await chrome.tabs.query({ active: true, currentWindow: true }))[0];
  if (!/^https:\/\/(www\.)?when2meet\.com\//.test(tab.url || '')) return say('when2meet 탭에서 눌러주세요.');
  try { await run(tab.id, urls); } catch (e) { say(e.message); }
});
