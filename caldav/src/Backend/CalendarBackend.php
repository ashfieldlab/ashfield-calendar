<?php

namespace Ashfield\Caldav\Backend;

use Sabre\CalDAV\Backend\AbstractBackend;
use Sabre\CalDAV\Backend\SyncSupport;
use Sabre\DAV\Exception\Forbidden;
use Sabre\DAV\Exception\NotFound;
use Sabre\DAV\PropPatch;

/**
 * 우리 캘린더 schema 와 Sabre CalDAV 추상화의 어댑터 (ADR-0014).
 *
 * 회사 격리: 매 backend 호출마다 (a) HTTP Basic Authorization 헤더의 username 으로
 * user_sub 추출, (b) DB 의 caldav_tokens 에서 그 user 의 active token row 로
 * company_id 결정. PHP 프로세스 메모리(static 등) 의존 X: fresh DB 만 신뢰.
 *
 * 토큰이 acme-corp 이면 다른 회사 캘린더 보일 일 절대 없음.
 */
class CalendarBackend extends AbstractBackend implements SyncSupport
{
    public function __construct(private \PDO $db)
    {
    }

    /**
     * principal 의 캘린더 목록.
     *
     * scope=personal AND owner_id=user_sub  OR  scope=shared (회사 모든 멤버)
     * external_ics 캘린더는 외부 sync 라 노출 X (별도 정책).
     */
    public function getCalendarsForUser($principalUri): array
    {
        $userSub = $this->extractUserSub($principalUri);
        if ($userSub === null) {
            return [];
        }
        $companyId = $this->lookupCompanyId($userSub);
        if ($companyId === null) {
            return [];
        }

        $stmt = $this->db->prepare(
            "SELECT id, name, description, color, scope, sync_token
             FROM calendars
             WHERE company_id = :cid
               AND deleted_at IS NULL
               AND source = 'native'
               AND (scope = 'shared' OR (scope = 'personal' AND owner_id = :sub))
             ORDER BY scope DESC, name"
        );
        $stmt->execute([':cid' => $companyId, ':sub' => $userSub]);
        $rows = $stmt->fetchAll(\PDO::FETCH_ASSOC);

        $out = [];
        foreach ($rows as $row) {
            $out[] = [
                'id' => $row['id'],
                'uri' => $row['id'], // URL 슬러그 = id
                'principaluri' => $principalUri,
                '{DAV:}displayname' => $row['name'],
                '{urn:ietf:params:xml:ns:caldav}calendar-description' => $row['description'] ?? '',
                '{http://apple.com/ns/ical/}calendar-color' => $row['color'],
                '{http://sabredav.org/ns}sync-token' => (string) $row['sync_token'],
                '{DAV:}sync-token' => 'http://sabre.io/ns/sync/' . $row['sync_token'],
                '{urn:ietf:params:xml:ns:caldav}supported-calendar-component-set' =>
                    new \Sabre\CalDAV\Xml\Property\SupportedCalendarComponentSet(['VEVENT']),
            ];
        }
        return $out;
    }

    /**
     * 캘린더 안의 모든 객체 메타데이터 (큰 body 제외).
     */
    public function getCalendarObjects($calendarId): array
    {
        if (!$this->canAccess($calendarId)) {
            return [];
        }

        $stmt = $this->db->prepare(
            "SELECT id, dav_uri, raw_ics, updated_at,
                    title, start_at, end_at, all_day, rrule, recurrence_exceptions,
                    description, location, timezone
             FROM calendar_events
             WHERE calendar_id = :cid AND deleted_at IS NULL"
        );
        $stmt->execute([':cid' => $calendarId]);
        $rows = $stmt->fetchAll(\PDO::FETCH_ASSOC);

        $out = [];
        foreach ($rows as $row) {
            $ics = $row['raw_ics'] ?: $this->serializeEvent($row);
            $uri = $row['dav_uri'] ?: ($row['id'] . '.ics');
            $out[] = [
                'id' => $row['id'],
                'uri' => $uri,
                'lastmodified' => strtotime($row['updated_at']),
                'etag' => '"' . md5($ics) . '"',
                'size' => strlen($ics),
                'calendarid' => $calendarId,
                'component' => 'vevent',
            ];
        }
        return $out;
    }

