// Pure logic: iCal text + when2meet slot times -> slot times that are free.
// Loaded by popup.html (ICAL is a global there) and by test.js under node.
var ICAL = typeof ICAL !== 'undefined' ? ICAL : require('./vendor/ical.min.js');

var SLOT_SECONDS = 900; // when2meet grids are always 15-minute slots
var MAX_OCCURRENCES = 20000; // guards against runaway RRULEs (e.g. no end, minutely)

// Returns [[startSec, endSec], ...] of busy time overlapping [rangeStart, rangeEnd).
function busyIntervals(icsText, rangeStart, rangeEnd) {
  var vcal = new ICAL.Component(ICAL.parse(icsText));
  vcal.getAllSubcomponents('vtimezone').forEach(function (tz) {
    ICAL.TimezoneService.register(tz);
  });

  var masters = {};
  var exceptions = [];
  vcal.getAllSubcomponents('vevent').forEach(function (comp) {
    var ev = new ICAL.Event(comp);
    if (ev.isRecurrenceException()) exceptions.push(ev);
    else masters[ev.uid] = ev;
  });
  exceptions.forEach(function (ex) {
    if (masters[ex.uid]) masters[ex.uid].relateException(ex);
    else masters[ex.uid + ex.recurrenceId] = ex; // orphan override: treat as a single event
  });

  var out = [];
  function add(comp, start, end) {
    // Google exports all-day / "show as free" events as TRANSPARENT
    if (comp.getFirstPropertyValue('transp') === 'TRANSPARENT') return;
    if (comp.getFirstPropertyValue('status') === 'CANCELLED') return;
    var s = start.toUnixTime(), e = end.toUnixTime();
    if (s < rangeEnd && e > rangeStart) out.push([s, e]);
  }

  Object.keys(masters).forEach(function (k) {
    var ev = masters[k];
    if (!ev.isRecurring()) return add(ev.component, ev.startDate, ev.endDate);
    var it = ev.iterator();
    for (var n = 0, next; (next = it.next()) && n < MAX_OCCURRENCES; n++) {
      var occ = ev.getOccurrenceDetails(next);
      if (occ.startDate.toUnixTime() >= rangeEnd) break;
      add(occ.item.component, occ.startDate, occ.endDate);
    }
  });
  return out;
}

// slots: when2meet TimeOfSlot (unix seconds). Returns the slots with no busy overlap.
function freeSlots(icsTexts, slots) {
  var lo = Math.min.apply(null, slots), hi = Math.max.apply(null, slots) + SLOT_SECONDS;
  var busy = [];
  icsTexts.forEach(function (t) { busy = busy.concat(busyIntervals(t, lo, hi)); });
  return slots.filter(function (t) {
    return !busy.some(function (b) { return b[0] < t + SLOT_SECONDS && b[1] > t; });
  });
}

if (typeof module !== 'undefined') module.exports = { busyIntervals: busyIntervals, freeSlots: freeSlots };
