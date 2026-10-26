// Pure logic: iCal text + when2meet slot times -> slot times that are free.
// Loaded by popup.html (ICAL is a global there) and by test.js under node.
var ICAL = typeof ICAL !== 'undefined' ? ICAL : require('./vendor/ical.min.js');

var SLOT_SECONDS = 900; // when2meet grids are always 15-minute slots
var MAX_OCCURRENCES = 20000; // guards against runaway RRULEs (e.g. no end, minutely)

// Returns [[startSec, endSec], ...] of busy time overlapping [rangeStart, rangeEnd).
// recurringOnly: skip one-off events (for "days of the week" events, which describe a typical week).
function busyIntervals(icsText, rangeStart, rangeEnd, recurringOnly) {
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
    if (!ev.isRecurring()) {
      if (!recurringOnly) add(ev.component, ev.startDate, ev.endDate);
      return;
    }
    var it = ev.iterator();
    for (var n = 0, next; (next = it.next()) && n < MAX_OCCURRENCES; n++) {
      var occ = ev.getOccurrenceDetails(next);
      if (occ.startDate.toUnixTime() >= rangeEnd) break;
      add(occ.item.component, occ.startDate, occ.endDate);
    }
  });
  return out;
}

// Maps a "days of the week" slot (placeholder date) to the same local weekday + time in each of
// the `weeks` weeks starting from `now` (Date). when2meet stores these as wall-clock times in UTC
// (the grid is pinned to UTC), so read them with UTC getters and place them in the browser's zone.
function realTimesForWeekday(slot, now, weeks) {
  var s = new Date(slot * 1000), out = [];
  var d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + (s.getUTCDay() - now.getDay() + 7) % 7,
    s.getUTCHours(), s.getUTCMinutes());
  for (var k = 0; k < weeks; k++, d.setDate(d.getDate() + 7)) out.push(d.getTime() / 1000);
  return out;
}

// slots: when2meet TimeOfSlot (unix seconds). Returns the slots with no busy overlap.
// opts.weekdays: slots are placeholder weekdays; check recurring events over the next opts.weeks weeks.
function freeSlots(icsTexts, slots, opts) {
  opts = opts || {};
  var times = slots.map(function (t) {
    return opts.weekdays ? realTimesForWeekday(t, opts.now || new Date(), opts.weeks || 4) : [t];
  });
  var all = [].concat.apply([], times);
  var lo = Math.min.apply(null, all), hi = Math.max.apply(null, all) + SLOT_SECONDS;
  var busy = [];
  icsTexts.forEach(function (t) { busy = busy.concat(busyIntervals(t, lo, hi, opts.weekdays)); });
  return slots.filter(function (t, i) {
    return times[i].every(function (r) {
      return !busy.some(function (b) { return b[0] < r + SLOT_SECONDS && b[1] > r; });
    });
  });
}

if (typeof module !== 'undefined') module.exports = { busyIntervals: busyIntervals, freeSlots: freeSlots };