    /**
     * 캘린더 객체 한 건 전체 (calendardata 포함).
     */
    public function getCalendarObject($calendarId, $objectUri): array
    {
        if (!$this->canAccess($calendarId)) {
            throw new NotFound('Calendar not found');
        }

        $stmt = $this->db->prepare(
            "SELECT id, dav_uri, raw_ics, updated_at,
                    title, start_at, end_at, all_day, rrule, recurrence_exceptions,
                    description, location, timezone
             FROM calendar_events
             WHERE calendar_id = :cid AND (dav_uri = :uri OR id = :uid)
                   AND deleted_at IS NULL
             LIMIT 1"
        );
        $uid = str_replace('.ics', '', $objectUri);
        $stmt->execute([
            ':cid' => $calendarId,
            ':uri' => $objectUri,
            ':uid' => $uid,
        ]);
        $row = $stmt->fetch(\PDO::FETCH_ASSOC);
        if ($row === false) {
            throw new NotFound('Object not found');
        }

        $ics = $row['raw_ics'] ?: $this->serializeEvent($row);
        return [
            'id' => $row['id'],
            'uri' => $row['dav_uri'] ?: ($row['id'] . '.ics'),
            'lastmodified' => strtotime($row['updated_at']),
            'etag' => '"' . md5($ics) . '"',
            'size' => strlen($ics),
            'calendarid' => $calendarId,
            'component' => 'vevent',
            'calendardata' => $ics,
        ];
    }

    // --- write 메서드: Phase 2. 일단 403 으로 차단해 안전 ---

    public function createCalendar($principalUri, $calendarUri, array $properties): mixed
    {
        throw new Forbidden('Calendar creation via CalDAV not yet supported');
    }

    public function updateCalendar($calendarId, PropPatch $propPatch): void
    {
        // PropPatch 거부
    }

    public function deleteCalendar($calendarId): void
    {
        throw new Forbidden('Calendar deletion via CalDAV not supported');
    }

    public function createCalendarObject($calendarId, $objectUri, $calendarData): ?string
    {
        $this->assertCanWrite($calendarId);
        $parsed = $this->parseIcs(is_resource($calendarData) ? stream_get_contents($calendarData) : (string) $calendarData);
        if ($parsed === null) {
            throw new \Sabre\DAV\Exception\BadRequest('Invalid ICS');
        }
        $userSub = $this->currentUserSub();
        if ($userSub === null) {
            // assertCanWrite 가 이미 거부해야 정상: 방어적 가드.
            throw new \Sabre\DAV\Exception\NotAuthenticated('Authentication required');
        }
        $eventId = $this->newUuid();

        $this->db->beginTransaction();
        try {
            $stmt = $this->db->prepare(
                'INSERT INTO calendar_events
                 (id, calendar_id, title, description, location, start_at, end_at,
                  all_day, "timezone", rrule, recurrence_exceptions, created_by_sub,
                  dav_uri, raw_ics, created_at, updated_at)
                 VALUES (:id, :cid, :title, :description, :location, :start, :end,
                         FALSE, :tz, :rrule, :exdates, :sub,
                         :dav_uri, :raw_ics, NOW(), NOW())'
            );
            $stmt->execute([
                ':id' => $eventId,
                ':cid' => $calendarId,
                ':title' => $parsed['title'],
                ':description' => $parsed['description'],
                ':location' => $parsed['location'],
                ':start' => $parsed['start']->format('c'),
                ':end' => $parsed['end']->format('c'),
                ':tz' => $parsed['timezone'],
                ':rrule' => $parsed['rrule'],
                ':exdates' => json_encode($parsed['exdates']),
                ':sub' => $userSub,
                ':dav_uri' => $objectUri,
                ':raw_ics' => $parsed['raw'],
            ]);
            $this->recordChange($calendarId, $objectUri, 1);
            $this->db->commit();
        } catch (\Throwable $e) {
            $this->db->rollBack();
            throw $e;
        }
        return '"' . md5($parsed['raw']) . '"';
    }

