/**
 * AgendaPdfDocument Component
 *
 * A styled PDF document for meeting agendas using @react-pdf/renderer.
 * Creates a professional looking PDF with full agenda details.
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

// Register fonts (using system fonts)
Font.register({
  family: 'Helvetica',
  fonts: [
    { src: 'Helvetica' },
    { src: 'Helvetica-Bold', fontWeight: 'bold' },
    { src: 'Helvetica-Oblique', fontStyle: 'italic' },
  ],
});

// Styles
const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontSize: 10,
    fontFamily: 'Helvetica',
    backgroundColor: '#ffffff',
    lineHeight: 1.4,
  },
  header: {
    marginBottom: 24,
    borderBottomWidth: 2,
    borderBottomColor: '#e5e7eb',
    paddingBottom: 16,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 10,
    lineHeight: 1.2,
  },
  subtitle: {
    fontSize: 11,
    color: '#6b7280',
    marginBottom: 6,
    lineHeight: 1.4,
  },
  statusRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
  },
  badge: {
    backgroundColor: '#f3f4f6',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    fontSize: 9,
  },
  badgeGreen: {
    backgroundColor: '#dcfce7',
    color: '#166534',
  },
  badgeBlue: {
    backgroundColor: '#dbeafe',
    color: '#1e40af',
  },
  badgeAmber: {
    backgroundColor: '#fef3c7',
    color: '#92400e',
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f9fafb',
    padding: 12,
    borderRadius: 6,
    marginBottom: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#6366f1',
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#111827',
    flex: 1,
    lineHeight: 1.3,
  },
  sectionComplete: {
    backgroundColor: '#f0fdf4',
    borderLeftColor: '#22c55e',
  },
  sectionTitleComplete: {
    textDecoration: 'line-through',
    color: '#6b7280',
  },
  checkmark: {
    fontSize: 12,
    marginRight: 10,
    color: '#22c55e',
  },
  circle: {
    fontSize: 12,
    marginRight: 10,
    color: '#d1d5db',
  },
  itemCard: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 6,
    padding: 14,
    marginBottom: 12,
    marginLeft: 16,
  },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  itemTitle: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#111827',
    flex: 1,
    lineHeight: 1.3,
    marginRight: 8,
  },
  decisionBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    fontSize: 8,
    fontWeight: 'bold',
  },
  approved: {
    backgroundColor: '#dcfce7',
    color: '#166534',
  },
  rejected: {
    backgroundColor: '#fee2e2',
    color: '#991b1b',
  },
  tabled: {
    backgroundColor: '#fef3c7',
    color: '#92400e',
  },
  conditional: {
    backgroundColor: '#dbeafe',
    color: '#1e40af',
  },
  applicationInfo: {
    backgroundColor: '#f9fafb',
    padding: 10,
    borderRadius: 4,
    marginTop: 10,
  },
  infoRow: {
    flexDirection: 'row',
    marginBottom: 6,
    minHeight: 14,
  },
  infoLabel: {
    fontSize: 9,
    fontWeight: 'bold',
    color: '#6b7280',
    width: 85,
    lineHeight: 1.5,
  },
  infoValue: {
    fontSize: 9,
    color: '#374151',
    flex: 1,
    lineHeight: 1.5,
  },
  bylawSection: {
    backgroundColor: '#eff6ff',
    borderLeftWidth: 3,
    borderLeftColor: '#3b82f6',
    padding: 12,
    marginTop: 12,
    borderRadius: 4,
  },
  bylawTitle: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#1e40af',
    marginBottom: 8,
    lineHeight: 1.4,
  },
  bylawText: {
    fontSize: 9,
    color: '#374151',
    lineHeight: 1.5,
    marginBottom: 6,
  },
  bylawQuote: {
    fontSize: 9,
    fontStyle: 'italic',
    color: '#4b5563',
    backgroundColor: '#f3f4f6',
    padding: 8,
    borderRadius: 3,
    marginTop: 8,
    lineHeight: 1.5,
  },
  attendanceSection: {
    marginBottom: 24,
    padding: 16,
    backgroundColor: '#f9fafb',
    borderRadius: 8,
  },
  attendanceTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 12,
    lineHeight: 1.3,
  },
  attendanceStats: {
    fontSize: 11,
    color: '#6b7280',
    marginBottom: 12,
    lineHeight: 1.4,
  },
  attendanceGroup: {
    marginBottom: 14,
  },
  attendanceGroupTitle: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#374151',
    marginBottom: 8,
    lineHeight: 1.4,
  },
  attendeeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 5,
    minHeight: 20,
  },
  attendeeStatus: {
    width: 18,
    fontSize: 10,
  },
  attendeeName: {
    fontSize: 10,
    color: '#374151',
    flex: 1,
    lineHeight: 1.4,
  },
  attendeeStatusBadge: {
    fontSize: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 3,
  },
  present: {
    backgroundColor: '#dcfce7',
    color: '#166534',
  },
  absent: {
    backgroundColor: '#fee2e2',
    color: '#991b1b',
  },
  late: {
    backgroundColor: '#fef3c7',
    color: '#92400e',
  },
  excused: {
    backgroundColor: '#dbeafe',
    color: '#1e40af',
  },
  expected: {
    backgroundColor: '#f3f4f6',
    color: '#6b7280',
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
  noItems: {
    fontSize: 10,
    color: '#9ca3af',
    fontStyle: 'italic',
    marginLeft: 16,
    marginBottom: 12,
    lineHeight: 1.4,
  },
  notes: {
    fontSize: 9,
    color: '#6b7280',
    marginTop: 10,
    fontStyle: 'italic',
    lineHeight: 1.5,
  },
  formData: {
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  formDataTitle: {
    fontSize: 9,
    fontWeight: 'bold',
    color: '#6b7280',
    marginBottom: 8,
    lineHeight: 1.4,
  },
  formDataRow: {
    flexDirection: 'row',
    marginBottom: 5,
    minHeight: 12,
  },
  formDataLabel: {
    fontSize: 8,
    color: '#6b7280',
    width: 100,
    lineHeight: 1.5,
  },
  formDataValue: {
    fontSize: 8,
    color: '#374151',
    flex: 1,
    lineHeight: 1.5,
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

interface AgendaPdfDocumentProps {
  event: CalendarEvent & {
    facilitatorUserId?: string;
    facilitatorClaimedAt?: string;
    meetingStartedAt?: string;
    meetingEndedAt?: string;
    agendaFinalized?: boolean;
  };
  facilitator?: User;
  attendance: MeetingAttendance[];
  sections: AgendaSection[];
  items: EventAgendaItemWithDetails[];
  completions: MeetingSectionCompletion[];
}

export function AgendaPdfDocument({
  event,
  facilitator,
  attendance,
  sections,
  items,
  completions,
}: AgendaPdfDocumentProps) {
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
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  const getDecisionStyle = (decision: string) => {
    switch (decision) {
      case 'approved':
        return styles.approved;
      case 'rejected':
        return styles.rejected;
      case 'tabled':
      case 'deferred':
        return styles.tabled;
      case 'conditional':
      case 'recommended':
        return styles.conditional;
      default:
        return styles.badge;
    }
  };

  const getStatusStyle = (status: string) => {
    switch (status) {
      case 'present':
        return styles.present;
      case 'absent':
        return styles.absent;
      case 'late':
        return styles.late;
      case 'excused':
        return styles.excused;
      default:
        return styles.expected;
    }
  };

  const sortedSections = [...sections].sort((a, b) => a.sortOrder - b.sortOrder);
  const presentCount = attendance.filter(a => a.status === 'present' || a.status === 'late').length;
  const boardMembers = attendance.filter(a => a.attendeeRole === 'board_member');
  const management = attendance.filter(a => a.attendeeRole === 'management');

  // Extract form data for display
  const getFormDataDisplay = (item: EventAgendaItemWithDetails) => {
    if (!item.application?.formData) return null;
    const formData = item.application.formData as Record<string, any>;
    const displayFields: { label: string; value: string }[] = [];

    // Get key fields to display
    Object.entries(formData).forEach(([key, value]) => {
      if (value && typeof value === 'string' && value.length < 100) {
        const label = key.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase());
        displayFields.push({ label, value: String(value) });
      }
    });

    return displayFields.slice(0, 6); // Limit to 6 fields
  };

  // Extract bylaws from form template
  const getBylaws = (item: EventAgendaItemWithDetails) => {
    const schema = item.application?.formTemplate?.schema as any;
    if (!schema?.relevantBylaws) return null;
    return schema.relevantBylaws;
  };

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
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
          <View style={styles.statusRow}>
            {event.agendaFinalized && (
              <Text style={[styles.badge, styles.badgeBlue]}>Agenda Finalized</Text>
            )}
            {event.meetingStartedAt && !event.meetingEndedAt && (
              <Text style={[styles.badge, styles.badgeGreen]}>Meeting In Progress</Text>
            )}
            {event.meetingEndedAt && (
              <Text style={[styles.badge]}>Meeting Completed</Text>
            )}
          </View>
        </View>

        {/* Attendance */}
        {attendance.length > 0 && (
          <View style={styles.attendanceSection}>
            <Text style={styles.attendanceTitle}>Roll Call / Attendance</Text>
            <Text style={styles.attendanceStats}>
              {presentCount} of {attendance.length} Present
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
                    <Text style={[styles.attendeeStatusBadge, getStatusStyle(a.status)]}>
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
                    <Text style={[styles.attendeeStatusBadge, getStatusStyle(a.status)]}>
                      {a.status.charAt(0).toUpperCase() + a.status.slice(1)}
                    </Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        )}

        {/* Agenda Sections */}
        {sortedSections.map((section) => {
          const sectionItems = items.filter(item => item.sectionId === section.id);
          const completion = completions.find(c => c.sectionId === section.id);
          const isComplete = !!completion;
          const borderColor = sectionColors[section.slug] || '#6b7280';

          return (
            <View key={section.id} style={styles.section} wrap={false}>
              <View
                style={[
                  styles.sectionHeader,
                  { borderLeftColor: borderColor },
                  ...(isComplete ? [styles.sectionComplete] : []),
                ]}
              >
                <Text style={isComplete ? styles.checkmark : styles.circle}>
                  {isComplete ? '✓' : '○'}
                </Text>
                <Text style={[styles.sectionTitle, ...(isComplete ? [styles.sectionTitleComplete] : [])]}>
                  {section.name}
                </Text>
                <Text style={styles.badge}>
                  {sectionItems.length} item{sectionItems.length !== 1 ? 's' : ''}
                </Text>
              </View>

              {sectionItems.length === 0 ? (
                <Text style={styles.noItems}>No items in this section</Text>
              ) : (
                sectionItems.map((item) => {
                  const bylaws = getBylaws(item);
                  const formDataFields = getFormDataDisplay(item);

                  return (
                    <View key={item.id} style={styles.itemCard} wrap={false}>
                      <View style={styles.itemHeader}>
                        <Text style={styles.itemTitle}>
                          {item.title ||
                            (item.application
                              ? `Application: ${item.application.applicationNumber}`
                              : 'Untitled Item')}
                        </Text>
                        {item.decision && (
                          <Text style={[styles.decisionBadge, getDecisionStyle(item.decision)]}>
                            {item.decision.toUpperCase()}
                          </Text>
                        )}
                      </View>

                      {/* Application Info */}
                      {item.application && (
                        <View style={styles.applicationInfo}>
                          <View style={styles.infoRow}>
                            <Text style={styles.infoLabel}>Application #:</Text>
                            <Text style={styles.infoValue}>
                              {item.application.applicationNumber}
                            </Text>
                          </View>
                          <View style={styles.infoRow}>
                            <Text style={styles.infoLabel}>Address:</Text>
                            <Text style={styles.infoValue}>
                              {item.application.propertyAddress || 'N/A'}
                            </Text>
                          </View>
                          <View style={styles.infoRow}>
                            <Text style={styles.infoLabel}>Type:</Text>
                            <Text style={styles.infoValue}>
                              {item.application.formTemplate?.name || 'Unknown'}
                            </Text>
                          </View>
                          <View style={styles.infoRow}>
                            <Text style={styles.infoLabel}>Status:</Text>
                            <Text style={styles.infoValue}>
                              {item.application.status?.replace(/_/g, ' ').toUpperCase() || 'N/A'}
                            </Text>
                          </View>
                        </View>
                      )}

                      {/* Form Data Summary */}
                      {formDataFields && formDataFields.length > 0 && (
                        <View style={styles.formData}>
                          <Text style={styles.formDataTitle}>Project Details</Text>
                          {formDataFields.map((field, idx) => (
                            <View key={idx} style={styles.formDataRow}>
                              <Text style={styles.formDataLabel}>{field.label}:</Text>
                              <Text style={styles.formDataValue}>{field.value}</Text>
                            </View>
                          ))}
                        </View>
                      )}

                      {/* Bylaws */}
                      {bylaws?.primary && (
                        <View style={styles.bylawSection}>
                          <Text style={styles.bylawTitle}>
                            Relevant Bylaw: {bylaws.primary.document} - {bylaws.primary.section}
                          </Text>
                          <Text style={styles.bylawText}>{bylaws.primary.summary}</Text>
                          {bylaws.primary.keyRequirements && (
                            <View>
                              {bylaws.primary.keyRequirements.map((req: string, idx: number) => (
                                <Text key={idx} style={styles.bylawText}>
                                  • {req}
                                </Text>
                              ))}
                            </View>
                          )}
                          {bylaws.primary.quote && (
                            <Text style={styles.bylawQuote}>"{bylaws.primary.quote}"</Text>
                          )}
                        </View>
                      )}

                      {/* Notes */}
                      {item.decisionNotes && <Text style={styles.notes}>Decision Notes: {item.decisionNotes}</Text>}
                      {item.presenterNotes && <Text style={styles.notes}>Presenter Notes: {item.presenterNotes}</Text>}
                    </View>
                  );
                })
              )}
            </View>
          );
        })}

        {/* Footer */}
        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>POA Association Portal</Text>
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

export default AgendaPdfDocument;
