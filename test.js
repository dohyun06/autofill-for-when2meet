// node test.js
var assert = require('assert');
var freeSlots = require('./calendar.js').freeSlots;

var ics = [
  'BEGIN:VCALENDAR', 'VERSION:2.0',
  'BEGIN:VTIMEZONE', 'TZID:Asia/Seoul',
  'BEGIN:STANDARD', 'TZOFFSETFROM:+0900', 'TZOFFSETTO:+0900', 'TZNAME:KST', 'DTSTART:19700101T000000', 'END:STANDARD',
  'END:VTIMEZONE',
  // weekly Mon 10:00-11:00 KST (= 01:00-02:00 UTC), with the 2026-11-09 one moved to 12:00
  'BEGIN:VEVENT', 'UID:weekly', 'DTSTART;TZID=Asia/Seoul:20260105T100000', 'DTEND;TZID=Asia/Seoul:20260105T110000',
  'RRULE:FREQ=WEEKLY;BYDAY=MO', 'EXDATE;TZID=Asia/Seoul:20261116T100000', 'END:VEVENT',
  'BEGIN:VEVENT', 'UID:weekly', 'RECURRENCE-ID;TZID=Asia/Seoul:20261109T100000',
  'DTSTART;TZID=Asia/Seoul:20261109T120000', 'DTEND;TZID=Asia/Seoul:20261109T123000', 'END:VEVENT',
  // all-day, transparent: must not block
  'BEGIN:VEVENT', 'UID:holiday', 'DTSTART;VALUE=DATE:20261102', 'DTEND;VALUE=DATE:20261103', 'TRANSP:TRANSPARENT', 'END:VEVENT',
  // one-off UTC event
  'BEGIN:VEVENT', 'UID:once', 'DTSTART:20261102T031500Z', 'DTEND:20261102T033000Z', 'END:VEVENT',
  'END:VCALENDAR',
].join('\r\n');

var u = function (s) { return Date.parse(s) / 1000; };
var slots = [];
// Mon 2026-11-02 and Mon 2026-11-09, 00:00-04:00 UTC, plus Mon 2026-11-16 01:00 UTC
['2026-11-02', '2026-11-09'].forEach(function (d) {
  for (var t = u(d + 'T00:00:00Z'); t < u(d + 'T04:00:00Z'); t += 900) slots.push(t);
});
slots.push(u('2026-11-16T01:00:00Z'));

var free = new Set(freeSlots([ics], slots));
var busy = slots.filter(function (t) { return !free.has(t); }).map(function (t) { return new Date(t * 1000).toISOString(); });

assert.deepStrictEqual(busy, [
  '2026-11-02T01:00:00.000Z', '2026-11-02T01:15:00.000Z', '2026-11-02T01:30:00.000Z', '2026-11-02T01:45:00.000Z',
  '2026-11-02T03:15:00.000Z',
  // 11-09: moved to 12:00-12:30 KST = 03:00-03:30 UTC
  '2026-11-09T03:00:00.000Z', '2026-11-09T03:15:00.000Z',
  // 11-16 is EXDATE'd, so 01:00 stays free
]);
console.log('ok');
