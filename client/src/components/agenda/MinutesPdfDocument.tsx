/**
 * MinutesPdfDocument Component
 *
 * Generates a formal meeting minutes PDF using @react-pdf/renderer.
 * Includes duration, attendance, decisions, discussion notes, and action items.
 */

import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Font,
} from '@react-pdf/renderer';
import type {
  CalendarEvent,
  User,
  MeetingAttendance,
  AgendaSection,
  EventAgendaItemWithDetails,
  MeetingSectionCompletion,
} from '@/lib/api';

Font.register({
  family: 'Helvetica',
  fonts: [
    { src: 'Helvetica' },
    { src: 'Helvetica-Bold', fontWeight: 'bold' },
    { src: 'Helvetica-Oblique', fontStyle: 'italic' },
  ],
});

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontSize: 10,
    fontFamily: 'Helvetica',
    backgroundColor: '#ffffff',
    lineHeight: 1.4,
  },
  header: {
    marginBottom: 20,
    borderBottomWidth: 2,
    borderBottomColor: '#1e40af',
    paddingBottom: 14,
  },
  headerLabel: {
    fontSize: 9,
    color: '#6b7280',
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 8,
    lineHeight: 1.2,
  },
  subtitle: {
    fontSize: 10,
    color: '#6b7280',
    marginBottom: 4,
    lineHeight: 1.4,
  },
  durationBlock: {
    marginBottom: 16,
    padding: 12,
    backgroundColor: '#f9fafb',
    borderRadius: 6,
  },
  durationRow: {
    flexDirection: 'row',
    gap: 24,
  },
  durationItem: {
    flexDirection: 'column',
  },
  durationLabel: {
    fontSize: 8,
    color: '#6b7280',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 2,
  },
  durationValue: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#111827',
  },
  sectionHeading: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#111827',
    marginTop: 16,
    marginBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    paddingBottom: 6,
  },
  attendanceSection: {
    marginBottom: 16,
  },
  attendanceGroup: {
    marginBottom: 10,
  },
  attendanceGroupTitle: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#374151',
    marginBottom: 6,
  },
  attendeeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 3,
  },
  attendeeStatus: {
    width: 16,
    fontSize: 10,
  },
  attendeeName: {
    fontSize: 10,
    color: '#374151',
    flex: 1,
  },
  attendeeBadge: {
    fontSize: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 3,
  },
  present: { backgroundColor: '#dcfce7', color: '#166534' },
  absent: { backgroundColor: '#fee2e2', color: '#991b1b' },
  late: { backgroundColor: '#fef3c7', color: '#92400e' },
  excused: { backgroundColor: '#dbeafe', color: '#1e40af' },
  expected: { backgroundColor: '#f3f4f6', color: '#6b7280' },
  quorumBadge: {
    fontSize: 9,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    marginBottom: 10,
  },
  quorumMet: { backgroundColor: '#dcfce7', color: '#166534' },
  quorumNotMet: { backgroundColor: '#fee2e2', color: '#991b1b' },
  agendaSection: {
    marginBottom: 14,
  },
  agendaSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f9fafb',
    padding: 10,
    borderRadius: 6,
    marginBottom: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#6366f1',
  },
  agendaSectionTitle: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#111827',
    flex: 1,
  },
  completedMark: {
    fontSize: 10,
    color: '#22c55e',
    marginRight: 8,
  },
  incompleteMark: {
    fontSize: 10,
    color: '#d1d5db',
    marginRight: 8,
  },
  itemCard: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 6,
    padding: 12,
    marginBottom: 8,
    marginLeft: 12,
  },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 6,
  },
  itemTitle: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#111827',
    flex: 1,
    marginRight: 8,
  },
  decisionBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    fontSize: 8,
    fontWeight: 'bold',
  },
  approved: { backgroundColor: '#dcfce7', color: '#166534' },
  rejected: { backgroundColor: '#fee2e2', color: '#991b1b' },
  tabled: { backgroundColor: '#fef3c7', color: '#92400e' },
  conditional: { backgroundColor: '#dbeafe', color: '#1e40af' },
  defaultDecision: { backgroundColor: '#f3f4f6', color: '#6b7280' },
  itemMeta: {
    fontSize: 9,
    color: '#6b7280',
    marginBottom: 4,
  },
  notesBlock: {
    backgroundColor: '#f0f9ff',
    borderLeftWidth: 2,
    borderLeftColor: '#3b82f6',
    padding: 8,
    borderRadius: 3,
    marginTop: 6,
  },
  notesLabel: {
    fontSize: 8,
    fontWeight: 'bold',
    color: '#1e40af',
    marginBottom: 3,
  },
  notesText: {
    fontSize: 9,
    color: '#374151',
    lineHeight: 1.5,
  },
  presenterNotesBlock: {
    backgroundColor: '#f9fafb',
    padding: 8,
    borderRadius: 3,
    marginTop: 6,
  },
  actionItemsSection: {
    marginTop: 16,
    padding: 14,
    backgroundColor: '#fefce8',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#fde68a',
  },
  actionItemTitle: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#92400e',
    marginBottom: 8,
  },
  actionItem: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  actionBullet: {
    fontSize: 9,
    color: '#92400e',
    marginRight: 6,
  },
  actionText: {
    fontSize: 9,
    color: '#78350f',
    flex: 1,
    lineHeight: 1.4,
  },
  footer: {
    position: 'absolute',
    bottom: 30,
    left: 40,
    right: 40,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    paddingTop: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  footerText: {
    fontSize: 8,
    color: '#9ca3af',
  },
});