    public function updateCalendarObject($calendarId, $objectUri, $calendarData): ?string
    {
        $this->assertCanWrite($calendarId);
        // booking-linked 차단: 우리 booking 시스템이 만든 이벤트는 외부 수정 금지
        $existing = $this->findEventByUri($calendarId, $objectUri);
        if ($existing === null) {
            throw new NotFound('Event not found');
        }
        if ($this->isBookingLinked($existing['id'])) {
            throw new Forbidden('이 일정은 예약 시스템이 관리합니다. 우리 앱에서만 수정 가능합니다.');
        }

        $parsed = $this->parseIcs(is_resource($calendarData) ? stream_get_contents($calendarData) : (string) $calendarData);
        if ($parsed === null) {
            throw new \Sabre\DAV\Exception\BadRequest('Invalid ICS');
        }

        $this->db->beginTransaction();
        try {
            $stmt = $this->db->prepare(
                'UPDATE calendar_events SET
                   title = :title, description = :description, location = :location,
                   start_at = :start, end_at = :end, "timezone" = :tz,
                   rrule = :rrule, recurrence_exceptions = :exdates,
                   raw_ics = :raw_ics, updated_at = NOW()
                 WHERE id = :id'
            );
            $stmt->execute([
                ':id' => $existing['id'],
                ':title' => $parsed['title'],
                ':description' => $parsed['description'],
                ':location' => $parsed['location'],
                ':start' => $parsed['start']->format('c'),
                ':end' => $parsed['end']->format('c'),
                ':tz' => $parsed['timezone'],
                ':rrule' => $parsed['rrule'],
                ':exdates' => json_encode($parsed['exdates']),
                ':raw_ics' => $parsed['raw'],
            ]);
            $this->recordChange($calendarId, $objectUri, 2);
            $this->db->commit();
        } catch (\Throwable $e) {
            $this->db->rollBack();
            throw $e;
        }
        return '"' . md5($parsed['raw']) . '"';
    }

    public function deleteCalendarObject($calendarId, $objectUri): void
    {
        $this->assertCanWrite($calendarId);
        $existing = $this->findEventByUri($calendarId, $objectUri);
        if ($existing === null) {
            // 이미 없음 = idempotent
            return;
        }
        if ($this->isBookingLinked($existing['id'])) {
            throw new Forbidden('이 일정은 예약 시스템이 관리합니다. 예약 취소를 통해서만 삭제 가능합니다.');
        }

        $this->db->beginTransaction();
        try {
            $stmt = $this->db->prepare(
                'UPDATE calendar_events SET deleted_at = NOW() WHERE id = :id'
            );
            $stmt->execute([':id' => $existing['id']]);
            $this->recordChange($calendarId, $objectUri, 3);
            $this->db->commit();
        } catch (\Throwable $e) {
            $this->db->rollBack();
            throw $e;
        }
    }

