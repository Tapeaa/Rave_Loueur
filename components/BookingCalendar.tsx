import { useMemo, useState } from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Text } from '@/components/ui/Text';
import type { Order } from '@/lib/types';
import { isRentalOrderLike } from '@/lib/rental-lifecycle';

const GREEN = '#4ECC8B';
const GREEN_SOFT = '#D1F2E3';
const AMBER = '#F59E0B';
const TAHITI_TZ = 'Pacific/Tahiti';
const WEEKDAYS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
const BOOKED_STATUSES = ['accepted', 'booked', 'in_progress', 'completed'];
const MAX_RANGE_DAYS = 120;

function tahitiYmd(d: Date): string {
  return d.toLocaleDateString('en-CA', { timeZone: TAHITI_TZ });
}

function ymdToUtc(ymd: string): number {
  const [y, m, d] = ymd.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
}

function utcToYmd(t: number): string {
  return new Date(t).toISOString().slice(0, 10);
}

function parseDate(value: unknown): Date | null {
  if (!value) return null;
  const d = new Date(value as string);
  return Number.isNaN(d.getTime()) ? null : d;
}

type DayInfo = { booked: Order[]; pending: Order[] };

function buildDayMap(orders: Order[]): Map<string, DayInfo> {
  const map = new Map<string, DayInfo>();
  for (const order of orders) {
    if (!isRentalOrderLike(order)) continue;
    const isBooked = BOOKED_STATUSES.includes(order.status);
    const isPending = order.status === 'pending';
    if (!isBooked && !isPending) continue;
    const ro = (order.rideOption || {}) as any;
    const start = parseDate(ro.startDate || order.scheduledTime);
    if (!start) continue;
    const end = parseDate(ro.endDate || order.rentalRawData?.endDate) || start;
    let t = ymdToUtc(tahitiYmd(start));
    const last = Math.min(ymdToUtc(tahitiYmd(end)), t + MAX_RANGE_DAYS * 86400000);
    for (; t <= last; t += 86400000) {
      const key = utcToYmd(t);
      const info = map.get(key) || { booked: [], pending: [] };
      (isBooked ? info.booked : info.pending).push(order);
      map.set(key, info);
    }
  }
  return map;
}

type Props = {
  orders: Order[];
  onPressOrder?: (order: Order) => void;
};