// Section border colors
const sectionColors: Record<string, string> = {
  call_to_order: '#a855f7',
  roll_call: '#3b82f6',
  approval_of_minutes: '#22c55e',
  old_business: '#f59e0b',
  new_business: '#f97316',
  committee_reports: '#06b6d4',
  final_approvals: '#10b981',
  open_forum: '#ec4899',
  adjournment: '#6b7280',
};

interface MinutesPdfDocumentProps {
  event: CalendarEvent & {
    facilitatorUserId?: string;
    meetingStartedAt?: string;
    meetingEndedAt?: string;
  };
  facilitator?: User;
  attendance: MeetingAttendance[];
  sections: AgendaSection[];
  items: EventAgendaItemWithDetails[];
  completions: MeetingSectionCompletion[];
}

export function MinutesPdfDocument({
  event,
  facilitator,
  attendance,
  sections,
  items,
  completions,
}: MinutesPdfDocumentProps) {
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  };

  const formatDuration = (startStr: string, endStr: string) => {
    const diff = new Date(endStr).getTime() - new Date(startStr).getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  };

  const getDecisionStyle = (decision: string) => {
    switch (decision) {
      case 'approved': return styles.approved;
      case 'rejected': return styles.rejected;
      case 'tabled':
      case 'deferred': return styles.tabled;
      case 'conditional':
      case 'recommended': return styles.conditional;
      default: return styles.defaultDecision;
    }
  };

  const getStatusStyle = (status: string) => {
    switch (status) {
      case 'present': return styles.present;
      case 'absent': return styles.absent;
      case 'late': return styles.late;
      case 'excused': return styles.excused;
      default: return styles.expected;
    }
  };

  const decisionLabels: Record<string, string> = {
    approved: 'APPROVED',
    rejected: 'REJECTED',
    tabled: 'TABLED',
    needs_info: 'NEEDS INFO',
    conditional: 'CONDITIONAL',
    deferred: 'DEFERRED',
    withdrawn: 'WITHDRAWN',
    recommended: 'RECOMMENDED',
  };

  const sortedSections = [...sections].sort((a, b) => a.sortOrder - b.sortOrder);
  const completionMap = new Map(completions.map(c => [c.sectionId, c]));

  // Attendance stats
  const boardMembers = attendance.filter(a => a.attendeeRole === 'board_member');
  const management = attendance.filter(a => a.attendeeRole === 'management');
  const presentCount = attendance.filter(a => a.status === 'present' || a.status === 'late').length;
  const boardPresent = boardMembers.filter(a => a.status === 'present' || a.status === 'late').length;
  const hasQuorum = boardMembers.length > 0 && boardPresent > boardMembers.length / 2;

  // Extract action items from discussion notes
  const actionItems: { item: string; source: string }[] = [];
  for (const item of items) {
    if (item.discussionNotes) {
      const lines = item.discussionNotes.split('\n');
      for (const line of lines) {
        const match = line.match(/^(?:ACTION|TODO|TASK):\s*(.+)/i);
        if (match) {
          const title = item.title || item.application?.title || item.application?.applicationNumber || 'Unknown';
          actionItems.push({ item: match[1].trim(), source: title });
        }
      }
    }
  }

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerLabel}>Meeting Minutes</Text>
          <Text style={styles.title}>{event.title}</Text>
          <Text style={styles.subtitle}>
            {formatDate(event.startDatetime)} at {formatTime(event.startDatetime)}
          </Text>
          {event.location && (
            <Text style={styles.subtitle}>Location: {event.location}</Text>
          )}
          {facilitator && (
            <Text style={styles.subtitle}>
              Facilitator: {facilitator.firstName} {facilitator.lastName}
            </Text>
          )}
        </View>

        {/* Duration */}
        {event.meetingStartedAt && event.meetingEndedAt && (
          <View style={styles.durationBlock}>
            <View style={styles.durationRow}>
              <View style={styles.durationItem}>
                <Text style={styles.durationLabel}>Started</Text>
                <Text style={styles.durationValue}>{formatTime(event.meetingStartedAt)}</Text>
              </View>
              <View style={styles.durationItem}>
                <Text style={styles.durationLabel}>Ended</Text>
                <Text style={styles.durationValue}>{formatTime(event.meetingEndedAt)}</Text>
              </View>
              <View style={styles.durationItem}>
                <Text style={styles.durationLabel}>Total Duration</Text>
                <Text style={styles.durationValue}>
                  {formatDuration(event.meetingStartedAt, event.meetingEndedAt)}
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* Attendance */}
        {attendance.length > 0 && (
          <View style={styles.attendanceSection}>
            <Text style={styles.sectionHeading}>Attendance</Text>
            <Text style={[
              styles.quorumBadge,
              hasQuorum ? styles.quorumMet : styles.quorumNotMet,
            ]}>
              {hasQuorum ? 'Quorum Met' : 'No Quorum'} — {presentCount} of {attendance.length} present
              {boardMembers.length > 0 && ` (Board: ${boardPresent}/${boardMembers.length})`}
            </Text>

            {boardMembers.length > 0 && (
              <View style={styles.attendanceGroup}>
                <Text style={styles.attendanceGroupTitle}>Board Members</Text>
                {boardMembers.map((a) => (
                  <View key={a.id} style={styles.attendeeRow}>
                    <Text style={styles.attendeeStatus}>
                      {a.status === 'present' ? '✓' : a.status === 'absent' ? '✗' : '○'}
                    </Text>
                    <Text style={styles.attendeeName}>
                      {a.user?.firstName} {a.user?.lastName}
                    </Text>
                    <Text style={[styles.attendeeBadge, getStatusStyle(a.status)]}>
                      {a.status.charAt(0).toUpperCase() + a.status.slice(1)}
                    </Text>
                  </View>
                ))}
              </View>
            )}

            {management.length > 0 && (
              <View style={styles.attendanceGroup}>
                <Text style={styles.attendanceGroupTitle}>Management</Text>
                {management.map((a) => (
                  <View key={a.id} style={styles.attendeeRow}>
                    <Text style={styles.attendeeStatus}>
                      {a.status === 'present' ? '✓' : a.status === 'absent' ? '✗' : '○'}
                    </Text>
                    <Text style={styles.attendeeName}>
                      {a.user?.firstName} {a.user?.lastName}
                    </Text>
                    <Text style={[styles.attendeeBadge, getStatusStyle(a.status)]}>
                      {a.status.charAt(0).toUpperCase() + a.status.slice(1)}
                    </Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        )}

        {/* Agenda Sections */}
        <Text style={styles.sectionHeading}>Meeting Proceedings</Text>
        {sortedSections.map((section) => {
          const sectionItems = items.filter(i => i.sectionId === section.id);
          const isComplete = completionMap.has(section.id);
          const borderColor = sectionColors[section.slug] || '#6b7280';

          return (
            <View key={section.id} style={styles.agendaSection} wrap={false}>
              <View style={[styles.agendaSectionHeader, { borderLeftColor: borderColor }]}>
                <Text style={isComplete ? styles.completedMark : styles.incompleteMark}>
                  {isComplete ? '✓' : '○'}
                </Text>
                <Text style={styles.agendaSectionTitle}>{section.name}</Text>
              </View>

              {sectionItems.length === 0 ? (
                <Text style={{ fontSize: 9, color: '#9ca3af', fontStyle: 'italic', marginLeft: 12, marginBottom: 8 }}>
                  No items discussed
                </Text>
              ) : (
                sectionItems.map((item) => (
                  <View key={item.id} style={styles.itemCard} wrap={false}>
                    <View style={styles.itemHeader}>
                      <Text style={styles.itemTitle}>
                        {item.title || (item.application
                          ? `Application: ${item.application.applicationNumber}`
                          : 'Untitled Item')}
                      </Text>
                      {item.decision && (
                        <Text style={[styles.decisionBadge, getDecisionStyle(item.decision)]}>
                          {decisionLabels[item.decision] || item.decision.toUpperCase()}
                        </Text>
                      )}
                    </View>

                    {/* Application metadata */}
                    {item.application && (
                      <View>
                        <Text style={styles.itemMeta}>
                          App #{item.application.applicationNumber}
                          {item.application.propertyAddress && ` | ${item.application.propertyAddress}`}
                        </Text>
                      </View>
                    )}

                    {/* Decision notes */}
                    {item.decisionNotes && (
                      <View style={styles.presenterNotesBlock}>
                        <Text style={[styles.notesLabel, { color: '#374151' }]}>Decision Notes</Text>
                        <Text style={styles.notesText}>{item.decisionNotes}</Text>
                      </View>
                    )}

                    {/* Discussion notes */}
                    {item.discussionNotes && (
                      <View style={styles.notesBlock}>
                        <Text style={styles.notesLabel}>Discussion Notes</Text>
                        <Text style={styles.notesText}>{item.discussionNotes}</Text>
                      </View>
                    )}

                    {/* Presenter notes */}
                    {item.presenterNotes && (
                      <View style={styles.presenterNotesBlock}>
                        <Text style={[styles.notesLabel, { color: '#6b7280' }]}>Presenter Notes</Text>
                        <Text style={styles.notesText}>{item.presenterNotes}</Text>
                      </View>
                    )}
                  </View>
                ))
              )}
            </View>
          );
        })}

        {/* Action Items */}
        {actionItems.length > 0 && (
          <View style={styles.actionItemsSection} wrap={false}>
            <Text style={styles.actionItemTitle}>Action Items</Text>
            {actionItems.map((ai, idx) => (
              <View key={idx} style={styles.actionItem}>
                <Text style={styles.actionBullet}>▸</Text>
                <Text style={styles.actionText}>
                  {ai.item} (from: {ai.source})
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* Footer */}
        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>
            {facilitator
              ? `Prepared by ${facilitator.firstName} ${facilitator.lastName}`
              : 'POA Association Portal'}
          </Text>
          <Text style={styles.footerText}>
            Generated: {new Date().toLocaleDateString('en-US', {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
              hour: 'numeric',
              minute: '2-digit',
            })}
          </Text>
        </View>
      </Page>
    </Document>
  );
}

export default MinutesPdfDocument;