    /**
     * RFC 6578 collection-sync REPORT: sync_token 이후 변경분 반환.
     *
     * @return array|null
     */
    public function getChangesForCalendar($calendarId, $syncToken, $syncLevel, $limit = null)
    {
        if (!$this->canAccess($calendarId)) {
            return null;
        }
        // 현재 캘린더의 sync_token
        $stmt = $this->db->prepare('SELECT sync_token FROM calendars WHERE id = :id');
        $stmt->execute([':id' => $calendarId]);
        $row = $stmt->fetch(\PDO::FETCH_ASSOC);
        if ($row === false) {
            return null;
        }
        $current = (int) $row['sync_token'];

        $result = [
            'syncToken' => (string) $current,
            'added' => [],
            'modified' => [],
            'deleted' => [],
        ];

        // 첫 sync (token 없음) → 모든 객체를 added 로 보냄
        if ($syncToken === null || $syncToken === '') {
            $allStmt = $this->db->prepare(
                'SELECT dav_uri, id FROM calendar_events
                 WHERE calendar_id = :cid AND deleted_at IS NULL'
            );
            $allStmt->execute([':cid' => $calendarId]);
            foreach ($allStmt->fetchAll(\PDO::FETCH_ASSOC) as $r) {
                $result['added'][] = $r['dav_uri'] ?: ($r['id'] . '.ics');
            }
            return $result;
        }

        $token = (int) $syncToken;
        $changesStmt = $this->db->prepare(
            'SELECT object_uri, operation FROM calendar_object_changes
             WHERE calendar_id = :cid AND sync_token > :tok
             ORDER BY sync_token ASC'
            . ($limit ? ' LIMIT ' . (int) $limit : '')
        );
        $changesStmt->execute([':cid' => $calendarId, ':tok' => $token]);
        foreach ($changesStmt->fetchAll(\PDO::FETCH_ASSOC) as $c) {
            $key = match ((int) $c['operation']) {
                1 => 'added',
                2 => 'modified',
                3 => 'deleted',
                default => null,
            };
            if ($key !== null) {
                $result[$key][] = $c['object_uri'];
            }
        }
        return $result;
    }

    // --- 헬퍼 ---

    private function extractUserSub(string $principalUri): ?string
    {
        if (!str_starts_with($principalUri, 'principals/')) {
            return null;
        }
        $sub = substr($principalUri, strlen('principals/'));
        // legacy fallback: principals/users/{sub}
        if (str_starts_with($sub, 'users/')) {
            $sub = substr($sub, strlen('users/'));
        }
        return $sub === '' ? null : $sub;
    }

    /**
     * 토큰의 company_id 가 이 캘린더에 접근 가능한지: 회사 격리 강제.
     *
     * 현 request 의 HTTP Basic username (= user_sub) 와 그 user 의 active token
     * 의 company 를 매번 DB 에서 fresh lookup. 프로세스 메모리 의존 X.
     */
    private function canAccess(string $calendarId): bool
    {
        $userSub = $this->currentUserSub();
        if ($userSub === null) {
            return false;
        }
        $stmt = $this->db->prepare(
            "SELECT 1
             FROM calendars c
             JOIN caldav_tokens t
               ON t.company_id = c.company_id
              AND t.user_sub = :sub
              AND t.revoked_at IS NULL
             WHERE c.id = :id
               AND c.deleted_at IS NULL
               AND (c.scope = 'shared'
                    OR (c.scope = 'personal' AND c.owner_id = :sub))
             LIMIT 1"
        );
        $stmt->execute([':id' => $calendarId, ':sub' => $userSub]);
        return $stmt->fetch(\PDO::FETCH_ASSOC) !== false;
    }

    /**
     * 현 request 의 인증된 user_sub. HTTP Basic Authorization 헤더에서 추출.
     *
     * AuthPlugin 이 beforeMethod 에서 이미 검증 완료 후에만 method handler 가 호출되므로
     * 헤더의 username 신뢰 가능. $_SERVER 는 PHP 가 매 request 마다 새로 채우는
     * request-scoped global: process memory stale 위험 없음.
     */
    private function currentUserSub(): ?string
    {
        $auth = $_SERVER['HTTP_AUTHORIZATION'] ?? '';
        if (stripos($auth, 'Basic ') !== 0) {
            return null;
        }
        $decoded = base64_decode(substr($auth, 6), true);
        if ($decoded === false || !str_contains($decoded, ':')) {
            return null;
        }
        [$user] = explode(':', $decoded, 2);
        return $user !== '' ? $user : null;
    }

    /**
     * user_sub 의 active CalDAV 토큰 company. 토큰 없으면 NULL (인증 불가 상황).
     */
    private function lookupCompanyId(string $userSub): ?string
    {
        $st = $this->db->prepare(
            'SELECT company_id FROM caldav_tokens
             WHERE user_sub = :sub AND revoked_at IS NULL
             ORDER BY created_at LIMIT 1'
        );
        $st->execute([':sub' => $userSub]);
        $id = $st->fetchColumn();
        return $id === false ? null : (string) $id;
    }