export function BookingCalendar({ orders, onPressOrder }: Props) {
  const todayYmd = tahitiYmd(new Date());
  const [cursor, setCursor] = useState(() => {
    const [y, m] = todayYmd.split('-').map(Number);
    return { y, m: m - 1 };
  });

  const dayMap = useMemo(() => buildDayMap(orders), [orders]);

  const { cells, bookedDaysInMonth } = useMemo(() => {
    const first = Date.UTC(cursor.y, cursor.m, 1);
    const daysInMonth = new Date(Date.UTC(cursor.y, cursor.m + 1, 0)).getUTCDate();
    const lead = (new Date(first).getUTCDay() + 6) % 7;
    const list: (string | null)[] = Array.from({ length: lead }, () => null);
    let booked = 0;
    for (let d = 1; d <= daysInMonth; d++) {
      const key = utcToYmd(Date.UTC(cursor.y, cursor.m, d));
      if (dayMap.get(key)?.booked.length) booked++;
      list.push(key);
    }
    while (list.length % 7 !== 0) list.push(null);
    return { cells: list, bookedDaysInMonth: booked };
  }, [cursor, dayMap]);

  const monthLabel = new Date(Date.UTC(cursor.y, cursor.m, 15)).toLocaleDateString('fr-FR', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });

  const shiftMonth = (delta: number) =>
    setCursor(({ y, m }) => {
      const next = m + delta;
      return { y: y + Math.floor(next / 12), m: ((next % 12) + 12) % 12 };
    });

  const rows: (string | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7));

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Mon calendrier</Text>
          <Text style={styles.subtitle}>
            {bookedDaysInMonth === 0
              ? 'Aucun jour réservé ce mois-ci'
              : `${bookedDaysInMonth} jour${bookedDaysInMonth > 1 ? 's' : ''} réservé${bookedDaysInMonth > 1 ? 's' : ''}`}
          </Text>
        </View>
        <TouchableOpacity style={styles.navBtn} onPress={() => shiftMonth(-1)} hitSlop={8}>
          <Ionicons name="chevron-back" size={18} color="#1a1a1a" />
        </TouchableOpacity>
        <Text style={styles.month}>{monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1)}</Text>
        <TouchableOpacity style={styles.navBtn} onPress={() => shiftMonth(1)} hitSlop={8}>
          <Ionicons name="chevron-forward" size={18} color="#1a1a1a" />
        </TouchableOpacity>
      </View>

      <View style={styles.weekRow}>
        {WEEKDAYS.map((d, i) => (
          <Text key={i} style={styles.weekday}>
            {d}
          </Text>
        ))}
      </View>

      {rows.map((row, ri) => (
        <View key={ri} style={styles.weekRow}>
          {row.map((key, ci) => {
            if (!key) return <View key={ci} style={styles.cell} />;
            const info = dayMap.get(key);
            const booked = !!info?.booked.length;
            const pending = !booked && !!info?.pending.length;
            const isToday = key === todayYmd;
            const isPast = key < todayYmd;
            const prevBooked = !!dayMap.get(utcToYmd(ymdToUtc(key) - 86400000))?.booked.length;
            const nextBooked = !!dayMap.get(utcToYmd(ymdToUtc(key) + 86400000))?.booked.length;
            const target = info?.booked[0] || info?.pending[0];
            return (
              <TouchableOpacity
                key={ci}
                style={styles.cell}
                activeOpacity={target ? 0.7 : 1}
                disabled={!target || !onPressOrder}
                onPress={() => target && onPressOrder?.(target)}
              >
                {booked && (
                  <View
                    style={[
                      styles.band,
                      isPast && styles.bandPast,
                      (!prevBooked || ci === 0) && styles.bandStart,
                      (!nextBooked || ci === 6) && styles.bandEnd,
                    ]}
                  />
                )}
                <View
                  style={[
                    styles.day,
                    isToday && styles.dayToday,
                    pending && styles.dayPending,
                  ]}
                >
                  <Text
                    style={StyleSheet.flatten([
                      styles.dayText,
                      isPast && !booked && styles.dayTextPast,
                      booked && styles.dayTextBooked,
                      booked && isPast && styles.dayTextBookedPast,
                    ])}
                  >
                    {Number(key.slice(8))}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      ))}

      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: GREEN }]} />
          <Text style={styles.legendText}>Réservé</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: '#FFFFFF', borderWidth: 2, borderColor: AMBER }]} />
          <Text style={styles.legendText}>Demande en attente</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: '#FFFFFF', borderWidth: 2, borderColor: '#1a1a1a' }]} />
          <Text style={styles.legendText}>Aujourd'hui</Text>
        </View>
      </View>
    </View>
  );
}

const CELL = 40;

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 20,
    paddingBottom: 18,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E7EB',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 6,
  },
  title: { fontSize: 16, fontWeight: '800', color: '#1a1a1a' },
  subtitle: { fontSize: 12, color: '#6B7280', marginTop: 2 },
  month: { fontSize: 13, fontWeight: '700', color: '#1a1a1a', minWidth: 92, textAlign: 'center' },
  navBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  weekRow: { flexDirection: 'row' },
  weekday: {
    flex: 1,
    textAlign: 'center',
    fontSize: 11,
    fontWeight: '700',
    color: '#9CA3AF',
    marginBottom: 4,
  },
  cell: {
    flex: 1,
    height: CELL,
    alignItems: 'center',
    justifyContent: 'center',
  },
  band: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 5,
    bottom: 5,
    backgroundColor: GREEN,
  },
  bandPast: { backgroundColor: GREEN_SOFT },
  bandStart: { left: 4, borderTopLeftRadius: 15, borderBottomLeftRadius: 15 },
  bandEnd: { right: 4, borderTopRightRadius: 15, borderBottomRightRadius: 15 },
  day: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayToday: { borderWidth: 2, borderColor: '#1a1a1a' },
  dayPending: { borderWidth: 2, borderColor: AMBER },
  dayText: { fontSize: 13, fontWeight: '600', color: '#1a1a1a' },
  dayTextPast: { color: '#C4C4C4' },
  dayTextBooked: { color: '#FFFFFF', fontWeight: '800' },
  dayTextBookedPast: { color: '#15803D' },
  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 14,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 12, height: 12, borderRadius: 6 },
  legendText: { fontSize: 11, color: '#6B7280' },
});