    /**
     * 우리 CalendarEvent row → RFC 5545 VEVENT 텍스트.
     *
     * raw_ics 가 있으면 그걸 우선 사용. 없으면 우리 구조에서 즉시 직렬화.
     */
    private function serializeEvent(array $row): string
    {
        $tz = $row['timezone'] ?? 'UTC';
        $dtStart = (new \DateTime($row['start_at']))->setTimezone(new \DateTimeZone('UTC'));
        $dtEnd = (new \DateTime($row['end_at']))->setTimezone(new \DateTimeZone('UTC'));

        $lines = [
            'BEGIN:VCALENDAR',
            'VERSION:2.0',
            'PRODID:-//Ashfield//CalDAV//KR',
            'CALSCALE:GREGORIAN',
            'BEGIN:VEVENT',
            'UID:' . $row['id'] . '@ashfield.local',
            'DTSTAMP:' . gmdate('Ymd\THis\Z'),
            'DTSTART:' . $dtStart->format('Ymd\THis\Z'),
            'DTEND:' . $dtEnd->format('Ymd\THis\Z'),
            'SUMMARY:' . $this->escapeIcsText($row['title']),
        ];
        if (!empty($row['description'])) {
            $lines[] = 'DESCRIPTION:' . $this->escapeIcsText($row['description']);
        }
        if (!empty($row['location'])) {
            $lines[] = 'LOCATION:' . $this->escapeIcsText($row['location']);
        }
        if (!empty($row['rrule'])) {
            $lines[] = 'RRULE:' . $row['rrule'];
        }
        $exdates = json_decode($row['recurrence_exceptions'] ?? '[]', true);
        if (is_array($exdates)) {
            foreach ($exdates as $iso) {
                try {
                    $d = new \DateTime($iso);
                    $lines[] = 'EXDATE:' . $d->setTimezone(new \DateTimeZone('UTC'))->format('Ymd\THis\Z');
                } catch (\Throwable $e) {
                    // skip
                }
            }
        }
        $lines[] = 'END:VEVENT';
        $lines[] = 'END:VCALENDAR';
        return implode("\r\n", $lines) . "\r\n";
    }

    private function escapeIcsText(string $text): string
    {
        // RFC 5545 §3.3.11
        $text = str_replace(['\\', "\n", ',', ';'], ['\\\\', '\\n', '\\,', '\\;'], $text);
        return $text;
    }

    // --- write 헬퍼 ---

    /**
     * write 가능한 캘린더인지 + 회사 격리 검증. 실패 시 NotAuthenticated/Forbidden/NotFound.
     *
     * write 는 created_by_sub 가 NOT NULL FK 라 인증된 user_sub 가 반드시 있어야 함.
     */
    private function assertCanWrite(string $calendarId): void
    {
        if ($this->currentUserSub() === null) {
            throw new \Sabre\DAV\Exception\NotAuthenticated('Authentication required for write');
        }
        if (!$this->canAccess($calendarId)) {
            throw new NotFound('Calendar not found');
        }
        // external_ics 캘린더는 외부 sync 라 외부 write 금지
        $stmt = $this->db->prepare(
            'SELECT source FROM calendars WHERE id = :id'
        );
        $stmt->execute([':id' => $calendarId]);
        $row = $stmt->fetch(\PDO::FETCH_ASSOC);
        if ($row === false || $row['source'] !== 'native') {
            throw new Forbidden('Only native calendars accept writes');
        }
    }

    /**
     * 이벤트가 booking 시스템과 연결돼 있는지. 연결돼 있으면 외부 write 금지.
     */
    private function isBookingLinked(string $eventId): bool
    {
        $stmt = $this->db->prepare(
            'SELECT 1 FROM bookings WHERE calendar_event_id = :id LIMIT 1'
        );
        $stmt->execute([':id' => $eventId]);
        return $stmt->fetch(\PDO::FETCH_ASSOC) !== false;
    }

    /**
     * objectUri 또는 id 로 이벤트 조회.
     */
    private function findEventByUri(string $calendarId, string $objectUri): ?array
    {
        $uid = str_replace('.ics', '', $objectUri);
        $stmt = $this->db->prepare(
            'SELECT id, dav_uri FROM calendar_events
             WHERE calendar_id = :cid AND (dav_uri = :uri OR id = :uid)
                   AND deleted_at IS NULL
             LIMIT 1'
        );
        $stmt->execute([
            ':cid' => $calendarId,
            ':uri' => $objectUri,
            ':uid' => $uid,
        ]);
        $row = $stmt->fetch(\PDO::FETCH_ASSOC);
        return $row === false ? null : $row;
    }

    /**
     * sync_token 증가 + calendar_object_changes 행 INSERT. 같은 트랜잭션 안에서.
     */
    private function recordChange(string $calendarId, string $objectUri, int $operation): void
    {
        $upd = $this->db->prepare(
            'UPDATE calendars SET sync_token = sync_token + 1 WHERE id = :id
             RETURNING sync_token'
        );
        $upd->execute([':id' => $calendarId]);
        $newToken = (int) $upd->fetchColumn();

        $ins = $this->db->prepare(
            'INSERT INTO calendar_object_changes
             (calendar_id, object_uri, operation, sync_token)
             VALUES (:cid, :uri, :op, :tok)'
        );
        $ins->execute([
            ':cid' => $calendarId,
            ':uri' => $objectUri,
            ':op' => $operation,
            ':tok' => $newToken,
        ]);
    }

    /**
     * ICS 텍스트 → fields. Sabre VObject 사용.
     */
    private function parseIcs(string $ics): ?array
    {
        try {
            $vcal = \Sabre\VObject\Reader::read($ics);
        } catch (\Throwable $e) {
            return null;
        }
        if (!isset($vcal->VEVENT)) {
            return null;
        }
        $vevent = $vcal->VEVENT;
        // 여러 VEVENT (반복의 occurrence override 등) 가능: master 한 건만 처리
        if (is_iterable($vevent) && !($vevent instanceof \Sabre\VObject\Component)) {
            foreach ($vevent as $ev) {
                $vevent = $ev;
                break;
            }
        }

        $start = $vevent->DTSTART?->getDateTime();
        $end = $vevent->DTEND?->getDateTime();
        if ($start === null || $end === null) {
            return null;
        }

        $exdates = [];
        if (isset($vevent->EXDATE)) {
            foreach ($vevent->EXDATE as $ex) {
                try {
                    $d = $ex->getDateTime();
                    $exdates[] = $d->format('c');
                } catch (\Throwable $e) {
                    // skip
                }
            }
        }

        return [
            'title' => (string) ($vevent->SUMMARY ?? ''),
            'description' => isset($vevent->DESCRIPTION) ? (string) $vevent->DESCRIPTION : null,
            'location' => isset($vevent->LOCATION) ? (string) $vevent->LOCATION : null,
            'start' => $start,
            'end' => $end,
            'timezone' => isset($vevent->DTSTART) ? ($vevent->DTSTART['TZID']?->getValue() ?? 'UTC') : 'UTC',
            'rrule' => isset($vevent->RRULE) ? (string) $vevent->RRULE : null,
            'exdates' => $exdates,
            'raw' => $ics,
        ];
    }

    /**
     * PHP 에서 uuid v4: uuid 패키지 없이 직접 (이벤트 id 용).
     */
    private function newUuid(): string
    {
        $data = random_bytes(16);
        $data[6] = chr((ord($data[6]) & 0x0f) | 0x40);
        $data[8] = chr((ord($data[8]) & 0x3f) | 0x80);
        return vsprintf(
            '%s%s-%s-%s-%s-%s%s%s',
            str_split(bin2hex($data), 4)
        );
    }
}
